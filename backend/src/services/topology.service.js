import { listContainers } from './docker.service.js';
import { listProjects } from './project.service.js';
import si from 'systeminformation';

async function getCloudflaredStatus() {
  try {
    const procs = await si.processes();
    const found = procs.list.find((p) => /cloudflared/i.test(p.name) || /cloudflared/i.test(p.command || ''));
    return Boolean(found);
  } catch {
    return false;
  }
}

function inferNodeType(image, name) {
  const lower = `${image} ${name}`.toLowerCase();
  if (/postgres|mysql|mariadb|mongo/.test(lower)) return 'database';
  if (/redis|memcached/.test(lower)) return 'cache';
  if (/nginx|traefik|caddy/.test(lower)) return 'proxy';
  if (/inference|yolo|onnx|fastapi.*ai/.test(lower)) return 'ai';
  if (/api|backend|express|fastapi/.test(lower)) return 'api';
  if (/web|frontend|vite|react/.test(lower)) return 'web';
  return 'service';
}

function nodeStatus(container) {
  if (!container) return 'unknown';
  if (container.state === 'running') {
    if (/unhealthy/i.test(container.status || '')) return 'warning';
    return 'online';
  }
  if (container.state === 'exited' || container.state === 'dead') return 'offline';
  return 'warning';
}

export async function buildTopology() {
  const [containers, projects, cloudflaredActive] = await Promise.all([
    listContainers({ withInspect: false }).catch(() => []),
    Promise.resolve(listProjects()),
    getCloudflaredStatus()
  ]);

  const nodes = [];
  const edges = [];

  // 1. Cloudflare Tunnel node (entry point)
  nodes.push({
    id: 'cloudflared',
    type: 'tunnel',
    label: 'Cloudflare Tunnel',
    status: cloudflaredActive ? 'online' : 'offline',
    meta: { description: 'Public access via Cloudflare' }
  });

  // 2. Reverse proxy / panel frontend
  const panelFrontend = containers.find((c) => c.name === 'panel-frontend');
  nodes.push({
    id: 'panel-frontend',
    type: 'proxy',
    label: 'Panel Frontend',
    status: nodeStatus(panelFrontend),
    meta: {
      container: panelFrontend?.name || 'panel-frontend',
      image: panelFrontend?.image,
      ports: panelFrontend?.ports
    }
  });
  edges.push({ id: 'e-cf-fe', source: 'cloudflared', target: 'panel-frontend' });

  // 3. Backend API
  const panelBackend = containers.find((c) => c.name === 'panel-backend');
  nodes.push({
    id: 'panel-backend',
    type: 'api',
    label: 'Panel Backend',
    status: nodeStatus(panelBackend),
    meta: {
      container: panelBackend?.name || 'panel-backend',
      image: panelBackend?.image,
      ports: panelBackend?.ports
    }
  });
  edges.push({ id: 'e-fe-be', source: 'panel-frontend', target: 'panel-backend' });

  // 4. Project containers grouped by project label
  const containersByProject = new Map();
  for (const c of containers) {
    if (c.name === 'panel-frontend' || c.name === 'panel-backend') continue;
    const projectKey = c.project || 'standalone';
    if (!containersByProject.has(projectKey)) {
      containersByProject.set(projectKey, []);
    }
    containersByProject.get(projectKey).push(c);
  }

  for (const project of projects) {
    const groupId = `project-${project.id}`;
    nodes.push({
      id: groupId,
      type: 'project',
      label: project.name,
      status: 'online',
      meta: { path: project.path, projectType: project.type }
    });
    edges.push({ id: `e-be-${groupId}`, source: 'panel-backend', target: groupId });

    const projectContainers = containersByProject.get(project.name) || [];
    for (const c of projectContainers) {
      const nodeId = `c-${c.id?.slice(0, 8) || c.name}`;
      nodes.push({
        id: nodeId,
        type: inferNodeType(c.image, c.name),
        label: c.service || c.name,
        status: nodeStatus(c),
        meta: {
          container: c.name,
          image: c.image,
          ports: c.ports,
          state: c.state,
          dockerStatus: c.status
        }
      });
      edges.push({ id: `e-${groupId}-${nodeId}`, source: groupId, target: nodeId });
    }
  }

  // Standalone containers (not in any tracked project)
  const standalone = containersByProject.get('standalone') || [];
  if (standalone.length > 0) {
    const groupId = 'standalone-group';
    nodes.push({
      id: groupId,
      type: 'project',
      label: 'Standalone Containers',
      status: 'online',
      meta: { description: 'Containers not part of tracked projects' }
    });
    edges.push({ id: `e-be-${groupId}`, source: 'panel-backend', target: groupId });
    for (const c of standalone) {
      const nodeId = `c-${c.id?.slice(0, 8) || c.name}`;
      nodes.push({
        id: nodeId,
        type: inferNodeType(c.image, c.name),
        label: c.name,
        status: nodeStatus(c),
        meta: {
          container: c.name,
          image: c.image,
          ports: c.ports,
          state: c.state,
          dockerStatus: c.status
        }
      });
      edges.push({ id: `e-${groupId}-${nodeId}`, source: groupId, target: nodeId });
    }
  }

  return {
    nodes,
    edges,
    summary: {
      totalNodes: nodes.length,
      online: nodes.filter((n) => n.status === 'online').length,
      offline: nodes.filter((n) => n.status === 'offline').length,
      warning: nodes.filter((n) => n.status === 'warning').length
    }
  };
}

export function getNodeDetail(nodeId, topology) {
  return topology.nodes.find((n) => n.id === nodeId) || null;
}
