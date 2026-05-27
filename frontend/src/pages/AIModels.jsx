import { useCallback, useState } from 'react';
import { Card, Table, Tag, Button, Space, Form, Upload, Select, Input, Popconfirm, App as AntApp, Typography } from 'antd';
import {
  ReloadOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  InboxOutlined
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import AISettingsForm from './AISettingsForm.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { aiApi, getToken } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatBytes, formatDateTime } from '../utils/format.js';

const { Text } = Typography;
const { Dragger } = Upload;

const FRAMEWORKS = [
  { value: 'pytorch', label: 'PyTorch' },
  { value: 'onnx', label: 'ONNX' },
  { value: 'sklearn', label: 'scikit-learn' }
];

export default function AIModels() {
  const fetchSettings = useCallback((signal) => aiApi.getSettings(signal), []);
  const fetchModels = useCallback((signal) => aiApi.listModels(signal), []);

  const settingsState = useApi(fetchSettings);
  const modelsState = useApi(fetchModels);

  const [uploadForm] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const { message } = AntApp.useApp();

  const settings = settingsState.data?.settings;
  const models = modelsState.data?.models || [];

  const refreshAll = useCallback(async () => {
    await Promise.all([settingsState.refresh(), modelsState.refresh()]);
  }, [settingsState, modelsState]);

  const handleUpload = useCallback(async () => {
    const values = await uploadForm.validateFields().catch(() => null);
    if (!values) return;
    const fileList = values.file?.fileList || [];
    if (fileList.length === 0) {
      message.error('Pilih file model dulu');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('model', fileList[0].originFileObj);
      fd.append('framework', values.framework || 'pytorch');
      if (values.version) fd.append('version', values.version);
      await aiApi.uploadModel(fd);
      uploadForm.resetFields();
      message.success('Model terupload');
      await refreshAll();
    } catch (err) {
      message.error(err.message);
    } finally {
      setUploading(false);
    }
  }, [uploadForm, message, refreshAll]);

  const activate = useCallback(async (model) => {
    setBusyId(`activate:${model.id}`);
    try {
      await aiApi.activateModel(model.id);
      message.success(`${model.name} diaktifkan`);
      await refreshAll();
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusyId(null);
    }
  }, [message, refreshAll]);

  const remove = useCallback(async (model) => {
    setBusyId(`delete:${model.id}`);
    try {
      await aiApi.deleteModel(model.id);
      message.success('Model dihapus');
      await refreshAll();
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusyId(null);
    }
  }, [message, refreshAll]);

  const columns = [
    { title: 'Name', dataIndex: 'name', render: (n) => <span className="mono">{n}</span> },
    { title: 'Version', dataIndex: 'version', render: (v) => v || '-' },
    { title: 'Framework', dataIndex: 'framework', width: 110, render: (f) => <Tag>{f}</Tag> },
    { title: 'Size', dataIndex: 'size_bytes', width: 100, render: (b) => formatBytes(b) },
    { title: 'Created', dataIndex: 'created_at', responsive: ['md'], render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(v)}</Text> },
    {
      title: 'Status', dataIndex: 'is_active', width: 100,
      render: (active) => active ? <Tag color="success">active</Tag> : <Tag>idle</Tag>
    },
    {
      title: 'Action', key: 'action', width: 120,
      render: (_, row) => (
        <Space size={4}>
          <Popconfirm
            title="Aktifkan model ini?"
            onConfirm={() => activate(row)}
            okText="Aktifkan" cancelText="Batal"
            disabled={Boolean(row.is_active)}
          >
            <Button
              size="small" type="text" icon={<CheckCircleOutlined />}
              disabled={Boolean(row.is_active)}
              loading={busyId === `activate:${row.id}`}
              aria-label={`Activate ${row.name}`}
            />
          </Popconfirm>
          <Popconfirm
            title="Hapus model?"
            description="File akan dihapus permanen dari disk."
            onConfirm={() => remove(row)}
            okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }}
            disabled={Boolean(row.is_active)}
          >
            <Button
              size="small" type="text" danger icon={<DeleteOutlined />}
              disabled={Boolean(row.is_active)}
              loading={busyId === `delete:${row.id}`}
              aria-label={`Delete ${row.name}`}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Inference"
        title="AI Models"
        description="Konfigurasi inference dan manajemen model AI."
        actions={<Button icon={<ReloadOutlined />} onClick={refreshAll} loading={settingsState.loading || modelsState.loading}>Refresh</Button>}
      />

      <ErrorAlert error={settingsState.error || modelsState.error} onRetry={refreshAll} />

      <Card
        title="Inference Settings"
        extra={
          <Text type="secondary">
            Active: <span className="mono">{settings?.active_model_name || '-'}</span>
            {settings?.active_model_version && ` (${settings.active_model_version})`}
          </Text>
        }
        style={{ marginBottom: 16 }}
      >
        {settings && <AISettingsForm settings={settings} onSaved={refreshAll} />}
      </Card>

      <Card title="Upload Model" style={{ marginBottom: 16 }}>
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload} initialValues={{ framework: 'pytorch' }}>
          <Form.Item
            name="file"
            rules={[{ required: true, message: 'Pilih file model dulu' }]}
            valuePropName="file"
          >
            <Dragger
              accept=".pt,.pth,.onnx,.pkl"
              maxCount={1}
              multiple={false}
              beforeUpload={() => false}
              style={{ background: '#FAFAFA' }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Klik atau drag file model ke area ini</p>
              <p className="ant-upload-hint">Format: .pt, .pth, .onnx, .pkl</p>
            </Dragger>
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <Form.Item name="framework" label="Framework" style={{ marginBottom: 0 }}>
              <Select options={FRAMEWORKS} />
            </Form.Item>
            <Form.Item name="version" label="Version (opsional)" style={{ marginBottom: 0 }}>
              <Input placeholder="v1.0-yolov8n" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={uploading} icon={<UploadOutlined />}>
                Upload
              </Button>
            </Form.Item>
          </div>
        </Form>
      </Card>

      <Card title="Models" extra={<Text type="secondary">{models.length} terdaftar</Text>} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={models}
          loading={modelsState.loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </>
  );
}
