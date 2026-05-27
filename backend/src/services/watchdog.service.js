import cron from 'node-cron';
import { listContainers } from './docker.service.js';
import { notify } from './notification.service.js';
import { recordAudit } from './audit.service.js';

const PROTECTED_PREFIXES = ['panel-'];
const STATE = {
  task: null,
  lastAlert: new Map(),
  enabled: false
};

const ALERT_COOLDOWN_MS = Number(process.env.WATCHDOG_COOLDOWN_MS || 15 * 60 * 1000);

function shouldWatch(name) {
  const watchList = (process.env.WATCHDOG_TARGETS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (watchList.length === 0) return true;
  return watchList.some((target) => name === target || name.startsWith(target));
}

function isPanelProtected(name) {
  return PROTECTED_PREFIXES.some((prefix) => name.startsWith(prefix));
}

async function checkContainers() {
  let containers = [];
  try {
    containers = await listContainers({ withInspect: false });
  } catch (error) {
    console.error('[watchdog] failed to list containers:', error.message);
    return;
  }

  const now = Date.now();
  for (const c of containers) {
    if (!c.name) continue;
    if (isPanelProtected(c.name)) continue;
    if (!shouldWatch(c.name)) continue;

    const isUnhealthy = /unhealthy/i.test(c.status || '');
    const isDown = c.state !== 'running';

    if (!isUnhealthy && !isDown) {
      STATE.lastAlert.delete(c.name);
      continue;
    }

    const last = STATE.lastAlert.get(c.name) || 0;
    if (now - last < ALERT_COOLDOWN_MS) continue;

    STATE.lastAlert.set(c.name, now);

    const level = isDown ? 'error' : 'warn';
    const title = isDown ? `Container DOWN: ${c.name}` : `Container UNHEALTHY: ${c.name}`;
    const fields = {
      state: c.state,
      status: c.status,
      image: c.image,
      project: c.project || '-'
    };

    await notify({ level, title, body: 'Watchdog detected an issue.', fields }).catch(() => {});
    recordAudit({
      actorName: 'watchdog',
      action: isDown ? 'watchdog.container.down' : 'watchdog.container.unhealthy',
      target: c.name,
      status: 'warning',
      detail: fields
    });
    console.log(`[watchdog] alert sent for ${c.name} (${level})`);
  }
}

export function startWatchdog() {
  const expression = (process.env.WATCHDOG_CRON || '').trim();
  if (!expression) {
    console.log('[watchdog] WATCHDOG_CRON not set - watchdog disabled');
    return null;
  }

  if (!cron.validate(expression)) {
    console.error(`[watchdog] invalid WATCHDOG_CRON: ${expression}`);
    return null;
  }

  const timezone = process.env.WATCHDOG_TZ || 'Asia/Jakarta';
  const task = cron.schedule(expression, () => {
    checkContainers().catch((err) => console.error('[watchdog] check error:', err.message));
  }, { timezone });

  STATE.task = task;
  STATE.enabled = true;
  console.log(`[watchdog] enabled: cron="${expression}" cooldown=${ALERT_COOLDOWN_MS}ms tz=${timezone}`);
  return task;
}

export function stopWatchdog() {
  if (STATE.task) {
    try { STATE.task.stop(); } catch {}
    STATE.task = null;
    STATE.enabled = false;
    STATE.lastAlert.clear();
    console.log('[watchdog] stopped');
  }
}

export function getWatchdogStatus() {
  return {
    enabled: STATE.enabled,
    cron: process.env.WATCHDOG_CRON || null,
    targets: (process.env.WATCHDOG_TARGETS || '').split(',').map((s) => s.trim()).filter(Boolean),
    cooldown_ms: ALERT_COOLDOWN_MS,
    pending_alerts: STATE.lastAlert.size
  };
}
