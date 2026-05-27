const TOKEN_KEY = 'panel_token';
const USER_KEY = 'panel_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function api(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    clearToken();
  }

  if (!response.ok) {
    throw new ApiError(data.message || `Request failed (${response.status})`, response.status, data);
  }

  return data;
}

export const authApi = {
  login: (username, password, signal) => api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    signal
  }),
  logout: (signal) => api('/auth/logout', { method: 'POST', signal }),
  me: (signal) => api('/auth/me', { signal })
};

export const systemApi = {
  status: (signal) => api('/system/status', { signal }),
  healthCheck: (signal) => api('/system/health-check', { signal })
};

export const dashboardApi = {
  summary: (signal) => api('/dashboard/summary', { signal })
};

export const dockerApi = {
  list: (signal) => api('/docker/containers', { signal }),
  logs: (name, tail = 200, signal) => api(`/docker/containers/${encodeURIComponent(name)}/logs?tail=${tail}`, { signal }),
  action: (name, action, signal) => api(`/docker/containers/${encodeURIComponent(name)}/${action}`, { method: 'POST', signal })
};

export const projectsApi = {
  list: (signal) => api('/projects', { signal }),
  detail: (id, signal) => api(`/projects/${id}`, { signal }),
  history: (id, signal) => api(`/projects/${id}/history`, { signal }),
  action: (id, action, signal) => api(`/projects/${id}/${action}`, { method: 'POST', signal })
};

export const aiApi = {
  getSettings: (signal) => api('/ai/settings', { signal }),
  updateSettings: (payload, signal) => api('/ai/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
    signal
  }),
  listModels: (signal) => api('/ai/models', { signal }),
  uploadModel: (formData, signal) => api('/ai/models/upload', {
    method: 'POST',
    body: formData,
    signal
  }),
  activateModel: (id, signal) => api(`/ai/models/${id}/activate`, { method: 'POST', signal }),
  deleteModel: (id, signal) => api(`/ai/models/${id}`, { method: 'DELETE', signal }),
  testInference: (payload = {}, signal) => api('/ai/test-inference', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal
  })
};

export const auditApi = {
  list: ({ limit = 100, offset = 0, action, from, to } = {}, signal) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (action) params.append('action', action);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return api(`/audit?${params.toString()}`, { signal });
  }
};
