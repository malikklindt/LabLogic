'use client';
import { useState, useEffect } from 'react';

function pnlColor(v) { return v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--muted3)'; }
function fmtPnl(v) {
  const abs = Math.abs(v);
  const str = abs >= 1000 ? '$' + abs.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '$' + abs.toFixed(2);
  return (v >= 0 ? '+' : '−') + str;
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: color ?? 'var(--fg)' }}>{value}</span>
    </div>
  );
}

export default function TradeSummaryCard() {
  const [trades, setTrades] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/journal')
      .then(r => r.json())
      .then(data => { setTrades(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setTrades([]); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="skeleton skel-line" style={{ width: '50%', marginBottom: 12 }} />
        <div className="skeleton skel-val" style={{ marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 'var(--gap)', marginBottom: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton skel-line" style={{ flex: 1 }} />)}
        </div>
        {[1,2,3,4].map(i => <div key={i} className="skeleton skel-line" style={{ marginBottom: 8, width: `${70 + i * 5}%` }} />)}
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 'var(--fs-md)', color: 'var(--muted3)' }}>No trades yet</span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted5)' }}>Add trades in the Journal</span>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter(t => t.date === today);
  const todayPnl    = todayTrades.reduce((s, t) => s + (t.pnlUsd ?? 0), 0);
  const todayWins   = todayTrades.filter(t => t.result === 'Win').length;

  const totalWins   = trades.filter(t => t.result === 'Win').length;
  const winRate     = trades.length > 0 ? Math.round((totalWins / trades.length) * 100) : 0;
  const totalPnl    = trades.reduce((s, t) => s + (t.pnlUsd ?? 0), 0);

  // Current streak from most recent trades
  let streak = 0;
  const streakType = trades[0]?.result;
  for (const t of trades) {
    if (t.result === streakType) streak++;
    else break;
  }
  const streakLabel = streak > 0
    ? `${streak}${streakType === 'Win' ? 'W' : 'L'}`
    : '—';
  const streakColor = streakType === 'Win' ? 'var(--green)' : 'var(--red)';

  const recent = trades.slice(0, 5);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--fg)' }}>Trade Summary</span>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted3)' }}>
          {todayTrades.length > 0 ? `${todayTrades.length} today` : 'No trades today'}
        </span>
      </div>

      {/* Today's P&L */}
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Today's P&L</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: pnlColor(todayPnl), lineHeight: 1 }}>
            {todayTrades.length > 0 ? fmtPnl(todayPnl) : '—'}
          </span>
          {todayTrades.length > 0 && (
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted3)' }}>
              {todayWins}W / {todayTrades.length - todayWins}L
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexShrink: 0, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 4px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Stat label="Win Rate" value={`${winRate}%`} color={winRate >= 50 ? 'var(--green)' : 'var(--red)'} />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', alignSelf: 'stretch' }} />
        <Stat label="All Trades" value={trades.length} />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', alignSelf: 'stretch' }} />
        <Stat label="Streak" value={streakLabel} color={streakColor} />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', alignSelf: 'stretch' }} />
        <Stat label="Total P&L" value={fmtPnl(totalPnl)} color={pnlColor(totalPnl)} />
      </div>

      {/* Recent trades */}
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, flexShrink: 0 }}>Recent Trades</div>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {recent.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{
                fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                background: t.direction === 'Long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: t.direction === 'Long' ? 'var(--green)' : 'var(--red)',
                border: `1px solid ${t.direction === 'Long' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}>{t.direction === 'Long' ? 'L' : 'S'}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.asset}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', flexShrink: 0 }}>{t.date?.slice(5)}</span>
            </div>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: pnlColor(t.pnlUsd ?? 0), flexShrink: 0 }}>
              {fmtPnl(t.pnlUsd ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
