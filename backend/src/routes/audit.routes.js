import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { listAudit, countAudit } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const action = req.query.action || null;
    const dateFrom = req.query.from || null;
    const dateTo = req.query.to || null;

    const items = listAudit({ limit, offset, action, dateFrom, dateTo });
    const total = countAudit();

    res.json({ items, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

export default router;
