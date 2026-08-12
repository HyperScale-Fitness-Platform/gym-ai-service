const { callLLM } = require("../config/llm");
const { APP_KNOWLEDGE } = require("../knowledge/app-knowledge");
const chatModel = require("../models/chat.model");

async function sendMessage({ userId, sessionId, userMessage }) {
  if (!userMessage || typeof userMessage !== "string") {
    throw { status: 400, message: "userMessage is required and must be a string" };
  }

  let session;
  if (sessionId) {
    session = await chatModel.findSessionById(sessionId, userId);
    if (!session) {
      throw { status: 404, message: "Chat session not found" };
    }
  } else {
    session = await chatModel.createSession(userId);
  }

  const priorMessages = await chatModel.getMessagesBySession(session.id, 20);

  // Their API's message shape is just { role, content } — same as
  // OpenAI's format, EXCEPT system prompt is passed separately, not as
  // a message in this array. Roles here should be "user" / "assistant".
  const messages = [
    ...priorMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  
  let responseText;
  try {
    const data = await callLLM({ messages, systemPrompt: APP_KNOWLEDGE });
  
    responseText = data.output_text;
  
    if (!responseText) {
      throw new Error("Could not find reply text in LLM response shape");
    }

    console.log(
    `[ai-service] tokens: ${data.usage.total_tokens}, cost: $${data.actual_cost_usd}`
    );
    
  } catch (err) {
    console.error("LLM API error:", err.response?.data || err.message);
    throw { status: 502, message: "AI service is temporarily unavailable" };
  }

  await chatModel.addMessage(session.id, "user", userMessage);
  await chatModel.addMessage(session.id, "assistant", responseText);

  return { sessionId: session.id, reply: responseText };
}

module.exports = { sendMessage };