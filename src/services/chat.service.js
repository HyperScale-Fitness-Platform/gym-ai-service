const { callLLM } = require("../config/llm");
const { APP_KNOWLEDGE } = require("../knowledge/app-knowledge");
const chatModel = require("../models/chat.model");
const ragService = require("./rag.service");

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

  // Retrieve relevant equipment docs for this specific question.
  const relevantDocs = await ragService.retrieveRelevantDocs(userMessage);
  
  // Build a small context block from whatever was retrieved, only
  // included if something reasonably relevant was actually found.
  let ragContext = "";
  if (relevantDocs.length > 0 && relevantDocs[0].similarity > 0.5) {
    // 0.5 is a similarity THRESHOLD — below this, retrieved docs are
    // probably not actually relevant, and including them would just
    // confuse the model rather than help. Tune this value based on
    // testing with your actual embedding model.
    ragContext = "\n\nRELEVANT EQUIPMENT INFORMATION:\n" +
      relevantDocs.map(d => `- ${d.title}: ${d.content}`).join("\n");
  }

  const messages = [
    ...priorMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  
  let responseText;
  try {
    const data = await callLLM({ messages, systemPrompt: APP_KNOWLEDGE + ragContext});
  
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

/*
 * Get the customer's latest AI conversation.
 */
async function getChatHistory({ userId }) {
  const session = await chatModel.findLatestSession(userId);

  /*
   * Customer has never used the AI assistant.
   */
  if (!session) {
    return {
      sessionId: null,
      messages: [],
    };
  }

  const messages = await chatModel.getMessagesBySession(
    session.id
  );

  return {
    sessionId: session.id,
    messages,
  };
}

module.exports = { sendMessage, getChatHistory };