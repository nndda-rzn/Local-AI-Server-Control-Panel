import { useCallback, useEffect, useState } from 'react';
import { Layout, Spin } from 'antd';
import Sidebar from './components/Sidebar.jsx';
import AppHeader from './components/AppHeader.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Containers from './pages/Containers.jsx';
import Projects from './pages/Projects.jsx';
import AIModels from './pages/AIModels.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Topology from './pages/Topology.jsx';
import DeploymentWizard from './pages/DeploymentWizard.jsx';
import Inference from './pages/Inference.jsx';
import Backups from './pages/Backups.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import { authApi, clearToken, getStoredUser, getToken, setStoredUser } from './api.js';

const { Sider, Content } = Layout;

const PAGES = {
  dashboard: Dashboard,
  topology: Topology,
  containers: Containers,
  projects: Projects,
  wizard: DeploymentWizard,
  ai: AIModels,
  inference: Inference,
  audit: AuditLog,
  backups: Backups,
  users: Users,
  settings: Settings
};

export default function App() {
  const [user, setUser] = useState(getStoredUser);
  const [authenticated, setAuthenticated] = useState(() => Boolean(getToken()));
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);

  useEffect(() => {
    if (!authenticated || user) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setBootLoading(true);

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
      })
      .finally(() => { if (!cancelled) setBootLoading(false); });

    return () => { cancelled = true; controller.abort(); };
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

  if (!authenticated) return <Login onLogin={handleLogin} />;
  if (bootLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const Page = PAGES[page] || Dashboard;

  return (
    <Layout>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={232}
        breakpoint="lg"
      >
        <Sidebar active={page} onChange={setPage} collapsed={collapsed} />
      </Sider>
      <Layout>
        <AppHeader
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          user={user}
          onLogout={handleLogout}
        />
        <Content className="page-content">
          <Page />
        </Content>
      </Layout>
    </Layout>
  );
}
