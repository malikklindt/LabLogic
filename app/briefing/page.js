'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import MorningBrief from '@/components/MorningBrief';

export default function BriefingPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('ll_auth') === '1') {
      setAuthed(true);
    } else {
      router.replace('/login');
    }
  }, [router]);

  if (authed === null) {
    return <div style={{ background: 'var(--bg)', height: '100vh' }} suppressHydrationWarning />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      overflow: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Back to dashboard link */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 0' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--muted)',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ← Dashboard
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <MorningBrief isModal={false} />
      </div>
    </div>
  );
}
