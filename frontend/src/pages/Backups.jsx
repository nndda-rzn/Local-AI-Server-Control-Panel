import { useCallback, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, Checkbox, Typography,
  Popconfirm, App as AntApp, Empty, Alert
} from 'antd';
import {
  ReloadOutlined, CloudDownloadOutlined, DeleteOutlined,
  PlusOutlined, DatabaseOutlined, RocketOutlined, FolderOpenOutlined,
  HddOutlined, CheckCircleOutlined, CloseCircleOutlined, RetweetOutlined
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { backupApi, getToken } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatBytes, formatDateTime, formatDuration } from '../utils/format.js';

const { Text, Paragraph } = Typography;

const SCOPE_OPTIONS = [
  { value: 'db', label: 'Database (SQLite)', icon: <DatabaseOutlined />, description: 'panel.db' },
  { value: 'models', label: 'AI Models', icon: <RocketOutlined />, description: '/server/data/models' },
  { value: 'uploads', label: 'Uploads', icon: <FolderOpenOutlined />, description: '/server/data/uploads' },
  { value: 'projects', label: 'Projects', icon: <HddOutlined />, description: '/server/apps' }
];

function CreateBackupModal({ open, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { message } = AntApp.useApp();

  const handleFinish = useCallback(async (values) => {
    if (!values.scopes || values.scopes.length === 0) {
      message.error('Pilih minimal satu scope');
      return;
    }
    setSubmitting(true);
    try {
      const result = await backupApi.create({
        scopes: values.scopes,
        label: values.label || undefined
      });
      message.success(`Backup ${result.name} berhasil`);
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
      title={<Space><PlusOutlined /> Buat Backup Baru</Space>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        message="Backup dijalankan sebagai tar.gz di /server/backup."
        description="Operasi bisa memakan waktu beberapa menit untuk folder besar. Pastikan disk cukup."
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ scopes: ['db'] }}>
        <Form.Item
          name="label"
          label="Label (opsional)"
          rules={[
            { max: 80, message: 'Maks 80 karakter' },
            { pattern: /^[a-zA-Z0-9._-]*$/, message: 'Hanya huruf/angka/._- yang diizinkan' }
          ]}
        >
          <Input placeholder="manual, weekly, before-update..." />
        </Form.Item>

        <Form.Item
          name="scopes"
          label="Scope yang akan di-backup"
          rules={[{ required: true, message: 'Pilih minimal satu scope' }]}
        >
          <Checkbox.Group style={{ width: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {SCOPE_OPTIONS.map((opt) => (
                <Checkbox key={opt.value} value={opt.value}>
                  <Space>
                    {opt.icon}
                    <span>{opt.label}</span>
                    <Text type="secondary" className="mono" style={{ fontSize: 11 }}>
                      {opt.description}
                    </Text>
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button onClick={onClose}>Batal</Button>
            <Button type="primary" htmlType="submit" loading={submitting} icon={<PlusOutlined />}>
              Mulai Backup
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ScopeTags({ scopeJson }) {
  let scopes = [];
  try {
    const parsed = typeof scopeJson === 'string' ? JSON.parse(scopeJson) : scopeJson;
    scopes = parsed?.scopes || [];
  } catch {
    return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
  }

  return (
    <Space size={4} wrap>
      {scopes.map((s) => {
        const opt = SCOPE_OPTIONS.find((o) => o.value === s);
        return <Tag key={s} className="mono" style={{ fontSize: 11 }}>{opt?.label || s}</Tag>;
      })}
    </Space>
  );
}

function downloadBackup(id, name) {
  const token = getToken();
  const url = backupApi.downloadUrl(id);
  fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((res) => {
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      return res.blob();
    })
    .then((blob) => {
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    })
    .catch((err) => {
      // eslint-disable-next-line no-alert
      alert(`Download gagal: ${err.message}`);
    });
}

export default function Backups() {
  const fetchList = useCallback((signal) => backupApi.list({ limit: 50 }, signal), []);
  const { data, error, loading, refresh } = useApi(fetchList);

  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const { message } = AntApp.useApp();

  const items = data?.items || [];
  const total = data?.total || 0;

  const handleDelete = useCallback(async (id) => {
    setBusyId(`del:${id}`);
    try {
      await backupApi.remove(id);
      message.success('Backup dihapus');
      await refresh();
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusyId(null);
    }
  }, [message, refresh]);

  const handleRestore = useCallback(async (id, name) => {
    setBusyId(`restore:${id}`);
    try {
      const result = await backupApi.restore(id);
      Modal.success({
        title: 'Restore berhasil',
        width: 560,
        content: (
          <div>
            <p style={{ marginBottom: 8 }}>
              Backup <span className="mono">{name}</span> di-extract ke:
            </p>
            <pre className="log-pre" style={{ maxHeight: 120 }}>{result.restored_to}</pre>
            <p style={{ marginTop: 8, marginBottom: 4, color: '#64748B', fontSize: 12 }}>
              File yang sedang aktif tidak ditimpa. Salin manual dari folder restored.
            </p>
            {Array.isArray(result.entries) && result.entries.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{result.entries.length} entry:</Text>
                <Space wrap size={4} style={{ marginTop: 4 }}>
                  {result.entries.slice(0, 12).map((e) => (
                    <Tag key={e.name} className="mono" style={{ fontSize: 11 }}>
                      {e.type === 'dir' ? '📁' : '📄'} {e.name}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </div>
        )
      });
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusyId(null);
    }
  }, [message]);

  const columns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(v)}</Text>
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (v) => <span className="mono" style={{ fontSize: 12 }}>{v}</span>
    },
    {
      title: 'Scope',
      dataIndex: 'scope_json',
      key: 'scope',
      render: (v) => <ScopeTags scopeJson={v} />
    },
    {
      title: 'Size',
      dataIndex: 'size_bytes',
      key: 'size',
      width: 100,
      render: (v) => formatBytes(v || 0)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => (
        <Tag
          color={s === 'success' ? 'success' : 'error'}
          icon={s === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {s}
        </Tag>
      )
    },
    {
      title: 'By',
      dataIndex: 'created_by',
      key: 'by',
      width: 100,
      responsive: ['lg'],
      render: (v) => v || '-'
    },
    {
      title: 'Action',
      key: 'action',
      width: 160,
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<CloudDownloadOutlined />}
            disabled={row.status !== 'success'}
            onClick={() => downloadBackup(row.id, row.name)}
            aria-label={`Download ${row.name}`}
          />
          <Popconfirm
            title="Restore backup?"
            description="Akan extract ke /server/backup/restored/<name>_<timestamp>. File asli tidak ditimpa."
            onConfirm={() => handleRestore(row.id, row.name)}
            okText="Restore"
            cancelText="Batal"
            disabled={row.status !== 'success'}
          >
            <Button
              size="small"
              type="text"
              icon={<RetweetOutlined />}
              disabled={row.status !== 'success'}
              loading={busyId === `restore:${row.id}`}
              aria-label={`Restore ${row.name}`}
            />
          </Popconfirm>
          <Popconfirm
            title="Hapus backup?"
            description="File akan dihapus permanen dari disk."
            onConfirm={() => handleDelete(row.id)}
            okText="Hapus"
            cancelText="Batal"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={busyId === `del:${row.id}`}
              aria-label={`Hapus ${row.name}`}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Maintenance"
        title="Backups"
        description="Backup manual database dan folder data ke /server/backup."
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Buat Backup
            </Button>
          </Space>
        }
      />

      <ErrorAlert error={error} onRetry={refresh} />

      <Card bodyStyle={{ padding: 0 }} title={<Text type="secondary" style={{ fontSize: 13 }}>{total} backup tercatat</Text>}>
        {items.length === 0 && !loading ? (
          <div style={{ padding: 40 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Belum ada backup"
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                Buat backup pertama
              </Button>
            </Empty>
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      <CreateBackupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
      />
    </>
  );
}
