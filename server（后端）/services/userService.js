"use strict";

const axios = require("axios");
const dayjs = require("dayjs");
const db = require("../db");
const jwtUtil = require("../utils/jwt");
const logger = require("../utils/logger");
const { BizError } = require("../middleware/error");
const { ROLE, BIZ_CODE } = require("../utils/constants");

const DEFAULT_COMMUNITY_ID = Number(process.env.DEFAULT_COMMUNITY_ID || 1);

/**
 * 调用微信 code2Session 接口换取 openid/unionid
 */
async function code2Session(code) {
  const url = "https://api.weixin.qq.com/sns/jscode2session";
  const { data } = await axios.get(url, {
    params: {
      appid: process.env.WX_APPID,
      secret: process.env.WX_SECRET,
      js_code: code,
      grant_type: "authorization_code"
    }
  });
  if (data.errcode) {
    logger.error(`[WX LOGIN ERROR] ${data.errcode} ${data.errmsg}`);
    throw new BizError(422, "微信登录校验失败");
  }
  return data; // { openid, unionid, session_key }
}

/**
 * 微信登录：不存在则创建用户，返回 token + 用户信息
 */
async function loginByWechat(code) {
  const { openid, unionid } = await code2Session(code);

  let users = await db.query("SELECT * FROM users WHERE openid = ? LIMIT 1", [openid]);
  let user = users[0];

  if (!user) {
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const result = await db.query(
      `INSERT INTO users (openid, unionid, status, community_id, last_login_at, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, ?)`,
      [openid, unionid || null, DEFAULT_COMMUNITY_ID, now, now, now]
    );
    users = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [result.insertId]);
    user = users[0];
  } else {
    if (user.status === 0) {
      throw new BizError(403, "账号已被禁用");
    }
    await db.query("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?", [user.id]);
  }

  const token = jwtUtil.sign({
    userId: user.id,
    role: ROLE.USER,
    communityId: user.community_id
  });

  return {
    token,
    user: sanitizeUser(user)
  };
}

async function getProfile(userId) {
  const rows = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
  if (rows.length === 0) {
    throw new BizError(BIZ_CODE.USER_NOT_FOUND, "用户不存在");
  }
  return sanitizeUser(rows[0]);
}

async function updateProfile(userId, payload) {
  const allowedFields = ["nickname", "avatar", "gender", "real_name", "phone"];
  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(payload[field]);
    }
  }

  if (updates.length === 0) {
    throw new BizError(400, "没有可更新的字段");
  }

  params.push(userId);
  await db.query(`UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
  return getProfile(userId);
}

/**
 * 敏感字段脱敏（08-SECURITY.md 第十二条）
 */
function sanitizeUser(user) {
  const safe = { ...user };
  if (safe.phone) {
    safe.phone = safe.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
  }
  return safe;
}

module.exports = {
  loginByWechat,
  getProfile,
  updateProfile
};
