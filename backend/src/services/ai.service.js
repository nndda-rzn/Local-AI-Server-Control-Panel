import path from 'node:path';
import fs from 'node:fs';
import { getDb } from '../db/index.js';
import { getAllowedModelRoot, ensurePathAllowed, isSafeName } from '../utils/paths.js';

const ALLOWED_DEVICES = new Set(['cpu', 'cuda', 'xpu', 'mps']);
const ALLOWED_FRAMEWORKS = new Set(['pytorch', 'onnx', 'sklearn']);
const ALLOWED_EXTENSIONS = new Set(['.pt', '.pth', '.onnx', '.pkl']);

export function getSettings() {
  const db = getDb();
  const row = db.prepare(`
    SELECT s.*, m.name AS active_model_name, m.version AS active_model_version, m.framework AS active_model_framework
    FROM ai_settings s
    LEFT JOIN ai_models m ON m.id = s.active_model_id
    WHERE s.id = 1
  `).get();
  return row || null;
}

export function updateSettings(input = {}) {
  const db = getDb();
  const current = getSettings() || {};

  const next = {
    confidence_threshold: clampNumber(input.confidence_threshold ?? current.confidence_threshold, 0, 1, 0.5),
    image_size: clampInt(input.image_size ?? current.image_size, 32, 4096, 640),
    device: ALLOWED_DEVICES.has(input.device) ? input.device : (current.device || 'cpu'),
    cam_method: typeof input.cam_method === 'string' && input.cam_method.length < 50
      ? input.cam_method
      : (current.cam_method || 'HiResCAM')
  };

  db.prepare(`
    UPDATE ai_settings
    SET confidence_threshold = ?, image_size = ?, device = ?, cam_method = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(next.confidence_threshold, next.image_size, next.device, next.cam_method);

  return getSettings();
}

export function listModels() {
  const db = getDb();
  return db.prepare('SELECT * FROM ai_models ORDER BY created_at DESC').all();
}

export function getModelById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM ai_models WHERE id = ?').get(id);
}

export function activateModel(modelId) {
  const db = getDb();
  const model = getModelById(modelId);
  if (!model) {
    const error = new Error('Model not found');
    error.status = 404;
    throw error;
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE ai_models SET is_active = 0').run();
    db.prepare('UPDATE ai_models SET is_active = 1 WHERE id = ?').run(modelId);
    db.prepare(`UPDATE ai_settings SET active_model_id = ?, updated_at = datetime('now') WHERE id = 1`).run(modelId);
  });
  tx();

  return getSettings();
}

const ALLOWED_TASK_TYPES = new Set(['detection', 'classification', 'segmentation', 'tabular', 'other']);

export function registerUploadedModel({
  originalName,
  storedFilename,
  sizeBytes,
  framework,
  version,
  taskType,
  metrics,
  classLabels,
  inputSize,
  datasetSource,
  notes
}) {
  const db = getDb();
  const root = getAllowedModelRoot();
  const filePath = path.join(root, storedFilename);
  ensurePathAllowed(filePath, root);

  const fw = ALLOWED_FRAMEWORKS.has(framework) ? framework : inferFramework(storedFilename);
  const safeVersion = typeof version === 'string' && version.length < 100 ? version : null;
  const safeTaskType = ALLOWED_TASK_TYPES.has(taskType) ? taskType : null;
  const safeNotes = typeof notes === 'string' && notes.length < 2000 ? notes : null;
  const safeDataset = typeof datasetSource === 'string' && datasetSource.length < 500 ? datasetSource : null;
  const safeInputSize = Number.isFinite(Number(inputSize)) ? parseInt(inputSize, 10) : null;

  const metricsJson = metrics ? safeStringify(metrics) : null;
  const labelsJson = classLabels ? safeStringify(classLabels) : null;

  const result = db.prepare(`
    INSERT INTO ai_models (
      name, version, file_path, framework, task_type, size_bytes,
      metrics_json, class_labels_json, input_size, dataset_source, notes, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    originalName, safeVersion, filePath, fw, safeTaskType, sizeBytes,
    metricsJson, labelsJson, safeInputSize, safeDataset, safeNotes
  );

  return getModelById(result.lastInsertRowid);
}

export function updateModelMetadata(modelId, patch = {}) {
  const db = getDb();
  const model = getModelById(modelId);
  if (!model) {
    const error = new Error('Model not found');
    error.status = 404;
    throw error;
  }

  const fields = [];
  const values = [];

  if (patch.taskType !== undefined) {
    const v = ALLOWED_TASK_TYPES.has(patch.taskType) ? patch.taskType : null;
    fields.push('task_type = ?'); values.push(v);
  }
  if (patch.metrics !== undefined) {
    fields.push('metrics_json = ?'); values.push(patch.metrics ? safeStringify(patch.metrics) : null);
  }
  if (patch.classLabels !== undefined) {
    fields.push('class_labels_json = ?'); values.push(patch.classLabels ? safeStringify(patch.classLabels) : null);
  }
  if (patch.inputSize !== undefined) {
    fields.push('input_size = ?'); values.push(Number.isFinite(Number(patch.inputSize)) ? parseInt(patch.inputSize, 10) : null);
  }
  if (patch.datasetSource !== undefined) {
    fields.push('dataset_source = ?'); values.push(typeof patch.datasetSource === 'string' ? patch.datasetSource.slice(0, 500) : null);
  }
  if (patch.notes !== undefined) {
    fields.push('notes = ?'); values.push(typeof patch.notes === 'string' ? patch.notes.slice(0, 2000) : null);
  }
  if (patch.version !== undefined) {
    fields.push('version = ?'); values.push(typeof patch.version === 'string' ? patch.version.slice(0, 100) : null);
  }

  if (fields.length === 0) return model;

  values.push(modelId);
  db.prepare(`UPDATE ai_models SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getModelById(modelId);
}

function safeStringify(value) {
  try {
    if (typeof value === 'string') {
      JSON.parse(value);
      return value;
    }
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function deleteModel(modelId) {
  const db = getDb();
  const model = getModelById(modelId);
  if (!model) {
    const error = new Error('Model not found');
    error.status = 404;
    throw error;
  }

  if (model.is_active) {
    const error = new Error('Active model cannot be deleted');
    error.status = 400;
    throw error;
  }

  const root = getAllowedModelRoot();
  const safePath = ensurePathAllowed(model.file_path, root);

  if (fs.existsSync(safePath)) {
    fs.unlinkSync(safePath);
  }

  db.prepare('DELETE FROM ai_models WHERE id = ?').run(modelId);
  return { success: true };
}

function inferFramework(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.onnx') return 'onnx';
  if (ext === '.pkl') return 'sklearn';
  return 'pytorch';
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampInt(value, min, max, fallback) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export const VALIDATION = {
  ALLOWED_EXTENSIONS,
  ALLOWED_DEVICES,
  ALLOWED_FRAMEWORKS
};
