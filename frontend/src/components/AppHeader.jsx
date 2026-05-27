import { Layout, Avatar, Dropdown, Button, Space, Typography } from 'antd';
import { LogoutOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

const { Header } = Layout;
const { Text } = Typography;

export default function AppHeader({ collapsed, onToggle, user, onLogout }) {
  const items = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: 600 }}>{user?.username || 'unknown'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{user?.role || 'admin'}</Text>
        </div>
      ),
      disabled: true
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: onLogout
    }
  ];

  return (
    <Header>
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      />

      <Space>
        <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar style={{ background: '#0E9F6E' }}>
              {(user?.username || '?').slice(0, 1).toUpperCase()}
            </Avatar>
            <span style={{ fontWeight: 500 }}>{user?.username || '...'}</span>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
}
