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
const WX_REFUND_API = "https://api.mch.weixin.qq.com/v3/refund/domestic/refunds";

/**
 * 读取商户私钥（PEM），用于请求报文签名
 */
function loadPrivateKey() {
  const keyPath = process.env.WX_PRIVATE_KEY_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new BizError(500, "微信支付私钥未配置");
  }
  return fs.readFileSync(keyPath, "utf8");
}

/**
 * 构造微信支付 V3 请求签名（RSA-SHA256），生成 Authorization 头
 */
function buildAuthorizationHeader(method, urlPath, body) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = uuidv4().replace(/-/g, "");
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;

  const privateKey = loadPrivateKey();
  const sign = crypto.sign("RSA-SHA256", Buffer.from(message), privateKey).toString("base64");

  const mchid = process.env.WX_MCHID;
  const serialNo = process.env.WX_SERIAL_NO;

  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${sign}"`;
}

/**
 * 生成小程序调起支付所需的二次签名参数
 */
function buildJsapiPaySign(prepayId) {
  const appId = process.env.WX_APPID;
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = uuidv4().replace(/-/g, "");
  const packageStr = `prepay_id=${prepayId}`;

  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  const privateKey = loadPrivateKey();
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

  const outTradeNo = `${order.order_no}_${Date.now()}`;
  const amountFen = Math.round(Number(order.payable_amount) * 100);

  const requestBody = {
    appid: process.env.WX_APPID,
    mchid: process.env.WX_MCHID,
    description: `社区陪诊-${order.service_type}`,
    out_trade_no: outTradeNo,
    notify_url: process.env.WX_NOTIFY_URL,
    amount: { total: amountFen, currency: "CNY" },
    payer: { openid }
  };
  const bodyStr = JSON.stringify(requestBody);

  let prepayId;
  try {
    const authHeader = buildAuthorizationHeader("POST", "/v3/pay/transactions/jsapi", bodyStr);
    const { data } = await axios.post(WX_PAY_API, requestBody, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
    prepayId = data.prepay_id;
  } catch (err) {
    logger.payment(`[WX UNIFIED ORDER FAIL] orderNo=${order.order_no} err=${err.message}`);
    throw new BizError(BIZ_CODE.PAY_FAILED, "微信下单失败，请稍后重试");
  }

  await db.query(
    `INSERT INTO payments
     (order_id, order_no, out_trade_no, pay_channel, pay_amount, currency, pay_status, created_at, updated_at)
     VALUES (?, ?, ?, 'WECHAT', ?, 'CNY', 'PAYING', NOW(), NOW())`,
    [orderId, order.order_no, outTradeNo, order.payable_amount]
  );
  await db.query("UPDATE orders SET payment_status = ? WHERE id = ?", [PAYMENT_STATUS.PAYING, orderId]);

  logger.payment(`[PAY CREATE] orderNo=${order.order_no} outTradeNo=${outTradeNo} amountFen=${amountFen}`);

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

  const requestBody = {
    out_trade_no: payment.out_trade_no,
    out_refund_no: refundNo,
    reason: "用户申请退款",
    notify_url: process.env.WX_NOTIFY_URL.replace("/pay/notify", "/pay/refund/notify"),
    amount: { refund: refundAmountFen, total: refundAmountFen, currency: "CNY" }
  };
  const bodyStr = JSON.stringify(requestBody);

  try {
    const authHeader = buildAuthorizationHeader("POST", "/v3/refund/domestic/refunds", bodyStr);
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

module.exports = {
  createPayment,
  getPaymentStatus,
  handlePaymentNotify,
  applyRefund,
  handleRefundNotify
};
