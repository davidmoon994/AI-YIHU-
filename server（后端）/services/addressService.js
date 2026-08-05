"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");

async function list(userId) {
  return db.query("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC", [userId]);
}

async function create(userId, payload) {
  const {
    receiverName, receiverPhone, province, city, district,
    detailAddress, latitude, longitude, isDefault
  } = payload;

  if (isDefault) {
    await db.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId]);
  }

  const result = await db.query(
    `INSERT INTO addresses
     (user_id, receiver_name, receiver_phone, province, city, district, detail_address, latitude, longitude, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, receiverName, receiverPhone, province, city, district, detailAddress, latitude || null, longitude || null, isDefault ? 1 : 0]
  );
  return { id: result.insertId };
}

async function update(userId, addressId, payload) {
  const rows = await db.query("SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1", [addressId, userId]);
  if (rows.length === 0) {
    throw new BizError(404, "地址不存在");
  }

  const allowed = ["receiver_name", "receiver_phone", "province", "city", "district", "detail_address", "latitude", "longitude", "is_default"];
  const map = {
    receiverName: "receiver_name",
    receiverPhone: "receiver_phone",
    detailAddress: "detail_address",
    isDefault: "is_default"
  };

  const updates = [];
  const params = [];
  for (const [key, value] of Object.entries(payload)) {
    const field = map[key] || key;
    if (allowed.includes(field)) {
      updates.push(`${field} = ?`);
      params.push(field === "is_default" ? (value ? 1 : 0) : value);
    }
  }
  if (updates.length === 0) {
    throw new BizError(400, "没有可更新的字段");
  }

  if (payload.isDefault) {
    await db.query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId]);
  }

  params.push(addressId, userId);
  await db.query(`UPDATE addresses SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND user_id = ?`, params);
  return { id: addressId };
}

async function remove(userId, addressId) {
  const result = await db.query("DELETE FROM addresses WHERE id = ? AND user_id = ?", [addressId, userId]);
  if (result.affectedRows === 0) {
    throw new BizError(404, "地址不存在");
  }
  return { id: addressId };
}

module.exports = { list, create, update, remove };
