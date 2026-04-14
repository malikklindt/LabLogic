'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from './DataProvider';
import LineChart from './LineChart';
import { streamAI } from '@/lib/utils';
import { VOL_IV_CUR, VOL_RV_CUR, VOL_DATA } from '@/lib/mockData';

const IV_INFO = 'Implied Volatility (IV) is how much the market expects Bitcoin to move in the future. Think of it like a weather forecast — a high IV means traders are expecting a big storm (large price swing), either up or down. It does not tell you which direction, just how wild the ride might be.';
const RV_INFO = 'Realized Volatility (RV) is how much Bitcoin has actually moved recently. Unlike Implied Volatility which is a prediction, this is the real historical record. A low RV means Bitcoin has been relatively calm. When IV is much higher than RV, it means the market is bracing for a bigger move than what we have seen lately.';

export default function VolatilityCard() {
  // Both IV and RV come from DataProvider (sourced from /api/volatility server-side)
  const { volHistory, ivCur, rvCur } = useData();

  const ivDisplay = ivCur ?? VOL_IV_CUR;
  const rvDisplay = rvCur ?? VOL_RV_CUR;

  // ── AI streaming ─────────────────────────────────────────────────────────────
  const [tf,       setTf]       = useState('1M');
  const [volText,  setVolText]  = useState('');
  const [volState, setVolState] = useState('idle');
  const [openTip,  setOpenTip]  = useState(null);
  const volQueue = useRef([]);
  const volTimer = useRef(null);
  const volGen   = useRef(0);
  const ivTipRef = useRef(null);
  const rvTipRef = useRef(null);
  const ivRef    = useRef(ivDisplay);
  const rvRef    = useRef(rvDisplay);

  useEffect(() => { ivRef.current = ivDisplay; rvRef.current = rvDisplay; }, [ivDisplay, rvDisplay]);

  const drainRef = useRef(null);
  drainRef.current = (genId) => {
    if (genId !== volGen.current) return;
    if (volQueue.current.length === 0) { volTimer.current = null; return; }
    const char = volQueue.current.shift();
    setVolText(prev => prev + char);
    volTimer.current = setTimeout(() => drainRef.current(genId), 20);
  };

  const loadVolAI = useCallback((timeframe) => {
    if (volTimer.current) { clearTimeout(volTimer.current); volTimer.current = null; }
    const genId = ++volGen.current;
    volQueue.current = [];
    setVolText('');
    setVolState('loading');
    const tfLabel = timeframe === '1W' ? '1 week' : timeframe === '1M' ? '1 month' : '3 months';
    streamAI(
      {
        system: 'Reply with a 3-5 word headline only. Example: "Options pricing elevated risk." or "Calm before potential move." End with period.',
        messages: [{ role: 'user', content: `Bitcoin implied volatility is ${ivRef.current}% and realized volatility is ${rvRef.current}% over ${tfLabel}. What does this mean?` }],
        max_tokens: 60,
      },
      (chunk) => {
        if (genId !== volGen.current) return;
        for (const char of chunk) volQueue.current.push(char);
        if (!volTimer.current) drainRef.current(genId);
        setVolState(s => s === 'loading' ? 'streaming' : s);
      },
      () => { if (genId === volGen.current) setVolState('done'); },
      () => { if (genId === volGen.current) setVolState('error'); },
    );
  }, []);

  // Fire AI once — only after live IV and RV are available
  const volAIFiredWithLive = useRef(false);
  useEffect(() => {
    if (ivCur !== null && rvCur !== null && !volAIFiredWithLive.current) {
      volAIFiredWithLive.current = true;
      loadVolAI(tf);
    }
  }, [ivCur, rvCur]);
  useEffect(() => {
    return () => { if (volTimer.current) clearTimeout(volTimer.current); };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((!ivTipRef.current || !ivTipRef.current.contains(e.target)) &&
          (!rvTipRef.current || !rvTipRef.current.contains(e.target)))
        setOpenTip(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTfChange = (t) => { setTf(t); loadVolAI(t); };
  const cd = (volHistory && volHistory[tf]) ? volHistory[tf] : VOL_DATA[tf];

  const ivColor    = ivDisplay < 50 ? '#4ade80' : '#ef4444';
  const ivSubtitle = ivDisplay < 50 ? 'Low · Markets are calm, low expectation of big moves'
    : ivDisplay <= 80 ? 'Elevated · Markets are bracing for a significant move'
    : 'Extreme · A major price swing is expected imminently';
  const rvColor    = rvDisplay < 60 ? '#4ade80' : '#ef4444';
  const rvSubtitle = rvDisplay < 60 ? 'Moderate · Bitcoin has been relatively stable recently'
    : rvDisplay <= 80 ? 'High · Bitcoin has been making significant moves lately'
    : 'Extreme · Bitcoin is in a period of intense price action';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="fb" style={{ marginBottom: 8, flexShrink: 0 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Bitcoin Volatility</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {['1W','1M','3M'].map(t => (
            <button key={t} onClick={() => handleTfChange(t)} style={{
              fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              cursor: 'pointer', background: 'transparent', fontFamily: 'Inter, sans-serif',
              color: tf === t ? '#ffffff' : 'var(--muted3)',
              border: tf === t ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.07)',
              transition: 'all 150ms ease',
            }}>{t}</button>
          ))}
        </div>
      </div>
      <div className="ai-oneliner" style={{ fontSize: 'var(--fs-base)', color: 'var(--muted3)', lineHeight: 1.55, marginBottom: 10, flexShrink: 0 }}>
        {volState === 'loading' && (
          <div className="ai-loading" style={{ paddingTop: 0 }}>
            <div className="ai-loading-dot" /><div className="ai-loading-dot" /><div className="ai-loading-dot" />
            <span>Analyzing volatility conditions...</span>
          </div>
        )}
        {(volState === 'streaming' || volState === 'done') && volText.length > 0 && <span>{volText}</span>}
      </div>
      <div className="vol-wrap" style={{ flex: 1, minHeight: 0 }}>
        <div ref={ivTipRef} className="vol-box">
          <button className="vol-info-btn" style={{ color: openTip === 'iv' ? '#ffffff' : 'var(--muted3)' }}
            onClick={e => { e.stopPropagation(); setOpenTip(o => o === 'iv' ? null : 'iv'); }}>i</button>
          {openTip === 'iv' && (
            <div className="vol-tooltip" style={{ animation: 'tabFadeUp 200ms ease-out both' }}>{IV_INFO}</div>
          )}
          <div className="vol-lbl">Implied Volatility</div>
          <div className="vol-val" style={{ color: ivColor }}>{ivDisplay}%</div>
          <div className="vol-sub">{ivSubtitle}</div>
          <div className="vol-range">12M range: 35% – 95%</div>
          <div style={{ marginTop: 10, flex: 1, minHeight: 0 }}>
            <LineChart key={`iv-${tf}-${ivDisplay}`} data={cd.iv} color={ivColor} height="100%" fill={true} />
          </div>
        </div>
        <div ref={rvTipRef} className="vol-box">
          <button className="vol-info-btn" style={{ color: openTip === 'rv' ? '#ffffff' : 'var(--muted3)' }}
            onClick={e => { e.stopPropagation(); setOpenTip(o => o === 'rv' ? null : 'rv'); }}>i</button>
          {openTip === 'rv' && (
            <div className="vol-tooltip" style={{ animation: 'tabFadeUp 200ms ease-out both' }}>{RV_INFO}</div>
          )}
          <div className="vol-lbl">Realized Volatility</div>
          <div className="vol-val" style={{ color: rvColor }}>{rvDisplay}%</div>
          <div className="vol-sub">{rvSubtitle}</div>
          <div className="vol-range">12M range: 20% – 75%</div>
          <div style={{ marginTop: 10, flex: 1, minHeight: 0 }}>
            <LineChart key={`rv-${tf}-${rvDisplay}`} data={cd.rv} color={rvColor} height="100%" fill={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
