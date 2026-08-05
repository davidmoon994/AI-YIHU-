"use strict";

const express = require("express");
const router = express.Router();

const userService = require("../services/userService");
const { success } = require("../utils/response");
const { requireBody } = require("../middleware/validator");

// POST /api/v1/auth/login
router.post("/login", requireBody(["code"]), async (req, res, next) => {
  try {
    const result = await userService.loginByWechat(req.body.code);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
