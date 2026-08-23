const pool = require("../config/database");

const TABLE_BY_TOPIC = {
  EXERCISE_PLAN_EVENTS: "customer_exercise_plans",
  NUTRITION_PLAN_EVENTS: "customer_nutrition_plans",
};

function tableForTopic(topic) {
  const table = TABLE_BY_TOPIC[topic];

  if (!table) {
    throw new Error(`Unknown plan topic: ${topic}`);
  }

  return table;
}

async function upsertPlan(topic, plan) {
  const table = tableForTopic(topic);

  await pool.query(
    `INSERT INTO ${table}
        (plan_id, customer_id, payload, start_date, end_date, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (plan_id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        payload = EXCLUDED.payload,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        updated_at = now()`,
    [
      String(plan.id),
      String(plan.customer_id),
      JSON.stringify(plan),
      plan.start_date ? new Date(plan.start_date) : null,
      plan.end_date ? new Date(plan.end_date) : null,
    ]
  );
}

async function deletePlan(topic, planId) {
  if (!planId) {
    return;
  }

  const table = tableForTopic(topic);

  await pool.query(
    `DELETE FROM ${table} WHERE plan_id = $1`,
    [String(planId)]
  );
}

async function getExerciseHistory(customerId, limit = 3) {
  const result = await pool.query(
    `SELECT payload FROM customer_exercise_plans
     WHERE customer_id = $1
     ORDER BY start_date DESC NULLS LAST, updated_at DESC
     LIMIT $2`,
    [String(customerId), limit]
  );
  return result.rows.map((row) => row.payload);
}

async function getNutritionHistory(customerId, limit = 3) {
  const result = await pool.query(
    `SELECT payload FROM customer_nutrition_plans
     WHERE customer_id = $1
     ORDER BY start_date DESC NULLS LAST, updated_at DESC
     LIMIT $2`,
    [String(customerId), limit]
  );
  return result.rows.map((row) => row.payload);
}

async function hasAnyHistory(customerId) {
  const exercise = await pool.query(
    `SELECT 1 FROM customer_exercise_plans
     WHERE customer_id = $1 LIMIT 1`,
    [String(customerId)]
  );

  if (exercise.rows.length > 0) {
    return true;
  }

  const nutrition = await pool.query(
    `SELECT 1 FROM customer_nutrition_plans
     WHERE customer_id = $1 LIMIT 1`,
    [String(customerId)]
  );

  return nutrition.rows.length > 0;
}

module.exports = {
  upsertPlan,
  deletePlan,
  getExerciseHistory,
  getNutritionHistory,
  hasAnyHistory,
};
