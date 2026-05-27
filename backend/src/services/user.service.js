import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';

export function findUserByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
}

export function findUserByEmail(email) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
}

export function findUserByLogin(identifier) {
  if (!identifier || typeof identifier !== 'string') return null;
  const value = identifier.trim();
  if (!value) return null;
  if (value.includes('@')) {
    return findUserByEmail(value) || findUserByUsername(value);
  }
  return findUserByUsername(value) || findUserByEmail(value);
}

export function findUserById(id) {
  const db = getDb();
  return db.prepare('SELECT id, username, email, role, is_active, created_at FROM users WHERE id = ?').get(id);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function ensureSeedAdmin() {
  const db = getDb();
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn('[auth] ADMIN_USERNAME or ADMIN_PASSWORD not set - skipping seed admin');
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return;

  const hash = await hashPassword(password);
  db.prepare(`
    INSERT INTO users (username, password_hash, role, is_active)
    VALUES (?, ?, 'owner', 1)
  `).run(username, hash);

  console.log(`[auth] Seed admin user "${username}" created`);
}

export async function changePassword(userId, newPassword) {
  const db = getDb();
  const hash = await hashPassword(newPassword);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, userId);
}

const ALLOWED_ROLES = new Set(['owner', 'admin', 'viewer']);
const SAFE_USERNAME = /^[a-zA-Z0-9._-]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function listUsers() {
  const db = getDb();
  return db.prepare(`
    SELECT id, username, email, role, is_active, created_at, updated_at
    FROM users ORDER BY id ASC
  `).all();
}

export function getUserPublic(id) {
  const db = getDb();
  return db.prepare(`
    SELECT id, username, email, role, is_active, created_at, updated_at
    FROM users WHERE id = ?
  `).get(id);
}

function countOwners(excludeId = null) {
  const db = getDb();
  const sql = excludeId
    ? `SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND is_active = 1 AND id != ?`
    : `SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND is_active = 1`;
  const stmt = db.prepare(sql);
  return (excludeId ? stmt.get(excludeId) : stmt.get())?.n || 0;
}

export async function createUser({ username, email, password, role = 'admin' }) {
  const db = getDb();

  if (!SAFE_USERNAME.test(username || '')) {
    const err = new Error('Username must be 3-40 chars (letters, digits, ._-)');
    err.status = 400; throw err;
  }
  if (email && !EMAIL_RE.test(email)) {
    const err = new Error('Invalid email format');
    err.status = 400; throw err;
  }
  if (!password || password.length < 8) {
    const err = new Error('Password must be at least 8 characters');
    err.status = 400; throw err;
  }
  if (!ALLOWED_ROLES.has(role)) {
    const err = new Error(`Invalid role. Allowed: ${[...ALLOWED_ROLES].join(', ')}`);
    err.status = 400; throw err;
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    const err = new Error('Username already exists');
    err.status = 409; throw err;
  }
  if (email) {
    const existsEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existsEmail) {
      const err = new Error('Email already exists');
      err.status = 409; throw err;
    }
  }

  const hash = await hashPassword(password);
  const result = db.prepare(`
    INSERT INTO users (username, email, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(username, email || null, hash, role);

  return getUserPublic(result.lastInsertRowid);
}

export function updateUser(id, patch = {}, actorId = null) {
  const db = getDb();
  const target = getUserPublic(id);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404; throw err;
  }

  const fields = [];
  const values = [];

  if (patch.email !== undefined) {
    if (patch.email && !EMAIL_RE.test(patch.email)) {
      const err = new Error('Invalid email format');
      err.status = 400; throw err;
    }
    if (patch.email) {
      const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(patch.email, id);
      if (dup) {
        const err = new Error('Email already used by another user');
        err.status = 409; throw err;
      }
    }
    fields.push('email = ?'); values.push(patch.email || null);
  }

  if (patch.role !== undefined) {
    if (!ALLOWED_ROLES.has(patch.role)) {
      const err = new Error('Invalid role');
      err.status = 400; throw err;
    }
    if (target.role === 'owner' && patch.role !== 'owner' && countOwners(id) === 0) {
      const err = new Error('Cannot demote the last active owner');
      err.status = 400; throw err;
    }
    fields.push('role = ?'); values.push(patch.role);
  }

  if (patch.is_active !== undefined) {
    const next = patch.is_active ? 1 : 0;
    if (target.role === 'owner' && next === 0 && countOwners(id) === 0) {
      const err = new Error('Cannot disable the last active owner');
      err.status = 400; throw err;
    }
    if (Number(actorId) === Number(id) && next === 0) {
      const err = new Error('Cannot disable yourself');
      err.status = 400; throw err;
    }
    fields.push('is_active = ?'); values.push(next);
  }

  if (fields.length === 0) return target;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getUserPublic(id);
}

export async function adminResetPassword(id, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    const err = new Error('Password must be at least 8 characters');
    err.status = 400; throw err;
  }
  const target = getUserPublic(id);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404; throw err;
  }
  await changePassword(id, newPassword);
  return { success: true };
}

export function deleteUser(id, actorId = null) {
  const db = getDb();
  const target = getUserPublic(id);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404; throw err;
  }
  if (Number(actorId) === Number(id)) {
    const err = new Error('Cannot delete yourself');
    err.status = 400; throw err;
  }
  if (target.role === 'owner' && countOwners(id) === 0) {
    const err = new Error('Cannot delete the last active owner');
    err.status = 400; throw err;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return { success: true };
}
