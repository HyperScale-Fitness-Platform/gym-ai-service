const chatModel = require("../models/chat.model");
const planHistoryModel = require("../models/planHistory.model");
const { callLLM } = require("../config/llm");
const {
  PLAN_COACH_SYSTEM_PROMPT,
} = require("../knowledge/plan-coach-knowledge");

const HISTORY_CONTEXT_LIMIT = 3;
const PRIOR_MESSAGES_LIMIT = 20;

/*
 * Bare confirmations/fillers after a draft was already
 * delivered are answered deterministically — never sent to
 * the LLM, which would otherwise regenerate the plans.
 */
const BARE_CONFIRMATION_PATTERN =
  /^(yes|yeah|yep|yup|ok|okay|done|great|perfect|nice|good|thanks|thank you|thx|go|go ahead|sure|next|what next|whats next|what's next|are you done|you done|add them|add it|do it)[\s!.?]*$/i;

const CONFIRMATION_REPLY =
  'Perfect — your plans are ready above. Press the green "Add to my plans" button to save them to your Progress page.';

function summarizeExercisePlan(plan) {
  return {
    name: plan.plan_name,
    startDate: plan.start_date,
    endDate: plan.end_date || null,
    source: plan.source || null,
    notes: plan.notes || null,
    exercises: (plan.exercises || []).map((ex) => ({
      exercise: ex.exercise_name,
      machine: ex.machine_name,
      sets: ex.sets,
      reps: ex.reps,
      weightKg: ex.weight_kg ?? null,
    })),
  };
}

function summarizeNutritionPlan(plan) {
  return {
    name: plan.plan_name,
    startDate: plan.start_date,
    endDate: plan.end_date || null,
    source: plan.generated_by || null,
    goal: plan.goal || null,
    targets: {
      calories: plan.daily_calorie_target,
      proteinG: plan.daily_protein_target_g,
      carbsG: plan.daily_carbohydrate_target_g,
      fatG: plan.daily_fat_target_g,
    },
    meals: (plan.meals || []).map((meal) => ({
      meal: meal.meal_name,
      foods: meal.foods || [],
    })),
  };
}

async function buildHistoryContext(userId) {
  const [exerciseHistory, nutritionHistory] =
    await Promise.all([
      planHistoryModel.getExerciseHistory(
        userId,
        HISTORY_CONTEXT_LIMIT,
      ),
      planHistoryModel.getNutritionHistory(
        userId,
        HISTORY_CONTEXT_LIMIT,
      ),
    ]);

  if (
    exerciseHistory.length === 0 &&
    nutritionHistory.length === 0
  ) {
    return {
      hasHistory: false,
      contextBlock:
        "PLAN HISTORY: none. The customer is new — run the questionnaire before generating plans.",
      exerciseCount: 0,
      nutritionCount: 0,
    };
  }

  const contextBlock =
    "PLAN HISTORY (most recent first):\n" +
    JSON.stringify(
      {
        exercisePlans: exerciseHistory.map(
          summarizeExercisePlan,
        ),
        nutritionPlans: nutritionHistory.map(
          summarizeNutritionPlan,
        ),
      },
      null,
      2,
    );

  return {
    hasHistory: true,
    contextBlock,
    exerciseCount: exerciseHistory.length,
    nutritionCount: nutritionHistory.length,
  };
}

/*
 * Extracts the fenced {"draft": {...}} block from a reply
 * when the coach decides plans are ready.
 */
function extractDraft(replyText) {
  const match = replyText.match(
    /```json\s*([\s\S]*?)```/i,
  );

  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1].trim());

    if (!parsed || !parsed.draft) {
      return null;
    }

    const { exercisePlan, nutritionPlan } = parsed.draft;

    if (!exercisePlan && !nutritionPlan) {
      return null;
    }

    return { exercisePlan, nutritionPlan };
  } catch (error) {
    console.error(
      "Failed to parse draft JSON from coach reply:",
      error.message,
    );
    return null;
  }
}

function stripJsonBlock(replyText) {
  return replyText
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

async function sendPlanCoachMessage({
  userId,
  sessionId,
  userMessage,
}) {
  let session;

  if (sessionId) {
    session = await chatModel.findSessionById(
      sessionId,
      userId,
    );

    if (!session) {
      const error = new Error(
        "Chat session not found"
      );
      error.status = 404;
      throw error;
    }
  } else {
    session = await chatModel.createSession(userId);
  }

  const [
    priorMessages,
    historyContext,
  ] = await Promise.all([
    chatModel.getMessagesBySession(
      session.id,
      PRIOR_MESSAGES_LIMIT,
    ),
    buildHistoryContext(userId),
  ]);

  /*
   * Deterministic guard: a bare confirmation after a draft
   * was already delivered never regenerates the plans.
   * Delivery is known from session.last_draft_at, or for
   * legacy sessions detected from stored fenced replies.
   */
  const draftAlreadyDelivered =
    Boolean(session.last_draft_at) ||
    priorMessages.some(
      (m) =>
        m.role === "assistant" &&
        /```json[\s\S]*"draft"/i.test(m.content),
    );

  if (
    sessionId &&
    draftAlreadyDelivered &&
    BARE_CONFIRMATION_PATTERN.test(userMessage.trim())
  ) {
    await chatModel.addMessage(
      session.id,
      "user",
      userMessage,
    );
    await chatModel.addMessage(
      session.id,
      "assistant",
      CONFIRMATION_REPLY,
    );

    return {
      sessionId: session.id,
      reply: CONFIRMATION_REPLY,
      draft: null,
      hasPlanHistory: historyContext.hasHistory,
    };
  }

  const messages = [
    ...priorMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user",
      content:
        `${historyContext.contextBlock}\n\n` +
        `Customer message: ${userMessage}`,
    },
  ];

  const data = await callLLM({
    messages,
    systemPrompt: PLAN_COACH_SYSTEM_PROMPT,
  });

  const rawReply = data.output_text;
  const draft = extractDraft(rawReply);

  /*
   * The structured draft travels in its own response field —
   * the visible reply must stay clean conversational text.
   */
  const replyText = draft
    ? stripJsonBlock(rawReply) ||
      'Your plans are ready! Press "Add to my plans" below to save them.'
    : rawReply;

  if (draft) {
    await chatModel.touchSessionDraft(session.id);
  }

  await chatModel.addMessage(
    session.id,
    "user",
    userMessage,
  );
  await chatModel.addMessage(
    session.id,
    "assistant",
    replyText,
  );

  if (draft) {
    try {
      await Promise.all([
        draft.exercisePlan
          ? require("../models/plan.model").savePlan({
              userId,
              planType: "exercise_bundle",
              content: draft.exercisePlan,
            })
          : Promise.resolve(null),
        draft.nutritionPlan
          ? require("../models/plan.model").savePlan({
              userId,
              planType: "nutrition_bundle",
              content: draft.nutritionPlan,
            })
          : Promise.resolve(null),
      ]);
    } catch (error) {
      console.error(
        "Failed to persist generated draft:",
        error.message,
      );
    }
  }

  return {
    sessionId: session.id,
    reply: replyText,
    draft,
    hasPlanHistory: historyContext.hasHistory,
  };
}

async function getPlanCoachHistory({ userId }) {
  const session =
    await chatModel.findLatestSession(userId);

  if (!session) {
    return { sessionId: null, messages: [] };
  }

  const messages = await chatModel.getMessagesBySession(
    session.id,
    50,
  );

  return {
    sessionId: session.id,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };
}

module.exports = {
  sendPlanCoachMessage,
  getPlanCoachHistory,
};
