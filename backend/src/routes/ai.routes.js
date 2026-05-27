import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getSettings,
  updateSettings,
  listModels,
  activateModel,
  registerUploadedModel,
  deleteModel,
  VALIDATION
} from '../services/ai.service.js';
import { getAllowedModelRoot, isSafeName } from '../utils/paths.js';
import { recordAudit, getClientIp } from '../services/audit.service.js';

const router = express.Router();
router.use(requireAuth);

const MAX_MODEL_SIZE = Number(process.env.MAX_MODEL_UPLOAD_MB || 500) * 1024 * 1024;

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = getAllowedModelRoot();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'model';
    const stamp = Date.now();
    cb(null, `${stamp}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MODEL_SIZE, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!VALIDATION.ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Unsupported model extension: ${ext}`));
    }
    if (!isSafeName(path.basename(file.originalname))) {
      return cb(new Error('Invalid model filename'));
    }
    cb(null, true);
  }
});

router.get('/settings', (req, res, next) => {
  try {
    res.json({ settings: getSettings() });
  } catch (error) { next(error); }
});

router.put('/settings', (req, res) => {
  try {
    const updated = updateSettings(req.body || {});
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'ai.settings.update',
      target: 'ai_settings',
      status: 'success',
      ipAddress: getClientIp(req),
      detail: req.body
    });
    res.json({ settings: updated });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/models', (req, res, next) => {
  try {
    res.json({ models: listModels() });
  } catch (error) { next(error); }
});

router.post('/models/upload', (req, res) => {
  upload.single('model')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Model file is required' });
    }

    try {
      const model = registerUploadedModel({
        originalName: req.file.originalname,
        storedFilename: req.file.filename,
        sizeBytes: req.file.size,
        framework: req.body?.framework,
        version: req.body?.version
      });
      recordAudit({
        actorId: req.user?.id,
        actorName: req.user?.username,
        action: 'ai.model.upload',
        target: model.name,
        status: 'success',
        ipAddress: getClientIp(req),
        detail: { size_bytes: model.size_bytes, framework: model.framework }
      });
      res.json({ model });
    } catch (error) {
      try { fs.unlinkSync(req.file.path); } catch {}
      res.status(error.status || 500).json({ message: error.message });
    }
  });
});

router.post('/models/:id/activate', (req, res) => {
  try {
    const settings = activateModel(Number(req.params.id));
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'ai.model.activate',
      target: settings?.active_model_name || String(req.params.id),
      status: 'success',
      ipAddress: getClientIp(req)
    });
    res.json({ settings });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.delete('/models/:id', (req, res) => {
  try {
    const result = deleteModel(Number(req.params.id));
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'ai.model.delete',
      target: String(req.params.id),
      status: 'success',
      ipAddress: getClientIp(req)
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/test-inference', async (req, res) => {
  const endpoint = process.env.AI_INFERENCE_URL;
  const ip = getClientIp(req);

  if (!endpoint) {
    return res.status(503).json({
      message: 'AI_INFERENCE_URL not configured. Set env to point to your inference service.',
      configured: false
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
      signal: controller.signal
    });
    clearTimeout(timer);

    const data = await response.json().catch(() => ({}));

    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'ai.test-inference',
      target: endpoint,
      status: response.ok ? 'success' : 'failed',
      ipAddress: ip
    });

    res.status(response.status).json({ ok: response.ok, data });
  } catch (error) {
    recordAudit({
      actorId: req.user?.id,
      actorName: req.user?.username,
      action: 'ai.test-inference',
      target: endpoint,
      status: 'failed',
      ipAddress: ip,
      detail: { error: error.message }
    });
    res.status(502).json({ message: `Inference call failed: ${error.message}` });
  }
});

export default router;
