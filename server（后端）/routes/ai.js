"use strict";

const express = require("express");
const router = express.Router();

const aiService = require("../services/aiService");
const { success } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { requireBody } = require("../middleware/validator");

router.use(authenticate);

router.post("/chat", requireBody(["message"]), async (req, res, next) => {
  try {
    const result = await aiService.chat(req.user.userId, req.body.message);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/planning", requireBody(["description"]), async (req, res, next) => {
  try {
    const result = await aiService.planning(req.user.userId, req.body.description);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/department", requireBody(["description"]), async (req, res, next) => {
  try {
    const result = await aiService.departmentRecommend(req.user.userId, req.body.description);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.post("/check", requireBody(["checkType"]), async (req, res, next) => {
  try {
    const result = await aiService.checkProcess(req.user.userId, req.body.checkType);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
