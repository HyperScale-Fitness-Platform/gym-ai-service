const axios = require("axios");

const BASE_URL = "http://localhost:4006";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

async function post(path, body, userId) {
  return axios.post(`${BASE_URL}${path}`, body, {
    headers: { "user-id": userId },
    validateStatus: () => true,
    // validateStatus: () => true means axios won't THROW on 4xx/5xx —
    // we want to inspect error responses ourselves, not have them
    // treated as JS exceptions, since we're deliberately testing
    // failure cases too.
  });
}

async function runCase(label, fn) {
  console.log(`\n--- ${label} ---`);
  try {
    await fn();
  } catch (err) {
    console.error("TEST THREW:", err.message);
  }
}

async function main() {
  // 1. FEATURE KNOWLEDGE — one case per major feature area
  await runCase("Knows about booking", async () => {
    const res = await post("/ai/chat", { message: "How do I book a session?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  await runCase("Knows about membership freeze", async () => {
    const res = await post("/ai/chat", { message: "How do I freeze my membership?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  await runCase("Knows about community/find a buddy", async () => {
    const res = await post("/ai/chat", { message: "How do I find someone to train with?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  // 2. MEMORY — a real multi-turn conversation, checking context carries
  await runCase("Memory: follow-up referring to prior turn", async () => {
    const first = await post("/ai/chat", { message: "How do I reschedule a session?" }, USER_A);
    const sessionId = first.data.sessionId;
    console.log("Turn 1:", first.data.reply?.slice(0, 100));

    const second = await post("/ai/chat", { sessionId, message: "What if it's less than 24 hours away?" }, USER_A);
    console.log("Turn 2 (should reference rescheduling, not ask 'what is less than 24h away from what'):");
    console.log(second.data.reply?.slice(0, 200));
  });

  // 3. OFF-TOPIC — should redirect, not hallucinate a feature
  await runCase("Off-topic: unrelated question", async () => {
    const res = await post("/ai/chat", { message: "What's the capital of France?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  await runCase("Off-topic: general fitness (should answer briefly per prompt rules)", async () => {
    const res = await post("/ai/chat", { message: "Is it bad to work out on an empty stomach?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 150));
  });

  await runCase("Made-up feature: should NOT hallucinate", async () => {
    const res = await post("/ai/chat", { message: "How do I livestream my workout to friends?" }, USER_A);
    console.log(res.status, res.data.reply?.slice(0, 200));
    // manually eyeball: does it correctly say this isn't a feature,
    // rather than inventing plausible-sounding steps?
  });

  // 4. BAD INPUT / EDGE CASES
  await runCase("Empty message", async () => {
    const res = await post("/ai/chat", { message: "" }, USER_A);
    console.log("Expected 400:", res.status, res.data);
  });

  await runCase("Missing message field entirely", async () => {
    const res = await post("/ai/chat", {}, USER_A);
    console.log("Expected 400:", res.status, res.data);
  });

  await runCase("Wrong type (number instead of string)", async () => {
    const res = await post("/ai/chat", { message: 12345 }, USER_A);
    console.log("Expected 400:", res.status, res.data);
  });

  await runCase("Very long message (stress input size)", async () => {
    const longMessage = "How do I book a session? ".repeat(200);
    const res = await post("/ai/chat", { message: longMessage }, USER_A);
    console.log(res.status, res.data.reply ? "got a reply" : res.data);
  });

  await runCase("Missing user-id header entirely", async () => {
    const res = await axios.post(`${BASE_URL}/ai/chat`, { message: "hello" }, { validateStatus: () => true });
    console.log("Check behavior with no user identity:", res.status, res.data);
    // worth deciding: should this be a 400/401, or does it currently
    // silently proceed with userId = undefined? Good to know either way.
  });

  // 5. SESSION ISOLATION — user B must not access user A's session
  await runCase("Session isolation: different user, same sessionId", async () => {
    const first = await post("/ai/chat", { message: "This is a private question." }, USER_A);
    const sessionId = first.data.sessionId;

    const hijackAttempt = await post("/ai/chat", { sessionId, message: "trying to read someone else's session" }, USER_B);
    console.log("Expected 404 (session not found for this user):", hijackAttempt.status, hijackAttempt.data);
  });

  await runCase("Invalid/nonexistent sessionId", async () => {
    const res = await post("/ai/chat", { sessionId: "00000000-0000-0000-0000-000000000000", message: "hi" }, USER_A);
    console.log("Expected 404:", res.status, res.data);
  });

  console.log("\n--- All cases run. Review output above manually. ---");
}

main();