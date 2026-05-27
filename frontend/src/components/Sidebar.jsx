import { memo } from 'react';
import { LayoutDashboard, Container, FolderGit2, Brain, ScrollText, LogOut } from 'lucide-react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'containers', label: 'Containers', icon: Container },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'ai', label: 'AI Models', icon: Brain },
  { id: 'audit', label: 'Audit Log', icon: ScrollText }
];

function Sidebar({ active, onChange, user, onLogout }) {
  return (
    <aside
      className="border-r border-border bg-bg/85 backdrop-blur p-5 flex flex-col gap-6 sticky top-0 h-screen lg:w-60 w-full"
      aria-label="Primary navigation"
    >
      <div className="flex gap-3 items-center">
        <div
          className="w-10 h-10 rounded-2xl grid place-items-center font-extrabold text-slate-900 bg-gradient-to-br from-blue-400 to-emerald-400"
          aria-hidden="true"
        >
          AI
        </div>
        <div>
          <p className="font-bold text-sm m-0">Server Panel</p>
          <p className="text-ink-muted text-xs m-0">Local AI Control</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1" aria-label="Sections">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-blue-400/15 text-blue-400'
                  : 'text-ink-muted hover:bg-slate-400/10 hover:text-ink'
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2.5">
        <div className="flex gap-2.5 items-center p-2.5 rounded-xl bg-slate-400/10">
          <div
            className="w-9 h-9 rounded-xl grid place-items-center font-extrabold text-slate-900 bg-gradient-to-br from-blue-400 to-emerald-400"
            aria-hidden="true"
          >
            {(user?.username || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="m-0 font-semibold text-sm truncate">{user?.username || 'unknown'}</p>
            <span className="text-ink-muted text-xs">{user?.role || 'admin'}</span>
          </div>
        </div>
        <button type="button" className="btn-danger justify-center" onClick={onLogout}>
          <LogOut size={15} aria-hidden="true" /> Logout
        </button>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
