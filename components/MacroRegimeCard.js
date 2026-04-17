'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Gauge } from './Gauge';
import { streamAI } from '@/lib/utils';

// ── Score computation: 0 = extreme risk-off, 100 = extreme risk-on ──────────
function computeScore(ind) {
  if (!ind?.spy || !ind?.vix || !ind?.dxy) return null;
  let score = 50; // neutral baseline

  // Equities direction (±15)
  const spyChg = ind.spy.changePct ?? 0;
  score += Math.max(-15, Math.min(15, spyChg * 10));

  // VIX level (±20): low VIX = risk-on, high VIX = risk-off
  const vixPrice = ind.vix.price ?? 20;
  if (vixPrice < 15)      score += 18;
  else if (vixPrice < 20) score += 10;
  else if (vixPrice < 25) score += 2;
  else if (vixPrice < 30) score -= 8;
  else if (vixPrice < 40) score -= 15;
  else                     score -= 20;

  // Dollar direction (±12): weak dollar = risk-on for crypto
  const dxyChg = ind.dxy.changePct ?? 0;
  score -= Math.max(-12, Math.min(12, dxyChg * 15));

  // Bonds/yields (±8): TLT up = yields falling = easier conditions
  const bondChg = ind.bonds?.changePct ?? 0;
  score += Math.max(-8, Math.min(8, bondChg * 8));

  // BTC momentum (±10)
  const btcChg = ind.btc?.chg24h ?? 0;
  score += Math.max(-10, Math.min(10, btcChg * 3));

  // Funding rate (±5): extreme positive = overheated longs (contrarian bearish)
  const funding = ind.funding?.avgRate ?? 0;
  if (funding > 0.0005)       score -= 5;
  else if (funding > 0.0002)  score -= 2;
  else if (funding < -0.0005) score += 5;
  else if (funding < -0.0002) score += 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Regime label from score ─────────────────────────────────────────────────
function regimePill(score) {
  if (score == null) return { label: 'Loading...', bg: 'transparent', border: 'var(--border)', color: 'var(--muted)' };
  if (score <= 15) return { label: 'Crisis',         bg: 'rgba(127,29,29,0.55)',  border: 'rgba(239,68,68,0.45)',  color: '#ef4444' };
  if (score <= 30) return { label: 'Risk-Off',       bg: 'rgba(120,20,20,0.40)',  border: 'rgba(239,68,68,0.30)',  color: '#f87171' };
  if (score <= 42) return { label: 'Cautious',       bg: 'rgba(120,50,0,0.40)',   border: 'rgba(249,115,22,0.35)', color: '#f97316' };
  if (score <= 58) return { label: 'Neutral',        bg: 'rgba(30,30,55,0.55)',   border: 'rgba(107,114,128,0.30)',color: '#9ca3af' };
  if (score <= 70) return { label: 'Risk-On',        bg: 'rgba(10,55,30,0.45)',   border: 'rgba(34,197,94,0.30)',  color: '#86efac' };
  if (score <= 85) return { label: 'Bullish',        bg: 'rgba(10,70,30,0.45)',   border: 'rgba(74,222,128,0.40)', color: '#4ade80' };
  return                   { label: 'Euphoria',      bg: 'rgba(5,90,30,0.50)',    border: 'rgba(74,222,128,0.55)', color: '#4ade80' };
}

// ── Gauge label from score ──────────────────────────────────────────────────
function gaugeLabel(score) {
  if (score == null) return 'Loading';
  if (score <= 15) return 'Crisis';
  if (score <= 30) return 'Risk-Off';
  if (score <= 42) return 'Cautious';
  if (score <= 58) return 'Neutral';
  if (score <= 70) return 'Risk-On';
  if (score <= 85) return 'Bullish';
  return 'Euphoria';
}

// ── Format helpers ──────────────────────────────────────────────────────────
const fmtPct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// ── Compute driver descriptions ─────────────────────────────────────────────
function getDrivers(ind) {
  if (!ind) return [];

  // 1. Dollar (25%)
  const dxyChg = ind.dxy?.changePct ?? 0;
  let d1name, d1desc, d1color;
  if (dxyChg > 0.3)       { d1name = 'Dollar Strengthening'; d1desc = `UUP ${fmtPct(dxyChg)} — tightening liquidity, headwind for crypto`;  d1color = '#ef4444'; }
  else if (dxyChg > 0.05) { d1name = 'Dollar Firming';       d1desc = `UUP ${fmtPct(dxyChg)} — mild headwind for risk assets`;              d1color = '#f97316'; }
  else if (dxyChg < -0.3) { d1name = 'Dollar Weakening';     d1desc = `UUP ${fmtPct(dxyChg)} — expanding liquidity, tailwind for crypto`;   d1color = '#4ade80'; }
  else if (dxyChg < -0.05){ d1name = 'Dollar Easing';        d1desc = `UUP ${fmtPct(dxyChg)} — mild tailwind for risk assets`;              d1color = '#86efac'; }
  else                     { d1name = 'Dollar Flat';          d1desc = `UUP ${fmtPct(dxyChg)} — no major currency pressure`;                 d1color = '#9ca3af'; }

  // 2. Volatility (25%)
  const vixP = ind.vix?.price ?? 20;
  let d2name, d2desc, d2color;
  if (vixP > 35)      { d2name = 'Extreme Fear';      d2desc = `VIX at ${vixP.toFixed(1)} — panic-level hedging activity`;     d2color = '#ef4444'; }
  else if (vixP > 25) { d2name = 'Elevated Fear';     d2desc = `VIX at ${vixP.toFixed(1)} — traders hedging aggressively`;     d2color = '#f97316'; }
  else if (vixP > 18) { d2name = 'Normal Conditions';  d2desc = `VIX at ${vixP.toFixed(1)} — standard market uncertainty`;     d2color = '#9ca3af'; }
  else                 { d2name = 'Low Volatility';    d2desc = `VIX at ${vixP.toFixed(1)} — markets calm, complacency risk`;  d2color = '#4ade80'; }

  // 3. Equities (25%)
  const spyChg = ind.spy?.changePct ?? 0;
  let d3name, d3desc, d3color;
  if (spyChg > 1)       { d3name = 'Strong Risk-On';   d3desc = `SPY ${fmtPct(spyChg)} — equities rallying, appetite for risk`;  d3color = '#4ade80'; }
  else if (spyChg > 0.2){ d3name = 'Equities Positive'; d3desc = `SPY ${fmtPct(spyChg)} — mild risk appetite`;                   d3color = '#86efac'; }
  else if (spyChg < -1) { d3name = 'Equities Selling';  d3desc = `SPY ${fmtPct(spyChg)} — risk aversion accelerating`;           d3color = '#ef4444'; }
  else if (spyChg < -0.2){d3name = 'Equities Soft';     d3desc = `SPY ${fmtPct(spyChg)} — mild risk aversion`;                   d3color = '#f97316'; }
  else                    { d3name = 'Equities Flat';    d3desc = `SPY ${fmtPct(spyChg)} — no clear direction from equities`;     d3color = '#9ca3af'; }

  // 4. Bonds/Yields (25%)
  const bondChg = ind.bonds?.changePct ?? 0;
  let d4name, d4desc, d4color;
  if (bondChg > 0.4)       { d4name = 'Yields Falling Fast'; d4desc = `TLT ${fmtPct(bondChg)} — rate cut expectations, easing`;  d4color = '#4ade80'; }
  else if (bondChg > 0.1)  { d4name = 'Yields Easing';       d4desc = `TLT ${fmtPct(bondChg)} — bonds bid, slightly easier`;     d4color = '#86efac'; }
  else if (bondChg < -0.4) { d4name = 'Yields Surging';      d4desc = `TLT ${fmtPct(bondChg)} — bond selloff, tightening`;       d4color = '#ef4444'; }
  else if (bondChg < -0.1) { d4name = 'Yields Rising';       d4desc = `TLT ${fmtPct(bondChg)} — mild tightening pressure`;       d4color = '#f97316'; }
  else                      { d4name = 'Yields Stable';       d4desc = `TLT ${fmtPct(bondChg)} — no major yield pressure`;        d4color = '#9ca3af'; }

  return [
    { name: d1name, weight: 25, desc: d1desc, color: d1color },
    { name: d2name, weight: 25, desc: d2desc, color: d2color },
    { name: d3name, weight: 25, desc: d3desc, color: d3color },
    { name: d4name, weight: 25, desc: d4desc, color: d4color },
  ];
}

// ── Main card ───────────────────────────────────────────────────────────────
export default function MacroRegimeCard() {
  const [indicators, setIndicators] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [aiText, setAiText]         = useState('');
  const [aiState, setAiState]       = useState('idle');
  const aiGenRef = useRef(0);
  const aiQueue  = useRef([]);
  const aiTimer  = useRef(null);

  const drainRef = useRef(null);
  drainRef.current = (genId) => {
    if (genId !== aiGenRef.current) return;
    if (aiQueue.current.length === 0) { aiTimer.current = null; return; }
    const char = aiQueue.current.shift();
    setAiText(prev => prev + char);
    aiTimer.current = setTimeout(() => drainRef.current(genId), 20);
  };

  // Fetch indicators
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/macro-regime', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setIndicators(d.indicators);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 5 * 60 * 1000); return () => clearInterval(id); }, [load]);

  // AI narration
  useEffect(() => {
    if (!indicators?.spy) return;
    const id = ++aiGenRef.current;
    aiQueue.current = [];
    setAiText('');
    setAiState('loading');
    if (aiTimer.current) { clearTimeout(aiTimer.current); aiTimer.current = null; }

    const ind = indicators;
    const score = computeScore(ind);

    streamAI(
      {
        system: 'Reply with a 3-5 word headline only. Example: "Dollar weakness fuelling rally." or "Risk-off regime intensifying." End with period.',
        messages: [{ role: 'user', content: `Macro regime score: ${score}/100 (${gaugeLabel(score)}). Dollar ${fmtPct(ind.dxy?.changePct)}, VIX ${ind.vix?.price?.toFixed(1)}, SPY ${fmtPct(ind.spy?.changePct)}, TLT ${fmtPct(ind.bonds?.changePct)}, BTC ${fmtPct(ind.btc?.chg24h)}. What is the macro headline?` }],
        max_tokens: 60,
      },
      (chunk) => {
        if (id !== aiGenRef.current) return;
        for (const char of chunk) aiQueue.current.push(char);
        if (!aiTimer.current) drainRef.current(id);
        setAiState(s => s === 'loading' ? 'streaming' : s);
      },
      () => { if (id === aiGenRef.current) setAiState('done'); },
      () => { if (id === aiGenRef.current) setAiState('error'); },
    );
  }, [indicators]);

  useEffect(() => {
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current); };
  }, []);

  const score   = computeScore(indicators);
  const regime  = regimePill(score);
  const label   = gaugeLabel(score);
  const drivers = getDrivers(indicators);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="fb" style={{ marginBottom: 8, flexShrink: 0 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Macro Regime</div>
        <div style={{
          padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap',
          background: regime.bg, border: `1px solid ${regime.border}`,
          color: regime.color, fontSize: 'var(--fs-xs)', fontWeight: 700,
        }}>{regime.label}</div>
      </div>

      {/* AI narrative */}
      <div className="ai-oneliner" style={{ fontSize: 'var(--fs-base)', color: 'var(--muted3)', lineHeight: 1.55, marginBottom: 10, flexShrink: 0 }}>
        {aiState === 'loading' && (
          <div className="ai-loading" style={{ paddingTop: 0 }}>
            <div className="ai-loading-dot" /><div className="ai-loading-dot" /><div className="ai-loading-dot" />
            <span style={{ color: 'var(--muted3)' }}>Analysing macro environment...</span>
          </div>
        )}
        {(aiState === 'streaming' || aiState === 'done') && aiText.length > 0 && <span>{aiText}</span>}
        {(aiState === 'idle' || aiState === 'error') && score != null && (
          <span>{regime.label} conditions — {drivers[0]?.name.toLowerCase()} and {drivers[2]?.name.toLowerCase()} driving regime.</span>
        )}
      </div>

      {/* Body: Gauge left, Key Drivers right */}
      <div className="regime-body" style={{ flex: 1, minHeight: 0 }}>

        {/* Gauge */}
        <div className="regime-gauge" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Gauge value={score ?? 50} label={label} size={170} pillColor={regime.color} />
        </div>

        {/* Key Drivers */}
        <div className="regime-drivers">
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1, flexShrink: 0 }}>
            Key Drivers
          </div>
          {drivers.map((d, i) => (
            <div key={i} style={{
              flex: 1, minHeight: 0,
              background: 'var(--glass)',
              border: '1px solid var(--glass2)',
              borderRadius: 8,
              padding: '6px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>{d.name}</span>
                <span style={{
                  fontSize: 'var(--fs-xs)', fontWeight: 700, flexShrink: 0,
                  padding: '1px 7px', borderRadius: 20,
                  background: `${d.color}1a`, border: `1px solid ${d.color}44`,
                  color: d.color,
                }}>{d.weight}%</span>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', lineHeight: 1.35 }}>{d.desc}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
