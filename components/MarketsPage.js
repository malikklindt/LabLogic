'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';


// ── Formatters ────────────────────────────────────────────────────────────────
function fmtUSD(n, compact = false) {
  if (n == null) return '—';
  if (compact) {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });
}

function fmtPct(n) {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function pctColor(n) {
  if (n == null) return 'var(--muted)';
  return n >= 0 ? 'var(--green)' : 'var(--red)';
}

function fmtAxis(n) {
  if (n == null) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1)         return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function fmtDate(ts, range) {
  const d = new Date(ts);
  if (range === '7D') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (range === '1M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function getTVUrl(asset) {
  if (asset.type === 'crypto') {
    return `https://www.tradingview.com/chart/?symbol=BINANCE:${asset.symbol.toUpperCase()}USDT`;
  }
  const MAP = { SPY: 'AMEX:SPY', GLD: 'AMEX:GLD', CPER: 'AMEX:CPER', USO: 'AMEX:USO' };
  return `https://www.tradingview.com/chart/?symbol=${MAP[asset.symbol] ?? asset.symbol}`;
}

// ── Inline sparkline ──────────────────────────────────────────────────────────
function Sparkline({ data, color, width = 80, height = 28, strokeWidth = 1.5, filled = false }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * (height - 2) - 1,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {filled && <path d={`${path} L${width},${height} L0,${height} Z`} fill={`${color}18`} />}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Full line chart (modal) ───────────────────────────────────────────────────
function LineChart({ prices, color, range, gradId, clipId }) {
  const [hoverIdx,  setHoverIdx]  = useState(null);
  const [revealed,  setRevealed]  = useState(false);
  const svgRef = useRef(null);

  // Re-trigger draw animation whenever range or data changes
  useEffect(() => {
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 40);
    return () => clearTimeout(t);
  }, [range, prices?.length]);

  if (!prices || prices.length < 2) {
    return <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted4)', fontSize: 13 }}>No chart data</div>;
  }

  const W = 560, H = 220;
  const PAD = { top: 16, right: 68, bottom: 28, left: 8 };
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top  - PAD.bottom;

  const vals = prices.map(p => p.price);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const vRange = max - min || 1;

  const cx = i => PAD.left + (i / (prices.length - 1)) * PW;
  const cy = v => PAD.top + PH - ((v - min) / vRange) * PH;

  const linePath = prices.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(p.price).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${cx(prices.length - 1).toFixed(1)},${(PAD.top + PH).toFixed(1)} L${cx(0).toFixed(1)},${(PAD.top + PH).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    v: min + t * vRange,
    y: PAD.top + PH - t * PH,
  }));

  // X-axis ticks (5 evenly spaced)
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const idx = Math.round(t * (prices.length - 1));
    return { idx, x: cx(idx), label: fmtDate(prices[idx].ts, range) };
  });

  const handleMouseMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx  = e.clientX - rect.left - PAD.left;
    const idx = Math.max(0, Math.min(prices.length - 1, Math.round((mx / PW) * (prices.length - 1))));
    setHoverIdx(idx);
  };

  const hp = hoverIdx !== null ? prices[hoverIdx] : null;
  const hx = hoverIdx !== null ? cx(hoverIdx) : null;
  const hy = hoverIdx !== null ? cy(prices[hoverIdx].price) : null;
  const tooltipLeft = hoverIdx !== null && hoverIdx > prices.length * 0.75;

  return (
    <svg
      ref={svgRef}
      width="100%" viewBox={`0 0 ${W} ${H}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
      style={{ display: 'block', cursor: 'crosshair' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect
            x={PAD.left} y={PAD.top - 4}
            width={revealed ? PW + 2 : 0}
            height={PH + 12}
            style={{ transition: revealed ? 'width 1.1s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }}
          />
        </clipPath>
      </defs>

      {/* Grid lines — always visible */}
      {yTicks.map((t, i) => (
        <line key={i} x1={PAD.left} x2={PAD.left + PW} y1={t.y} y2={t.y} stroke="var(--card2)" strokeWidth="1" />
      ))}

      {/* Area + Line — revealed left to right */}
      <g clipPath={`url(#${clipId})`}>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <text key={i} x={PAD.left + PW + 6} y={t.y + 4} fill="var(--muted5)" fontSize="10" fontFamily="Inter, sans-serif">{fmtAxis(t.v)}</text>
      ))}

      {/* X-axis labels */}
      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={H - 4} fill="var(--muted4)" fontSize="9" fontFamily="Inter, sans-serif" textAnchor="middle">{t.label}</text>
      ))}

      {/* Hover elements */}
      {hp && (
        <>
          <line x1={hx} x2={hx} y1={PAD.top} y2={PAD.top + PH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <circle cx={hx} cy={hy} r="4.5" fill={color} stroke="var(--bg2)" strokeWidth="2" />

          {/* Tooltip */}
          <g transform={`translate(${tooltipLeft ? hx - 130 : hx + 10}, ${Math.max(PAD.top, hy - 32)})`}>
            <rect x="0" y="0" width="120" height="38" rx="6" fill="var(--card)" stroke={`${color}40`} strokeWidth="1" />
            <text x="10" y="14" fill="var(--fg)" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">
              {fmtUSD(hp.price)}
            </text>
            <text x="10" y="30" fill="var(--muted5)" fontSize="10" fontFamily="Inter, sans-serif">
              {new Date(hp.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </text>
          </g>
        </>
      )}
    </svg>
  );
}

// ── Asset detail modal ────────────────────────────────────────────────────────
const RANGES = ['7D', '1M', '3M', '1Y'];
const RANGE_DAYS = { '7D': 7, '1M': 30, '3M': 90, '1Y': 365 };

function AssetModal({ asset, onClose }) {
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError]     = useState(false);
  const [range, setRange]       = useState('1Y');
  const [closing, setClosing]   = useState(false);

  const handleClose = () => { setClosing(true); setTimeout(onClose, 220); };

  useEffect(() => {
    setChartLoading(true); setChartError(false);
    const url = asset.type === 'crypto'
      ? `/api/asset-chart?type=crypto&id=${asset.id}`
      : `/api/asset-chart?type=macro&symbol=${asset.symbol}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setChartData(d); })
      .catch(() => setChartError(true))
      .finally(() => setChartLoading(false));
  }, [asset.id, asset.symbol]);

  // Slice prices by selected range
  const allPrices = chartData?.prices ?? [];
  const cutoff    = Date.now() - RANGE_DAYS[range] * 24 * 3600 * 1000;
  const prices    = allPrices.filter(p => p.ts >= cutoff);

  // Compute range change %
  const rangeChange = prices.length >= 2
    ? ((prices[prices.length - 1].price - prices[0].price) / prices[0].price) * 100
    : null;

  const accentColor = asset.type === 'crypto'
    ? (asset.pct24h ?? 0) >= 0 ? 'var(--green)' : 'var(--red)'
    : asset.color;

  const chartColor = rangeChange != null
    ? rangeChange >= 0 ? '#22c55e' : '#ef4444' // Must be hex for Chart.js canvas
    : accentColor;

  const gradId  = `grad_${(asset.id ?? asset.symbol ?? 'x').replace(/[^a-z0-9]/gi, '')}`;
  const clipId  = `clip_${(asset.id ?? asset.symbol ?? 'x').replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,10,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: closing ? 'modalFadeIn 0.22s ease reverse both' : 'modalFadeIn 0.18s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 660,
          background: 'var(--bg2)',
          border: `1px solid ${chartColor}28`,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: `0 0 80px ${chartColor}12, 0 32px 80px rgba(0,0,0,0.7)`,
          animation: closing ? 'modalSlideUp 0.22s cubic-bezier(0.22,1,0.36,1) reverse both' : 'modalSlideUp 0.22s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* ── Modal header ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px',
          borderBottom: '1px solid #111128',
          background: `linear-gradient(135deg, ${chartColor}06, transparent)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {asset.image && (
              <img src={asset.image} alt={asset.symbol} width={36} height={36} style={{ borderRadius: '50%' }} />
            )}
            {!asset.image && (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${accentColor}20`, border: `1.5px solid ${accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: accentColor }}>{(asset.symbol ?? asset.label ?? '?')[0].toUpperCase()}</span>
              </div>
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.3, lineHeight: 1.1 }}>
                {asset.name ?? asset.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>
                {asset.symbol}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Current price */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.5, lineHeight: 1 }}>
                {asset.type === 'crypto' ? fmtUSD(asset.currentPrice) : fmtUSD(asset.quote?.price)}
              </div>
              {rangeChange != null && (
                <div style={{ fontSize: 12, fontWeight: 700, color: chartColor, marginTop: 3 }}>
                  {fmtPct(rangeChange)} ({range})
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              style={{ background: 'none', border: 'none', color: 'var(--muted5)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}
            >×</button>
          </div>
        </div>

        {/* ── Range selector ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 22px 0' }}>
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg3)', borderRadius: 8, padding: 3, border: '1px solid #111128' }}>
            {RANGES.map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                background: range === r ? 'var(--border)' : 'transparent',
                border: `1px solid ${range === r ? 'var(--border2)' : 'transparent'}`,
                borderRadius: 5, padding: '4px 10px',
                fontSize: 11, fontWeight: range === r ? 700 : 400,
                color: range === r ? 'var(--text)' : 'var(--muted3)',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>{r}</button>
            ))}
          </div>

          <a
            href={getTVUrl(asset)} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 700, color: 'var(--muted3)',
              background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a30',
              borderRadius: 7, padding: '5px 12px',
              textDecoration: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            TradingView ↗
          </a>
        </div>

        {/* ── Chart ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 22px 0', minHeight: 240 }}>
          {chartLoading && (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted4)', fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: chartColor, animation: 'mktPulse 1s ease infinite' }} />
                Loading chart...
              </div>
            </div>
          )}
          {chartError && (
            <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ color: 'var(--muted5)', fontSize: 13 }}>Chart data temporarily unavailable</div>
              <a href={getTVUrl(asset)} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--indigo)', textDecoration: 'none', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 7, padding: '6px 14px' }}>
                View full chart on TradingView ↗
              </a>
            </div>
          )}
          {!chartLoading && !chartError && (
            <LineChart prices={prices} color={chartColor} range={range} gradId={gradId} clipId={clipId} />
          )}
        </div>

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '16px 22px 20px' }}>
          {(asset.type === 'crypto' ? [
            { label: 'Market Cap',        value: fmtUSD(asset.marketCap, true) },
            { label: '24h Volume',        value: fmtUSD(asset.volume24h, true) },
            { label: '24h High',          value: fmtUSD(asset.high24h),         color: 'var(--green)' },
            { label: '24h Low',           value: fmtUSD(asset.low24h),          color: 'var(--red)' },
          ] : [
            { label: 'Price',             value: fmtUSD(asset.quote?.price) },
            { label: '24h Change',        value: fmtPct(asset.quote?.changePct), color: pctColor(asset.quote?.changePct) },
            { label: 'Day High',          value: fmtUSD(asset.quote?.high),      color: 'var(--green)' },
            { label: 'Day Low',           value: fmtUSD(asset.quote?.low),       color: 'var(--red)' },
          ]).map(stat => (
            <div key={stat.label} style={{ background: 'var(--card)', border: '1px solid #111128', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: stat.color ?? 'var(--text)' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Macro asset card ──────────────────────────────────────────────────────────
function MacroCard({ asset, onSelect }) {
  const { label, color, quote, candles } = asset;
  const up = quote?.changePct >= 0;
  const accentColor = quote ? (up ? 'var(--green)' : 'var(--red)') : color;

  return (
    <div
      onClick={() => onSelect(asset)}
      style={{
        background: 'var(--card)', border: `1px solid ${accentColor}20`,
        borderRadius: 14, padding: '16px 18px',
        flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden',
        cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accentColor}50`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${accentColor}20`; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}44)` }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
          {quote
            ? <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.5, lineHeight: 1.2, marginTop: 4 }}>{fmtUSD(quote.price)}</div>
            : <div style={{ fontSize: 14, color: 'var(--muted4)', marginTop: 4 }}>No data</div>
          }
        </div>
        {quote && (
          <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, background: `${accentColor}15`, border: `1px solid ${accentColor}30`, borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>
            {fmtPct(quote.changePct)}
          </div>
        )}
      </div>
      {candles?.length > 1 && <Sparkline data={candles} color={accentColor} width={120} height={36} strokeWidth={1.8} filled />}
      {quote && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {[['High', fmtUSD(quote.high), 'var(--green)'], ['Low', fmtUSD(quote.low), 'var(--red)'], ['Prev', fmtUSD(quote.prevClose), 'var(--muted)']].map(([l, v, c]) => (
            <div key={l}>
              <div style={{ fontSize: 9, color: 'var(--muted4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{l}</div>
              <div style={{ fontSize: 11, color: c, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Crypto screener row ───────────────────────────────────────────────────────
function CoinRow({ coin, index, onSelect }) {
  const pct24     = coin.price_change_percentage_24h;
  const pct7d     = coin.price_change_percentage_7d_in_currency;
  const sparkData = coin.sparkline_in_7d?.price ?? [];
  const sparkColor = (pct7d ?? pct24 ?? 0) >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div
      onClick={() => onSelect({
        type: 'crypto', id: coin.id,
        name: coin.name, symbol: coin.symbol, image: coin.image,
        currentPrice: coin.current_price, pct24h: pct24,
        marketCap: coin.market_cap, volume24h: coin.total_volume,
        high24h: coin.high_24h, low24h: coin.low_24h,
        color: sparkColor,
      })}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 200px 1fr 90px 72px 72px 110px 100px 88px',
        alignItems: 'center', gap: 0,
        padding: '10px 16px', borderBottom: '1px solid #0d0d1a',
        animation: `mktSlideIn 0.3s cubic-bezier(0.22,1,0.36,1) ${index * 0.025}s both`,
        transition: 'background 0.15s', cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ fontSize: 11, color: 'var(--muted4)', fontWeight: 600, textAlign: 'right', paddingRight: 12 }}>{coin.market_cap_rank}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={coin.image} alt={coin.symbol} width={24} height={24} style={{ borderRadius: '50%', flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{coin.name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{coin.symbol}</div>
        </div>
      </div>
      <div />
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', textAlign: 'right' }}>{fmtUSD(coin.current_price)}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: pctColor(pct24), textAlign: 'right' }}>{fmtPct(pct24)}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: pctColor(pct7d), textAlign: 'right' }}>{fmtPct(pct7d)}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>{fmtUSD(coin.market_cap, true)}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{fmtUSD(coin.total_volume, true)}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingLeft: 8 }}>
        <Sparkline data={sparkData} color={sparkColor} width={80} height={28} />
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid #1a1a30', borderRadius: 12, padding: '14px 20px', flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--fg)', letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted3)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── BTC dominance bar ─────────────────────────────────────────────────────────
function DomBar({ btcPct }) {
  if (btcPct == null) return null;
  return (
    <div style={{ flex: 2, background: 'var(--card)', border: '1px solid #1a1a30', borderRadius: 12, padding: '14px 20px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Market Dominance</div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--card2)', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${btcPct}%`, background: 'linear-gradient(90deg, #f97316, #f97316bb)', transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700 }}>BTC {btcPct.toFixed(1)}%</span>
        <span style={{ fontSize: 11, color: 'var(--indigo)', fontWeight: 700 }}>Others {(100 - btcPct).toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const router = useRouter();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [lastUpdated, setLast]    = useState(null);
  const [sortKey, setSort]        = useState('rank');
  const [sortAsc, setSortAsc]     = useState(true);
  const [selectedAsset, setSelected] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('ll_auth') !== '1') {
      router.replace('/login');
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/markets');
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json());
      setLast(Date.now());
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const coins  = data?.coins ?? [];
  const global = data?.global;
  const macro  = data?.macro  ?? [];

  const sorted = [...coins].sort((a, b) => {
    const v = (c) => {
      switch (sortKey) {
        case 'price':  return c.current_price;
        case 'pct24h': return c.price_change_percentage_24h ?? -999;
        case 'pct7d':  return c.price_change_percentage_7d_in_currency ?? -999;
        case 'mcap':   return c.market_cap;
        case 'vol':    return c.total_volume;
        default:       return c.market_cap_rank;
      }
    };
    return sortAsc ? v(a) - v(b) : v(b) - v(a);
  });

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSort(key); setSortAsc(key === 'rank'); }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes mktSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mktPulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes modalFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .mkt-sort-btn { transition: color 0.15s; }
        .mkt-sort-btn:hover { color: #c0c0e0 !important; }
      `}</style>

      {selectedAsset && <AssetModal asset={selectedAsset} onClose={() => setSelected(null)} />}

      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(18px, 1.5vw, 30px)', minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'clamp(14px, 1.1vw, 22px)' }}>
          <div>
            <div style={{ fontSize: 'clamp(17px, 1.2vw, 24px)', fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.5, marginBottom: 4 }}>Markets</div>
            <div style={{ fontSize: 'clamp(11px, 0.62vw, 13px)', color: 'var(--muted3)' }}>Top 30 crypto · S&P 500 · Gold · Copper · Crude Oil · Click any asset for chart</div>
          </div>
          {lastUpdated && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--muted4)' }}>Updated {timeAgo(lastUpdated)}</div>
              <button onClick={fetchData} style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', color: 'var(--muted5)', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>↻ Refresh</button>
            </div>
          )}
        </div>

        {/* Global stats */}
        <div style={{ display: 'flex', gap: 'clamp(8px, 0.6vw, 12px)', marginBottom: 'clamp(12px, 0.9vw, 18px)', flexWrap: 'wrap' }}>
          <StatPill label="Total Market Cap" value={global ? fmtUSD(global.total_market_cap_usd, true) : '—'} sub={global ? `${fmtPct(global.market_cap_change_24h)} (24h)` : null} color={global ? pctColor(global.market_cap_change_24h) : 'var(--fg)'} />
          <StatPill label="BTC Dominance" value={global ? `${global.btc_dominance?.toFixed(1)}%` : '—'} color="#f97316" sub="Share of total market cap" />
          <DomBar btcPct={global?.btc_dominance} />
        </div>

        {/* Macro cards */}
        <div style={{ display: 'flex', gap: 'clamp(8px, 0.6vw, 12px)', marginBottom: 'clamp(12px, 0.9vw, 18px)', flexWrap: 'wrap' }}>
          {loading && macro.length === 0
            ? [0,1,2,3].map(i => <div key={i} style={{ flex: 1, minWidth: 160, height: 120, background: 'var(--card)', borderRadius: 14, animation: 'mktPulse 1.4s ease infinite' }} />)
            : macro.map(a => <MacroCard key={a.symbol} asset={a} onSelect={setSelected} />)
          }
        </div>

        {/* Screener */}
        <div style={{ background: 'var(--card)', border: '1px solid #1a1a30', borderRadius: 14, overflow: 'hidden' }}>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px 200px 1fr 90px 72px 72px 110px 100px 88px', alignItems: 'center', gap: 0, padding: '10px 16px', borderBottom: '1px solid #111128', background: 'var(--bg2)' }}>
            <div style={{ fontSize: 10, color: 'var(--muted4)', textAlign: 'right', paddingRight: 12 }}>#</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asset</div>
            <div />
            {[['price','Price'],['pct24h','24h %'],['pct7d','7d %'],['mcap','Mkt Cap'],['vol','Volume']].map(([key, label]) => (
              <button key={key} className="mkt-sort-btn" onClick={() => toggleSort(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 700, color: sortKey === key ? 'var(--text)' : 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                {label}{sortKey === key && <span style={{ fontSize: 8 }}>{sortAsc ? '▲' : '▼'}</span>}
              </button>
            ))}
            <div style={{ fontSize: 10, color: 'var(--muted4)', textAlign: 'right', paddingLeft: 8 }}>7d</div>
          </div>

          {/* Rows */}
          <div>
            {loading && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted5)', fontSize: 13 }}>Loading market data...</div>}
            {!loading && sorted.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted5)', fontSize: 13 }}>Could not fetch market data. CoinGecko may be rate-limiting — retry in 60s.</div>}
            {!loading && sorted.map((coin, i) => <CoinRow key={coin.id} coin={coin} index={i} onSelect={setSelected} />)}
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--muted4)', textAlign: 'right' }}>
          Crypto via CoinGecko · Macro via Finnhub · LabLogic
        </div>
      </div>
    </div>
  );
}
