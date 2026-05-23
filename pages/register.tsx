import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api, setToken, setUser } from '../lib/api';

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatar(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('password', form.password);
      if (avatar) fd.append('avatar', avatar);

      const { data } = await api.post('/auth/register', fd);
      setToken(data.token);
      setUser(data.user);
      router.push('/chat');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const getInitial = () => form.name.charAt(0).toUpperCase() || '?';

  return (
    <div className="page-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', overflow: 'auto' }}>
      <div className="animate-fade" style={{ width: '100%', maxWidth: 460, padding: '24px 16px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
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
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Create your account to start messaging</p>
        </div>

        <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 32 }}>
          {/* Avatar picker */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 96, height: 96, borderRadius: '50%', cursor: 'pointer',
                position: 'relative', overflow: 'hidden',
                border: '2px dashed var(--border-accent)',
                background: preview ? 'transparent' : 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              {preview ? (
                <img src={preview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {form.name ? (
                    <span style={{
                      fontSize: 36, fontWeight: 700, fontFamily: 'Syne',
                      background: 'linear-gradient(135deg, #7c6af7, #f767a0)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                    }}>{getInitial()}</span>
                  ) : (
                    <span style={{ fontSize: 28 }}>📷</span>
                  )}
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(0,0,0,0.6)', padding: '4px 0',
                textAlign: 'center', fontSize: 11, color: 'white', fontWeight: 500
              }}>
                {preview ? 'Change' : 'Add photo'}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Optional — a beautiful avatar auto-generates from your name</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Full Name</label>
              <input
                className="input-field"
                placeholder="Your display name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Email Address</label>
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
                placeholder="At least 8 characters"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,92,122,0.1)', border: '1px solid rgba(255,92,122,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#ff5c7a', fontSize: 14
              }}>{error}</div>
            )}

            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 4, width: '100%', height: 48 }}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-secondary)', fontSize: 14 }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent-light)', fontWeight: 500, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
