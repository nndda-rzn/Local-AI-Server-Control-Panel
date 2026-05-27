import { memo } from 'react';

const StatCard = memo(function StatCard({ icon, label, value, helper, accent = 'blue' }) {
  const accentMap = {
    blue: 'bg-blue-400/15 text-blue-400',
    green: 'bg-emerald-400/15 text-emerald-400',
    amber: 'bg-amber-400/15 text-amber-400',
    purple: 'bg-violet-400/15 text-violet-400'
  };

  return (
    <div className="stat-card">
      <div className={`grid place-items-center w-11 h-11 rounded-2xl ${accentMap[accent] || accentMap.blue}`} aria-hidden="true">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted m-0">{label}</p>
        <strong className="block text-2xl font-semibold mt-1 truncate">{value}</strong>
        {helper && <span className="text-xs text-ink-muted">{helper}</span>}
      </div>
    </div>
  );
});

export default StatCard;
