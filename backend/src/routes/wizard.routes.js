import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { getProjectById, executeProjectAction } from '../services/project.service.js';
import { validateCompose, validateEnv, checkPortConflicts } from '../services/wizard.service.js';
import { recordAudit, getClientIp, getUserAgent } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

router.post('/validate-compose', (req, res) => {
  try {
    const { projectId } = req.body || {};
    const project = getProjectById(Number(projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const result = validateCompose(project.path, project.compose_file);
    res.json({ project: project.name, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/validate-env', (req, res) => {
  try {
    const { projectId, requiredVars = [] } = req.body || {};
    const project = getProjectById(Number(projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const result = validateEnv(project.path, Array.isArray(requiredVars) ? requiredVars : []);
    res.json({ project: project.name, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/check-port', async (req, res) => {
  try {
    const { projectId } = req.body || {};
    const project = getProjectById(Number(projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const compose = validateCompose(project.path, project.compose_file);
    if (!compose.ok) {
      return res.status(400).json({ message: 'Compose invalid', errors: compose.errors });
    }
    const result = await checkPortConflicts(compose.services);
    res.json({ project: project.name, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/run', requireRole('owner', 'admin'), async (req, res) => {
  const { projectId } = req.body || {};
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  const project = getProjectById(Number(projectId));
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  try {
    const result = await executeProjectAction(project, 'deploy', req.user?.username);
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'wizard.deploy',
      target: project.name,
      status: 'success',
      ipAddress: ip,
      userAgent: ua,
      detail: { duration_ms: result.duration }
    });
    res.json({ success: true, ...result });
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'wizard.deploy',
      target: project.name,
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({ message: error.message, output: error.output });
  }
});

export default router;
