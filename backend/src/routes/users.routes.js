import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  listUsers,
  getUserPublic,
  createUser,
  updateUser,
  deleteUser,
  adminResetPassword
} from '../services/user.service.js';
import { recordAudit, getClientIp, getUserAgent } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('owner', 'admin'), (req, res, next) => {
  try {
    res.json({ users: listUsers() });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireRole('owner', 'admin'), (req, res, next) => {
  try {
    const user = getUserPublic(Number(req.params.id));
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('owner'), async (req, res) => {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  try {
    const { username, email, password, role } = req.body || {};
    const user = await createUser({ username, email, password, role });
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'user.create',
      target: user.username,
      status: 'success',
      ipAddress: ip,
      userAgent: ua,
      detail: { role: user.role }
    });
    res.status(201).json({ user });
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'user.create',
      target: req.body?.username || '?',
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/:id', requireRole('owner'), (req, res) => {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  const id = Number(req.params.id);
  try {
    const user = updateUser(id, req.body || {}, req.user?.id);
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'user.update',
      target: user.username,
      status: 'success',
      ipAddress: ip,
      userAgent: ua,
      detail: req.body
    });
    res.json({ user });
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'user.update',
      target: String(id),
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/:id/password', requireRole('owner'), async (req, res) => {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  const id = Number(req.params.id);
  try {
    await adminResetPassword(id, req.body?.password);
    const target = getUserPublic(id);
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'user.reset-password',
      target: target?.username || String(id),
      status: 'success',
      ipAddress: ip,
      userAgent: ua
    });
    res.json({ success: true });
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'user.reset-password',
      target: String(id),
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.delete('/:id', requireRole('owner'), (req, res) => {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  const id = Number(req.params.id);
  const target = getUserPublic(id);
  try {
    const result = deleteUser(id, req.user?.id);
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'user.delete',
      target: target?.username || String(id),
      status: 'success',
      ipAddress: ip,
      userAgent: ua
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

export default router;
