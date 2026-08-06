"use strict";

const fs = require("fs");
const crypto = require("crypto");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const logger = require("../utils/logger");
const { BizError } = require("../middleware/error");
const { ORDER_STATUS, PAYMENT_STATUS, BIZ_CODE } = require("../utils/constants");
const orderService = require("./orderService");
const dispatchService = require("./dispatchService");
const wsService = require("./wsService");

const WX_PAY_API = "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi";
const WX_PARTNER_PAY_API = "https://api.mch.weixin.qq.com/v3/pay/partner/transactions/jsapi";
const WX_REFUND_API = "https://api.mch.weixin.qq.com/v3/refund/domestic/refunds";
const WX_PROFIT_SHARE_API = "https://api.mch.weixin.qq.com/v3/profitsharing/orders";

// 支付配置缓存（避免每次查库）
let _payConfigCache = null;
let _payConfigCacheTime = 0;
const PAY_CONFIG_TTL = 60 * 1000; // 1分钟缓存

/**
 * 获取支付配置（从 system_configs 表读取，支持后台动态修改）
 */
async function getPayConfig() {
  if (_payConfigCache && Date.now() - _payConfigCacheTime < PAY_CONFIG_TTL) {
    return _payConfigCache;
  }
  const rows = await db.query("SELECT config_key, config_value FROM system_configs WHERE config_key IN ('pay_mode','sp_mchid','api_v3_key','serial_no','private_key_path','profit_share_enabled')");
  const config = {};
  for (const row of rows) {
    config[row.config_key] = row.config_value;
  }
  // 回退到环境变量（兼容未迁移场景）
  config.pay_mode = config.pay_mode || process.env.WX_SP_MCHID ? "partner" : "direct";
  config.sp_mchid = config.sp_mchid || process.env.WX_MCHID || "";
  config.api_v3_key = config.api_v3_key || process.env.WX_API_V3_KEY || "";
  config.serial_no = config.serial_no || process.env.WX_SERIAL_NO || "";
  config.private_key_path = config.private_key_path || process.env.WX_PRIVATE_KEY_PATH || "";
  config.profit_share_enabled = config.profit_share_enabled || "0";
  _payConfigCache = config;
  _payConfigCacheTime = Date.now();
  return config;
}

/**
 * 清除支付配置缓存（配置更新后调用）
 */
function clearPayConfigCache() {
  _payConfigCache = null;
  _payConfigCacheTime = 0;
}

/**
 * 读取商户私钥（PEM），用于请求报文签名
 */
async function loadPrivateKey() {
  const config = await getPayConfig();
  const keyPath = config.private_key_path;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new BizError(500, "微信支付私钥未配置");
  }
  return fs.readFileSync(keyPath, "utf8");
}

/**
 * 构造微信支付 V3 请求签名（RSA-SHA256），生成 Authorization 头
 */
async function buildAuthorizationHeader(method, urlPath, body) {
  const config = await getPayConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = uuidv4().replace(/-/g, "");
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;

  const privateKey = await loadPrivateKey();
  const sign = crypto.sign("RSA-SHA256", Buffer.from(message), privateKey).toString("base64");

  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.sp_mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.serial_no}",signature="${sign}"`;
}

/**
 * 生成小程序调起支付所需的二次签名参数
 */
async function buildJsapiPaySign(prepayId) {
  const appId = process.env.WX_APPID;
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = uuidv4().replace(/-/g, "");
  const packageStr = `prepay_id=${prepayId}`;

  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  const privateKey = await loadPrivateKey();
  const paySign = crypto.sign("RSA-SHA256", Buffer.from(message), privateKey).toString("base64");

  return {
    timeStamp,
    nonceStr,
    package: packageStr,
    signType: "RSA",
    paySign
  };
}

/**
 * 创建支付：写入 payments 流水，调用微信统一下单
 */
async function createPayment(userId, orderId, openid) {
  const order = await orderService.getOrderDetail(userId, orderId);

  if (order.payment_status === PAYMENT_STATUS.SUCCESS) {
    throw new BizError(BIZ_CODE.PAY_FAILED, "订单已支付，请勿重复支付");
  }
  if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.CLOSED].includes(order.order_status)) {
    throw new BizError(BIZ_CODE.ORDER_CANCELLED, "订单已取消，无法支付");
  }

  const payConfig = await getPayConfig();
  const outTradeNo = `${order.order_no}_${Date.now()}`;
  const amountFen = Math.round(Number(order.payable_amount) * 100);

  // 服务商模式：查社区的子商户号
  let subMchid = null;
  let requestBody;
  let apiPath;
  let apiUrl;

  if (payConfig.pay_mode === "partner") {
    const [community] = await db.query("SELECT sub_mchid FROM communities WHERE id = ? LIMIT 1", [order.community_id]);
    subMchid = community && community.sub_mchid;
    if (!subMchid) {
      throw new BizError(BIZ_CODE.PAY_FAILED, `社区未配置子商户号，无法发起支付`);
    }
    // 服务商合单下单
    requestBody = {
      sp_appid: process.env.WX_APPID,
      sp_mchid: payConfig.sp_mchid,
      sub_mchid: subMchid,
      description: `社区陪诊-${order.service_type}`,
      out_trade_no: outTradeNo,
      notify_url: process.env.WX_NOTIFY_URL,
      amount: { total: amountFen, currency: "CNY" },
      payer: { sp_openid: openid }
    };
    apiPath = "/v3/pay/partner/transactions/jsapi";
    apiUrl = WX_PARTNER_PAY_API;
  } else {
    // 直连商户模式（原有逻辑）
    requestBody = {
      appid: process.env.WX_APPID,
      mchid: payConfig.sp_mchid,
      description: `社区陪诊-${order.service_type}`,
      out_trade_no: outTradeNo,
      notify_url: process.env.WX_NOTIFY_URL,
      amount: { total: amountFen, currency: "CNY" },
      payer: { openid }
    };
    apiPath = "/v3/pay/transactions/jsapi";
    apiUrl = WX_PAY_API;
  }

  const bodyStr = JSON.stringify(requestBody);

  let prepayId;
  try {
    const authHeader = await buildAuthorizationHeader("POST", apiPath, bodyStr);
    const { data } = await axios.post(apiUrl, requestBody, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
    prepayId = data.prepay_id;
  } catch (err) {
    logger.payment(`[WX UNIFIED ORDER FAIL] orderNo=${order.order_no} mode=${payConfig.pay_mode} err=${err.message}`);
    throw new BizError(BIZ_CODE.PAY_FAILED, "微信下单失败，请稍后重试");
  }

  await db.query(
    `INSERT INTO payments
     (order_id, order_no, out_trade_no, sub_mchid, pay_channel, pay_amount, currency, pay_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'WECHAT', ?, 'CNY', 'PAYING', NOW(), NOW())`,
    [orderId, order.order_no, outTradeNo, subMchid, order.payable_amount]
  );
  await db.query("UPDATE orders SET payment_status = ? WHERE id = ?", [PAYMENT_STATUS.PAYING, orderId]);

  logger.payment(`[PAY CREATE] orderNo=${order.order_no} outTradeNo=${outTradeNo} amountFen=${amountFen} mode=${payConfig.pay_mode} subMchid=${subMchid || 'N/A'}`);

  return buildJsapiPaySign(prepayId);
}

async function getPaymentStatus(userId, orderId) {
  const order = await orderService.getOrderDetail(userId, orderId);
  return { orderId, paymentStatus: order.payment_status };
}

/**
 * 处理微信支付回调（V3 已在路由层完成验签解密，这里只处理业务幂等更新）
 * @param {{out_trade_no:string, transaction_id:string, trade_state:string}} notifyData
 */
async function handlePaymentNotify(notifyData) {
  const { out_trade_no: outTradeNo, transaction_id: transactionId, trade_state: tradeState } = notifyData;

  return db.transaction(async (conn) => {
    const [payments] = await conn.query("SELECT * FROM payments WHERE out_trade_no = ? LIMIT 1 FOR UPDATE", [outTradeNo]);
    if (payments.length === 0) {
      logger.error(`[PAY NOTIFY] 未找到支付记录 out_trade_no=${outTradeNo}`);
      throw new BizError(404, "支付记录不存在");
    }
    const payment = payments[0];

    // 幂等：已经是SUCCESS则直接返回，不重复处理
    if (payment.pay_status === PAYMENT_STATUS.SUCCESS) {
      logger.payment(`[PAY NOTIFY DUPLICATE] out_trade_no=${outTradeNo} 已处理，跳过`);
      return { orderId: payment.order_id, duplicate: true };
    }

    const newPayStatus = tradeState === "SUCCESS" ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.FAILED;

    await conn.query(
      `UPDATE payments SET pay_status = ?, transaction_id = ?, notify_result = ?, paid_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [newPayStatus, transactionId || null, JSON.stringify(notifyData), payment.id]
    );

    if (newPayStatus === PAYMENT_STATUS.SUCCESS) {
      const [orderResult] = await conn.query(
        `UPDATE orders SET payment_status = ?, paid_amount = payable_amount, order_status = ?, updated_at = NOW()
         WHERE id = ? AND order_status = ?`,
        [PAYMENT_STATUS.SUCCESS, ORDER_STATUS.DISPATCHING, payment.order_id, ORDER_STATUS.PENDING]
      );
      if (orderResult.affectedRows === 0) {
        logger.warn(`[PAY NOTIFY] 订单状态非pending，可能重复通知 orderId=${payment.order_id}`);
      } else {
        await conn.query(
          `INSERT INTO order_logs (order_id, from_status, to_status, remark, created_at)
           VALUES (?, ?, ?, '支付成功，进入派单', NOW())`,
          [payment.order_id, ORDER_STATUS.PENDING, ORDER_STATUS.DISPATCHING]
        );
      }
    }

    return { orderId: payment.order_id, paymentSuccess: newPayStatus === PAYMENT_STATUS.SUCCESS };
  }).then(async (result) => {
    // 事务提交后再触发派单和推送，避免长事务
    if (result.paymentSuccess && !result.duplicate) {
      logger.payment(`[PAY SUCCESS] orderId=${result.orderId}`);
      wsService.notifyUserOrderEvent(result.orderId, "order.pay", { orderId: result.orderId });
      await dispatchService.startAutoDispatch(result.orderId);
    }
    return result;
  });
}

/**
 * 申请退款：根据订单状态判断是否需要人工审核（06-WECHAT_PAY.md 第八条）
 */
async function applyRefund(userId, orderId, reason) {
  const order = await orderService.getOrderDetail(userId, orderId);

  if (order.payment_status !== PAYMENT_STATUS.SUCCESS) {
    throw new BizError(409, "订单未支付成功，无法退款");
  }

  const autoRefundStatuses = [ORDER_STATUS.DISPATCHING];
  const needManualReview = !autoRefundStatuses.includes(order.order_status);

  const refundNo = `RF${Date.now()}`;
  const status = needManualReview ? "PROCESSING" : "PROCESSING";

  const result = await db.query(
    `INSERT INTO refunds (order_id, refund_no, refund_amount, refund_status, refund_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [orderId, refundNo, order.paid_amount, status, reason || ""]
  );

  await db.query("UPDATE orders SET payment_status = ? WHERE id = ?", [PAYMENT_STATUS.REFUNDING, orderId]);

  if (!needManualReview) {
    await executeWechatRefund(order, refundNo, result.insertId);
  }

  return { refundId: result.insertId, refundNo, needManualReview };
}

async function executeWechatRefund(order, refundNo, refundId) {
  const payments = await db.query("SELECT * FROM payments WHERE order_id = ? AND pay_status = 'SUCCESS' LIMIT 1", [order.id]);
  if (payments.length === 0) {
    throw new BizError(409, "找不到对应的支付流水，无法退款");
  }
  const payment = payments[0];
  const refundAmountFen = Math.round(Number(order.paid_amount) * 100);

  const payConfig = await getPayConfig();
  const requestBody = {
    out_trade_no: payment.out_trade_no,
    out_refund_no: refundNo,
    reason: "用户申请退款",
    notify_url: process.env.WX_NOTIFY_URL.replace("/pay/notify", "/pay/refund/notify"),
    amount: { refund: refundAmountFen, total: refundAmountFen, currency: "CNY" }
  };
  // 服务商模式退款需加 sub_mchid
  if (payConfig.pay_mode === "partner" && payment.sub_mchid) {
    requestBody.sub_mchid = payment.sub_mchid;
  }
  const bodyStr = JSON.stringify(requestBody);

  try {
    const authHeader = await buildAuthorizationHeader("POST", "/v3/refund/domestic/refunds", bodyStr);
    await axios.post(WX_REFUND_API, requestBody, {
      headers: { Authorization: authHeader, Accept: "application/json", "Content-Type": "application/json" }
    });
    logger.payment(`[REFUND REQUEST] refundNo=${refundNo} orderId=${order.id}`);
  } catch (err) {
    logger.payment(`[REFUND REQUEST FAIL] refundNo=${refundNo} err=${err.message}`);
    await db.query("UPDATE refunds SET refund_status = 'FAILED', updated_at = NOW() WHERE id = ?", [refundId]);
    throw new BizError(BIZ_CODE.PAY_FAILED, "退款申请失败");
  }
}

/**
 * 处理微信退款回调
 */
async function handleRefundNotify(notifyData) {
  const { out_refund_no: refundNo, refund_status: refundStatus } = notifyData;

  return db.transaction(async (conn) => {
    const [refunds] = await conn.query("SELECT * FROM refunds WHERE refund_no = ? LIMIT 1 FOR UPDATE", [refundNo]);
    if (refunds.length === 0) {
      throw new BizError(404, "退款记录不存在");
    }
    const refund = refunds[0];
    if (refund.refund_status === "SUCCESS") {
      return { duplicate: true };
    }

    const newStatus = refundStatus === "SUCCESS" ? "SUCCESS" : "FAILED";
    await conn.query(
      "UPDATE refunds SET refund_status = ?, refund_result = ?, refunded_at = NOW(), updated_at = NOW() WHERE id = ?",
      [newStatus, JSON.stringify(notifyData), refund.id]
    );

    if (newStatus === "SUCCESS") {
      await conn.query(
        "UPDATE orders SET payment_status = 'REFUNDED', order_status = 'refund', updated_at = NOW() WHERE id = ?",
        [refund.order_id]
      );
      await conn.query(
        `INSERT INTO order_logs (order_id, from_status, to_status, remark, created_at)
         VALUES (?, NULL, 'refund', '退款成功', NOW())`,
        [refund.order_id]
      );
    }

    return { orderId: refund.order_id, success: newStatus === "SUCCESS" };
  });
}

/**
 * 执行分账（订单完成后调用）
 * @param {number} orderId
 */
async function executeProfitShare(orderId) {
  const payConfig = await getPayConfig();
  if (payConfig.pay_mode !== "partner" || payConfig.profit_share_enabled !== "1") {
    logger.payment(`[PROFIT SHARE SKIP] orderId=${orderId} mode=${payConfig.pay_mode} enabled=${payConfig.profit_share_enabled}`);
    return { skipped: true };
  }

  const order = await orderService.getOrderDetail(null, orderId, true);
  const [payment] = await db.query("SELECT * FROM payments WHERE order_id = ? AND pay_status = 'SUCCESS' LIMIT 1", [orderId]);
  if (!payment) throw new BizError(404, "未找到支付记录");
  if (!payment.sub_mchid) throw new BizError(400, "该支付记录无子商户号");

  const [community] = await db.query("SELECT commission_rate FROM communities WHERE id = ? LIMIT 1", [order.community_id]);
  const rate = Number(community.commission_rate) || 0;
  if (rate <= 0) return { skipped: true, reason: "抽佣比例为0" };

  const totalFen = Math.round(Number(payment.pay_amount) * 100);
  const platformFen = Math.round(totalFen * rate / 100);

  const requestBody = {
    appid: process.env.WX_APPID,
    transaction_id: payment.transaction_id,
    out_order_no: `PS${payment.out_trade_no}`,
    receivers: [
      {
        type: "MERCHANT_ID",
        account: payConfig.sp_mchid,
        amount: platformFen,
        description: `平台服务费(${rate}%)`
      }
    ]
  };
  const bodyStr = JSON.stringify(requestBody);

  try {
    const authHeader = await buildAuthorizationHeader("POST", "/v3/profitsharing/orders", bodyStr);
    await axios.post(WX_PROFIT_SHARE_API, requestBody, {
      headers: { Authorization: authHeader, Accept: "application/json", "Content-Type": "application/json" }
    });
    await db.query("UPDATE payments SET profit_share_status = 'PROCESSING', updated_at = NOW() WHERE id = ?", [payment.id]);
    logger.payment(`[PROFIT SHARE] orderId=${orderId} platformFen=${platformFen} rate=${rate}%`);
    return { success: true, platformAmount: platformFen };
  } catch (err) {
    logger.payment(`[PROFIT SHARE FAIL] orderId=${orderId} err=${err.message}`);
    await db.query("UPDATE payments SET profit_share_status = 'FAILED', updated_at = NOW() WHERE id = ?", [payment.id]);
    throw new BizError(500, "分账请求失败");
  }
}

module.exports = {
  createPayment,
  getPaymentStatus,
  handlePaymentNotify,
  applyRefund,
  handleRefundNotify,
  executeProfitShare,
  getPayConfig,
  clearPayConfigCache
};
