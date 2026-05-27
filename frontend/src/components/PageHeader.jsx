import { Typography, Space } from 'antd';

const { Title, Text } = Typography;

export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
      <div>
        {eyebrow && (
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 11 }}>
            {eyebrow}
          </Text>
        )}
        <Title level={3} style={{ margin: '4px 0 0' }}>{title}</Title>
        {description && <Text type="secondary">{description}</Text>}
      </div>
      {actions && <Space>{actions}</Space>}
    </div>
  );
}
