import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api, setToken, setUser } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      setToken(data.token);
      setUser(data.user);
      router.push('/chat');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="animate-fade" style={{ width: '100%', maxWidth: 420, padding: '24px 16px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, #7c6af7, #f767a0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22
            }}>✦</div>
            <span style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>Echo</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Welcome back — sign in to continue</p>
        </div>

        <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
              <input
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Password</label>
              <input
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,92,122,0.1)', border: '1px solid rgba(255,92,122,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#ff5c7a', fontSize: 14
              }}>{error}</div>
            )}

            <button className="btn-primary" type="submit" disabled={loading} style={{ height: 48, width: '100%' }}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-secondary)', fontSize: 14 }}>
            New here?{' '}
            <Link href="/register" style={{ color: 'var(--accent-light)', fontWeight: 500, textDecoration: 'none' }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
