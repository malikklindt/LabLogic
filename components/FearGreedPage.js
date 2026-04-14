'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Gauge } from './Gauge';
import { streamAI } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fngColor(v) {
  if (v <= 25) return 'var(--red)';
  if (v <= 45) return 'var(--orange)';
  if (v <= 55) return 'var(--yellow)';
  if (v <= 75) return '#a3e635';
  return 'var(--green)';
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtPrice(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Cardinal spline: smooth bezier through all points
function smoothLinePath(pts, tension = 0.35) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

// ── Zone bands config ─────────────────────────────────────────────────────────
const ZONES = [
  { min: 0,  max: 25,  color: 'var(--red)', label: 'Extreme Fear' },
  { min: 25, max: 45,  color: 'var(--orange)', label: 'Fear' },
  { min: 45, max: 55,  color: 'var(--yellow)', label: 'Neutral' },
  { min: 55, max: 75,  color: '#a3e635', label: 'Greed' },
  { min: 75, max: 100, color: 'var(--green)', label: 'Extreme Greed' },
];

// ── Historical comparison pill ────────────────────────────────────────────────
function HistPill({ label, data, current }) {
  if (!data) return null;
  const color = fngColor(data.value);
  const delta = data.value - current;
  return (
    <div className="fng-hist-row">
      <span className="fng-hist-label">{label}</span>
      <span className="fng-hist-pill" style={{ background: color + '22', color, border: `1px solid ${color}55` }}>
        {data.value} — {data.label}
      </span>
      <span className="fng-hist-delta" style={{ color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--muted)' }}>
        {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '—'}
      </span>
    </div>
  );
}

// ── High-quality SVG Fear & Greed Chart ──────────────────────────────────────
function FGChart({ history, timeframe }) {
  const svgRef      = useRef(null);
  const wrapRef     = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const filtered = useMemo(() => {
    if (!history?.length) return [];
    const now    = Date.now();
    const cutoff = timeframe === '30d' ? 30 : timeframe === '1y' ? 365 : null;
    if (cutoff === null) return history;
    return history.filter(d => (now - d.ts) / 86400000 <= cutoff);
  }, [history, timeframe]);

  if (!filtered.length) return (
    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>No data</div>
  );

  const W = 800, H = 340;
  const PAD = { top: 16, right: 12, bottom: 36, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const n = filtered.length;

  const xS = (i) => PAD.left + (i / (n - 1)) * chartW;
  const yS = (v) => PAD.top + chartH - (v / 100) * chartH;

  const pts = filtered.map((d, i) => ({ x: xS(i), y: yS(d.value) }));
  const linePath = smoothLinePath(pts);

  // Area fill path (line + down to baseline + back)
  const areaPath = linePath
    + ` L ${pts[pts.length - 1].x},${PAD.top + chartH}`
    + ` L ${pts[0].x},${PAD.top + chartH} Z`;

  // Zone bands
  const zoneBands = ZONES.map(z => ({
    ...z, y: yS(z.max), h: ((z.max - z.min) / 100) * chartH,
  }));

  // X-axis date labels (5 ticks)
  const xLabels = [];
  const step = Math.floor((n - 1) / 4);
  for (let k = 0; k <= 4; k++) {
    const i = Math.min(k * step, n - 1);
    xLabels.push({ x: xS(i), label: fmtDateShort(filtered[i].ts) });
  }

  // Y-axis tick values
  const yTicks = [0, 25, 50, 75, 100];

  const handleMouseMove = (e) => {
    const svgRect  = svgRef.current?.getBoundingClientRect();
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!svgRect || !wrapRect) return;
    const mx  = (e.clientX - svgRect.left) * (W / svgRect.width);
    const raw = ((mx - PAD.left) / chartW) * (n - 1);
    const i   = Math.max(0, Math.min(n - 1, Math.round(raw)));
    const d   = filtered[i];
    const color = fngColor(d.value);
    // Pixel position inside the wrapper div
    const px = e.clientX - wrapRect.left;
    const py = e.clientY - wrapRect.top;
    setTooltip({ svgX: xS(i), svgY: yS(d.value), px, py, value: d.value, label: d.label ?? '', date: fmtDate(d.ts), color });
  };

  const gradId  = 'fng-area-grad';
  const clipId  = 'fng-clip';
  const glowId  = 'fng-glow';
  const lastVal = filtered[filtered.length - 1]?.value ?? 50;
  const lineColor = fngColor(lastVal);

  return (
    <div ref={wrapRef} key={timeframe} className="chart-anim" style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        shapeRendering="geometricPrecision"
        textRendering="optimizeLegibility"
      >
        <defs>
          {/* Gradient fill under line */}
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.28" />
            <stop offset="70%"  stopColor={lineColor} stopOpacity="0.06" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
          {/* Glow filter for line */}
          <filter id={glowId} x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Clip to chart area */}
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        {/* Zone background bands */}
        {zoneBands.map(z => (
          <rect key={z.label} x={PAD.left} y={z.y} width={chartW} height={z.h}
            fill={z.color} opacity={0.06} />
        ))}

        {/* Zone label — subtle text inside each band, right-aligned */}
        {zoneBands.map(z => (
          <text key={z.label + '-lbl'}
            x={PAD.left + chartW - 8}
            y={z.y + z.h / 2 + 4}
            fontSize="10" fill={z.color} opacity={0.35}
            textAnchor="end"
            fontFamily="Inter, system-ui, sans-serif" fontWeight="600"
            clipPath={`url(#${clipId})`}>
            {z.label.toUpperCase()}
          </text>
        ))}

        {/* Horizontal grid lines at zone boundaries */}
        {[0, 25, 45, 55, 75, 100].map(v => (
          <line key={v}
            x1={PAD.left} x2={PAD.left + chartW}
            y1={yS(v)} y2={yS(v)}
            stroke="#ffffff" strokeOpacity={0.05} strokeWidth={1}
          />
        ))}

        {/* Y-axis ticks + labels on the left */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left - 4} x2={PAD.left} y1={yS(v)} y2={yS(v)}
              stroke="#6a6a90" strokeOpacity={0.5} strokeWidth={1} />
            <text x={PAD.left - 6} y={yS(v) + 4}
              fontSize="10" fill="var(--muted)" opacity={0.7}
              textAnchor="end" fontFamily="Inter, system-ui, sans-serif">
              {v}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} />

        {/* Main smooth line with glow */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round"
          clipPath={`url(#${clipId})`} filter={`url(#${glowId})`} />

        {/* Crisp line on top */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round"
          clipPath={`url(#${clipId})`} />

        {/* X-axis date labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 6}
            fontSize="11" fill="var(--muted)"
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            fontFamily="Inter, system-ui, sans-serif">
            {l.label}
          </text>
        ))}

        {/* Tooltip crosshair */}
        {tooltip && (
          <>
            <line x1={tooltip.svgX} x2={tooltip.svgX}
              y1={PAD.top} y2={PAD.top + chartH}
              stroke="#ffffff" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={tooltip.svgX} cy={tooltip.svgY} r={5}
              fill={tooltip.color} stroke="var(--card)" strokeWidth={2.5} />
          </>
        )}
      </svg>

      {/* Tooltip card — follows cursor */}
      {tooltip && (() => {
        const TW = 130, TH = 68, OFFSET = 14;
        const wrapW = wrapRef.current?.offsetWidth ?? 600;
        const wrapH = wrapRef.current?.offsetHeight ?? 300;
        let left = tooltip.px + OFFSET;
        let top  = tooltip.py - TH / 2;
        if (left + TW > wrapW - 4) left = tooltip.px - TW - OFFSET;
        if (top < 4) top = 4;
        if (top + TH > wrapH - 4) top = wrapH - TH - 4;
        return (
          <div style={{
            position: 'absolute', top, left, pointerEvents: 'none', zIndex: 10,
            background: 'var(--card2)', border: `1px solid ${tooltip.color}55`,
            borderRadius: 10, padding: '8px 14px', width: TW,
            boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 12px ${tooltip.color}22`,
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{tooltip.date}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: tooltip.color, lineHeight: 1 }}>{tooltip.value}</div>
            <div style={{ fontSize: 10, color: tooltip.color, marginTop: 3, opacity: 0.85 }}>{tooltip.label}</div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FearGreedPage() {
  const [fng,       setFng]       = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [timeframe, setTimeframe] = useState('30d');
  const [btcPrice,  setBtcPrice]  = useState(null);
  const [btcChange, setBtcChange] = useState(null);
  const [aiText,    setAiText]    = useState('');
  const [aiState,   setAiState]   = useState('idle');

  const typeQueue = useRef([]);
  const typeTimer = useRef(null);
  const genId     = useRef(0);
  const drainRef  = useRef(null);

  drainRef.current = (id) => {
    if (id !== genId.current) return;
    if (typeQueue.current.length === 0) { typeTimer.current = null; return; }
    const char = typeQueue.current.shift();
    setAiText(prev => prev + char);
    typeTimer.current = setTimeout(() => drainRef.current(id), 14);
  };

  // Fetch FNG data
  useEffect(() => {
    fetch('/api/fear-greed')
      .then(r => r.json())
      .then(d => { if (!d.error) setFng(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Fetch BTC price from Binance directly (reliable, no auth)
  useEffect(() => {
    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then(r => r.json())
      .then(d => {
        if (d?.lastPrice) setBtcPrice(parseFloat(d.lastPrice));
        if (d?.priceChangePercent) setBtcChange(parseFloat(d.priceChangePercent));
      })
      .catch(() => {});
  }, []);

  // AI analysis
  useEffect(() => {
    if (!fng?.current) return;
    const id = ++genId.current;
    typeQueue.current = [];
    setAiText('');
    setAiState('loading');

    streamAI(
      {
        system: 'You are a crypto market analyst. Two sentences max, 40 words max. Be direct and specific about what this sentiment level means for traders right now.',
        messages: [{ role: 'user', content: `Bitcoin Fear & Greed Index: ${fng.current.value} (${fng.current.label}). Yesterday: ${fng.yesterday?.value ?? 'unknown'}. What should traders know?` }],
        max_tokens: 90,
      },
      (chunk) => {
        if (id !== genId.current) return;
        for (const char of chunk) typeQueue.current.push(char);
        if (!typeTimer.current) drainRef.current(id);
        setAiState(s => s === 'loading' ? 'streaming' : s);
      },
      () => { if (id === genId.current) setAiState('done'); },
      () => { if (id === genId.current) setAiState('error'); },
    );
  }, [fng?.current?.value]);

  useEffect(() => () => { if (typeTimer.current) clearTimeout(typeTimer.current); }, []);

  const val   = fng?.current?.value ?? 50;
  const color = fngColor(val);

  return (
    <div className="page-scroll">
      <div className="fng-wrap">

        {/* Page header */}
        <div className="fng-header">
          <div>
            <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--fg)' }}>Fear &amp; Greed Index</h1>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 3 }}>
              Bitcoin market sentiment — updated daily
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 24, paddingTop: 20 }}>
            <div className="skeleton" style={{ width: 'clamp(320px,28vw,460px)', height: 520, borderRadius: 16, flexShrink: 0 }} />
            <div className="skeleton" style={{ flex: 1, height: 520, borderRadius: 16 }} />
          </div>
        ) : !fng ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Unable to load index data.</div>
        ) : (
          <div className="fng-grid">

            {/* ── Left column ── */}
            <div className="fng-left">

              {/* Gauge + BTC price */}
              <div className="card fng-gauge-card">
                <Gauge value={val} label={fng.current.label} size={300} pillColor={color} />

                {/* BTC price row */}
                <div className="fng-btc-row">
                  <div className="fng-btc-logo">
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="16" fill="#F7931A"/>
                      <path d="M22.5 13.7c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6-1.3-.3.7-2.6-1.7-.4-.7 2.6-2.7-.6-.5 1.8s1.3.3 1.2.3c.7.2.8.6.8.9L12.1 17c-.1.2-.3.5-.7.4h-1.2l-.8 2 2.6.6-.7 2.7 1.7.4.7-2.7 1.3.3-.7 2.7 1.7.4.7-2.7c2.9.5 5-.2 5.9-2.8.7-2-.1-3.2-1.5-3.9 1.1-.3 1.9-1 2.1-2.4zm-3.8 5.3c-.5 2-3.9.9-5 .6l.9-3.5c1.1.3 4.6.8 4.1 2.9zm.5-5.3c-.5 1.8-3.3.9-4.2.7l.8-3.2c.9.2 3.9.6 3.4 2.5z" fill="white"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginBottom: 1 }}>Bitcoin</div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--fg)', lineHeight: 1 }}>
                      {btcPrice != null ? fmtPrice(btcPrice) : <span style={{ color: 'var(--muted4)' }}>Loading…</span>}
                    </div>
                  </div>
                  {btcChange != null && (
                    <div style={{
                      marginLeft: 'auto',
                      background: btcChange >= 0 ? '#22c55e22' : '#ef444422',
                      border: `1px solid ${btcChange >= 0 ? '#22c55e55' : '#ef444455'}`,
                      color: btcChange >= 0 ? 'var(--green)' : 'var(--red)',
                      borderRadius: 20, padding: '4px 12px',
                      fontSize: 'var(--fs-sm)', fontWeight: 700,
                    }}>
                      {btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Historical Values */}
              <div className="card fng-section-card">
                <div className="fng-section-title">Historical Values</div>
                <HistPill label="Yesterday"  data={fng.yesterday} current={val} />
                <HistPill label="Last Week"  data={fng.lastWeek}  current={val} />
                <HistPill label="Last Month" data={fng.lastMonth} current={val} />
              </div>

              {/* Yearly High / Low */}
              {(fng.yearlyHigh || fng.yearlyLow) && (
                <div className="card fng-section-card">
                  <div className="fng-section-title">Yearly High / Low</div>
                  {fng.yearlyHigh && (
                    <div className="fng-hl-row">
                      <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-xs)', minWidth: 30 }}>High</span>
                      <span style={{ color: fngColor(fng.yearlyHigh.value), fontWeight: 700 }}>
                        {fng.yearlyHigh.value} — {fng.yearlyHigh.label}
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-xs)' }}>
                        {fmtDate(fng.yearlyHigh.ts)}
                      </span>
                    </div>
                  )}
                  {fng.yearlyLow && (
                    <div className="fng-hl-row">
                      <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-xs)', minWidth: 30 }}>Low</span>
                      <span style={{ color: fngColor(fng.yearlyLow.value), fontWeight: 700 }}>
                        {fng.yearlyLow.value} — {fng.yearlyLow.label}
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-xs)' }}>
                        {fmtDate(fng.yearlyLow.ts)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis */}
              <div className="card fng-section-card">
                <div className="ai-badge" style={{ marginBottom: 8 }}>🤖 AI Analysis</div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted3)', lineHeight: 1.7, minHeight: '3em' }}>
                  {aiState === 'loading'                             && <span style={{ fontStyle: 'italic' }}>Analyzing...</span>}
                  {(aiState === 'streaming' || aiState === 'done')  && aiText}
                  {aiState === 'error'                              && <span style={{ color: '#f87171' }}>Unable to load analysis.</span>}
                </p>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="fng-right">
              <div className="card fng-chart-card">
                <div className="fng-chart-header">
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--fg)' }}>
                    Fear and Greed Index Chart
                  </span>
                  <div className="fng-tf-buttons">
                    {['30d', '1y', 'All'].map(tf => (
                      <button key={tf}
                        className={`fng-tf-btn${timeframe === tf ? ' fng-tf-active' : ''}`}
                        onClick={() => setTimeframe(tf)}>
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <FGChart history={fng.history} timeframe={timeframe} />
              </div>

              {/* Zone legend */}
              <div className="card fng-legend-card">
                {ZONES.map(z => (
                  <div key={z.label} className="fng-zone">
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
                    <span style={{ color: z.color, fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{z.label}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-xs)' }}>{z.min}–{z.max}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
