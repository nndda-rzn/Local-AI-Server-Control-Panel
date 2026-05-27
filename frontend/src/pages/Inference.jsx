import { useCallback, useState } from 'react';
import {
  Card, Upload, Button, Space, Tag, Table, Typography, Row, Col,
  Statistic, Empty, Modal, App as AntApp
} from 'antd';
import {
  InboxOutlined, ThunderboltOutlined, ReloadOutlined,
  HistoryOutlined, FileImageOutlined
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { aiApi, inferenceApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime, formatDuration } from '../utils/format.js';

const { Text, Paragraph } = Typography;
const { Dragger } = Upload;

function ResultPreview({ result }) {
  if (!result) return null;
  const data = result.result || {};
  const predictions = data.predictions || data.detections || data.results || [];
  const topLabel = data.label || data.class || data.prediction || null;
  const confidence = data.confidence ?? data.score ?? null;

  return (
    <Card
      size="small"
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#0E9F6E' }} />
          Hasil Inference
          <Tag color={result.ok ? 'success' : 'error'}>{result.status}</Tag>
        </Space>
      }
      style={{ marginTop: 16 }}
      extra={<Text type="secondary">{formatDuration(result.inference_time_ms)}</Text>}
    >
      {result.model && (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Model:</Text>{' '}
          <span className="mono">{result.model.name}</span>
          {result.model.version && <Tag style={{ marginLeft: 6 }}>{result.model.version}</Tag>}
        </div>
      )}

      {topLabel && (
        <Statistic
          title="Top Prediction"
          value={topLabel}
          suffix={confidence !== null ? `(${(Number(confidence) * 100).toFixed(1)}%)` : ''}
          valueStyle={{ fontSize: 18, color: '#0E9F6E' }}
        />
      )}

      {Array.isArray(predictions) && predictions.length > 0 && (
        <Table
          size="small"
          rowKey={(_, i) => i}
          pagination={false}
          style={{ marginTop: 12 }}
          dataSource={predictions.slice(0, 10)}
          columns={[
            { title: '#', dataIndex: 'index', render: (_, __, i) => i + 1, width: 40 },
            { title: 'Label', dataIndex: 'label', render: (v, r) => v || r.class || r.name || '-' },
            {
              title: 'Confidence',
              dataIndex: 'confidence',
              render: (v, r) => {
                const c = v ?? r.score ?? r.probability;
                return c !== undefined ? `${(Number(c) * 100).toFixed(1)}%` : '-';
              }
            },
            {
              title: 'Bbox',
              dataIndex: 'bbox',
              render: (v, r) => {
                const box = v || r.box;
                return box ? <span className="mono" style={{ fontSize: 11 }}>{JSON.stringify(box)}</span> : '-';
              }
            }
          ]}
        />
      )}

      {result.visualization_path && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Visualization:</Text>
          <div className="mono" style={{ fontSize: 12 }}>{result.visualization_path}</div>
        </div>
      )}

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', color: '#64748B', fontSize: 12 }}>
          Raw Response
        </summary>
        <pre className="log-pre" style={{ marginTop: 8, maxHeight: 240 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </Card>
  );
}

export default function Inference() {
  const fetchSettings = useCallback((signal) => aiApi.getSettings(signal), []);
  const fetchHistory = useCallback(
    (signal) => inferenceApi.history({ limit: 30 }, signal),
    []
  );

  const settingsState = useApi(fetchSettings);
  const historyState = useApi(fetchHistory);

  const [fileList, setFileList] = useState([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const { message } = AntApp.useApp();

  const settings = settingsState.data?.settings;
  const items = historyState.data?.items || [];
  const total = historyState.data?.total || 0;

  const refreshAll = useCallback(() => {
    settingsState.refresh();
    historyState.refresh();
  }, [settingsState, historyState]);

  const handleRun = useCallback(async () => {
    if (fileList.length === 0) {
      message.error('Pilih gambar dulu');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('image', fileList[0].originFileObj);
      const res = await inferenceApi.test(fd);
      setResult(res);
      message.success('Inference selesai');
      historyState.refresh();
    } catch (err) {
      setError(err);
      message.error(err.message);
    } finally {
      setRunning(false);
    }
  }, [fileList, message, historyState]);

  const showDetail = useCallback(async (id) => {
    try {
      const res = await inferenceApi.detail(id);
      setDetail(res.item);
    } catch (err) {
      message.error(err.message);
    }
  }, [message]);

  return (
    <>
      <PageHeader
        eyebrow="AI"
        title="Inference Test"
        description="Uji model aktif dengan gambar. Hasil tersimpan di history."
        actions={
          <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={settingsState.loading || historyState.loading}>
            Refresh
          </Button>
        }
      />

      <ErrorAlert error={error} />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={<Space><FileImageOutlined /> Test Inference</Space>}
            extra={
              settings?.active_model_name ? (
                <Tag color="success">
                  Active: <span className="mono">{settings.active_model_name}</span>
                </Tag>
              ) : (
                <Tag color="warning">Belum ada model aktif</Tag>
              )
            }
          >
            <Paragraph type="secondary">
              Format: .jpg, .jpeg, .png, .bmp, .webp. Maks 20 MB.
            </Paragraph>

            <Dragger
              accept=".jpg,.jpeg,.png,.bmp,.webp"
              maxCount={1}
              multiple={false}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={(info) => setFileList(info.fileList.slice(-1))}
              onRemove={() => setFileList([])}
              style={{ background: '#FAFAFA' }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Klik atau drag gambar ke sini</p>
              <p className="ant-upload-hint">Pastikan AI_INFERENCE_URL sudah dikonfigurasi.</p>
            </Dragger>

            <Button
              type="primary"
              size="large"
              block
              icon={<ThunderboltOutlined />}
              loading={running}
              disabled={fileList.length === 0 || !settings?.active_model_name}
              onClick={handleRun}
              style={{ marginTop: 16 }}
            >
              {running ? 'Running...' : 'Run Inference'}
            </Button>

            <ResultPreview result={result} />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title={<Space><HistoryOutlined /> History ({total})</Space>} bodyStyle={{ padding: 0 }}>
            {items.length === 0 ? (
              <div style={{ padding: 32 }}>
                <Empty description="Belum ada history inference" />
              </div>
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={{ pageSize: 8 }}
                dataSource={items}
                onRow={(row) => ({ onClick: () => showDetail(row.id), style: { cursor: 'pointer' } })}
                columns={[
                  {
                    title: 'Time', dataIndex: 'created_at', width: 130,
                    render: (v) => <Text type="secondary" style={{ fontSize: 11 }}>{formatDateTime(v)}</Text>
                  },
                  {
                    title: 'File', dataIndex: 'input_file', ellipsis: true,
                    render: (v) => <span className="mono" style={{ fontSize: 12 }}>{v}</span>
                  },
                  {
                    title: 'Status', dataIndex: 'status', width: 80,
                    render: (s) => <Tag color={s === 'success' ? 'success' : 'error'}>{s}</Tag>
                  },
                  {
                    title: 'Time', dataIndex: 'inference_time_ms', width: 70,
                    render: (v) => <Text type="secondary" style={{ fontSize: 11 }}>{formatDuration(v)}</Text>
                  }
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={detail ? `Inference #${detail.id}` : 'Detail'}
        open={Boolean(detail)}
        onCancel={() => setDetail(null)}
        footer={null}
        width={760}
      >
        {detail && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={detail.status === 'success' ? 'success' : 'error'}>{detail.status}</Tag>
              <Tag>{formatDuration(detail.inference_time_ms)}</Tag>
              {detail.model_name && <Tag className="mono">{detail.model_name}</Tag>}
            </Space>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Input:</Text>{' '}
              <span className="mono">{detail.input_file}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Actor:</Text>{' '}
              {detail.actor_name || '-'}
            </div>
            {detail.visualization_path && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Visualization:</Text>
                <div className="mono" style={{ fontSize: 12 }}>{detail.visualization_path}</div>
              </div>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>Result:</Text>
            <pre className="log-pre" style={{ marginTop: 4 }}>
              {(() => {
                try { return JSON.stringify(JSON.parse(detail.result_json || '{}'), null, 2); }
                catch { return detail.result_json || '-'; }
              })()}
            </pre>
          </>
        )}
      </Modal>
    </>
  );
}
