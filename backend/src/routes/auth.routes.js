import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware.js';
import { findUserByUsername, verifyPassword } from '../services/user.service.js';
import { recordAudit, getClientIp } from '../services/audit.service.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts, try again later' }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const ip = getClientIp(req);

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ message: 'JWT_SECRET is not configured' });
  }

  const user = findUserByUsername(username);
  if (!user) {
    recordAudit({ action: 'auth.login', target: username, status: 'failed', ipAddress: ip, detail: { reason: 'user not found' } });
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    recordAudit({ actorId: user.id, actorName: user.username, action: 'auth.login', target: username, status: 'failed', ipAddress: ip, detail: { reason: 'wrong password' } });
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    jwtSecret,
    { expiresIn: '8h' }
  );

  recordAudit({ actorId: user.id, actorName: user.username, action: 'auth.login', target: user.username, status: 'success', ipAddress: ip });

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role }
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

export default router;
