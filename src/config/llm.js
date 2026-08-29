const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL_ID = process.env.GROQ_MODEL;

async function callLLM({ messages, systemPrompt }) {
  try {
    const formattedMessages = [
      { role: "system", content: systemPrompt || "" },
      ...messages.map((m) => ({
        role: m.role === "model" ? "assistant" : m.role,
        content: m.content,
      })),
    ];

    const chatCompletion = await groq.chat.completions.create({
      model: MODEL_ID,
      messages: formattedMessages,
      temperature: 0.3,
    });

    const reply = chatCompletion.choices[0]?.message?.content || "";
    const totalTokens = chatCompletion.usage?.total_tokens || 0;

    return {
      output_text: reply,
      usage: {
        total_tokens: totalTokens,
      },
      actual_cost_usd: 0,
    };
  } catch (err) {
    console.error("Groq API error:", err.message);
    throw { status: 502, message: "AI service is temporarily unavailable" };
  }
}

module.exports = { callLLM };