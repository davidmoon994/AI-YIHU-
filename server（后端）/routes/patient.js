"use strict";

const express = require("express");
const router = express.Router();

const patientService = require("../services/patientService");
const { success } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { requireBody, requireQuery } = require("../middleware/validator");

router.use(authenticate);

router.get("/list", async (req, res, next) => {
  try {
    const list = await patientService.list(req.user.userId);
    return success(res, list);
  } catch (err) {
    return next(err);
  }
});

router.post("/create", requireBody(["name"]), async (req, res, next) => {
  try {
    const result = await patientService.create(req.user.userId, req.body);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.put("/update", requireBody(["id"]), async (req, res, next) => {
  try {
    const { id, ...payload } = req.body;
    const result = await patientService.update(req.user.userId, id, payload);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

router.delete("/delete", requireQuery(["id"]), async (req, res, next) => {
  try {
    const result = await patientService.remove(req.user.userId, req.query.id);
    return success(res, result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
