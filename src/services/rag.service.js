const pool = require("../config/database");
const { generateEmbedding } = require("./embedding.service");

async function retrieveRelevantDocs(query, topK = 3) {
  const queryEmbedding = await generateEmbedding(query);

  const result = await pool.query(
    `SELECT title, content, 1 - (embedding <=> $1) AS similarity
     FROM equipment_docs
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [JSON.stringify(queryEmbedding), topK]
  );
  // "<=>" is pgvector's cosine distance operator — smaller distance
  // means more similar. Ordering by this directly gives us the most
  // relevant documents first, without fetching and sorting in JS.

  return result.rows;
}

module.exports = { retrieveRelevantDocs };