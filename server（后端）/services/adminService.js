"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");

async function writeOperationLog(adminId, module, action, req, result) {
  await db.query(
    `INSERT INTO operation_logs (admin_id, module, action, request_url, request_method, request_ip, request_body, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [adminId, module, action, req.originalUrl, req.method, req.ip, JSON.stringify(req.body || {}), result]
  );
}

async function getDashboard(communityId) {
  const scope = communityId ? "WHERE community_id = ?" : "";
  const params = communityId ? [communityId] : [];

  const [todayOrders] = await db.query(
    `SELECT COUNT(*) as cnt FROM orders ${scope ? scope + " AND" : "WHERE"} DATE(created_at) = CURDATE()`,
    params
  );
  const [monthOrders] = await db.query(
    `SELECT COUNT(*) as cnt FROM orders ${scope ? scope + " AND" : "WHERE"} MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`,
    params
  );
  const [todayIncome] = await db.query(
    `SELECT COALESCE(SUM(paid_amount),0) as amount FROM orders ${scope ? scope + " AND" : "WHERE"} payment_status = 'SUCCESS' AND DATE(created_at) = CURDATE()`,
    params
  );
  const [onlineEscorts] = await db.query(
    `SELECT COUNT(*) as cnt FROM escorts ${scope ? scope + " AND" : "WHERE"} status = 'online'`,
    params
  );

  return {
    todayOrders: todayOrders.cnt,
    monthOrders: monthOrders.cnt,
    todayIncome: todayIncome.amount,
    onlineEscorts: onlineEscorts.cnt
  };
}

async function listUsers({ page = 1, pageSize = 20, communityId }) {
  const offset = (Number(page) - 1) * Number(pageSize);
  const params = [];
  let where = "WHERE 1=1";
  if (communityId) {
    where += " AND community_id = ?";
    params.push(communityId);
  }
  const totalRows = await db.query(`SELECT COUNT(*) as total FROM users ${where}`, params);
  const list = await db.query(`SELECT * FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
  return { list, total: totalRows[0].total };
}

async function setUserStatus(adminId, userId, status) {
  const result = await db.query("UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?", [status, userId]);
  if (result.affectedRows === 0) {
    throw new BizError(404, "用户不存在");
  }
  return { userId, status };
}

async function listEscorts({ page = 1, pageSize = 20, communityId }) {
  const offset = (Number(page) - 1) * Number(pageSize);
  const params = [];
  let where = "WHERE 1=1";
  if (communityId) {
    where += " AND community_id = ?";
    params.push(communityId);
  }
  const totalRows = await db.query(`SELECT COUNT(*) as total FROM escorts ${where}`, params);
  const list = await db.query(`SELECT * FROM escorts ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
  return { list, total: totalRows[0].total };
}

async function createEscort(payload) {
  const escortService = require("./escortService");
  const passwordHash = await escortService.hashPassword(payload.password || "123456");
  const result = await db.query(
    `INSERT INTO escorts (name, phone, avatar, gender, id_card, community_id, status, work_status, password_hash, rating, total_orders, completed_orders, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'offline', 'idle', ?, 5.00, 0, 0, NOW(), NOW())`,
    [payload.name, payload.phone, payload.avatar || null, payload.gender || null, payload.idCard || null, payload.communityId, passwordHash]
  );
  return { id: result.insertId };
}

async function approveEscort(escortId) {
  const result = await db.query("UPDATE escorts SET status = 'offline', updated_at = NOW() WHERE id = ?", [escortId]);
  if (result.affectedRows === 0) {
    throw new BizError(404, "陪诊员不存在");
  }
  return { escortId };
}

async function disableEscort(escortId) {
  await db.query("UPDATE escorts SET status = 'offline', work_status = 'idle', updated_at = NOW() WHERE id = ?", [escortId]);
  return { escortId };
}

async function listOrders({ page = 1, pageSize = 20, communityId, status }) {
  const offset = (Number(page) - 1) * Number(pageSize);
  const params = [];
  let where = "WHERE 1=1";
  if (communityId) {
    where += " AND community_id = ?";
    params.push(communityId);
  }
  if (status) {
    where += " AND order_status = ?";
    params.push(status);
  }
  const totalRows = await db.query(`SELECT COUNT(*) as total FROM orders ${where}`, params);
  const list = await db.query(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, Number(pageSize), offset]);
  return { list, total: totalRows[0].total };
}

async function getStatistics(communityId) {
  return getDashboard(communityId);
}

async function getConfigs() {
  return db.query("SELECT * FROM system_configs ORDER BY config_key ASC");
}

async function updateConfig(adminId, configKey, configValue) {
  const result = await db.query(
    "UPDATE system_configs SET config_value = ?, updated_at = NOW() WHERE config_key = ?",
    [configValue, configKey]
  );
  if (result.affectedRows === 0) {
    await db.query(
      "INSERT INTO system_configs (config_key, config_value, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
      [configKey, configValue]
    );
  }
  return { configKey, configValue };
}

async function listCommunities() {
  return db.query("SELECT * FROM communities ORDER BY id ASC");
}

// ===== 支付配置管理 =====
async function getPaymentConfig() {
  const rows = await db.query("SELECT config_key, config_value, description FROM system_configs WHERE config_key IN ('pay_mode','sp_mchid','api_v3_key','serial_no','private_key_path','profit_share_enabled') ORDER BY config_key ASC");
  const config = {};
  for (const row of rows) {
    config[row.config_key] = { value: row.config_value, description: row.description };
  }
  return config;
}

async function updatePaymentConfig(adminId, configKey, configValue) {
  const allowedKeys = ['pay_mode', 'sp_mchid', 'api_v3_key', 'serial_no', 'private_key_path', 'profit_share_enabled'];
  if (!allowedKeys.includes(configKey)) {
    throw new BizError(400, "不允许的配置项");
  }
  // 敏感字段脱敏显示时不覆盖
  await db.query(
    "UPDATE system_configs SET config_value = ?, updated_at = NOW() WHERE config_key = ?",
    [configValue, configKey]
  );
  // 清除支付配置缓存
  const payService = require("./payService");
  payService.clearPayConfigCache();
  return { configKey, configValue };
}

// ===== 社区子商户管理 =====
async function updateCommunitySubMerchant(communityId, subMchid, commissionRate) {
  const result = await db.query(
    "UPDATE communities SET sub_mchid = ?, commission_rate = ?, updated_at = NOW() WHERE id = ?",
    [subMchid || null, commissionRate || 0, communityId]
  );
  if (result.affectedRows === 0) {
    throw new BizError(404, "社区不存在");
  }
  return { communityId, subMchid, commissionRate };
}

async function listCommunitiesWithSubMerchants() {
  return db.query("SELECT id, name, code, manager_name, manager_phone, sub_mchid, commission_rate, status FROM communities ORDER BY id ASC");
}

module.exports = {
  writeOperationLog,
  getDashboard,
  listUsers,
  setUserStatus,
  listEscorts,
  createEscort,
  approveEscort,
  disableEscort,
  listOrders,
  getStatistics,
  getConfigs,
  updateConfig,
  listCommunities,
  getPaymentConfig,
  updatePaymentConfig,
  updateCommunitySubMerchant,
  listCommunitiesWithSubMerchants
};
