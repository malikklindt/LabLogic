'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import MorningBrief from './MorningBrief';

const LAST_SEEN_KEY = 'll_briefing_last_seen'; // YYYY-MM-DD of last dismissal
const MANUAL_OPEN_EVENT = 'll_open_briefing';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BriefingModal() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const pathname = usePathname();

  // Auto-show on first visit of the day (dashboard only, must be authed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname !== '/') return; // only trigger on dashboard root
    const authed = localStorage.getItem('ll_auth') === '1';
    if (!authed) return;
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (lastSeen === todayStr()) return; // already seen today

    // Small delay so the dashboard paints first, then the modal slides in
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [pathname]);

  // Manual open via custom event (from header "Today's Brief" button)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setOpen(true);
    window.addEventListener(MANUAL_OPEN_EVENT, handler);
    return () => window.removeEventListener(MANUAL_OPEN_EVENT, handler);
  }, []);

  const close = useCallback(() => {
    // Mark as seen for today so it doesn't auto-show again
    try { localStorage.setItem(LAST_SEEN_KEY, todayStr()); } catch {}
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 220);
  }, []);

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, close]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes bmOverIn  { from{opacity:0} to{opacity:1} }
        @keyframes bmOverOut { from{opacity:1} to{opacity:0} }
        @keyframes bmCardIn  { from{opacity:0;transform:scale(0.96) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes bmCardOut { from{opacity:1;transform:scale(1) translateY(0)} to{opacity:0;transform:scale(0.96) translateY(16px)} }
      `}</style>

      {/* Backdrop */}
      <div onClick={close} style={{
        position: 'fixed', inset: 0, zIndex: 7999,
        background: 'rgba(4,4,12,0.78)',
        backdropFilter: 'blur(8px)',
        animation: `${closing ? 'bmOverOut' : 'bmOverIn'} 220ms ease both`,
      }} />

      {/* Card */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(16px, 2vw, 40px)',
        pointerEvents: 'none',
      }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 1000, maxHeight: '92vh',
            overflow: 'auto',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            boxShadow: '0 32px 100px rgba(0,0,0,0.7)',
            pointerEvents: 'all',
            animation: `${closing ? 'bmCardOut' : 'bmCardIn'} 260ms cubic-bezier(0.22,1,0.36,1) both`,
          }}
        >
          <MorningBrief onClose={close} isModal={true} />
        </div>
      </div>
    </>
  );
}
