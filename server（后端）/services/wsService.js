"use strict";

const wsServer = require("../routes/wsServer");
const messageService = require("./messageService");

/**
 * 通知用户订单相关事件，同时落库为可查看的消息记录
 */
async function notifyUserOrderEvent(userId, event, data) {
  wsServer.sendToUser(userId, event, data);
  const titleMap = {
    "order.pay": "支付成功",
    "escort.accept": "陪诊员已接单",
    "escort.arrive": "陪诊员已到达",
    "escort.start": "服务已开始",
    "escort.finish": "服务已完成"
  };
  const title = titleMap[event] || "订单状态更新";
  await messageService.createMessage("user", userId, title, JSON.stringify(data), "order_notice").catch(() => {});
}

function notifyEscort(escortId, event, data) {
  wsServer.sendToEscort(escortId, event, data);
}

function notifyAdmin(event, data) {
  wsServer.sendToAdmin(event, data);
}

function notifyCommunity(communityId, event, data) {
  wsServer.sendToCommunity(communityId, event, data);
}

module.exports = {
  notifyUserOrderEvent,
  notifyEscort,
  notifyAdmin,
  notifyCommunity
};
