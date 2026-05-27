import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';

export function findUserByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
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
