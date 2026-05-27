import express from 'express';
import si from 'systeminformation';
import os from 'os';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(requireAuth);

async function checkCloudflared() {
  try {
    const procs = await si.processes();
    const found = procs.list.find((p) => /cloudflared/i.test(p.name) || /cloudflared/i.test(p.command || ''));
    return { active: Boolean(found), pid: found?.pid || null };
  } catch {
    return { active: false, pid: null };
  }
}

function collectIpAddresses() {
  const interfaces = os.networkInterfaces();
  const list = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs || []) {
      if (addr.internal) continue;
      if (addr.family !== 'IPv4') continue;
      list.push({ iface: name, address: addr.address });
    }
  }
  return list;
}

router.get('/status', async (req, res, next) => {
  try {
    const [cpuLoad, mem, fsSize, dockerInfo, cloudflared] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.dockerInfo().catch(() => null),
      checkCloudflared()
    ]);

    const rootDisk = fsSize.find((disk) => disk.mount === '/') || fsSize[0] || null;
    const ips = collectIpAddresses();

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      uptimeSeconds: os.uptime(),
      ips,
      primaryIp: ips[0]?.address || null,
      cpu: {
        loadPercent: Number(cpuLoad.currentLoad.toFixed(2)),
        cores: os.cpus()?.length || 0
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usedPercent: Number(((mem.used / mem.total) * 100).toFixed(2))
      },
      disk: rootDisk
        ? {
            mount: rootDisk.mount,
            size: rootDisk.size,
            used: rootDisk.used,
            available: rootDisk.available,
            usedPercent: Number(rootDisk.use.toFixed(2))
          }
        : null,
      docker: dockerInfo
        ? {
            available: true,
            version: dockerInfo.serverVersion,
            containers: dockerInfo.containers,
            containersRunning: dockerInfo.containersRunning,
            containersStopped: (dockerInfo.containers || 0) - (dockerInfo.containersRunning || 0),
            images: dockerInfo.images
          }
        : { available: false },
      cloudflared
    });
  } catch (error) {
    next(error);
  }
});

router.get('/health-check', async (req, res) => {
  const targets = (process.env.HEALTH_CHECK_TARGETS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (targets.length === 0) {
    return res.json({ targets: [], note: 'HEALTH_CHECK_TARGETS env not configured' });
  }

  const results = await Promise.all(targets.map(async (entry) => {
    const [name, url] = entry.includes('|') ? entry.split('|') : [entry, entry];
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return {
        name,
        url,
        status: response.status,
        ok: response.ok,
        latency_ms: Date.now() - start
      };
    } catch (error) {
      return {
        name,
        url,
        status: 0,
        ok: false,
        error: error.message,
        latency_ms: Date.now() - start
      };
    }
  }));

  res.json({ targets: results });
});

export default router;
