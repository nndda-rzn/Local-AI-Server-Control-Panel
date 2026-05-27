import { useCallback, useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Drawer, Popconfirm, App as AntApp, Typography, Select, Input } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CloseOutlined,
  SearchOutlined
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { dockerApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime, formatPort } from '../utils/format.js';

const { Text } = Typography;
const PROTECTED = new Set(['panel-backend', 'panel-frontend']);

const STATE_COLOR = {
  running: 'success',
  exited: 'error',
  paused: 'warning',
  restarting: 'processing',
  created: 'default',
  dead: 'error'
};

export default function Containers() {
  const fetchList = useCallback((signal) => dockerApi.list(signal), []);
  const { data, error, loading, refresh } = useApi(fetchList, [], { pollMs: 12000 });
  const containers = data?.containers || [];

  const [logsDrawer, setLogsDrawer] = useState({ open: false, name: '', text: '', loading: false });
  const [busyKey, setBusyKey] = useState(null);
  const [projectFilter, setProjectFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { message } = AntApp.useApp();

  const projectOptions = useMemo(() => {
    const set = new Set();
    let standalone = false;
    for (const c of containers) {
      if (c.project) set.add(c.project);
      else standalone = true;
    }
    const opts = [{ value: 'all', label: `Semua project (${containers.length})` }];
    [...set].sort().forEach((p) => {
      const count = containers.filter((c) => c.project === p).length;
      opts.push({ value: p, label: `${p} (${count})` });
    });
    if (standalone) {
      const count = containers.filter((c) => !c.project).length;
      opts.push({ value: '__standalone__', label: `Standalone (${count})` });
    }
    return opts;
  }, [containers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return containers.filter((c) => {
      if (projectFilter === '__standalone__' && c.project) return false;
      if (projectFilter !== 'all' && projectFilter !== '__standalone__' && c.project !== projectFilter) return false;
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;
      if (q && !`${c.name} ${c.image} ${c.service || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [containers, projectFilter, stateFilter, search]);

  const viewLogs = useCallback(async (name) => {
    setLogsDrawer({ open: true, name, text: 'Loading...', loading: true });
    try {
      const result = await dockerApi.logs(name, 200);
      setLogsDrawer({ open: true, name, text: result.logs || '(empty)', loading: false });
    } catch (err) {
      setLogsDrawer({ open: true, name, text: `Error: ${err.message}`, loading: false });
    }
  }, []);

  const executeAction = useCallback(async (container, action) => {
    setBusyKey(`${container.id}:${action}`);
    try {
      await dockerApi.action(container.name, action);
      message.success(`${action} berhasil`);
      await refresh();
    } catch (err) {
      message.error(err.message);
    } finally {
      setBusyKey(null);
    }
  }, [refresh, message]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space size={6}>
          <span className="mono">{name}</span>
          {PROTECTED.has(name) && <Tag color="warning">protected</Tag>}
        </Space>
      )
    },
    { title: 'Image', dataIndex: 'image', key: 'image', ellipsis: true },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      width: 120,
      render: (state) => <Tag color={STATE_COLOR[state] || 'default'}>{state}</Tag>
    },
    { title: 'Status', dataIndex: 'status', key: 'status', ellipsis: true, responsive: ['lg'] },
    {
      title: 'Ports',
      dataIndex: 'ports',
      key: 'ports',
      width: 140,
      responsive: ['md'],
      render: (ports) => (
        <div className="mono" style={{ fontSize: 12 }}>
          {(ports || []).slice(0, 3).map((p, i) => <div key={i}>{formatPort(p)}</div>)}
        </div>
      )
    },
    {
      title: 'Created',
      dataIndex: 'created',
      key: 'created',
      width: 160,
      responsive: ['xl'],
      render: (created) => created ? <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(new Date(created * 1000).toISOString())}</Text> : '-'
    },
    {
      title: 'Restart',
      dataIndex: 'restartPolicy',
      key: 'restart',
      width: 120,
      responsive: ['xl'],
      render: (policy, row) => (
        <Space size={4}>
          <Tag>{policy || 'no'}</Tag>
          {row.restartCount > 0 && <Text type="secondary" style={{ fontSize: 11 }}>×{row.restartCount}</Text>}
        </Space>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 200,
      render: (_, row) => {
        const isProtected = PROTECTED.has(row.name);
        return (
          <Space size={4}>
            <Button
              size="small" type="text" icon={<PlayCircleOutlined />}
              loading={busyKey === `${row.id}:start`}
              onClick={() => executeAction(row, 'start')}
              aria-label={`Start ${row.name}`}
            />
            <Popconfirm
              title="Stop container?"
              description={`Aksi stop pada "${row.name}" akan dijalankan.`}
              okText="Stop" cancelText="Batal" okButtonProps={{ danger: true }}
              onConfirm={() => executeAction(row, 'stop')}
              disabled={isProtected}
            >
              <Button
                size="small" type="text" icon={<PauseCircleOutlined />}
                disabled={isProtected} loading={busyKey === `${row.id}:stop`}
                aria-label={`Stop ${row.name}`}
              />
            </Popconfirm>
            <Popconfirm
              title="Restart container?"
              description={`Aksi restart pada "${row.name}".`}
              okText="Restart" cancelText="Batal"
              onConfirm={() => executeAction(row, 'restart')}
            >
              <Button
                size="small" type="text" icon={<ReloadOutlined />}
                loading={busyKey === `${row.id}:restart`}
                aria-label={`Restart ${row.name}`}
              />
            </Popconfirm>
            <Button
              size="small" type="text" icon={<FileTextOutlined />}
              onClick={() => viewLogs(row.name)}
              aria-label={`View logs ${row.name}`}
            />
          </Space>
        );
      }
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Docker"
        title="Containers"
        description={`${filtered.length} dari ${containers.length} container ditampilkan.`}
        actions={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cari nama / image / service"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 240 }}
            />
            <Select
              value={projectFilter}
              onChange={setProjectFilter}
              options={projectOptions}
              style={{ minWidth: 200 }}
              aria-label="Filter project"
            />
            <Select
              value={stateFilter}
              onChange={setStateFilter}
              options={[
                { value: 'all', label: 'Semua state' },
                { value: 'running', label: 'Running' },
                { value: 'exited', label: 'Exited' },
                { value: 'paused', label: 'Paused' },
                { value: 'restarting', label: 'Restarting' },
                { value: 'created', label: 'Created' },
                { value: 'dead', label: 'Dead' }
              ]}
              style={{ minWidth: 140 }}
              aria-label="Filter state"
            />
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button>
          </Space>
        }
      />

      <ErrorAlert error={error} onRetry={refresh} />

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={containers}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Drawer
        title={<Space>Logs: <span className="mono">{logsDrawer.name}</span></Space>}
        placement="right"
        width={720}
        open={logsDrawer.open}
        onClose={() => setLogsDrawer({ open: false, name: '', text: '', loading: false })}
        extra={<Button icon={<CloseOutlined />} type="text" onClick={() => setLogsDrawer({ open: false, name: '', text: '', loading: false })} />}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>200 baris terakhir.</Text>
        <pre className="log-pre">{logsDrawer.text}</pre>
      </Drawer>
    </>
  );
}
