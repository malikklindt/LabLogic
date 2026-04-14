'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from './DataProvider';
import { Gauge } from './Gauge';
import { streamAI } from '@/lib/utils';

function regimePill(score) {
  if (score <= 20) return { label: 'Panic Selling', bg: 'rgba(127,29,29,0.55)',  border: 'rgba(239,68,68,0.45)',  color: 'var(--red)' };
  if (score <= 32) return { label: 'Risk-Off',      bg: 'rgba(120,20,20,0.40)',  border: 'rgba(239,68,68,0.30)',  color: '#f87171' };
  if (score <= 45) return { label: 'Bearish',       bg: 'rgba(120,50,0,0.40)',   border: 'rgba(249,115,22,0.35)', color: 'var(--orange)' };
  if (score <= 54) return { label: 'Neutral',       bg: 'rgba(30,30,55,0.55)',   border: 'rgba(107,114,128,0.30)',color: '#9ca3af' };
  if (score <= 65) return { label: 'Risk-On',       bg: 'rgba(10,55,30,0.45)',   border: 'rgba(34,197,94,0.30)',  color: 'var(--green-light)' };
  if (score <= 80) return { label: 'Bullish',       bg: 'rgba(10,70,30,0.45)',   border: 'rgba(74,222,128,0.40)', color: '#4ade80' };
  return                  { label: 'Euphoria',      bg: 'rgba(5,90,30,0.50)',    border: 'rgba(74,222,128,0.55)', color: '#4ade80' };
}

export default function SentimentCard() {
  const { sentiment, newsSentiment, btcDomChg, prices, ivCur } = useData();
  const sentVal   = sentiment?.value    ?? 50;
  const sentLabel = sentiment?.label    ?? 'Neutral';
  const sentColor = sentiment?.pillColor ?? '#6b7280';

  // ── AI streaming ──────────────────────────────────────────────────────────
  const [sentText,  setSentText]  = useState('');
  const [sentState, setSentState] = useState('idle');
  const sentQueue = useRef([]);
  const sentTimer = useRef(null);
  const sentGen   = useRef(0);
  const lastFiredScore = useRef(null);

  const drainRef = useRef(null);
  drainRef.current = (genId) => {
    if (genId !== sentGen.current) return;
    if (sentQueue.current.length === 0) { sentTimer.current = null; return; }
    const char = sentQueue.current.shift();
    setSentText(prev => prev + char);
    sentTimer.current = setTimeout(() => drainRef.current(genId), 20);
  };

  const loadSentAI = useCallback((score, label, context) => {
    if (sentTimer.current) { clearTimeout(sentTimer.current); sentTimer.current = null; }
    const genId = ++sentGen.current;
    sentQueue.current = [];
    setSentText('');
    setSentState('loading');
    streamAI(
      {
        system: 'Reply with a 3-5 word headline only. Example: "Fed hawkishness weighing." or "Risk appetite returning." End with period.',
        messages: [{ role: 'user', content: `Sentiment: ${score}/100 — ${label}. Live data: BTC ${context.btc7d != null ? context.btc7d.toFixed(1)+'% 7D' : 'N/A'}, news ${context.bull}/${context.total} bullish, IV ${context.iv != null ? context.iv+'%' : 'N/A'}, BTC dominance ${context.domChg > 0 ? '+' : ''}${context.domChg.toFixed(2)}% change. What is the primary driver right now?` }],
        max_tokens: 60,
      },
      (chunk) => {
        if (genId !== sentGen.current) return;
        for (const char of chunk) sentQueue.current.push(char);
        if (!sentTimer.current) drainRef.current(genId);
        setSentState(s => s === 'loading' ? 'streaming' : s);
      },
      () => { if (genId === sentGen.current) setSentState('done'); },
      () => { if (genId === sentGen.current) setSentState('error'); },
    );
  }, []);

  // Re-fire whenever any of the 4 underlying inputs change meaningfully,
  // not just when the rounded composite score happens to tick over.
  const btc7dRaw  = prices['BTC/USD']?.chg7d ?? null;
  const ivRaw     = ivCur;
  const bullRaw   = newsSentiment?.bullish ?? 0;
  const totalRaw  = newsSentiment?.total   ?? 0;
  const domChgRaw = btcDomChg ?? 0;

  // Fingerprint: rounds each factor to the precision at which it meaningfully changes
  const fingerprint = [
    btc7dRaw  != null ? Math.round(btc7dRaw)        : 'x',  // 1% BTC move
    `${bullRaw}/${totalRaw}`,                                 // any headline change
    ivRaw     != null ? Math.round(ivRaw / 3) * 3   : 'x',  // 3pt IV move
    Math.round(domChgRaw * 5) / 5,                           // 0.2% dominance shift
  ].join('|');

  const lastFingerprint = useRef(null);
  useEffect(() => {
    if (fingerprint === lastFingerprint.current) return;
    lastFingerprint.current = fingerprint;
    loadSentAI(sentVal, sentLabel, {
      btc7d: btc7dRaw, bull: bullRaw, total: totalRaw, iv: ivRaw, domChg: domChgRaw,
    });
  }, [fingerprint]);

  useEffect(() => {
    return () => { if (sentTimer.current) clearTimeout(sentTimer.current); };
  }, []);

  // ── Key Drivers (derived from the 4 composite score factors) ─────────────
  const btc7d  = btc7dRaw;
  const bull   = bullRaw;
  const bear   = newsSentiment?.bearish ?? 0;
  const total  = totalRaw;
  const domVal = prices['BTC.D']?.price  ?? null;
  const domChg = domChgRaw;
  const iv     = ivRaw;

  // Factor 1 — Price Momentum (35%)
  let f1name, f1desc, f1color;
  if (btc7d == null)     { f1name = 'Price Action';      f1desc = 'Awaiting price data';                                       f1color = '#6b7280'; }
  else if (btc7d > 10)   { f1name = 'Strong Rally';      f1desc = `+${btc7d.toFixed(1)}% this week — bulls firmly in control`; f1color = '#4ade80'; }
  else if (btc7d > 5)    { f1name = 'Bullish Momentum';  f1desc = `+${btc7d.toFixed(1)}% weekly — uptrend intact`;             f1color = 'var(--green)'; }
  else if (btc7d > 2)    { f1name = 'Mild Upside';       f1desc = `+${btc7d.toFixed(1)}% this week — cautious buying`;         f1color = '#86efac'; }
  else if (btc7d > 0)    { f1name = 'Flat Price Action'; f1desc = `+${btc7d.toFixed(1)}% this week — market indecisive`;       f1color = '#9ca3af'; }
  else if (btc7d > -2)   { f1name = 'Slight Weakness';   f1desc = `${btc7d.toFixed(1)}% dip this week — sellers emerging`;     f1color = 'var(--orange)'; }
  else if (btc7d > -5)   { f1name = 'Selling Pressure';  f1desc = `${btc7d.toFixed(1)}% decline — bears in control`;           f1color = 'var(--red)'; }
  else if (btc7d > -10)  { f1name = 'Heavy Selling';     f1desc = `${btc7d.toFixed(1)}% drop this week — panic building`;      f1color = '#dc2626'; }
  else                   { f1name = 'Capitulation';      f1desc = `${btc7d.toFixed(1)}% freefall — extreme fear dominating`;   f1color = '#b91c1c'; }

  // Factor 2 — News Sentiment (30%)
  let f2name, f2desc, f2color;
  if (!newsSentiment || total === 0) {
    f2name = 'News Flow'; f2desc = 'No headlines available'; f2color = '#6b7280';
  } else {
    const bullPct = bull / total;
    const bearPct = bear / total;
    if (bullPct >= 0.6)      { f2name = 'Bullish News Cycle'; f2desc = `${bull}/${total} headlines bullish — positive narrative dominant`; f2color = 'var(--green)'; }
    else if (bullPct >= 0.4) { f2name = 'Mixed Coverage';     f2desc = `Slight bullish lean across ${total} headlines`;                   f2color = '#86efac'; }
    else if (bearPct >= 0.6) { f2name = 'Bearish News Cycle'; f2desc = `${bear}/${total} headlines bearish — fear narrative dominant`;     f2color = 'var(--red)'; }
    else if (bearPct >= 0.4) { f2name = 'Negative Tone';      f2desc = `Bearish lean across ${total} headlines — caution rising`;         f2color = 'var(--orange)'; }
    else                     { f2name = 'Neutral Coverage';   f2desc = `No dominant narrative across ${total} headlines`;                 f2color = '#9ca3af'; }
  }

  // Factor 3 — Implied Volatility (20%)
  let f3name, f3desc, f3color;
  if (iv == null)   { f3name = 'Market Volatility';  f3desc = 'IV data unavailable';                                    f3color = '#6b7280'; }
  else if (iv < 30) { f3name = 'Calm Markets';       f3desc = `IV at ${iv}% — minimal fear priced in`;                  f3color = '#4ade80'; }
  else if (iv < 40) { f3name = 'Low Volatility';     f3desc = `IV at ${iv}% — markets relatively relaxed`;              f3color = 'var(--green)'; }
  else if (iv < 55) { f3name = 'Normal Conditions';  f3desc = `IV at ${iv}% — standard market uncertainty`;             f3color = '#86efac'; }
  else if (iv < 65) { f3name = 'Elevated Fear';      f3desc = `IV at ${iv}% — traders hedging aggressively`;            f3color = 'var(--orange)'; }
  else if (iv < 80) { f3name = 'Volatility Surge';   f3desc = `IV at ${iv}% — market pricing in a large move`;          f3color = 'var(--red)'; }
  else              { f3name = 'Extreme Volatility';  f3desc = `IV at ${iv}% — peak fear and uncertainty`;              f3color = '#dc2626'; }

  // Factor 4 — BTC Dominance (15%)
  let f4name, f4desc, f4color;
  if (domVal == null)     { f4name = 'BTC Dominance';      f4desc = 'Dominance data unavailable';                                      f4color = '#6b7280'; }
  else if (domChg > 1)    { f4name = 'Capital Inflow';     f4desc = `${domVal.toFixed(1)}% dominance — capital flooding into BTC`;      f4color = 'var(--green)'; }
  else if (domChg > 0.3)  { f4name = 'BTC Gaining Share';  f4desc = `${domVal.toFixed(1)}% dominance — alts losing ground`;            f4color = '#86efac'; }
  else if (domChg > -0.3) { f4name = 'Stable Dominance';   f4desc = `${domVal.toFixed(1)}% dominance — no major rotation`;             f4color = '#9ca3af'; }
  else if (domChg > -1)   { f4name = 'Alt Rotation';       f4desc = `${domVal.toFixed(1)}% dominance — capital shifting to alts`;      f4color = 'var(--orange)'; }
  else                    { f4name = 'Heavy Rotation Out';  f4desc = `${domVal.toFixed(1)}% dominance falling — mass flight from BTC`;  f4color = 'var(--red)'; }

  const drivers = [
    { name: f1name, weight: 35, desc: f1desc, color: f1color },
    { name: f2name, weight: 30, desc: f2desc, color: f2color },
    { name: f3name, weight: 20, desc: f3desc, color: f3color },
    { name: f4name, weight: 15, desc: f4desc, color: f4color },
  ];

  const regime = regimePill(sentVal);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="fb" style={{ marginBottom: 8, flexShrink: 0 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Market Sentiment Index</div>
        <div style={{
          padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap',
          background: regime.bg, border: `1px solid ${regime.border}`,
          color: regime.color, fontSize: 'var(--fs-xs)', fontWeight: 700,
        }}>{regime.label}</div>
      </div>

      {/* AI narrative */}
      <div className="ai-oneliner" style={{ fontSize: 'var(--fs-base)', color: 'var(--muted3)', lineHeight: 1.55, marginBottom: 10, flexShrink: 0 }}>
        {sentState === 'loading' && (
          <div className="ai-loading" style={{ paddingTop: 0 }}>
            <div className="ai-loading-dot" /><div className="ai-loading-dot" /><div className="ai-loading-dot" />
            <span style={{ color: 'var(--muted3)' }}>Analyzing market conditions...</span>
          </div>
        )}
        {(sentState === 'streaming' || sentState === 'done') && sentText.length > 0 && <span>{sentText}</span>}
        {(sentState === 'idle' || sentState === 'error') && (
          <span>{regime.label} sentiment ({sentVal}/100) driven by {drivers[0].name.toLowerCase()} and {drivers[1].name.toLowerCase()}.</span>
        )}
      </div>

      {/* Body: Gauge left, Key Drivers right */}
      <div style={{ display: 'flex', gap: 'var(--gap)', flex: 1, minHeight: 0 }}>

        {/* Gauge */}
        <div style={{ width: '42%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Gauge value={sentVal} label={sentLabel} size={170} pillColor={sentColor} />
        </div>

        {/* Key Drivers */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1, flexShrink: 0 }}>
            Key Drivers
          </div>
          {drivers.map((d, i) => (
            <div key={i} style={{
              flex: 1, minHeight: 0,
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
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
