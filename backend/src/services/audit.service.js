import { getDb } from '../db/index.js';

export function recordAudit({ actorId = null, actorName = null, action, target = null, status = 'success', ipAddress = null, userAgent = null, detail = null }) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_logs (actor_id, actor_name, action, target, status, ip_address, user_agent, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(actorId, actorName, action, target, status, ipAddress, userAgent, detail ? JSON.stringify(detail) : null);
  } catch (error) {
    console.error('[audit] failed to record:', error.message);
  }
}

export function listAudit({ limit = 100, offset = 0, action = null, dateFrom = null, dateTo = null } = {}) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const where = [];
  const params = [];

  if (action) {
    where.push('action = ?');
    params.push(action);
  }
  if (dateFrom) {
    where.push("timestamp >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push("timestamp <= ?");
    params.push(dateTo);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(safeLimit, safeOffset);

  return db.prepare(
    `SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params);
}

export function countAudit() {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS total FROM audit_logs').get();
  return row?.total || 0;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || null;
}

export function getUserAgent(req) {
  return req.headers['user-agent']?.slice(0, 250) || null;
}
