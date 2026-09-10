"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");

const STATUS_LABEL = {
  pending: "待支付", paid: "已支付", dispatching: "派单中", assigned: "已指派",
  accepted: "已接单", arrived: "已到达", serving: "服务中", completed: "已完成",
  cancelled: "已取消", refund: "退款中", closed: "已关闭"
};

const SERVICE_LABEL = {
  medical_escort: "就医陪诊", escort: "就医陪诊", elderly_care: "老人陪护",
  child_care: "儿童托管", pet_care: "宠物托管", register: "代办服务",
  pickup: "接送服务", planning: "服务规划"
};

async function getTimeline(orderId, userId = null, isAdmin = false, communityId = null) {
  const conditions = ["o.id = ?"];
  const params = [orderId];
  if (!isAdmin) {
    conditions.push("o.user_id = ?");
    params.push(userId);
  } else if (communityId) {
    conditions.push("o.community_id = ?");
    params.push(communityId);
  }

  const rows = await db.query(
    `SELECT o.id, o.order_no, o.service_type, o.order_status, o.payment_status,
            o.appointment_time, o.created_at, o.completed_at, o.cancelled_at,
            e.name AS escort_name
       FROM orders o
       LEFT JOIN escorts e ON e.id = o.escort_id
      WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params
  );
  if (!rows.length) throw new BizError(404, "订单不存在");
  const order = rows[0];
  const logs = await db.query(
    `SELECT id, from_status, to_status, remark, created_at
       FROM order_logs WHERE order_id = ? ORDER BY id ASC`, [orderId]
  );

  return {
    order: {
      id: order.id,
      orderNo: order.order_no,
      serviceType: order.service_type,
      serviceName: SERVICE_LABEL[order.service_type] || order.service_type,
      status: order.order_status,
      statusLabel: STATUS_LABEL[order.order_status] || order.order_status,
      paymentStatus: order.payment_status,
      appointmentTime: order.appointment_time,
      escortName: order.escort_name || "待分配",
      createdAt: order.created_at,
      completedAt: order.completed_at,
      cancelledAt: order.cancelled_at
    },
    timeline: logs.map((item, index) => ({
      id: item.id,
      fromStatus: item.from_status,
      fromStatusLabel: item.from_status ? (STATUS_LABEL[item.from_status] || item.from_status) : "",
      toStatus: item.to_status,
      toStatusLabel: STATUS_LABEL[item.to_status] || item.to_status || "",
      remark: item.remark || "",
      createdAt: item.created_at,
      first: index === 0,
      latest: index === logs.length - 1
    }))
  };
}

async function getOperationsOverview(user, { startDate, endDate } = {}) {
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || "")) ? endDate : new Date().toISOString().slice(0, 10);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "")) ? startDate : new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const params = [start, end];
  let scope = "";
  if (user.role === "COMMUNITY_ADMIN") {
    scope = " AND o.community_id = ?";
    params.push(Number(user.communityId));
  }

  const rows = await db.query(`
    SELECT
      COUNT(*) AS totalOrders,
      SUM(o.order_status='completed') AS completedOrders,
      SUM(o.order_status='cancelled') AS cancelledOrders,
      SUM(o.payment_status='SUCCESS') AS paidOrders,
      AVG(CASE WHEN o.order_status='completed' AND o.completed_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,o.created_at,o.completed_at) END) AS avgLifecycleMinutes,
      AVG(CASE WHEN o.order_status IN ('arrived','serving','completed') THEN TIMESTAMPDIFF(MINUTE,o.appointment_time,
          COALESCE(o.completed_at,o.updated_at)) END) AS avgServiceWindowMinutes
    FROM orders o
    WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)${scope}`, params);

  const statusRows = await db.query(`
    SELECT o.order_status AS status, COUNT(*) AS count
    FROM orders o
    WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)${scope}
    GROUP BY o.order_status ORDER BY count DESC`, params);

  const serviceRows = await db.query(`
    SELECT o.service_type,
           COUNT(*) AS orderCount,
           SUM(o.order_status='completed') AS completedOrders,
           ROUND(AVG(CASE WHEN o.order_status='completed' AND o.completed_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,o.created_at,o.completed_at) END),1) AS avgLifecycleMinutes
    FROM orders o
    WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)${scope}
    GROUP BY o.service_type ORDER BY orderCount DESC`, params);

  const abnormalRows = await db.query(`
    SELECT o.id, o.order_no, o.service_type, o.order_status, o.appointment_time, o.created_at,
           TIMESTAMPDIFF(MINUTE,o.created_at,NOW()) AS waitingMinutes
    FROM orders o
    WHERE o.order_status IN ('paid','dispatching','assigned','arrived','serving')
      AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)${scope}
      AND ((o.order_status IN ('paid','dispatching') AND TIMESTAMPDIFF(MINUTE,o.created_at,NOW()) >= 30)
        OR (o.order_status='assigned' AND o.appointment_time IS NOT NULL AND o.appointment_time < NOW() - INTERVAL 15 MINUTE)
        OR (o.order_status='arrived' AND TIMESTAMPDIFF(MINUTE,o.updated_at,NOW()) >= 60))
    ORDER BY waitingMinutes DESC LIMIT 50`, params);

  const summary = rows[0] || {};
  const total = Number(summary.totalOrders || 0);
  const completed = Number(summary.completedOrders || 0);
  return {
    range: { startDate: start, endDate: end },
    summary: {
      totalOrders: total,
      completedOrders: completed,
      cancelledOrders: Number(summary.cancelledOrders || 0),
      paidOrders: Number(summary.paidOrders || 0),
      completionRate: total ? Number((completed * 100 / total).toFixed(1)) : 0,
      avgLifecycleMinutes: Number(summary.avgLifecycleMinutes || 0).toFixed(1),
      avgServiceWindowMinutes: Number(summary.avgServiceWindowMinutes || 0).toFixed(1),
      abnormalOrderCount: abnormalRows.length
    },
    statusBreakdown: statusRows.map(r => ({ ...r, label: STATUS_LABEL[r.status] || r.status })),
    serviceBreakdown: serviceRows.map(r => ({ ...r, label: SERVICE_LABEL[r.service_type] || r.service_type })),
    abnormalOrders: abnormalRows.map(r => ({ ...r, label: SERVICE_LABEL[r.service_type] || r.service_type }))
  };
}

module.exports = { getTimeline, getOperationsOverview };
