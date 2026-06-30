import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

/* =====================================================================
 *  BASE DE DONNÉES (SQLite via better-sqlite3)
 * =====================================================================
 *  Un seul fichier, chemin configurable via DATABASE_PATH.
 *  En Docker, ce chemin pointe vers un volume persistant.
 * ===================================================================== */

const DB_PATH = process.env.DATABASE_PATH ?? "./data/app.db";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      title      TEXT NOT NULL,
      messages   TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);
  `);

  return db;
}
