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
    chunks_generated INTEGER DEFAULT 0,
    content_url TEXT DEFAULT NULL
  )
`);

// Migrate existing data if progress column exists
try {
  db.run(`ALTER TABLE content ADD COLUMN seconds_listened INTEGER DEFAULT 0`);
  db.run(`ALTER TABLE content ADD COLUMN chunks_generated INTEGER DEFAULT 0`);
} catch (e) {
  // Columns already exist, ignore
}

try {
  db.run(`ALTER TABLE content DROP COLUMN progress`);
} catch (e) {
  // Column doesn't exist or can't be dropped, ignore
}

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

export const updateSecondsListened = (id, seconds) => {
  return db.run(
    "UPDATE content SET seconds_listened = ? WHERE id = ?",
    [seconds, id]
  );
};

export const updateChunksGenerated = (id, chunks) => {
  return db.run(
    "UPDATE content SET chunks_generated = ? WHERE id = ?",
    [chunks, id]
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
