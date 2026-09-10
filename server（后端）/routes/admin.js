"use strict";

const express = require("express");
const router = express.Router();

const adminService = require("../services/adminService");
const messageService = require("../services/messageService");
const iconService = require("../services/iconService");
const db = require("../db");
const { success, successPage } = require("../utils/response");
const { authenticate, requireRole, enforceCommunityScope } = require("../middleware/auth");
const { requireBody, requireQuery } = require("../middleware/validator");
const { ROLE } = require("../utils/constants");
const { BizError } = require("../middleware/error");

const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// 图标上传配置
const iconUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "..", "uploads", "icons"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.params.iconKey}_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(png|jpg|jpeg|svg|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 png/jpg/svg/gif/webp 格式"));
    }
  }
});

// POST /api/v1/admin/login —— 后台管理员登录，不需要JWT
router.post("/login", requireBody(["username", "password"]), async (req, res, next) => {
  try {
    const bcrypt = require("bcrypt");
    const jwtUtil = require("../utils/jwt");
    const rows = await db.query("SELECT * FROM admins WHERE username = ? LIMIT 1", [req.body.username]);
    if (rows.length === 0) {
      await adminService.writeLoginLog(null, req.body.username, req, "failure", "账号不存在");
      throw new BizError(401, "用户名或密码错误");
    }
    const admin = rows[0];
    if (admin.status === 0) {
      await adminService.writeLoginLog(admin.id, admin.username, req, "failure", "账号已禁用");
      throw new BizError(403, "账号已被禁用");
    }
    const ok = await bcrypt.compare(req.body.password, admin.password_hash);
    if (!ok) {
      await adminService.writeLoginLog(admin.id, admin.username, req, "failure", "密码错误");
      throw new BizError(401, "用户名或密码错误");
    }
    await db.query("UPDATE admins SET last_login_at = NOW() WHERE id = ?", [admin.id]);
    await adminService.writeLoginLog(admin.id, admin.username, req, "success");
    const token = jwtUtil.sign({ userId: admin.id, role: admin.role, communityId: admin.community_id });
    return success(res, {
      token,
      admin: { id: admin.id, username: admin.username, realName: admin.real_name, role: admin.role, communityId: admin.community_id }
    });
  } catch (err) {
    return next(err);
  }
});

router.use(authenticate, requireRole(ROLE.SUPER_ADMIN, ROLE.COMMUNITY_ADMIN));

// 阶段23：管理员权限模型固定为两级
// SUPER_ADMIN：拥有全部后台管理权限
// COMMUNITY_ADMIN：仅可读取自己所属社区范围的数据，禁止任何写操作
router.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.user.role !== ROLE.SUPER_ADMIN) {
    return next(new BizError(403, "社区管理员为只读账号，无权修改后台数据"));
  }
  next();
});

// ===== Dashboard =====
router.get("/dashboard", enforceCommunityScope, async (req, res, next) => {
  try {
    const data = await adminService.getDashboard(req.query.communityId);
    return success(res, data);
  } catch (err) {
    return next(err);
  }
});

// ===== 用户管理 =====
router.get("/users", enforceCommunityScope, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, communityId } = req.query;
    const { list, total } = await adminService.listUsers({ page, pageSize, communityId });
    return successPage(res, list, page, pageSize, total);
  } catch (err) {
    return next(err);
  }
});

router.get("/users/detail", enforceCommunityScope, requireQuery(["userId"]), async (req, res, next) => {
  try {
    const rows = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [req.query.userId]);
    if (rows.length === 0) throw new BizError(404, "用户不存在");
    return success(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.post("/users/disable", requireBody(["userId"]), async (req, res, next) => {
  try {
    const result = await adminService.setUserStatus(req.user.userId, req.body.userId, 0);
    await adminService.writeOperationLog(req.user.userId, "user", "disable", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/users/enable", requireBody(["userId"]), async (req, res, next) => {
  try {
    const result = await adminService.setUserStatus(req.user.userId, req.body.userId, 1);
    await adminService.writeOperationLog(req.user.userId, "user", "enable", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 陪诊员管理 =====
router.get("/escorts", enforceCommunityScope, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, communityId } = req.query;
    const { list, total } = await adminService.listEscorts({ page, pageSize, communityId });
    return successPage(res, list, page, pageSize, total);
  } catch (err) {
    return next(err);
  }
});

router.get("/escorts/detail", enforceCommunityScope, requireQuery(["escortId"]), async (req, res, next) => {
  try {
    const rows = await db.query("SELECT * FROM escorts WHERE id = ? LIMIT 1", [req.query.escortId]);
    if (rows.length === 0) throw new BizError(404, "陪诊员不存在");
    return success(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.post("/escorts/create", requireBody(["name", "phone", "communityId"]), async (req, res, next) => {
  try {
    const result = await adminService.createEscort(req.body);
    await adminService.writeOperationLog(req.user.userId, "escort", "create", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/escorts/approve", requireBody(["escortId"]), async (req, res, next) => {
  try {
    const result = await adminService.approveEscort(req.body.escortId);
    await adminService.writeOperationLog(req.user.userId, "escort", "approve", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/escorts/disable", requireBody(["escortId"]), async (req, res, next) => {
  try {
    const result = await adminService.disableEscort(req.body.escortId);
    await adminService.writeOperationLog(req.user.userId, "escort", "disable", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 订单管理 =====
router.get("/orders", enforceCommunityScope, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, communityId, status } = req.query;
    const { list, total } = await adminService.listOrders({ page, pageSize, communityId, status });
    return successPage(res, list, page, pageSize, total);
  } catch (err) {
    return next(err);
  }
});

router.get("/orders/detail", enforceCommunityScope, requireQuery(["orderId"]), async (req, res, next) => {
  try {
    const orderService = require("../services/orderService");
    const order = await orderService.getOrderDetail(null, req.query.orderId, true);
    return success(res, order);
  } catch (err) {
    return next(err);
  }
});

router.post("/orders/manual-dispatch", requireBody(["orderId", "escortId"]), async (req, res, next) => {
  try {
    const dispatchService = require("../services/dispatchService");
    const result = await dispatchService.manualDispatch(req.user.userId, req.body.orderId, req.body.escortId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/orders/cancel", requireBody(["orderId"]), async (req, res, next) => {
  try {
    const result = await db.query(
      "UPDATE orders SET order_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = ?",
      [req.body.orderId]
    );
    if (result.affectedRows === 0) throw new BizError(404, "订单不存在");
    await adminService.writeOperationLog(req.user.userId, "order", "cancel", req, "success");
    return success(res, { orderId: req.body.orderId });
  } catch (err) {
    return next(err);
  }
});

router.post("/orders/refund", requireBody(["orderId"]), async (req, res, next) => {
  try {
    const payService = require("../services/payService");
    const rows = await db.query("SELECT user_id FROM orders WHERE id = ? LIMIT 1", [req.body.orderId]);
    if (rows.length === 0) throw new BizError(404, "订单不存在");
    const result = await payService.applyRefund(rows[0].user_id, req.body.orderId, req.body.reason || "后台发起退款");
    await adminService.writeOperationLog(req.user.userId, "order", "refund", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 后台管理员管理（仅超级管理员） =====
router.get("/admins", requireRole(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, keyword, role, status, communityId } = req.query;
    const result = await adminService.listAdmins({ page, pageSize, keyword, role, status, communityId });
    return successPage(res, result.list, page, pageSize, result.total);
  } catch (err) { return next(err); }
});

router.post("/admins/create", requireRole(ROLE.SUPER_ADMIN), requireBody(["username", "password", "role"]), async (req, res, next) => {
  try {
    const result = await adminService.createAdmin(req.body);
    await adminService.writeOperationLog(req.user.userId, "admin", "create", req, "success");
    return success(res, result);
  } catch (err) { return next(err); }
});

router.put("/admins/update", requireRole(ROLE.SUPER_ADMIN), requireBody(["id", "role"]), async (req, res, next) => {
  try {
    if (Number(req.body.id) === Number(req.user.userId) && req.body.role !== ROLE.SUPER_ADMIN) {
      throw new BizError(400, "不能降级当前登录的超级管理员账号");
    }
    const result = await adminService.updateAdmin(req.body);
    await adminService.writeOperationLog(req.user.userId, "admin", "update", req, "success");
    return success(res, result);
  } catch (err) { return next(err); }
});

router.post("/admins/status", requireRole(ROLE.SUPER_ADMIN), requireBody(["id", "status"]), async (req, res, next) => {
  try {
    const result = await adminService.setAdminStatus(req.user.userId, req.body.id, req.body.status);
    await adminService.writeOperationLog(req.user.userId, "admin", Number(req.body.status) ? "enable" : "disable", req, "success");
    return success(res, result);
  } catch (err) { return next(err); }
});

router.post("/admins/reset-password", requireRole(ROLE.SUPER_ADMIN), requireBody(["id", "password"]), async (req, res, next) => {
  try {
    const result = await adminService.resetAdminPassword(req.body.id, req.body.password);
    await adminService.writeOperationLog(req.user.userId, "admin", "reset_password", req, "success");
    return success(res, result);
  } catch (err) { return next(err); }
});

// ===== 超级管理员：安全审计与操作日志 =====
router.get("/security/stats", requireRole(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const data = await adminService.getAdminSecurityStats(req.query.communityId);
    return success(res, data);
  } catch (err) { return next(err); }
});

router.get("/operation-logs", requireRole(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, keyword, adminId, module, action, result, startDate, endDate, communityId } = req.query;
    const data = await adminService.listOperationLogs({ page, pageSize, keyword, adminId, module, action, result, startDate, endDate, communityId });
    return successPage(res, data.list, page, pageSize, data.total);
  } catch (err) { return next(err); }
});

// ===== 社区管理 =====
router.get("/communities", async (req, res, next) => {
  try {
    const communityId = req.user.role === ROLE.COMMUNITY_ADMIN ? req.user.communityId : req.query.communityId;
    const list = await adminService.listCommunities(communityId);
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.post("/communities/create", requireRole(ROLE.SUPER_ADMIN), requireBody(["name", "code"]), async (req, res, next) => {
  try {
    const { name, code, managerName, managerPhone, province, city, district, address } = req.body;
    const result = await db.query(
      `INSERT INTO communities (name, code, manager_name, manager_phone, province, city, district, address, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [name, code, managerName || null, managerPhone || null, province || null, city || null, district || null, address || null]
    );
    return success(res, { id: result.insertId });
  } catch (err) {
    return next(err);
  }
});

router.put("/communities/update", requireRole(ROLE.SUPER_ADMIN), requireBody(["id"]), async (req, res, next) => {
  try {
    const { id, ...payload } = req.body;
    const fieldMap = { managerName: "manager_name", managerPhone: "manager_phone" };
    const allowed = ["name", "code", "manager_name", "manager_phone", "province", "city", "district", "address", "status"];
    const updates = [];
    const params = [];
    for (const [key, value] of Object.entries(payload)) {
      const field = fieldMap[key] || key;
      if (allowed.includes(field)) {
        updates.push(`${field} = ?`);
        params.push(value);
      }
    }
    if (updates.length === 0) throw new BizError(400, "没有可更新的字段");
    params.push(id);
    await db.query(`UPDATE communities SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
    return success(res, { id });
  } catch (err) {
    return next(err);
  }
});

// ===== 学习中心管理 =====
router.get("/learning/list", async (req, res, next) => {
  try {
    const list = await db.query("SELECT * FROM learning_courses ORDER BY sort ASC, id DESC");
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.post("/learning/create", requireBody(["title", "content"]), async (req, res, next) => {
  try {
    const { title, cover, category, content, duration, sort } = req.body;
    const result = await db.query(
      `INSERT INTO learning_courses (title, cover, category, content, duration, sort, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [title, cover || null, category || null, content, duration || null, sort || 0]
    );
    return success(res, { id: result.insertId });
  } catch (err) {
    return next(err);
  }
});

router.put("/learning/update", requireBody(["id"]), async (req, res, next) => {
  try {
    const { id, ...payload } = req.body;
    const allowed = ["title", "cover", "category", "content", "duration", "sort", "status"];
    const updates = [];
    const params = [];
    for (const [key, value] of Object.entries(payload)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
    if (updates.length === 0) throw new BizError(400, "没有可更新的字段");
    params.push(id);
    await db.query(`UPDATE learning_courses SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
    return success(res, { id });
  } catch (err) {
    return next(err);
  }
});

router.delete("/learning/delete", requireQuery(["id"]), async (req, res, next) => {
  try {
    const result = await db.query("DELETE FROM learning_courses WHERE id = ?", [req.query.id]);
    if (result.affectedRows === 0) throw new BizError(404, "课程不存在");
    return success(res, { id: req.query.id });
  } catch (err) {
    return next(err);
  }
});

// ===== 消息管理 =====
router.get("/messages", enforceCommunityScope, async (req, res, next) => {
  try {
    const list = await db.query("SELECT * FROM messages ORDER BY id DESC LIMIT 100");
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.post("/messages/publish", requireBody(["userType", "title", "content"]), async (req, res, next) => {
  try {
    const result = await messageService.publishBroadcast(req.user.userId, req.body.userType, req.body.title, req.body.content);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 系统配置 =====
router.get("/configs", requireRole(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const list = await adminService.getConfigs();
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.put("/configs/update", requireRole(ROLE.SUPER_ADMIN), requireBody(["configKey", "configValue"]), async (req, res, next) => {
  try {
    const result = await adminService.updateConfig(req.user.userId, req.body.configKey, req.body.configValue);
    await adminService.writeOperationLog(req.user.userId, "config", "update", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 数据统计 =====
router.get("/statistics", enforceCommunityScope, async (req, res, next) => {
  try {
    const data = await adminService.getStatistics(req.query.communityId);
    return success(res, data);
  } catch (err) {
    return next(err);
  }
});

router.get("/statistics/order", enforceCommunityScope, async (req, res, next) => {
  try {
    const { list, total } = await adminService.listOrders({ page: 1, pageSize: 1000, communityId: req.query.communityId });
    return success(res, { total, list });
  } catch (err) {
    return next(err);
  }
});

router.get("/statistics/payment", enforceCommunityScope, async (req, res, next) => {
  try {
    const rows = await db.query(
      "SELECT COALESCE(SUM(paid_amount),0) as totalIncome, COUNT(*) as totalOrders FROM orders WHERE payment_status = 'SUCCESS'"
    );
    return success(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.get("/statistics/escort", enforceCommunityScope, async (req, res, next) => {
  try {
    const rows = await db.query(
      "SELECT AVG(rating) as avgRating, SUM(total_orders) as totalOrders FROM escorts"
    );
    return success(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

// ===== 支付配置管理 =====
router.get("/payment/config", requireRole(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const config = await adminService.getPaymentConfig();
    return success(res, config);
  } catch (err) {
    return next(err);
  }
});

router.put("/payment/config", requireRole(ROLE.SUPER_ADMIN), requireBody(["configKey", "configValue"]), async (req, res, next) => {
  try {
    const result = await adminService.updatePaymentConfig(req.user.userId, req.body.configKey, req.body.configValue);
    await adminService.writeOperationLog(req.user.userId, "payment", "config_update", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 社区子商户管理 =====
router.get("/payment/communities", requireRole(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const list = await adminService.listCommunitiesWithSubMerchants();
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.put("/payment/community", requireRole(ROLE.SUPER_ADMIN), requireBody(["communityId"]), async (req, res, next) => {
  try {
    const result = await adminService.updateCommunitySubMerchant(
      req.body.communityId,
      req.body.subMchid || null,
      req.body.commissionRate || 0
    );
    await adminService.writeOperationLog(req.user.userId, "payment", "sub_merchant_update", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 手动触发分账 =====
router.post("/payment/profit-share", requireRole(ROLE.SUPER_ADMIN), requireBody(["orderId"]), async (req, res, next) => {
  try {
    const payService = require("../services/payService");
    const result = await payService.executeProfitShare(req.body.orderId);
    await adminService.writeOperationLog(req.user.userId, "payment", "profit_share", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 图标管理 =====
router.get("/icons", async (req, res, next) => {
  try {
    const list = await iconService.listIcons({
      category: req.query.category,
      client: req.query.client
    });
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.post("/icons/:iconKey/upload", iconUpload.single("icon"), async (req, res, next) => {
  try {
    if (!req.file) throw new BizError(400, "请上传图标文件");
    const filePath = `/uploads/icons/${req.file.filename}`;
    const result = await iconService.uploadIcon(req.params.iconKey, filePath);
    await adminService.writeOperationLog(req.user.userId, "icon", "upload", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/icons/:iconKey/reset", async (req, res, next) => {
  try {
    const result = await iconService.resetIcon(req.params.iconKey);
    await adminService.writeOperationLog(req.user.userId, "icon", "reset", req, "success");
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
