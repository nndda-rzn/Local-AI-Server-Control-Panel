import { useCallback, useState } from 'react';
import { authApi, setStoredUser, setToken } from '../api.js';
import { Spinner } from '../components/Feedback.jsx';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await authApi.login(username, password);
      setToken(data.token);
      setStoredUser(data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [username, password, onLogin]);

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <section
        className="w-full max-w-md p-8 rounded-3xl border border-border bg-card shadow-lift"
        aria-labelledby="login-title"
      >
        <div
          className="w-13 h-13 rounded-2xl grid place-items-center font-extrabold text-slate-900 bg-gradient-to-br from-blue-400 to-emerald-400 mb-4"
          aria-hidden="true"
          style={{ width: '3.25rem', height: '3.25rem' }}
        >
          AI
        </div>

        <h1 id="login-title" className="text-xl font-semibold m-0 mb-1.5">Local AI Server Control Panel</h1>
        <p className="text-ink-muted text-sm m-0">
          Masuk untuk mengelola Docker container, status server, project deployment, dan konfigurasi AI inference.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-3" noValidate>
          <div>
            <label htmlFor="username" className="text-xs text-ink-muted block mb-1.5">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-xs text-ink-muted block mb-1.5">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              aria-required="true"
            />
          </div>

          {error && <div className="alert-error" role="alert">{error}</div>}

          <button
            type="submit"
            className="btn-primary justify-center mt-1.5"
            disabled={loading}
            aria-busy={loading || undefined}
          >
            {loading ? <><Spinner /> Memproses...</> : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}
