import { useCallback } from 'react';
import { Row, Col, Card, Statistic, Tag, Button, Empty, List, Space, Typography } from 'antd';
import {
  DesktopOutlined,
  DatabaseOutlined,
  CloudOutlined,
  ReloadOutlined,
  ApiOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { HeartOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import GaugeChart from '../components/GaugeChart.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { dashboardApi, systemApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatBytes, formatDateTime, formatUptime } from '../utils/format.js';

const { Text } = Typography;

export default function Dashboard() {
  const fetchStatus = useCallback((signal) => systemApi.status(signal), []);
  const fetchSummary = useCallback((signal) => dashboardApi.summary(signal), []);
  const fetchHealth = useCallback((signal) => systemApi.healthCheck(signal), []);

  const sys = useApi(fetchStatus, [], { pollMs: 15000 });
  const sum = useApi(fetchSummary, [], { pollMs: 20000 });
  const health = useApi(fetchHealth, [], { pollMs: 30000 });

  const system = sys.data;
  const summary = sum.data;
  const counts = summary?.counts || {};
  const services = summary?.activeServices || [];
  const recentAudit = summary?.recentAudit || [];
  const cloudflared = system?.cloudflared;
  const healthTargets = health.data?.targets || [];
  const healthNote = health.data?.note;

  const refresh = useCallback(() => { sys.refresh(); sum.refresh(); health.refresh(); }, [sys, sum, health]);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Status server real-time, polling 15-20 detik."
        actions={
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={sys.loading || sum.loading}>
            Refresh
          </Button>
        }
      />

      <ErrorAlert error={sys.error || sum.error} onRetry={refresh} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card><GaugeChart value={system?.cpu?.loadPercent} label="CPU Load" /></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card><GaugeChart value={system?.memory?.usedPercent} label="Memory" /></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card><GaugeChart value={system?.disk?.usedPercent} label="Disk" /></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Docker Containers"
              value={counts.running ?? 0}
              suffix={`/ ${counts.total ?? 0}`}
              valueStyle={{ color: '#0E9F6E' }}
              prefix={<DatabaseOutlined />}
            />
            <Space size="small" style={{ marginTop: 12 }} wrap>
              <Tag color="success">{counts.running ?? 0} running</Tag>
              <Tag>{counts.stopped ?? 0} stopped</Tag>
              {counts.unhealthy > 0 && <Tag color="error">{counts.unhealthy} unhealthy</Tag>}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title={<Space><DesktopOutlined /> Server Info</Space>}>
            <Row gutter={[16, 12]}>
              <Col xs={12}>
                <Statistic title="Hostname" value={system?.hostname || '-'} valueStyle={{ fontSize: 16 }} />
              </Col>
              <Col xs={12}>
                <Statistic title="Platform" value={system?.platform || '-'} valueStyle={{ fontSize: 16 }} />
              </Col>
              <Col xs={12}>
                <Statistic title="Primary IP" value={system?.primaryIp || '-'} valueStyle={{ fontSize: 16 }} />
              </Col>
              <Col xs={12}>
                <Statistic title="Uptime" value={formatUptime(system?.uptimeSeconds)} valueStyle={{ fontSize: 16 }} />
              </Col>
              <Col xs={12}>
                <Statistic
                  title="Memory"
                  value={system?.memory ? formatBytes(system.memory.used) : '-'}
                  suffix={system?.memory ? `/ ${formatBytes(system.memory.total)}` : ''}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title="Docker Engine"
                  value={system?.docker?.available ? `v${system.docker.version || '?'}` : 'unavailable'}
                  valueStyle={{ fontSize: 16, color: system?.docker?.available ? '#0E9F6E' : '#DC2626' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title={<Space><GlobalOutlined /> Network</Space>}>
            <div style={{ marginBottom: 12 }}>
              <Tag icon={<CloudOutlined />} color={cloudflared?.active ? 'success' : 'default'}>
                Cloudflared {cloudflared?.active ? 'Active' : 'Tidak terdeteksi'}
              </Tag>
              {cloudflared?.pid && <Text type="secondary" style={{ marginLeft: 8 }}>PID: {cloudflared.pid}</Text>}
            </div>

            <List
              size="small"
              dataSource={system?.ips || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada interface" /> }}
              renderItem={(ip) => (
                <List.Item>
                  <Text type="secondary">{ip.iface}</Text>
                  <span className="mono">{ip.address}</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={<Space><ApiOutlined /> Active Services</Space>} extra={<Text type="secondary">{services.length} running</Text>}>
            <List
              dataSource={services}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada container running" /> }}
              renderItem={(svc) => (
                <List.Item>
                  <List.Item.Meta
                    title={<span className="mono">{svc.name}</span>}
                    description={<Text type="secondary" ellipsis>{svc.image}</Text>}
                  />
                  <Tag color="success">running</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<Space><HeartOutlined /> Health Check</Space>}
            extra={<Text type="secondary">{healthTargets.length} targets</Text>}
          >
            {healthNote ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary" style={{ fontSize: 12 }}>{healthNote}</Text>}
              />
            ) : (
              <List
                dataSource={healthTargets}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada target" /> }}
                renderItem={(t) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<span className="mono">{t.name}</span>}
                      description={<Text type="secondary" style={{ fontSize: 12 }} ellipsis>{t.url}</Text>}
                    />
                    <div style={{ textAlign: 'right' }}>
                      <Tag color={t.ok ? 'success' : 'error'}>{t.ok ? `${t.status} OK` : (t.error || `HTTP ${t.status}`)}</Tag>
                      <div><Text type="secondary" style={{ fontSize: 11 }}>{t.latency_ms}ms</Text></div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="Latest Audit Activity" extra={<Text type="secondary">8 terakhir</Text>}>
            <List
              dataSource={recentAudit}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada aktivitas" /> }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<span className="mono" style={{ fontSize: 13 }}>{item.action}</span>}
                    description={<Text type="secondary" style={{ fontSize: 12 }}>{item.actor_name || 'system'} → {item.target || '-'}</Text>}
                  />
                  <div style={{ textAlign: 'right' }}>
                    <Tag color={item.status === 'success' ? 'success' : 'error'}>{item.status}</Tag>
                    <div><Text type="secondary" style={{ fontSize: 11 }}>{formatDateTime(item.timestamp)}</Text></div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
