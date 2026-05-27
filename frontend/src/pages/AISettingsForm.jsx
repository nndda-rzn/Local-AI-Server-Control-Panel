import { useCallback, useState } from 'react';
import { Save } from 'lucide-react';
import { aiApi } from '../api.js';
import { Spinner } from '../components/Feedback.jsx';

const DEVICES = ['cpu', 'cuda', 'xpu', 'mps'];

export default function AISettingsForm({ settings, onSaved }) {
  const [confidence, setConfidence] = useState(settings?.confidence_threshold ?? 0.5);
  const [imageSize, setImageSize] = useState(settings?.image_size ?? 640);
  const [device, setDevice] = useState(settings?.device || 'cpu');
  const [camMethod, setCamMethod] = useState(settings?.cam_method || 'HiResCAM');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSave = useCallback(async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await aiApi.updateSettings({
        confidence_threshold: Number(confidence),
        image_size: Number(imageSize),
        device,
        cam_method: camMethod
      });
      setMessage('Settings tersimpan');
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [confidence, imageSize, device, camMethod, onSaved]);

  return (
    <form onSubmit={handleSave} className="grid gap-4">
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs text-ink-muted">Confidence threshold</span>
          <input
            type="number" min="0" max="1" step="0.01"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            className="field"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs text-ink-muted">Image size</span>
          <input
            type="number" min="32" max="4096" step="32"
            value={imageSize}
            onChange={(e) => setImageSize(e.target.value)}
            className="field"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs text-ink-muted">Device</span>
          <select value={device} onChange={(e) => setDevice(e.target.value)} className="field">
            {DEVICES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs text-ink-muted">CAM method</span>
          <input
            value={camMethod}
            onChange={(e) => setCamMethod(e.target.value)}
            className="field"
          />
        </label>
      </div>

      {message && <div className="alert-success" role="status">{message}</div>}
      {error && <div className="alert-error" role="alert">{error}</div>}

      <div>
        <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving || undefined}>
          {saving ? <Spinner /> : <Save size={15} aria-hidden="true" />}
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
