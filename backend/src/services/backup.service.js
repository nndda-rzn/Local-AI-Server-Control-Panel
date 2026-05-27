import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { getDb } from '../db/index.js';
import { ensurePathAllowed, isSafeName } from '../utils/paths.js';

const BACKUP_ROOT = process.env.BACKUP_ROOT || '/server/backup';
const ALLOWED_SCOPES = new Set(['db', 'models', 'uploads', 'projects']);
const MAX_BACKUPS_LIST = 200;
const TAR_TIMEOUT_MS = 10 * 60 * 1000;

function ensureBackupRoot() {
  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }
}

function scopeToPath(scope) {
  switch (scope) {
    case 'db':
      return process.env.DATABASE_PATH || '/server/data/sqlite/panel.db';
    case 'models':
      return process.env.ALLOWED_MODEL_ROOT || '/server/data/models';
    case 'uploads':
      return process.env.INFERENCE_UPLOAD_TMP || '/server/data/uploads';
    case 'projects':
      return process.env.ALLOWED_PROJECT_ROOT || '/server/apps';
    default:
      return null;
  }
}

function buildBackupName(label) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = label && isSafeName(label) ? label : 'backup';
  return `${base}_${stamp}.tar.gz`;
}

function runTar({ outputFile, sources }) {
  return new Promise((resolve, reject) => {
    const args = ['-czf', outputFile];
    for (const src of sources) {
      const dir = path.dirname(src);
      const base = path.basename(src);
      args.push('-C', dir, base);
    }

    const child = spawn('tar', args, { shell: false });
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, TAR_TIMEOUT_MS);

    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        return reject(new Error(`tar timed out after ${TAR_TIMEOUT_MS}ms`));
      }
      if (code === 0) return resolve({ code, stderr });
      reject(new Error(`tar exited with code ${code}: ${stderr.trim().slice(0, 500)}`));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function runTarExtract({ archive, destDir }) {
  return new Promise((resolve, reject) => {
    const args = ['-xzf', archive, '-C', destDir];
    const child = spawn('tar', args, { shell: false });
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, TAR_TIMEOUT_MS);

    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return reject(new Error(`tar extract timed out after ${TAR_TIMEOUT_MS}ms`));
      if (code === 0) return resolve({ code, stderr });
      reject(new Error(`tar extract exited with code ${code}: ${stderr.trim().slice(0, 500)}`));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function createBackup({ scopes = ['db'], label, actorName }) {
  ensureBackupRoot();

  const validScopes = scopes.filter((s) => ALLOWED_SCOPES.has(s));
  if (validScopes.length === 0) {
    const error = new Error('No valid backup scope selected');
    error.status = 400;
    throw error;
  }

  const sources = [];
  const missing = [];
  for (const scope of validScopes) {
    const target = scopeToPath(scope);
    if (target && fs.existsSync(target)) {
      sources.push(target);
    } else {
      missing.push(scope);
    }
  }

  if (sources.length === 0) {
    const error = new Error(`Backup sources not found: ${missing.join(', ')}`);
    error.status = 404;
    throw error;
  }

  const filename = buildBackupName(label);
  const outputFile = path.join(BACKUP_ROOT, filename);
  ensurePathAllowed(outputFile, BACKUP_ROOT);

  const start = Date.now();
  let status = 'success';
  let errorMessage = null;
  let sizeBytes = 0;

  try {
    await runTar({ outputFile, sources });
    sizeBytes = fs.statSync(outputFile).size;
  } catch (error) {
    status = 'failed';
    errorMessage = error.message;
    try { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch {}
  }

  const duration = Date.now() - start;

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO backups (name, file_path, size_bytes, scope_json, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    filename,
    status === 'success' ? outputFile : '',
    sizeBytes,
    JSON.stringify({ scopes: validScopes, missing }),
    status,
    actorName || null
  );

  if (status === 'failed') {
    const error = new Error(errorMessage || 'Backup failed');
    error.status = 500;
    error.backupId = result.lastInsertRowid;
    error.duration = duration;
    throw error;
  }

  return {
    id: result.lastInsertRowid,
    name: filename,
    file_path: outputFile,
    size_bytes: sizeBytes,
    scopes: validScopes,
    missing,
    duration_ms: duration,
    status
  };
}

export function listBackups({ limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), MAX_BACKUPS_LIST);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return db.prepare(`
    SELECT * FROM backups ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(safeLimit, safeOffset);
}

export function countBackups() {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) AS total FROM backups').get()?.total || 0;
}

export function getBackupById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM backups WHERE id = ?').get(id);
}

export function deleteBackup(id) {
  const db = getDb();
  const backup = getBackupById(id);
  if (!backup) {
    const error = new Error('Backup not found');
    error.status = 404;
    throw error;
  }

  if (backup.file_path) {
    const safePath = ensurePathAllowed(backup.file_path, BACKUP_ROOT);
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }
  }

  db.prepare('DELETE FROM backups WHERE id = ?').run(id);
  return { success: true };
}

export function getBackupFile(id) {
  const backup = getBackupById(id);
  if (!backup) {
    const error = new Error('Backup not found');
    error.status = 404;
    throw error;
  }

  if (backup.status !== 'success' || !backup.file_path) {
    const error = new Error('Backup file is not available');
    error.status = 410;
    throw error;
  }

  const safePath = ensurePathAllowed(backup.file_path, BACKUP_ROOT);
  if (!fs.existsSync(safePath)) {
    const error = new Error('Backup file is missing on disk');
    error.status = 404;
    throw error;
  }

  return { path: safePath, name: backup.name };
}

const RESTORE_ROOT = process.env.RESTORE_ROOT || path.join(BACKUP_ROOT, 'restored');

export async function restoreBackup(id) {
  const file = getBackupFile(id);

  if (!fs.existsSync(RESTORE_ROOT)) {
    fs.mkdirSync(RESTORE_ROOT, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = path.basename(file.name, '.tar.gz').replace(/[^a-zA-Z0-9._-]/g, '_');
  const destDir = path.join(RESTORE_ROOT, `${baseName}_${stamp}`);
  const safeDest = ensurePathAllowed(destDir, RESTORE_ROOT);

  fs.mkdirSync(safeDest, { recursive: true });

  const start = Date.now();
  await runTarExtract({ archive: file.path, destDir: safeDest });
  const duration = Date.now() - start;

  const entries = fs.readdirSync(safeDest, { withFileTypes: true })
    .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));

  return {
    success: true,
    backup_id: id,
    backup_name: file.name,
    restored_to: safeDest,
    entries,
    duration_ms: duration
  };
}

export const BACKUP_META = {
  ALLOWED_SCOPES: [...ALLOWED_SCOPES],
  BACKUP_ROOT,
  RESTORE_ROOT
};
