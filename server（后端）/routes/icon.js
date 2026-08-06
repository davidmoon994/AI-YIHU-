"use strict";

const express = require("express");
const router = express.Router();
const iconService = require("../services/iconService");
const { success } = require("../utils/response");

/**
 * GET /api/v1/icons?client=user|escort
 * 公开接口：小程序启动时获取图标配置
 * 返回 { iconKey: url, ... } 格式
 */
router.get("/", async (req, res, next) => {
  try {
    const client = req.query.client || "user";
    const icons = await iconService.getIconsForClient(client);
    return success(res, icons);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
