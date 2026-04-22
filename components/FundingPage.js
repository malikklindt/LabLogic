'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import FundingIntelligence from './FundingIntelligence';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtRate = (r) => {
  if (r == null) return '—';
  return `${r >= 0 ? '+' : ''}${(r * 100).toFixed(4)}%`;
};

const annualized = (r) => {
  if (r == null) return null;
  return (r * 3 * 365 * 100).toFixed(1);
};

const fmtUsd = (usd) => {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  return `$${(usd / 1e3).toFixed(0)}K`;
};

const fmtPrice = (p) => {
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100)   return p.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (p >= 1)     return p.toFixed(3);
  return p.toFixed(5);
};

function rateColor(r) {
  if (r == null)    return 'var(--muted5)';
  if (r >  0.001)   return 'var(--red)';
  if (r >  0.0005)  return 'var(--orange)';
  if (r >  0.0001)  return 'var(--yellow)';
  if (r < -0.0005)  return 'var(--green)';
  if (r < -0.0001)  return 'var(--green-light)';
  return 'var(--muted)';
}

function rateBg(r) {
  if (r == null)    return 'transparent';
  if (r >  0.001)   return 'rgba(239,68,68,0.12)';
  if (r >  0.0005)  return 'rgba(249,115,22,0.10)';
  if (r >  0.0001)  return 'rgba(234,179,8,0.08)';
  if (r < -0.0005)  return 'rgba(34,197,94,0.12)';
  if (r < -0.0001)  return 'rgba(134,239,172,0.08)';
  return 'transparent';
}

function sentimentLabel(avg) {
  if (avg == null)     return { label: 'Neutral',          color: 'var(--muted)', sub: 'No data' };
  if (avg >  0.001)    return { label: 'Extremely Long',   color: 'var(--red)', sub: 'Long squeeze risk' };
  if (avg >  0.0005)   return { label: 'Heavily Long',     color: 'var(--orange)', sub: 'Elevated — caution on longs' };
  if (avg >  0.0001)   return { label: 'Mildly Long',      color: 'var(--yellow)', sub: 'Slight long bias' };
  if (avg < -0.001)    return { label: 'Extremely Short',  color: 'var(--green)', sub: 'Short squeeze risk' };
  if (avg < -0.0005)   return { label: 'Heavily Short',    color: 'var(--green-light)', sub: 'Elevated — caution on shorts' };
  if (avg < -0.0001)   return { label: 'Mildly Short',     color: 'var(--green-light)', sub: 'Slight short bias' };
  return { label: 'Neutral', color: 'var(--purple-deep)', sub: 'Balanced leverage' };
}

function useCountdown(tsMs) {
  const [str, setStr] = useState('');
  useEffect(() => {
    if (!tsMs) return;
    const tick = () => {
      const diff = tsMs - Date.now();
      if (diff <= 0) { setStr('Now'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setStr(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tsMs]);
  return str;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function FundingSparkline({ data, width = 220, height = 48 }) {
  if (!data?.length) return null;
  const rates  = data.map(d => d.rate);
  const min = Math.min(...rates), max = Math.max(...rates);
  const range  = max - min || 0.0001;
  const pts    = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((d.rate - min) / range) * (height * 0.85) - height * 0.07,
  }));
  const line   = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const latest = rates[rates.length - 1];
  const color  = latest >= 0 ? 'var(--red)' : 'var(--green)';
  const zeroY  = height - ((0 - min) / range) * (height * 0.85) - height * 0.07;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      {zeroY > 0 && zeroY < height && (
        <line x1="0" y1={zeroY.toFixed(1)} x2={width} y2={zeroY.toFixed(1)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" />
      )}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="3" fill={color} />
    </svg>
  );
}

// ── History modal ─────────────────────────────────────────────────────────────
function HistoryModal({ coin, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const BINANCE_SYMBOL = {
    BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
    XRP: 'XRPUSDT', DOGE: 'DOGEUSDT', AVAX: 'AVAXUSDT', LINK: 'LINKUSDT',
    ADA: 'ADAUSDT', SUI: 'SUIUSDT',
  };

  useEffect(() => {
    const sym = BINANCE_SYMBOL[coin.symbol];
    if (!sym) { setLoading(false); return; }
    fetch(`/api/funding?history=${sym}`)
      .then(r => r.json())
      .then(d => { setData(d.history ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [coin.symbol]);

  const close = () => { setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const avgRate = data?.length ? data.reduce((s, d) => s + d.rate, 0) / data.length : null;
  const maxRate = data?.length ? Math.max(...data.map(d => d.rate)) : null;
  const minRate = data?.length ? Math.min(...data.map(d => d.rate)) : null;

  return (
    <>
      <style>{`
        @keyframes fmOverIn  { from{opacity:0} to{opacity:1} }
        @keyframes fmOverOut { from{opacity:1} to{opacity:0} }
        @keyframes fmCardIn  { from{opacity:0;transform:scale(0.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fmCardOut { from{opacity:1;transform:scale(1) translateY(0)} to{opacity:0;transform:scale(0.96) translateY(12px)} }
      `}</style>
      <div onClick={close} style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(4,4,12,0.75)', backdropFilter:'blur(8px)', animation:`${closing ? 'fmOverOut' : 'fmOverIn'} 200ms ease both` }} />
      <div style={{ position:'fixed', inset:0, zIndex:9001, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        <div onClick={e => e.stopPropagation()} style={{ width:'90vw', maxWidth:620, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:18, boxShadow:'0 32px 80px rgba(0,0,0,0.8)', pointerEvents:'all', overflow:'hidden', animation:`${closing ? 'fmCardOut' : 'fmCardIn'} 220ms cubic-bezier(0.22,1,0.36,1) both` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--text2)', letterSpacing:-0.4 }}>{coin.symbol} Funding History</div>
              <div style={{ fontSize:11, color:'var(--muted3)', marginTop:2 }}>Last 90 events · OKX perpetuals</div>
            </div>
            <button onClick={close} style={{ width:28, height:28, borderRadius:7, background:'var(--card-hover)', border:'1px solid var(--border)', color:'var(--muted3)', fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
          <div style={{ padding:'18px 20px' }}>
            {loading && <div style={{ textAlign:'center', color:'var(--muted3)', padding:'28px 0', fontSize:13 }}>Loading…</div>}
            {!loading && data && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
                  {[
                    { label:'30-Day Avg', value:fmtRate(avgRate), color:rateColor(avgRate) },
                    { label:'Peak Rate',  value:fmtRate(maxRate), color:rateColor(maxRate) },
                    { label:'Low Rate',   value:fmtRate(minRate), color:rateColor(minRate) },
                  ].map(s => (
                    <div key={s.label} style={{ background:'var(--card3)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:'var(--muted3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>{s.label}</div>
                      <div style={{ fontSize:17, fontWeight:800, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:'var(--card3)', border:'1px solid var(--border)', borderRadius:10, padding:'14px', marginBottom:12 }}>
                  <div style={{ fontSize:10, color:'var(--muted3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Rate over Time</div>
                  <FundingSparkline data={data} width={540} height={80} />
                </div>
                <div style={{ fontSize:10, color:'var(--muted3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Recent Payments</div>
                <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:180, overflowY:'auto' }}>
                  {[...data].reverse().slice(0, 15).map((d, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', background:'var(--card3)', borderRadius:7, border:'1px solid var(--border)' }}>
                      <span style={{ fontSize:11, color:'var(--muted3)' }}>
                        {new Date(d.ts).toLocaleDateString('en-US', { month:'short', day:'numeric' })} {new Date(d.ts).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}
                      </span>
                      <span style={{ fontSize:13, fontWeight:700, color:rateColor(d.rate) }}>{fmtRate(d.rate)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Liquidation Zones ─────────────────────────────────────────────────────────
function LiquidationZones() {
  const [data,   setData]   = useState(null);
  const [loading,setLoading]= useState(true);
  const [active, setActive] = useState('BTC');

  useEffect(() => {
    fetch('/api/liquidations', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const coin = data?.coins?.find(c => c.symbol === active);

  const shortLevels = coin?.levels
    .filter(l => l.type === 'short')
    .sort((a, b) => b.price - a.price) ?? [];
  const longLevels = coin?.levels
    .filter(l => l.type === 'long')
    .sort((a, b) => b.price - a.price) ?? [];

  const maxUsd = coin ? Math.max(...coin.levels.map(l => l.usd)) : 1;

  const LiqRow = ({ level, isShort }) => {
    const pct  = Math.min(100, (level.usd / maxUsd) * 100);
    const col  = isShort ? 'var(--green)' : 'var(--red)';
    const bg   = isShort ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
    const sign = level.pricePct >= 0 ? '+' : '';
    return (
      <div style={{ display:'grid', gridTemplateColumns:'80px 78px 1fr 60px', gap:6, alignItems:'center', padding:'6px 12px', borderBottom:'1px solid var(--border3)' }}>
        {/* Price */}
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', fontVariantNumeric:'tabular-nums' }}>
          ${fmtPrice(level.price)}
        </div>
        {/* % + leverage */}
        <div style={{ fontSize:10, fontWeight:700, color: col }}>
          {sign}{level.pricePct.toFixed(1)}% · {level.leverage}×
        </div>
        {/* Bar */}
        <div style={{ height:14, background:'var(--border3)', borderRadius:3, overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`, background: bg, borderRight:`2px solid ${col}`, borderRadius:3, transition:'width 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
        </div>
        {/* Value */}
        <div style={{ fontSize:11, fontWeight:800, color: col, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
          {fmtUsd(level.usd)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text2)', letterSpacing:-0.3 }}>Liquidation Zones</div>
          <div style={{ fontSize:11, color:'var(--muted3)', marginTop:1 }}>Estimated from open interest &amp; leverage distribution · OKX</div>
        </div>
        {data?.coins && (
          <div style={{ display:'flex', gap:4 }}>
            {data.coins.map(c => (
              <button key={c.symbol} onClick={() => setActive(c.symbol)} style={{
                padding:'4px 10px', borderRadius:6, border:'1px solid', fontSize:11, fontWeight:700,
                cursor:'pointer', fontFamily:'Inter', transition:'all 0.15s',
                borderColor: c.symbol === active ? 'rgba(124,58,237,0.5)' : 'var(--border)',
                background:  c.symbol === active ? 'rgba(124,58,237,0.15)' : 'var(--card3)',
                color:       c.symbol === active ? 'var(--purple)' : 'var(--muted3)',
              }}>
                {c.symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted3)', fontSize:13 }}>
          Fetching open interest data…
        </div>
      )}

      {!loading && !coin && (
        <div style={{ textAlign:'center', padding:'32px 0', color:'var(--red)', fontSize:13 }}>
          Failed to load liquidation data.
        </div>
      )}

      {!loading && coin && (
        <>
          {/* Stats row */}
          <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
            {[
              { label:'Total OI',    value: fmtUsd(coin.oiUsd),                            color:'var(--text2)' },
              { label:'Long Accts',  value: `${(coin.longPct  * 100).toFixed(1)}%`,         color:'var(--red)' },
              { label:'Short Accts', value: `${(coin.shortPct * 100).toFixed(1)}%`,         color:'var(--green)' },
              { label:'Mark Price',  value: `$${fmtPrice(coin.price)}`,                     color:'var(--text2)' },
            ].map((s, i, arr) => (
              <div key={s.label} style={{ flex:1, padding:'7px 10px', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize:8, color:'var(--muted3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{s.label}</div>
                <div style={{ fontSize:13, fontWeight:800, color:s.color, fontVariantNumeric:'tabular-nums' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Short liquidations — above price */}
          <div style={{ padding:'8px 18px 4px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--green)', textTransform:'uppercase', letterSpacing:'0.7px', display:'flex', alignItems:'center', gap:5 }}>
              <span>▲</span> Short Liquidations — triggered if price rises
            </div>
          </div>
          {shortLevels.map((l, i) => <LiqRow key={i} level={l} isShort={true} />)}

          {/* Current price marker */}
          <div style={{ padding:'8px 12px', background:'rgba(124,58,237,0.07)', borderTop:'1px solid rgba(124,58,237,0.18)', borderBottom:'1px solid rgba(124,58,237,0.18)', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--purple-deep)', boxShadow:'0 0 10px var(--purple-deep)' }} />
            <span style={{ fontSize:13, fontWeight:800, color:'var(--text2)', fontVariantNumeric:'tabular-nums' }}>${fmtPrice(coin.price)}</span>
            <span style={{ fontSize:10, color:'var(--muted)' }}>Current Price</span>
          </div>

          {/* Long liquidations — below price */}
          <div style={{ padding:'8px 18px 4px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--red)', textTransform:'uppercase', letterSpacing:'0.7px', display:'flex', alignItems:'center', gap:5 }}>
              <span>▼</span> Long Liquidations — triggered if price drops
            </div>
          </div>
          {longLevels.map((l, i) => <LiqRow key={i} level={l} isShort={false} />)}

          {/* Footer note */}
          <div style={{ padding:'10px 18px', borderTop:'1px solid var(--border)', fontSize:10, color:'var(--muted4)', lineHeight:1.6 }}>
            Estimates based on OKX open interest &amp; typical leverage distribution. Actual liquidation prices vary by entry, leverage, and exchange. Use as a guide, not as precise levels.
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FundingPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [selected,setSelected]= useState(null);

  const nextTs   = data?.coins?.[0]?.nextFundingTs ?? null;
  const countdown= useCountdown(nextTs);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/funding', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sentiment = sentimentLabel(data?.marketAvg);
  const barFill   = data?.marketAvg != null
    ? Math.min(100, Math.max(0, ((data.marketAvg + 0.002) / 0.004) * 100))
    : 50;

  const EXCHANGES = [
    { key:'okx',     label:'OKX'     },
    { key:'mexc',    label:'MEXC'    },
    { key:'bitmex',  label:'BitMEX'  },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text2)', fontFamily:'system-ui, sans-serif', paddingBottom:48 }}>

      {/* ── Header ── */}
      <div style={{ borderBottom:'1px solid var(--border)', padding:'12px 28px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, letterSpacing:-0.5 }}>Funding Rates</div>
          <div style={{ fontSize:11, color:'var(--muted3)', marginTop:1 }}>Perpetual futures · OKX · MEXC · BitMEX · updates every 8h</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {nextTs && (
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:9, color:'var(--muted3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>Next funding</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--purple)', fontVariantNumeric:'tabular-nums' }}>{countdown}</div>
            </div>
          )}
          <button onClick={load} style={{ background:'var(--card3)', border:'1px solid var(--border)', borderRadius:7, color:'var(--muted3)', fontSize:12, padding:'6px 12px', cursor:'pointer' }}>↻ Refresh</button>
        </div>
      </div>

      <div className="mobile-scroll-x" style={{ padding:'18px 28px 0' }}>

        {/* ── Sentiment row (compact) ── */}
        <div style={{ background:'var(--card)', border:`1px solid ${sentiment.color}28`, borderRadius:14, padding:'12px 18px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap', marginBottom:10 }}>
            {/* Label */}
            <div style={{ minWidth:180 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--muted3)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:2 }}>Market Leverage Bias</div>
              <div style={{ fontSize:20, fontWeight:800, color:sentiment.color, letterSpacing:-0.4, lineHeight:1 }}>{sentiment.label}</div>
              <div style={{ fontSize:11, color:'var(--muted3)', marginTop:2 }}>{sentiment.sub}</div>
            </div>
            {/* Avg rate */}
            <div style={{ borderLeft:'1px solid var(--border)', paddingLeft:24 }}>
              <div style={{ fontSize:9, color:'var(--muted3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>Avg 8h Rate</div>
              <div style={{ fontSize:22, fontWeight:800, color:rateColor(data?.marketAvg), fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
                {fmtRate(data?.marketAvg)}
              </div>
              <div style={{ fontSize:10, color:'var(--muted3)', marginTop:2 }}>
                {data?.marketAvg != null ? `${annualized(data.marketAvg)}% annualized` : ''}
              </div>
            </div>
            {/* Legend inline */}
            <div style={{ marginLeft:'auto', display:'flex', gap:12, flexWrap:'wrap' }}>
              {[
                { color:'var(--red)', label:'Extreme longs' },
                { color:'var(--orange)', label:'Elevated longs' },
                { color:'var(--muted)', label:'Neutral' },
                { color:'var(--green-light)', label:'Elevated shorts' },
                { color:'var(--green)', label:'Extreme shorts' },
              ].map(l => (
                <div key={l.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:l.color }} />
                  <span style={{ fontSize:10, color:'var(--muted3)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Bias bar */}
          <div style={{ position:'relative', height:5, borderRadius:3, overflow:'visible' }}>
            <div style={{ position:'absolute', inset:0, borderRadius:3, background:'linear-gradient(90deg, var(--green), var(--border) 50%, var(--red))' }} />
            <div style={{ position:'absolute', top:'50%', left:`${barFill}%`, transform:'translate(-50%,-50%)', width:12, height:12, borderRadius:'50%', background:sentiment.color, border:'2px solid var(--bg)', boxShadow:`0 0 8px ${sentiment.color}80`, transition:'left 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
            <span style={{ fontSize:9, color:'var(--green)', fontWeight:600 }}>Shorts heavy</span>
            <span style={{ fontSize:9, color:'var(--muted3)' }}>Neutral</span>
            <span style={{ fontSize:9, color:'var(--red)', fontWeight:600 }}>Longs heavy</span>
          </div>
        </div>

        {/* ── Two-column layout: Table + Liquidation Zones ── */}
        <div className="funding-two-col">

        {/* ── Left: Funding Table ── */}
        <div className="mobile-scroll-x">
        {loading && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted3)', fontSize:13 }}>
            Fetching rates from OKX, MEXC, BitMEX…
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign:'center', padding:'32px 0', color:'var(--red)', fontSize:13 }}>{error}</div>
        )}

        {!loading && data && (
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            {/* Header */}
            <div className="funding-table" style={{ padding:'8px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--muted3)', textTransform:'uppercase', letterSpacing:'0.6px' }}>Asset</div>
              {EXCHANGES.map(ex => (
                <div key={ex.key} style={{ fontSize:9, fontWeight:700, color:'var(--muted3)', textTransform:'uppercase', letterSpacing:'0.6px', textAlign:'center' }}>{ex.label}</div>
              ))}
              <div style={{ fontSize:9, fontWeight:700, color:'var(--muted3)', textTransform:'uppercase', letterSpacing:'0.6px', textAlign:'center' }}>Avg</div>
            </div>

            {/* Rows */}
            {data.coins.map((coin, i) => (
              <div
                key={coin.symbol}
                onClick={() => setSelected(coin)}
                className="funding-table"
                style={{ padding:'8px 14px', borderBottom: i < data.coins.length - 1 ? '1px solid var(--border3)' : 'none', cursor:'pointer', transition:'background 0.12s', background:'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Symbol */}
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:22, height:22, borderRadius:6, background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, color:'var(--purple-deep)' }}>
                    {coin.symbol.slice(0,3)}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text2)' }}>{coin.symbol}</span>
                </div>

                {/* Exchange rates */}
                {EXCHANGES.map(ex => {
                  const r = coin[ex.key];
                  return (
                    <div key={ex.key} style={{ textAlign:'center' }}>
                      <div style={{ display:'inline-block', padding:'2px 9px', borderRadius:5, background:rateBg(r), fontSize:12, fontWeight:700, color:rateColor(r), fontVariantNumeric:'tabular-nums' }}>
                        {fmtRate(r)}
                      </div>
                    </div>
                  );
                })}

                {/* Average */}
                <div style={{ textAlign:'center' }}>
                  <div style={{ display:'inline-block', padding:'2px 9px', borderRadius:5, background:rateBg(coin.avg), border:`1px solid ${rateColor(coin.avg)}28`, fontSize:12, fontWeight:800, color:rateColor(coin.avg), fontVariantNumeric:'tabular-nums' }}>
                    {fmtRate(coin.avg)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        </div>

        <LiquidationZones />

        </div>

        <FundingIntelligence />
      </div>

      {selected && <HistoryModal coin={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
