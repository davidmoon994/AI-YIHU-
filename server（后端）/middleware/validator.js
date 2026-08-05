"use strict";

const { fail } = require("../utils/response");

/**
 * 生成参数必填校验中间件
 * @param {string[]} fields 必填字段名（从 req.body 中取）
 */
function requireBody(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => {
      const v = req.body ? req.body[f] : undefined;
      return v === undefined || v === null || v === "";
    });
    if (missing.length > 0) {
      return fail(res, 400, `缺少必填参数: ${missing.join(", ")}`);
    }
    return next();
  };
}

/**
 * 生成 query 参数必填校验中间件
 */
function requireQuery(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => {
      const v = req.query ? req.query[f] : undefined;
      return v === undefined || v === null || v === "";
    });
    if (missing.length > 0) {
      return fail(res, 400, `缺少必填参数: ${missing.join(", ")}`);
    }
    return next();
  };
}

module.exports = {
  requireBody,
  requireQuery
};
