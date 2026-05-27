import { useCallback, useEffect, useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Position, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, Button, Space, Tag, Drawer, Typography, Row, Col, Statistic } from 'antd';
import { ReloadOutlined, NodeIndexOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { topologyApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { useState } from 'react';

const { Text } = Typography;

const STATUS_STYLE = {
  online: { background: '#E6F6F0', borderColor: '#0E9F6E', color: '#0E9F6E' },
  offline: { background: '#FEE2E2', borderColor: '#DC2626', color: '#DC2626' },
  warning: { background: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' },
  unknown: { background: '#F1F5F9', borderColor: '#CBD5E1', color: '#475569' }
};

const TYPE_LABEL = {
  tunnel: 'Tunnel',
  proxy: 'Proxy',
  api: 'API',
  web: 'Web',
  ai: 'AI',
  database: 'DB',
  cache: 'Cache',
  service: 'Service',
  project: 'Project'
};

function TopologyNode({ data }) {
  const styles = STATUS_STYLE[data.status] || STATUS_STYLE.unknown;
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 10,
      border: `2px solid ${styles.borderColor}`,
      background: styles.background,
      minWidth: 160,
      fontSize: 12,
      cursor: 'pointer'
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: styles.color, marginBottom: 4 }}>
        {TYPE_LABEL[data.type] || data.type}
      </div>
      <div style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'SFMono-Regular, Consolas, monospace' }}>
        {data.label}
      </div>
      <div style={{ fontSize: 10, color: styles.color, marginTop: 4, textTransform: 'capitalize', fontWeight: 600 }}>
        ● {data.status}
      </div>
    </div>
  );
}

const nodeTypes = { topo: TopologyNode };

function layoutNodes(rawNodes, rawEdges) {
  // Hierarchical left-to-right layout
  const levels = new Map();
  const parents = new Map();

  rawEdges.forEach((e) => {
    if (!parents.has(e.target)) parents.set(e.target, []);
    parents.get(e.target).push(e.source);
  });

  function getLevel(id, visited = new Set()) {
    if (visited.has(id)) return 0;
    visited.add(id);
    if (!parents.has(id)) return 0;
    const p = parents.get(id);
    return 1 + Math.max(...p.map((pid) => getLevel(pid, visited)));
  }

  rawNodes.forEach((n) => {
    const lvl = getLevel(n.id);
    if (!levels.has(lvl)) levels.set(lvl, []);
    levels.get(lvl).push(n);
  });

  const positioned = [];
  const X_GAP = 280;
  const Y_GAP = 100;

  for (const [lvl, nodesAtLevel] of levels.entries()) {
    nodesAtLevel.forEach((n, idx) => {
      positioned.push({
        id: n.id,
        type: 'topo',
        position: { x: lvl * X_GAP, y: idx * Y_GAP - (nodesAtLevel.length - 1) * Y_GAP / 2 },
        data: n,
        sourcePosition: Position.Right,
        targetPosition: Position.Left
      });
    });
  }

  return positioned;
}

export default function Topology() {
  const fetchTopology = useCallback((signal) => topologyApi.get(signal), []);
  const { data, error, loading, refresh } = useApi(fetchTopology, [], { pollMs: 30000 });

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (!data) return;
    const layouted = layoutNodes(data.nodes || [], data.edges || []);
    setNodes(layouted);
    setEdges((data.edges || []).map((e) => ({
      ...e,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#0E9F6E', strokeWidth: 1.5 }
    })));
  }, [data, setNodes, setEdges]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.data);
  }, []);

  const summary = data?.summary || {};

  return (
    <>
      <PageHeader
        eyebrow="Architecture"
        title="Service Topology"
        description="Peta hubungan antar service di server. Klik node untuk detail."
        actions={
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button>
        }
      />

      <ErrorAlert error={error} onRetry={refresh} />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card><Statistic title="Total Nodes" value={summary.totalNodes ?? 0} prefix={<NodeIndexOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Online" value={summary.online ?? 0} valueStyle={{ color: '#0E9F6E' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Warning" value={summary.warning ?? 0} valueStyle={{ color: '#F59E0B' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Offline" value={summary.offline ?? 0} valueStyle={{ color: '#DC2626' }} /></Card></Col>
      </Row>

      <Card bodyStyle={{ padding: 0, height: 600 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.4}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="#E5E7EB" />
          <Controls />
          <MiniMap pannable zoomable nodeColor={(n) => STATUS_STYLE[n.data?.status]?.borderColor || '#94A3B8'} />
        </ReactFlow>
      </Card>

      <Drawer
        title={<Space><Tag color="green">{TYPE_LABEL[selectedNode?.type] || 'Node'}</Tag>{selectedNode?.label}</Space>}
        placement="right"
        width={480}
        open={Boolean(selectedNode)}
        onClose={() => setSelectedNode(null)}
      >
        {selectedNode && (
          <>
            <Tag color={selectedNode.status === 'online' ? 'success' : selectedNode.status === 'offline' ? 'error' : 'warning'}>
              ● {selectedNode.status}
            </Tag>
            <div style={{ marginTop: 16 }}>
              {Object.entries(selectedNode.meta || {}).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</Text>
                  <div className="mono" style={{ fontSize: 13, marginTop: 2 }}>
                    {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? '-')}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
