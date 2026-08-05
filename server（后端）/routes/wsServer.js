"use strict";

const { WebSocketServer } = require("ws");
const url = require("url");
const jwtUtil = require("../utils/jwt");
const logger = require("../utils/logger");

const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const HEARTBEAT_TIMEOUT_MS = 90 * 1000;

// 房间：Map<roomName, Set<ws>>
const rooms = new Map();

function joinRoom(roomName, ws) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(ws);
}

function leaveRoom(roomName, ws) {
  const set = rooms.get(roomName);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(roomName);
  }
}

function buildMessage(event, data, code = 0, message = "success") {
  return JSON.stringify({ event, code, message, data, timestamp: Date.now() });
}

function sendToRoom(roomName, event, data) {
  const set = rooms.get(roomName);
  if (!set) return;
  const payload = buildMessage(event, data);
  for (const client of set) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

function sendToUser(userId, event, data) {
  sendToRoom(`user:${userId}`, event, data);
}

function sendToEscort(escortId, event, data) {
  sendToRoom(`escort:${escortId}`, event, data);
}

function sendToCommunity(communityId, event, data) {
  sendToRoom(`community:${communityId}`, event, data);
}

function sendToAdmin(event, data) {
  sendToRoom("admin", event, data);
}

/**
 * 初始化 WebSocket 服务器，挂载到 /ws 路径
 */
function initWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const { pathname, query } = url.parse(request.url, true);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const token = query.token;
    if (!token) {
      logger.websocket("[WS REJECT] 缺少token");
      socket.destroy();
      return;
    }

    let payload;
    try {
      payload = jwtUtil.verify(token);
    } catch (err) {
      logger.websocket(`[WS REJECT] token无效: ${err.message}`);
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.identity = payload; // { userId, role, communityId }
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    const { userId, role, communityId } = ws.identity;
    ws.isAlive = true;

    // 加入身份房间与社区房间（社区隔离，08-SECURITY.md 十五条）
    if (role === "ESCORT") {
      joinRoom(`escort:${userId}`, ws);
    } else if (role === "SUPER_ADMIN" || role === "COMMUNITY_ADMIN") {
      joinRoom("admin", ws);
    } else {
      joinRoom(`user:${userId}`, ws);
    }
    if (communityId) {
      joinRoom(`community:${communityId}`, ws);
    }

    logger.websocket(`[WS CONNECT] role=${role} userId=${userId} communityId=${communityId}`);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === "system.ping") {
          ws.send(buildMessage("system.pong", {}));
          ws.isAlive = true;
        }
        // 其余业务事件（如陪诊员位置上报）统一走HTTP接口写库后由Service推送，
        // WS消息通道本身不直接承载业务写操作，避免Route/Service分层被绕过。
      } catch (err) {
        logger.websocket(`[WS MESSAGE PARSE ERROR] ${err.message}`);
      }
    });

    ws.on("close", () => {
      leaveRoom(`user:${userId}`, ws);
      leaveRoom(`escort:${userId}`, ws);
      leaveRoom("admin", ws);
      if (communityId) leaveRoom(`community:${communityId}`, ws);
      logger.websocket(`[WS DISCONNECT] role=${role} userId=${userId}`);
    });

    ws.on("error", (err) => {
      logger.websocket(`[WS ERROR] userId=${userId} ${err.message}`);
    });
  });

  // 心跳检测：清理失效连接
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(heartbeatInterval));

  logger.info("WebSocket 服务器已挂载到 /ws");
  return wss;
}

module.exports = {
  initWebSocketServer,
  sendToUser,
  sendToEscort,
  sendToCommunity,
  sendToAdmin
};
