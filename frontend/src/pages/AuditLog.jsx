import { useCallback, useState } from 'react';
import { Card, Table, Tag, Button, Space, Select, DatePicker, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { auditApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime } from '../utils/format.js';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const FILTERS = [
  { value: '', label: 'Semua aksi' },
  { value: 'auth.login', label: 'Login' },
  { value: 'auth.logout', label: 'Logout' },
  { value: 'container.restart', label: 'Container Restart' },
  { value: 'container.stop', label: 'Container Stop' },
  { value: 'container.start', label: 'Container Start' },
  { value: 'project.deploy', label: 'Project Deploy' },
  { value: 'project.down', label: 'Project Down' },
  { value: 'project.restart', label: 'Project Restart' },
  { value: 'ai.settings.update', label: 'AI Settings' },
  { value: 'ai.model.upload', label: 'Model Upload' },
  { value: 'ai.model.activate', label: 'Model Activate' },
  { value: 'ai.model.delete', label: 'Model Delete' }
];

export default function AuditLog() {
  const [filter, setFilter] = useState('');
  const [range, setRange] = useState(null);

  const fetcher = useCallback(
    (signal) => auditApi.list({
      limit: 200,
      action: filter || undefined,
      from: range?.[0] ? range[0].startOf('day').toISOString() : undefined,
      to: range?.[1] ? range[1].endOf('day').toISOString() : undefined
    }, signal),
    [filter, range]
  );

  const { data, error, loading, refresh } = useApi(fetcher, [filter, range]);
  const items = data?.items || [];
  const total = data?.total ?? 0;

  const columns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (v) => <Text type="secondary" className="mono" style={{ fontSize: 12 }}>{formatDateTime(v)}</Text>
    },
    { title: 'Actor', dataIndex: 'actor_name', key: 'actor', width: 120, render: (v) => v || '-' },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 180,
      render: (v) => <span className="mono" style={{ fontSize: 12 }}>{v}</span>
    },
    {
      title: 'Target',
      dataIndex: 'target',
      key: 'target',
      ellipsis: true,
      render: (v) => <span className="mono" style={{ fontSize: 12 }}>{v || '-'}</span>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => <Tag color={s === 'success' ? 'success' : 'error'}>{s}</Tag>
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 130,
      responsive: ['lg'],
      render: (v) => <span className="mono" style={{ fontSize: 12 }}>{v || '-'}</span>
    },
    {
      title: 'Detail',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      responsive: ['xl'],
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '-'}</Text>
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Audit Log"
        description={`${total} entri tercatat. Menampilkan 200 terbaru.`}
        actions={
          <Space wrap>
            <Select
              value={filter}
              onChange={setFilter}
              options={FILTERS}
              style={{ minWidth: 180 }}
              aria-label="Filter aksi"
            />
            <RangePicker
              value={range}
              onChange={setRange}
              format="DD MMM YYYY"
              allowClear
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
          dataSource={items}
          loading={loading}
          pagination={{ pageSize: 15 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </>
  );
}
