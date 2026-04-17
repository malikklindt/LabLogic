'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';


// ── Helpers ───────────────────────────────────────────────────────────────────
const STABLES = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD']);

function formatAmount(amount, symbol) {
  if (!symbol) return formatUSD(amount);
  if (STABLES.has(symbol.toUpperCase())) return formatUSD(amount); // show as $
  // Show token amount + symbol
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M ${symbol}`;
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(1)}K ${symbol}`;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
}

function formatUSD(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// Size tier based on USD value
function sizeTier(usd) {
  if (usd >= 100_000_000) return { dots: 4, label: 'Mega Whale' };
  if (usd >= 25_000_000)  return { dots: 3, label: 'Large Whale' };
  if (usd >= 5_000_000)   return { dots: 2, label: 'Whale' };
  return                          { dots: 1, label: 'Large Tx' };
}

// Blockchain color accent
function chainColor(blockchain) {
  switch (blockchain) {
    case 'bitcoin':  return '#f97316';
    case 'ethereum': return '#7c8ef0';
    case 'tron':     return '#ef4444';
    case 'ripple':   return '#3b82f6';
    default:         return '#a855f7';
  }
}

// ── Size indicator dots ───────────────────────────────────────────────────────
function SizeDots({ usd, color }) {
  const { dots } = sizeTier(usd);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{
          width: i === 1 ? 6 : i === 2 ? 7 : i === 3 ? 8 : 9,
          height: i === 1 ? 6 : i === 2 ? 7 : i === 3 ? 8 : 9,
          borderRadius: '50%',
          background: i <= dots ? color : 'rgba(255,255,255,0.05)',
          boxShadow: i <= dots ? `0 0 6px ${color}88` : 'none',
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  );
}

// ── Chain badge ───────────────────────────────────────────────────────────────
function ChainBadge({ blockchain, symbol }) {
  const color = chainColor(blockchain);
  return (
    <div style={{
      fontSize: 'clamp(8px, 0.48vw, 10px)', fontWeight: 700,
      color, background: `${color}14`,
      border: `1px solid ${color}28`,
      borderRadius: 4, padding: '1px 6px',
      letterSpacing: '0.4px', flexShrink: 0,
    }}>
      {symbol}
    </div>
  );
}

// ── Transaction modal ─────────────────────────────────────────────────────────
function TxModal({ tx, onClose }) {
  const [copied, setCopied]   = useState(false);
  const [closing, setClosing] = useState(false);
  const { label: sizeLabel }  = sizeTier(tx.amount_usd);

  const handleClose = () => { setClosing(true); setTimeout(onClose, 200); };

  const copy = () => {
    navigator.clipboard.writeText(tx.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Node box for from/to
  function Node({ name, type, side }) {
    const isExchange = type === 'exchange';
    const col = isExchange
      ? (side === 'from' && tx.signal === 'outflow') || (side === 'to' && tx.signal === 'inflow')
        ? tx.color
        : '#f97316'
      : 'var(--muted3)';
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `${col}18`,
          border: `1.5px solid ${col}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 18px ${col}22`,
        }}>
          {isExchange ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.2 }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted5)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isExchange ? 'Exchange' : 'Private Wallet'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,10,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: closing ? 'modalFadeIn 0.2s ease reverse both' : 'modalFadeIn 0.18s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: 'var(--bg2)',
          border: `1px solid ${tx.color}30`,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: `0 0 60px ${tx.color}18, 0 24px 64px rgba(0,0,0,0.6)`,
          animation: closing ? 'modalSlideUp 0.2s cubic-bezier(0.22,1,0.36,1) reverse both' : 'modalSlideUp 0.22s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid var(--card2)`,
          background: `linear-gradient(135deg, ${tx.color}08, transparent)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: tx.color, boxShadow: `0 0 8px ${tx.color}` }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: tx.color }}>{tx.label}</span>
            <span style={{ fontSize: 11, color: 'var(--muted4)', marginLeft: 4 }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--muted4)' }}>{sizeLabel}</span>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted5)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>

        {/* Flow visual */}
        <div style={{
          margin: '20px 20px 0',
          background: 'linear-gradient(135deg, var(--card), var(--bg3))',
          border: `1px solid var(--border)`,
          borderRadius: 14,
          padding: '22px 16px 18px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Ambient glow */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 240, height: 80,
            background: `radial-gradient(ellipse, ${tx.color}12, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          {/* Amount hero */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--fg)', letterSpacing: -1, lineHeight: 1 }}>
              {formatAmount(tx.amount, tx.symbol)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted3)', marginTop: 4 }}>
              {STABLES.has(tx.symbol) ? 'Stablecoin transfer' : formatUSD(tx.amount_usd)}
            </div>
          </div>

          {/* From → To nodes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <Node name={tx.from.name} type={tx.from.type} side="from" />

            {/* Animated connector */}
            <div style={{ position: 'relative', width: 60, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
              <div style={{ width: '100%', height: 2, background: `linear-gradient(90deg, ${tx.color}40, ${tx.color}, ${tx.color}40)`, borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: `linear-gradient(90deg, transparent, ${tx.color}, transparent)`, animation: 'flowPulse 1.6s ease-in-out infinite' }} />
              </div>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M0 5h12M8 1l4 4-4 4" stroke={tx.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <Node name={tx.to.name} type={tx.to.type} side="to" />
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: '16px 20px' }}>
          {/* Sentiment */}
          <div style={{
            display: 'flex', gap: 10, marginBottom: 14,
          }}>
            <div style={{ flex: 1, background: `${tx.color}10`, border: `1px solid ${tx.color}25`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Sentiment</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: tx.color }}>{tx.sentiment}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Chain</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: chainColor(tx.blockchain), textTransform: 'capitalize' }}>{tx.blockchain}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Time</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{timeAgo(tx.timestamp)}</div>
            </div>
          </div>

          {/* Explanation */}
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 14, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, borderLeft: `2px solid ${tx.color}40` }}>
            {tx.explanation}
          </div>

          {/* TX Hash */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 10, color: 'var(--muted4)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg3)', borderRadius: 6, padding: '7px 10px', border: '1px solid var(--card2)' }}>
              {tx.id}
            </div>
            <button
              onClick={copy}
              style={{
                background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                borderRadius: 6, padding: '7px 12px',
                fontSize: 10, fontWeight: 700,
                color: copied ? 'var(--green)' : 'var(--muted3)',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s ease', flexShrink: 0,
              }}
            >{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--muted4)' }}>LabLogic · Whale Watch</span>
          <span style={{ fontSize: 10, color: 'var(--muted4)' }}>{new Date(tx.timestamp).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────
function TxRow({ tx, index, onSelect }) {
  const bgColor = tx.signal === 'outflow'
    ? 'rgba(34,197,94,0.04)'
    : tx.signal === 'inflow'
    ? 'rgba(239,68,68,0.04)'
    : 'rgba(168,85,247,0.04)';
  const borderColor = tx.signal === 'outflow'
    ? 'rgba(34,197,94,0.12)'
    : tx.signal === 'inflow'
    ? 'rgba(239,68,68,0.12)'
    : 'rgba(168,85,247,0.12)';

  return (
    <div
      onClick={() => onSelect(tx)}
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        marginBottom: 2,
        animation: `txSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) ${index * 0.04}s both`,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = bgColor; e.currentTarget.style.borderColor = borderColor; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Size indicator */}
        <SizeDots usd={tx.amount_usd} color={tx.color} />

        {/* Chain + Amount */}
        <div style={{ minWidth: 130 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <ChainBadge blockchain={tx.blockchain} symbol={tx.symbol} />
          </div>
          <div style={{ fontSize: 'clamp(13px, 0.83vw, 16px)', fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.3, lineHeight: 1 }}>
            {formatAmount(tx.amount, tx.symbol)}
          </div>
          <div style={{ fontSize: 'clamp(10px, 0.58vw, 12px)', color: 'var(--muted3)', fontWeight: 500, marginTop: 2 }}>
            {STABLES.has(tx.symbol) ? 'Stablecoin flow' : formatUSD(tx.amount_usd)}
          </div>
        </div>

        {/* Direction */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 'clamp(11px, 0.63vw, 13px)', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
            {tx.from.name}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
          <span style={{ fontSize: 'clamp(11px, 0.63vw, 13px)', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
            {tx.to.name}
          </span>
        </div>

        {/* Signal badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: `${tx.color}14`,
          border: `1px solid ${tx.color}30`,
          borderRadius: 6, padding: '4px 9px', flexShrink: 0,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: tx.color, boxShadow: `0 0 5px ${tx.color}` }} />
          <span style={{ fontSize: 'clamp(9px, 0.52vw, 11px)', fontWeight: 700, color: tx.color, whiteSpace: 'nowrap' }}>
            {tx.label}
          </span>
        </div>

        {/* Sentiment + time */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 60 }}>
          <div style={{ fontSize: 'clamp(9px, 0.52vw, 11px)', fontWeight: 700, color: tx.signal === 'outflow' ? 'var(--green)' : tx.signal === 'inflow' ? 'var(--red)' : 'var(--purple)' }}>
            {tx.sentiment}
          </div>
          <div style={{ fontSize: 'clamp(9px, 0.5vw, 10px)', color: 'var(--muted5)', marginTop: 2 }}>
            {timeAgo(tx.timestamp)}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 'clamp(14px, 1vw, 22px)', flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 'clamp(9px, 0.5vw, 11px)', fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
          {label}
        </div>
        {icon}
      </div>
      <div style={{ fontSize: 'clamp(18px, 1.25vw, 26px)', fontWeight: 800, color: color ?? 'var(--fg)', letterSpacing: -0.5, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'clamp(10px, 0.57vw, 12px)', color: 'var(--muted3)', lineHeight: 1.45 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── AI liquidation narrative ─────────────────────────────────────────────────
function LiqNarrative({ liqs }) {
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const lastLiqRef            = useRef(null);

  const generate = async (liqData) => {
    setLoading(true);
    setText('');
    setError(false);
    try {
      const res = await fetch('/api/liq-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(liqData),
      });
      if (!res.ok) { setError(true); setLoading(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              const clean = evt.delta.text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/^#{1,6}\s/gm, '')
                .replace(/`/g, '')
                .replace(/__/g, '');
              setText(prev => prev + clean);
            }
          } catch (_) {}
        }
      }
    } catch (_) { setError(true); }
    finally { setLoading(false); }
  };

  // Auto-generate when liqs data first arrives or changes significantly
  useEffect(() => {
    if (!liqs) return;
    const key = `${Math.round(liqs.total_usd / 1e5)}`;
    if (lastLiqRef.current === key) return;
    lastLiqRef.current = key;
    generate(liqs);
  }, [liqs]);

  if (!liqs) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'var(--purple)',
            background: 'rgba(168,85,247,0.12)',
            border: '1px solid rgba(168,85,247,0.25)',
            borderRadius: 4, padding: '2px 6px', letterSpacing: '0.4px',
          }}>AI</div>
          <span style={{ fontSize: 10, color: 'var(--muted5)', fontWeight: 600 }}>Market Read</span>
        </div>
        <button
          onClick={() => generate(liqs)}
          disabled={loading}
          style={{
            background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
            fontSize: 10, color: loading ? 'var(--muted4)' : 'var(--muted5)', padding: 0, fontFamily: 'inherit',
            opacity: loading ? 0.5 : 1,
          }}
        >↻ refresh</button>
      </div>
      <div style={{
        fontSize: 'clamp(10px, 0.57vw, 12px)',
        color: loading && !text ? 'var(--muted4)' : 'var(--muted)',
        lineHeight: 1.65,
        minHeight: 38,
        background: 'rgba(168,85,247,0.04)',
        border: '1px solid rgba(168,85,247,0.1)',
        borderLeft: '2px solid rgba(168,85,247,0.4)',
        borderRadius: '0 6px 6px 0',
        padding: '8px 10px',
      }}>
        {loading && !text && (
          <span style={{ color: 'var(--muted4)', animation: 'whalePulse 1.4s ease infinite' }}>Analyzing market structure...</span>
        )}
        {error && !text && <span style={{ color: 'var(--red)' }}>Could not generate analysis.</span>}
        {text}
        {loading && text && <span style={{ opacity: 0.4, animation: 'whalePulse 0.8s ease infinite' }}>▍</span>}
      </div>
    </div>
  );
}

// ── Liquidation bar ───────────────────────────────────────────────────────────
function LiqBar({ longs, shorts }) {
  const total = longs + shorts;
  const longPct = total > 0 ? (longs / total) * 100 : 50;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 'clamp(10px, 0.58vw, 12px)', color: 'var(--green)', fontWeight: 700 }}>Longs wiped {formatUSD(longs)}</span>
        <span style={{ fontSize: 'clamp(10px, 0.58vw, 12px)', color: 'var(--red)', fontWeight: 700 }}>Shorts wiped {formatUSD(shorts)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--card2)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, #22c55e ${longPct}%, #ef4444 ${longPct}%)`,
          transition: 'all 0.5s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 'clamp(9px, 0.48vw, 10px)', color: 'var(--muted5)' }}>{longPct.toFixed(0)}%</span>
        <span style={{ fontSize: 'clamp(9px, 0.48vw, 10px)', color: 'var(--muted5)' }}>{(100 - longPct).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ── Sentiment bar (stablecoin inflows vs outflows) ────────────────────────────
function SentimentBar({ inflow, outflow }) {
  const total = inflow + outflow || 1;
  const outPct = (outflow / total) * 100;
  const dominant = outflow > inflow ? 'bullish' : 'bearish';
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 'clamp(9px, 0.5vw, 11px)', color: 'var(--green)', fontWeight: 600 }}>Outflow (bullish) {formatUSD(outflow)}</span>
        <span style={{ fontSize: 'clamp(9px, 0.5vw, 11px)', color: 'var(--red)', fontWeight: 600 }}>Inflow (bearish) {formatUSD(inflow)}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--card2)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${outPct}%`, borderRadius: 3,
          background: 'linear-gradient(90deg, #22c55e, #16a34a)',
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 'clamp(9px, 0.5vw, 11px)', color: dominant === 'bullish' ? 'var(--green)' : 'var(--red)' }}>
        {dominant === 'bullish'
          ? '↑ Net bullish — more whale BTC leaving exchanges'
          : '↓ Net bearish — more whale BTC entering exchanges'}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WhaleWatchPage() {
  const router = useRouter();
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('all');
  const [chainFilter, setChainFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedTx, setSelectedTx]   = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('ll_auth') !== '1') {
      router.replace('/login');
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/whale');
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      setData(json);
      setLastUpdated(Date.now());
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 60_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const txns = data?.transactions ?? [];

  const filtered = txns.filter(tx => {
    const signalOk = filter === 'all' || filter === 'stables'
      ? true
      : filter === 'inflow'   ? tx.signal === 'inflow'
      : filter === 'outflow'  ? tx.signal === 'outflow'
      : tx.signal === 'transfer' || tx.signal === 'exchange';

    const stableOk = filter === 'stables'
      ? STABLES.has(tx.symbol)
      : filter === 'all' ? true : !STABLES.has(tx.symbol) || true; // show all

    const chainOk = chainFilter === 'all'
      ? true
      : chainFilter === 'btc'   ? tx.blockchain === 'bitcoin'
      : chainFilter === 'eth'   ? tx.blockchain === 'ethereum'
      : tx.blockchain !== 'bitcoin' && tx.blockchain !== 'ethereum';

    return signalOk && stableOk && chainOk;
  });

  const stats = data?.stats;
  const liqs  = data?.liquidations;

  // Chains present in data
  const hasEth = txns.some(t => t.blockchain === 'ethereum');
  const hasOther = txns.some(t => t.blockchain !== 'bitcoin' && t.blockchain !== 'ethereum');

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes txSlideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes whalePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes flowPulse {
          0%   { left: -60%; }
          100% { left: 160%; }
        }
        .ww-filter-btn { transition: all 0.15s ease; }
        .ww-filter-btn:hover { background: rgba(255,255,255,0.05) !important; }
      `}</style>

      {selectedTx && <TxModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}

      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(18px, 1.5vw, 30px)', minWidth: 0 }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'clamp(14px, 1.1vw, 24px)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <div style={{ fontSize: 'clamp(17px, 1.2vw, 24px)', fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.5 }}>
                Whale Watch
              </div>
              {data?.live && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, padding: '3px 10px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 5px var(--green)', animation: 'whalePulse 2s infinite' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)' }}>LIVE</span>
                </div>
              )}
              {data?.mock && (
                <div style={{ fontSize: 10, color: 'var(--purple)', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
                  Demo · Add WHALE_ALERT_KEY to .env.local for live data
                </div>
              )}
            </div>
            <div style={{ fontSize: 'clamp(11px, 0.62vw, 13px)', color: 'var(--muted3)' }}>
              Track large on-chain movements · Understand institutional sentiment · Updated every 60s
            </div>
          </div>
          {lastUpdated && (
            <div style={{ fontSize: 10, color: 'var(--muted4)', textAlign: 'right', flexShrink: 0 }}>
              Updated {timeAgo(lastUpdated)}
              <button onClick={fetchData} style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', color: 'var(--muted5)', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                ↻ Refresh
              </button>
            </div>
          )}
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div className="whale-stats" style={{ display: 'flex', gap: 'clamp(8px, 0.6vw, 12px)', marginBottom: 'clamp(12px, 0.9vw, 20px)' }}>
          <StatCard
            label="1H Volume Moved"
            value={stats ? formatUSD(stats.total_usd) : '—'}
            sub={stats ? `${txns.length} transactions above $500K` : null}
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            }
          />
          <StatCard
            label="Net Exchange Flow"
            value={stats
              ? Math.abs(stats.net_usd) < 50000
                ? 'Neutral'
                : stats.net_usd >= 0
                  ? `−${formatUSD(Math.abs(stats.net_usd))}`
                  : `+${formatUSD(Math.abs(stats.net_usd))}`
              : '—'}
            sub={stats
              ? Math.abs(stats.net_usd) < 50000
                ? 'Balanced exchange flow — no clear direction'
                : stats.net_usd >= 0
                  ? '↑ More leaving exchanges — bullish signal'
                  : '↓ More entering exchanges — bearish signal'
              : null}
            color={stats ? (Math.abs(stats.net_usd) < 50000 ? 'var(--muted)' : stats.net_usd >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--fg)'}
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            }
          />
          <StatCard
            label="Largest Move"
            value={stats?.largest ? formatUSD(stats.largest.amount_usd) : '—'}
            sub={stats?.largest
              ? `${stats.largest.symbol} · ${stats.largest.from.name} → ${stats.largest.to.name}`
              : null}
            color="var(--purple)"
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            }
          />
        </div>

        {/* ── Transaction feed ──────────────────────────────────────────────── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 'clamp(12px, 0.9vw, 18px)', overflow: 'hidden' }}>

          {/* Feed header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(10px, 0.75vw, 16px) clamp(14px, 1vw, 20px)', borderBottom: '1px solid var(--card2)', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'clamp(11px, 0.63vw, 13px)', fontWeight: 700, color: 'var(--fg)' }}>Large Transactions</span>
              <span style={{ fontSize: 10, color: 'var(--muted4)', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>
                {filtered.length} shown
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Chain filter */}
              <div style={{ display: 'flex', gap: 3, background: 'var(--bg3)', borderRadius: 7, padding: 3, border: '1px solid var(--card2)' }}>
                {[
                  { key: 'all', label: 'All chains' },
                  { key: 'btc', label: '₿ BTC' },
                  ...(hasEth ? [{ key: 'eth', label: 'Ξ ETH' }] : []),
                  ...(hasOther ? [{ key: 'other', label: 'Other' }] : []),
                ].map(f => (
                  <button key={f.key} className="ww-filter-btn"
                    onClick={() => setChainFilter(f.key)}
                    style={{
                      background: chainFilter === f.key ? 'var(--border)' : 'transparent',
                      border: `1px solid ${chainFilter === f.key ? 'var(--border2)' : 'transparent'}`,
                      borderRadius: 5, padding: '3px 8px',
                      fontSize: 'clamp(8px, 0.5vw, 10px)', fontWeight: chainFilter === f.key ? 700 : 400,
                      color: chainFilter === f.key ? 'var(--text)' : 'var(--muted3)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >{f.label}</button>
                ))}
              </div>

              {/* Signal filter */}
              <div style={{ display: 'flex', gap: 3 }}>
                {[
                  { key: 'all',      label: 'All' },
                  { key: 'outflow',  label: '↑ Out' },
                  { key: 'inflow',   label: '↓ In' },
                  { key: 'transfer', label: '⇄' },
                ].map(f => (
                  <button key={f.key} className="ww-filter-btn"
                    onClick={() => setFilter(f.key)}
                    style={{
                      background: filter === f.key ? 'rgba(168,85,247,0.15)' : 'transparent',
                      border: `1px solid ${filter === f.key ? 'rgba(168,85,247,0.35)' : 'transparent'}`,
                      borderRadius: 6, padding: '4px 9px',
                      fontSize: 'clamp(9px, 0.52vw, 11px)', fontWeight: filter === f.key ? 700 : 400,
                      color: filter === f.key ? 'var(--purple)' : 'var(--muted3)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >{f.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, padding: '7px clamp(14px,1vw,20px)', borderBottom: '1px solid var(--card)', background: 'var(--bg2)', flexWrap: 'wrap' }}>
            {[
              { color: '#22c55e', label: 'Outflow = Bullish — whales withdrawing, not selling' },
              { color: '#ef4444', label: 'Inflow = Bearish — whales depositing to sell' },
              { color: '#a855f7', label: 'Transfer = Neutral — intent unclear' },
            ].map(l => (
              <div key={l.color} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                <span style={{ fontSize: 'clamp(8px, 0.48vw, 10px)', color: 'var(--muted5)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Transactions list */}
          <div style={{ padding: 'clamp(6px, 0.5vw, 12px) clamp(8px, 0.7vw, 14px)', maxHeight: '40vh', overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted5)', fontSize: 13 }}>
                Loading whale data...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted5)', fontSize: 13 }}>
                No transactions match this filter
              </div>
            )}
            {!loading && filtered.map((tx, i) => (
              <TxRow key={tx.id} tx={tx} index={i} onSelect={setSelectedTx} />
            ))}
          </div>
        </div>

        {/* ── Bottom row ────────────────────────────────────────────────────── */}
        <div className="whale-bottom" style={{ display: 'grid', gap: 'clamp(8px, 0.6vw, 12px)' }}>

          {/* Liq summary */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 'clamp(14px, 1vw, 20px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 'clamp(11px, 0.63vw, 13px)', fontWeight: 700, color: 'var(--fg)' }}>Liquidations — 24H</span>
              <span style={{ fontSize: 10, color: 'var(--muted5)' }}>Leveraged positions wiped</span>
            </div>
            {liqs && (
              <>
                <div style={{ fontSize: 'clamp(17px, 1.2vw, 24px)', fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.5, marginBottom: 3 }}>
                  {formatUSD(liqs.total_usd)}
                </div>
                <div style={{ fontSize: 'clamp(10px, 0.57vw, 12px)', color: 'var(--muted3)', marginBottom: 14 }}>
                  Total liquidated across BTC &amp; ETH futures
                </div>
                <LiqBar longs={liqs.longs_usd} shorts={liqs.shorts_usd} />
                <LiqNarrative liqs={liqs} />
              </>
            )}
          </div>

          {/* Recent large liquidations */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 'clamp(14px, 1vw, 20px)' }}>
            <div style={{ fontSize: 'clamp(11px, 0.63vw, 13px)', fontWeight: 700, color: 'var(--fg)', marginBottom: 14 }}>
              Recent Large Wipes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {(liqs?.recent ?? []).map((liq, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 11px',
                  background: liq.side === 'Long' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${liq.side === 'Long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}`,
                  borderRadius: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{
                      fontSize: 'clamp(8px, 0.48vw, 10px)', fontWeight: 700,
                      color: liq.side === 'Long' ? 'var(--green)' : 'var(--red)',
                      background: liq.side === 'Long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${liq.side === 'Long' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      borderRadius: 4, padding: '2px 6px',
                    }}>
                      {liq.side.toUpperCase()} LIQ
                    </div>
                    <span style={{ fontSize: 'clamp(10px, 0.58vw, 12px)', color: 'var(--muted)', fontWeight: 600 }}>{liq.symbol}</span>
                    <span style={{ fontSize: 'clamp(9px, 0.5vw, 10px)', color: 'var(--muted5)' }}>{liq.exchange}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'clamp(11px, 0.63vw, 13px)', fontWeight: 700, color: 'var(--fg)' }}>
                      {formatUSD(liq.amount_usd)}
                    </div>
                    <div style={{ fontSize: 'clamp(9px, 0.48vw, 10px)', color: 'var(--muted5)', marginTop: 2 }}>
                      {liq.minsAgo}m ago
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
