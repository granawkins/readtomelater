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
    seconds_listened INTEGER DEFAULT 0,
    seconds_total INTEGER DEFAULT 0,
    chunks_generated INTEGER DEFAULT 0,
    content_url TEXT DEFAULT NULL
  )
`);

// Helper functions for common operations
export const insertContent = (sourceUrl, title, body, contentUrl, secondsTotal) => {
  try {
    return db.prepare(`
      INSERT INTO content (source_url, title, body, content_url, seconds_total) 
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `).get(sourceUrl, title, body, contentUrl, secondsTotal);
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

export const updateSecondsListened = (id, seconds) => {
  return db.run(
    "UPDATE content SET seconds_listened = ? WHERE id = ?",
    [seconds, id]
  );
};

export const updateChunksGenerated = (id, chunks, secondsTotal) => {
  return db.run(
    "UPDATE content SET chunks_generated = ?, seconds_total = ? WHERE id = ?",
    [chunks, secondsTotal, id]
  );
};

export const getContent = (id) => {
  const result = db.prepare("SELECT * FROM content WHERE id = ?").get(id);
  console.log(`Getting content for ${id}: ${result}`);
  return result;
};

export const getAllContent = () => {
  return db.query("SELECT * FROM content ORDER BY created_at DESC").all();
};

// Close the database connection when the process exits
process.on("exit", () => {
  db.close();
});

export default db;
