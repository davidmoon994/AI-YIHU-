"use strict";

const express = require("express");
const router = express.Router();

const orderService = require("../services/orderService");
const { success, successPage } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { requireBody, requireQuery } = require("../middleware/validator");

router.use(authenticate);

// POST /api/v1/order/create
router.post(
  "/create",
  requireBody(["serviceType", "appointmentTime", "patientId", "addressId"]),
  async (req, res, next) => {
    try {
      const result = await orderService.createOrder(req.user.userId, req.user.communityId, req.body);
      return success(res, result);
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/v1/order/list
router.get("/list", async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const { list, total } = await orderService.getOrderList(req.user.userId, { page, pageSize, status });
    return successPage(res, list, page, pageSize, total);
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/order/detail
router.get("/detail", requireQuery(["orderId"]), async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetail(req.user.userId, req.query.orderId);
    return success(res, order);
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/order/cancel
router.post("/cancel", requireBody(["orderId"]), async (req, res, next) => {
  try {
    const result = await orderService.cancelOrder(req.user.userId, req.body.orderId, req.body.reason);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/order/delete
router.delete("/delete", requireQuery(["orderId"]), async (req, res, next) => {
  try {
    const result = await orderService.deleteOrder(req.user.userId, req.query.orderId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/order/reorder
router.post("/reorder", requireBody(["orderId"]), async (req, res, next) => {
  try {
    const result = await orderService.reorder(req.user.userId, req.body.orderId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
