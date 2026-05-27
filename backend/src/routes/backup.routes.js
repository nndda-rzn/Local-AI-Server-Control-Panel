import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  createBackup,
  listBackups,
  countBackups,
  getBackupById,
  deleteBackup,
  getBackupFile,
  restoreBackup,
  BACKUP_META
} from '../services/backup.service.js';
import { recordAudit, getClientIp, getUserAgent } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

router.get('/meta', (req, res) => {
  res.json({
    allowedScopes: BACKUP_META.ALLOWED_SCOPES,
    backupRoot: BACKUP_META.BACKUP_ROOT
  });
});

router.get('/', (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const items = listBackups({ limit, offset });
    const total = countBackups();
    res.json({ items, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const item = getBackupById(Number(req.params.id));
    if (!item) return res.status(404).json({ message: 'Backup not found' });
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('owner', 'admin'), async (req, res) => {
  const { scopes, label } = req.body || {};
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  try {
    const result = await createBackup({
      scopes: Array.isArray(scopes) ? scopes : ['db'],
      label: typeof label === 'string' ? label.slice(0, 80) : null,
      actorName: req.user?.username
    });
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'backup.create',
      target: result.name,
      status: 'success',
      ipAddress: ip,
      userAgent: ua,
      detail: { scopes: result.scopes, size_bytes: result.size_bytes, duration_ms: result.duration_ms }
    });
    res.json(result);
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'backup.create',
      target: label || 'backup',
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/:id/download', (req, res) => {
  try {
    const file = getBackupFile(Number(req.params.id));
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'backup.download',
      target: file.name,
      status: 'success',
      ipAddress: getClientIp(req)
    });
    res.download(file.path, file.name);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/:id/restore', requireRole('owner'), async (req, res) => {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  const id = Number(req.params.id);

  try {
    const result = await restoreBackup(id);
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'backup.restore',
      target: result.backup_name,
      status: 'success',
      ipAddress: ip,
      userAgent: ua,
      detail: { restored_to: result.restored_to, duration_ms: result.duration_ms }
    });
    res.json(result);
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'backup.restore',
      target: String(id),
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.delete('/:id', requireRole('owner', 'admin'), (req, res) => {
  try {
    const backup = getBackupById(Number(req.params.id));
    const result = deleteBackup(Number(req.params.id));
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'backup.delete',
      target: backup?.name || String(req.params.id),
      status: 'success',
      ipAddress: getClientIp(req)
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

export default router;
