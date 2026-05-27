import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listProjects,
  getProjectById,
  readComposeServices,
  listDeploymentHistory,
  executeProjectAction
} from '../services/project.service.js';
import { recordAudit, getClientIp } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res, next) => {
  try {
    const projects = listProjects();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const project = getProjectById(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const services = readComposeServices(project);
    res.json({ project, services });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', (req, res, next) => {
  try {
    const project = getProjectById(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const history = listDeploymentHistory(project.id, Number(req.query.limit) || 50);
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

const ALLOWED_ACTIONS = new Set(['deploy', 'down', 'restart']);

router.post('/:id/:action', async (req, res) => {
  const action = req.params.action;
  const ip = getClientIp(req);

  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ message: `Unsupported project action: ${action}` });
  }

  const project = getProjectById(Number(req.params.id));
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  try {
    const result = await executeProjectAction(project, action, req.user?.username);
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: `project.${action}`,
      target: project.name,
      status: 'success',
      ipAddress: ip,
      detail: { duration_ms: result.duration }
    });
    res.json({ success: true, ...result });
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: `project.${action}`,
      target: project.name,
      status: 'failed',
      ipAddress: ip,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({
      message: error.message,
      output: error.output
    });
  }
});

export default router;
