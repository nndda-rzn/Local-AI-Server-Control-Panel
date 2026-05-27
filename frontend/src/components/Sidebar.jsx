import { Menu } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  RobotOutlined,
  AuditOutlined,
  PartitionOutlined,
  RocketOutlined,
  ExperimentOutlined,
  CloudUploadOutlined,
  TeamOutlined,
  SettingOutlined
} from '@ant-design/icons';

const NAV_ITEMS = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: 'topology', icon: <PartitionOutlined />, label: 'Topology' },
  { key: 'containers', icon: <AppstoreOutlined />, label: 'Containers' },
  { key: 'projects', icon: <DeploymentUnitOutlined />, label: 'Projects' },
  { key: 'wizard', icon: <RocketOutlined />, label: 'Deploy Wizard' },
  { key: 'ai', icon: <RobotOutlined />, label: 'AI Models' },
  { key: 'inference', icon: <ExperimentOutlined />, label: 'Inference' },
  { key: 'audit', icon: <AuditOutlined />, label: 'Audit Log' },
  { key: 'backups', icon: <CloudUploadOutlined />, label: 'Backups' },
  { key: 'users', icon: <TeamOutlined />, label: 'Users' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Settings' }
];

export default function SidebarMenu({ active, onChange, collapsed }) {
  return (
    <>
      <div className="brand-logo">
        <div className="brand-mark">AI</div>
        {!collapsed && (
          <div className="brand-text">
            <strong>Private AI Ops</strong>
            <span>Dashboard</span>
          </div>
        )}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[active]}
        onClick={({ key }) => onChange(key)}
        items={NAV_ITEMS}
        style={{ borderRight: 0, padding: '0 8px' }}
      />
    </>
  );
}
