"use strict";

const db = require("../db");

const SERVICE_TYPE_MAP = {
  medical_escort: "就医陪诊",
  elderly_care: "老人陪护",
  child_care: "儿童托管",
  pet_care: "宠物托管",
  escort: "陪诊",
  register: "代挂号",
  pickup: "接送",
  planning: "AI规划"
};

function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function buildScope(user, requestedCommunityId) {
  if (user.role === "COMMUNITY_ADMIN") return { id: Number(user.communityId), clause: " AND community_id = ?" };
  const id = Number(requestedCommunityId || 0);
  return id > 0 ? { id, clause: " AND community_id = ?" } : { id: null, clause: "" };
}

async function getOverview(user, options = {}) {
  const end = normalizeDate(options.endDate) || new Date().toISOString().slice(0, 10);
  const start = normalizeDate(options.startDate) || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const scope = buildScope(user, options.communityId);
  const orderParams = [start, end];
  if (scope.id) orderParams.push(scope.id);
  const orderScope = scope.clause;

  const [summaryRows, serviceRows, communityRows, dailyRows, statusRows, refundRows] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) AS totalOrders,
        SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) AS completedOrders,
        SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,
        SUM(CASE WHEN payment_status = 'SUCCESS' THEN 1 ELSE 0 END) AS paidOrders,
        COALESCE(SUM(CASE WHEN payment_status = 'SUCCESS' THEN paid_amount ELSE 0 END),0) AS grossTurnover
      FROM orders
      WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)${orderScope}`,
      orderParams
    ),
    db.query(`
      SELECT service_type,
        COUNT(*) AS orderCount,
        SUM(CASE WHEN order_status='completed' THEN 1 ELSE 0 END) AS completedOrders,
        COALESCE(SUM(CASE WHEN payment_status='SUCCESS' THEN paid_amount ELSE 0 END),0) AS grossTurnover
      FROM orders
      WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)${orderScope}
      GROUP BY service_type ORDER BY grossTurnover DESC`, orderParams),
    db.query(`
      SELECT o.community_id, COALESCE(c.name, CONCAT('社区#',o.community_id)) AS communityName,
        COUNT(*) AS orderCount,
        SUM(CASE WHEN o.order_status='completed' THEN 1 ELSE 0 END) AS completedOrders,
        COALESCE(SUM(CASE WHEN o.payment_status='SUCCESS' THEN o.paid_amount ELSE 0 END),0) AS grossTurnover,
        COALESCE(SUM(s.platform_fee),0) AS platformFee,
        COALESCE(SUM(s.escort_amount),0) AS escortPayable
      FROM orders o
      LEFT JOIN communities c ON c.id=o.community_id
      LEFT JOIN escort_settlements s ON s.order_id=o.id
      WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)${orderScope.replaceAll('community_id','o.community_id')}
      GROUP BY o.community_id, c.name ORDER BY grossTurnover DESC`, orderParams),
    db.query(`
      SELECT DATE(created_at) AS day,
        COUNT(*) AS orderCount,
        SUM(CASE WHEN payment_status='SUCCESS' THEN paid_amount ELSE 0 END) AS grossTurnover,
        SUM(CASE WHEN order_status='completed' THEN 1 ELSE 0 END) AS completedOrders
      FROM orders
      WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)${orderScope}
      GROUP BY DATE(created_at) ORDER BY day ASC`, orderParams),
    db.query(`
      SELECT order_status AS status, COUNT(*) AS count
      FROM orders
      WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)${orderScope}
      GROUP BY order_status ORDER BY count DESC`, orderParams),
    db.query(`
      SELECT COALESCE(SUM(r.refund_amount),0) AS refundedAmount, COUNT(r.id) AS refundCount
      FROM refunds r INNER JOIN orders o ON o.id=r.order_id
      WHERE r.refund_status IN ('SUCCESS','SUCCESSFUL','COMPLETED')
        AND r.refunded_at >= ? AND r.refunded_at < DATE_ADD(?, INTERVAL 1 DAY)${orderScope.replaceAll('community_id','o.community_id')}`,
      orderParams)
  ]);

  const settlementParams = [start, end];
  if (scope.id) settlementParams.push(scope.id);
  const settlementRows = await db.query(`
    SELECT
      COALESCE(SUM(gross_amount),0) AS settledGross,
      COALESCE(SUM(platform_fee),0) AS platformFee,
      COALESCE(SUM(escort_amount),0) AS escortPayable,
      COALESCE(SUM(CASE WHEN settlement_status='PENDING' THEN escort_amount ELSE 0 END),0) AS pendingEscortAmount,
      COALESCE(SUM(CASE WHEN settlement_status='SETTLED' THEN escort_amount ELSE 0 END),0) AS settledEscortAmount,
      COUNT(*) AS settlementCount,
      SUM(CASE WHEN settlement_status='PENDING' THEN 1 ELSE 0 END) AS pendingSettlementCount,
      SUM(CASE WHEN settlement_status='SETTLED' THEN 1 ELSE 0 END) AS settledSettlementCount
    FROM escort_settlements
    WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)${scope.clause}`,
    settlementParams);

  const summary = summaryRows[0] || {};
  const settlement = settlementRows[0] || {};
  return {
    range: { startDate: start, endDate: end },
    summary: {
      totalOrders: Number(summary.totalOrders || 0),
      completedOrders: Number(summary.completedOrders || 0),
      cancelledOrders: Number(summary.cancelledOrders || 0),
      paidOrders: Number(summary.paidOrders || 0),
      grossTurnover: Number(summary.grossTurnover || 0),
      refundedAmount: Number(refundRows[0]?.refundedAmount || 0),
      refundCount: Number(refundRows[0]?.refundCount || 0),
      platformFee: Number(settlement.platformFee || 0),
      escortPayable: Number(settlement.escortPayable || 0),
      pendingEscortAmount: Number(settlement.pendingEscortAmount || 0),
      settledEscortAmount: Number(settlement.settledEscortAmount || 0),
      pendingSettlementCount: Number(settlement.pendingSettlementCount || 0),
      settledSettlementCount: Number(settlement.settledSettlementCount || 0)
    },
    serviceBreakdown: serviceRows.map(r => ({ ...r, serviceName: SERVICE_TYPE_MAP[r.service_type] || r.service_type })),
    communityBreakdown: communityRows,
    dailyTrend: dailyRows,
    statusBreakdown: statusRows,
    serviceTypeMap: SERVICE_TYPE_MAP
  };
}

module.exports = { getOverview };
