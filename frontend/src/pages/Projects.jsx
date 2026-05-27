import { useCallback, useState } from 'react';
import { Card, Table, Tag, Button, Space, Popconfirm, App as AntApp, Modal, Tabs, Typography } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  HistoryOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { projectsApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime, formatDuration } from '../utils/format.js';

const { Text, Paragraph } = Typography;

const TYPE_COLOR = {
  ai: 'magenta',
  api: 'geekblue',
  web: 'cyan',
  database: 'gold',
  mixed: 'default'
};

export default function Projects() {
  const fetchList = useCallback((signal) => projectsApi.list(signal), []);
  const { data, error, loading, refresh } = useApi(fetchList);
  const projects = data?.projects || [];

  const [drawerProject, setDrawerProject] = useState(null);
  const [drawerData, setDrawerData] = useState({ services: [], history: [] });
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [outputModal, setOutputModal] = useState({ open: false, title: '', text: '' });
  const [busyKey, setBusyKey] = useState(null);
  const { message } = AntApp.useApp();

  const openDetail = useCallback(async (project) => {
    setDrawerProject(project);
    setDrawerLoading(true);
    try {
      const [detail, history] = await Promise.all([
        projectsApi.detail(project.id),
        projectsApi.history(project.id)
      ]);
      setDrawerData({ services: detail.services || [], history: history.history || [] });
    } catch (err) {
      message.error(err.message);
    } finally {
      setDrawerLoading(false);
    }
  }, [message]);

  const closeDetail = useCallback(() => {
    setDrawerProject(null);
    setDrawerData({ services: [], history: [] });
  }, []);

  const executeAction = useCallback(async (project, action) => {
    setBusyKey(`${project.id}:${action}`);
    try {
      const result = await projectsApi.action(project.id, action);
      setOutputModal({ open: true, title: `${project.name} • ${action}`, text: result.output || '(no output)' });
      message.success(`${action} berhasil`);
      if (drawerProject?.id === project.id) await openDetail(project);
      else await refresh();
    } catch (err) {
      setOutputModal({ open: true, title: `${project.name} • ${action} (failed)`, text: err.payload?.output || err.message });
    } finally {
      setBusyKey(null);
    }
  }, [refresh, message, drawerProject, openDetail]);

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (n) => <span className="mono">{n}</span> },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 110, render: (t) => <Tag color={TYPE_COLOR[t] || 'default'}>{t}</Tag> },
    { title: 'Compose', dataIndex: 'compose_file', key: 'compose', responsive: ['md'], render: (v) => <Text type="secondary" className="mono" style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Path', dataIndex: 'path', key: 'path', responsive: ['lg'], render: (v) => <Text type="secondary" className="mono" style={{ fontSize: 12 }}>{v}</Text> },
    {
      title: 'Action', key: 'action', width: 240,
      render: (_, row) => (
        <Space size={4}>
          <Popconfirm title="Deploy project?" okText="Deploy" cancelText="Batal" onConfirm={() => executeAction(row, 'deploy')}>
            <Button size="small" type="text" icon={<PlayCircleOutlined />} loading={busyKey === `${row.id}:deploy`} aria-label={`Deploy ${row.name}`} />
          </Popconfirm>
          <Popconfirm title="Restart project?" okText="Restart" cancelText="Batal" onConfirm={() => executeAction(row, 'restart')}>
            <Button size="small" type="text" icon={<ReloadOutlined />} loading={busyKey === `${row.id}:restart`} aria-label={`Restart ${row.name}`} />
          </Popconfirm>
          <Popconfirm title="Stop project?" okText="Stop" cancelText="Batal" okButtonProps={{ danger: true }} onConfirm={() => executeAction(row, 'down')}>
            <Button size="small" type="text" icon={<PauseCircleOutlined />} loading={busyKey === `${row.id}:down`} aria-label={`Stop ${row.name}`} />
          </Popconfirm>
          <Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => openDetail(row)} aria-label={`Detail ${row.name}`} />
        </Space>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Deployment"
        title="Projects"
        description="Project terdeteksi dari ALLOWED_PROJECT_ROOT."
        actions={<Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button>}
      />

      <ErrorAlert error={error} onRetry={refresh} />

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={projects}
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={drawerProject?.name || 'Project Detail'}
        open={Boolean(drawerProject)}
        onCancel={closeDetail}
        footer={null}
        width={760}
        loading={drawerLoading}
      >
        {drawerProject && (
          <Tabs
            items={[
              {
                key: 'services',
                label: <span><AppstoreOutlined /> Services ({drawerData.services.length})</span>,
                children: drawerData.services.length === 0 ? (
                  <Text type="secondary">Tidak ada service terdefinisi.</Text>
                ) : (
                  <Table
                    rowKey="name"
                    size="small"
                    pagination={false}
                    dataSource={drawerData.services}
                    columns={[
                      { title: 'Name', dataIndex: 'name', render: (v) => <span className="mono">{v}</span> },
                      { title: 'Image', dataIndex: 'image' },
                      {
                        title: 'Ports', dataIndex: 'ports',
                        render: (ports) => (ports || []).map((p, i) => (
                          <Tag key={i} className="mono">{typeof p === 'string' ? p : JSON.stringify(p)}</Tag>
                        ))
                      },
                      { title: 'Restart', dataIndex: 'restart', render: (v) => v || '-' }
                    ]}
                  />
                )
              },
              {
                key: 'history',
                label: <span><HistoryOutlined /> History ({drawerData.history.length})</span>,
                children: drawerData.history.length === 0 ? (
                  <Text type="secondary">Belum ada history.</Text>
                ) : (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 8 }}
                    dataSource={drawerData.history}
                    columns={[
                      { title: 'Time', dataIndex: 'timestamp', render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(v)}</Text> },
                      { title: 'Action', dataIndex: 'action' },
                      {
                        title: 'Status', dataIndex: 'status',
                        render: (s) => <Tag color={s === 'success' ? 'success' : 'error'}>{s}</Tag>
                      },
                      { title: 'Duration', dataIndex: 'duration_ms', render: (v) => formatDuration(v) },
                      { title: 'By', dataIndex: 'actor_name', render: (v) => v || '-' }
                    ]}
                  />
                )
              }
            ]}
          />
        )}
      </Modal>

      <Modal
        title={outputModal.title}
        open={outputModal.open}
        onCancel={() => setOutputModal({ open: false, title: '', text: '' })}
        footer={null}
        width={760}
      >
        <pre className="log-pre">{outputModal.text}</pre>
      </Modal>
    </>
  );
}
