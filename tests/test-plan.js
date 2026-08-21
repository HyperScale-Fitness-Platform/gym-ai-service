const axios = require("axios");

const BASE_URL = "http://localhost:4006";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

async function post(path, body, userId) {
  return axios.post(`${BASE_URL}${path}`, body, {
    headers: { "user-id": userId },
    validateStatus: () => true,
  });
}

async function get(path, userId) {
  return axios.get(`${BASE_URL}${path}`, {
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
}

async function main() {
  // 1. INITIAL STATE — brand new user should have no saved plan
  await runCase("GET latest plan for brand new user (USER_B)", async () => {
    const res = await get("/ai/plans/nutrition/latest", USER_B);
    console.log("Status:", res.status);
    console.log("Expected null planId:", res.data);
  });

  // 2. SUCCESSFUL GENERATION — standard payload
  let generatedPlanId = null;

  await runCase("POST /ai/plans/nutrition with standard goal and preferences (USER_A)", async () => {
    const payload = {
      goal: "Fat loss and lean muscle preservation",
      dietaryPreferences: "High protein, low carb, no shellfish",
    };

    const res = await post("/ai/plans/nutrition", payload, USER_A);
    console.log("Status:", res.status);

    if (res.status === 201) {
      generatedPlanId = res.data.planId;
      console.log("Generated Plan ID:", generatedPlanId);
      console.log("Title:", res.data.plan?.title);
      console.log("Summary:", res.data.plan?.summary?.slice(0, 120) + "...");
      console.log("Daily Targets:", res.data.plan?.dailyTargets);
      console.log("Meals Count:", res.data.plan?.meals?.length);
      console.log("Response:\n", JSON.stringify(res.data.plan, null, 2));
    } else {
      console.log("Error details:", res.data);
    }
  });

  // 3. FETCH LATEST PLAN — should reflect the generated plan
  await runCase("GET /ai/plans/nutrition/latest for USER_A (should return saved plan)", async () => {
    const res = await get("/ai/plans/nutrition/latest", USER_A);
    console.log("Status:", res.status);
    console.log("Matches generated Plan ID:", res.data.planId === generatedPlanId);
    console.log("Plan Title:", res.data.plan?.title);
    console.log("Calories Target:", res.data.plan?.dailyTargets?.calories);
  });

  // 4. USER ISOLATION — USER_B must not see USER_A's latest plan
  await runCase("User Isolation: USER_B gets latest plan after USER_A generated one", async () => {
    const res = await get("/ai/plans/nutrition/latest", USER_B);
    console.log("Status:", res.status);
    console.log("USER_B planId (must still be null):", res.data.planId);
  });

  // 5. OPTIONAL / DEFAULT PARAMETERS — generating with empty body
  await runCase("POST /ai/plans/nutrition with empty body {} (uses defaults)", async () => {
    const res = await post("/ai/plans/nutrition", {}, USER_A);
    console.log("Status:", res.status);
    console.log("Plan generated successfully:", Boolean(res.data.planId));
    console.log("Title:", res.data.plan?.title);
    console.log("New latest Plan ID:", res.data.planId);
  });

  // 6. VERIFY LATEST REPLACED — newest generation becomes the latest record
  await runCase("GET /ai/plans/nutrition/latest returns the most recent record", async () => {
    const res = await get("/ai/plans/nutrition/latest", USER_A);
    console.log("Status:", res.status);
    console.log("Latest Plan ID differs from first generation:", res.data.planId !== generatedPlanId);
  });

  // 7. EDGE CASES & HEADERS
  await runCase("Missing user ID header", async () => {
    const res = await post("/ai/plans/nutrition", { goal: "Bulk" }, null);
    console.log("Status with missing user ID:", res.status, res.data);
  });

  console.log("\n--- All nutrition plan test cases completed. ---");
}

main();