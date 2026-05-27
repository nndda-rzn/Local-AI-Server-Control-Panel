import { useState, useCallback, useEffect } from 'react';
import { Card, Steps, Button, Select, Space, Typography, Tag, Alert, Result, Spin, App as AntApp } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, RocketOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader.jsx';
import { ErrorAlert } from '../components/Feedback.jsx';
import { projectsApi, wizardApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';

const { Text, Paragraph } = Typography;

const STEPS = [
  { title: 'Pilih Project' },
  { title: 'Validasi Compose' },
  { title: 'Validasi .env' },
  { title: 'Cek Port' },
  { title: 'Deploy' },
  { title: 'Selesai' }
];

function StepResult({ status, title, children }) {
  const icon = status === 'success'
    ? <CheckCircleOutlined style={{ color: '#0E9F6E' }} />
    : status === 'error'
    ? <ExclamationCircleOutlined style={{ color: '#DC2626' }} />
    : <ExclamationCircleOutlined style={{ color: '#F59E0B' }} />;

  return (
    <Alert
      type={status === 'success' ? 'success' : status === 'error' ? 'error' : 'warning'}
      message={<Space>{icon}{title}</Space>}
      description={children}
      style={{ marginBottom: 12 }}
    />
  );
}

export default function DeploymentWizard() {
  const fetchProjects = useCallback((signal) => projectsApi.list(signal), []);
  const { data: projData, refresh: refreshProjects } = useApi(fetchProjects);

  const [current, setCurrent] = useState(0);
  const [selectedProject, setSelectedProject] = useState(null);
  const [composeResult, setComposeResult] = useState(null);
  const [envResult, setEnvResult] = useState(null);
  const [portResult, setPortResult] = useState(null);
  const [deployResult, setDeployResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { message } = AntApp.useApp();

  const projects = projData?.projects || [];

  const reset = useCallback(() => {
    setCurrent(0);
    setSelectedProject(null);
    setComposeResult(null);
    setEnvResult(null);
    setPortResult(null);
    setDeployResult(null);
    setError(null);
  }, []);

  const validateCompose = useCallback(async () => {
    if (!selectedProject) return;
    setBusy(true);
    setError(null);
    try {
      const r = await wizardApi.validateCompose(selectedProject);
      setComposeResult(r);
      if (r.ok) setCurrent(2);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, [selectedProject]);

  const validateEnvStep = useCallback(async () => {
    if (!selectedProject) return;
    setBusy(true);
    setError(null);
    try {
      const r = await wizardApi.validateEnv(selectedProject);
      setEnvResult(r);
      setCurrent(3);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, [selectedProject]);

  const checkPort = useCallback(async () => {
    if (!selectedProject) return;
    setBusy(true);
    setError(null);
    try {
      const r = await wizardApi.checkPort(selectedProject);
      setPortResult(r);
      if (r.ok) setCurrent(4);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, [selectedProject]);

  const runDeploy = useCallback(async () => {
    if (!selectedProject) return;
    setBusy(true);
    setError(null);
    try {
      const r = await wizardApi.run(selectedProject);
      setDeployResult({ ok: true, ...r });
      setCurrent(5);
      message.success('Deploy berhasil');
    } catch (err) {
      setDeployResult({ ok: false, message: err.message, output: err.payload?.output });
      setCurrent(5);
    } finally {
      setBusy(false);
    }
  }, [selectedProject, message]);

  return (
    <>
      <PageHeader
        eyebrow="Deployment"
        title="Deployment Wizard"
        description="Validasi dan deploy project step-by-step. Mencegah error karena port conflict atau env tidak lengkap."
        actions={<Button icon={<ReloadOutlined />} onClick={reset}>Reset Wizard</Button>}
      />

      <ErrorAlert error={error} />

      <Card style={{ marginBottom: 16 }}>
        <Steps current={current} items={STEPS} size="small" />
      </Card>

      {current === 0 && (
        <Card title="Step 1: Pilih Project">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">Pilih project dari folder whitelist (ALLOWED_PROJECT_ROOT) yang ingin di-deploy.</Text>
            <Select
              placeholder="Pilih project..."
              style={{ width: '100%' }}
              value={selectedProject}
              onChange={setSelectedProject}
              options={projects.map((p) => ({ value: p.id, label: `${p.name} (${p.type})` }))}
            />
            <Button
              type="primary"
              disabled={!selectedProject}
              onClick={() => setCurrent(1)}
            >
              Lanjutkan
            </Button>
          </Space>
        </Card>
      )}

      {current === 1 && (
        <Card title="Step 2: Validasi docker-compose.yml">
          <Paragraph type="secondary">
            Memeriksa syntax YAML, services, image, ports, dan dependency.
          </Paragraph>

          {!composeResult && (
            <Button type="primary" loading={busy} onClick={validateCompose}>Jalankan Validasi</Button>
          )}

          {composeResult && (
            <>
              <StepResult
                status={composeResult.ok ? 'success' : 'error'}
                title={composeResult.ok ? `Compose valid - ${composeResult.services.length} services` : 'Compose tidak valid'}
              >
                {composeResult.errors?.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {composeResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
                {composeResult.warnings?.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#92400E' }}>
                    {composeResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
              </StepResult>

              {composeResult.ok && (
                <Space wrap style={{ marginTop: 8 }}>
                  {composeResult.services.map((s) => (
                    <Tag key={s.name} className="mono">{s.name}{s.image ? ` • ${s.image}` : ''}</Tag>
                  ))}
                </Space>
              )}

              <Space style={{ marginTop: 16 }}>
                <Button onClick={() => setCurrent(0)}>Kembali</Button>
                <Button type="primary" disabled={!composeResult.ok} onClick={() => setCurrent(2)}>
                  Lanjutkan
                </Button>
              </Space>
            </>
          )}
        </Card>
      )}

      {current === 2 && (
        <Card title="Step 3: Validasi .env">
          <Paragraph type="secondary">Memeriksa file .env di root project.</Paragraph>
          {!envResult && (
            <Button type="primary" loading={busy} onClick={validateEnvStep}>Jalankan Validasi</Button>
          )}
          {envResult && (
            <>
              <StepResult
                status={envResult.warnings?.length > 0 ? 'warning' : 'success'}
                title={envResult.warnings?.length > 0 ? '.env warning' : `.env terdeteksi (${envResult.present?.length || 0} keys)`}
              >
                {envResult.warnings?.length > 0 && envResult.warnings.map((w, i) => <div key={i}>{w}</div>)}
                {envResult.present?.length > 0 && (
                  <Space wrap style={{ marginTop: 8 }}>
                    {envResult.present.map((k) => <Tag key={k} className="mono">{k}</Tag>)}
                  </Space>
                )}
              </StepResult>
              <Space style={{ marginTop: 16 }}>
                <Button onClick={() => setCurrent(1)}>Kembali</Button>
                <Button type="primary" onClick={() => setCurrent(3)}>Lanjutkan</Button>
              </Space>
            </>
          )}
        </Card>
      )}

      {current === 3 && (
        <Card title="Step 4: Cek Port Conflict">
          <Paragraph type="secondary">Memeriksa apakah port pada compose sudah dipakai service lain.</Paragraph>
          {!portResult && (
            <Button type="primary" loading={busy} onClick={checkPort}>Jalankan Cek Port</Button>
          )}
          {portResult && (
            <>
              <StepResult
                status={portResult.ok ? 'success' : 'error'}
                title={portResult.ok ? `Semua port aman (${portResult.checked.length} port dicek)` : `Port conflict: ${portResult.conflicts.join(', ')}`}
              >
                <Space wrap>
                  {portResult.checked.map((c) => (
                    <Tag key={c.port} color={c.available ? 'success' : 'error'} className="mono">
                      :{c.port} {c.available ? 'free' : 'in use'}
                    </Tag>
                  ))}
                </Space>
              </StepResult>
              <Space style={{ marginTop: 16 }}>
                <Button onClick={() => setCurrent(2)}>Kembali</Button>
                <Button type="primary" disabled={!portResult.ok} onClick={() => setCurrent(4)}>Lanjutkan</Button>
              </Space>
            </>
          )}
        </Card>
      )}

      {current === 4 && (
        <Card title="Step 5: Deploy (docker compose up -d)">
          <Paragraph type="secondary">Menjalankan deploy ke target project. Proses bisa memakan waktu beberapa menit.</Paragraph>
          {busy && <Spin tip="Deploying..." style={{ marginTop: 16 }} />}
          {!busy && !deployResult && (
            <Space>
              <Button onClick={() => setCurrent(3)}>Kembali</Button>
              <Button type="primary" icon={<RocketOutlined />} onClick={runDeploy}>Mulai Deploy</Button>
            </Space>
          )}
        </Card>
      )}

      {current === 5 && deployResult && (
        <Card>
          <Result
            status={deployResult.ok ? 'success' : 'error'}
            title={deployResult.ok ? 'Deploy berhasil' : 'Deploy gagal'}
            subTitle={deployResult.ok
              ? `Project ${selectedProject ? projects.find((p) => p.id === selectedProject)?.name : ''} berhasil di-deploy. Durasi ${deployResult.duration || 0}ms.`
              : deployResult.message}
            extra={[
              <Button key="reset" onClick={reset}>Mulai Wizard Baru</Button>,
              deployResult.ok && <Button key="topology" type="primary" onClick={() => window.location.hash = '#topology'}>Lihat Topology</Button>
            ]}
          />
          {deployResult.output && (
            <pre className="log-pre">{deployResult.output}</pre>
          )}
        </Card>
      )}
    </>
  );
}
