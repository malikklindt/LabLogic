'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Gauge } from './Gauge';

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  bg: '#000000',
  card: '#0d0d1a',
  border: '1px solid #1a1a30',
  purple: '#7c3aed',
  purpleLight: '#a855f7',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  muted: '#6a6a90',
  muted2: '#505070',
  text: '#e2e2f2',
  radius: '12px',
};

const btnPill = {
  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
  borderRadius: 100,
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight: 600,
  fontSize: 15,
  padding: '10px 28px',
  letterSpacing: 0.3,
};

// ── Flask SVG logo ─────────────────────────────────────────────────────────────
function FlaskLogo({ size = 56, glow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={glow ? { filter: 'drop-shadow(0 0 12px #7c3aed88)' } : {}}>
      <rect width="56" height="56" rx="14" fill="var(--card)" />
      {/* Rim */}
      <rect x="19.5" y="7" width="17" height="5.5" rx="2" stroke="#a855f7" strokeWidth="2.5" fill="none"/>
      {/* Flask body */}
      <path d="M22.5 12.5 L22.5 22 L10 43 Q7.5 48 12 48 L44 48 Q48.5 48 46 43 L33.5 22 L33.5 12.5"
        stroke="#a855f7" strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Liquid wave */}
      <path d="M13 40 Q21 36.5 28 40 Q35 43.5 43 40"
        stroke="#a855f7" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Bubbles */}
      <circle cx="27" cy="28" r="2" stroke="#a855f7" strokeWidth="1.8" fill="none"/>
      <circle cx="32" cy="34" r="3" stroke="#a855f7" strokeWidth="1.8" fill="none"/>
      <circle cx="26" cy="37" r="1.8" stroke="#a855f7" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

// ── Mini sparkline (vol / equity) ─────────────────────────────────────────────
function MiniSparkline({ pts, color, height = 52 }) {
  const W = 200, H = height;
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const px = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * W,
    y: H - ((v - min) / range) * (H * 0.82) - H * 0.08,
  }));
  const path = px.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fill = `${path} L${W},${H} L0,${H} Z`;
  const id = `sg${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}88)` }} />
    </svg>
  );
}

// ── BTC sparkline SVG ──────────────────────────────────────────────────────────
function BTCSparkline() {
  const pts = [
    [0, 70], [8, 65], [16, 72], [24, 60], [32, 63],
    [40, 55], [48, 58], [56, 48], [64, 52], [72, 44],
    [80, 46], [88, 38], [96, 42], [104, 34], [112, 28],
    [120, 32], [128, 24], [136, 20], [144, 16], [152, 10], [160, 14],
  ];
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = `${line} L160,85 L0,85 Z`;
  return (
    <svg viewBox="0 0 160 85" width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="btcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#btcFill)" />
      <path d={line} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Equity curve SVG ───────────────────────────────────────────────────────────
function EquityCurve() {
  const pts = [
    [0, 110], [14, 100], [28, 108], [42, 95], [56, 102],
    [70, 88], [84, 94], [98, 78], [112, 85], [126, 70],
    [140, 76], [154, 60], [168, 66], [182, 52], [196, 58],
    [210, 44], [224, 50], [238, 36], [252, 28], [266, 22], [280, 18],
  ];
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = `${line} L280,120 L0,120 Z`;
  return (
    <svg viewBox="0 0 280 120" width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eqFill)" />
      <path d={line} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Sentiment gauge (16 arc dots) ──────────────────────────────────────────────
function SentimentGauge() {
  const total = 16;
  const value = 11;
  const cx = 80, cy = 85, r = 62;
  const dots = Array.from({ length: total }, (_, i) => {
    const angle = Math.PI - (i / (total - 1)) * Math.PI;
    const x = cx + r * Math.cos(angle);
    const y = cy - r * Math.sin(angle);
    const isActive = i === value;
    const progress = i / (total - 1);
    let color;
    if (progress < 0.25) color = '#ef4444';
    else if (progress < 0.45) color = '#f97316';
    else if (progress < 0.55) color = '#eab308';
    else if (progress < 0.75) color = '#22c55e';
    else color = '#16a34a';
    return { x, y, isActive, color };
  });
  return (
    <svg viewBox="0 0 160 95" width="100%" height="100%">
      {dots.map((d, i) => (
        <g key={i}>
          <circle cx={d.x} cy={d.y} r={d.isActive ? 7 : 4.5} fill={d.color} opacity={d.isActive ? 1 : 0.55} />
          {d.isActive && <circle cx={d.x} cy={d.y} r={2.5} fill="#fff" />}
        </g>
      ))}
    </svg>
  );
}

// ── Section label (unused placeholder kept for future) ───────────────────────
function _SectionLabel({ text }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.purpleLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
      {text}
    </div>
  );
}

// ── Scroll fade-in hook ───────────────────────────────────────────────────────
// rootRef = the scrollable container (so observer fires relative to that, not the window)
function useFadeIn(rootRef, options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      {
        root: rootRef?.current ?? null,
        threshold: options.threshold ?? 0.1,
        rootMargin: options.rootMargin ?? '0px 0px -60px 0px',
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const style = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0px)' : `translateY(${options.y ?? 40}px)`,
    transition: `opacity ${options.duration ?? 0.7}s cubic-bezier(0.22,1,0.36,1), transform ${options.duration ?? 0.7}s cubic-bezier(0.22,1,0.36,1)`,
    transitionDelay: options.delay ? `${options.delay}s` : '0s',
  };
  return [ref, style];
}

// ── Journal section: two overlapping cards with hover-to-front ────────────────
function JournalCardMockup() {
  const [backUp, setBackUp] = useState(false);

  const firstDay = 3, daysInMonth = 30;
  const tradeDays = {
    7:  { pnl: 2736, trades: 1 },
    8:  { pnl: -984, trades: 1 },
    9:  { pnl: -430, trades: 1 },
    10: { pnl: 1480, trades: 1 },
  };
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, data: tradeDays[d] || null });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // equity curve
  const eqPts = [0, 2736, 1752, 1322, 2802];
  const eqW = 400, eqH = 60;
  const eqMin = Math.min(...eqPts), eqMax = Math.max(...eqPts);
  const eqRange = eqMax - eqMin || 1;
  const eqCoords = eqPts.map((v, i) => ({
    x: (i / (eqPts.length - 1)) * eqW,
    y: eqH - ((v - eqMin) / eqRange) * (eqH * 0.8) - eqH * 0.08,
  }));
  const eqPath = eqCoords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const eqFill = `${eqPath} L${eqW},${eqH} L0,${eqH} Z`;
  const eqLast = eqCoords[eqCoords.length - 1];

  const tr = 'transform 0.26s ease, box-shadow 0.26s ease, border-color 0.26s ease, opacity 0.26s ease';

  return (
    <div style={{ position: 'relative', paddingBottom: 72 }}>

      {/* ── Back card: stats + equity + calendar ── */}
      <div
        onMouseEnter={() => setBackUp(true)}
        onMouseLeave={() => setBackUp(false)}
        style={{
          background: '#0c0c1a',
          border: backUp ? '1px solid rgba(168,85,247,0.5)' : '1px solid #1a1a30',
          borderRadius: 14, padding: '22px 24px',
          position: 'relative', zIndex: backUp ? 6 : 1,
          transform: backUp ? 'translateY(-5px)' : 'translateY(0)',
          boxShadow: backUp ? '0 18px 52px rgba(0,0,0,0.65), 0 0 28px rgba(124,58,237,0.18)' : '0 2px 8px rgba(0,0,0,0.3)',
          transition: tr, cursor: 'default',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#9898b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Trade Journal</span>
          <span style={{ fontSize: 11, color: '#505070' }}>April 2026</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Win Rate',  value: '50%',     color: '#22c55e' },
            { label: 'Total P&L', value: '+$2,802', color: '#22c55e' },
            { label: 'Trades',    value: '4',       color: '#e0e0ff' },
            { label: 'Streak',    value: '1W',      color: '#a855f7' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111120', border: '1px solid #1a1a30', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: '#505070', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: s.color, letterSpacing: -0.3, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Equity curve */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: '#505070', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Equity Curve · April</div>
          <svg viewBox={`0 0 ${eqW} ${eqH}`} width="100%" height="60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="jEqFill2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1={eqCoords[0].y} x2={eqW} y2={eqCoords[0].y} stroke="#1a1a30" strokeWidth="1" strokeDasharray="4,4" />
            <path d={eqFill} fill="url(#jEqFill2)" />
            <path d={eqPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px #22c55e66)' }} />
            <circle cx={eqLast.x} cy={eqLast.y} r="4.5" fill="#22c55e" opacity="0.95" />
            <circle cx={eqLast.x} cy={eqLast.y} r="8" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0.3" />
          </svg>
        </div>

        {/* Calendar */}
        <div style={{ background: '#0a0a18', border: '1px solid #1a1a30', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: '#505070', fontWeight: 700 }}>‹</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#f0f0ff' }}>April 2026</span>
            <span style={{ fontSize: 10, color: '#505070', fontWeight: 700 }}>›</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#505070', textTransform: 'uppercase', padding: '2px 0' }}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
              {week.map((cell, ci) => {
                if (!cell) return <div key={ci} style={{ borderRadius: 5, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', minHeight: 36 }} />;
                const { data } = cell;
                const isToday = cell.day === 10;
                const isPos = data && data.pnl > 0;
                const bg = !data ? '#111120' : isPos ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)';
                const bd = isToday ? 'rgba(168,85,247,0.65)' : !data ? '#1a1a30' : isPos ? 'rgba(34,197,94,0.38)' : 'rgba(239,68,68,0.38)';
                return (
                  <div key={ci} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 5, padding: '3px 4px', minHeight: 36, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 8, fontWeight: isToday ? 800 : 500, color: isToday ? '#a855f7' : '#505070' }}>{cell.day}</div>
                    {data && (
                      <>
                        <div style={{ fontSize: 8, fontWeight: 800, color: isPos ? '#22c55e' : '#ef4444', marginTop: 'auto', lineHeight: 1.2 }}>
                          {isPos ? '+' : ''}${(Math.abs(data.pnl)/1000).toFixed(1)}k
                        </div>
                        <div style={{ fontSize: 7, color: '#505070' }}>{data.trades}t</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Front card: recent trades + AI button (floating overlay) ── */}
      <div style={{
        position: 'absolute', bottom: -8, right: -18,
        width: '52%',
        background: '#08081e',
        border: backUp ? '1px solid #1a1a30' : '1px solid rgba(168,85,247,0.5)',
        borderRadius: 14, padding: '18px 20px',
        zIndex: backUp ? 2 : 5,
        opacity: backUp ? 0.45 : 1,
        transform: backUp ? 'translateY(4px) scale(0.98)' : 'translateY(0) scale(1)',
        boxShadow: backUp ? 'none' : '0 8px 36px rgba(0,0,0,0.65), 0 0 20px rgba(124,58,237,0.12)',
        transition: tr,
        pointerEvents: backUp ? 'none' : 'auto',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#505070', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Recent Trades</div>
        {[
          { sym: 'BTC/USD', side: 'Long',  date: 'Apr 7',  pnl: '+$2,736', win: true  },
          { sym: 'BTC/USD', side: 'Long',  date: 'Apr 8',  pnl:   '-$984', win: false },
          { sym: 'ETH/USD', side: 'Short', date: 'Apr 9',  pnl:   '-$430', win: false },
          { sym: 'BTC/USD', side: 'Long',  date: 'Apr 10', pnl: '+$1,480', win: true  },
        ].map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111128', border: '1px solid #1a1a30', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ width: 3, height: 26, borderRadius: 2, background: t.win ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#e0e0ff' }}>{t.sym}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                  background: t.side === 'Long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  border: t.side === 'Long' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
                  color: t.side === 'Long' ? '#22c55e' : '#ef4444' }}>{t.side}</span>
              </div>
              <div style={{ fontSize: 10, color: '#505070', marginTop: 1 }}>{t.date}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: t.win ? '#22c55e' : '#ef4444' }}>{t.pnl}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.45)', borderRadius: 10, color: '#a855f7', fontWeight: 700, fontSize: 13, boxShadow: '0 0 18px rgba(168,85,247,0.2)', justifyContent: 'center', cursor: 'default' }}>
          🤖 AI Portfolio Review
        </div>
      </div>

    </div>
  );
}

// ── Slide 0 — scrollable landing page ─────────────────────────────────────────
function Slide0({ onContinue, onGetAccess }) {
  const scrollRef = useRef(null);
  const [ref1, fade1] = useFadeIn(scrollRef, { y: 44 });
  const [ref2, fade2] = useFadeIn(scrollRef, { y: 44 });
  const [ref3, fade3] = useFadeIn(scrollRef, { y: 44 });
  const [refT, fadeT] = useFadeIn(scrollRef, { y: 36 });
  const [refC, fadeC] = useFadeIn(scrollRef, { y: 30 });

  return (
    <div ref={scrollRef} className="ll-scroll" style={{ height: '100%', overflowY: 'auto' }}>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div style={{
        minHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 32px 40px',
        position: 'relative',
        textAlign: 'center',
      }}>
        {/* Rings + logo */}
        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 44 }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 116, height: 116, borderRadius: '50%', border: '1.5px solid rgba(124,58,237,0.35)', transform: 'translate(-50%, -50%)', animation: 'llRingPulse 2.5s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 88, height: 88, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.2)', transform: 'translate(-50%, -50%)' }} />
          <FlaskLogo size={60} glow />
        </div>

        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 54, fontWeight: 800, color: '#fff', letterSpacing: -1.5, lineHeight: 1.1, maxWidth: 640, margin: '0 auto' }}>
            Trade with context
          </div>
          <div style={{ fontSize: 16, fontWeight: 400, color: T.muted, letterSpacing: 0.2, maxWidth: 420, margin: '20px auto 0', lineHeight: 1.65 }}>
            Institutional-level market intelligence, built for serious traders
          </div>
        </div>

        <button onClick={onContinue} style={{ ...btnPill, fontSize: 15, padding: '13px 44px', boxShadow: '0 0 28px rgba(124,58,237,0.35)' }}>
          See for yourself →
        </button>

        {/* Scroll hint */}
        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: 0.35 }}>
          <span style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase' }}>Scroll</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* ── SECTION 1: Market Sentiment ───────────────────────────────── */}
      <div ref={ref1} style={{ borderTop: '1px solid #0f0f1e', padding: '100px 0', display: 'grid', gridTemplateColumns: '40% 60%', alignItems: 'center', ...fade1 }}>

        {/* Left: text */}
        <div style={{ padding: '0 6% 0 8%' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.purpleLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Market Sentiment</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -0.8, marginBottom: 18 }}>
            Know the market mood<br/>before you <span style={{ color: T.purpleLight }}>place a trade</span>
          </div>
          <div style={{ fontSize: 15, color: T.muted, lineHeight: 1.75, marginBottom: 28 }}>
            A live sentiment index built from BTC momentum, news flow, implied volatility, and dominance — with an AI narrative updated on every meaningful shift.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Live fear & greed score with regime label', 'AI-written narrative explaining the current driver', 'Four weighted factors — visible and always explained'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.purple, flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 14, color: '#b0b0cc', lineHeight: 1.55 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: card */}
        <div style={{ padding: '0 6% 0 2%' }}>
          <div style={{ background: '#0c0c1a', border: '1px solid #1a1a30', borderRadius: 14, padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0ff' }}>Market Sentiment Index</span>
              <span style={{ padding: '2px 12px', borderRadius: 20, background: 'rgba(10,70,30,0.45)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80', fontSize: 11, fontWeight: 700 }}>Bullish</span>
            </div>
            <div style={{ fontSize: 12, color: '#7878a0', lineHeight: 1.55, marginBottom: 16 }}>
              Strong BTC momentum (+4.1% this week) is the primary driver — rising prices are pulling sentiment toward greed territory.
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 180, flexShrink: 0 }}>
                <Gauge value={69} label="Bullish" size={180} pillColor="#4ade80" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: '#505070', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Key Drivers</div>
                {[
                  { name: 'Bullish Momentum',  weight: 35, desc: '+4.1% weekly', color: '#22c55e' },
                  { name: 'News Sentiment',    weight: 30, desc: '7/10 bullish',  color: '#22c55e' },
                  { name: 'Volatility',        weight: 20, desc: 'IV 48% — normal', color: '#86efac' },
                  { name: 'BTC Dominance',     weight: 15, desc: '54.1% stable', color: '#9ca3af' },
                ].map((d, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '7px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#d4d4f0' }}>{d.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: d.color }}>{d.weight}%</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#505070' }}>{d.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Implied Volatility ─────────────────────────────── */}
      <div ref={ref2} style={fade2}>{(() => {
        const ivPts = [68,65,70,62,58,54,51,55,49,46,44,41,45,43,40,44,49,52,50,52];
        const rvPts = [50,48,45,44,42,40,38,36,39,37,35,38,36,34,37,35,33,36,38,37];
        return (
          <div style={{ borderTop: '1px solid #0f0f1e', padding: '100px 0', display: 'grid', gridTemplateColumns: '60% 40%', alignItems: 'center' }}>

            {/* Left: card */}
            <div style={{ padding: '0 2% 0 6%' }}>
              <div style={{ background: '#0c0c1a', border: '1px solid #1a1a30', borderRadius: 14, padding: '22px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0ff' }}>Bitcoin Volatility</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['1W','1M','3M'].map((t, i) => (
                      <span key={t} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 4, background: i === 1 ? 'rgba(255,255,255,0.07)' : 'transparent', border: i === 1 ? '1px solid rgba(240,240,255,0.18)' : '1px solid transparent', color: i === 1 ? '#e0e0ff' : '#505070', fontWeight: i === 1 ? 600 : 400 }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#7878a0', lineHeight: 1.55, marginBottom: 18 }}>
                  IV at 48% is elevated above RV at 37% — the market is pricing in a larger move than recent realized swings suggest.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[
                    { label: 'Implied Volatility',  val: '48%', sub: 'Elevated · Options premiums rich', range: '12M: 35%–95%', pts: ivPts, color: '#f97316' },
                    { label: 'Realized Volatility', val: '37%', sub: 'Moderate · Price action calm',     range: '12M: 20%–75%', pts: rvPts, color: '#4ade80' },
                  ].map((v) => (
                    <div key={v.label} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, color: '#505070', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{v.label}</div>
                      <div style={{ fontSize: 36, fontWeight: 800, color: v.color, letterSpacing: -1, lineHeight: 1 }}>{v.val}</div>
                      <div style={{ fontSize: 11, color: v.color + 'bb', marginTop: 6, marginBottom: 3 }}>{v.sub}</div>
                      <div style={{ fontSize: 10, color: '#505070', marginBottom: 12 }}>{v.range}</div>
                      <div style={{ height: 72 }}><MiniSparkline pts={v.pts} color={v.color} height={72} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: text */}
            <div style={{ padding: '0 8% 0 4%' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.purpleLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Volatility Intelligence</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -0.8, marginBottom: 18 }}>
                Know what <span style={{ color: '#ef4444' }}>kind of market</span> you're in
              </div>
              <div style={{ fontSize: 15, color: T.muted, lineHeight: 1.75, marginBottom: 28 }}>
                Implied vs Realized Volatility tells you whether the market is calm or bracing for impact — before the move happens.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['IV vs RV — spot when options are overpriced', 'Regime labels: calm / elevated / extreme', 'AI breakdown of what the spread means today'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.purple, flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 14, color: '#b0b0cc', lineHeight: 1.55 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}</div>

      {/* ── SECTION 3: Trade Journal ──────────────────────────────────── */}
      <div ref={ref3} style={{ borderTop: '1px solid #0f0f1e', padding: '100px 0', display: 'grid', gridTemplateColumns: '40% 60%', alignItems: 'center', ...fade3 }}>

        {/* Left: text */}
        <div style={{ padding: '0 6% 0 8%' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.purpleLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Trade Journal</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -0.8, marginBottom: 18 }}>
            Every trade<br/>decoded by <span style={{ color: T.purpleLight }}>AI</span>
          </div>
          <div style={{ fontSize: 15, color: T.muted, lineHeight: 1.75, marginBottom: 28 }}>
            Log trades, see every green and red day on a calendar, then fire the AI Portfolio Review for a full breakdown of your edge, your flaws, and your next steps.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Calendar view — every green and red day at a glance', 'Win rate, P&L, streak, and trade count', 'AI Portfolio Review — patterns, edges, action plan'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.purple, flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 14, color: '#b0b0cc', lineHeight: 1.55 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: card */}
        <div style={{ padding: '0 6% 0 2%' }}>
          <JournalCardMockup />
        </div>
      </div>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────── */}
      <div ref={refT} style={{ borderTop: '1px solid #0f0f1e', padding: '80px 36px', ...fadeT }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.purpleLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Traders</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>Built for traders who take it seriously</div>
            <div style={{ fontSize: 15, color: T.muted, marginTop: 12 }}>From noise to signal.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
            {[
              {
                name: 'Alex R.',
                handle: '@alexr_trades',
                avatar: 'AR',
                text: 'I bought it because fundamentals are too hard to implement. This helped a lot and I use it as part of my trading now.',
                color: T.green,
              },
              {
                name: 'Marcus L.',
                handle: '@ml_futures',
                avatar: 'ML',
                text: "The portfolio review function is insane. Literally tells me what I've done wrong based on the trades I've taken.",
                color: T.purpleLight,
              },
              {
                name: 'Jamie K.',
                handle: '@jk_crypto',
                avatar: 'JK',
                text: "I've been looking for a crypto focused tool like this for a while. Thanks.",
                color: '#60a5fa',
              },
            ].map((r, i) => (
              <div key={i} style={{ background: T.card, border: T.border, borderRadius: T.radius, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `${r.color}22`,
                    border: `1.5px solid ${r.color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: r.color, flexShrink: 0,
                  }}>{r.avatar}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e2f2' }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{r.handle}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 1.5, flexShrink: 0 }}>
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#9898b8', lineHeight: 1.7 }}>"{r.text}"</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      <div ref={refC} style={{ borderTop: '1px solid #0f0f1e', padding: '90px 48px 110px', position: 'relative', overflow: 'hidden', ...fadeC }}>
        {/* Soft purple glow behind CTA */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '80%', height: '100%',
          background: 'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(124,58,237,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 16 }}>
            Ready to trade with <span style={{ color: T.purpleLight }}>context</span>?
          </div>
          <div style={{ fontSize: 15, color: T.muted, marginBottom: 40, lineHeight: 1.65 }}>
            LabLogic is invite-only. If you have an access code, you're already in.
          </div>
          <button onClick={onGetAccess} style={{ ...btnPill, fontSize: 16, padding: '14px 52px', boxShadow: '0 0 32px rgba(124,58,237,0.4)' }}>
            Enter Access Code →
          </button>
        </div>
      </div>

    </div>
  );
}

// ── Shared app-window chrome ───────────────────────────────────────────────────
function MockWindow({ children, url = 'lablogic.app', accentColor }) {
  return (
    <div style={{
      background: '#06061a',
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: `0 1px 0 rgba(255,255,255,0.05) inset, 0 28px 70px rgba(0,0,0,0.9)${accentColor ? `, 0 0 60px ${accentColor}14` : ''}`,
    }}>
      {/* Top gradient line */}
      {accentColor && <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />}
      {/* Chrome bar */}
      <div style={{ background: '#08081e', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#3b1212','#3b3012','#123b18'].map((bg, i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: bg }} />
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: '#06061a', border: '1px solid #101028', borderRadius: 5, padding: '3px 18px', fontSize: 10, color: '#1e1e38' }}>{url}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 5px #22c55e88' }} />
          <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, letterSpacing: 0.5 }}>LIVE</span>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Floating accent badge outside MockWindow ───────────────────────────────────
function FloatBadge({ children, color, style = {} }) {
  return (
    <div style={{
      position: 'absolute', zIndex: 10,
      background: '#0a0a1e',
      border: `1px solid ${color}50`,
      borderRadius: 10, padding: '8px 14px',
      boxShadow: `0 10px 30px rgba(0,0,0,0.6), 0 0 0 1px ${color}18`,
      display: 'flex', alignItems: 'center', gap: 8,
      backdropFilter: 'blur(12px)',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Feature chip ───────────────────────────────────────────────────────────────
function Chip({ children, color = '#7c3aed' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#404062', border: '1px solid #111128', borderRadius: 20, padding: '5px 13px', whiteSpace: 'nowrap' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {children}
    </div>
  );
}

// ── Slide 1: Dashboard ─────────────────────────────────────────────────────────
function Slide1({ onContinue }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', padding: '0 48px 24px', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: '60%', height: '100%', background: 'radial-gradient(ellipse at 80% 20%, rgba(109,40,217,0.1) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div className="ll-content-fade" style={{ width: '100%', maxWidth: 1060, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[true, false, false].map((active, i) => (
            <div key={i} style={{ width: active ? 28 : 8, height: 4, borderRadius: 2, background: active ? '#7c3aed' : '#0e0e20', transition: 'width 0.3s' }} />
          ))}
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2a2a48', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 }}>Market Intelligence</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -1.2 }}>
            Your market command center
          </div>
          <div style={{ fontSize: 16, color: '#383858', lineHeight: 1.6, marginTop: 10 }}>
            Live price, sentiment, volatility, and macro events — unified, no tabs, no noise.
          </div>
        </div>

        {/* Mockup + floating badge */}
        <div style={{ width: '100%', position: 'relative', marginBottom: 16 }}>
          {/* Ambient glow behind window */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(109,40,217,0.12) 0%, transparent 60%)', pointerEvents: 'none', borderRadius: 14 }} />
          <MockWindow url="lablogic.app / dashboard" accentColor="#7c3aed">
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {/* BTC row */}
              <div style={{ background: '#0c0c20', border: '1px solid #141430', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#2a2a46', fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>BTC / USD · LIVE</div>
                  <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: -1.2, lineHeight: 1 }}>$72,614.21</div>
                  <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, marginTop: 6 }}>▲ +$418.30 &nbsp;·&nbsp; +0.58%</div>
                </div>
                <div className="ll-chart-draw" style={{ flex: 1, height: 56, animationDelay: '0.35s' }}>
                  <MiniSparkline pts={[60,63,61,66,62,67,65,70,68,72,70,73]} color="#22c55e" height={56} />
                </div>
              </div>
              {/* 3-col row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
                {/* Sentiment */}
                <div style={{ background: '#0c0c20', border: '1px solid #141430', borderRadius: 10, padding: '14px 15px' }}>
                  <div style={{ fontSize: 10, color: '#2a2a46', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SENTIMENT</div>
                  <div style={{ fontSize: 42, fontWeight: 800, color: '#4ade80', lineHeight: 1, marginBottom: 8 }}>69</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 20, padding: '3px 10px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 5px #22c55e' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>Bullish</span>
                  </div>
                </div>
                {/* Volatility */}
                <div style={{ background: '#0c0c20', border: '1px solid #141430', borderRadius: 10, padding: '14px 15px' }}>
                  <div style={{ fontSize: 10, color: '#2a2a46', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>VOLATILITY</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                    <div><div style={{ fontSize: 10, color: 'rgba(249,115,22,0.5)', marginBottom: 2 }}>IV</div><div style={{ fontSize: 28, fontWeight: 800, color: '#f97316' }}>48%</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: 'rgba(74,222,128,0.5)', marginBottom: 2 }}>RV</div><div style={{ fontSize: 28, fontWeight: 800, color: '#4ade80' }}>37%</div></div>
                  </div>
                  <div style={{ height: 3, background: '#101028', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: '55%', background: 'linear-gradient(90deg, #7c3aed, #f97316)', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#2a2a46', marginTop: 6 }}>Elevated — premiums rich</div>
                </div>
                {/* Events */}
                <div style={{ background: '#0c0c20', border: '1px solid #141430', borderRadius: 10, padding: '14px 15px' }}>
                  <div style={{ fontSize: 10, color: '#2a2a46', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>TODAY'S EVENTS</div>
                  {[{ n: 'CPI y/y', t: '08:30', c: '#ef4444' }, { n: 'FOMC Minutes', t: '14:00', c: '#ef4444' }, { n: 'Retail Sales', t: '10:00', c: '#f97316' }].map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < 2 ? 8 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: e.c, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#7878a0' }}>{e.n}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#2a2a46' }}>{e.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </MockWindow>
          {/* Floating badge — bottom right */}
          <FloatBadge color="#22c55e" style={{ bottom: -16, right: -8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 7px #22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>$72,614</span>
            <span style={{ fontSize: 12, color: '#324232' }}>▲ +0.58% today</span>
          </FloatBadge>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip color="#22c55e">Live BTC/USD</Chip>
          <Chip color="#a855f7">AI sentiment score</Chip>
          <Chip color="#f97316">IV vs RV</Chip>
          <Chip color="#ef4444">Macro events</Chip>
        </div>

        <button onClick={onContinue} style={{ ...btnPill, padding: '12px 40px', fontSize: 15 }}>Next →</button>
      </div>
    </div>
  );
}

// ── Slide 2: Trade Journal ─────────────────────────────────────────────────────
function Slide2({ onContinue }) {
  const eqPts = [0, 1240, 2736, 2100, 1752, 2320, 1322, 1820, 2802, 3260];
  const eqW = 500, eqH = 68;
  const eqMin = Math.min(...eqPts), eqMax = Math.max(...eqPts);
  const eqRange = eqMax - eqMin || 1;
  const eqCoords = eqPts.map((v, i) => ({
    x: (i / (eqPts.length - 1)) * eqW,
    y: eqH - ((v - eqMin) / eqRange) * (eqH * 0.78) - eqH * 0.08,
  }));
  const eqPath = eqCoords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const eqFill = `${eqPath} L${eqW},${eqH} L0,${eqH} Z`;
  const eqLast = eqCoords[eqCoords.length - 1];

  const firstDay = 3;
  const tradeDays = { 2: { pnl: 1240 }, 7: { pnl: 2736 }, 8: { pnl: -984 }, 9: { pnl: -430 }, 10: { pnl: 1480 }, 14: { pnl: 858 }, 15: { pnl: -320 }, 16: { pnl: 1960 } };
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= 14; d++) cells.push({ day: d, data: tradeDays[d] || null });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', padding: '0 48px 24px', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '55%', height: '90%', background: 'radial-gradient(ellipse at 20% 80%, rgba(34,197,94,0.07) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div className="ll-content-fade" style={{ width: '100%', maxWidth: 1060, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

        {/* Step */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[false, true, false].map((active, i) => (
            <div key={i} style={{ width: active ? 28 : 8, height: 4, borderRadius: 2, background: active ? '#7c3aed' : '#0e0e20' }} />
          ))}
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2a2a48', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 }}>Trade Journal</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -1.2 }}>
            Track every trade. Own your edge.
          </div>
          <div style={{ fontSize: 16, color: '#383858', lineHeight: 1.6, marginTop: 10 }}>
            Log trades, see every green and red day, watch your equity grow.
          </div>
        </div>

        {/* Mockup + floating badge */}
        <div style={{ width: '100%', position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(34,197,94,0.08) 0%, transparent 60%)', pointerEvents: 'none', borderRadius: 14 }} />
          <MockWindow url="lablogic.app / journal" accentColor="#22c55e">
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
                {[{ l: 'Win Rate', v: '62%', c: '#22c55e', sub: '5 of 8 trades' }, { l: 'Total P&L', v: '+$6,540', c: '#22c55e', sub: 'April 2026' }, { l: 'Trades', v: '8', c: '#c8c8e8', sub: 'this month' }, { l: 'Streak', v: '2W', c: '#a855f7', sub: 'current' }].map(s => (
                  <div key={s.l} style={{ background: '#0c0c20', border: '1px solid #141430', borderRadius: 9, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: '#2a2a46', fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>{s.l.toUpperCase()}</div>
                    <div style={{ fontSize: 23, fontWeight: 800, color: s.c, lineHeight: 1, marginBottom: 4 }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: '#2a2a38', fontWeight: 500 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              {/* Equity curve */}
              <div style={{ background: '#0c0c20', border: '1px solid #141430', borderRadius: 10, padding: '13px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#2a2a46', fontWeight: 700, letterSpacing: 1 }}>EQUITY CURVE · APRIL 2026</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 5px #22c55e' }} />
                    +$6,540 ▲
                  </div>
                </div>
                <svg viewBox={`0 0 ${eqW} ${eqH}`} width="100%" height={eqH + 10} className="ll-chart-draw" style={{ display: 'block', animationDelay: '0.3s', animationDuration: '2s' }}>
                  <defs>
                    <linearGradient id="s2eq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  <path d={eqFill} fill="url(#s2eq)" />
                  <path d={eqPath} fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' }} />
                  <circle cx={eqLast.x} cy={eqLast.y} r={5} fill="#22c55e" />
                  <circle cx={eqLast.x} cy={eqLast.y} r={9} fill="none" stroke="#22c55e" strokeWidth="1.4" strokeOpacity="0.35" />
                </svg>
              </div>
              {/* Calendar (2 weeks) */}
              <div style={{ background: '#0c0c20', border: '1px solid #141430', borderRadius: 10, padding: '13px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#2a2a46', fontWeight: 700, letterSpacing: 1 }}>APRIL 2026</div>
                  <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700 }}>8 trades logged</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                  {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, color: '#1e1e38', fontWeight: 700 }}>{d}</div>)}
                </div>
                {weeks.map((week, wi) => (
                  <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                    {week.map((cell, ci) => {
                      if (!cell) return <div key={ci} style={{ borderRadius: 4, background: '#0a0a1c', border: '1px solid #0e0e24', minHeight: 26 }} />;
                      const isToday = cell.day === 10;
                      const isPos = cell.data && cell.data.pnl > 0;
                      return (
                        <div key={ci} style={{ background: !cell.data ? '#0c0c1e' : isPos ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)', border: `1px solid ${isToday ? 'rgba(168,85,247,0.6)' : !cell.data ? '#141430' : isPos ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, borderRadius: 4, padding: '3px 5px', minHeight: 26, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 9, color: isToday ? '#a855f7' : '#1e1e38', fontWeight: isToday ? 800 : 400 }}>{cell.day}</div>
                          {cell.data && <div style={{ fontSize: 9, fontWeight: 700, color: isPos ? '#22c55e' : '#ef4444', lineHeight: 1 }}>{isPos ? '+' : ''}{(cell.data.pnl / 1000).toFixed(1)}k</div>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </MockWindow>
          {/* Floating badge — bottom left */}
          <FloatBadge color="#22c55e" style={{ bottom: -16, left: -8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>+$6,540</span>
            <span style={{ fontSize: 12, color: '#1e3828' }}>April P&L · 8 trades</span>
          </FloatBadge>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip color="#22c55e">Calendar view</Chip>
          <Chip color="#22c55e">Equity curve</Chip>
          <Chip color="#a855f7">Win rate & P&L</Chip>
          <Chip color="#7c3aed">AI Portfolio Review</Chip>
        </div>

        <button onClick={onContinue} style={{ ...btnPill, padding: '12px 40px', fontSize: 15 }}>Next →</button>
      </div>
    </div>
  );
}

// ── Slide 3: AI Portfolio Review ───────────────────────────────────────────────
function Slide3({ onContinue }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', padding: '0 48px 24px', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '70%', height: '80%', background: 'radial-gradient(ellipse at 50% 20%, rgba(109,40,217,0.13) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div className="ll-content-fade" style={{ width: '100%', maxWidth: 1060, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

        {/* Step */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[false, false, true].map((active, i) => (
            <div key={i} style={{ width: active ? 28 : 8, height: 4, borderRadius: 2, background: active ? '#7c3aed' : '#0e0e20' }} />
          ))}
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2a2a48', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 }}>AI Portfolio Review</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -1.2 }}>
            Institutional AI. Built for you.
          </div>
          <div style={{ fontSize: 16, color: '#383858', lineHeight: 1.6, marginTop: 10 }}>
            Your edge, your flaws, and a concrete action plan — surfaced automatically.
          </div>
        </div>

        {/* Mockup + floating badge */}
        <div style={{ width: '100%', position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(109,40,217,0.14) 0%, transparent 60%)', pointerEvents: 'none', borderRadius: 14 }} />
          <MockWindow url="lablogic.app / ai-review" accentColor="#7c3aed">
            <div>
              {/* Purple header */}
              <div style={{ background: 'linear-gradient(105deg, #1e0840, #3b0f87, #5b21b6)', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13, borderBottom: '1px solid rgba(139,92,246,0.2)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 14px rgba(139,92,246,0.4)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 1.5 }}>AI PORTFOLIO REVIEW</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>4 trades analyzed · April 2026</div>
                </div>
                <div style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '4px 13px', fontSize: 10, fontWeight: 700, color: '#4ade80' }}>✓ Complete</div>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ background: '#0c0c20', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: '13px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: 1.5, marginBottom: 7 }}>PATTERNS OF FLAW</div>
                  <div style={{ fontSize: 14, color: '#666688', lineHeight: 1.7 }}>Shorts entered 2–4 candles early. Stops too tight relative to ATR — causing avoidable drawdown before the move confirms.</div>
                </div>
                <div style={{ background: '#0c0c20', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '13px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', letterSpacing: 1.5, marginBottom: 7 }}>YOUR EDGE</div>
                  <div style={{ fontSize: 14, color: '#666688', lineHeight: 1.7 }}>NY open longs (08:30–10:30): <span style={{ color: '#4ade80', fontWeight: 700 }}>71% win rate</span>, avg R:R <span style={{ color: '#4ade80', fontWeight: 700 }}>2.4</span>. Best around macro event reactions.</div>
                </div>
                <div style={{ background: '#0c0c20', border: '1px solid rgba(139,92,246,0.22)', borderRadius: 10, padding: '13px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: 1.5, marginBottom: 7 }}>ACTION PLAN</div>
                  <div style={{ fontSize: 14, color: '#666688', lineHeight: 1.7 }}>Only short confirmed 15m structure breaks. Add +25% size on NY open longs. Cut all trades after 14:00 ET.</div>
                </div>
              </div>
            </div>
          </MockWindow>
          {/* Floating badge — top right */}
          <FloatBadge color="#a855f7" style={{ top: 48, right: -12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#a855f7' }}>71%</span>
            <span style={{ fontSize: 12, color: '#38284a' }}>win rate · NY open</span>
          </FloatBadge>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip color="#ef4444">Pattern recognition</Chip>
          <Chip color="#22c55e">Edge identification</Chip>
          <Chip color="#a855f7">Actionable steps</Chip>
        </div>

        <button onClick={onContinue} style={{ ...btnPill, padding: '12px 40px', fontSize: 15 }}>Get Access →</button>
      </div>
    </div>
  );
}

// ── Slide 4 ────────────────────────────────────────────────────────────────────
function Slide4() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [focused, setFocused] = useState(false);

  const ACCESS_CODE = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ACCESS_CODE) || 'lablogic';

  const submit = useCallback(() => {
    if (pw === ACCESS_CODE) {
      setSuccess(true);
      setTimeout(() => {
        if (typeof window !== 'undefined') localStorage.setItem('ll_auth', '1');
        router.replace('/');
      }, 500);
    } else {
      setError('Invalid access code.');
      setShaking(true);
      setPw('');
      setTimeout(() => setShaking(false), 600);
    }
  }, [pw, ACCESS_CODE, router]);

  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  const borderColor = success ? '#22c55e' : error ? T.red : focused ? '#7c3aed' : '#1a1a30';
  const glowColor   = success ? 'rgba(34,197,94,0.2)' : error ? 'rgba(239,68,68,0.15)' : focused ? 'rgba(124,58,237,0.2)' : 'transparent';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 32px' }}>

      {/* Logo */}
      <div style={{ marginBottom: 28 }}><FlaskLogo size={52} glow /></div>

      {/* Invite-only badge — suggestion 5 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.28)', borderRadius: 20, padding: '5px 14px', marginBottom: 22 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', display: 'inline-block', boxShadow: '0 0 5px #a855f7' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', letterSpacing: 0.5 }}>Invite-only · Limited access</span>
      </div>

      {/* Headline — suggestion 1 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: -0.6, marginBottom: 8 }}>
          {success ? 'Welcome to LabLogic.' : 'You\'re almost in.'}
        </div>
        <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
          {success ? 'Taking you to the dashboard…' : 'Enter your invite code to get started'}
        </div>
      </div>

      {/* Input area — suggestions 2, 3, 4 */}
      <div style={{ width: '100%', maxWidth: 360, animation: shaking ? 'llShake 0.5s ease both' : 'none' }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>

          {/* Lock icon — suggestion 4 */}
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: success ? '#22c55e' : focused ? '#7c3aed' : '#2a2a46', transition: 'color 0.2s', pointerEvents: 'none' }}>
            {success ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            )}
          </div>

          <input
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(''); }}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Enter invite code"
            autoComplete="current-password"
            disabled={success}
            style={{
              width: '100%',
              background: success ? 'rgba(34,197,94,0.06)' : '#0d0d1a',
              border: `1.5px solid ${borderColor}`,
              boxShadow: `0 0 0 3px ${glowColor}`,
              borderRadius: 10,
              padding: '13px 48px 13px 42px',
              fontSize: 15,
              color: success ? '#22c55e' : '#e2e2f2',
              fontFamily: 'Inter, system-ui, sans-serif',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s, color 0.2s',
              boxSizing: 'border-box',
            }}
          />

          {/* Show/hide toggle */}
          {!success && (
            <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.muted }}>
              {show ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div style={{ fontSize: 13, color: T.red, marginBottom: 12, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* CTA button — success state */}
        <button
          onClick={submit}
          disabled={success}
          style={{
            ...btnPill,
            width: '100%',
            fontSize: 15,
            padding: '13px 0',
            textAlign: 'center',
            background: success
              ? 'linear-gradient(135deg, #16a34a, #22c55e)'
              : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            boxShadow: success
              ? '0 0 28px rgba(34,197,94,0.35)'
              : '0 0 28px rgba(124,58,237,0.35)',
            transition: 'background 0.3s, box-shadow 0.3s',
            opacity: success ? 0.9 : 1,
          }}
        >
          {success ? '✓ Access granted' : 'Enter Dashboard →'}
        </button>
      </div>
    </div>
  );
}

// ── Main LandingPage ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const [slide, setSlide] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const TOTAL = 5;

  const goTo = (n) => {
    setSlide(n);
    setAnimKey(k => k + 1);
  };

  const next = () => { if (slide < TOTAL - 1) goTo(slide + 1); };
  const back = () => { if (slide > 0) goTo(slide - 1); };

  const progress = ((slide + 1) / TOTAL) * 100;

  const slides = [
    <Slide0 key="s0" onContinue={next} onGetAccess={() => goTo(4)} />,
    <Slide1 key="s1" onContinue={next} />,
    <Slide2 key="s2" onContinue={next} />,
    <Slide3 key="s3" onContinue={next} />,
    <Slide4 key="s4" />,
  ];

  return (
    <div style={{
      background: T.bg,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden',
      position: 'fixed',
      inset: 0,
    }}>
      {/* Bottom purple glow — only on hero + login slides */}
      {(slide === 0 || slide === 4) && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
          background: 'radial-gradient(ellipse 90% 70% at 50% 100%, rgba(109,40,217,0.55) 0%, rgba(124,58,237,0.25) 40%, rgba(88,28,220,0.08) 65%, transparent 80%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}

      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#1a1a30', zIndex: 10 }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
          width: `${progress}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Top nav */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 28px 0', position: 'relative', zIndex: 5, minHeight: 60, flexShrink: 0,
      }}>
        <div style={{ width: 80 }}>
          {slide > 0 && (
            <button onClick={back} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskLogo size={26} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e2f2', letterSpacing: 0.5 }}>LabLogic</span>
        </div>
        <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
          {slide > 0 && slide < TOTAL - 1 && (
            <button onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.purpleLight, fontSize: 14, fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Slide content */}
      <div
        key={animKey}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: slide === 0 ? 'hidden' : 'hidden',
          animation: animKey > 0 ? 'llFadeUp 0.4s ease both' : 'none',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: slide === 0 ? 0 : 12,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {slides[slide]}
      </div>
    </div>
  );
}
