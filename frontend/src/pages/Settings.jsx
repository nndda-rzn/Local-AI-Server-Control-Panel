import { useCallback, useState } from 'react';
import {
  Card, Form, Input, Button, Space, Typography, Tag, Descriptions,
  Divider, App as AntApp
} from 'antd';
import {
  LockOutlined, UserOutlined, SafetyOutlined, SaveOutlined, KeyOutlined
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import { authApi, getStoredUser, setStoredUser } from '../api.js';

const { Text, Paragraph } = Typography;

function ProfileCard({ user }) {
  return (
    <Card title={<Space><UserOutlined /> Profile</Space>} style={{ marginBottom: 16 }}>
      <Descriptions column={1} size="small" labelStyle={{ width: 140, color: '#64748B' }}>
        <Descriptions.Item label="Username">
          <span className="mono">{user?.username || '-'}</span>
        </Descriptions.Item>
        <Descriptions.Item label="Role">
          <Tag color={user?.role === 'owner' ? 'gold' : user?.role === 'admin' ? 'blue' : 'default'}>
            {user?.role || 'admin'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="User ID">
          <Text type="secondary" className="mono">#{user?.id || '-'}</Text>
        </Descriptions.Item>
      </Descriptions>
      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
        Username dikelola via env <span className="mono">ADMIN_USERNAME</span>. Untuk mengubah,
        edit file <span className="mono">.env</span> dan restart backend.
      </Paragraph>
    </Card>
  );
}

function ChangePasswordCard({ onChanged }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { message } = AntApp.useApp();

  const handleFinish = useCallback(async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Konfirmasi password tidak cocok');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      message.success('Password berhasil diubah');
      form.resetFields();
      onChanged?.();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, message, onChanged]);

  return (
    <Card title={<Space><KeyOutlined /> Change Password</Space>} style={{ marginBottom: 16 }}>
      <Paragraph type="secondary" style={{ fontSize: 13 }}>
        Minimum 8 karakter. Disarankan kombinasi huruf besar, angka, dan simbol.
      </Paragraph>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        autoComplete="off"
        style={{ maxWidth: 480 }}
      >
        <Form.Item
          name="currentPassword"
          label="Password saat ini"
          rules={[{ required: true, message: 'Password lama wajib diisi' }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="Password baru"
          rules={[
            { required: true, message: 'Password baru wajib diisi' },
            { min: 8, message: 'Minimal 8 karakter' }
          ]}
          hasFeedback
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Konfirmasi password baru"
          dependencies={['newPassword']}
          hasFeedback
          rules={[
            { required: true, message: 'Konfirmasi password wajib diisi' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('Konfirmasi tidak cocok'));
              }
            })
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={submitting} icon={<SaveOutlined />}>
            Simpan password
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

function SecurityInfoCard() {
  return (
    <Card title={<Space><SafetyOutlined /> Security & Allowed Paths</Space>}>
      <Paragraph type="secondary" style={{ fontSize: 13 }}>
        Konfigurasi keamanan dikelola via environment variable di <span className="mono">.env</span> root project.
        Field readonly di sini hanya untuk informasi.
      </Paragraph>

      <Descriptions column={1} size="small" labelStyle={{ width: 220, color: '#64748B' }} bordered>
        <Descriptions.Item label="ALLOWED_PROJECT_ROOT">
          <span className="mono">{'/server/apps'}</span>
          <Tag style={{ marginLeft: 8 }}>scan target compose</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="ALLOWED_MODEL_ROOT">
          <span className="mono">{'/server/data/models'}</span>
          <Tag style={{ marginLeft: 8 }}>upload destination</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="ALLOWED_CONTAINER_PREFIXES">
          <span className="mono">panel-, nginx-test, cdss-, ai-, postgres, redis</span>
        </Descriptions.Item>
        <Descriptions.Item label="MAX_MODEL_UPLOAD_MB">
          <span className="mono">500 MB</span>
        </Descriptions.Item>
        <Descriptions.Item label="LOG_TAIL_LIMIT">
          <span className="mono">200 baris</span>
        </Descriptions.Item>
        <Descriptions.Item label="JWT expiration">
          <span className="mono">8 jam</span>
        </Descriptions.Item>
        <Descriptions.Item label="Login rate limit">
          <span className="mono">10 attempt / 15 menit</span>
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        Untuk mengubah whitelist atau limit, edit file <span className="mono">.env</span> di root project,
        lalu restart panel-backend container atau jalankan <span className="mono">npm run dev:be</span>.
      </Paragraph>
    </Card>
  );
}

export default function Settings() {
  const [user, setUser] = useState(getStoredUser);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      setStoredUser(data.user);
    } catch {}
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Kelola profil admin, password, dan lihat konfigurasi keamanan."
      />

      <ProfileCard user={user} />
      <ChangePasswordCard onChanged={refreshUser} />
      <SecurityInfoCard />
    </>
  );
}
