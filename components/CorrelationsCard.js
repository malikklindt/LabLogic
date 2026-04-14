'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from './DataProvider';
import DualLineChart from './DualLineChart';
import { CorrGauge } from './Gauge';
import { streamAI } from '@/lib/utils';
import { CORR_CFG, CORR_DATA } from '@/lib/mockData';

const CORR_ASSET_NAMES = {
  'BTC/DXY':  'DXY (US Dollar Index)',
  'BTC/Gold': 'Gold',
  'BTC/M2':   'M2 Global Liquidity',
  'BTC/SPX':  'the S&P 500',
};

export default function CorrelationsCard() {
  const { corrVals, corrHistory } = useData();

  const [sel,       setSel]       = useState('BTC/DXY');
  const [tf,        setTf]        = useState('1M'); // '1W'=30D window, '1M'=90D, '3M'=180D
  const [corrText,  setCorrText]  = useState('');
  const [corrState, setCorrState] = useState('idle');
  const corrQueue = useRef([]);
  const corrTimer = useRef(null);
  const corrGen   = useRef(0);
  const corrValsRef = useRef(corrVals);
  useEffect(() => { corrValsRef.current = corrVals; }, [corrVals]);

  const corrDrainRef = useRef(null);
  corrDrainRef.current = (genId) => {
    if (genId !== corrGen.current) return;
    if (corrQueue.current.length === 0) { corrTimer.current = null; return; }
    const char = corrQueue.current.shift();
    setCorrText(prev => prev + char);
    corrTimer.current = setTimeout(() => corrDrainRef.current(genId), 20);
  };

  const loadCorrAI = useCallback((pair, timeframe) => {
    if (corrTimer.current) { clearTimeout(corrTimer.current); corrTimer.current = null; }
    const genId = ++corrGen.current;
    corrQueue.current = [];
    setCorrText('');
    setCorrState('loading');
    // corrVals[pair] is now { '1W': x, '1M': x, '3M': x } — pick the matching timeframe
    const liveVal = corrValsRef.current[pair]?.[timeframe];
    const pairCorrVal = liveVal !== undefined ? liveVal : CORR_CFG[pair].corr;
    const assetName   = CORR_ASSET_NAMES[pair] || pair;
    const tfLabel     = timeframe === '1W' ? '30 days' : timeframe === '1M' ? '90 days' : '180 days';
    streamAI(
      {
        system: 'Reply with a 3-5 word headline only. Example: "Dollar headwind limiting upside." or "Decoupling from equities." End with period.',
        messages: [{ role: 'user', content: `Bitcoin has a ${pairCorrVal}% correlation with ${assetName} over the last ${tfLabel}. What does this mean for Bitcoin?` }],
        max_tokens: 60,
      },
      (chunk) => {
        if (genId !== corrGen.current) return;
        for (const char of chunk) corrQueue.current.push(char);
        if (!corrTimer.current) corrDrainRef.current(genId);
        setCorrState(s => s === 'loading' ? 'streaming' : s);
      },
      () => { if (genId === corrGen.current) setCorrState('done'); },
      () => { if (genId === corrGen.current) setCorrState('error'); },
    );
  }, []);

  useEffect(() => { return () => { if (corrTimer.current) clearTimeout(corrTimer.current); }; }, []);

  const corrAIFiredWithLive = useRef(false);
  useEffect(() => {
    if (corrVals[sel]?.[tf] !== undefined && !corrAIFiredWithLive.current) {
      corrAIFiredWithLive.current = true;
      loadCorrAI(sel, tf);
    }
  }, [corrVals]);

  const handleSelChange = (pair) => { setSel(pair); loadCorrAI(pair, tf); };
  const handleTfChange  = (t)    => { setTf(t);     loadCorrAI(sel, t); };

  const cfg       = CORR_CFG[sel];
  // corrVals[sel] is { '1W': x, '1M': x, '3M': x } — pick the active timeframe
  const liveCorr  = corrVals[sel]?.[tf];
  const corrVal   = liveCorr !== undefined ? liveCorr : cfg.corr;
  const liveCD    = corrHistory[sel]?.[tf];
  const cd        = liveCD ?? CORR_DATA[sel][tf];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="fb" style={{ marginBottom: 'var(--gap)' }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Bitcoin Correlations</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap)' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['1W','30D'],['1M','90D'],['3M','180D']].map(([key, label]) => (
              <button key={key} onClick={() => handleTfChange(key)} className="btn-ghost" style={{
                fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                cursor: 'pointer', background: 'transparent', fontFamily: 'Inter, sans-serif',
                color: tf === key ? '#ffffff' : 'var(--muted3)',
                border: tf === key ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.07)',
              }}>{label}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.1)' }} />
          <div className="tabs">
            {Object.keys(CORR_CFG).map(k => (
              <button key={k} className={`tab${sel === k ? ' act' : ''}`} onClick={() => handleSelChange(k)}>{k}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--gap)', flex: 1, minHeight: 0 }}>
        <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', textAlign: 'center', marginBottom: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Current Correlation
          </div>
          <CorrGauge key={`${sel}-${corrVal}`} value={corrVal} size={148} />
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 'var(--fs-base)', color: 'var(--muted3)', lineHeight: 1.55 }}>
            {corrState === 'loading' && (
              <div className="ai-loading" style={{ padding: 0 }}>
                <div className="ai-loading-dot" /><div className="ai-loading-dot" /><div className="ai-loading-dot" />
                <span>Analyzing...</span>
              </div>
            )}
            {(corrState === 'streaming' || corrState === 'done') && corrText.length > 0 && <span>{corrText}</span>}
            {corrState === 'error' && (
              <span style={{ color: '#f87171', fontSize: 'var(--fs-xs)' }}>
                Error.{' '}
                <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => loadCorrAI(sel, tf)}>Retry</span>
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <DualLineChart
                key={`${sel}-${tf}-${corrVal}`}
                data1={cd.d1} data2={cd.d2}
                color1={cfg.c1} color2={cfg.c2}
                label1={cfg.l1} label2={cfg.l2}
                height="100%"
              />
            </div>
            {sel === 'BTC/M2' && (
              <div style={{ textAlign: 'center', fontSize: 'var(--fs-xs)', color: 'var(--muted5)', paddingTop: 4, flexShrink: 0 }}>
                M2 data is monthly — correlation uses monthly returns
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
