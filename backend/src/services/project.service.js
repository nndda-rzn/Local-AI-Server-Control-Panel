import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { getDb } from '../db/index.js';
import {
  getAllowedProjectRoot,
  ensurePathAllowed,
  safeReadDir,
  fileExists,
  isSafeName
} from '../utils/paths.js';
import { runCompose } from './compose.service.js';

const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

export function detectComposeFile(projectDir) {
  for (const candidate of COMPOSE_FILES) {
    const full = path.join(projectDir, candidate);
    if (fileExists(full)) return candidate;
  }
  return null;
}

export function inferProjectType(projectName) {
  const lower = projectName.toLowerCase();
  if (lower.includes('ai') || lower.includes('inference')) return 'ai';
  if (lower.includes('api') || lower.includes('backend')) return 'api';
  if (lower.includes('web') || lower.includes('frontend') || lower.includes('ui')) return 'web';
  if (lower.includes('postgres') || lower.includes('db') || lower.includes('redis')) return 'database';
  return 'mixed';
}

export function scanProjects() {
  const root = getAllowedProjectRoot();
  if (!fs.existsSync(root)) return [];

  const entries = safeReadDir(root);
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!isSafeName(entry.name)) continue;

    const dir = path.join(root, entry.name);
    const composeFile = detectComposeFile(dir);
    if (!composeFile) continue;

    projects.push({
      name: entry.name,
      path: dir,
      compose_file: composeFile,
      type: inferProjectType(entry.name)
    });
  }

  return projects;
}

export function syncProjectsToDb() {
  const db = getDb();
  const discovered = scanProjects();

  const upsert = db.prepare(`
    INSERT INTO projects (name, path, compose_file, type, is_protected)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(name) DO UPDATE SET
      path = excluded.path,
      compose_file = excluded.compose_file,
      type = excluded.type
  `);

  const tx = db.transaction((items) => {
    for (const item of items) {
      upsert.run(item.name, item.path, item.compose_file, item.type);
    }
  });
  tx(discovered);

  return discovered;
}

export function listProjects() {
  syncProjectsToDb();
  const db = getDb();
  return db.prepare('SELECT * FROM projects ORDER BY name ASC').all();
}

export function getProjectById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

export function readComposeServices(project) {
  try {
    const composePath = path.join(project.path, project.compose_file);
    const content = fs.readFileSync(composePath, 'utf8');
    const parsed = yaml.load(content);
    if (!parsed || typeof parsed !== 'object' || !parsed.services) return [];

    return Object.entries(parsed.services).map(([name, def]) => ({
      name,
      image: def?.image || (def?.build ? 'build' : null),
      ports: def?.ports || [],
      restart: def?.restart || null
    }));
  } catch (error) {
    return [];
  }
}

export function listDeploymentHistory(projectId, limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM deployment_history
    WHERE project_id = ?
    ORDER BY id DESC LIMIT ?
  `).all(projectId, Math.min(Math.max(Number(limit) || 50, 1), 200));
}

export function recordDeployment({ project, action, status, output, duration, actorName }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO deployment_history (project_id, project_name, action, status, output, duration_ms, actor_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(project.id, project.name, action, status, output?.slice(0, 20000) || null, duration || null, actorName || null);
}

export async function executeProjectAction(project, action, actorName) {
  const projectDir = ensurePathAllowed(project.path, getAllowedProjectRoot());
  const composeFile = path.join(projectDir, project.compose_file);

  if (!fileExists(composeFile)) {
    const error = new Error('Compose file not found');
    error.status = 404;
    throw error;
  }

  if (project.is_protected && (action === 'down')) {
    const error = new Error('Project is protected and cannot be stopped from UI');
    error.status = 403;
    throw error;
  }

  try {
    const result = await runCompose({
      projectDir,
      composeFile,
      action: action === 'deploy' ? 'up' : action
    });
    recordDeployment({
      project,
      action,
      status: 'success',
      output: result.output,
      duration: result.duration,
      actorName
    });
    return { success: true, output: result.output, duration: result.duration };
  } catch (error) {
    recordDeployment({
      project,
      action,
      status: 'failed',
      output: error.output || error.message,
      duration: error.duration,
      actorName
    });
    throw error;
  }
}
