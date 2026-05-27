import { Alert, Spin, Button } from 'antd';

export function ErrorAlert({ error, onRetry }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <Alert
      type="error"
      message={message}
      showIcon
      style={{ marginBottom: 16 }}
      action={onRetry && <Button size="small" onClick={onRetry}>Retry</Button>}
    />
  );
}

export function CenterSpin({ tip = 'Memuat...', style }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 40, ...style }}>
      <Spin tip={tip} />
    </div>
  );
}
