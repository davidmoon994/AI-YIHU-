"use strict";

const express = require("express");
const router = express.Router();

const userService = require("../services/userService");
const { success } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

// GET /api/v1/user/profile
router.get("/profile", async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.userId);
    return success(res, profile);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/v1/user/profile
router.put("/profile", async (req, res, next) => {
  try {
    const profile = await userService.updateProfile(req.user.userId, req.body);
    return success(res, profile);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
