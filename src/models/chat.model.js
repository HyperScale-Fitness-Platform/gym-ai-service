const pool = require("../config/database");

async function createSession(userId) {
  const result = await pool.query(
    "INSERT INTO chat_sessions (user_id) VALUES ($1) RETURNING *",
    [userId]
  );
  return result.rows[0];
}

async function findSessionById(sessionId, userId) {
  // Also filtering by userId here — this ensures a user can never
  // read/continue someone ELSE's conversation by guessing a session id.
  const result = await pool.query(
    "SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2",
    [sessionId, userId]
  );
  return result.rows[0];
}

async function findLatestSession(userId) {
  const result = await pool.query(
    `SELECT *
     FROM chat_sessions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0];
}

async function addMessage(sessionId, role, content) {
  const result = await pool.query(
    `INSERT INTO chat_messages (session_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [sessionId, role, content]
  );
  return result.rows[0];
}

async function getMessagesBySession(sessionId) {
  const result = await pool.query(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows;
}

module.exports = { createSession, findSessionById, addMessage, findLatestSession, getMessagesBySession };