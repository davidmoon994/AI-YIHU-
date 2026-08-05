"use strict";

const express = require("express");
const router = express.Router();

const payService = require("../services/payService");
const userService = require("../services/userService");
const wxCrypto = require("../utils/wxCrypto");
const logger = require("../utils/logger");
const db = require("../db");
const { success, fail } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { requireBody, requireQuery } = require("../middleware/validator");
const { BizError } = require("../middleware/error");

// ===== 需要登录的用户接口 =====

router.post("/create", authenticate, requireBody(["orderId"]), async (req, res, next) => {
  try {
    // openid 从用户表读取，禁止客户端传入，防止支付被指向其他人账户
    const profile = await userService.getProfile(req.user.userId);
    const params = await payService.createPayment(req.user.userId, req.body.orderId, profile.openid);
    return success(res, params);
  } catch (err) {
    return next(err);
  }
});

router.get("/status", authenticate, requireQuery(["orderId"]), async (req, res, next) => {
  try {
    const result = await payService.getPaymentStatus(req.user.userId, req.query.orderId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/refund", authenticate, requireBody(["orderId"]), async (req, res, next) => {
  try {
    const result = await payService.applyRefund(req.user.userId, req.body.orderId, req.body.reason);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.get("/refund/status", authenticate, requireQuery(["orderId"]), async (req, res, next) => {
  try {
    const rows = await db.query("SELECT * FROM refunds WHERE order_id = ? ORDER BY id DESC LIMIT 1", [req.query.orderId]);
    if (rows.length === 0) {
      throw new BizError(404, "退款记录不存在");
    }
    return success(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

// ===== 微信支付异步回调（无需JWT，靠微信签名验证身份）=====

router.post("/notify", async (req, res) => {
  try {
    const timestamp = req.headers["wechatpay-timestamp"];
    const nonce = req.headers["wechatpay-nonce"];
    const signature = req.headers["wechatpay-signature"];
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);

    const validSignature = wxCrypto.verifyNotifySignature(timestamp, nonce, rawBody, signature);
    if (!validSignature) {
      logger.payment("[PAY NOTIFY] 签名验证失败，拒绝处理");
      return res.status(401).json({ code: "FAIL", message: "签名验证失败" });
    }

    const decrypted = wxCrypto.decryptResource(req.body.resource);
    await payService.handlePaymentNotify(decrypted);

    return res.status(200).json({ code: "SUCCESS", message: "成功" });
  } catch (err) {
    logger.payment(`[PAY NOTIFY ERROR] ${err.message}`);
    // 微信要求非200/非SUCCESS会重试通知，异常时返回失败让微信重试，保证最终一致性
    return res.status(500).json({ code: "FAIL", message: "处理失败" });
  }
});

router.post("/refund/notify", async (req, res) => {
  try {
    const timestamp = req.headers["wechatpay-timestamp"];
    const nonce = req.headers["wechatpay-nonce"];
    const signature = req.headers["wechatpay-signature"];
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);

    const validSignature = wxCrypto.verifyNotifySignature(timestamp, nonce, rawBody, signature);
    if (!validSignature) {
      logger.payment("[REFUND NOTIFY] 签名验证失败，拒绝处理");
      return res.status(401).json({ code: "FAIL", message: "签名验证失败" });
    }

    const decrypted = wxCrypto.decryptResource(req.body.resource);
    await payService.handleRefundNotify(decrypted);

    return res.status(200).json({ code: "SUCCESS", message: "成功" });
  } catch (err) {
    logger.payment(`[REFUND NOTIFY ERROR] ${err.message}`);
    return res.status(500).json({ code: "FAIL", message: "处理失败" });
  }
});

module.exports = router;
