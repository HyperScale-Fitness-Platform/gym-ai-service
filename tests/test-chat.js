const axios = require("axios");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BASE_URL = "http://localhost:4006";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

async function post(path, body, userId) {
  return axios.post(`${BASE_URL}${path}`, body, {
    headers: { "user-id": userId },
    validateStatus: () => true,
  });
}

async function runCase(label, fn) {
  console.log(`\n--- ${label} ---`);
  try {
    await fn();
  } catch (err) {
    console.error("TEST THREW:", err.message);
  }
  await sleep(1500); // Respect free-tier rate limits
}

async function main() {
  // ==========================================
  // 1. RAG EQUIPMENT & SEMANTIC SEARCH TESTS
  // ==========================================

  await runCase("RAG: Direct equipment usage instructions (Leg Press)", async () => {
    const res = await post("/ai/chat", { message: "How do I use the leg press machine?" }, USER_A);
    console.log("Status:", res.status);
    console.log("Reply:", res.data.reply);
  });

  await runCase("RAG: Semantic muscle-to-machine matching (Hamstrings)", async () => {
    // Tests whether semantic search surfaces Leg Curl / Leg Press without matching exact words
    const res = await post("/ai/chat", { message: "Which machine should I use if I want to target my hamstrings?" }, USER_A);
    console.log("Status:", res.status);
    console.log("Reply:", res.data.reply);
  });

  await runCase("RAG: Equipment safety & form cues (Smith Machine / Row)", async () => {
    const res = await post("/ai/chat", { message: "What are the safety steps for the smith machine?" }, USER_A);
    console.log("Status:", res.status);
    console.log("Reply:", res.data.reply);
  });

  await runCase("RAG: Cardio equipment guidance (StairMaster)", async () => {
    const res = await post("/ai/chat", { message: "How do I properly use the StairMaster without hurting my back?" }, USER_A);
    console.log("Status:", res.status);
    console.log("Reply:", res.data.reply);
  });

  await runCase("RAG: Query for non-existent equipment in docs (Cryo Chamber)", async () => {
    // Should fall back gracefully without hallucinating ungrounded manual steps
    const res = await post("/ai/chat", { message: "How do I operate the whole-body cryotherapy chamber?" }, USER_A);
    console.log("Status:", res.status);
    console.log("Reply:", res.data.reply);
  });

  // ==========================================
  // 2. CORE APP FEATURE KNOWLEDGE
  // ==========================================

  await runCase("Feature: Booking flow", async () => {
    const res = await post("/ai/chat", { message: "How do I book a session?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  await runCase("Feature: Membership freeze", async () => {
    const res = await post("/ai/chat", { message: "How do I freeze my membership?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  await runCase("Feature: Community & finding a workout partner", async () => {
    const res = await post("/ai/chat", { message: "How do I find someone to train with?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  // ==========================================
  // 3. CONVERSATIONAL MEMORY & RAG CONTEXT
  // ==========================================

  await runCase("Memory: Multi-turn booking flow", async () => {
    const first = await post("/ai/chat", { message: "How do I reschedule a session?" }, USER_A);
    const sessionId = first.data?.sessionId;
    console.log("Turn 1:", first.data?.reply?.slice(0, 100));

    const second = await post("/ai/chat", { sessionId, message: "What if it's less than 24 hours away?" }, USER_A);
    console.log("Turn 2:", second.data?.reply?.slice(0, 200));
  });

  await runCase("Memory: Multi-turn equipment follow-up", async () => {
    const first = await post("/ai/chat", { message: "What muscles does the lat pulldown work?" }, USER_A);
    const sessionId = first.data?.sessionId;
    console.log("Turn 1 (Lat pulldown):", first.data?.reply?.slice(0, 120));

    const second = await post("/ai/chat", { sessionId, message: "Can you give me the step-by-step form cues for it?" }, USER_A);
    console.log("Turn 2 (Context retained):", second.data?.reply?.slice(0, 200));
  });

  // ==========================================
  // 4. OFF-TOPIC & GUARDRAILS
  // ==========================================

  await runCase("Off-topic: Unrelated trivia", async () => {
    const res = await post("/ai/chat", { message: "What's the capital of France?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  await runCase("Off-topic: General fitness query", async () => {
    const res = await post("/ai/chat", { message: "Is it bad to work out on an empty stomach?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  await runCase("Made-up feature guardrail", async () => {
    const res = await post("/ai/chat", { message: "How do I livestream my workout to friends?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 200));
  });

  // ==========================================
  // 5. INPUT VALIDATION & SECURITY ISOLATION
  // ==========================================

  await runCase("Bad Input: Empty message", async () => {
    const res = await post("/ai/chat", { message: "" }, USER_A);
    console.log("Expected 400:", res.status, res.data);
  });

  await runCase("Bad Input: Missing body payload", async () => {
    const res = await post("/ai/chat", {}, USER_A);
    console.log("Expected 400:", res.status, res.data);
  });

  await runCase("Bad Input: Number instead of string", async () => {
    const res = await post("/ai/chat", { message: 12345 }, USER_A);
    console.log("Expected 400:", res.status, res.data);
  });

  await runCase("Stress Test: Very long input message", async () => {
    const longMessage = "How do I use the leg press machine? ".repeat(150);
    const res = await post("/ai/chat", { message: longMessage }, USER_A);
    console.log("Status:", res.status, res.data.reply ? "Got a valid response" : res.data);
  });

  await runCase("Security: Missing user-id header", async () => {
    const res = await axios.post(`${BASE_URL}/ai/chat`, { message: "hello" }, { validateStatus: () => true });
    console.log("Expected 401:", res.status, res.data);
  });

  await runCase("Security: Cross-tenant session hijack attempt", async () => {
    const first = await post("/ai/chat", { message: "This is my private session." }, USER_A);
    const sessionId = first.data?.sessionId;

    const hijackAttempt = await post("/ai/chat", { sessionId, message: "Reading another user session" }, USER_B);
    console.log("Expected 404:", hijackAttempt.status, hijackAttempt.data);
  });

  await runCase("Edge Case: Non-existent UUID session", async () => {
    const res = await post("/ai/chat", { sessionId: "00000000-0000-0000-0000-000000000000", message: "hi" }, USER_A);
    console.log("Expected 404:", res.status, res.data);
  });

  console.log("\n--- All test cases executed. ---");
}

main();