'use client';
import { useState, useEffect, useCallback } from 'react';

// ── Format helpers ───────────────────────────────────────────────────────────
const fmtPct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtUsd = (v) => {
  if (v == null) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
};
const fmtPrice = (v) => {
  if (v == null) return '—';
  if (v >= 10000) return `$${Math.round(v).toLocaleString('en-US')}`;
  if (v >= 100)   return `$${v.toFixed(2)}`;
  return `$${v.toFixed(3)}`;
};

// ── Regime color mapping ─────────────────────────────────────────────────────
function regimeColor(label) {
  switch (label) {
    case 'Crisis':     return '#ef4444';
    case 'Risk-Off':   return '#f87171';
    case 'Cautious':   return '#f97316';
    case 'Neutral':    return 'var(--muted)';
    case 'Risk-On':    return '#86efac';
    case 'Bullish':    return '#4ade80';
    case 'Euphoria':   return '#22c55e';
    default:           return 'var(--muted3)';
  }
}

function impColor(imp) {
  switch (imp) {
    case 'High':   return '#ef4444';
    case 'Medium': return '#eab308';
    default:        return 'var(--muted3)';
  }
}

// ── Morning Brief main component ─────────────────────────────────────────────
export default function MorningBrief({ onClose, isModal = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/morning-brief', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load briefing');
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Greeting based on local time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading && !data) {
    return (
      <div style={{
        background: 'var(--bg)', color: 'var(--text)', padding: 40, borderRadius: 16,
        minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: 'var(--muted3)',
      }}>
        <div className="ai-loading">
          <div className="ai-loading-dot"/><div className="ai-loading-dot"/><div className="ai-loading-dot"/>
          <span style={{ marginLeft: 10 }}>Preparing your briefing...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>
        Could not load briefing. <button onClick={load} style={{ color: 'var(--purple)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginLeft: 8 }}>Retry</button>
      </div>
    );
  }

  const regimeClr = regimeColor(data.regime?.label);
  const btc = data.prices?.bitcoin ?? null;
  const eth = data.prices?.ethereum ?? null;
  const sol = data.prices?.solana ?? null;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: 'clamp(20px, 2vw, 36px) clamp(20px, 2vw, 36px) clamp(14px, 1.2vw, 20px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 'clamp(11px, 0.65vw, 13px)', color: 'var(--muted3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
            🌅 LabLogic Daily Briefing
          </div>
          <div style={{ fontSize: 'clamp(22px, 1.6vw, 32px)', fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.5, lineHeight: 1.1 }}>
            {greeting}, Trader.
          </div>
          <div style={{ fontSize: 'clamp(12px, 0.8vw, 15px)', color: 'var(--muted3)', marginTop: 4 }}>{today}</div>
        </div>
        {isModal && onClose && (
          <button onClick={onClose} style={{
            background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--muted)', cursor: 'pointer', fontSize: 18, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
        )}
      </div>

      {/* AI Headline */}
      {data.headline && (
        <div style={{
          padding: 'clamp(16px, 1.2vw, 22px) clamp(20px, 2vw, 36px)',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.02) 100%)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 'clamp(10px, 0.6vw, 12px)', color: 'var(--purple)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
            🤖 Today's Pulse
          </div>
          <div style={{ fontSize: 'clamp(15px, 1vw, 18px)', color: 'var(--fg)', lineHeight: 1.5, fontWeight: 500 }}>
            {data.headline}
          </div>
        </div>
      )}

      {/* Grid of briefing cards */}
      <div style={{
        padding: 'clamp(16px, 1.2vw, 24px) clamp(20px, 2vw, 36px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'clamp(12px, 1vw, 18px)',
      }}>

        {/* Overnight Moves */}
        <BriefCard title="Overnight Moves" icon="📊">
          {[
            { name: 'Bitcoin',  sym: 'BTC', data: btc },
            { name: 'Ethereum', sym: 'ETH', data: eth },
            { name: 'Solana',   sym: 'SOL', data: sol },
          ].map(({ name, sym, data: d }) => {
            const pos = (d?.usd_24h_change ?? 0) >= 0;
            const col = pos ? '#22c55e' : '#ef4444';
            return (
              <div key={sym} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border3)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted3)', marginTop: 1 }}>{sym}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(d?.usd)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: col, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(d?.usd_24h_change)}</div>
                </div>
              </div>
            );
          })}
        </BriefCard>

        {/* Regime Watch */}
        <BriefCard title="Market Regime" icon="🌡️">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: regimeClr, letterSpacing: -1 }}>
              {data.regime?.label ?? '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted3)', fontVariantNumeric: 'tabular-nums' }}>
              {data.regime?.score ?? '—'}/100
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <RegimeBar label="Dollar (UUP)" value={fmtPct(data.indicators?.dxy?.changePct)} positive={(data.indicators?.dxy?.changePct ?? 0) < 0} />
            <RegimeBar label="VIX" value={data.indicators?.vix?.price?.toFixed(1) ?? '—'} positive={(data.indicators?.vix?.price ?? 25) < 20} />
            <RegimeBar label="Bonds (TLT)" value={fmtPct(data.indicators?.bonds?.changePct)} positive={(data.indicators?.bonds?.changePct ?? 0) > 0} />
            <RegimeBar label="S&P 500" value={fmtPct(data.indicators?.spy?.changePct)} positive={(data.indicators?.spy?.changePct ?? 0) > 0} />
          </div>
        </BriefCard>

        {/* Today's Events */}
        <BriefCard title="Today's Events" icon="📅">
          {(data.events ?? []).length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--muted3)', padding: '8px 0' }}>No major events scheduled today.</div>
          )}
          {(data.events ?? []).slice(0, 5).map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < Math.min(4, data.events.length - 1) ? '1px solid var(--border3)' : 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted3)', width: 50, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{e.time}</div>
              <div style={{ fontSize: 13, flexShrink: 0 }}>{e.flag}</div>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${impColor(e.imp)}1a`, color: impColor(e.imp), flexShrink: 0, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                {e.imp === 'High' ? 'H' : e.imp === 'Medium' ? 'M' : 'L'}
              </div>
            </div>
          ))}
        </BriefCard>

        {/* Whale Alert */}
        <BriefCard title="Whale Signal" icon="🐳">
          {data.topWhale ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.5, marginBottom: 6 }}>
                {fmtUsd(data.topWhale.amount_usd)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                {data.topWhale.amount?.toFixed(2)} {data.topWhale.symbol} · {data.topWhale.label}
              </div>
              <div style={{ display: 'inline-block', padding: '4px 10px', background: `${data.topWhale.sentiment === 'Bullish' ? '#22c55e' : data.topWhale.sentiment === 'Bearish' ? '#ef4444' : 'var(--purple)'}1a`,
                           border: `1px solid ${data.topWhale.sentiment === 'Bullish' ? '#22c55e' : data.topWhale.sentiment === 'Bearish' ? '#ef4444' : 'var(--purple)'}40`,
                           borderRadius: 6, fontSize: 11, fontWeight: 700, color: data.topWhale.sentiment === 'Bullish' ? '#22c55e' : data.topWhale.sentiment === 'Bearish' ? '#ef4444' : 'var(--purple)' }}>
                {data.topWhale.sentiment} signal
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--muted3)' }}>Quiet night — no major whale moves detected.</div>
          )}
        </BriefCard>

        {/* Fear & Greed */}
        {data.fearGreed && (
          <BriefCard title="Market Sentiment" icon="😰">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--fg)', letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' }}>
                {data.fearGreed.value}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>
                {data.fearGreed.label}
              </div>
            </div>
            <div style={{ height: 6, background: 'var(--card3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${data.fearGreed.value}%`,
                background: data.fearGreed.value < 25 ? '#ef4444' : data.fearGreed.value < 50 ? '#f97316' : data.fearGreed.value < 75 ? '#86efac' : '#22c55e',
                borderRadius: 3,
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted3)', marginTop: 6 }}>Fear &amp; Greed Index · updated daily</div>
          </BriefCard>
        )}

        {/* Funding Bias */}
        {data.fundingAvg != null && (
          <BriefCard title="Derivatives Pulse" icon="💰">
            <div style={{ fontSize: 24, fontWeight: 800, color: data.fundingAvg > 0 ? '#ef4444' : '#22c55e', letterSpacing: -0.5, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
              {(data.fundingAvg * 100).toFixed(4)}%
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
              {data.fundingAvg > 0.0005 ? 'Longs heavy — squeeze risk rising' :
               data.fundingAvg > 0.0001 ? 'Mild long bias' :
               data.fundingAvg < -0.0005 ? 'Shorts heavy — squeeze risk rising' :
               data.fundingAvg < -0.0001 ? 'Mild short bias' :
               'Balanced — no dominant leverage bias'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted3)' }}>Avg across 10 coins · 3 exchanges</div>
          </BriefCard>
        )}
      </div>

      {/* Action for Today */}
      {data.action && (
        <div style={{
          margin: 'clamp(16px, 1.2vw, 24px) clamp(20px, 2vw, 36px) clamp(20px, 1.5vw, 30px)',
          padding: 'clamp(18px, 1.4vw, 26px)',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 100%)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
            🎯 Action for Today
          </div>
          <div style={{ fontSize: 'clamp(14px, 0.95vw, 16px)', color: 'var(--fg)', lineHeight: 1.6 }}>
            {data.action}
          </div>
        </div>
      )}

      {/* Enter dashboard CTA (only in modal) */}
      {isModal && onClose && (
        <div style={{ padding: '0 clamp(20px, 2vw, 36px) clamp(24px, 2vw, 32px)', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, var(--purple-deep), var(--purple))',
              border: 'none', borderRadius: 10, color: 'white',
              fontWeight: 700, fontSize: 15, padding: '12px 36px', cursor: 'pointer',
              fontFamily: 'Inter', letterSpacing: 0.3,
              boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
            }}
          >
            Enter Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Briefing card wrapper ────────────────────────────────────────────────────
function BriefCard({ title, icon, children }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 'clamp(14px, 1vw, 20px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted3)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

// ── Regime indicator row ─────────────────────────────────────────────────────
function RegimeBar({ label, value, positive }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ color: positive ? '#22c55e' : '#ef4444', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
