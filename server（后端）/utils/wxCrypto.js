"use strict";

const fs = require("fs");
const crypto = require("crypto");

/**
 * 验证微信回调请求签名（Wechatpay-Signature）
 * 平台证书需预先下载并配置路径，用于验证微信服务器发来的通知确实来自微信。
 * @param {string} timestamp Wechatpay-Timestamp 头
 * @param {string} nonce Wechatpay-Nonce 头
 * @param {string} body 原始请求体字符串
 * @param {string} signature Wechatpay-Signature 头（base64）
 */
function verifyNotifySignature(timestamp, nonce, body, signature) {
  const certPath = process.env.WX_PLATFORM_CERT_PATH;
  if (!certPath || !fs.existsSync(certPath)) {
    // 平台证书未配置时不允许放行，避免伪造回调被处理为真实支付结果
    return false;
  }
  const platformCert = fs.readFileSync(certPath, "utf8");
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(message);
  return verifier.verify(platformCert, signature, "base64");
}

/**
 * 解密回调中的 resource 字段（AEAD_AES_256_GCM）
 * @param {{ciphertext:string, nonce:string, associated_data:string}} resource
 */
function decryptResource(resource) {
  const apiV3Key = process.env.WX_API_V3_KEY;
  if (!apiV3Key) {
    throw new Error("WX_API_V3_KEY 未配置");
  }
  const { ciphertext, nonce, associated_data: associatedData } = resource;
  const buf = Buffer.from(ciphertext, "base64");
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(apiV3Key, "utf8"), Buffer.from(nonce, "utf8"));
  decipher.setAuthTag(authTag);
  if (associatedData) {
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
  }
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

module.exports = {
  verifyNotifySignature,
  decryptResource
};
