import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  listContainers,
  getContainerLogs,
  runContainerAction
} from '../services/docker.service.js';
import { recordAudit, getClientIp, getUserAgent } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

router.get('/containers', async (req, res, next) => {
  try {
    const inspect = req.query.inspect !== 'false';
    const containers = await listContainers({ withInspect: inspect });
    res.json({ containers });
  } catch (error) {
    next(error);
  }
});

router.get('/containers/:name/logs', async (req, res, next) => {
  try {
    const tail = Math.min(Number(req.query.tail || 150), 500);
    const logs = await getContainerLogs(req.params.name, tail);
    res.json({ container: req.params.name, logs });
  } catch (error) {
    next(error);
  }
});

router.post('/containers/:name/:action', requireRole('owner', 'admin'), async (req, res) => {
  const { name, action } = req.params;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  try {
    const result = await runContainerAction(name, action);
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: `container.${action}`,
      target: name,
      status: 'success',
      ipAddress: ip,
      userAgent: ua
    });
    res.json(result);
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: `container.${action}`,
      target: name,
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({ message: error.message || 'Docker action failed' });
  }
});

export default router;
