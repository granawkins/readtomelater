import { Database } from "bun:sqlite";

const DB_PATH = "content.db";

// Initialize the database
const db = new Database(DB_PATH);

// Create the content table
db.run(`
  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    content_url TEXT DEFAULT NULL,
    generation_chunks_completed INTEGER DEFAULT 0,
    generation_total_chunks INTEGER DEFAULT 0,
    listening_position_seconds INTEGER DEFAULT 0
  )
`);

// Helper functions for common operations
export const insertContent = (sourceUrl, title, body, contentUrl) => {
  try {
    return db.prepare(`
      INSERT INTO content (source_url, title, body, content_url) 
      VALUES (?, ?, ?, ?)
      RETURNING *
    `).get(sourceUrl, title, body, contentUrl);
  } catch (error) {
    console.error('Error inserting content:', error);
    throw error;
  }
};

export const updateContentStatus = (id, status) => {
  return db.run(
    "UPDATE content SET status = ? WHERE id = ?",
    [status, id]
  );
};

export const updateGenerationProgress = (id, chunksCompleted, totalChunks) => {
  return db.run(
    "UPDATE content SET generation_chunks_completed = ?, generation_total_chunks = ? WHERE id = ?",
    [chunksCompleted, totalChunks, id]
  );
};

export const updateListeningPosition = (id, positionSeconds) => {
  return db.run(
    "UPDATE content SET listening_position_seconds = ? WHERE id = ?",
    [positionSeconds, id]
  );
};

export const getContent = (id) => {
  const result = db.prepare("SELECT * FROM content WHERE id = ?").get(id);
  console.log(`Getting content for ${id}: ${result}`);
  return result;
};

export const getAllContent = () => {
  return db.query("SELECT * FROM content").all();
};

// Close the database connection when the process exits
process.on("exit", () => {
  db.close();
});

export default db;
