import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getToken } from '../lib/api';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const token = getToken();
    router.replace(token ? '/chat' : '/login');
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(124,106,247,0.3)', borderTopColor: '#7c6af7', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
}
