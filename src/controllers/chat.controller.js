const chatService = require("../services/chat.service");

async function chat(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId, message } = req.body;
    // sessionId is OPTIONAL — omit it to start a new conversation,
    // include it (from a previous response) to continue one.

    const result = await chatService.sendMessage({
      userId,
      sessionId,
      userMessage: message,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { chat };