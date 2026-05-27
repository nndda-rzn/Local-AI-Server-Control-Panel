import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { buildTopology } from '../services/topology.service.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const topology = await buildTopology();
    res.json(topology);
  } catch (error) {
    next(error);
  }
});

router.get('/nodes/:id', async (req, res, next) => {
  try {
    const topology = await buildTopology();
    const node = topology.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    res.json({ node });
  } catch (error) {
    next(error);
  }
});

export default router;
