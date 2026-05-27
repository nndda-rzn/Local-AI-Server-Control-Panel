import { memo, useCallback } from 'react';
import { Cpu, Activity, HardDrive, Database, Cloud, Server, RefreshCcw, Globe } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert, Spinner } from '../components/Feedback.jsx';
import { dashboardApi, systemApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatBytes, formatDateTime, formatUptime } from '../utils/format.js';

const InfoRow = memo(function InfoRow({ label, value }) {
  return (
    <li className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-slate-400/5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <strong className="font-semibold truncate ml-3 text-right">{value}</strong>
    </li>
  );
});

export default function Dashboard() {
  const fetchStatus = useCallback((signal) => systemApi.status(signal), []);
  const fetchSummary = useCallback((signal) => dashboardApi.summary(signal), []);

  const { data: system, error: sysErr, loading: sysLoading, refresh: refreshSys } = useApi(fetchStatus, [], { pollMs: 15000 });
  const { data: summary, error: sumErr, loading: sumLoading, refresh: refreshSum } = useApi(fetchSummary, [], { pollMs: 20000 });

  const cloudflared = system?.cloudflared;
  const counts = summary?.counts || {};
  const services = summary?.activeServices || [];
  const recentAudit = summary?.recentAudit || [];

  const refresh = useCallback(() => {
    refreshSys();
    refreshSum();
  }, [refreshSys, refreshSum]);

  const loading = sysLoading || sumLoading;
  const error = sysErr || sumErr;

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Status server real-time, refresh otomatis tiap 15-20 detik."
        actions={
          <button type="button" className="btn-secondary" onClick={refresh} disabled={loading} aria-busy={loading || undefined}>
            {loading ? <Spinner /> : <RefreshCcw size={15} aria-hidden="true" />}
            Refresh
          </button>
        }
      />

      <ErrorAlert error={error} onRetry={refresh} />

      <section className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Cpu size={20} aria-hidden="true" />}
          label="CPU Load"
          value={`${system?.cpu?.loadPercent ?? '-'}%`}
          helper={`${system?.cpu?.cores ?? 0} cores`}
        />
        <StatCard
          icon={<Activity size={20} aria-hidden="true" />}
          label="Memory"
          value={`${system?.memory?.usedPercent ?? '-'}%`}
          helper={system?.memory ? `${formatBytes(system.memory.used)} / ${formatBytes(system.memory.total)}` : '-'}
          accent="green"
        />
        <StatCard
          icon={<HardDrive size={20} aria-hidden="true" />}
          label="Disk"
          value={`${system?.disk?.usedPercent ?? '-'}%`}
          helper={system?.disk ? `${formatBytes(system.disk.used)} / ${formatBytes(system.disk.size)}` : '-'}
          accent="amber"
        />
        <StatCard
          icon={<Database size={20} aria-hidden="true" />}
          label="Docker"
          value={`${counts.running ?? '-'} running`}
          helper={`${counts.total ?? 0} total • ${counts.stopped ?? 0} stopped${counts.unhealthy ? ` • ${counts.unhealthy} unhealthy` : ''}`}
          accent="purple"
        />
      </section>

      <section className="grid gap-3.5 grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <article className="card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold m-0 mb-1">Server</h2>
              <p className="text-ink-muted text-sm m-0">Informasi host, IP, dan uptime.</p>
            </div>
            <Server size={18} aria-hidden="true" className="text-ink-muted" />
          </div>
          <ul className="grid gap-2.5 list-none m-0 p-0">
            <InfoRow label="Hostname" value={system?.hostname || '-'} />
            <InfoRow label="Platform" value={system?.platform || '-'} />
            <InfoRow label="Primary IP" value={system?.primaryIp || '-'} />
            <InfoRow label="Uptime" value={formatUptime(system?.uptimeSeconds)} />
            <InfoRow label="Docker" value={system?.docker?.available ? `v${system.docker.version || '?'}` : 'unavailable'} />
          </ul>
        </article>

        <article className="card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold m-0 mb-1">Network</h2>
              <p className="text-ink-muted text-sm m-0">IP interfaces & Cloudflare Tunnel.</p>
            </div>
            <Globe size={18} aria-hidden="true" className="text-ink-muted" />
          </div>

          <div className="mb-3">
            <span className={cloudflared?.active ? 'pill-success' : 'pill-muted'}>
              <Cloud size={12} aria-hidden="true" className="mr-1" />
              {cloudflared?.active ? 'Cloudflared Active' : 'Cloudflared Tidak terdeteksi'}
            </span>
            {cloudflared?.pid && (
              <span className="text-ink-muted text-xs ml-2">PID: {cloudflared.pid}</span>
            )}
          </div>

          <ul className="grid gap-1.5 list-none m-0 p-0">
            {(system?.ips || []).map((ip) => (
              <li key={`${ip.iface}-${ip.address}`} className="flex justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-400/5">
                <span className="text-ink-muted">{ip.iface}</span>
                <span className="mono">{ip.address}</span>
              </li>
            ))}
            {(!system?.ips || system.ips.length === 0) && (
              <li className="text-ink-muted text-xs">Tidak ada interface aktif.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="grid gap-3.5 grid-cols-1 lg:grid-cols-2">
        <article className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold m-0 mb-1">Active Services</h2>
            <p className="text-ink-muted text-sm m-0">{services.length} container running (top 10).</p>
          </div>
          <ul className="grid gap-2 list-none m-0 p-0">
            {services.map((svc) => (
              <li key={svc.name} className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-slate-400/5">
                <div className="min-w-0">
                  <p className="m-0 font-semibold text-sm truncate mono">{svc.name}</p>
                  <p className="m-0 text-xs text-ink-muted truncate">{svc.image}</p>
                </div>
                <span className="pill-success ml-2">running</span>
              </li>
            ))}
            {services.length === 0 && <li className="text-ink-muted text-xs">Tidak ada container running.</li>}
          </ul>
        </article>

        <article className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold m-0 mb-1">Latest Audit Activity</h2>
            <p className="text-ink-muted text-sm m-0">8 aksi terakhir.</p>
          </div>
          <ul className="grid gap-2 list-none m-0 p-0">
            {recentAudit.map((item) => (
              <li key={item.id} className="flex justify-between items-start gap-2 px-3 py-2.5 rounded-xl bg-slate-400/5">
                <div className="min-w-0">
                  <p className="m-0 text-sm mono truncate">{item.action}</p>
                  <p className="m-0 text-xs text-ink-muted truncate">
                    {item.actor_name || 'system'} → {item.target || '-'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={item.status === 'success' ? 'pill-success' : 'pill-danger'}>
                    {item.status}
                  </span>
                  <p className="m-0 text-[11px] text-ink-muted mt-1">{formatDateTime(item.timestamp)}</p>
                </div>
              </li>
            ))}
            {recentAudit.length === 0 && <li className="text-ink-muted text-xs">Belum ada aktivitas.</li>}
          </ul>
        </article>
      </section>
    </div>
  );
}
