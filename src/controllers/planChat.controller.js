const planChatService = require("../services/planChat.service");

async function planCoachChat(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "user-id header is required",
      });
    }

    const { sessionId, message } = req.body || {};

    if (
      !message ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        message:
          "message is required and must be a non-empty string",
      });
    }

    const result =
      await planChatService.sendPlanCoachMessage({
        userId,
        sessionId,
        userMessage: message.trim(),
      });

    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res
        .status(error.status)
        .json({ message: error.message });
    }

    next(error);
  }
}

async function getPlanCoachHistory(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "user-id header is required",
      });
    }

    const result =
      await planChatService.getPlanCoachHistory({
        userId,
      });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  planCoachChat,
  getPlanCoachHistory,
};
