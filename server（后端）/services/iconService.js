"use strict";

const db = require("../db");
const { BizError } = require("../middleware/error");
const path = require("path");
const fs = require("fs");

/**
 * 获取图标列表（按分类/客户端筛选）
 */
async function listIcons({ category, client }) {
  let sql = "SELECT * FROM icons WHERE 1=1";
  const params = [];
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (client) { sql += " AND client = ?"; params.push(client); }
  sql += " ORDER BY client ASC, icon_key ASC";
  return db.query(sql, params);
}

/**
 * 获取单个图标
 */
async function getIcon(iconKey) {
  const rows = await db.query("SELECT * FROM icons WHERE icon_key = ? LIMIT 1", [iconKey]);
  if (rows.length === 0) throw new BizError(404, "图标不存在");
  return rows[0];
}

/**
 * 上传替换图标（admin 操作）
 * 更新 file_path 字段，指向上传后的文件
 */
async function uploadIcon(iconKey, filePath) {
  const result = await db.query(
    "UPDATE icons SET file_path = ?, updated_at = NOW() WHERE icon_key = ?",
    [filePath, iconKey]
  );
  if (result.affectedRows === 0) throw new BizError(404, "图标不存在");
  return { iconKey, filePath };
}

/**
 * 删除自定义图标文件，恢复使用默认图标
 */
async function resetIcon(iconKey) {
  const icon = await getIcon(iconKey);
  // 删除自定义文件
  if (icon.file_path) {
    const fullPath = path.join(__dirname, "..", icon.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
  await db.query("UPDATE icons SET file_path = NULL, updated_at = NOW() WHERE icon_key = ?", [iconKey]);
  return { iconKey };
}

/**
 * 公开 API：获取指定客户端的图标配置（供小程序调用）
 * 返回 { iconKey: url, ... } 格式
 */
async function getIconsForClient(client) {
  const rows = await db.query(
    "SELECT icon_key, file_path, default_path FROM icons WHERE client = ? OR client = 'common'",
    [client]
  );
  const icons = {};
  for (const row of rows) {
    // 优先使用自定义上传的图标，否则使用默认图标
    icons[row.icon_key] = row.file_path || row.default_path;
  }
  return icons;
}

module.exports = {
  listIcons,
  getIcon,
  uploadIcon,
  resetIcon,
  getIconsForClient
};
