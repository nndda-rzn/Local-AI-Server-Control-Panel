import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Containers from './pages/Containers.jsx';
import Projects from './pages/Projects.jsx';
import AIModels from './pages/AIModels.jsx';
import AuditLog from './pages/AuditLog.jsx';
import { authApi, clearToken, getStoredUser, getToken, setStoredUser } from './api.js';

const PAGES = {
  dashboard: Dashboard,
  containers: Containers,
  projects: Projects,
  ai: AIModels,
  audit: AuditLog
};

export default function App() {
  const [user, setUser] = useState(getStoredUser);
  const [authenticated, setAuthenticated] = useState(() => Boolean(getToken()));
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    if (!authenticated || user) return undefined;

    const controller = new AbortController();
    let cancelled = false;

    authApi.me(controller.signal)
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setStoredUser(data.user);
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return;
        clearToken();
        setAuthenticated(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authenticated, user]);

  const handleLogin = useCallback((loggedUser) => {
    setUser(loggedUser);
    setAuthenticated(true);
  }, []);

  const handleLogout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    clearToken();
    setUser(null);
    setAuthenticated(false);
  }, []);

  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const Page = PAGES[page] || Dashboard;

  return (
    <>
      <a href="#main-content" className="skip-link">Lewati ke konten utama</a>
      <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr] min-h-screen">
        <Sidebar active={page} onChange={setPage} user={user} onLogout={handleLogout} />
        <main id="main-content" className="px-4 py-6 sm:px-8 sm:py-7 overflow-x-auto">
          <div className="w-full max-w-[1240px] mx-auto">
            <Page />
          </div>
        </main>
      </div>
    </>
  );
}
