"use strict";

const bcrypt = require("bcrypt");
const db = require("../db");
const jwtUtil = require("../utils/jwt");
const { BizError } = require("../middleware/error");
const { ORDER_STATUS, ROLE, BIZ_CODE } = require("../utils/constants");
const orderService = require("./orderService");

const SALT_ROUNDS = 10;

async function login(phone, password) {
  const rows = await db.query("SELECT * FROM escorts WHERE phone = ? LIMIT 1", [phone]);
  if (rows.length === 0) {
    throw new BizError(BIZ_CODE.ESCORT_NOT_FOUND, "陪诊员不存在");
  }
  const escort = rows[0];

  const passwordOk = await bcrypt.compare(password, escort.password_hash || "");
  if (!passwordOk) {
    throw new BizError(401, "手机号或密码错误");
  }

  const token = jwtUtil.sign({ userId: escort.id, role: ROLE.ESCORT, communityId: escort.community_id });
  return { token, escort: sanitize(escort) };
}

async function getDashboard(escortId) {
  const rows = await db.query("SELECT * FROM escorts WHERE id = ? LIMIT 1", [escortId]);
  if (rows.length === 0) {
    throw new BizError(BIZ_CODE.ESCORT_NOT_FOUND, "陪诊员不存在");
  }
  const escort = rows[0];

  const [todayCount] = await db.query(
    `SELECT COUNT(*) as cnt FROM orders WHERE escort_id = ? AND DATE(created_at) = CURDATE()`,
    [escortId]
  );

  return {
    profile: sanitize(escort),
    todayOrders: todayCount.cnt
  };
}

async function getWaitingOrders(escortId) {
  return db.query(
    `SELECT o.* FROM orders o
     INNER JOIN dispatch_records d ON d.order_id = o.id
     WHERE d.escort_id = ? AND d.response_status = 'pending' AND d.dispatch_status = 'pushing'
     ORDER BY o.created_at DESC`,
    [escortId]
  );
}

async function getCurrentOrders(escortId) {
  return db.query(
    `SELECT * FROM orders WHERE escort_id = ? AND order_status IN (?, ?, ?, ?)
     ORDER BY appointment_time ASC`,
    [escortId, ORDER_STATUS.ASSIGNED, ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED, ORDER_STATUS.SERVING]
  );
}

async function arriveOrder(escortId, orderId) {
  return db.transaction(async (conn) => {
    await orderService.transitionStatus(conn, orderId, [ORDER_STATUS.ASSIGNED], ORDER_STATUS.ARRIVED, "陪诊员到达");
    const [check] = await conn.query("SELECT escort_id FROM orders WHERE id = ?", [orderId]);
    if (check[0].escort_id !== escortId) {
      throw new BizError(403, "无权限操作该订单");
    }
  });
}

async function startService(escortId, orderId) {
  return db.transaction(async (conn) => {
    const [check] = await conn.query("SELECT escort_id FROM orders WHERE id = ?", [orderId]);
    if (!check.length || check[0].escort_id !== escortId) {
      throw new BizError(403, "无权限操作该订单");
    }
    await orderService.transitionStatus(conn, orderId, [ORDER_STATUS.ARRIVED], ORDER_STATUS.SERVING, "开始服务");
  });
}

async function finishService(escortId, orderId, images) {
  return db.transaction(async (conn) => {
    const [check] = await conn.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (!check.length || check[0].escort_id !== escortId) {
      throw new BizError(403, "无权限操作该订单");
    }
    await orderService.transitionStatus(conn, orderId, [ORDER_STATUS.SERVING], ORDER_STATUS.COMPLETED, "服务完成");
    await conn.query("UPDATE orders SET completed_at = NOW() WHERE id = ?", [orderId]);
    await conn.query(
      "UPDATE escorts SET work_status = 'idle', total_orders = total_orders + 1, completed_orders = completed_orders + 1 WHERE id = ?",
      [escortId]
    );
    if (images) {
      await conn.query(
        `INSERT INTO order_logs (order_id, from_status, to_status, remark, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [orderId, ORDER_STATUS.SERVING, ORDER_STATUS.COMPLETED, `上传服务照片: ${images}`]
      );
    }
  });
}

async function updateLocation(escortId, latitude, longitude) {
  await db.query("UPDATE escorts SET latitude = ?, longitude = ?, updated_at = NOW() WHERE id = ?", [latitude, longitude, escortId]);
  return { escortId, latitude, longitude };
}

async function updateOnlineStatus(escortId, status) {
  const allowed = ["online", "offline", "busy"];
  if (!allowed.includes(status)) {
    throw new BizError(400, "状态非法");
  }
  await db.query("UPDATE escorts SET status = ?, updated_at = NOW() WHERE id = ?", [status, escortId]);
  return { escortId, status };
}

async function getIncome(escortId, { startDate, endDate }) {
  const params = [escortId];
  let where = "WHERE escort_id = ? AND order_status = 'completed'";
  if (startDate) {
    where += " AND completed_at >= ?";
    params.push(startDate);
  }
  if (endDate) {
    where += " AND completed_at <= ?";
    params.push(endDate);
  }
  const rows = await db.query(`SELECT COUNT(*) as orderCount, COALESCE(SUM(paid_amount),0) as totalIncome FROM orders ${where}`, params);
  return rows[0];
}

function sanitize(escort) {
  const safe = { ...escort };
  delete safe.password_hash;
  if (safe.phone) {
    safe.phone = safe.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
  }
  if (safe.id_card) {
    safe.id_card = safe.id_card.replace(/^(.{4}).*(.{4})$/, "$1**********$2");
  }
  return safe;
}

module.exports = {
  login,
  getDashboard,
  getWaitingOrders,
  getCurrentOrders,
  arriveOrder,
  startService,
  finishService,
  updateLocation,
  updateOnlineStatus,
  getIncome,
  hashPassword: (plain) => bcrypt.hash(plain, SALT_ROUNDS)
};
