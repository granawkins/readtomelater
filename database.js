import { Database } from "bun:sqlite";

const DB_PATH = "content.db";

// Initialize the database
const db = new Database(DB_PATH);

// Create the users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create the verification tokens table
db.run(`
  CREATE TABLE IF NOT EXISTS verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    type TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

// Create the content table
db.run(`
  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    seconds_listened INTEGER DEFAULT 0,
    seconds_total INTEGER DEFAULT 0,
    chunks_generated INTEGER DEFAULT 0,
    content_url TEXT DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

// Helper functions for common operations
export const insertContent = (userId, sourceUrl, title, body, contentUrl, secondsTotal = 0) => {
  try {
    return db.prepare(`
      INSERT INTO content (user_id, source_url, title, body, content_url, seconds_total) 
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(userId, sourceUrl, title, body, contentUrl, secondsTotal);
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

export const getAllContent = (userId) => {
  return db.query("SELECT * FROM content WHERE user_id = ? ORDER BY created_at DESC").all(userId);
};

// User functions
export const createUser = (email, passwordHash) => {
  return db.prepare(`
    INSERT INTO users (email, password_hash) 
    VALUES (?, ?)
    RETURNING *
  `).get(email, passwordHash);
};

export const getUserByEmail = (email) => {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
};

export const getUserById = (id) => {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
};

export const verifyUserEmail = (userId) => {
  return db.run("UPDATE users SET email_verified = TRUE WHERE id = ?", [userId]);
};

export const updateUserPassword = (userId, passwordHash) => {
  return db.run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
};

// Token functions
export const createVerificationToken = (userId, token, type, expiresAt) => {
  return db.prepare(`
    INSERT INTO verification_tokens (user_id, token, type, expires_at) 
    VALUES (?, ?, ?, ?)
    RETURNING *
  `).get(userId, token, type, expiresAt);
};

export const getVerificationToken = (token) => {
  return db.prepare("SELECT * FROM verification_tokens WHERE token = ?").get(token);
};

export const deleteVerificationToken = (token) => {
  return db.run("DELETE FROM verification_tokens WHERE token = ?", [token]);
};

// Close the database connection when the process exits
process.on("exit", () => {
  db.close();
});

export default db;
