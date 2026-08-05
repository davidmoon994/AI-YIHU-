"use strict";

const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * 签发Token
 * @param {{userId:number, role:string, communityId:number}} payload
 */
function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * 校验Token，失败抛出异常
 */
function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = {
  sign,
  verify
};
