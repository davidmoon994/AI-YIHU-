"use strict";

const dayjs = require("dayjs");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const logger = require("../utils/logger");
const { BizError } = require("../middleware/error");
const { ORDER_STATUS, SERVICE_TYPE, BIZ_CODE } = require("../utils/constants");

/**
 * 生成订单号：PD + 年月日 + 6位随机数
 */
function generateOrderNo() {
  const datePart = dayjs().format("YYYYMMDD");
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `PD${datePart}${randomPart}`;
}

/**
 * 从 system_configs 读取服务基础价格。
 * 价格禁止由客户端传入，必须由服务器计算（08-SECURITY.md 第九条）。
 */
async function getServicePrice(serviceType) {
  const keyMap = {
    [SERVICE_TYPE.ESCORT]: "price_escort_base",
    [SERVICE_TYPE.REGISTER]: "price_register_base",
    [SERVICE_TYPE.PICKUP]: "price_pickup_base",
    [SERVICE_TYPE.PLANNING]: "price_planning_base"
  };
  const configKey = keyMap[serviceType];
  if (!configKey) {
    throw new BizError(400, "服务类型不支持");
  }
  const rows = await db.query("SELECT config_value FROM system_configs WHERE config_key = ? LIMIT 1", [configKey]);
  if (rows.length === 0) {
    // 兜底默认价，避免配置缺失导致下单失败
    return 199.0;
  }
  return Number(rows[0].config_value);
}

async function createOrder(userId, communityId, payload) {
  const {
    serviceType, hospitalName, departmentName, appointmentTime,
    patientId, addressId, remark
  } = payload;

  if (!Object.values(SERVICE_TYPE).includes(serviceType)) {
    throw new BizError(400, "服务类型非法");
  }

  // 校验就诊人归属
  const patients = await db.query("SELECT * FROM patient_profiles WHERE id = ? AND user_id = ? LIMIT 1", [patientId, userId]);
  if (patients.length === 0) {
    throw new BizError(404, "就诊人不存在");
  }
  const patient = patients[0];

  // 校验地址归属
  const addresses = await db.query("SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1", [addressId, userId]);
  if (addresses.length === 0) {
    throw new BizError(404, "地址不存在");
  }
  const address = addresses[0];

  const price = await getServicePrice(serviceType);
  const orderNo = generateOrderNo();
  const serviceAddress = `${address.province}${address.city}${address.district}${address.detail_address}`;

  const result = await db.transaction(async (conn) => {
    const [insertResult] = await conn.query(
      `INSERT INTO orders
       (order_no, user_id, community_id, service_type, hospital_name, department_name,
        patient_name, patient_phone, appointment_time, service_address, latitude, longitude,
        original_amount, discount_amount, payable_amount, paid_amount,
        payment_status, order_status, remark, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 'UNPAID', ?, ?, NOW(), NOW())`,
      [
        orderNo, userId, communityId, serviceType, hospitalName || null, departmentName || null,
        patient.name, patient.phone, appointmentTime, serviceAddress,
        address.latitude || null, address.longitude || null,
        price, price, ORDER_STATUS.PENDING, remark || null
      ]
    );

    await conn.query(
      `INSERT INTO order_logs (order_id, from_status, to_status, remark, created_at)
       VALUES (?, NULL, ?, '创建订单', NOW())`,
      [insertResult.insertId, ORDER_STATUS.PENDING]
    );

    return { orderId: insertResult.insertId, orderNo, amount: price };
  });

  logger.info(`[ORDER CREATE] orderNo=${orderNo} userId=${userId} amount=${price}`);
  return result;
}

async function getOrderList(userId, { page = 1, pageSize = 20, status }) {
  const offset = (Number(page) - 1) * Number(pageSize);
  const params = [userId];
  let where = "WHERE user_id = ?";
  if (status) {
    where += " AND order_status = ?";
    params.push(status);
  }

  const totalRows = await db.query(`SELECT COUNT(*) as total FROM orders ${where}`, params);
  const list = await db.query(
    `SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );

  return { list, total: totalRows[0].total };
}

async function getOrderDetail(userId, orderId, isAdmin = false) {
  const sql = isAdmin
    ? "SELECT * FROM orders WHERE id = ? LIMIT 1"
    : "SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1";
  const params = isAdmin ? [orderId] : [orderId, userId];
  const rows = await db.query(sql, params);
  if (rows.length === 0) {
    throw new BizError(BIZ_CODE.ORDER_NOT_FOUND, "订单不存在");
  }
  return rows[0];
}

/**
 * 取消订单：按 04-BUSINESS.md 第九条规则
 * pending / dispatching / assigned 之前允许直接取消或走退款
 */
async function cancelOrder(userId, orderId, reason) {
  return db.transaction(async (conn) => {
    const [rows] = await conn.query("SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE", [orderId, userId]);
    if (rows.length === 0) {
      throw new BizError(BIZ_CODE.ORDER_NOT_FOUND, "订单不存在");
    }
    const order = rows[0];

    const cancellableStatus = [ORDER_STATUS.PENDING, ORDER_STATUS.DISPATCHING, ORDER_STATUS.ASSIGNED];
    if (!cancellableStatus.includes(order.order_status)) {
      throw new BizError(409, "当前订单状态不可取消");
    }

    await conn.query(
      "UPDATE orders SET order_status = ?, cancelled_at = NOW(), updated_at = NOW() WHERE id = ?",
      [ORDER_STATUS.CANCELLED, orderId]
    );
    await conn.query(
      `INSERT INTO order_logs (order_id, from_status, to_status, remark, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [orderId, order.order_status, ORDER_STATUS.CANCELLED, reason || "用户取消"]
    );

    return { orderId, needRefund: order.payment_status === "SUCCESS" };
  });
}

async function deleteOrder(userId, orderId) {
  const closedStatus = [ORDER_STATUS.CANCELLED, ORDER_STATUS.CLOSED, ORDER_STATUS.COMPLETED];
  const rows = await db.query("SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1", [orderId, userId]);
  if (rows.length === 0) {
    throw new BizError(BIZ_CODE.ORDER_NOT_FOUND, "订单不存在");
  }
  if (!closedStatus.includes(rows[0].order_status)) {
    throw new BizError(409, "当前订单状态不可删除");
  }
  await db.query("UPDATE orders SET is_deleted = 1, updated_at = NOW() WHERE id = ?", [orderId]);
  return { orderId };
}

async function reorder(userId, orderId) {
  const original = await getOrderDetail(userId, orderId);
  return createOrder(userId, original.community_id, {
    serviceType: original.service_type,
    hospitalName: original.hospital_name,
    departmentName: original.department_name,
    appointmentTime: dayjs().add(1, "day").format("YYYY-MM-DD HH:mm:ss"),
    patientId: null, // 前端需重新选择就诊人，避免引用已变更的历史数据
    addressId: null,
    remark: original.remark
  });
}

/**
 * 供 Service 内部（支付回调、派单、陪诊员流程）统一变更订单状态并写日志
 */
async function transitionStatus(conn, orderId, fromStatuses, toStatus, remark) {
  const placeholders = fromStatuses.map(() => "?").join(",");
  const [result] = await conn.query(
    `UPDATE orders SET order_status = ?, updated_at = NOW() WHERE id = ? AND order_status IN (${placeholders})`,
    [toStatus, orderId, ...fromStatuses]
  );
  if (result.affectedRows === 0) {
    throw new BizError(409, "订单状态已变化，操作被拒绝（幂等保护）");
  }
  await conn.query(
    `INSERT INTO order_logs (order_id, from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, NOW())`,
    [orderId, fromStatuses.join("/"), toStatus, remark || ""]
  );
}

module.exports = {
  createOrder,
  getOrderList,
  getOrderDetail,
  cancelOrder,
  deleteOrder,
  reorder,
  transitionStatus,
  generateOrderNo
};
