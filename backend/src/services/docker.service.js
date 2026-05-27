import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

function getAllowedPrefixes() {
  return (process.env.ALLOWED_CONTAINER_PREFIXES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeContainer(container) {
  const name = (container.Names?.[0] || '').replace(/^\//, '');
  const labels = container.Labels || {};
  return {
    id: container.Id,
    shortId: container.Id?.slice(0, 12),
    name,
    image: container.Image,
    state: container.State,
    status: container.Status,
    ports: container.Ports || [],
    created: container.Created,
    labels,
    project: labels['com.docker.compose.project'] || null,
    service: labels['com.docker.compose.service'] || null
  };
}

async function inspectRestartPolicy(containerId) {
  try {
    const inspect = await docker.getContainer(containerId).inspect();
    return {
      restartPolicy: inspect.HostConfig?.RestartPolicy?.Name || 'no',
      restartCount: inspect.RestartCount || 0
    };
  } catch {
    return { restartPolicy: null, restartCount: 0 };
  }
}

export async function listContainers({ withInspect = true } = {}) {
  const containers = await docker.listContainers({ all: true });
  const normalized = containers.map(normalizeContainer);

  if (!withInspect) return normalized;

  return Promise.all(normalized.map(async (c) => {
    const extra = await inspectRestartPolicy(c.id);
    return { ...c, ...extra };
  }));
}

export async function findContainerByNameOrId(nameOrId) {
  const containers = await docker.listContainers({ all: true });
  const normalized = containers.map(normalizeContainer);
  const found = normalized.find((container) => {
    return container.name === nameOrId || container.id === nameOrId || container.shortId === nameOrId;
  });

  if (!found) {
    const error = new Error('Container not found');
    error.status = 404;
    throw error;
  }

  return docker.getContainer(found.id);
}

export function ensureContainerAllowed(nameOrId) {
  const allowedPrefixes = getAllowedPrefixes();

  if (allowedPrefixes.length === 0) {
    return;
  }

  const isAllowed = allowedPrefixes.some((prefix) => nameOrId.startsWith(prefix));

  if (!isAllowed) {
    const error = new Error('Container action is not allowed by whitelist');
    error.status = 403;
    throw error;
  }
}

export async function getContainerLogs(nameOrId, tail = 150) {
  const container = await findContainerByNameOrId(nameOrId);
  const logsBuffer = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true
  });

  return logsBuffer.toString('utf8').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

export async function runContainerAction(nameOrId, action) {
  ensureContainerAllowed(nameOrId);
  const container = await findContainerByNameOrId(nameOrId);

  if (action === 'start') await container.start();
  else if (action === 'stop') await container.stop();
  else if (action === 'restart') await container.restart();
  else {
    const error = new Error('Unsupported container action');
    error.status = 400;
    throw error;
  }

  return { message: `Container ${action} requested`, container: nameOrId };
}
