"use strict";

const jwtUtil = require("../utils/jwt");
const { fail } = require("../utils/response");
const { ROLE } = require("../utils/constants");

/**
 * 校验JWT，将身份信息挂载到 req.user
 * 未登录直接返回 401
 */
function authenticate(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return fail(res, 401, "未登录");
  }

  try {
    const payload = jwtUtil.verify(token);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      communityId: payload.communityId
    };
    return next();
  } catch (err) {
    return fail(res, 401, "登录状态已过期，请重新登录");
  }
}

/**
 * 角色白名单校验，需在 authenticate 之后使用
 * @param  {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 401, "未登录");
    }
    if (!allowedRoles.includes(req.user.role)) {
      return fail(res, 403, "无权限访问该资源");
    }
    return next();
  };
}

/**
 * 数据隔离辅助：非超级管理员强制使用自己所属的 communityId，
 * 防止客户端传入其他社区ID越权查询（08-SECURITY.md 第七条）
 */
function enforceCommunityScope(req, res, next) {
  if (!req.user) {
    return fail(res, 401, "未登录");
  }
  if (req.user.role !== ROLE.SUPER_ADMIN) {
    req.query.communityId = req.user.communityId;
    req.body.communityId = req.user.communityId;
  }
  return next();
}

module.exports = {
  authenticate,
  requireRole,
  enforceCommunityScope
};
