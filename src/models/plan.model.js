const pool = require("../config/database");

async function savePlan({ userId, planType, content }) {
  const result = await pool.query(
    `INSERT INTO ai_generated_plans (user_id, plan_type, content)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, plan_type, content, created_at`,
    [userId, planType, content]
  );
  return result.rows[0];
}

async function findPlanById(planId, userId) {
  const result = await pool.query(
    `SELECT id, user_id, plan_type, content, created_at
     FROM ai_generated_plans
     WHERE id = $1 AND user_id = $2`,
    [planId, userId]
  );
  return result.rows[0];
}

async function findLatestPlanByUser(userId, planType) {
  const result = await pool.query(
    `SELECT id, user_id, plan_type, content, created_at
     FROM ai_generated_plans
     WHERE user_id = $1 AND plan_type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, planType]
  );
  return result.rows[0];
}

module.exports = {
  savePlan,
  findPlanById,
  findLatestPlanByUser,
};