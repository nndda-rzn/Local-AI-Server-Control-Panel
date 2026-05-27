import { memo, useCallback, useState } from 'react';
import { Play, Square, RefreshCcw, Terminal, X } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { ErrorAlert, Spinner } from '../components/Feedback.jsx';
import { dockerApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime, formatPort } from '../utils/format.js';

const PROTECTED = new Set(['panel-backend', 'panel-frontend']);

function StatePill({ state }) {
  const map = {
    running: 'pill-success',
    exited: 'pill-danger',
    paused: 'pill-warn',
    restarting: 'pill-info'
  };
  return <span className={map[state] || 'pill-muted'}>{state}</span>;
}

const ContainerRow = memo(function ContainerRow({ container, busyKey, onAction, onLogs }) {
  const isProtected = PROTECTED.has(container.name);

  return (
    <tr>
      <td className="mono">
        {container.name}
        {isProtected && <span className="pill-warn ml-2">protected</span>}
      </td>
      <td className="text-sm">{container.image}</td>
      <td><StatePill state={container.state} /></td>
      <td className="text-xs text-ink-muted">{container.status}</td>
      <td className="mono text-xs text-ink-muted">
        {(container.ports || []).map((port, index) => (
          <div key={`${container.id}-port-${index}`}>{formatPort(port)}</div>
        ))}
      </td>
      <td className="text-xs text-ink-muted whitespace-nowrap">
        {container.created ? formatDateTime(new Date(container.created * 1000).toISOString()) : '-'}
      </td>
      <td className="text-xs">
        <span className="pill-muted">{container.restartPolicy || 'no'}</span>
        {container.restartCount > 0 && (
          <span className="text-ink-muted ml-1.5">×{container.restartCount}</span>
        )}
      </td>
      <td>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn-icon"
            aria-label={`Start ${container.name}`}
            disabled={busyKey === `${container.id}:start`}
            onClick={() => onAction(container, 'start')}
          >
            <Play size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={`Stop ${container.name}`}
            disabled={isProtected || busyKey === `${container.id}:stop`}
            onClick={() => onAction(container, 'stop')}
          >
            <Square size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={`Restart ${container.name}`}
            disabled={busyKey === `${container.id}:restart`}
            onClick={() => onAction(container, 'restart')}
          >
            <RefreshCcw size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={`View logs of ${container.name}`}
            onClick={() => onLogs(container)}
          >
            <Terminal size={15} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function Containers() {
  const fetchList = useCallback((signal) => dockerApi.list(signal), []);
  const { data, error, loading, refresh } = useApi(fetchList, [], { pollMs: 12000 });

  const [logs, setLogs] = useState({ name: '', text: '', loading: false });
  const [pending, setPending] = useState({ open: false, container: null, action: null });
  const [busyKey, setBusyKey] = useState(null);
  const [actionError, setActionError] = useState(null);

  const containers = data?.containers || [];

  const viewLogs = useCallback(async (container) => {
    setLogs({ name: container.name, text: 'Loading...', loading: true });
    try {
      const result = await dockerApi.logs(container.name, 200);
      setLogs({ name: container.name, text: result.logs || '(empty)', loading: false });
    } catch (err) {
      setLogs({ name: container.name, text: `Error: ${err.message}`, loading: false });
    }
  }, []);

  const closeLogs = useCallback(() => {
    setLogs({ name: '', text: '', loading: false });
  }, []);

  const requestAction = useCallback((container, action) => {
    if (action === 'start') {
      executeAction(container, action);
      return;
    }
    setPending({ open: true, container, action });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function executeAction(container, action) {
    setBusyKey(`${container.id}:${action}`);
    setActionError(null);
    try {
      await dockerApi.action(container.name, action);
      await refresh();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyKey(null);
      setPending({ open: false, container: null, action: null });
    }
  }

  const cancelPending = useCallback(() => {
    setPending({ open: false, container: null, action: null });
  }, []);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Docker"
        title="Containers"
        description={`${containers.length} container terdeteksi.`}
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
                <th>Image</th>
                <th>State</th>
                <th>Status</th>
                <th>Ports</th>
                <th>Created</th>
                <th>Restart</th>
                <th className="w-44">Action</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => (
                <ContainerRow
                  key={container.id}
                  container={container}
                  busyKey={busyKey}
                  onAction={requestAction}
                  onLogs={viewLogs}
                />
              ))}
              {containers.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center py-7 text-ink-muted">Belum ada container terdeteksi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {logs.name && (
        <section className="card" aria-live="polite">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold m-0 mb-1">Logs: {logs.name}</h2>
              <p className="text-ink-muted text-sm m-0">200 baris terakhir.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={closeLogs} aria-label="Close logs">
              <X size={15} aria-hidden="true" /> Close
            </button>
          </div>
          <pre className="max-h-[460px] overflow-auto bg-slate-950 text-slate-300 rounded-2xl border border-border p-4 text-xs whitespace-pre-wrap break-words m-0">
            {logs.text}
          </pre>
        </section>
      )}

      <ConfirmModal
        open={pending.open}
        title={pending.action === 'stop' ? 'Stop container?' : 'Restart container?'}
        message={`Aksi ${pending.action} akan dijalankan pada container "${pending.container?.name}". Lanjutkan?`}
        confirmLabel={pending.action === 'stop' ? 'Stop' : 'Restart'}
        danger={pending.action === 'stop'}
        onCancel={cancelPending}
        onConfirm={() => executeAction(pending.container, pending.action)}
        loading={Boolean(busyKey)}
      />
    </div>
  );
}
