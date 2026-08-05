"use strict";

const logger = require("../utils/logger");
const { fail } = require("../utils/response");

/**
 * 业务异常类，Service层主动抛出，携带业务code
 */
class BizError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BizError";
    this.code = code;
  }
}

/**
 * 404 处理（放在所有路由之后）
 */
function notFoundHandler(req, res) {
  return fail(res, 404, `接口不存在: ${req.method} ${req.originalUrl}`);
}

/**
 * 全局错误处理中间件（必须放在 app.use 链的最后）
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof BizError) {
    logger.warn(`[BIZ ERROR] ${err.code} ${err.message} | ${req.method} ${req.originalUrl}`);
    return fail(res, err.code, err.message);
  }

  logger.error(`[UNHANDLED ERROR] ${err.stack || err.message} | ${req.method} ${req.originalUrl}`);
  return fail(res, 500, "服务器内部错误");
}

module.exports = {
  BizError,
  notFoundHandler,
  errorHandler
};
