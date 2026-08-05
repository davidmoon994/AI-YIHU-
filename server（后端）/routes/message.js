"use strict";

const express = require("express");
const router = express.Router();

const messageService = require("../services/messageService");
const { success, successPage } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { requireQuery } = require("../middleware/validator");
const { ROLE } = require("../utils/constants");

router.use(authenticate);

function userTypeOf(req) {
  return req.user.role === ROLE.ESCORT ? "escort" : "user";
}

router.get("/list", async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const { list, total } = await messageService.list(userTypeOf(req), req.user.userId, { page, pageSize });
    return successPage(res, list, page, pageSize, total);
  } catch (err) {
    return next(err);
  }
});

router.get("/detail", requireQuery(["messageId"]), async (req, res, next) => {
  try {
    const detail = await messageService.detail(userTypeOf(req), req.user.userId, req.query.messageId);
    return success(res, detail);
  } catch (err) {
    return next(err);
  }
});

router.post("/read/all", async (req, res, next) => {
  try {
    const result = await messageService.readAll(userTypeOf(req), req.user.userId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.delete("/delete", requireQuery(["messageId"]), async (req, res, next) => {
  try {
    const result = await messageService.remove(userTypeOf(req), req.user.userId, req.query.messageId);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
