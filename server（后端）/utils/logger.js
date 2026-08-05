"use strict";

const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");

const LOG_DIR = path.join(__dirname, "..", "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLine(filename, level, message) {
  const time = dayjs().format("YYYY-MM-DD HH:mm:ss.SSS");
  const line = `[${time}] [${level}] ${message}\n`;
  fs.appendFile(path.join(LOG_DIR, filename), line, (err) => {
    if (err) {
      // 日志写入失败时降级输出到控制台，不允许静默吞掉
      console.error("日志写入失败:", err.message);
    }
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(line.trim());
  }
}

const logger = {
  info(message) {
    writeLine("system.log", "INFO", message);
  },
  warn(message) {
    writeLine("system.log", "WARN", message);
  },
  error(message) {
    writeLine("error.log", "ERROR", message);
  },
  access(message) {
    writeLine("access.log", "ACCESS", message);
  },
  payment(message) {
    writeLine("payment.log", "PAYMENT", message);
  },
  dispatch(message) {
    writeLine("dispatch.log", "DISPATCH", message);
  },
  websocket(message) {
    writeLine("websocket.log", "WS", message);
  }
};

module.exports = logger;
