"use strict";

const express = require("express");
const router = express.Router();
const ratingService = require("../services/ratingService");
const { success } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { requireBody, requireQuery } = require("../middleware/validator");

router.use(authenticate);

router.get("/detail", requireQuery(["orderId"]), async (req, res, next) => {
  try {
    return success(res, await ratingService.getRating(req.user.userId, req.query.orderId));
  } catch (err) { return next(err); }
});

router.post("/create", requireBody(["orderId", "score"]), async (req, res, next) => {
  try {
    return success(res, await ratingService.createRating(req.user.userId, req.body.orderId, req.body));
  } catch (err) { return next(err); }
});

module.exports = router;
