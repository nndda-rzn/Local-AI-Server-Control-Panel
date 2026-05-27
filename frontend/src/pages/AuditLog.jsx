import { memo, useCallback, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert, Spinner } from '../components/Feedback.jsx';
import { auditApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime } from '../utils/format.js';

const FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'auth.login', label: 'Login' },
  { value: 'auth.logout', label: 'Logout' },
  { value: 'container.restart', label: 'Container Restart' },
  { value: 'container.stop', label: 'Container Stop' },
  { value: 'container.start', label: 'Container Start' },
  { value: 'project.deploy', label: 'Project Deploy' },
  { value: 'project.down', label: 'Project Down' },
  { value: 'project.restart', label: 'Project Restart' },
  { value: 'ai.settings.update', label: 'AI Settings' },
  { value: 'ai.model.upload', label: 'Model Upload' },
  { value: 'ai.model.activate', label: 'Model Activate' },
  { value: 'ai.model.delete', label: 'Model Delete' }
];

const AuditRow = memo(function AuditRow({ item }) {
  return (
    <tr>
      <td className="mono text-xs">{formatDateTime(item.timestamp)}</td>
      <td className="text-sm">{item.actor_name || '-'}</td>
      <td className="mono text-xs">{item.action}</td>
      <td className="mono text-xs text-ink-muted">{item.target || '-'}</td>
      <td>
        <span className={item.status === 'success' ? 'pill-success' : 'pill-danger'}>
          {item.status}
        </span>
      </td>
      <td className="mono text-xs text-ink-muted">{item.ip_address || '-'}</td>
      <td className="text-xs text-ink-muted max-w-[360px] break-words">{item.detail || '-'}</td>
    </tr>
  );
});

export default function AuditLog() {
  const [filter, setFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetcher = useCallback(
    (signal) => auditApi.list({
      limit: 200,
      action: filter || undefined,
      from: from || undefined,
      to: to || undefined
    }, signal),
    [filter, from, to]
  );

  const { data, error, loading, refresh } = useApi(fetcher, [filter, from, to]);

  const items = data?.items || [];
  const total = data?.total ?? 0;

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Security"
        title="Audit Log"
        description={`${total} entri tercatat. Menampilkan 200 terbaru.`}
        actions={
          <div className="flex flex-wrap gap-2.5 items-center">
            <label className="sr-only" htmlFor="audit-filter">Filter aksi</label>
            <select
              id="audit-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="field !w-auto min-w-[180px]"
            >
              {FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="audit-from">Dari tanggal</label>
            <input
              id="audit-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="field !w-auto"
              aria-label="Dari tanggal"
            />
            <label className="sr-only" htmlFor="audit-to">Sampai tanggal</label>
            <input
              id="audit-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="field !w-auto"
              aria-label="Sampai tanggal"
            />
            <button type="button" className="btn-secondary" onClick={refresh} disabled={loading}>
              {loading ? <Spinner /> : <RefreshCcw size={15} aria-hidden="true" />}
              Refresh
            </button>
          </div>
        }
      />

      <ErrorAlert error={error} onRetry={refresh} />

      <section className="card !p-0 overflow-hidden">
        <div className="overflow-auto">
          <table className="table-base min-w-[920px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Status</th>
                <th>IP</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <AuditRow key={item.id} item={item} />
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-7 text-ink-muted">Belum ada audit log.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
