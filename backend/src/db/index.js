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
  runMigrations(db);
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
      user_agent TEXT,
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
      task_type TEXT,
      size_bytes INTEGER,
      metrics_json TEXT,
      class_labels_json TEXT,
      input_size INTEGER,
      dataset_source TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      path TEXT NOT NULL,
      compose_file TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'mixed',
      status TEXT NOT NULL DEFAULT 'detected',
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

    CREATE TABLE IF NOT EXISTS inference_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER,
      model_name TEXT,
      input_file TEXT,
      result_json TEXT,
      visualization_path TEXT,
      inference_time_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'success',
      actor_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_inference_model ON inference_history(model_id);
    CREATE INDEX IF NOT EXISTS idx_inference_created ON inference_history(created_at);

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      size_bytes INTEGER,
      scope_json TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at);

    INSERT OR IGNORE INTO ai_settings (id) VALUES (1);
  `);
}

function runMigrations(database) {
  const migrations = [
    { table: 'users', column: 'email', sql: "ALTER TABLE users ADD COLUMN email TEXT" },
    { table: 'users', column: 'updated_at', sql: "ALTER TABLE users ADD COLUMN updated_at TEXT" },
    { table: 'audit_logs', column: 'user_agent', sql: "ALTER TABLE audit_logs ADD COLUMN user_agent TEXT" },
    { table: 'projects', column: 'status', sql: "ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'detected'" },
    { table: 'ai_models', column: 'task_type', sql: "ALTER TABLE ai_models ADD COLUMN task_type TEXT" },
    { table: 'ai_models', column: 'metrics_json', sql: "ALTER TABLE ai_models ADD COLUMN metrics_json TEXT" },
    { table: 'ai_models', column: 'class_labels_json', sql: "ALTER TABLE ai_models ADD COLUMN class_labels_json TEXT" },
    { table: 'ai_models', column: 'input_size', sql: "ALTER TABLE ai_models ADD COLUMN input_size INTEGER" },
    { table: 'ai_models', column: 'dataset_source', sql: "ALTER TABLE ai_models ADD COLUMN dataset_source TEXT" },
    { table: 'ai_models', column: 'notes', sql: "ALTER TABLE ai_models ADD COLUMN notes TEXT" }
  ];

  for (const m of migrations) {
    if (!hasColumn(database, m.table, m.column)) {
      try {
        database.exec(m.sql);
        console.log(`[migrate] applied: ${m.sql}`);
      } catch (error) {
        console.error(`[migrate] failed for ${m.table}.${m.column}:`, error.message);
      }
    }
  }
}

function hasColumn(database, table, column) {
  try {
    const rows = database.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some((r) => r.name === column);
  } catch {
    return false;
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
