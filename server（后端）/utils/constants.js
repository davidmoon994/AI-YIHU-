"use strict";

// 订单状态（order_status）—— 固定枚举，禁止随意新增，参见 10-CODE_STANDARD.md 第十条
const ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  DISPATCHING: "dispatching",
  ASSIGNED: "assigned",
  ACCEPTED: "accepted",
  ARRIVED: "arrived",
  SERVING: "serving",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUND: "refund",
  CLOSED: "closed"
});

// 支付状态（payment_status）—— 与 06-WECHAT_PAY.md 保持一致，统一大写
const PAYMENT_STATUS = Object.freeze({
  UNPAID: "UNPAID",
  PAYING: "PAYING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REFUNDING: "REFUNDING",
  REFUNDED: "REFUNDED"
});

// 退款状态（refund_status）
const REFUND_STATUS = Object.freeze({
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CLOSED: "CLOSED"
});

// 派单任务状态（dispatch_status）
const DISPATCH_STATUS = Object.freeze({
  WAITING: "waiting",
  PUSHING: "pushing",
  ACCEPTED: "accepted",
  FINISHED: "finished",
  TIMEOUT: "timeout",
  REJECT: "reject",
  OFFLINE: "offline",
  MANUAL: "manual"
});

// 陪诊员接单响应状态（response_status）
const RESPONSE_STATUS = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  TIMEOUT: "timeout"
});

// 服务类型
const SERVICE_TYPE = Object.freeze({
  // 新版家庭服务（主业务）
  MEDICAL_ESCORT: "medical_escort",
  ELDERLY_CARE: "elderly_care",
  CHILD_CARE: "child_care",
  PET_CARE: "pet_care",
  // 兼容历史订单与旧客户端
  ESCORT: "escort",
  REGISTER: "register",
  PICKUP: "pickup",
  PLANNING: "planning"
});

// 角色
const ROLE = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  COMMUNITY_ADMIN: "COMMUNITY_ADMIN",
  ESCORT: "ESCORT",
  USER: "USER"
});

// 陪诊员在线状态（status）
const ESCORT_ONLINE_STATUS = Object.freeze({
  ONLINE: "online",
  OFFLINE: "offline",
  BUSY: "busy"
});

// 陪诊员工作状态（work_status）
const ESCORT_WORK_STATUS = Object.freeze({
  IDLE: "idle",
  WORKING: "working"
});

// 业务错误码（10000+），与 03-API.md 保持一致
const BIZ_CODE = Object.freeze({
  USER_NOT_FOUND: 10001,
  ESCORT_NOT_FOUND: 10002,
  ORDER_NOT_FOUND: 10003,
  PAY_FAILED: 10004,
  INSUFFICIENT_BALANCE: 10005,
  ORDER_CANCELLED: 10006,
  ORDER_COMPLETED: 10007,
  DISPATCH_FAILED: 10009,
  NO_ESCORT_AVAILABLE: 10010
});

module.exports = {
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  DISPATCH_STATUS,
  RESPONSE_STATUS,
  SERVICE_TYPE,
  ROLE,
  ESCORT_ONLINE_STATUS,
  ESCORT_WORK_STATUS,
  BIZ_CODE
};
