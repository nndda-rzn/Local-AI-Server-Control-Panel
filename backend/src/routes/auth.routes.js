import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware.js';
import { findUserByLogin, findUserById, findUserByUsername, verifyPassword, changePassword } from '../services/user.service.js';
import { recordAudit, getClientIp, getUserAgent } from '../services/audit.service.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts, try again later' }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};
  const identifier = username || email;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Username/email and password are required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ message: 'JWT_SECRET is not configured' });
  }

  const user = findUserByLogin(identifier);
  if (!user) {
    recordAudit({ action: 'auth.login', target: identifier, status: 'failed', ipAddress: ip, userAgent: ua, detail: { reason: 'user not found' } });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    recordAudit({ actorId: user.id, actorName: user.username, action: 'auth.login', target: identifier, status: 'failed', ipAddress: ip, userAgent: ua, detail: { reason: 'wrong password' } });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    jwtSecret,
    { expiresIn: '8h' }
  );

  recordAudit({ actorId: user.id, actorName: user.username, action: 'auth.login', target: user.username, status: 'success', ipAddress: ip, userAgent: ua });

  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email || null, role: user.role }
  });
});

router.post('/logout', requireAuth, (req, res) => {
  recordAudit({
    actorId: req.user?.id,
    actorName: req.user?.username,
    action: 'auth.logout',
    target: req.user?.username,
    status: 'success',
    ipAddress: getClientIp(req)
  });
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user?.id,
      username: req.user?.username,
      role: req.user?.role
    }
  });
});

router.put('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  const user = findUserById(req.user?.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const fullUser = findUserByUsername(user.username);
  const ok = await verifyPassword(currentPassword, fullUser.password_hash);
  if (!ok) {
    recordAudit({
      actorId: user.id,
      actorName: user.username,
      action: 'auth.change-password',
      target: user.username,
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { reason: 'wrong current password' }
    });
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  await changePassword(user.id, newPassword);

  recordAudit({
    actorId: user.id,
    actorName: user.username,
    action: 'auth.change-password',
    target: user.username,
    status: 'success',
    ipAddress: ip,
    userAgent: ua
  });

  res.json({ success: true });
});

export default router;
