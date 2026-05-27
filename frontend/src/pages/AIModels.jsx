import { memo, useCallback, useRef, useState } from 'react';
import { Upload, Trash2, CheckCircle2, RefreshCcw } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { ErrorAlert, Spinner } from '../components/Feedback.jsx';
import AISettingsForm from './AISettingsForm.jsx';
import { aiApi } from '../api.js';
import { useApi } from '../hooks/useApi.js';
import { formatBytes, formatDateTime } from '../utils/format.js';

const ModelRow = memo(function ModelRow({ model, onActivate, onDelete }) {
  return (
    <tr>
      <td className="mono">{model.name}</td>
      <td className="text-sm">{model.version || '-'}</td>
      <td className="text-sm">{model.framework}</td>
      <td className="text-xs text-ink-muted">{formatBytes(model.size_bytes)}</td>
      <td className="text-xs text-ink-muted">{formatDateTime(model.created_at)}</td>
      <td>
        {model.is_active
          ? <span className="pill-success">active</span>
          : <span className="pill-muted">idle</span>}
      </td>
      <td>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn-icon"
            aria-label={`Activate model ${model.name}`}
            disabled={Boolean(model.is_active)}
            onClick={() => onActivate(model)}
          >
            <CheckCircle2 size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={`Delete model ${model.name}`}
            disabled={Boolean(model.is_active)}
            onClick={() => onDelete(model)}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function AIModels() {
  const fetchSettings = useCallback((signal) => aiApi.getSettings(signal), []);
  const fetchModels = useCallback((signal) => aiApi.listModels(signal), []);

  const settingsState = useApi(fetchSettings);
  const modelsState = useApi(fetchModels);

  const [uploading, setUploading] = useState(false);
  const [framework, setFramework] = useState('pytorch');
  const [version, setVersion] = useState('');
  const [confirm, setConfirm] = useState({ open: false, model: null });
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const fileRef = useRef(null);

  const settings = settingsState.data?.settings;
  const models = modelsState.data?.models || [];

  const refreshAll = useCallback(async () => {
    await Promise.all([settingsState.refresh(), modelsState.refresh()]);
  }, [settingsState, modelsState]);

  const handleUpload = useCallback(async (event) => {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setActionError(new Error('Pilih file model dulu'));
      return;
    }
    setUploading(true);
    setActionError(null);
    try {
      const fd = new FormData();
      fd.append('model', file);
      fd.append('framework', framework);
      if (version) fd.append('version', version);
      await aiApi.uploadModel(fd);
      fileRef.current.value = '';
      setVersion('');
      await refreshAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setUploading(false);
    }
  }, [framework, version, refreshAll]);

  const activate = useCallback(async (model) => {
    setActionError(null);
    try {
      await aiApi.activateModel(model.id);
      await refreshAll();
    } catch (err) {
      setActionError(err);
    }
  }, [refreshAll]);

  const requestDelete = useCallback((model) => {
    setConfirm({ open: true, model });
  }, []);

  const cancelDelete = useCallback(() => {
    setConfirm({ open: false, model: null });
  }, []);

  async function executeDelete() {
    if (!confirm.model) return;
    setDeleting(true);
    setActionError(null);
    try {
      await aiApi.deleteModel(confirm.model.id);
      setConfirm({ open: false, model: null });
      await refreshAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setDeleting(false);
    }
  }

  const loading = settingsState.loading || modelsState.loading;
  const error = settingsState.error || modelsState.error;

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Inference"
        title="AI Models"
        description="Atur konfigurasi inference dan model aktif."
        actions={
          <button type="button" className="btn-secondary" onClick={refreshAll} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCcw size={15} aria-hidden="true" />}
            Refresh
          </button>
        }
      />

      <ErrorAlert error={error} onRetry={refreshAll} />
      <ErrorAlert error={actionError} />

      <section className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold m-0 mb-1">Inference Settings</h2>
          <p className="text-ink-muted text-sm m-0">
            Active model: <strong className="text-ink">{settings?.active_model_name || '-'}</strong>
            {settings?.active_model_version ? ` (${settings.active_model_version})` : ''}
          </p>
        </div>
        {settings && <AISettingsForm settings={settings} onSaved={refreshAll} />}
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold m-0 mb-1">Upload Model</h2>
          <p className="text-ink-muted text-sm m-0">
            Allowed: .pt, .pth, .onnx, .pkl. File akan disimpan ke ALLOWED_MODEL_ROOT.
          </p>
        </div>
        <form onSubmit={handleUpload} className="grid gap-3 grid-cols-1 lg:grid-cols-[1.4fr_0.8fr_1fr_auto] items-end">
          <label className="grid gap-1.5">
            <span className="sr-only">Model file</span>
            <input
              ref={fileRef}
              type="file"
              accept=".pt,.pth,.onnx,.pkl"
              className="field !p-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-400/15 file:text-blue-300 file:cursor-pointer"
              aria-label="Model file"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="sr-only">Framework</span>
            <select value={framework} onChange={(e) => setFramework(e.target.value)} className="field" aria-label="Framework">
              <option value="pytorch">pytorch</option>
              <option value="onnx">onnx</option>
              <option value="sklearn">sklearn</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="sr-only">Version</span>
            <input
              placeholder="version (mis. v1.0-yolov8n)"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="field"
              aria-label="Model version"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={uploading} aria-busy={uploading || undefined}>
            {uploading ? <Spinner /> : <Upload size={15} aria-hidden="true" />}
            {uploading ? 'Mengunggah...' : 'Upload'}
          </button>
        </form>
      </section>

      <section className="card !p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold m-0 mb-1">Models</h2>
          <p className="text-ink-muted text-sm m-0">{models.length} model terdaftar.</p>
        </div>
        <div className="overflow-auto">
          <table className="table-base min-w-[820px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>Framework</th>
                <th>Size</th>
                <th>Created</th>
                <th>Status</th>
                <th className="w-32">Action</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  onActivate={activate}
                  onDelete={requestDelete}
                />
              ))}
              {models.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-7 text-ink-muted">Belum ada model.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={confirm.open}
        title="Hapus model?"
        message={`Model "${confirm.model?.name}" akan dihapus secara permanen dari disk.`}
        confirmLabel="Hapus"
        danger
        loading={deleting}
        onCancel={cancelDelete}
        onConfirm={executeDelete}
      />
    </div>
  );
}
