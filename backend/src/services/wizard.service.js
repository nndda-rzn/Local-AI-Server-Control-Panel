import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import net from 'node:net';
import { ensurePathAllowed, getAllowedProjectRoot, fileExists } from '../utils/paths.js';

export function validateCompose(projectDir, composeFileName = 'docker-compose.yml') {
  const root = getAllowedProjectRoot();
  const safeDir = ensurePathAllowed(projectDir, root);
  const composePath = path.join(safeDir, composeFileName);

  if (!fileExists(composePath)) {
    return {
      ok: false,
      errors: [`Compose file not found: ${composeFileName}`],
      warnings: [],
      services: []
    };
  }

  let parsed;
  try {
    const content = fs.readFileSync(composePath, 'utf8');
    parsed = yaml.load(content);
  } catch (error) {
    return {
      ok: false,
      errors: [`YAML parse error: ${error.message}`],
      warnings: [],
      services: []
    };
  }

  const errors = [];
  const warnings = [];

  if (!parsed || typeof parsed !== 'object') {
    errors.push('Compose file is empty or invalid');
    return { ok: false, errors, warnings, services: [] };
  }

  if (!parsed.services || typeof parsed.services !== 'object') {
    errors.push('No services defined in compose file');
    return { ok: false, errors, warnings, services: [] };
  }

  const services = [];
  for (const [name, def] of Object.entries(parsed.services)) {
    const svc = {
      name,
      image: def?.image || (def?.build ? '(build)' : null),
      ports: def?.ports || [],
      env: def?.environment || {},
      volumes: def?.volumes || [],
      restart: def?.restart || null,
      depends_on: def?.depends_on || []
    };

    if (!svc.image) {
      warnings.push(`Service "${name}" has no image or build context`);
    }

    services.push(svc);
  }

  return { ok: errors.length === 0, errors, warnings, services };
}

export function validateEnv(projectDir, requiredVars = []) {
  const envPath = path.join(projectDir, '.env');
  const errors = [];
  const warnings = [];
  const found = {};

  if (!fileExists(envPath)) {
    if (requiredVars.length > 0) {
      warnings.push('.env file not found in project root');
    }
    return { ok: requiredVars.length === 0, errors, warnings, present: [] };
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      found[key] = value.length > 0;
    }
  } catch (error) {
    errors.push(`Failed to read .env: ${error.message}`);
    return { ok: false, errors, warnings, present: [] };
  }

  const missing = requiredVars.filter((v) => !found[v]);
  if (missing.length > 0) {
    errors.push(`Missing required env vars: ${missing.join(', ')}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    present: Object.keys(found),
    missing
  };
}

function checkPort(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') return resolve({ port, available: false });
        resolve({ port, available: false, error: err.code });
      })
      .once('listening', () => {
        tester.once('close', () => resolve({ port, available: true }));
        tester.close();
      })
      .listen(port, host);
  });
}

export async function checkPortConflicts(services = []) {
  const ports = new Set();
  for (const svc of services) {
    for (const portDef of (svc.ports || [])) {
      const portStr = typeof portDef === 'string' ? portDef : `${portDef.published || portDef.target}`;
      const match = portStr.match(/^(?:[\d.]+:)?(\d+)(?::|$)/);
      if (match) ports.add(parseInt(match[1], 10));
    }
  }

  const results = await Promise.all([...ports].map((p) => checkPort(p)));
  const conflicts = results.filter((r) => !r.available);

  return {
    ok: conflicts.length === 0,
    checked: results,
    conflicts: conflicts.map((c) => c.port)
  };
}
