"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");

async function list(userType, userId, { page = 1, pageSize = 20 }) {
  const offset = (Number(page) - 1) * Number(pageSize);
  const totalRows = await db.query(
    "SELECT COUNT(*) as total FROM messages WHERE user_type = ? AND user_id = ?",
    [userType, userId]
  );
  const rows = await db.query(
    "SELECT * FROM messages WHERE user_type = ? AND user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
    [userType, userId, Number(pageSize), offset]
  );
  return { list: rows, total: totalRows[0].total };
}

async function detail(userType, userId, messageId) {
  const rows = await db.query(
    "SELECT * FROM messages WHERE id = ? AND user_type = ? AND user_id = ? LIMIT 1",
    [messageId, userType, userId]
  );
  if (rows.length === 0) {
    throw new BizError(404, "消息不存在");
  }
  if (!rows[0].is_read) {
    await db.query("UPDATE messages SET is_read = 1 WHERE id = ?", [messageId]);
  }
  return rows[0];
}

async function readAll(userType, userId) {
  await db.query("UPDATE messages SET is_read = 1 WHERE user_type = ? AND user_id = ? AND is_read = 0", [userType, userId]);
  return { success: true };
}

async function remove(userType, userId, messageId) {
  const result = await db.query("DELETE FROM messages WHERE id = ? AND user_type = ? AND user_id = ?", [messageId, userType, userId]);
  if (result.affectedRows === 0) {
    throw new BizError(404, "消息不存在");
  }
  return { messageId };
}

/**
 * 内部创建消息（供订单/派单/支付等模块调用），不对外暴露路由
 */
async function createMessage(userType, userId, title, content, messageType) {
  const result = await db.query(
    `INSERT INTO messages (user_type, user_id, title, content, message_type, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, NOW())`,
    [userType, userId, title, content, messageType]
  );
  return { id: result.insertId };
}

/**
 * 后台发布公告：广播给指定用户类型的全部用户
 */
async function publishBroadcast(adminId, userType, title, content) {
  const targetTable = userType === "escort" ? "escorts" : "users";
  const targets = await db.query(`SELECT id FROM ${targetTable}`);
  for (const t of targets) {
    await createMessage(userType, t.id, title, content, "system_notice");
  }
  await db.query(
    `INSERT INTO operation_logs (admin_id, module, action, request_url, request_method, result, created_at)
     VALUES (?, 'message', 'publish_broadcast', '/api/v1/admin/messages/publish', 'POST', 'success', NOW())`,
    [adminId]
  );
  return { targetCount: targets.length };
}

module.exports = {
  list,
  detail,
  readAll,
  remove,
  createMessage,
  publishBroadcast
};
