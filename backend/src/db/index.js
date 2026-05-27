import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || '/server/data/sqlite/panel.db';

let db;

export function getDb() {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      actor_name TEXT,
      action TEXT NOT NULL,
      target TEXT,
      status TEXT NOT NULL,
      ip_address TEXT,
      detail TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      confidence_threshold REAL NOT NULL DEFAULT 0.50,
      image_size INTEGER NOT NULL DEFAULT 640,
      device TEXT NOT NULL DEFAULT 'cpu',
      cam_method TEXT NOT NULL DEFAULT 'HiResCAM',
      active_model_id INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version TEXT,
      file_path TEXT NOT NULL,
      framework TEXT NOT NULL DEFAULT 'pytorch',
      size_bytes INTEGER,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      path TEXT NOT NULL,
      compose_file TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'mixed',
      is_protected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deployment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      project_name TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      output TEXT,
      duration_ms INTEGER,
      actor_name TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_deployment_project ON deployment_history(project_id);

    INSERT OR IGNORE INTO ai_settings (id) VALUES (1);
  `);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
