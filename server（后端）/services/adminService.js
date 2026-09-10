"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");

async function writeOperationLog(adminId, module, action, req, result) {
  const body = { ...(req.body || {}) };
  for (const key of ["password", "password_hash", "api_v3_key", "private_key", "privateKey"]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) body[key] = "[REDACTED]";
  }
  await db.query(
    `INSERT INTO operation_logs (admin_id, module, action, request_url, request_method, request_ip, request_body, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [adminId || null, module, action, req.originalUrl, req.method, req.ip, JSON.stringify(body), result]
  );
}

async function writeLoginLog(adminId, username, req, result, reason) {
  const body = { username: username || null };
  if (reason) body.reason = reason;
  await db.query(
    `INSERT INTO operation_logs (admin_id, module, action, request_url, request_method, request_ip, request_body, result, created_at)
     VALUES (?, 'auth', 'login', ?, ?, ?, ?, ?, NOW())`,
    [adminId || null, req.originalUrl, req.method, req.ip, JSON.stringify(body), result]
  );
}


async function listOperationLogs({ page = 1, pageSize = 20, keyword, adminId, module, action, result, startDate, endDate, communityId }) {
  const offset = (Number(page) - 1) * Number(pageSize);
  const params = [];
  let where = "WHERE 1=1";
  if (keyword) {
    where += " AND (a.username LIKE ? OR a.real_name LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (adminId) { where += " AND l.admin_id = ?"; params.push(adminId); }
  if (module) { where += " AND l.module = ?"; params.push(module); }
  if (action) { where += " AND l.action = ?"; params.push(action); }
  if (result) { where += " AND l.result = ?"; params.push(result); }
  if (communityId) { where += " AND a.community_id = ?"; params.push(communityId); }
  if (startDate) { where += " AND l.created_at >= ?"; params.push(`${startDate} 00:00:00`); }
  if (endDate) { where += " AND l.created_at < DATE_ADD(?, INTERVAL 1 DAY)"; params.push(endDate); }
  const totalRows = await db.query(`SELECT COUNT(*) AS total FROM operation_logs l LEFT JOIN admins a ON a.id = l.admin_id ${where}`, params);
  const list = await db.query(
    `SELECT l.id, l.admin_id, a.username, a.real_name, a.role, a.community_id, c.name AS community_name,
            l.module, l.action, l.request_url, l.request_method, l.request_ip, l.request_body, l.result, l.created_at
       FROM operation_logs l
       LEFT JOIN admins a ON a.id = l.admin_id
       LEFT JOIN communities c ON c.id = a.community_id
      ${where} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );
  return { list, total: totalRows[0].total };
}

async function getAdminSecurityStats(communityId) {
  const adminScope = communityId ? "WHERE community_id = ?" : "";
  const adminParams = communityId ? [communityId] : [];
  const logScope = communityId ? "AND a.community_id = ?" : "";
  const logParams = communityId ? [communityId] : [];
  const [totals] = await db.query(`SELECT COUNT(*) AS total, SUM(status = 1) AS active, SUM(role = 'SUPER_ADMIN' AND status = 1) AS activeSuper, SUM(role = 'COMMUNITY_ADMIN' AND status = 1) AS activeCommunity FROM admins ${adminScope}`, adminParams);
  const [login24h] = await db.query(`SELECT COUNT(*) AS cnt FROM operation_logs l LEFT JOIN admins a ON a.id = l.admin_id WHERE l.module = 'auth' AND l.action = 'login' AND l.result = 'success' AND l.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ${logScope}`, logParams);
  const [fail24h] = await db.query(`SELECT COUNT(*) AS cnt FROM operation_logs l LEFT JOIN admins a ON a.id = l.admin_id WHERE l.module = 'auth' AND l.action = 'login' AND l.result = 'failure' AND l.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ${logScope}`, logParams);
  return { total: Number(totals.total || 0), active: Number(totals.active || 0), activeSuper: Number(totals.activeSuper || 0), activeCommunity: Number(totals.activeCommunity || 0), login24h: Number(login24h.cnt || 0), failedLogin24h: Number(fail24h.cnt || 0) };
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

async function listCommunities(communityId) {
  if (communityId) {
    return db.query("SELECT * FROM communities WHERE id = ? ORDER BY id ASC", [communityId]);
  }
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


// ===== 超级管理员：后台管理员账号管理 =====
async function listAdmins({ page = 1, pageSize = 20, keyword, role, status, communityId }) {
  const offset = (Number(page) - 1) * Number(pageSize);
  const params = [];
  let where = "WHERE 1=1";
  if (keyword) {
    where += " AND (a.username LIKE ? OR a.real_name LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (role) { where += " AND a.role = ?"; params.push(role); }
  if (status !== undefined && status !== null && status !== "") { where += " AND a.status = ?"; params.push(Number(status)); }
  if (communityId) { where += " AND a.community_id = ?"; params.push(communityId); }
  const totalRows = await db.query(`SELECT COUNT(*) AS total FROM admins a ${where}`, params);
  const list = await db.query(
    `SELECT a.id, a.username, a.real_name, a.role, a.community_id, c.name AS community_name,
            a.status, a.last_login_at, a.created_at, a.updated_at
       FROM admins a LEFT JOIN communities c ON c.id = a.community_id
      ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );
  return { list, total: totalRows[0].total };
}

async function createAdmin({ username, password, realName, role, communityId }) {
  const bcrypt = require("bcrypt");
  if (!username || !/^[A-Za-z0-9_@.-]{3,50}$/.test(username)) throw new BizError(400, "管理员账号需为3-50位字母、数字或常用符号");
  if (!password || password.length < 6) throw new BizError(400, "密码至少6位");
  if (!["SUPER_ADMIN", "COMMUNITY_ADMIN"].includes(role)) throw new BizError(400, "管理员角色不合法");
  if (role === "COMMUNITY_ADMIN" && !communityId) throw new BizError(400, "社区管理员必须绑定社区");
  if (role === "SUPER_ADMIN") communityId = null;
  const exists = await db.query("SELECT id FROM admins WHERE username = ? LIMIT 1", [username]);
  if (exists.length) throw new BizError(409, "管理员账号已存在");
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.query(
    `INSERT INTO admins (username, password_hash, real_name, role, community_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [username, passwordHash, realName || null, role, communityId]
  );
  return { id: result.insertId, username, realName: realName || null, role, communityId: communityId || null, status: 1 };
}

async function updateAdmin({ id, realName, role, communityId }) {
  const rows = await db.query("SELECT id, role, community_id, status FROM admins WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw new BizError(404, "管理员不存在");
  if (!["SUPER_ADMIN", "COMMUNITY_ADMIN"].includes(role)) throw new BizError(400, "管理员角色不合法");
  if (role === "COMMUNITY_ADMIN" && !communityId) throw new BizError(400, "社区管理员必须绑定社区");
  if (role === "SUPER_ADMIN") communityId = null;
  if (rows[0].role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
    const active = await db.query("SELECT COUNT(*) AS cnt FROM admins WHERE role = 'SUPER_ADMIN' AND status = 1");
    if (Number(active[0].cnt) <= 1) throw new BizError(400, "系统至少需要保留一名启用中的超级管理员");
  }
  await db.query(
    "UPDATE admins SET real_name = ?, role = ?, community_id = ?, updated_at = NOW() WHERE id = ?",
    [realName || null, role, communityId, id]
  );
  return { id, realName: realName || null, role, communityId: communityId || null };
}

async function setAdminStatus(operatorId, id, status) {
  const rows = await db.query("SELECT id, role, status FROM admins WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw new BizError(404, "管理员不存在");
  if (Number(id) === Number(operatorId) && Number(status) === 0) throw new BizError(400, "不能禁用当前登录的超级管理员账号");
  if (rows[0].role === "SUPER_ADMIN" && Number(status) === 0 && Number(rows[0].status) === 1) {
    const active = await db.query("SELECT COUNT(*) AS cnt FROM admins WHERE role = 'SUPER_ADMIN' AND status = 1");
    if (Number(active[0].cnt) <= 1) throw new BizError(400, "系统至少需要保留一名启用中的超级管理员");
  }
  await db.query("UPDATE admins SET status = ?, updated_at = NOW() WHERE id = ?", [Number(status) ? 1 : 0, id]);
  return { id, status: Number(status) ? 1 : 0 };
}

async function resetAdminPassword(id, password) {
  const bcrypt = require("bcrypt");
  if (!password || password.length < 6) throw new BizError(400, "新密码至少6位");
  const rows = await db.query("SELECT id FROM admins WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) throw new BizError(404, "管理员不存在");
  const passwordHash = await bcrypt.hash(password, 10);
  await db.query("UPDATE admins SET password_hash = ?, updated_at = NOW() WHERE id = ?", [passwordHash, id]);
  return { id };
}

module.exports = {
  writeOperationLog,
  writeLoginLog,
  listOperationLogs,
  getAdminSecurityStats,
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
  listCommunitiesWithSubMerchants,
  listAdmins,
  createAdmin,
  updateAdmin,
  setAdminStatus,
  resetAdminPassword
};
