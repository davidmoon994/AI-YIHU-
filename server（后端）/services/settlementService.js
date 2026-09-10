"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");

/**
 * 计算并创建服务人员结算记录。
 * 仅负责平台内部记账，不执行真实提现/微信打款。
 * 唯一订单一条记录，重复调用保持幂等。
 */
async function createSettlementForOrder(orderId, conn = db) {
  const [orders] = await conn.query(
    `SELECT o.id, o.order_no, o.escort_id, o.community_id, o.service_type,
            o.payable_amount, o.paid_amount, o.payment_status, o.order_status
       FROM orders o
      WHERE o.id = ? LIMIT 1`,
    [orderId]
  );

  if (!orders.length) throw new BizError(404, "订单不存在");
  const order = orders[0];

  if (order.order_status !== "completed") {
    throw new BizError(409, "只有已完成订单才能生成结算记录");
  }
  if (!order.escort_id) {
    throw new BizError(409, "订单尚未绑定服务人员，无法结算");
  }
  if (order.payment_status !== "SUCCESS") {
    throw new BizError(409, "订单尚未支付成功，无法结算");
  }

  const [existing] = await conn.query(
    "SELECT * FROM escort_settlements WHERE order_id = ? LIMIT 1",
    [orderId]
  );
  if (existing.length) return existing[0];

  const [communities] = await conn.query(
    "SELECT commission_rate FROM communities WHERE id = ? LIMIT 1",
    [order.community_id]
  );
  const commissionRate = Math.max(0, Math.min(100, Number(communities[0]?.commission_rate || 0)));
  const grossAmount = Number(order.paid_amount || order.payable_amount || 0);
  const platformFee = Number((grossAmount * commissionRate / 100).toFixed(2));
  const escortAmount = Number((grossAmount - platformFee).toFixed(2));

  await conn.query(
    `INSERT INTO escort_settlements
      (order_id, order_no, escort_id, community_id, service_type,
       gross_amount, commission_rate, platform_fee, escort_amount,
       settlement_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
    [order.id, order.order_no, order.escort_id, order.community_id, order.service_type,
      grossAmount, commissionRate, platformFee, escortAmount]
  );

  const [rows] = await conn.query(
    "SELECT * FROM escort_settlements WHERE order_id = ? LIMIT 1",
    [orderId]
  );
  return rows[0];
}

async function getEscortIncome(escortId, { startDate, endDate } = {}) {
  const params = [escortId];
  let where = "WHERE escort_id = ?";
  if (startDate) {
    where += " AND created_at >= ?";
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    where += " AND created_at < DATE_ADD(?, INTERVAL 1 DAY)";
    params.push(endDate);
  }

  const summaryRows = await db.query(
    `SELECT COUNT(*) AS orderCount,
            COALESCE(SUM(gross_amount),0) AS grossIncome,
            COALESCE(SUM(platform_fee),0) AS platformFee,
            COALESCE(SUM(escort_amount),0) AS totalIncome
       FROM escort_settlements ${where}`,
    params
  );

  const list = await db.query(
    `SELECT id, order_id, order_no, service_type, gross_amount,
            commission_rate, platform_fee, escort_amount,
            settlement_status, created_at, settled_at
       FROM escort_settlements ${where}
      ORDER BY id DESC LIMIT 100`,
    params
  );

  return { ...(summaryRows[0] || {}), list };
}

async function getAdminSettlements({ page = 1, pageSize = 20, communityId, status, escortId } = {}) {
  const pageNum = Math.max(1, Number(page));
  const size = Math.min(100, Math.max(1, Number(pageSize)));
  const params = [];
  const conditions = [];

  if (communityId) { conditions.push("s.community_id = ?"); params.push(communityId); }
  if (status) { conditions.push("s.settlement_status = ?"); params.push(status); }
  if (escortId) { conditions.push("s.escort_id = ?"); params.push(escortId); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM escort_settlements s ${where}`, params);
  const list = await db.query(
    `SELECT s.*, e.name AS escort_name, e.phone AS escort_phone, c.name AS community_name
       FROM escort_settlements s
       LEFT JOIN escorts e ON e.id = s.escort_id
       LEFT JOIN communities c ON c.id = s.community_id
      ${where}
      ORDER BY s.id DESC LIMIT ? OFFSET ?`,
    [...params, size, (pageNum - 1) * size]
  );

  return { list, total: Number(countRows[0]?.total || 0), page: pageNum, pageSize: size };
}

async function markSettled(adminId, settlementId, remark = "后台确认结算") {
  const [rows] = await db.query("SELECT * FROM escort_settlements WHERE id = ? LIMIT 1", [settlementId]);
  if (!rows.length) throw new BizError(404, "结算记录不存在");
  if (rows[0].settlement_status === "SETTLED") return rows[0];

  await db.query(
    `UPDATE escort_settlements
        SET settlement_status = 'SETTLED', settled_at = NOW(), settled_by = ?,
            settlement_remark = ?, updated_at = NOW()
      WHERE id = ? AND settlement_status = 'PENDING'`,
    [adminId, remark, settlementId]
  );

  const [updated] = await db.query("SELECT * FROM escort_settlements WHERE id = ? LIMIT 1", [settlementId]);
  return updated[0];
}

module.exports = {
  createSettlementForOrder,
  getEscortIncome,
  getAdminSettlements,
  markSettled
};
