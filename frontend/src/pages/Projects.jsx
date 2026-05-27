import { memo, useCallback, useState } from 'react';
import { Play, Square, RefreshCcw, History, Layers } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { ErrorAlert, Spinner } from '../components/Feedback.jsx';
import { projectsApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime, formatDuration } from '../utils/format.js';

const ACTION_LABEL = {
  deploy: 'Deploy (up -d)',
  down: 'Stop (down)',
  restart: 'Restart'
};

const ProjectRow = memo(function ProjectRow({ project, onAction, onHistory, onServices }) {
  return (
    <tr>
      <td className="mono">{project.name}</td>
      <td><span className="pill-muted">{project.type}</span></td>
      <td className="mono text-xs text-ink-muted">{project.compose_file}</td>
      <td className="mono text-xs text-ink-muted">{project.path}</td>
      <td>
        <div className="flex gap-1.5">
          <button type="button" className="btn-icon" aria-label={`Deploy ${project.name}`} onClick={() => onAction(project, 'deploy')}>
            <Play size={15} aria-hidden="true" />
          </button>
          <button type="button" className="btn-icon" aria-label={`Restart ${project.name}`} onClick={() => onAction(project, 'restart')}>
            <RefreshCcw size={15} aria-hidden="true" />
          </button>
          <button type="button" className="btn-icon" aria-label={`Stop ${project.name}`} onClick={() => onAction(project, 'down')}>
            <Square size={15} aria-hidden="true" />
          </button>
          <button type="button" className="btn-icon" aria-label={`Show services of ${project.name}`} onClick={() => onServices(project)}>
            <Layers size={15} aria-hidden="true" />
          </button>
          <button type="button" className="btn-icon" aria-label={`Show history of ${project.name}`} onClick={() => onHistory(project)}>
            <History size={15} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
});

function HistoryTable({ items }) {
  if (!items?.length) return <p className="text-ink-muted text-sm m-0">Belum ada history.</p>;
  return (
    <div className="overflow-auto rounded-2xl border border-border">
      <table className="table-base">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Status</th>
            <th>Duration</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="mono text-xs">{formatDateTime(item.timestamp)}</td>
              <td className="text-sm">{item.action}</td>
              <td>
                <span className={item.status === 'success' ? 'pill-success' : 'pill-danger'}>
                  {item.status}
                </span>
              </td>
              <td className="text-xs text-ink-muted">{formatDuration(item.duration_ms)}</td>
              <td className="text-xs">{item.actor_name || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Projects() {
  const fetchList = useCallback((signal) => projectsApi.list(signal), []);
  const { data, error, loading, refresh } = useApi(fetchList);

  const [historyMap, setHistoryMap] = useState({});
  const [servicesMap, setServicesMap] = useState({});
  const [output, setOutput] = useState({ open: false, project: null, action: null, text: '' });
  const [pending, setPending] = useState({ open: false, project: null, action: null });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const projects = data?.projects || [];

  const loadHistory = useCallback(async (project) => {
    try {
      const result = await projectsApi.history(project.id);
      setHistoryMap((prev) => ({ ...prev, [project.id]: result.history || [] }));
    } catch (err) {
      setActionError(err);
    }
  }, []);

  const loadServices = useCallback(async (project) => {
    try {
      const result = await projectsApi.detail(project.id);
      setServicesMap((prev) => ({ ...prev, [project.id]: result.services || [] }));
    } catch (err) {
      setActionError(err);
    }
  }, []);

  const requestAction = useCallback((project, action) => {
    setPending({ open: true, project, action });
  }, []);

  const cancelPending = useCallback(() => {
    setPending({ open: false, project: null, action: null });
  }, []);

  const closeOutput = useCallback(() => {
    setOutput({ open: false, project: null, action: null, text: '' });
  }, []);

  async function execute() {
    if (!pending.project) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await projectsApi.action(pending.project.id, pending.action);
      setOutput({ open: true, project: pending.project, action: pending.action, text: result.output || '(no output)' });
      await loadHistory(pending.project);
    } catch (err) {
      setOutput({
        open: true,
        project: pending.project,
        action: pending.action,
        text: err.payload?.output || err.message
      });
    } finally {
      setBusy(false);
      setPending({ open: false, project: null, action: null });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Deployment"
        title="Projects"
        description="Project terdeteksi dari folder whitelist (ALLOWED_PROJECT_ROOT)."
        actions={
          <button type="button" className="btn-secondary" onClick={refresh} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCcw size={15} aria-hidden="true" />}
            Refresh
          </button>
        }
      />

      <ErrorAlert error={error} onRetry={refresh} />
      <ErrorAlert error={actionError} />

      <section className="card !p-0 overflow-hidden">
        <div className="overflow-auto">
          <table className="table-base min-w-[820px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Compose File</th>
                <th>Path</th>
                <th className="w-44">Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onAction={requestAction}
                  onHistory={loadHistory}
                  onServices={loadServices}
                />
              ))}
              {projects.length === 0 && !loading && (
                <tr><td colSpan={5} className="text-center py-7 text-ink-muted">Belum ada project di folder whitelist.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {Object.keys(servicesMap).length > 0 && (
        <section className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold m-0 mb-1">Compose Services</h2>
            <p className="text-ink-muted text-sm m-0">Definisi service dari file compose.</p>
          </div>
          <div className="grid gap-5">
            {Object.entries(servicesMap).map(([projectId, services]) => {
              const project = projects.find((p) => String(p.id) === String(projectId));
              return (
                <div key={`svc-${projectId}`}>
                  <h3 className="text-xs uppercase tracking-wider text-ink-muted m-0 mb-2">
                    {project?.name || `Project #${projectId}`}
                  </h3>
                  {services.length === 0 ? (
                    <p className="text-ink-muted text-sm m-0">Tidak ada service terdefinisi.</p>
                  ) : (
                    <div className="overflow-auto rounded-2xl border border-border">
                      <table className="table-base">
                        <thead>
                          <tr>
                            <th>Service</th>
                            <th>Image</th>
                            <th>Ports</th>
                            <th>Restart</th>
                          </tr>
                        </thead>
                        <tbody>
                          {services.map((svc) => (
                            <tr key={`${projectId}-${svc.name}`}>
                              <td className="mono text-sm">{svc.name}</td>
                              <td className="text-sm">{svc.image || '-'}</td>
                              <td className="mono text-xs text-ink-muted">
                                {(svc.ports || []).map((p, idx) => (
                                  <div key={`${svc.name}-port-${idx}`}>{typeof p === 'string' ? p : JSON.stringify(p)}</div>
                                ))}
                              </td>
                              <td className="text-xs text-ink-muted">{svc.restart || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {Object.keys(historyMap).length > 0 && (
        <section className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold m-0 mb-1">Deployment History</h2>
            <p className="text-ink-muted text-sm m-0">Riwayat aksi deploy/down/restart project.</p>
          </div>
          <div className="grid gap-5">
            {Object.entries(historyMap).map(([projectId, items]) => {
              const project = projects.find((p) => String(p.id) === String(projectId));
              return (
                <div key={projectId}>
                  <h3 className="text-xs uppercase tracking-wider text-ink-muted m-0 mb-2">
                    {project?.name || `Project #${projectId}`}
                  </h3>
                  <HistoryTable items={items} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {output.open && (
        <section className="card" aria-live="polite">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold m-0 mb-1">
                Output: {output.project?.name} • {output.action}
              </h2>
              <p className="text-ink-muted text-sm m-0">Hasil eksekusi compose.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={closeOutput}>Close</button>
          </div>
          <pre className="max-h-[460px] overflow-auto bg-slate-950 text-slate-300 rounded-2xl border border-border p-4 text-xs whitespace-pre-wrap break-words m-0">
            {output.text}
          </pre>
        </section>
      )}

      <ConfirmModal
        open={pending.open}
        title={ACTION_LABEL[pending.action] || pending.action}
        message={`Jalankan aksi "${ACTION_LABEL[pending.action] || pending.action}" pada project "${pending.project?.name}"?`}
        confirmLabel="Jalankan"
        danger={pending.action === 'down'}
        onCancel={cancelPending}
        onConfirm={execute}
        loading={busy}
      />
    </div>
  );
}
