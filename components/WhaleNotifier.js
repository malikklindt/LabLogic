'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSettings } from '@/lib/settings';

const SEEN_KEY  = 'll_whale_seen';
const MAX_TOASTS = 3;

// ── Premium audio alert — warm mallet chime ──────────────────────────────────
function playWhaleAlert() {
  try {
    const ctx    = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.35;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -4;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value  = 0.001;
    comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);

    const now = ctx.currentTime;

    // Tiny filtered noise burst — simulates physical contact (the "tap" character)
    function impact(t, vol) {
      const size   = Math.floor(ctx.sampleRate * 0.035);
      const buf    = ctx.createBuffer(1, size, ctx.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 4000; // only the airy "click" frequencies

      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);

      src.connect(hpf); hpf.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.035);
    }

    // Pure tone with natural octave harmonic — no inharmonics
    function tone(freq, t, vol, decay) {
      // Fundamental
      const o1 = ctx.createOscillator(), g1 = ctx.createGain();
      o1.type = 'sine'; o1.frequency.value = freq;
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(vol, t + 0.007);      // 7ms soft attack
      g1.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o1.connect(g1); g1.connect(master);
      o1.start(t); o1.stop(t + decay + 0.05);

      // Octave harmonic (×2 — pure, musical, not metallic)
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'sine'; o2.frequency.value = freq * 2;
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(vol * 0.09, t + 0.005);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.22);
      o2.connect(g2); g2.connect(master);
      o2.start(t); o2.stop(t + decay * 0.22 + 0.05);
    }

    // Two notes — C6 (1047 Hz) descending to G5 (784 Hz), a perfect fifth
    // Sounds natural, harmonious, and clean
    impact(now,        0.07);
    tone(1047, now,        0.40, 0.70);   // C6

    impact(now + 0.13, 0.05);
    tone(784,  now + 0.13, 0.30, 0.90);  // G5

    setTimeout(() => ctx.close(), 2000);
  } catch (_) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatUSD(n) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}

function formatAmount(amount, symbol) {
  const STABLES = new Set(['USDT','USDC','DAI','BUSD']);
  if (STABLES.has(symbol)) return formatUSD(amount);
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K ${symbol}`;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${symbol}`;
}

function signalColor(signal) {
  if (signal === 'outflow')  return '#22c55e';
  if (signal === 'inflow')   return '#ef4444';
  if (signal === 'exchange') return '#f97316';
  return '#a855f7';
}

function signalEmoji(signal) {
  if (signal === 'outflow')  return '↑';
  if (signal === 'inflow')   return '↓';
  if (signal === 'exchange') return '⇄';
  return '→';
}

// ── Single toast card ─────────────────────────────────────────────────────────
function WhaleToast({ tx, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const color = signalColor(tx.signal);
  const router = useRouter();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 350);
    }, 9000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 350);
  };

  return (
    <div style={{
      width: 280,
      background: '#0a0a18',
      border: `1px solid ${color}40`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: `0 0 24px ${color}18, 0 6px 24px rgba(0,0,0,0.5)`,
      pointerEvents: 'all',
      transform: visible ? 'translateX(0) scale(1)' : 'translateX(24px) scale(0.96)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.32s ease',
    }}>
      {/* Color bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

      <div style={{ padding: '10px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ position: 'relative', width: 6, height: 6 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: 'whalePing 1.2s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Whale Alert
            </span>
            <span style={{ fontSize: 9, color: '#30304a' }}>·</span>
            <span style={{ fontSize: 9, color: '#30304a' }}>{tx.blockchain}</span>
          </div>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', color: '#30304a', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
          >×</button>
        </div>

        {/* Main content — clicking navigates to Whale Watch */}
        <div
          onClick={() => { onDismiss(); router.push('/whale-watch'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `${color}15`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color, flexShrink: 0,
          }}>
            {signalEmoji(tx.signal)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f0f0ff', letterSpacing: -0.3, lineHeight: 1 }}>
              {formatAmount(tx.amount, tx.symbol)}
            </div>
            <div style={{ fontSize: 10, color: '#50507a', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatUSD(tx.amount_usd)} · {tx.from.name} → {tx.to.name}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color }}>{tx.sentiment}</div>
            <div style={{ fontSize: 9, color: '#30304a', marginTop: 1 }}>{tx.label}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 8, height: 2, background: '#111128', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: `${color}60`, borderRadius: 1,
            animation: 'whaleTimer 9s linear forwards',
          }} />
        </div>
      </div>
    </div>
  );
}

// ── Notifier ──────────────────────────────────────────────────────────────────
export default function WhaleNotifier() {
  const [toasts, setToasts]  = useState([]);
  const seenRef              = useRef(null);
  const initializedRef       = useRef(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      seenRef.current = new Set(stored);
    } catch (_) {
      seenRef.current = new Set();
    }

    const poll = async () => {
      try {
        const res = await fetch('/api/whale', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.mock) return;

        // Read settings fresh on each poll so changes take effect immediately
        const s = getSettings();
        const threshold = s.whaleThreshold;
        const sigMap = {
          inflow:   s.whaleSig_inflow,
          outflow:  s.whaleSig_outflow,
          exchange: s.whaleSig_exchange,
          transfer: s.whaleSig_transfer,
        };

        const newAlerts = [];
        for (const tx of data.transactions ?? []) {
          if (
            tx.amount_usd >= threshold &&
            sigMap[tx.signal] !== false &&
            !seenRef.current.has(tx.id)
          ) {
            seenRef.current.add(tx.id);
            newAlerts.push(tx);
          }
        }

        const arr = Array.from(seenRef.current).slice(-200);
        localStorage.setItem(SEEN_KEY, JSON.stringify(arr));

        if (!initializedRef.current) {
          initializedRef.current = true;
          return;
        }

        if (newAlerts.length > 0) {
          // Play audio if enabled
          if (s.whaleSound) playWhaleAlert();

          setToasts(prev =>
            [...newAlerts.map(tx => ({ ...tx, _tid: `${tx.id}_${Date.now()}` })), ...prev]
              .slice(0, MAX_TOASTS)
          );
        }
      } catch (_) {}
    };

    poll();
    const interval = setInterval(poll, 60_000);
    return () => clearInterval(interval);
  }, []);

  const dismiss = (tid) => setToasts(prev => prev.filter(t => t._tid !== tid));

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes whalePing {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes whaleTimer {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div style={{
        position: 'fixed', top: 16, right: 16,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
        alignItems: 'flex-end',
      }}>
        {toasts.map(tx => (
          <WhaleToast key={tx._tid} tx={tx} onDismiss={() => dismiss(tx._tid)} />
        ))}
      </div>
    </>
  );
}
