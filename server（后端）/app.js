"use strict";

require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const path = require("path");
const db = require("./db");
const logger = require("./utils/logger");
const { notFoundHandler, errorHandler } = require("./middleware/error");
const { initWebSocketServer } = require("./routes/wsServer");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const addressRoutes = require("./routes/address");
const patientRoutes = require("./routes/patient");
const orderRoutes = require("./routes/order");
const payRoutes = require("./routes/pay");
const dispatchRoutes = require("./routes/dispatch");
const escortRoutes = require("./routes/escort");
const aiRoutes = require("./routes/ai");
const messageRoutes = require("./routes/message");
const adminRoutes = require("./routes/admin");
const iconRoutes = require("./routes/icon");

const app = express();

// ===== 基础中间件 =====
app.use(cors());
app.use(
  express.json({
    limit: "2mb",
    // 保留原始请求体，供微信支付回调验签使用（验签必须基于未经解析的原文）
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// 访问日志：写入 access.log，同时保留 morgan 控制台输出（非生产环境）
app.use((req, res, next) => {
  logger.access(`${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
});
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ===== 路由挂载：统一前缀 /api/v1 =====
const API_PREFIX = "/api/v1";

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/user`, userRoutes);
app.use(`${API_PREFIX}/address`, addressRoutes);
app.use(`${API_PREFIX}/patient`, patientRoutes);
app.use(`${API_PREFIX}/order`, orderRoutes);
app.use(`${API_PREFIX}/pay`, payRoutes);
app.use(`${API_PREFIX}/dispatch`, dispatchRoutes);
app.use(`${API_PREFIX}/escort`, escortRoutes);
app.use(`${API_PREFIX}/ai`, aiRoutes);
app.use(`${API_PREFIX}/message`, messageRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/icons`, iconRoutes);

// 健康检查
app.get("/healthz", (req, res) => {
  res.status(200).json({ code: 0, message: "ok", data: { time: Date.now() } });
});

// ===== 后台管理面板（静态页面）=====
const ADMIN_DIR = path.join(__dirname, "..", "admin（后台）");
app.get("/admin", (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, "index.html"));
});

// 上传文件静态访问
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 默认图标静态访问
app.use("/default-icons", express.static(path.join(__dirname, "default-icons")));

// ===== 404 与全局错误处理（必须放在所有路由之后）=====
app.use(notFoundHandler);
app.use(errorHandler);

// ===== 启动服务：HTTP + WebSocket 共用同一端口 =====
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// WebSocket 挂载在 /ws 路径，与 07-WEBSOCKET.md 保持一致
initWebSocketServer(server);

async function bootstrap() {
  try {
    await db.testConnection();
    server.listen(PORT, () => {
      logger.info(`Server已启动，监听端口 ${PORT}`);
      console.log(`Escort System Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error(`服务启动失败: ${err.message}`);
    process.exit(1);
  }
}

// ===== 优雅退出，配合 09-DEPLOY.md 中 PM2 重启流程 =====
process.on("SIGINT", () => {
  logger.info("收到 SIGINT，服务正在关闭...");
  server.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  logger.info("收到 SIGTERM，服务正在关闭...");
  server.close(() => process.exit(0));
});
process.on("unhandledRejection", (reason) => {
  logger.error(`[unhandledRejection] ${reason && reason.stack ? reason.stack : reason}`);
});

bootstrap();

module.exports = app;
