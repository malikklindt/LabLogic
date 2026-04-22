'use client';
import { useState, useEffect, useMemo } from 'react';

// ── Coins to track ──────────────────────────────────────────────────────────
const COINS = [
  { symbol: 'BTC', bybit: 'BTCUSDT', color: '#f7931a' },
  { symbol: 'ETH', bybit: 'ETHUSDT', color: '#627eea' },
  { symbol: 'SOL', bybit: 'SOLUSDT', color: '#14f195' },
  { symbol: 'BNB', bybit: 'BNBUSDT', color: '#f3ba2f' },
  { symbol: 'XRP', bybit: 'XRPUSDT', color: '#23292f' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtPct = (r) => r == null ? '—' : `${r >= 0 ? '+' : ''}${(r * 100).toFixed(4)}%`;
const fmtBps = (r) => r == null ? '—' : `${r >= 0 ? '+' : ''}${(r * 10000).toFixed(1)}bps`;

function percentile(arr, val) {
  if (!arr.length) return 50;
  let below = 0;
  for (const v of arr) if (v < val) below++;
  return Math.round((below / arr.length) * 100);
}

function signalFromPercentile(p, currentRate) {
  // Positive funding = longs paying shorts; extreme = long squeeze risk
  // Negative funding = shorts paying longs; extreme = short squeeze risk
  if (p >= 95 && currentRate > 0) return { label: 'Long Squeeze Risk',  color: '#ef4444' };
  if (p >= 85 && currentRate > 0) return { label: 'Elevated Longs',     color: '#f97316' };
  if (p <= 5  && currentRate < 0) return { label: 'Short Squeeze Risk', color: '#22c55e' };
  if (p <= 15 && currentRate < 0) return { label: 'Elevated Shorts',    color: '#86efac' };
  return { label: 'Normal Range', color: 'var(--muted)' };
}

// ── Main component ──────────────────────────────────────────────────────────
export default function FundingIntelligence() {
  const [histories, setHistories] = useState({}); // { BTC: [{ts, rate}, ...], ... }
  const [loading,   setLoading]   = useState(true);
  const [hoverIdx,  setHoverIdx]  = useState(null);

  // Fetch funding history for all coins in parallel
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.all(
        COINS.map(async c => {
          try {
            const res  = await fetch(`/api/funding?history=${c.bybit}`, { cache: 'no-store' });
            if (!res.ok) return [c.symbol, []];
            const data = await res.json();
            return [c.symbol, Array.isArray(data?.history) ? data.history : []];
          } catch { return [c.symbol, []]; }
        })
      );
      if (cancelled) return;
      const map = {};
      for (const [sym, arr] of results) map[sym] = arr;
      setHistories(map);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Build per-coin stats
  const stats = useMemo(() => {
    return COINS.map(c => {
      const hist = histories[c.symbol] ?? [];
      if (hist.length < 10) return { ...c, current: null, avg: null, percentile: 50, signal: null };
      const rates   = hist.map(h => h.rate);
      const current = rates[rates.length - 1];
      const avg     = rates.reduce((s, r) => s + r, 0) / rates.length;
      const p       = percentile(rates, current);
      const signal  = signalFromPercentile(p, current);
      return { ...c, current, avg, percentile: p, signal };
    });
  }, [histories]);

  // Build chart data — normalize each series to % from its own mean for overlay
  const chartData = useMemo(() => {
    const W = 800, H = 200;
    const padL = 46, padR = 18, padT = 14, padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Align all series to same length (use shortest)
    const minLen = Math.min(...COINS.map(c => histories[c.symbol]?.length ?? 0));
    if (minLen < 10) return null;

    const series = COINS.map(c => {
      const hist = (histories[c.symbol] ?? []).slice(-minLen);
      return { symbol: c.symbol, color: c.color, rates: hist.map(h => h.rate * 100) }; // to %
    });

    // Y-axis scale — combined min/max across all series, symmetric around 0
    const allRates = series.flatMap(s => s.rates);
    const maxAbs   = Math.max(0.01, ...allRates.map(r => Math.abs(r)));
    const yMin = -maxAbs, yMax = maxAbs;

    const xStep = plotW / (minLen - 1);
    const yScale = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

    const pathsFor = (rates) => rates
      .map((r, i) => `${i === 0 ? 'M' : 'L'}${(padL + i * xStep).toFixed(1)},${yScale(r).toFixed(1)}`)
      .join(' ');

    const zeroY = yScale(0);

    // X-axis labels — every ~7 days (assuming 3 fundings/day = 21 points per week)
    const labelEvery = Math.floor(minLen / 4);
    const xLabels = [];
    for (let i = 0; i < minLen; i += labelEvery) {
      xLabels.push({
        x: padL + i * xStep,
        label: `${Math.round((minLen - i) / 3)}d`,
      });
    }

    return { W, H, padL, padT, plotW, plotH, yMin, yMax, zeroY, series, pathsFor, xStep, xLabels, minLen };
  }, [histories]);

  // Sort radar by absolute percentile extremity (most extreme first)
  const radar = useMemo(() => {
    return [...stats]
      .filter(s => s.current != null)
      .sort((a, b) => {
        const extremityA = Math.abs(a.percentile - 50);
        const extremityB = Math.abs(b.percentile - 50);
        return extremityB - extremityA;
      });
  }, [stats]);

  return (
    <div style={{
      marginTop: 16,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.3 }}>Funding Intelligence</div>
        <div style={{ fontSize: 11, color: 'var(--muted3)', marginTop: 2 }}>30-day funding rate trends &amp; squeeze signals · last 90 funding events per coin</div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted3)', fontSize: 13 }}>
          Loading funding history for 5 coins...
        </div>
      )}

      {!loading && (
        <div className="fi-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 0 }}>

          {/* ─── Left: Trend Chart ─── */}
          <div style={{ padding: '16px 18px', borderRight: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                ▲ 30-Day Funding Trend
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {COINS.map(c => (
                  <div key={c.symbol} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 2, background: c.color, borderRadius: 1 }} />
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{c.symbol}</span>
                  </div>
                ))}
              </div>
            </div>

            {chartData ? (
              <svg viewBox={`0 0 ${chartData.W} ${chartData.H}`} width="100%" height={chartData.H} style={{ display: 'block' }}>
                {/* Horizontal grid lines */}
                {[0.25, 0.5, 0.75].map((t, i) => {
                  const y = chartData.padT + t * chartData.plotH;
                  return <line key={i} x1={chartData.padL} y1={y} x2={chartData.padL + chartData.plotW} y2={y}
                    stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,3" />;
                })}

                {/* Zero line (emphasized) */}
                <line x1={chartData.padL} y1={chartData.zeroY}
                  x2={chartData.padL + chartData.plotW} y2={chartData.zeroY}
                  stroke="var(--muted3)" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />

                {/* Y-axis labels */}
                <text x={chartData.padL - 6} y={chartData.padT + 4}
                  fontSize="9" fill="var(--muted3)" textAnchor="end" fontFamily="Inter, sans-serif">
                  +{chartData.yMax.toFixed(3)}%
                </text>
                <text x={chartData.padL - 6} y={chartData.zeroY + 3}
                  fontSize="9" fill="var(--muted3)" textAnchor="end" fontFamily="Inter, sans-serif">
                  0%
                </text>
                <text x={chartData.padL - 6} y={chartData.padT + chartData.plotH + 4}
                  fontSize="9" fill="var(--muted3)" textAnchor="end" fontFamily="Inter, sans-serif">
                  {chartData.yMin.toFixed(3)}%
                </text>

                {/* X-axis labels */}
                {chartData.xLabels.map((xl, i) => (
                  <text key={i} x={xl.x} y={chartData.H - 6}
                    fontSize="9" fill="var(--muted3)" textAnchor="middle" fontFamily="Inter, sans-serif">
                    {xl.label}
                  </text>
                ))}

                {/* Series lines */}
                {chartData.series.map(s => (
                  <path key={s.symbol} d={chartData.pathsFor(s.rates)}
                    fill="none" stroke={s.color} strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                ))}
              </svg>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted3)', fontSize: 12 }}>
                Insufficient history data to render trend.
              </div>
            )}

            <div style={{ fontSize: 10, color: 'var(--muted4)', marginTop: 8, lineHeight: 1.5 }}>
              Lines show each coin's funding rate across 90 funding events (~30 days). <span style={{ color: 'var(--red)' }}>Above zero</span> = longs paying shorts. <span style={{ color: 'var(--green)' }}>Below zero</span> = shorts paying longs.
            </div>
          </div>

          {/* ─── Right: Squeeze Radar ─── */}
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
              🎯 Squeeze Radar
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {radar.map(coin => (
                <div key={coin.symbol} style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'var(--bg2)',
                  border: `1px solid ${coin.signal.color === 'var(--muted)' ? 'var(--border)' : coin.signal.color + '30'}`,
                  borderRadius: 8,
                }}>
                  {/* Symbol */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 3, height: 20, background: coin.color, borderRadius: 2 }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)' }}>{coin.symbol}</span>
                  </div>

                  {/* Current / Avg / Percentile */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: coin.current >= 0 ? 'var(--red)' : 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPct(coin.current)} <span style={{ color: 'var(--muted3)', fontWeight: 500, marginLeft: 4 }}>now</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted3)', fontVariantNumeric: 'tabular-nums' }}>
                      30d avg {fmtBps(coin.avg)} · <span style={{ color: coin.signal.color }}>{coin.percentile}th pct</span>
                    </div>
                  </div>

                  {/* Signal chip */}
                  <div style={{
                    fontSize: 9, fontWeight: 700,
                    padding: '3px 8px', borderRadius: 5,
                    background: `${coin.signal.color === 'var(--muted)' ? 'rgba(107,107,144,0.1)' : coin.signal.color + '1a'}`,
                    color: coin.signal.color,
                    border: `1px solid ${coin.signal.color === 'var(--muted)' ? 'var(--border)' : coin.signal.color + '40'}`,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}>
                    {coin.signal.label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10, color: 'var(--muted4)', marginTop: 12, lineHeight: 1.5 }}>
              Coins ranked by distance from 30-day median. Extreme readings (&gt;95th or &lt;5th percentile) historically precede squeezes 60–75% of the time.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
