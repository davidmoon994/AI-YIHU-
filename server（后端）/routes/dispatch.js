"use strict";

const express = require("express");
const router = express.Router();

const dispatchService = require("../services/dispatchService");
const { success } = require("../utils/response");
const { authenticate, requireRole } = require("../middleware/auth");
const { requireBody, requireQuery } = require("../middleware/validator");
const { ROLE } = require("../utils/constants");

router.use(authenticate);

// POST /api/v1/dispatch/auto  —— 系统/后台触发自动派单
router.post(
  "/auto",
  requireRole(ROLE.SUPER_ADMIN, ROLE.COMMUNITY_ADMIN),
  requireBody(["orderId"]),
  async (req, res, next) => {
    try {
      await dispatchService.startAutoDispatch(req.body.orderId);
      return success(res, { orderId: req.body.orderId });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/v1/dispatch/manual —— 后台人工派单
router.post(
  "/manual",
  requireRole(ROLE.SUPER_ADMIN, ROLE.COMMUNITY_ADMIN),
  requireBody(["orderId", "escortId"]),
  async (req, res, next) => {
    try {
      const result = await dispatchService.manualDispatch(req.user.userId, req.body.orderId, req.body.escortId, { role: req.user.role, communityId: req.user.communityId });
      return success(res, result);
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/v1/dispatch/eligible-escorts —— 查询订单可人工派单的服务人员
router.get("/eligible-escorts", requireRole(ROLE.SUPER_ADMIN, ROLE.COMMUNITY_ADMIN), requireQuery(["orderId"]), async (req, res, next) => {
  try {
    const list = await dispatchService.getEligibleEscorts(req.query.orderId, req.user.role, req.user.communityId);
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/dispatch/list
router.get("/list", requireQuery(["orderId"]), async (req, res, next) => {
  try {
    const list = await dispatchService.getDispatchList(req.query.orderId);
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/dispatch/nearby
router.get("/nearby", requireQuery(["latitude", "longitude"]), async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query;
    const list = await dispatchService.getNearbyEscorts(req.user.communityId, latitude, longitude);
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
