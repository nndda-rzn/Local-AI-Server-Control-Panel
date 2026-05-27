import path from 'node:path';
import fs from 'node:fs';
import { getDb } from '../db/index.js';
import { getModelById } from './ai.service.js';

const RESULTS_DIR = process.env.INFERENCE_RESULTS_DIR || '/server/data/inference-results';

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

export async function runInferenceTest({ imagePath, originalFilename, actorName }) {
  const db = getDb();
  const endpoint = process.env.AI_INFERENCE_URL;

  const settingsRow = db.prepare('SELECT active_model_id FROM ai_settings WHERE id = 1').get();
  const activeModel = settingsRow?.active_model_id ? getModelById(settingsRow.active_model_id) : null;

  if (!endpoint) {
    const error = new Error('AI_INFERENCE_URL is not configured');
    error.status = 503;
    throw error;
  }

  ensureResultsDir();
  const start = Date.now();

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const formData = new FormData();
    const blob = new Blob([imageBuffer]);
    formData.append('file', blob, originalFilename);
    if (activeModel?.name) formData.append('model', activeModel.name);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timer);

    const inferenceTime = Date.now() - start;
    const data = await response.json().catch(() => ({}));

    let visualizationPath = null;
    if (data.visualization_base64) {
      const fname = `viz-${Date.now()}.jpg`;
      visualizationPath = path.join(RESULTS_DIR, fname);
      fs.writeFileSync(visualizationPath, Buffer.from(data.visualization_base64, 'base64'));
    } else if (data.visualization_url) {
      visualizationPath = data.visualization_url;
    }

    const status = response.ok ? 'success' : 'failed';
    const result = db.prepare(`
      INSERT INTO inference_history
        (model_id, model_name, input_file, result_json, visualization_path, inference_time_ms, status, actor_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      activeModel?.id || null,
      activeModel?.name || null,
      originalFilename,
      JSON.stringify(data),
      visualizationPath,
      inferenceTime,
      status,
      actorName || null
    );

    return {
      id: result.lastInsertRowid,
      ok: response.ok,
      status,
      inference_time_ms: inferenceTime,
      result: data,
      visualization_path: visualizationPath,
      model: activeModel ? { id: activeModel.id, name: activeModel.name, version: activeModel.version } : null
    };
  } catch (error) {
    const inferenceTime = Date.now() - start;
    db.prepare(`
      INSERT INTO inference_history
        (model_id, model_name, input_file, result_json, inference_time_ms, status, actor_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      activeModel?.id || null,
      activeModel?.name || null,
      originalFilename,
      JSON.stringify({ error: error.message }),
      inferenceTime,
      'failed',
      actorName || null
    );
    error.inferenceTime = inferenceTime;
    throw error;
  }
}

export function listInferenceHistory({ limit = 50, offset = 0, modelId = null } = {}) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  if (modelId) {
    return db.prepare(`
      SELECT * FROM inference_history WHERE model_id = ? ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(modelId, safeLimit, safeOffset);
  }
  return db.prepare(`
    SELECT * FROM inference_history ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(safeLimit, safeOffset);
}

export function getInferenceById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM inference_history WHERE id = ?').get(id);
}

export function countInferenceHistory() {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) AS total FROM inference_history').get()?.total || 0;
}

export { RESULTS_DIR };
