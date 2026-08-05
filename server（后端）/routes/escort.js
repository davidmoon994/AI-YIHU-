"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const escortService = require("../services/escortService");
const dispatchService = require("../services/dispatchService");
const { success } = require("../utils/response");
const { authenticate, requireRole } = require("../middleware/auth");
const { requireBody, requireQuery } = require("../middleware/validator");
const { ROLE } = require("../utils/constants");

const upload = multer({
  storage: multer.diskStorage({
    destination: process.env.UPLOAD_DIR || "./uploads",
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: Number(process.env.UPLOAD_MAX_SIZE_MB || 10) * 1024 * 1024 }
});

// POST /api/v1/escort/login —— 独立登录，不需要JWT
router.post("/login", requireBody(["phone", "password"]), async (req, res, next) => {
  try {
    const result = await escortService.login(req.body.phone, req.body.password);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.use(authenticate, requireRole(ROLE.ESCORT));

router.get("/dashboard", async (req, res, next) => {
  try {
    const result = await escortService.getDashboard(req.user.userId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.get("/orders/waiting", async (req, res, next) => {
  try {
    const list = await escortService.getWaitingOrders(req.user.userId);
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.get("/orders/current", async (req, res, next) => {
  try {
    const list = await escortService.getCurrentOrders(req.user.userId);
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.post("/accept", requireBody(["dispatchRecordId"]), async (req, res, next) => {
  try {
    const result = await dispatchService.acceptDispatch(req.user.userId, req.body.dispatchRecordId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/reject", requireBody(["dispatchRecordId"]), async (req, res, next) => {
  try {
    const result = await dispatchService.rejectDispatch(req.user.userId, req.body.dispatchRecordId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/arrive", requireBody(["orderId"]), async (req, res, next) => {
  try {
    await escortService.arriveOrder(req.user.userId, req.body.orderId);
    return success(res, { orderId: req.body.orderId });
  } catch (err) {
    return next(err);
  }
});

router.post("/start", requireBody(["orderId"]), async (req, res, next) => {
  try {
    await escortService.startService(req.user.userId, req.body.orderId);
    return success(res, { orderId: req.body.orderId });
  } catch (err) {
    return next(err);
  }
});

router.post("/finish", requireBody(["orderId"]), async (req, res, next) => {
  try {
    await escortService.finishService(req.user.userId, req.body.orderId, req.body.images);
    return success(res, { orderId: req.body.orderId });
  } catch (err) {
    return next(err);
  }
});

router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new (require("../middleware/error").BizError)(400, "未上传文件"));
    }
    return success(res, { path: `/uploads/${req.file.filename}` });
  } catch (err) {
    return next(err);
  }
});

router.post("/location", requireBody(["latitude", "longitude"]), async (req, res, next) => {
  try {
    const result = await escortService.updateLocation(req.user.userId, req.body.latitude, req.body.longitude);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/status", requireBody(["status"]), async (req, res, next) => {
  try {
    const result = await escortService.updateOnlineStatus(req.user.userId, req.body.status);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.get("/income", async (req, res, next) => {
  try {
    const result = await escortService.getIncome(req.user.userId, req.query);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// ===== 学习中心 =====
const db = require("../db");

router.get("/learning/list", async (req, res, next) => {
  try {
    const list = await db.query("SELECT * FROM learning_courses WHERE status = 1 ORDER BY sort ASC, id DESC");
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.get("/learning/detail", requireQuery(["courseId"]), async (req, res, next) => {
  try {
    const rows = await db.query("SELECT * FROM learning_courses WHERE id = ? LIMIT 1", [req.query.courseId]);
    if (rows.length === 0) {
      return next(new (require("../middleware/error").BizError)(404, "课程不存在"));
    }
    return success(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.post("/learning/finish", requireBody(["courseId"]), async (req, res, next) => {
  try {
    const existing = await db.query(
      "SELECT * FROM learning_records WHERE escort_id = ? AND course_id = ? LIMIT 1",
      [req.user.userId, req.body.courseId]
    );
    if (existing.length > 0) {
      await db.query(
        "UPDATE learning_records SET progress = 100, finished_at = NOW(), updated_at = NOW() WHERE id = ?",
        [existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO learning_records (escort_id, course_id, progress, finished_at, created_at, updated_at)
         VALUES (?, ?, 100, NOW(), NOW(), NOW())`,
        [req.user.userId, req.body.courseId]
      );
    }
    return success(res, { courseId: req.body.courseId });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
