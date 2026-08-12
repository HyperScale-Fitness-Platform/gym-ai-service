const axios = require("axios");

const BASE_URL = process.env.LLM_BASE_URL;
const API_KEY = process.env.SBG_API_KEY;
const MODEL_ID = process.env.LLM_MODEL_ID;

async function callLLM({ messages, systemPrompt }, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        `${BASE_URL}/student/chat`,
        { model_id: MODEL_ID, messages, system_prompt: systemPrompt },
        { headers: { Authorization: `Bearer ${API_KEY}` }, timeout: 120000 }
      );
      return response.data;
    } catch (err) {
      const isLastAttempt = attempt === retries;
      const isNetworkError = err.code === "ENOTFOUND" || err.code === "ECONNRESET" || err.code === "ETIMEDOUT";

      if (isLastAttempt || !isNetworkError) {
        throw err;
        // Only retry on genuine NETWORK issues (DNS, connection reset,
        // timeout) — not on things like a 400 bad request, which would
        // fail identically every retry and just waste time.
      }

      console.warn(`LLM call failed (attempt ${attempt + 1}/${retries + 1}), retrying...`);
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      // Simple exponential-ish backoff: wait longer between each retry.
    }
  }
}

module.exports = { callLLM };