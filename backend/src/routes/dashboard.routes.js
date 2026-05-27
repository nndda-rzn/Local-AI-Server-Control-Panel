import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { listContainers } from '../services/docker.service.js';
import { listAudit } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

router.get('/summary', async (req, res, next) => {
  try {
    const [containers, recentAudit] = await Promise.all([
      listContainers({ withInspect: false }).catch(() => []),
      Promise.resolve(listAudit({ limit: 8 }))
    ]);

    const running = containers.filter((c) => c.state === 'running');
    const stopped = containers.filter((c) => c.state !== 'running');
    const unhealthy = containers.filter((c) => /unhealthy/i.test(c.status || ''));

    const activeServices = running.map((c) => ({
      name: c.name,
      image: c.image,
      service: c.service,
      project: c.project,
      ports: c.ports || []
    }));

    res.json({
      counts: {
        total: containers.length,
        running: running.length,
        stopped: stopped.length,
        unhealthy: unhealthy.length
      },
      activeServices: activeServices.slice(0, 10),
      recentAudit
    });
  } catch (error) {
    next(error);
  }
});

export default router;
