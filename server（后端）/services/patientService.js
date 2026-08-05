"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");

async function list(userId) {
  return db.query("SELECT * FROM patient_profiles WHERE user_id = ? ORDER BY is_default DESC, id DESC", [userId]);
}

async function create(userId, payload) {
  const { name, gender, birthday, idCard, phone, relationship, isDefault } = payload;

  if (isDefault) {
    await db.query("UPDATE patient_profiles SET is_default = 0 WHERE user_id = ?", [userId]);
  }

  const result = await db.query(
    `INSERT INTO patient_profiles
     (user_id, name, gender, birthday, id_card, phone, relationship, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, name, gender || null, birthday || null, idCard || null, phone || null, relationship || null, isDefault ? 1 : 0]
  );
  return { id: result.insertId };
}

async function update(userId, patientId, payload) {
  const rows = await db.query("SELECT * FROM patient_profiles WHERE id = ? AND user_id = ? LIMIT 1", [patientId, userId]);
  if (rows.length === 0) {
    throw new BizError(404, "就诊人不存在");
  }

  const map = { idCard: "id_card", isDefault: "is_default" };
  const allowed = ["name", "gender", "birthday", "id_card", "phone", "relationship", "is_default"];

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
    await db.query("UPDATE patient_profiles SET is_default = 0 WHERE user_id = ?", [userId]);
  }

  params.push(patientId, userId);
  await db.query(`UPDATE patient_profiles SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND user_id = ?`, params);
  return { id: patientId };
}

async function remove(userId, patientId) {
  const result = await db.query("DELETE FROM patient_profiles WHERE id = ? AND user_id = ?", [patientId, userId]);
  if (result.affectedRows === 0) {
    throw new BizError(404, "就诊人不存在");
  }
  return { id: patientId };
}

module.exports = { list, create, update, remove };
