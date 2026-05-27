import cron from 'node-cron';
import { createBackup } from './backup.service.js';
import { recordAudit } from './audit.service.js';

const tasks = new Map();

function parseScopes(value) {
  if (!value) return ['db'];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runScheduledBackup({ scopes, label }) {
  const start = Date.now();
  try {
    const result = await createBackup({
      scopes,
      label: label || 'scheduled',
      actorName: 'scheduler'
    });
    recordAudit({
      actorName: 'scheduler',
      action: 'backup.scheduled',
      target: result.name,
      status: 'success',
      detail: { scopes: result.scopes, size_bytes: result.size_bytes, duration_ms: result.duration_ms }
    });
    console.log(`[scheduler] backup created: ${result.name} (${result.size_bytes} bytes, ${Date.now() - start}ms)`);
  } catch (error) {
    recordAudit({
      actorName: 'scheduler',
      action: 'backup.scheduled',
      target: label || 'scheduled',
      status: 'failed',
      detail: { error: error.message }
    });
    console.error(`[scheduler] backup failed: ${error.message}`);
  }
}

export function startBackupScheduler() {
  const expression = (process.env.BACKUP_SCHEDULE_CRON || '').trim();
  if (!expression) {
    console.log('[scheduler] BACKUP_SCHEDULE_CRON not set - backup scheduler disabled');
    return null;
  }

  if (!cron.validate(expression)) {
    console.error(`[scheduler] invalid BACKUP_SCHEDULE_CRON: ${expression}`);
    return null;
  }

  const scopes = parseScopes(process.env.BACKUP_SCHEDULE_SCOPES);
  const label = process.env.BACKUP_SCHEDULE_LABEL || 'scheduled';
  const timezone = process.env.BACKUP_SCHEDULE_TZ || 'Asia/Jakarta';

  const task = cron.schedule(expression, () => {
    runScheduledBackup({ scopes, label }).catch(() => {});
  }, { timezone });

  tasks.set('backup', task);
  console.log(`[scheduler] backup scheduler enabled: cron="${expression}" scopes=${scopes.join(',')} tz=${timezone}`);
  return task;
}

export function stopAllSchedulers() {
  for (const [name, task] of tasks.entries()) {
    try {
      task.stop();
      console.log(`[scheduler] stopped: ${name}`);
    } catch (error) {
      console.error(`[scheduler] failed to stop ${name}:`, error.message);
    }
  }
  tasks.clear();
}

export function getSchedulerStatus() {
  return {
    backup: {
      enabled: tasks.has('backup'),
      cron: process.env.BACKUP_SCHEDULE_CRON || null,
      scopes: parseScopes(process.env.BACKUP_SCHEDULE_SCOPES),
      timezone: process.env.BACKUP_SCHEDULE_TZ || 'Asia/Jakarta'
    }
  };
}
