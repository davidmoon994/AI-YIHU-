"use strict";

const db = require("../db");
const logger = require("../utils/logger");
const { BizError } = require("../middleware/error");
const { ORDER_STATUS, DISPATCH_STATUS, RESPONSE_STATUS, BIZ_CODE } = require("../utils/constants");

// 延迟引入，避免与 wsService 循环依赖问题
function getWsService() {
  return require("./wsService");
}

const DEFAULT_TIMEOUT_SECONDS = Number(process.env.DISPATCH_RESPONSE_TIMEOUT_SECONDS || 60);
const DEFAULT_MAX_RETRY = Number(process.env.DISPATCH_MAX_RETRY || 5);

// 内存中维护每个订单当前派单轮次的定时器，Server重启后由异常恢复逻辑重建（07-WEBSOCKET.md 十五条）
const timeoutTimers = new Map();

async function getConfig(key, fallback) {
  const rows = await db.query("SELECT config_value FROM system_configs WHERE config_key = ? LIMIT 1", [key]);
  if (rows.length === 0) return fallback;
  return rows[0].config_value;
}

/**
 * 计算两个经纬度坐标间的直线距离（单位：米），Haversine公式
 */
function calcDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 按 05-DISPATCH.md 第三条优先级筛选候选陪诊员，返回按优先级排序的列表
 */
async function selectCandidates(order, excludeEscortIds = []) {
  const excludeClause = excludeEscortIds.length > 0
    ? `AND id NOT IN (${excludeEscortIds.map(() => "?").join(",")})`
    : "";

  const candidates = await db.query(
    `SELECT e.* FROM escorts e
     WHERE e.community_id = ? AND e.status = 'online' AND e.work_status = 'idle'
       AND e.is_deleted = 0
       AND (
         NOT EXISTS (SELECT 1 FROM escort_service_skills s0 WHERE s0.escort_id = e.id)
         OR EXISTS (
           SELECT 1 FROM escort_service_skills s
           WHERE s.escort_id = e.id
             AND s.service_type = ?
             AND s.approval_status = 'approved'
         )
       )
     ${excludeClause}`,
    excludeEscortIds.length > 0
      ? [order.community_id, order.service_type, ...excludeEscortIds]
      : [order.community_id, order.service_type]
  );

  const withDistance = candidates.map((c) => ({
    ...c,
    distance: order.latitude && c.latitude
      ? calcDistanceMeters(Number(order.latitude), Number(order.longitude), Number(c.latitude), Number(c.longitude))
      : Number.MAX_SAFE_INTEGER
  }));

  withDistance.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (Number(b.rating) !== Number(a.rating)) return Number(b.rating) - Number(a.rating);
    return a.total_orders - b.total_orders;
  });

  return withDistance;
}

/**
 * 启动自动派单：订单支付成功后触发
 */
async function startAutoDispatch(orderId) {
  const autoDispatchEnabled = await getConfig("auto_dispatch_enabled", "1");
  if (autoDispatchEnabled === "0") {
    logger.dispatch(`[AUTO DISPATCH DISABLED] orderId=${orderId}`);
    return;
  }
  return runDispatchRound(orderId, 0, []);
}

async function runDispatchRound(orderId, retryCount, excludedEscortIds) {
  const orders = await db.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
  if (orders.length === 0) return;
  const order = orders[0];

  if (![ORDER_STATUS.DISPATCHING].includes(order.order_status)) {
    logger.dispatch(`[DISPATCH SKIP] orderId=${orderId} 当前状态=${order.order_status} 非dispatching，终止派单`);
    return;
  }

  const maxRetry = Number(await getConfig("dispatch_max_retry", DEFAULT_MAX_RETRY));
  if (retryCount > maxRetry) {
    logger.dispatch(`[DISPATCH EXHAUSTED] orderId=${orderId} 超过最大重派次数，转入人工处理队列`);
    await db.query(
      `INSERT INTO dispatch_records (order_id, dispatch_type, dispatch_status, dispatch_time, created_at)
       VALUES (?, 'auto', 'failed', NOW(), NOW())`,
      [orderId]
    );
    getWsService().notifyAdmin("dispatch.failed", { orderId });
    return;
  }

  const candidates = await selectCandidates(order, excludedEscortIds);
  if (candidates.length === 0) {
    logger.dispatch(`[NO CANDIDATE] orderId=${orderId} 暂无可用陪诊员`);
    await db.query(
      `INSERT INTO dispatch_records (order_id, dispatch_type, dispatch_status, dispatch_time, created_at)
       VALUES (?, 'auto', 'failed', NOW(), NOW())`,
      [orderId]
    );
    getWsService().notifyAdmin("dispatch.failed", { orderId, reason: "暂无陪诊员" });
    return;
  }

  const target = candidates[0];
  const dispatchResult = await db.query(
    `INSERT INTO dispatch_records
     (order_id, escort_id, dispatch_type, dispatch_status, response_status, dispatch_time, created_at)
     VALUES (?, ?, 'auto', 'pushing', 'pending', NOW(), NOW())`,
    [orderId, target.id]
  );
  const dispatchRecordId = dispatchResult.insertId;

  logger.dispatch(`[DISPATCH PUSH] orderId=${orderId} escortId=${target.id} retry=${retryCount}`);
  getWsService().notifyEscort(target.id, "dispatch.push", {
    orderId,
    orderNo: order.order_no,
    dispatchRecordId,
    hospitalName: order.hospital_name,
    serviceAddress: order.service_address
  });

  const timeoutSeconds = Number(await getConfig("dispatch_response_timeout_seconds", DEFAULT_TIMEOUT_SECONDS));
  const timer = setTimeout(() => {
    handleDispatchTimeout(orderId, dispatchRecordId, target.id, retryCount, excludedEscortIds).catch((err) => {
      logger.error(`[DISPATCH TIMEOUT HANDLER ERROR] ${err.message}`);
    });
  }, timeoutSeconds * 1000);
  timeoutTimers.set(dispatchRecordId, timer);
}

async function handleDispatchTimeout(orderId, dispatchRecordId, escortId, retryCount, excludedEscortIds) {
  timeoutTimers.delete(dispatchRecordId);

  const rows = await db.query("SELECT * FROM dispatch_records WHERE id = ? LIMIT 1", [dispatchRecordId]);
  if (rows.length === 0 || rows[0].response_status !== RESPONSE_STATUS.PENDING) {
    return; // 已被接单/拒单处理，无需重派
  }

  await db.query(
    "UPDATE dispatch_records SET dispatch_status = 'timeout', response_status = 'timeout', response_time = NOW() WHERE id = ?",
    [dispatchRecordId]
  );
  logger.dispatch(`[DISPATCH TIMEOUT] orderId=${orderId} escortId=${escortId} 进入下一轮`);

  await runDispatchRound(orderId, retryCount + 1, [...excludedEscortIds, escortId]);
}

/**
 * 陪诊员接单
 */
async function acceptDispatch(escortId, dispatchRecordId) {
  return db.transaction(async (conn) => {
    const [records] = await conn.query("SELECT * FROM dispatch_records WHERE id = ? AND escort_id = ? LIMIT 1 FOR UPDATE", [dispatchRecordId, escortId]);
    if (records.length === 0) {
      throw new BizError(404, "派单记录不存在");
    }
    const record = records[0];
    if (record.response_status !== RESPONSE_STATUS.PENDING) {
      throw new BizError(409, "该订单已被处理，接单失败");
    }

    const [orderRows] = await conn.query("SELECT community_id, service_type FROM orders WHERE id = ? LIMIT 1", [record.order_id]);
    if (orderRows.length === 0) throw new BizError(404, "订单不存在");
    const order = orderRows[0];
    const [skillRows] = await conn.query("SELECT approval_status FROM escort_service_skills WHERE escort_id = ?", [escortId]);
    if (skillRows.length > 0) {
      const [approved] = await conn.query(
        "SELECT id FROM escort_service_skills WHERE escort_id = ? AND service_type = ? AND approval_status = 'approved' LIMIT 1",
        [escortId, order.service_type]
      );
      if (approved.length === 0) throw new BizError(403, "当前服务能力尚未通过审核，无法接该类订单");
    }

    const [orderUpdateResult] = await conn.query(
      "UPDATE orders SET order_status = ?, escort_id = ?, updated_at = NOW() WHERE id = ? AND order_status = ?",
      [ORDER_STATUS.ASSIGNED, escortId, record.order_id, ORDER_STATUS.DISPATCHING]
    );
    if (orderUpdateResult.affectedRows === 0) {
      throw new BizError(409, "订单状态已变化，接单失败");
    }

    await conn.query(
      "UPDATE dispatch_records SET dispatch_status = 'accepted', response_status = 'accepted', response_time = NOW() WHERE id = ?",
      [dispatchRecordId]
    );
    await conn.query("UPDATE escorts SET work_status = 'working' WHERE id = ?", [escortId]);
    await conn.query(
      `INSERT INTO order_logs (order_id, from_status, to_status, remark, created_at)
       VALUES (?, ?, ?, '陪诊员接单', NOW())`,
      [record.order_id, ORDER_STATUS.DISPATCHING, ORDER_STATUS.ASSIGNED]
    );

    return { orderId: record.order_id };
  }).then((result) => {
    const timer = timeoutTimers.get(dispatchRecordId);
    if (timer) {
      clearTimeout(timer);
      timeoutTimers.delete(dispatchRecordId);
    }
    getWsService().notifyUserOrderEvent(result.orderId, "escort.accept", { orderId: result.orderId });
    return result;
  });
}

/**
 * 陪诊员拒单：立即触发下一轮派单
 */
async function rejectDispatch(escortId, dispatchRecordId) {
  const records = await db.query("SELECT * FROM dispatch_records WHERE id = ? AND escort_id = ? LIMIT 1", [dispatchRecordId, escortId]);
  if (records.length === 0) {
    throw new BizError(404, "派单记录不存在");
  }
  const record = records[0];
  if (record.response_status !== RESPONSE_STATUS.PENDING) {
    throw new BizError(409, "该派单已被处理");
  }

  await db.query(
    "UPDATE dispatch_records SET dispatch_status = 'reject', response_status = 'rejected', response_time = NOW() WHERE id = ?",
    [dispatchRecordId]
  );

  const timer = timeoutTimers.get(dispatchRecordId);
  if (timer) {
    clearTimeout(timer);
    timeoutTimers.delete(dispatchRecordId);
  }

  logger.dispatch(`[DISPATCH REJECT] orderId=${record.order_id} escortId=${escortId}`);
  await runDispatchRound(record.order_id, 0, [escortId]);
  return { orderId: record.order_id };
}

/**
 * 人工派单：管理员指定陪诊员，优先级高于自动派单
 */
async function manualDispatch(adminId, orderId, escortId, adminContext = {}) {
  return db.transaction(async (conn) => {
    const [orders] = await conn.query("SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [orderId]);
    if (orders.length === 0) throw new BizError(BIZ_CODE.ORDER_NOT_FOUND, "订单不存在");
    const order = orders[0];
    if (![ORDER_STATUS.DISPATCHING, ORDER_STATUS.ASSIGNED].includes(order.order_status)) {
      throw new BizError(409, "当前订单状态不支持人工派单");
    }

    const [escorts] = await conn.query(
      "SELECT id, community_id, status, work_status, is_deleted FROM escorts WHERE id = ? LIMIT 1",
      [escortId]
    );
    if (escorts.length === 0 || Number(escorts[0].is_deleted) === 1) throw new BizError(404, "服务人员不存在");
    const escort = escorts[0];
    if (String(escort.community_id) !== String(order.community_id)) {
      throw new BizError(403, "不能跨社区派单");
    }
    if (adminContext.role !== "SUPER_ADMIN" && String(adminContext.communityId) !== String(order.community_id)) {
      throw new BizError(403, "无权操作其他社区订单");
    }
    if (escort.status !== "online" || escort.work_status !== "idle") {
      throw new BizError(409, "该服务人员当前不在线或正在服务中");
    }

    const [skillRows] = await conn.query("SELECT approval_status FROM escort_service_skills WHERE escort_id = ?", [escortId]);
    if (skillRows.length > 0) {
      const [approved] = await conn.query(
        "SELECT id FROM escort_service_skills WHERE escort_id = ? AND service_type = ? AND approval_status = 'approved' LIMIT 1",
        [escortId, order.service_type]
      );
      if (approved.length === 0) {
        throw new BizError(403, "该服务人员尚未通过当前服务类型认证，不能人工派单");
      }
    }

    await conn.query(
      "UPDATE orders SET order_status = ?, escort_id = ?, updated_at = NOW() WHERE id = ?",
      [ORDER_STATUS.ASSIGNED, escortId, orderId]
    );
    await conn.query(
      `INSERT INTO dispatch_records (order_id, escort_id, dispatch_type, dispatch_status, response_status, dispatch_time, response_time, created_at)
       VALUES (?, ?, 'manual', 'accepted', 'accepted', NOW(), NOW(), NOW())`,
      [orderId, escortId]
    );
    await conn.query(
      `INSERT INTO order_logs (order_id, from_status, to_status, remark, created_at)
       VALUES (?, ?, ?, '管理员人工派单', NOW())`,
      [orderId, order.order_status, ORDER_STATUS.ASSIGNED]
    );
    await conn.query(
      `INSERT INTO operation_logs (admin_id, module, action, request_url, request_method, result, created_at)
       VALUES (?, 'dispatch', 'manual_dispatch', '/api/v1/dispatch/manual', 'POST', 'success', NOW())`,
      [adminId]
    );

    return { orderId, escortId };
  }).then((result) => {
    getWsService().notifyEscort(escortId, "dispatch.push", { orderId, manual: true });
    return result;
  });
}

async function getEligibleEscorts(orderId, role, communityId) {
  const orders = await db.query("SELECT id, community_id, service_type, latitude, longitude FROM orders WHERE id = ? LIMIT 1", [orderId]);
  if (orders.length === 0) throw new BizError(404, "订单不存在");
  const order = orders[0];
  if (role !== "SUPER_ADMIN" && String(order.community_id) !== String(communityId)) {
    throw new BizError(403, "无权查看其他社区订单的服务人员");
  }
  return selectCandidates(order, []);
}

async function getDispatchList(orderId) {
  return db.query("SELECT * FROM dispatch_records WHERE order_id = ? ORDER BY id DESC", [orderId]);
}

async function getNearbyEscorts(communityId, latitude, longitude) {
  const escorts = await db.query(
    "SELECT id, name, avatar, rating, latitude, longitude FROM escorts WHERE community_id = ? AND status = 'online'",
    [communityId]
  );
  return escorts
    .map((e) => ({
      ...e,
      distance: e.latitude ? calcDistanceMeters(Number(latitude), Number(longitude), Number(e.latitude), Number(e.longitude)) : null
    }))
    .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
}

module.exports = {
  startAutoDispatch,
  acceptDispatch,
  rejectDispatch,
  manualDispatch,
  getDispatchList,
  getNearbyEscorts,
  getEligibleEscorts,
  calcDistanceMeters
};
