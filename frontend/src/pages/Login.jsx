import { useState } from 'react';
import { Form, Input, Button, Typography, App as AntApp } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { authApi, setStoredUser, setToken } from '../api.js';

const { Title, Text } = Typography;

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const { message } = AntApp.useApp();

  async function handleFinish(values) {
    setLoading(true);
    try {
      const data = await authApi.login(values.identifier, values.password);
      setToken(data.token);
      setStoredUser(data.user);
      message.success('Berhasil login');
      onLogin(data.user);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: 'linear-gradient(135deg, #F4F6F8 0%, #E6F6F0 100%)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#FFFFFF',
        padding: 32,
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(15, 23, 42, 0.08)',
        border: '1px solid #E5E7EB'
      }}>
        <div className="brand-mark" style={{ width: 48, height: 48, marginBottom: 18, fontSize: 16 }}>AI</div>
        <Title level={4} style={{ margin: 0 }}>Private AI Ops Dashboard</Title>
        <Text type="secondary">Masuk untuk mengelola server lokal Anda.</Text>

        <Form
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{ identifier: 'admin' }}
          style={{ marginTop: 24 }}
          requiredMark={false}
        >
          <Form.Item
            label="Username atau Email"
            name="identifier"
            rules={[{ required: true, message: 'Username atau email wajib diisi' }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" placeholder="admin atau admin@example.com" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Password wajib diisi' }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Login
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
