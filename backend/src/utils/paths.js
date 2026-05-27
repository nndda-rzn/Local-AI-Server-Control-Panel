import path from 'node:path';
import fs from 'node:fs';

export function getAllowedProjectRoot() {
  return process.env.ALLOWED_PROJECT_ROOT || '/server/apps';
}

export function getAllowedModelRoot() {
  return process.env.ALLOWED_MODEL_ROOT || '/server/data/models';
}

export function isPathInside(child, parent) {
  const resolvedChild = path.resolve(child);
  const resolvedParent = path.resolve(parent);
  const relative = path.relative(resolvedParent, resolvedChild);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function ensurePathAllowed(target, allowedRoot) {
  const resolvedTarget = path.resolve(target);
  const resolvedRoot = path.resolve(allowedRoot);

  if (resolvedTarget !== resolvedRoot && !isPathInside(resolvedTarget, resolvedRoot)) {
    const error = new Error(`Path is outside allowed root: ${allowedRoot}`);
    error.status = 403;
    throw error;
  }
  return resolvedTarget;
}

export function safeReadDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true });
}

export function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;
export function isSafeName(name) {
  return typeof name === 'string' && SAFE_NAME.test(name) && name.length > 0 && name.length < 200;
}
