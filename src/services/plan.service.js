const { callLLM } = require("../config/llm");
const { NUTRITION_SYSTEM_PROMPT } = require("../knowledge/nutrition-knowledge");
const planModel = require("../models/plan.model");
const peopleClient = require("../clients/people.client");

async function generateNutritionPlan({ userId, dietaryPreferences, goal } = {}) {
  if (!userId) {
    throw { status: 400, message: "userId is required" };
  }

  // 1. Fetch user metrics (currently local dummy data, swaps to REST client later)
  const progressData = await peopleClient.getLatestProgress(userId);

  const userContext = {
    userMetrics: progressData || "No metric history available. Use standard healthy baseline.",
    dietaryPreferences: dietaryPreferences || "None / Standard",
    goal: goal || "General health and lean muscle gain",
  };

  const messages = [
    {
      role: "user",
      content: `Generate a customized nutrition plan for this client profile:\n${JSON.stringify(userContext, null, 2)}`,
    },
  ];

  let responseText;
  try {
    const data = await callLLM({
      messages,
      systemPrompt: NUTRITION_SYSTEM_PROMPT,
    });

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

  // Extract JSON payload safely from responseText
  let planJson;
  try {
    const cleanedText = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Fallback regex match if the model still surrounds JSON with text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    planJson = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText);
  } catch (parseErr) {
    console.error("Failed to parse LLM JSON output:", responseText);
    throw { status: 502, message: "Failed to generate structured plan format" };
  }

  // 2. Persist plan via plan model
  const savedPlan = await planModel.savePlan({
    userId,
    planType: "nutrition",
    content: planJson,
  });

  return {
    planId: savedPlan.id,
    createdAt: savedPlan.created_at,
    plan: planJson,
  };
}

/*
 * Get the customer's latest generated nutrition plan.
 */
async function getLatestNutritionPlan({ userId } = {}) {
  if (!userId) {
    throw { status: 400, message: "userId is required" };
  }

  const plan = await planModel.findLatestPlanByUser(userId, "nutrition");

  /*
   * Customer has never generated a nutrition plan.
   */
  if (!plan) {
    return {
      planId: null,
      plan: null,
    };
  }

  return {
    planId: plan.id,
    createdAt: plan.created_at,
    plan: plan.content,
  };
}

module.exports = {
  generateNutritionPlan,
  getLatestNutritionPlan,
};