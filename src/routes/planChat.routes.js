const express = require("express");
const planChatController = require("../controllers/planChat.controller");

const router = express.Router();

router.post("/plans/chat", planChatController.planCoachChat);
router.get(
  "/plans/chat/history",
  planChatController.getPlanCoachHistory
);

module.exports = router;
