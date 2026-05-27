import { useCallback, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, Select, Popconfirm,
  Switch, Typography, App as AntApp
} from 'antd';
import {
  ReloadOutlined, UserAddOutlined, EditOutlined, KeyOutlined,
  DeleteOutlined, UserOutlined, MailOutlined, LockOutlined
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { usersApi, getStoredUser } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime } from '../utils/format.js';

const { Text } = Typography;

const ROLES = [
  { value: 'owner', label: 'Owner', color: 'gold' },
  { value: 'admin', label: 'Admin', color: 'blue' },
  { value: 'viewer', label: 'Viewer', color: 'default' }
];

function roleColor(role) {
  return ROLES.find((r) => r.value === role)?.color || 'default';
}

function CreateUserModal({ open, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { message } = AntApp.useApp();

  const handleFinish = useCallback(async (values) => {
    setSubmitting(true);
    try {
      await usersApi.create(values);
      message.success(`User ${values.username} dibuat`);
      form.resetFields();
      onCreated?.();
      onClose?.();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, message, onClose, onCreated]);

  return (
    <Modal
      title={<Space><UserAddOutlined /> User Baru</Space>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ role: 'admin' }}>
        <Form.Item
          name="username"
          label="Username"
          rules={[
            { required: true, message: 'Username wajib diisi' },
            { pattern: /^[a-zA-Z0-9._-]{3,40}$/, message: '3-40 char, huruf/angka/._-' }
          ]}
        >
          <Input prefix={<UserOutlined />} autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email (opsional)"
          rules={[{ type: 'email', message: 'Format email tidak valid' }]}
        >
          <Input prefix={<MailOutlined />} autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true, message: 'Password wajib diisi' },
            { min: 8, message: 'Minimal 8 karakter' }
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="role" label="Role" rules={[{ required: true }]}>
          <Select options={ROLES.map((r) => ({ value: r.value, label: r.label }))} />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button onClick={onClose}>Batal</Button>
            <Button type="primary" htmlType="submit" loading={submitting} icon={<UserAddOutlined />}>
              Buat User
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ResetPasswordModal({ open, user, onClose }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { message } = AntApp.useApp();

  const handleFinish = useCallback(async (values) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await usersApi.resetPassword(user.id, values.password);
      message.success('Password direset');
      form.resetFields();
      onClose?.();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [user, form, message, onClose]);

  return (
    <Modal
      title={<Space><KeyOutlined /> Reset Password: {user?.username}</Space>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="password"
          label="Password baru"
          rules={[
            { required: true, message: 'Password wajib diisi' },
            { min: 8, message: 'Minimal 8 karakter' }
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button onClick={onClose}>Batal</Button>
            <Button type="primary" htmlType="submit" loading={submitting} icon={<KeyOutlined />}>
              Reset Password
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function Users() {
  const fetchList = useCallback((signal) => usersApi.list(signal), []);
  const { data, error, loading, refresh } = useApi(fetchList);
  const items = data?.users || [];
  const me = getStoredUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const { message } = AntApp.useApp();

  const handleDelete = useCallback(async (id) => {
    setBusyId(`del:${id}`);
    try {
      await usersApi.remove(id);
      message.success('User dihapus');
      await refresh();
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusyId(null);
    }
  }, [message, refresh]);

  const columns = [
    {
      title: 'Username', dataIndex: 'username',
      render: (v, row) => (
        <Space size={6}>
          <span className="mono">{v}</span>
          {me?.id === row.id && <Tag color="green">you</Tag>}
        </Space>
      )
    },
    { title: 'Email', dataIndex: 'email', render: (v) => v || <Text type="secondary">-</Text> },
    {
      title: 'Role', dataIndex: 'role', width: 100,
      render: (r) => <Tag color={roleColor(r)}>{r}</Tag>
    },
    {
      title: 'Status', dataIndex: 'is_active', width: 100,
      render: (a) => a ? <Tag color="success">aktif</Tag> : <Tag color="default">nonaktif</Tag>
    },
    {
      title: 'Created', dataIndex: 'created_at', width: 160, responsive: ['md'],
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(v)}</Text>
    },
    {
      title: 'Action', key: 'action', width: 160,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditUser(row)} aria-label={`Edit ${row.username}`} />
          <Button size="small" type="text" icon={<KeyOutlined />} onClick={() => setResetUser(row)} aria-label={`Reset password ${row.username}`} />
          <Popconfirm
            title="Hapus user?"
            description={`User "${row.username}" akan dihapus permanen.`}
            okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(row.id)}
            disabled={me?.id === row.id}
          >
            <Button
              size="small" type="text" danger icon={<DeleteOutlined />}
              disabled={me?.id === row.id}
              loading={busyId === `del:${row.id}`}
              aria-label={`Hapus ${row.username}`}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Users"
        description="Kelola user panel. Hanya owner yang dapat membuat/mengubah/menghapus user."
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setCreateOpen(true)}>
              User Baru
            </Button>
          </Space>
        }
      />

      <ErrorAlert error={error} onRetry={refresh} />

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
      <EditUserModal open={Boolean(editUser)} user={editUser} onClose={() => setEditUser(null)} onSaved={refresh} />
      <ResetPasswordModal open={Boolean(resetUser)} user={resetUser} onClose={() => setResetUser(null)} />
    </>
  );
}
