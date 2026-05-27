import { useState } from 'react';
import { Form, InputNumber, Select, Input, Button, Space, Popconfirm, App as AntApp } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { aiApi, inferenceApi } from '../api.js';

const DEVICES = [
  { value: 'cpu', label: 'CPU' },
  { value: 'cuda', label: 'CUDA (NVIDIA)' },
  { value: 'xpu', label: 'XPU (Intel)' },
  { value: 'mps', label: 'MPS (Apple)' }
];

export default function AISettingsForm({ settings, onSaved }) {
  const [form] = Form.useForm();
  const [restarting, setRestarting] = useState(false);
  const { message } = AntApp.useApp();

  async function handleFinish(values) {
    try {
      await aiApi.updateSettings(values);
      message.success('Settings tersimpan');
      onSaved?.();
    } catch (err) {
      message.error(err.message);
    }
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      const res = await inferenceApi.restartService();
      message.success(`Inference service direstart (${res.container})`);
    } catch (err) {
      message.error(err.message);
    } finally {
      setRestarting(false);
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{
        confidence_threshold: settings?.confidence_threshold ?? 0.5,
        image_size: settings?.image_size ?? 640,
        device: settings?.device || 'cpu',
        cam_method: settings?.cam_method || 'HiResCAM'
      }}
      style={{ maxWidth: 720 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Form.Item
          name="confidence_threshold"
          label="Confidence threshold"
          rules={[{ required: true }]}
        >
          <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="image_size"
          label="Image size"
          rules={[{ required: true }]}
        >
          <InputNumber min={32} max={4096} step={32} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="device" label="Device" rules={[{ required: true }]}>
          <Select options={DEVICES} />
        </Form.Item>

        <Form.Item name="cam_method" label="CAM method">
          <Input placeholder="HiResCAM" />
        </Form.Item>
      </div>

      <Form.Item style={{ marginBottom: 0 }}>
        <Space wrap>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            Simpan Settings
          </Button>
          <Popconfirm
            title="Restart inference service?"
            description="Container AI inference akan direstart. Pastikan AI_INFERENCE_CONTAINER sudah benar di .env."
            okText="Restart"
            cancelText="Batal"
            onConfirm={handleRestart}
          >
            <Button icon={<ReloadOutlined />} loading={restarting}>
              Restart Inference Service
            </Button>
          </Popconfirm>
        </Space>
      </Form.Item>
    </Form>
  );
}
