import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { runInferenceTest, listInferenceHistory, getInferenceById, countInferenceHistory } from '../services/inference.service.js';
import { runContainerAction } from '../services/docker.service.js';
import { recordAudit, getClientIp, getUserAgent } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

const UPLOAD_TMP = process.env.INFERENCE_UPLOAD_TMP || '/server/data/uploads';
const MAX_IMAGE_MB = Number(process.env.MAX_INFERENCE_UPLOAD_MB || 20);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (!fs.existsSync(UPLOAD_TMP)) fs.mkdirSync(UPLOAD_TMP, { recursive: true });
    cb(null, UPLOAD_TMP);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `inf-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.bmp', '.webp'].includes(ext)) {
      return cb(new Error('Unsupported image extension'));
    }
    cb(null, true);
  }
});

router.post('/test', requireRole('owner', 'admin'), (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Image file is required' });

    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    try {
      const result = await runInferenceTest({
        imagePath: req.file.path,
        originalFilename: req.file.originalname,
        actorName: req.user?.username
      });
      try { fs.unlinkSync(req.file.path); } catch {}

      recordAudit({
        actorId: req.user?.id,
        actorName: req.user?.username,
        action: 'ai.inference.test',
        target: req.file.originalname,
        status: 'success',
        ipAddress: ip,
        userAgent: ua,
        detail: { inference_time_ms: result.inference_time_ms }
      });
      res.json(result);
    } catch (error) {
      try { fs.unlinkSync(req.file.path); } catch {}
      recordAudit({
        actorId: req.user?.id,
        actorName: req.user?.username,
        action: 'ai.inference.test',
        target: req.file.originalname,
        status: 'failed',
        ipAddress: ip,
        userAgent: ua,
        detail: { error: error.message }
      });
      res.status(error.status || 502).json({ message: error.message });
    }
  });
});

router.post('/restart-service', requireRole('owner', 'admin'), async (req, res) => {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  const target = (process.env.AI_INFERENCE_CONTAINER || 'ai-inference').trim();

  if (!target) {
    return res.status(503).json({ message: 'AI_INFERENCE_CONTAINER is not configured' });
  }

  try {
    await runContainerAction(target, 'restart');
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'ai.inference.restart',
      target,
      status: 'success',
      ipAddress: ip,
      userAgent: ua
    });
    res.json({ success: true, container: target });
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'ai.inference.restart',
      target,
      status: 'failed',
      ipAddress: ip,
      userAgent: ua,
      detail: { error: error.message }
    });
    res.status(error.status || 500).json({ message: error.message || 'Restart failed' });
  }
});

router.get('/history', (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const modelId = req.query.modelId ? Number(req.query.modelId) : null;
    const items = listInferenceHistory({ limit, offset, modelId });
    const total = countInferenceHistory();
    res.json({ items, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

router.get('/history/:id', (req, res, next) => {
  try {
    const item = getInferenceById(Number(req.params.id));
    if (!item) return res.status(404).json({ message: 'Inference history not found' });
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

export default router;
