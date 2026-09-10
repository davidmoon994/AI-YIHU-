"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");

function normalizeScore(score) {
  const value = Number(score);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new BizError(400, "评分必须为1-5星");
  }
  return value;
}

async function getRating(userId, orderId) {
  const orders = await db.query(
    `SELECT id, service_type, order_status, escort_id FROM orders WHERE id = ? AND user_id = ? AND is_deleted = 0 LIMIT 1`,
    [orderId, userId]
  );
  if (!orders.length) throw new BizError(404, "订单不存在");
  const order = orders[0];
  const ratings = await db.query(
    `SELECT id, score, content, images, anonymous, created_at, updated_at
       FROM ratings WHERE order_id = ? AND user_id = ? LIMIT 1`,
    [orderId, userId]
  );
  return { orderId: order.id, serviceType: order.service_type, orderStatus: order.order_status, hasRated: ratings.length > 0, rating: ratings[0] || null };
}

async function createRating(userId, orderId, payload = {}) {
  const score = normalizeScore(payload.score);
  const content = String(payload.content || "").trim().slice(0, 500);
  const anonymous = payload.anonymous ? 1 : 0;
  const images = Array.isArray(payload.images) ? JSON.stringify(payload.images.slice(0, 9).map(v => String(v).slice(0, 500))) : null;

  return db.transaction(async (conn) => {
    const [orders] = await conn.query(
      `SELECT id, service_type, order_status, escort_id FROM orders WHERE id = ? AND user_id = ? AND is_deleted = 0 LIMIT 1 FOR UPDATE`,
      [orderId, userId]
    );
    if (!orders.length) throw new BizError(404, "订单不存在");
    const order = orders[0];
    if (order.order_status !== "completed") throw new BizError(400, "只有已完成订单可以评价");
    if (!order.escort_id) throw new BizError(400, "该订单暂无服务人员，暂时不能评价");

    const [existing] = await conn.query("SELECT id FROM ratings WHERE order_id = ? LIMIT 1", [orderId]);
    if (existing.length) throw new BizError(409, "该订单已经评价过了");

    const [result] = await conn.query(
      `INSERT INTO ratings (order_id, user_id, escort_id, score, content, images, anonymous, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [orderId, userId, order.escort_id, score, content || null, images, anonymous]
    );

    const [avgRows] = await conn.query(
      `SELECT ROUND(AVG(score), 2) AS rating, COUNT(*) AS rating_count FROM ratings WHERE escort_id = ?`,
      [order.escort_id]
    );
    await conn.query(
      `UPDATE escorts SET rating = ?, updated_at = NOW() WHERE id = ?`,
      [Number(avgRows[0].rating || 5), order.escort_id]
    );

    return { id: result.insertId, orderId, score, content, anonymous: !!anonymous, escortRating: Number(avgRows[0].rating || 5), ratingCount: Number(avgRows[0].rating_count || 0) };
  });
}

module.exports = { getRating, createRating };
