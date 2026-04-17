'use client';
import { useState, useEffect, useRef } from 'react';
import { streamAI } from '@/lib/utils';
import * as store from '@/lib/journalStore';

// ── Helpers ────────────────────────────────────────────────────────────────────
const ASSETS   = ['BTC/USD','ETH/USD','SOL/USD','BNB/USD','XRP/USD','ADA/USD','AVAX/USD','DOT/USD','LINK/USD','Other'];
const fmt      = (n, dec=2) => n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtUsd   = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}$${fmt(Math.abs(n))}`;
const fmtPct   = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${fmt(n)}%`;
const pnlColor = (n) => n >= 0 ? 'var(--green)' : 'var(--red)';
const today    = () => new Date().toISOString().slice(0, 10);
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function calcRR(trade) {
  const ep = trade.entryPrice, tp = trade.takeProfit, sl = trade.stopLoss;
  if (!ep || !tp || !sl) return null;
  const reward = trade.direction === 'Long' ? tp - ep : ep - tp;
  const risk   = trade.direction === 'Long' ? ep - sl : sl - ep;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

// ── Advanced stat calculations ─────────────────────────────────────────────────
function calcStats(trades) {
  if (!trades.length) return {};
  const wins   = trades.filter(t => t.result === 'Win');
  const losses = trades.filter(t => t.result === 'Loss');
  const winRate   = wins.length / trades.length;
  const lossRate  = losses.length / trades.length;
  const totalWins = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));
  const avgWin    = wins.length   ? totalWins / wins.length   : 0;
  const avgLoss   = losses.length ? totalLoss / losses.length : 0;
  const profitFactor = totalLoss > 0 ? totalWins / totalLoss : null;
  const expectancy   = (winRate * avgWin) - (lossRate * avgLoss);
  const totalPnl     = trades.reduce((s, t) => s + t.pnlUsd, 0);

  // Streak — based on most recent trades ordered by date
  const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0, streakType = '';
  if (sorted.length) {
    streakType = sorted[0].result;
    for (const t of sorted) {
      if (t.result === streakType) streak++;
      else break;
    }
  }

  const rrs   = trades.map(t => calcRR(t)).filter(r => r != null);
  const avgRR = rrs.length ? rrs.reduce((s, r) => s + r, 0) / rrs.length : null;

  return { wins: wins.length, losses: losses.length, winRate, totalPnl, avgWin, avgLoss, profitFactor, expectancy, streak, streakType, totalWins, totalLoss, avgRR };
}

// ── StatBox ────────────────────────────────────────────────────────────────────
function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 'clamp(10px,0.73vw,20px) clamp(14px,1vw,24px)', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: color ?? 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Equity Curve ──────────────────────────────────────────────────────────────
function EquityCurve({ trades }) {
  const containerRef = useRef(null);
  const [W, setW] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (w > 0) setW(Math.floor(w));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (trades.length < 2) return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 16px' }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Equity Curve</div>
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>Log at least 2 trades to see your curve.</div>
    </div>
  );

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0, peak = 0, maxDDAbs = 0;
  const tradePts = sorted.map(t => {
    cum += (t.pnlUsd || 0);
    if (cum > peak) peak = cum;
    const ddAbs = cum - peak;
    if (ddAbs < maxDDAbs) maxDDAbs = ddAbs;
    return { y: cum, pk: peak, ddAbs };
  });
  // Always anchor to $0 at the left edge
  const pts = [{ y: 0, pk: 0, ddAbs: 0 }, ...tradePts];

  const finalPnl     = tradePts[tradePts.length - 1].y;
  const currentDDAbs = tradePts[tradePts.length - 1].ddAbs;
  const isPositive   = finalPnl >= 0;

  const H = 150, PAD = 8;
  const n = pts.length;
  const ys    = pts.map(p => p.y);
  const rawMin = Math.min(0, ...ys);
  const rawMax = Math.max(0, ...ys);
  const vPad   = Math.max((rawMax - rawMin) * 0.14, 8);
  const minY   = rawMin - vPad;
  const maxY   = rawMax + vPad;
  const range  = (maxY - minY) || 1;

  // sx/sy use actual pixel W — no viewBox scaling needed
  const sx = i => PAD + (i / Math.max(n - 1, 1)) * (W - PAD * 2);
  const sy = y => H - PAD - ((y - minY) / range) * (H - PAD * 2);
  const zY = sy(0);

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  // Extend fill to the very bottom of the SVG so the gradient dissolves naturally
  const fillPath = linePath + `L${sx(n-1).toFixed(1)},${H}L${sx(0).toFixed(1)},${H}Z`;
  const peakPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.pk).toFixed(1)}`).join('');
  const ddPath   = peakPath + [...pts].reverse().map((p, ri) => `L${sx(n-1-ri).toFixed(1)},${sy(p.y).toFixed(1)}`).join('') + 'Z';

  const lineClr = isPositive ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 16px 12px' }}>
      {/* Header + metrics */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Equity Curve</span>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'Net PnL',    val: fmtUsd(finalPnl),                                    color: isPositive ? 'var(--green)' : 'var(--red)' },
            { label: 'Max DD',     val: maxDDAbs < 0 ? fmtUsd(maxDDAbs) : '$0.00',           color: maxDDAbs < -0.01 ? 'var(--red)' : 'var(--muted)' },
            { label: 'Current DD', val: currentDDAbs < 0 ? fmtUsd(currentDDAbs) : 'At peak', color: currentDDAbs < -0.01 ? 'var(--red)' : 'var(--green)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Measured container — SVG renders at true pixel width, zero distortion */}
      <div ref={containerRef} style={{ width: '100%' }}>
        <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lineClr} stopOpacity="0.28" />
              <stop offset="55%"  stopColor={lineClr} stopOpacity="0.10" />
              <stop offset="100%" stopColor={lineClr} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Subtle grid lines */}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={PAD} y1={PAD + f * (H - PAD * 2)} x2={W - PAD} y2={PAD + f * (H - PAD * 2)}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
          {/* Zero baseline */}
          <line x1={PAD} y1={zY} x2={W - PAD} y2={zY}
            stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4,4" />
          {/* Drawdown zone */}
          <path d={ddPath} fill="rgba(239,68,68,0.08)" />
          {/* Equity fill */}
          <path d={fillPath} fill="url(#eqGrad)" />
          {/* Equity line */}
          <path d={linePath} fill="none" stroke={lineClr} strokeWidth={1.5}
            style={{ filter: `drop-shadow(0 0 3px ${lineClr}66)` }} />
          {/* End dot */}
          <circle cx={sx(n - 1)} cy={sy(pts[n - 1].y)} r={4} fill={lineClr}
            style={{ filter: `drop-shadow(0 0 5px ${lineClr})` }} />
        </svg>
      </div>
    </div>
  );
}

// ── Day-of-Week Chart ──────────────────────────────────────────────────────────
function DayOfWeekChart({ trades }) {
  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  // UTC day: Sun=0 Mon=1 … Sat=6 → remap to Mon-first
  const byDay = DAY_LABELS.map((label, i) => {
    const utcDay = (i + 1) % 7; // Mon=1…Sun=0
    const dayTrades = trades.filter(t => new Date(t.date + 'T12:00:00Z').getUTCDay() === utcDay);
    const total = dayTrades.reduce((s, t) => s + (t.pnlUsd || 0), 0);
    const avg   = dayTrades.length ? total / dayTrades.length : 0;
    const wins  = dayTrades.filter(t => t.result === 'Win').length;
    const wr    = dayTrades.length ? (wins / dayTrades.length) * 100 : null;
    return { label, avg, count: dayTrades.length, wr };
  });

  const maxAbs = Math.max(...byDay.map(d => Math.abs(d.avg)), 1);
  const BAR_H  = 72; // fixed pixel height of the bar zone
  const LABEL_H = 52; // space below bars for labels

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 16px 12px' }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Avg PnL by Day</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        {byDay.map(({ label, avg, count, wr }) => {
          const isPos = avg >= 0;
          const barH  = count > 0 ? Math.max(4, (Math.abs(avg) / maxAbs) * BAR_H) : 0;
          const clr   = isPos ? 'var(--green)' : 'var(--red)';
          return (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* PnL value label above bar */}
              <div style={{ height: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: count > 0 ? clr : 'transparent', whiteSpace: 'nowrap' }}>
                  {count > 0 ? (isPos ? '+' : '') + avg.toFixed(0) : ''}
                </span>
              </div>
              {/* Fixed-height bar zone — bar sits at bottom */}
              <div style={{ height: BAR_H, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{
                  width: '52%',
                  height: barH,
                  borderRadius: '4px 4px 0 0',
                  background: count > 0 ? clr : 'rgba(255,255,255,0.04)',
                  boxShadow: count > 0 ? `0 0 8px ${clr}55` : 'none',
                  transition: 'height 0.35s ease',
                }} />
              </div>
              {/* Baseline */}
              <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.12)' }} />
              {/* Day label */}
              <div style={{ fontSize: 10, fontWeight: 600, color: count > 0 ? 'var(--fg)' : 'var(--muted)', marginTop: 5 }}>{label}</div>
              {/* Trade count */}
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                {count > 0 ? `${count}t` : '—'}
              </div>
              {/* Win rate */}
              {wr !== null && (
                <div style={{ fontSize: 9, color: wr >= 50 ? 'var(--green)' : 'var(--red)', fontWeight: 600, marginTop: 1 }}>
                  {wr.toFixed(0)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendar View ──────────────────────────────────────────────────────────────
function CalendarView({ trades, onDayClick }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Group trades by date string
  const byDate = {};
  trades.forEach(t => {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  });

  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const firstWeekday  = new Date(year, month, 1).getDay();
  const todayStr      = new Date().toISOString().slice(0, 10);

  // Build calendar cells
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayTrades = byDate[dateStr] || [];
    const dayPnl    = dayTrades.reduce((s, t) => s + t.pnlUsd, 0);
    cells.push({ day: d, dateStr, trades: dayTrades, pnl: dayPnl });
  }

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const maxAbsPnl = Math.max(...Object.values(byDate).map(ts => Math.abs(ts.reduce((s, t) => s + t.pnlUsd, 0))), 1);

  return (
    <div>
      {/* Calendar header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prevMonth} className="btn-icon" style={{ background: 'var(--card2)', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>‹</button>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--fg)' }}>{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} className="btn-icon" style={{ background: 'var(--card2)', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>›</button>
      </div>

      {/* Day headers + WEEK label */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) clamp(60px,5vw,90px)', gap: 4, marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0' }}>{d}</div>
        ))}
        <div style={{ textAlign: 'center', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0' }}>Week</div>
      </div>

      {/* Calendar grid rows */}
      {weeks.map((week, wi) => {
        const weekTrades = week.filter(Boolean).flatMap(c => c?.trades ?? []);
        const weekPnl    = weekTrades.reduce((s, t) => s + t.pnlUsd, 0);
        const weekCount  = weekTrades.length;

        return (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) clamp(60px,5vw,90px)', gap: 4, marginBottom: 4 }}>
            {week.map((cell, ci) => {
              if (!cell) return <div key={ci} style={{ borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', minHeight: 'clamp(54px,5vw,90px)' }} />;

              const hasData   = cell.trades.length > 0;
              const isToday   = cell.dateStr === todayStr;
              const intensity = hasData ? Math.min(Math.abs(cell.pnl) / maxAbsPnl, 1) : 0;
              const bgColor   = !hasData ? 'var(--card2)'
                : cell.pnl >= 0
                  ? `rgba(34,197,94,${0.07 + intensity * 0.18})`
                  : `rgba(239,68,68,${0.07 + intensity * 0.18})`;
              const borderColor = !hasData ? 'var(--border2)'
                : cell.pnl >= 0 ? `rgba(34,197,94,${0.2 + intensity * 0.4})`
                : `rgba(239,68,68,${0.2 + intensity * 0.4})`;

              return (
                <div key={ci}
                  onClick={() => hasData && onDayClick(cell.dateStr, cell.trades)}
                  className={`cal-cell${hasData ? ' cal-cell-data' : ''}`}
                  style={{
                    background: bgColor,
                    border: `1px solid ${isToday ? 'rgba(168,85,247,0.6)' : borderColor}`,
                    borderRadius: 8,
                    padding: 'clamp(5px,0.4vw,10px)',
                    minHeight: 'clamp(54px,5vw,90px)',
                    cursor: hasData ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column',
                  }}>
                  {/* Date number */}
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--purple)' : 'var(--muted)', marginBottom: 4 }}>{cell.day}</div>
                  {hasData && (
                    <>
                      <div style={{ fontSize: 'clamp(9px,0.6vw,13px)', fontWeight: 800, color: cell.pnl >= 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1.2, marginTop: 'auto' }}>
                        {fmtUsd(cell.pnl)}
                      </div>
                      <div style={{ fontSize: 'clamp(8px,0.47vw,11px)', color: 'var(--muted)', marginTop: 2 }}>
                        {cell.trades.length} trade{cell.trades.length !== 1 ? 's' : ''}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Week summary */}
            <div style={{
              background: weekCount > 0 ? (weekPnl >= 0 ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)') : 'rgba(255,255,255,0.01)',
              border: `1px solid ${weekCount > 0 ? (weekPnl >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.03)'}`,
              borderRadius: 8, minHeight: 'clamp(54px,5vw,90px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6,
            }}>
              {weekCount > 0 && (
                <>
                  <div style={{ fontSize: 'clamp(9px,0.6vw,13px)', fontWeight: 800, color: weekPnl >= 0 ? 'var(--green)' : 'var(--red)', textAlign: 'center', lineHeight: 1.3 }}>{fmtUsd(weekPnl)}</div>
                  <div style={{ fontSize: 'clamp(7px,0.42vw,11px)', color: 'var(--muted)', marginTop: 2 }}>{weekCount}t</div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Drawer Trade Card (with AI Review) ────────────────────────────────────────
function DrawerTradeCard({ trade, onEdit, onDelete, onCloseDrawer }) {
  const [aiOpen,  setAiOpen]  = useState(false);
  const [aiState, setAiState] = useState('idle');
  const [aiText,  setAiText]  = useState('');
  const textRef = useRef('');
  const rr = calcRR(trade);

  function runAI() {
    if (aiState === 'loading' || aiState === 'streaming') return;
    setAiOpen(true); setAiState('loading'); setAiText(''); textRef.current = '';
    const system = `You are an elite trading coach reviewing a single completed trade. Be direct and specific. Reference the exact numbers provided. Give 2-3 sentences max: one on what was done well (or nothing if nothing was), one on the key mistake or risk management issue, and one concrete actionable fix for next time.`;
    const content = `Trade: ${trade.direction} ${trade.asset} on ${trade.date}
Entry: $${trade.entryPrice} | Take Profit: ${trade.takeProfit ? '$'+trade.takeProfit : 'Not set'} | Stop Loss: ${trade.stopLoss ? '$'+trade.stopLoss : 'Not set'}
R:R Ratio: ${rr != null ? rr.toFixed(2)+'R' : 'Not calculated (missing TP/SL)'}
Position size: $${trade.size} | PnL: ${fmtUsd(trade.pnlUsd)} (${fmtPct(trade.pnlPct)}) → ${trade.result}
Strategy: ${trade.strategy || 'Not tagged'}
Trader notes: "${trade.notes || 'None'}"

${!trade.stopLoss ? 'Note: No stop loss was set on this trade.\n' : ''}${!trade.strategy ? 'Note: No strategy was tagged.\n' : ''}Review this trade in 2-3 sentences.`;
    streamAI({ system, messages: [{ role: 'user', content }], max_tokens: 150 },
      chunk => { textRef.current += chunk; setAiText(textRef.current); setAiState('streaming'); },
      () => setAiState('done'), () => setAiState('error'));
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 'var(--fs-sm)', color: 'var(--fg)' }}>{trade.asset}</span>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: trade.direction === 'Long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: trade.direction === 'Long' ? 'var(--green)' : 'var(--red)', border: `1px solid ${trade.direction === 'Long' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>{trade.direction}</span>
        {trade.strategy && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 20, background: 'var(--card2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>{trade.strategy}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', fontWeight: 800, color: pnlColor(trade.pnlUsd) }}>{fmtUsd(trade.pnlUsd)}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: trade.notes ? 10 : 0 }}>
        {[
          { l: 'Entry',  v: `$${fmt(trade.entryPrice)}` },
          trade.takeProfit ? { l: 'TP', v: `$${fmt(trade.takeProfit)}`, c: 'var(--green)' } : null,
          trade.stopLoss   ? { l: 'SL', v: `$${fmt(trade.stopLoss)}`,   c: 'var(--red)'   } : null,
          { l: 'Size',   v: `$${fmt(trade.size)}` },
          { l: 'PnL %',  v: fmtPct(trade.pnlPct), c: pnlColor(trade.pnlPct) },
          rr != null ? { l: 'R:R', v: rr.toFixed(2), c: 'var(--purple)' } : null,
        ].filter(Boolean).map(m => (
          <div key={m.l}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 1 }}>{m.l}</div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: m.c ?? 'var(--text)' }}>{m.v}</div>
          </div>
        ))}
      </div>
      {trade.notes && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', lineHeight: 1.6, padding: '7px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, borderLeft: '2px solid var(--border2)', marginBottom: 10 }}>{trade.notes}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={runAI} className="ai-badge" style={{ cursor: 'pointer', border: '1px solid rgba(168,85,247,0.28)', background: aiOpen ? 'rgba(168,85,247,0.18)' : 'rgba(168,85,247,0.08)', fontFamily: 'Inter', transition: 'background 0.15s' }}>🤖 AI Review</button>
        <button onClick={() => { onEdit(trade); onCloseDrawer(); }} className="btn-ghost" style={{ padding: '3px 12px', borderRadius: 20, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>Edit</button>
        <button onClick={() => { onDelete(trade); onCloseDrawer(); }} className="btn-danger" style={{ padding: '3px 12px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>Delete</button>
      </div>
      {aiOpen && (
        <div className="ai-panel" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="ai-badge" style={{ fontSize: 'var(--fs-xs)' }}>🤖 AI Review</div>
            <button onClick={() => setAiOpen(false)} className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
          {aiState === 'loading' && <div className="ai-loading"><div className="ai-loading-dot"/><div className="ai-loading-dot"/><div className="ai-loading-dot"/> Analyzing trade…</div>}
          {(aiState === 'streaming' || aiState === 'done') && <p className="ai-txt">{aiText}</p>}
          {aiState === 'error' && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-sm)' }}>Unable to load review.</p>}
          {aiState === 'done' && <button className="ai-retry btn-ghost" onClick={runAI} style={{ marginTop: 10 }}>↺ Re-analyze</button>}
        </div>
      )}
    </div>
  );
}

// ── Day Detail Drawer ──────────────────────────────────────────────────────────
function DayDrawer({ dateStr, trades, onClose, onEdit, onDelete }) {
  const dayPnl   = trades.reduce((s, t) => s + t.pnlUsd, 0);
  const dayWins  = trades.filter(t => t.result === 'Win').length;
  const [closing, setClosing] = useState(false);
  const handleClose = () => { setClosing(true); setTimeout(onClose, 200); };

  return (
    <div className={closing ? 'overlay-exit' : 'overlay-enter'} style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }} onClick={handleClose}>
      <div style={{ flex: 1 }} />
      <div onClick={e => e.stopPropagation()}
        className={closing ? 'drawer-exit' : 'drawer-enter'}
        style={{ width: 'min(420px, 92vw)', background: 'linear-gradient(160deg, rgba(255,255,255,0.02) 0%, transparent 40%), #09090f', borderLeft: '1px solid var(--border2)', height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.7), -1px 0 0 rgba(168,85,247,0.08)' }}>
        {/* Header */}
        <div style={{ padding: 'clamp(16px,1.2vw,28px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--fg)' }}>{dateStr}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: dayPnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: 2 }}>{fmtUsd(dayPnl)} · {dayWins}/{trades.length} wins</div>
          </div>
          <button onClick={handleClose} className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {/* Trades */}
        <div style={{ padding: 'clamp(12px,1vw,24px)', flex: 1 }}>
          {trades.map(t => (
            <DrawerTradeCard key={t.id} trade={t} onEdit={onEdit} onDelete={onDelete} onCloseDrawer={handleClose} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Log Trade Modal ────────────────────────────────────────────────────────────
function TradeModal({ initial, strategies, onSave, onClose, onAddStrategy }) {
  const blank = { asset: 'BTC/USD', direction: 'Long', entryPrice: '', pnlUsd: '', size: '', date: today(), strategy: '', notes: '', takeProfit: '', stopLoss: '' };
  const [form,        setForm]        = useState(initial ? { ...blank, ...initial, pnlUsd: initial.pnlUsd ?? '', takeProfit: initial.takeProfit ?? '', stopLoss: initial.stopLoss ?? '' } : blank);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState('');
  const [addingStrat, setAddingStrat] = useState(false);
  const [newStrat,    setNewStrat]    = useState('');
  const [savingStrat, setSavingStrat] = useState(false);
  const [closing,     setClosing]     = useState(false);
  const handleClose = () => { setClosing(true); setTimeout(onClose, 200); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const preview = (() => {
    const ep = parseFloat(form.entryPrice), pnl = parseFloat(form.pnlUsd), sz = parseFloat(form.size);
    const tp = parseFloat(form.takeProfit), sl = parseFloat(form.stopLoss);
    let rr = null;
    if (tp && sl && ep) {
      const reward = form.direction === 'Long' ? tp - ep : ep - tp;
      const risk   = form.direction === 'Long' ? ep - sl : sl - ep;
      if (risk > 0 && reward > 0) rr = reward / risk;
    }
    if (!pnl) return rr != null ? { pct: null, usd: null, rr } : null;
    const pct = sz ? (pnl / sz) * 100 : null;
    return { pct, usd: pnl, rr };
  })();

  async function handleAddStrategy() {
    const name = newStrat.trim();
    if (!name) return;
    setSavingStrat(true);
    await onAddStrategy(name);
    set('strategy', name);
    setNewStrat(''); setAddingStrat(false); setSavingStrat(false);
  }

  async function submit(e) {
    e.preventDefault();
    const ep = parseFloat(form.entryPrice), pnl = parseFloat(form.pnlUsd), sz = parseFloat(form.size);
    if (!form.asset)    return setErr('Asset required.');
    if (!ep || ep <= 0) return setErr('Enter a valid entry price.');
    if (isNaN(pnl))     return setErr('Enter your PnL.');
    if (!sz || sz <= 0) return setErr('Enter a valid position size.');
    setErr(''); setSaving(true);
    await onSave({ ...form, entryPrice: ep, pnlUsd: pnl, size: sz });
    setSaving(false);
  }

  const inp = { background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 'var(--fs-sm)', padding: '8px 12px', fontFamily: 'Inter, sans-serif', outline: 'none', width: '100%' };
  const lbl = { fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5, display: 'block' };
  const opt = { fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted2)', fontSize: 11 };

  return (
    <div className={closing ? 'overlay-exit' : 'overlay-enter'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={handleClose}>
      <div className={closing ? 'modal-exit' : 'modal-enter'} onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, transparent 50%), #0d0d1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, width: '100%', maxWidth: 540, padding: 'clamp(18px,1.5vw,32px)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.08), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--fg)' }}>{initial ? 'Edit Trade' : 'Log Trade'}</div>
          <button onClick={handleClose} className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Asset</label>
              <select value={form.asset} onChange={e => set('asset', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Direction</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Long','Short'].map(d => (
                  <button key={d} type="button" onClick={() => set('direction', d)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-sm)', fontFamily: 'Inter', border: form.direction === d ? 'none' : '1px solid var(--border2)', background: form.direction === d ? (d === 'Long' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'var(--card2)', color: form.direction === d ? (d === 'Long' ? 'var(--green)' : 'var(--red)') : 'var(--muted)' }}>{d}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Entry Price ($)</label><input type="number" step="any" min="0" placeholder="e.g. 67000" value={form.entryPrice} onChange={e => set('entryPrice', e.target.value)} style={inp} /></div>
            <div>
              <label style={lbl}>PnL ($) <span style={opt}>+/− realized</span></label>
              <input type="number" step="any" placeholder="e.g. 320 or −150" value={form.pnlUsd} onChange={e => set('pnlUsd', e.target.value)} style={{ ...inp, color: parseFloat(form.pnlUsd) >= 0 && form.pnlUsd !== '' ? 'var(--green)' : parseFloat(form.pnlUsd) < 0 ? 'var(--red)' : 'var(--text)' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Take Profit ($) <span style={opt}>optional</span></label>
              <input type="number" step="any" min="0" placeholder="e.g. 72000" value={form.takeProfit} onChange={e => set('takeProfit', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Stop Loss ($) <span style={opt}>optional</span></label>
              <input type="number" step="any" min="0" placeholder="e.g. 65000" value={form.stopLoss} onChange={e => set('stopLoss', e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Position Size ($)</label><input type="number" step="any" min="0" placeholder="e.g. 5000" value={form.size} onChange={e => set('size', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Date Closed</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} /></div>
          </div>
          <div>
            <label style={lbl}>Strategy / Tag</label>
            {!addingStrat ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.strategy} onChange={e => set('strategy', e.target.value)} style={{ ...inp, cursor: 'pointer', flex: 1 }}>
                  <option value="">— Select —</option>
                  {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => setAddingStrat(true)} className="btn-ghost" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--card2)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-xs)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>+ Add</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input autoFocus type="text" placeholder="e.g. ICT, SMC, VWAP…" value={newStrat}
                  onChange={e => setNewStrat(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStrategy(); } if (e.key === 'Escape') { setAddingStrat(false); setNewStrat(''); } }}
                  style={{ ...inp, flex: 1 }} />
                <button type="button" onClick={handleAddStrategy} disabled={savingStrat || !newStrat.trim()} className="btn-primary" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.15)', color: 'var(--purple)', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-xs)', fontWeight: 700, flexShrink: 0 }}>{savingStrat ? '…' : 'Save'}</button>
                <button type="button" onClick={() => { setAddingStrat(false); setNewStrat(''); }} className="btn-ghost" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13 }}>×</button>
              </div>
            )}
          </div>
          <div>
            <label style={lbl}>Notes / Reasoning</label>
            <textarea rows={3} placeholder="Why did you enter? What was your thesis? What went wrong or right?" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          {preview && (
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preview</span>
              {preview.usd != null && <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: pnlColor(preview.usd) }}>{fmtUsd(preview.usd)}</span>}
              {preview.pct != null && <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: pnlColor(preview.pct) }}>{fmtPct(preview.pct)}</span>}
              {preview.rr != null && <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--purple)' }}>R:R {preview.rr.toFixed(2)}</span>}
              {preview.usd != null && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginLeft: 'auto' }}>{preview.usd >= 0 ? 'Win' : 'Loss'}</span>}
            </div>
          )}
          {err && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{err}</div>}
          <button type="submit" disabled={saving} className="btn-primary" style={{ background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 10, color: 'var(--purple)', fontWeight: 700, fontSize: 'var(--fs-sm)', padding: '11px 0', cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter', marginTop: 4 }}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Log Trade'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────
function DeleteConfirm({ trade, onConfirm, onCancel }) {
  const [closing, setClosing] = useState(false);
  const handleCancel = () => { setClosing(true); setTimeout(onCancel, 200); };
  return (
    <div className={closing ? 'overlay-exit' : 'overlay-enter'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleCancel}>
      <div className={closing ? 'modal-exit' : 'modal-enter'} onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, transparent 50%), #0d0d1a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: 28, maxWidth: 360, textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--fg)', marginBottom: 10 }}>Delete Trade?</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: 22, lineHeight: 1.6 }}>{trade.direction} {trade.asset} on {trade.date} — this cannot be undone.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={handleCancel} className="btn-ghost" style={{ padding: '8px 22px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--card2)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Cancel</button>
          <button onClick={onConfirm} className="btn-danger" style={{ padding: '8px 22px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.15)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Trade Card (List view) ─────────────────────────────────────────────────────
function TradeCard({ trade, onEdit, onDelete }) {
  const [aiOpen,  setAiOpen]  = useState(false);
  const [aiState, setAiState] = useState('idle');
  const [aiText,  setAiText]  = useState('');
  const textRef = useRef('');
  const rr = calcRR(trade);

  function runAI() {
    if (aiState === 'loading' || aiState === 'streaming') return;
    setAiOpen(true); setAiState('loading'); setAiText(''); textRef.current = '';
    const system = `You are an elite trading coach reviewing a single completed trade. Be direct and specific. Reference the exact numbers provided. Give 2-3 sentences max: one on what was done well (or nothing if nothing was), one on the key mistake or risk management issue, and one concrete actionable fix for next time.`;
    const content = `Trade: ${trade.direction} ${trade.asset} on ${trade.date}
Entry: $${trade.entryPrice} | Take Profit: ${trade.takeProfit ? '$'+trade.takeProfit : 'Not set'} | Stop Loss: ${trade.stopLoss ? '$'+trade.stopLoss : 'Not set'}
R:R Ratio: ${rr != null ? rr.toFixed(2)+'R' : 'Not calculated (missing TP/SL)'}
Position size: $${trade.size} | PnL: ${fmtUsd(trade.pnlUsd)} (${fmtPct(trade.pnlPct)}) → ${trade.result}
Strategy: ${trade.strategy || 'Not tagged'}
Trader notes: "${trade.notes || 'None'}"

${!trade.stopLoss ? 'Note: No stop loss was set on this trade.\n' : ''}${!trade.strategy ? 'Note: No strategy was tagged.\n' : ''}Review this trade in 2-3 sentences.`;
    streamAI({ system, messages: [{ role: 'user', content }], max_tokens: 150 },
      chunk => { textRef.current += chunk; setAiText(textRef.current); setAiState('streaming'); },
      () => setAiState('done'), () => setAiState('error'));
  }

  const dirColor = trade.direction === 'Long' ? 'var(--green)' : 'var(--red)';
  const dirBg    = trade.direction === 'Long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';

  return (
    <div className="trade-card" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'clamp(12px,0.83vw,22px) clamp(14px,1vw,26px)', marginBottom: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--fg)' }}>{trade.asset}</span>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: dirBg, color: dirColor, border: `1px solid ${dirColor}40` }}>{trade.direction}</span>
        {trade.strategy && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: 'var(--card2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>{trade.strategy}</span>}
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted2)', marginLeft: 'auto' }}>{trade.date}</span>
      </div>
      <div style={{ display: 'flex', gap: 'clamp(14px,1.1vw,28px)', flexWrap: 'wrap', marginBottom: 12, alignItems: 'flex-end' }}>
        {[
          { label: 'Entry',       val: `$${fmt(trade.entryPrice)}` },
          trade.takeProfit ? { label: 'Take Profit', val: `$${fmt(trade.takeProfit)}`, color: 'var(--green)' } : null,
          trade.stopLoss   ? { label: 'Stop Loss',   val: `$${fmt(trade.stopLoss)}`,   color: 'var(--red)'   } : null,
          { label: 'Size',        val: `$${fmt(trade.size)}` },
          { label: 'PnL $',       val: fmtUsd(trade.pnlUsd), color: pnlColor(trade.pnlUsd) },
          { label: 'PnL %',       val: fmtPct(trade.pnlPct), color: pnlColor(trade.pnlPct) },
          rr != null ? { label: 'R:R', val: rr.toFixed(2), color: 'var(--purple)' } : null,
        ].filter(Boolean).map(m => (
          <div key={m.label}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: m.color ?? 'var(--text)' }}>{m.val}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '3px 12px', borderRadius: 20, letterSpacing: '0.5px', background: trade.result === 'Win' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: trade.result === 'Win' ? 'var(--green)' : 'var(--red)', border: `1px solid ${trade.result === 'Win' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>{trade.result}</span>
        </div>
      </div>
      {trade.notes && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: 1.65, marginBottom: 12, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, borderLeft: '2px solid var(--border2)' }}>{trade.notes}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={runAI} className="ai-badge" style={{ cursor: 'pointer', border: '1px solid rgba(168,85,247,0.28)', background: aiOpen ? 'rgba(168,85,247,0.18)' : 'rgba(168,85,247,0.08)', fontFamily: 'Inter', transition: 'background 0.15s' }}>🤖 AI Review</button>
        <button onClick={() => onEdit(trade)} className="btn-ghost" style={{ padding: '4px 14px', borderRadius: 20, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>Edit</button>
        <button onClick={() => onDelete(trade)} className="btn-danger" style={{ padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>Delete</button>
      </div>
      {aiOpen && (
        <div className="ai-panel" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="ai-badge" style={{ fontSize: 'var(--fs-xs)' }}>🤖 AI Review</div>
            <button onClick={() => setAiOpen(false)} className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
          {aiState === 'loading' && <div className="ai-loading"><div className="ai-loading-dot"/><div className="ai-loading-dot"/><div className="ai-loading-dot"/> Analyzing trade…</div>}
          {(aiState === 'streaming' || aiState === 'done') && <p className="ai-txt">{aiText}</p>}
          {aiState === 'error' && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-sm)' }}>Unable to load review.</p>}
          {aiState === 'done' && <button className="ai-retry btn-ghost" onClick={runAI} style={{ marginTop: 10 }}>↺ Re-analyze</button>}
        </div>
      )}
    </div>
  );
}

// ── Plan Modal ─────────────────────────────────────────────────────────────────
const TIMEFRAMES = ['1m','5m','15m','1H','4H','Daily','Weekly'];

function PlanModal({ initial, strategies, onSave, onClose }) {
  const blank = { asset: 'BTC/USD', direction: 'Long', entryTarget: '', takeProfit: '', stopLoss: '', strategy: '', timeframe: '', thesis: '', riskAmount: '', date: today() };
  const [form, setForm] = useState(initial ? { ...blank, ...initial, entryTarget: initial.entryTarget ?? '', takeProfit: initial.takeProfit ?? '', stopLoss: initial.stopLoss ?? '', riskAmount: initial.riskAmount ?? '' } : blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [closing, setClosing] = useState(false);
  const handleClose = () => { setClosing(true); setTimeout(onClose, 200); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Live R:R preview
  const rrPreview = (() => {
    const ep = parseFloat(form.entryTarget), tp = parseFloat(form.takeProfit), sl = parseFloat(form.stopLoss);
    if (!ep || !tp || !sl) return null;
    const reward = form.direction === 'Long' ? tp - ep : ep - tp;
    const risk   = form.direction === 'Long' ? ep - sl : sl - ep;
    if (risk <= 0 || reward <= 0) return null;
    return (reward / risk).toFixed(2);
  })();

  async function submit(e) {
    e.preventDefault();
    if (!form.asset) return setErr('Asset required.');
    if (!form.thesis.trim()) return setErr('Add your thesis — why are you taking this trade?');
    setErr(''); setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const inp = { background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 'var(--fs-sm)', padding: '8px 12px', fontFamily: 'Inter, sans-serif', outline: 'none', width: '100%' };
  const lbl = { fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5, display: 'block' };
  const opt = { fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted2)', fontSize: 11 };

  return (
    <div className={closing ? 'overlay-exit' : 'overlay-enter'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={handleClose}>
      <div className={closing ? 'modal-exit' : 'modal-enter'} onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, transparent 50%), #0d0d1a', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 18, width: '100%', maxWidth: 540, padding: 'clamp(18px,1.5vw,32px)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--fg)' }}>{initial ? 'Edit Plan' : 'Plan a Trade'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Define your setup before entering</div>
          </div>
          <button onClick={handleClose} className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Asset</label>
              <select value={form.asset} onChange={e => set('asset', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Direction</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Long','Short'].map(d => (
                  <button key={d} type="button" onClick={() => set('direction', d)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-sm)', fontFamily: 'Inter', border: form.direction === d ? 'none' : '1px solid var(--border2)', background: form.direction === d ? (d === 'Long' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'var(--card2)', color: form.direction === d ? (d === 'Long' ? 'var(--green)' : 'var(--red)') : 'var(--muted)' }}>{d}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Entry Target <span style={opt}>optional</span></label><input type="number" step="any" placeholder="e.g. 67000" value={form.entryTarget} onChange={e => set('entryTarget', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Take Profit <span style={opt}>optional</span></label><input type="number" step="any" placeholder="e.g. 72000" value={form.takeProfit} onChange={e => set('takeProfit', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Stop Loss <span style={opt}>optional</span></label><input type="number" step="any" placeholder="e.g. 65000" value={form.stopLoss} onChange={e => set('stopLoss', e.target.value)} style={inp} /></div>
          </div>
          {rrPreview && (
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--indigo)', fontWeight: 700 }}>
              Planned R:R — {rrPreview}R
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Strategy <span style={opt}>optional</span></label>
              <select value={form.strategy} onChange={e => set('strategy', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">— Select —</option>
                {strategies.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Timeframe <span style={opt}>optional</span></label>
              <select value={form.timeframe} onChange={e => set('timeframe', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">— Select —</option>
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Risk ($) <span style={opt}>optional</span></label>
              <input type="number" step="any" placeholder="e.g. 200" value={form.riskAmount} onChange={e => set('riskAmount', e.target.value)} style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Thesis <span style={{ color: 'var(--red)', fontWeight: 800 }}>*</span></label>
            <textarea rows={4} placeholder="Why are you taking this trade? What's your setup, confluence, and what would invalidate it?" value={form.thesis} onChange={e => set('thesis', e.target.value)} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div><label style={lbl}>Planned Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} /></div>
          {err && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{err}</div>}
          <button type="submit" disabled={saving} className="btn-primary" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10, color: 'var(--indigo)', fontWeight: 700, fontSize: 'var(--fs-sm)', padding: '11px 0', cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter', marginTop: 4 }}>
            {saving ? 'Saving…' : initial ? 'Update Plan' : 'Save Plan'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Plan Card ──────────────────────────────────────────────────────────────────
function PlanCard({ plan, trades, onEdit, onDelete, onStatusChange }) {
  const [aiOpen,  setAiOpen]  = useState(false);
  const [aiState, setAiState] = useState('idle');
  const [aiText,  setAiText]  = useState('');
  const textRef = useRef('');

  const linkedTrade = plan.linkedTradeId ? trades.find(t => t.id === plan.linkedTradeId) : null;

  // R:R preview
  const rrPreview = (() => {
    const ep = plan.entryTarget, tp = plan.takeProfit, sl = plan.stopLoss;
    if (!ep || !tp || !sl) return null;
    const reward = plan.direction === 'Long' ? tp - ep : ep - tp;
    const risk   = plan.direction === 'Long' ? ep - sl : sl - ep;
    if (risk <= 0 || reward <= 0) return null;
    return (reward / risk).toFixed(2);
  })();

  function runAI() {
    if (aiState === 'loading' || aiState === 'streaming') return;
    setAiOpen(true); setAiState('loading'); setAiText(''); textRef.current = '';
    const system = `You are an elite trading coach. ${linkedTrade ? 'Compare the trader\'s pre-trade plan against what actually happened. Be specific — did they follow the plan? Was the thesis correct? What should they learn?' : 'Review this pre-trade plan for quality. Is the thesis clear? Is the risk defined? Is there a logical edge? Give direct, actionable feedback in 3 sentences.'}`;

    let content = `PLAN:\nAsset: ${plan.direction} ${plan.asset}\nEntry target: ${plan.entryTarget ? '$'+plan.entryTarget : 'Not set'}\nTake Profit: ${plan.takeProfit ? '$'+plan.takeProfit : 'Not set'}\nStop Loss: ${plan.stopLoss ? '$'+plan.stopLoss : 'Not set'}\nPlanned R:R: ${rrPreview ? rrPreview+'R' : 'Not calculated'}\nStrategy: ${plan.strategy || 'None'}\nTimeframe: ${plan.timeframe || 'Not specified'}\nRisk amount: ${plan.riskAmount ? '$'+plan.riskAmount : 'Not set'}\nThesis: "${plan.thesis}"`;

    if (linkedTrade) {
      const rr = calcRR(linkedTrade);
      content += `\n\nACTUAL RESULT:\nPnL: ${fmtUsd(linkedTrade.pnlUsd)} (${fmtPct(linkedTrade.pnlPct)}) → ${linkedTrade.result}\nActual R:R: ${rr ? rr.toFixed(2)+'R' : 'N/A'}\nNotes: "${linkedTrade.notes || 'None'}"`;
    }

    streamAI({ system, messages: [{ role: 'user', content }], max_tokens: 200 },
      chunk => { textRef.current += chunk; setAiText(textRef.current); setAiState('streaming'); },
      () => setAiState('done'), () => setAiState('error'));
  }

  const isOpen = plan.status === 'open';
  const dirColor = plan.direction === 'Long' ? 'var(--green)' : 'var(--red)';
  const statusColor = plan.status === 'open' ? 'var(--indigo)' : plan.status === 'completed' ? 'var(--green)' : 'var(--muted)';

  return (
    <div className="trade-card" style={{ marginBottom: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dirColor, boxShadow: `0 0 6px ${dirColor}88`, display: 'inline-block' }} />
          <div>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--fg)' }}>{plan.asset}</span>
            <span style={{ marginLeft: 8, fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: plan.direction === 'Long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: dirColor }}>{plan.direction}</span>
            {plan.strategy && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--muted)' }}>{plan.strategy}</span>}
            {plan.timeframe && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--muted)' }}>{plan.timeframe}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: `${statusColor}18`, padding: '2px 8px', borderRadius: 4 }}>
            {plan.status === 'open' ? '● Open' : plan.status === 'completed' ? '✓ Completed' : '✕ Cancelled'}
          </span>
          <button onClick={() => onEdit(plan)} className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Edit</button>
          <button onClick={() => onDelete(plan)} className="btn-danger" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Delete</button>
        </div>
      </div>

      {/* Thesis */}
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: 1.55, marginBottom: 10, fontStyle: 'italic', borderLeft: '2px solid rgba(99,102,241,0.3)', paddingLeft: 10 }}>
        "{plan.thesis}"
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 'clamp(10px,0.8vw,20px)', flexWrap: 'wrap', marginBottom: 10 }}>
        {plan.entryTarget && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Entry <span style={{ color: 'var(--fg)', fontWeight: 600 }}>${fmt(plan.entryTarget)}</span></div>}
        {plan.takeProfit  && <div style={{ fontSize: 10, color: 'var(--muted)' }}>TP <span style={{ color: 'var(--green)', fontWeight: 600 }}>${fmt(plan.takeProfit)}</span></div>}
        {plan.stopLoss    && <div style={{ fontSize: 10, color: 'var(--muted)' }}>SL <span style={{ color: 'var(--red)', fontWeight: 600 }}>${fmt(plan.stopLoss)}</span></div>}
        {rrPreview        && <div style={{ fontSize: 10, color: 'var(--muted)' }}>R:R <span style={{ color: 'var(--indigo)', fontWeight: 600 }}>{rrPreview}R</span></div>}
        {plan.riskAmount  && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Risk <span style={{ color: 'var(--red)', fontWeight: 600 }}>${fmt(plan.riskAmount)}</span></div>}
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{plan.date}</div>
      </div>

      {/* Linked trade result */}
      {linkedTrade && (
        <div style={{ background: linkedTrade.result === 'Win' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${linkedTrade.result === 'Win' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--muted)' }}>Linked result:</span>
          <span style={{ fontWeight: 700, color: linkedTrade.result === 'Win' ? 'var(--green)' : 'var(--red)' }}>{fmtUsd(linkedTrade.pnlUsd)}</span>
          <span style={{ color: 'var(--muted)' }}>{fmtPct(linkedTrade.pnlPct)}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={runAI} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: 'var(--purple)', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600 }}>
          🤖 {linkedTrade ? 'Plan vs Reality' : 'Review Plan'}
        </button>
        {isOpen && (
          <>
            <button onClick={() => onStatusChange(plan.id, 'completed')} className="btn-status" style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600 }}>
              ✓ Mark Complete
            </button>
            <button onClick={() => onStatusChange(plan.id, 'cancelled')} className="btn-status" style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600 }}>
              ✕ Cancel
            </button>
          </>
        )}
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <div style={{ marginTop: 12, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="ai-badge">{linkedTrade ? '🤖 Plan vs Reality' : '🤖 Plan Review'}</span>
            {aiState === 'done' && <button className="ai-retry btn-ghost" onClick={runAI}>↺</button>}
          </div>
          {aiState === 'loading' && <div className="ai-loading"><div className="ai-loading-dot"/><div className="ai-loading-dot"/><div className="ai-loading-dot"/> Analyzing…</div>}
          {(aiState === 'streaming' || aiState === 'done') && <p className="ai-txt">{aiText}</p>}
          {aiState === 'error' && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-xs)' }}>Error. <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={runAI}>Retry</span></p>}
        </div>
      )}
    </div>
  );
}

// ── Report Body — renders section headers + paragraphs from streamed text ──────
const SECTION_HEADERS = [
  'OVERALL ASSESSMENT',
  'PATTERNS OF FLAW',
  'WHAT TO IMPROVE ON',
  'WHAT TO AVOID ENTIRELY',
  'YOUR EDGE',
  'ACTION PLAN',
];
const SECTION_RE = new RegExp(`^(${SECTION_HEADERS.join('|')}):?\\s*$`, 'i');

function ReportBody({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { elements.push(<div key={key++} style={{ height: 10 }} />); continue; }

    if (SECTION_RE.test(trimmed)) {
      const label = trimmed.replace(/:$/, '').toUpperCase();
      elements.push(
        <div key={key++} style={{ marginTop: elements.length > 0 ? 32 : 0, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ height: 1, flex: 1, background: 'rgba(168,85,247,0.15)' }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(168,85,247,0.8)', letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ height: 1, flex: 1, background: 'rgba(168,85,247,0.15)' }} />
          </div>
        </div>
      );
    } else {
      elements.push(
        <p key={key++} style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--fg)', margin: '0 0 14px 0', opacity: 0.9 }}>{trimmed}</p>
      );
    }
  }
  return <div>{elements}</div>;
}

// ── Overall AI Review ──────────────────────────────────────────────────────────
function OverallAIReview({ trades }) {
  const [open,  setOpen]  = useState(false);
  const [state, setState] = useState('idle');
  const [text,  setText]  = useState('');
  const [mode,  setMode]  = useState('full'); // 'full' or 'compare'
  const textRef = useRef('');

  function runCompare() {
    if (!trades.length || state === 'loading' || state === 'streaming') return;
    setOpen(true); setMode('compare'); setState('loading'); setText(''); textRef.current = '';

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
    const MONTHS_LABEL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const thisLabel = `${MONTHS_LABEL[now.getMonth()]} ${now.getFullYear()}`;
    const lastLabel = `${MONTHS_LABEL[prev.getMonth()]} ${prev.getFullYear()}`;

    const thisTrades = trades.filter(t => t.date.startsWith(thisMonth));
    const lastTrades = trades.filter(t => t.date.startsWith(lastMonth));

    function buildStats(arr, label) {
      if (!arr.length) return `${label}: No trades logged.\n`;
      const wins = arr.filter(t => t.result === 'Win');
      const pnl = arr.reduce((s,t) => s + t.pnlUsd, 0);
      const avgPnl = pnl / arr.length;
      const winAmts = wins.map(t => t.pnlUsd);
      const lossAmts = arr.filter(t => t.result === 'Loss').map(t => Math.abs(t.pnlUsd));
      const avgWin = winAmts.length ? winAmts.reduce((a,b)=>a+b,0)/winAmts.length : 0;
      const avgLoss = lossAmts.length ? lossAmts.reduce((a,b)=>a+b,0)/lossAmts.length : 0;
      const byStrat = {};
      arr.forEach(t => { const s = t.strategy||'Untagged'; if(!byStrat[s]) byStrat[s]={w:0,l:0,pnl:0}; byStrat[s][t.result==='Win'?'w':'l']++; byStrat[s].pnl+=t.pnlUsd; });
      const stratSummary = Object.entries(byStrat).map(([s,d]) => `    ${s}: ${d.w}W/${d.l}L, $${d.pnl.toFixed(0)}`).join('\n');
      const tradeLog = arr.slice(0,15).map(t => `    ${t.date} ${t.direction} ${t.asset} ${fmtUsd(t.pnlUsd)} | "${t.notes||'no notes'}"`).join('\n');
      return `${label}: ${arr.length} trades | WR ${((wins.length/arr.length)*100).toFixed(0)}% | Net ${fmtUsd(pnl)} | Avg/trade $${avgPnl.toFixed(0)}
  Avg win: $${avgWin.toFixed(0)} | Avg loss: $${avgLoss.toFixed(0)} | W:L ratio: ${avgLoss>0?(avgWin/avgLoss).toFixed(2):'—'}x
  Strategies:\n${stratSummary||'    None tagged'}
  Trades:\n${tradeLog}\n`;
    }

    const system = `You are an elite trading coach comparing two months of trading performance. Be brutally specific with the numbers — reference exact amounts, win rates, and strategies from each month. The trader wants to know: am I getting better or worse? What changed? What should I do differently next month?

Structure your report using EXACTLY these headers on their own line in ALL CAPS followed by a colon:

THE VERDICT:
WHAT IMPROVED:
WHAT GOT WORSE:
KEY PATTERN SHIFT:
NEXT MONTH GAME PLAN:

Under each header write 2-3 specific paragraphs. No bullet points. No markdown. No asterisks.`;

    const content = `MONTH-OVER-MONTH COMPARISON

${buildStats(lastTrades, lastLabel)}
${buildStats(thisTrades, thisLabel)}
Write the comparison report now.`;

    streamAI({ system, messages: [{ role: 'user', content }], max_tokens: 1500 },
      chunk => { textRef.current += chunk; setText(textRef.current); setState('streaming'); },
      () => setState('done'), () => setState('error'));
  }

  function run() {
    if (!trades.length || state === 'loading' || state === 'streaming') return;
    setOpen(true); setMode('full'); setState('loading'); setText(''); textRef.current = '';

    const wins = trades.filter(t => t.result === 'Win');
    const losses = trades.filter(t => t.result === 'Loss');
    const total = trades.length;
    const totalPnl = trades.reduce((s, t) => s + t.pnlUsd, 0);

    // Strategy breakdown
    const byStrategy = {};
    trades.forEach(t => {
      const s = t.strategy || 'Untagged';
      if (!byStrategy[s]) byStrategy[s] = { wins: 0, losses: 0, pnl: 0 };
      byStrategy[s][t.result === 'Win' ? 'wins' : 'losses']++;
      byStrategy[s].pnl += t.pnlUsd;
    });
    const stratLines = Object.entries(byStrategy)
      .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
      .map(([s, d]) => {
        const t2 = d.wins + d.losses;
        return `  ${s}: ${d.wins}W / ${d.losses}L (${((d.wins/t2)*100).toFixed(0)}% WR) | Net PnL $${d.pnl.toFixed(2)} | Avg $${(d.pnl/t2).toFixed(2)}/trade`;
      }).join('\n');

    // Day-of-week breakdown
    const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const byDay = {};
    trades.forEach(t => {
      const day = DOW_LABELS[new Date(t.date + 'T12:00:00Z').getUTCDay()];
      if (!byDay[day]) byDay[day] = { wins: 0, total: 0, pnl: 0 };
      byDay[day].total++;
      if (t.result === 'Win') byDay[day].wins++;
      byDay[day].pnl += t.pnlUsd;
    });
    const dayLines = Object.entries(byDay)
      .map(([d, v]) => `  ${d}: ${v.wins}W/${v.total - v.wins}L (${((v.wins/v.total)*100).toFixed(0)}% WR) | Net $${v.pnl.toFixed(2)}`)
      .join('\n');

    // Direction breakdown
    const longs = trades.filter(t => t.direction === 'Long');
    const shorts = trades.filter(t => t.direction === 'Short');
    const longWR  = longs.length  ? (longs.filter(t => t.result === 'Win').length  / longs.length  * 100).toFixed(0) : '—';
    const shortWR = shorts.length ? (shorts.filter(t => t.result === 'Win').length / shorts.length * 100).toFixed(0) : '—';
    const longPnl  = longs.reduce((s, t) => s + t.pnlUsd, 0);
    const shortPnl = shorts.reduce((s, t) => s + t.pnlUsd, 0);

    // Winner vs loser magnitude
    const winAmts  = wins.map(t => t.pnlUsd);
    const lossAmts = losses.map(t => Math.abs(t.pnlUsd));
    const avgWin   = winAmts.length  ? winAmts.reduce((a,b) => a+b,0)  / winAmts.length  : 0;
    const avgLoss  = lossAmts.length ? lossAmts.reduce((a,b) => a+b,0) / lossAmts.length : 0;
    const maxWin   = winAmts.length  ? Math.max(...winAmts)  : 0;
    const maxLoss  = lossAmts.length ? Math.max(...lossAmts) : 0;

    // Recent trades log
    const tradesSummary = trades.slice(0, 30).map(t => {
      const rr = calcRR(t);
      return `  ${t.date} | ${t.direction} ${t.asset} | PnL ${fmtUsd(t.pnlUsd)} (${fmtPct(t.pnlPct)})${rr != null ? ` | R:R ${rr.toFixed(2)}` : ''} | Strategy: ${t.strategy || 'None'} | Notes: "${t.notes || 'none'}"`;
    }).join('\n');

    const system = `You are an elite trading coach writing a comprehensive, structured performance report. You have pre-computed statistics AND the full trade log. Be brutally specific — reference exact dollar amounts, percentages, strategies, and dates from the data. Never be vague or generic.

Structure your report using EXACTLY these section headers on their own line in ALL CAPS followed by a colon:

OVERALL ASSESSMENT:
PATTERNS OF FLAW:
WHAT TO IMPROVE ON:
WHAT TO AVOID ENTIRELY:
YOUR EDGE:
ACTION PLAN:

Under each header write 2-4 detailed flowing paragraphs. No bullet points. No markdown. No asterisks. Just the headers and paragraphs. Each section should be meaty and specific.`;

    const content = `PERFORMANCE SUMMARY — ${total} trades | Net PnL: ${fmtUsd(totalPnl)} | Win Rate: ${((wins.length/total)*100).toFixed(1)}%

DIRECTION BREAKDOWN:
  Longs:  ${longs.length} trades, ${longWR}% WR, Net $${longPnl.toFixed(2)}
  Shorts: ${shorts.length} trades, ${shortWR}% WR, Net $${shortPnl.toFixed(2)}

STRATEGY BREAKDOWN:
${stratLines || '  No strategies tagged'}

DAY-OF-WEEK PERFORMANCE:
${dayLines || '  Insufficient data'}

WINNER vs LOSER MAGNITUDE:
  Avg win: $${avgWin.toFixed(2)} | Largest win: $${maxWin.toFixed(2)}
  Avg loss: $${avgLoss.toFixed(2)} | Largest loss: $${maxLoss.toFixed(2)}
  Ratio: ${avgLoss > 0 ? (avgWin/avgLoss).toFixed(2) : '—'}x (avg win / avg loss)

RECENT TRADE LOG (last ${Math.min(30,total)}):
${tradesSummary}

Write the full structured report now. Be comprehensive, direct, and ruthlessly specific to this data.`;

    streamAI({ system, messages: [{ role: 'user', content }], max_tokens: 1800 },
      chunk => { textRef.current += chunk; setText(textRef.current); setState('streaming'); },
      () => setState('done'), () => setState('error'));
  }

  return (
    <>
      {/* Trigger buttons — always visible */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={run} disabled={!trades.length} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 'clamp(7px,0.52vw,14px) clamp(16px,1.1vw,28px)', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 10, color: 'var(--purple)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: trades.length ? 'pointer' : 'not-allowed', fontFamily: 'Inter', transition: 'background 0.15s', opacity: trades.length ? 1 : 0.4 }}>🤖 AI Portfolio Review</button>
        <button onClick={runCompare} disabled={!trades.length} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 'clamp(7px,0.52vw,14px) clamp(16px,1.1vw,28px)', background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.30)', borderRadius: 10, color: 'var(--indigo)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: trades.length ? 'pointer' : 'not-allowed', fontFamily: 'Inter', transition: 'background 0.15s', opacity: trades.length ? 1 : 0.4 }}>📊 Month vs Month</button>
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px' }}
        >
          <div style={{ background: 'var(--card)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 18, width: '100%', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>🤖</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.2px' }}>{mode === 'compare' ? '📊 Month vs Month' : '🤖 AI Portfolio Review'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{trades.length} trades · {fmtUsd(trades.reduce((s,t)=>s+t.pnlUsd,0))} net · {trades.length ? ((trades.filter(t=>t.result==='Win').length/trades.length)*100).toFixed(0) : 0}% WR</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {state === 'done' && <button className="ai-retry btn-ghost" onClick={mode === 'compare' ? runCompare : run}>↺ Re-analyze</button>}
                <button onClick={() => setOpen(false)} className="btn-icon" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer', fontSize: 16, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', flexShrink: 0 }}>×</button>
              </div>
            </div>

            {/* Modal body — scrollable */}
            <div style={{ overflowY: 'auto', padding: '28px 32px 36px', flex: 1 }}>
              {state === 'loading' && (
                <div className="ai-loading" style={{ justifyContent: 'center', padding: '60px 0' }}>
                  <div className="ai-loading-dot"/><div className="ai-loading-dot"/><div className="ai-loading-dot"/>
                  <span style={{ marginLeft: 12 }}>Building your report…</span>
                </div>
              )}
              {(state === 'streaming' || state === 'done') && (
                <ReportBody text={text} />
              )}
              {state === 'error' && (
                <p style={{ color: 'var(--red)', fontSize: 'var(--fs-sm)', textAlign: 'center', padding: '48px 0' }}>Unable to load analysis. Try again.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Metrics Panel (right column) ──────────────────────────────────────────────
function MetricsPanel({ trades, onLogTrade }) {
  const s = calcStats(trades);
  const empty = trades.length === 0;

  // Strategy breakdown
  const stratMap = {};
  trades.forEach(t => {
    if (!t.strategy) return;
    if (!stratMap[t.strategy]) stratMap[t.strategy] = { wins: 0, total: 0, pnl: 0 };
    stratMap[t.strategy].total++;
    if (t.result === 'Win') stratMap[t.strategy].wins++;
    stratMap[t.strategy].pnl += t.pnlUsd;
  });
  const stratList = Object.entries(stratMap)
    .map(([name, v]) => ({ name, ...v, wr: v.wins / v.total }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 4);

  // Long vs Short
  const longs  = trades.filter(t => t.direction === 'Long');
  const shorts = trades.filter(t => t.direction === 'Short');
  const longPnl  = longs.reduce((s, t)  => s + t.pnlUsd, 0);
  const shortPnl = shorts.reduce((s, t) => s + t.pnlUsd, 0);

  // Win / loss days
  const dayMap = {};
  trades.forEach(t => {
    if (!dayMap[t.date]) dayMap[t.date] = 0;
    dayMap[t.date] += t.pnlUsd;
  });
  const dayVals   = Object.values(dayMap);
  const winDays   = dayVals.filter(v => v > 0).length;
  const lossDays  = dayVals.filter(v => v < 0).length;

  const card   = { border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 'clamp(10px,0.73vw,18px) clamp(12px,0.9vw,20px)', marginBottom: 8 };
  const lbl    = { fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 };
  const big    = { fontSize: 'var(--fs-2xl)', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 };
  const micro  = { fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: 3 };
  const row    = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const divider= { height: 1, background: 'var(--border)', margin: '8px 0' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Net PnL */}
      <div className="metric-card" style={{ ...card, marginBottom: 8 }}>
        <div style={lbl}>Net P&amp;L</div>
        <div className={!empty ? (s.totalPnl >= 0 ? 'text-profit' : 'text-loss') : ''} style={{ ...big, color: empty ? 'var(--muted)' : undefined }}>{empty ? '—' : fmtUsd(s.totalPnl)}</div>
        <div style={micro}>{trades.length} trade{trades.length !== 1 ? 's' : ''} logged</div>
      </div>

      {/* Win Rate bar */}
      <div className="metric-card" style={{ ...card, marginBottom: 8 }}>
        <div style={{ ...row, marginBottom: 6 }}>
          <div style={lbl}>Win Rate</div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: empty ? 'var(--muted)' : (s.winRate >= 0.5 ? 'var(--green)' : 'var(--red)') }}>{empty ? '—' : `${(s.winRate * 100).toFixed(1)}%`}</div>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${empty ? 0 : s.winRate * 100}%`, background: s.winRate >= 0.5 ? 'var(--green)' : 'var(--red)', borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <div style={{ ...row, marginTop: 6 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--green)', fontWeight: 600 }}>{s.wins ?? 0}W</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 600 }}>{winDays}W days / {lossDays}L days</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--red)', fontWeight: 600 }}>{s.losses ?? 0}L</div>
        </div>
      </div>

      {/* 2×2 key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        {[
          { label: 'Profit Factor', value: s.profitFactor != null ? s.profitFactor.toFixed(2) : '—', color: s.profitFactor != null ? (s.profitFactor >= 1 ? 'var(--green)' : 'var(--red)') : undefined, sub: s.profitFactor != null ? (s.profitFactor >= 1.5 ? 'Excellent' : s.profitFactor >= 1 ? 'Profitable' : 'Needs work') : 'Need 2+ trades' },
          { label: 'Expectancy',    value: s.expectancy != null ? fmtUsd(s.expectancy) : '—', color: s.expectancy != null ? pnlColor(s.expectancy) : undefined, sub: 'per trade' },
          { label: 'Avg R:R',       value: s.avgRR != null ? s.avgRR.toFixed(2) : '—', color: s.avgRR != null ? 'var(--purple)' : undefined, sub: s.avgRR != null ? (s.avgRR >= 2 ? 'Excellent' : s.avgRR >= 1 ? 'Good' : 'Improve') : 'Set TP & SL' },
        ].map(m => (
          <div key={m.label} className="metric-card" style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 'clamp(8px,0.6vw,14px) clamp(10px,0.73vw,16px)' }}>
            <div style={lbl}>{m.label}</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: m.color ?? 'var(--text)', letterSpacing: '-0.3px' }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 'clamp(9px,0.47vw,12px)', color: 'var(--muted)', marginTop: 2 }}>{m.sub}</div>}
          </div>
        ))}
        {/* Streak — rendered separately so we can use a CSS dot instead of emoji */}
        <div className="metric-card" style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 'clamp(8px,0.6vw,14px) clamp(10px,0.73vw,16px)' }}>
          <div style={lbl}>Streak</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-lg)', fontWeight: 800, color: s.streakType === 'Win' ? 'var(--green)' : s.streakType === 'Loss' ? 'var(--red)' : 'var(--text)', letterSpacing: '-0.3px' }}>
            {s.streak || '—'}
            {s.streak > 0 && (
              <span style={{
                width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                background: s.streakType === 'Win' ? 'var(--green)' : 'var(--red)',
                boxShadow: s.streakType === 'Win' ? '0 0 6px rgba(34,197,94,0.8), 0 0 12px rgba(34,197,94,0.4)' : '0 0 6px rgba(239,68,68,0.8), 0 0 12px rgba(239,68,68,0.4)',
                display: 'inline-block',
              }} />
            )}
          </div>
          <div style={{ fontSize: 'clamp(9px,0.47vw,12px)', color: 'var(--muted)', marginTop: 2 }}>
            {s.streakType ? `${s.streakType}s in a row` : 'No trades'}
          </div>
        </div>
      </div>

      {/* Avg Win / Avg Loss */}
      <div className="metric-card" style={{ ...card, marginBottom: 8 }}>
        <div style={lbl}>Avg Win / Avg Loss</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--green)' }}>{s.avgWin ? fmtUsd(s.avgWin) : '—'}</div>
            <div style={{ fontSize: 'clamp(9px,0.47vw,12px)', color: 'var(--muted)', marginTop: 2 }}>avg win</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--red)' }}>{s.avgLoss ? `-$${fmt(s.avgLoss)}` : '—'}</div>
            <div style={{ fontSize: 'clamp(9px,0.47vw,12px)', color: 'var(--muted)', marginTop: 2 }}>avg loss</div>
          </div>
        </div>
        <div style={divider} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--green)' }}>{trades.length ? fmtUsd(Math.max(...trades.map(t => t.pnlUsd))) : '—'}</div>
            <div style={{ fontSize: 'clamp(9px,0.47vw,12px)', color: 'var(--muted)', marginTop: 2 }}>largest win</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--red)' }}>{trades.length ? fmtUsd(Math.min(...trades.map(t => t.pnlUsd))) : '—'}</div>
            <div style={{ fontSize: 'clamp(9px,0.47vw,12px)', color: 'var(--muted)', marginTop: 2 }}>largest loss</div>
          </div>
        </div>
      </div>

      {/* Long vs Short */}
      <div className="metric-card" style={{ ...card, marginBottom: 8 }}>
        <div style={lbl}>Long vs Short</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--green)' }}>{longs.length} <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--muted)' }}>({trades.length ? Math.round(longs.length/trades.length*100) : 0}%)</span></div>
            <div style={{ fontSize: 'clamp(9px,0.47vw,12px)', color: 'var(--muted)', marginTop: 2 }}>Long · {fmtUsd(longPnl)}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--red)' }}>{shorts.length} <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--muted)' }}>({trades.length ? Math.round(shorts.length/trades.length*100) : 0}%)</span></div>
            <div style={{ fontSize: 'clamp(9px,0.47vw,12px)', color: 'var(--muted)', marginTop: 2 }}>Short · {fmtUsd(shortPnl)}</div>
          </div>
        </div>
        {trades.length > 0 && (
          <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ flex: longs.length || 1,  background: 'var(--green)', opacity: 0.6 }} />
            <div style={{ flex: shorts.length || 0, background: 'var(--red)',   opacity: 0.6 }} />
          </div>
        )}
      </div>

      {/* Strategy breakdown */}
      {stratList.length > 0 && (
        <div className="metric-card" style={{ ...card, marginBottom: 8 }}>
          <div style={lbl}>Strategy Breakdown</div>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stratList.map(st => (
              <div key={st.name}>
                <div style={{ ...row, marginBottom: 3 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text)' }}>{st.name}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: pnlColor(st.pnl) }}>{fmtUsd(st.pnl)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${st.wr * 100}%`, background: st.wr >= 0.5 ? 'var(--green)' : 'var(--red)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 'clamp(9px,0.47vw,11px)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{st.wins}W {st.total - st.wins}L</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Portfolio Review */}
      <div style={{ marginTop: 4 }}>
        <OverallAIReview trades={trades} />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function JournalPage() {
  const [trades,      setTrades]      = useState([]);
  const [strategies,  setStrategies]  = useState([]);
  const [plans,       setPlans]       = useState([]);
  const [newPlan,     setNewPlan]     = useState(false);
  const [editPlan,    setEditPlan]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState('calendar');
  const [showModal,   setShowModal]   = useState(false);
  const [editTrade,   setEditTrade]   = useState(null);
  const [deleteTrade, setDeleteTrade] = useState(null);
  const [filter,      setFilter]      = useState('All');
  const [sortKey,     setSortKey]     = useState('date');
  const [sortDir,     setSortDir]     = useState(-1);
  const [dayDrawer,   setDayDrawer]   = useState(null);

  useEffect(() => {
    // Load from localStorage (serverless-safe, works on Vercel)
    setTrades(store.loadTrades());
    setStrategies(store.loadStrategies());
    setPlans(store.loadPlans());
    setLoading(false);
  }, []);

  function addStrategy(name) {
    setStrategies(store.addStrategy(name));
  }
  function addTrade(body) {
    const trade = store.createTrade(body);
    setTrades(t => [trade, ...t]);
    setShowModal(false);
  }
  function saveTrade(body) {
    const updated = store.updateTrade(editTrade.id, body);
    if (updated) setTrades(t => t.map(x => x.id === updated.id ? updated : x));
    setEditTrade(null);
  }
  function confirmDelete() {
    store.deleteTrade(deleteTrade.id);
    setTrades(t => t.filter(x => x.id !== deleteTrade.id));
    setDeleteTrade(null);
  }

  function savePlan(form) {
    const body = { ...form };
    if (editPlan) {
      const updated = store.updatePlan(editPlan.id, body);
      if (updated) setPlans(p => p.map(x => x.id === updated.id ? updated : x));
      setEditPlan(null);
    } else {
      const created = store.createPlan(body);
      setPlans(p => [created, ...p]);
      setNewPlan(false);
    }
  }

  function deletePlan(plan) {
    store.deletePlan(plan.id);
    setPlans(p => p.filter(x => x.id !== plan.id));
  }

  function changePlanStatus(id, status) {
    const updated = store.updatePlan(id, { status });
    if (updated) setPlans(p => p.map(x => x.id === updated.id ? updated : x));
  }

  // List filter + sort
  const filtered = trades.filter(t => {
    if (filter === 'All')    return true;
    if (filter === 'Wins')   return t.result === 'Win';
    if (filter === 'Losses') return t.result === 'Loss';
    return t.strategy === filter;
  });
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av < bv) return -1 * sortDir;
    if (av > bv) return  1 * sortDir;
    return 0;
  });
  function toggleSort(key) { if (sortKey === key) setSortDir(d => d * -1); else { setSortKey(key); setSortDir(-1); } }
  const SortBtn = ({ k, label }) => (
    <button onClick={() => toggleSort(k)} style={{ padding: '3px 12px', borderRadius: 6, border: `1px solid ${sortKey === k ? 'var(--border2)' : 'transparent'}`, background: sortKey === k ? 'var(--card2)' : 'transparent', color: sortKey === k ? 'var(--text)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter', fontSize: 'var(--fs-xs)', fontWeight: 600, transition: 'all 0.15s' }}>
      {label}{sortKey === k ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
    </button>
  );
  const activeStratFilters = strategies.filter(s => trades.some(t => t.strategy === s));

  return (
    <div style={{ height: '100vh', overflowY: 'auto', padding: 'var(--pad-v) var(--dash-px)', paddingBottom: 40 }} className="scroll">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(12px,0.9vw,20px)', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.4px' }}>Trade Journal</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 2 }}>Track, review, and improve every trade</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setNewPlan(true)} className="btn-primary" style={{ padding: 'clamp(7px,0.52vw,14px) clamp(16px,1.1vw,28px)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.18)', color: 'var(--indigo)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'Inter' }}>
            + Plan Trade
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary" style={{ padding: 'clamp(7px,0.52vw,14px) clamp(16px,1.1vw,28px)', borderRadius: 10, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.18)', color: 'var(--purple)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'Inter' }}>
            + Log Trade
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && <div style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)', padding: 40, textAlign: 'center' }}>Loading…</div>}

      {/* Empty state — shown only when no trades and not on plans view */}
      {!loading && trades.length === 0 && view !== 'plans' && (
        <div style={{ textAlign: 'center', padding: 'clamp(40px,4vw,80px) 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📋</div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>No trades logged yet</div>
          <div style={{ fontSize: 'var(--fs-sm)', marginBottom: 24 }}>Start tracking your trades to unlock performance insights and AI analysis.</div>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 28px', borderRadius: 10, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.18)', color: 'var(--purple)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'Inter' }}>+ Log Your First Trade</button>
        </div>
      )}

      {/* Shared tab bar — always visible when not loading */}
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--gap)', flexWrap: 'wrap', gap: 8 }}>
          <div className="tabs">
            {trades.length > 0 && <button className={view === 'calendar' ? 'tab act' : 'tab'} onClick={() => setView('calendar')}>📅 Calendar</button>}
            {trades.length > 0 && <button className={view === 'list'     ? 'tab act' : 'tab'} onClick={() => setView('list')}>☰ List</button>}
            <button className={view === 'plans' ? 'tab act' : 'tab'} onClick={() => setView('plans')}>📋 Plans</button>
          </div>
          {view === 'list' && trades.length > 0 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 600, marginRight: 4 }}>Sort:</span>
              <SortBtn k="date" label="Date" /><SortBtn k="pnlUsd" label="PnL" /><SortBtn k="asset" label="Asset" />
            </div>
          )}
        </div>
      )}

      {/* Plans view — shown regardless of whether trades exist */}
      {!loading && view === 'plans' && (
        <div>
          {plans.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>No plans yet. Use "Plan Trade" to map out your next setup before entering.</div>
            : plans.map(p => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  trades={trades}
                  onEdit={setEditPlan}
                  onDelete={deletePlan}
                  onStatusChange={changePlanStatus}
                />
              ))
          }
        </div>
      )}

      {/* Two-column layout */}
      {!loading && trades.length > 0 && view !== 'plans' && (
        <div className="journal-layout" style={{ display: 'grid', gap: 'var(--gap)', alignItems: 'start' }}>

          {/* LEFT: Calendar / List */}
          <div style={{ minWidth: 0 }}>

            {/* List filters */}
            {view === 'list' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--gap)' }}>
                {['All','Wins','Losses'].map(f => <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'tab act' : 'tab'}>{f}</button>)}
                {activeStratFilters.length > 0 && <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />}
                {activeStratFilters.map(s => <button key={s} onClick={() => setFilter(s)} className={filter === s ? 'tab act' : 'tab'}>{s}</button>)}
              </div>
            )}

            {/* Calendar */}
            {view === 'calendar' && (
              <>
                <CalendarView trades={trades} onDayClick={(dateStr, ts) => setDayDrawer({ dateStr, trades: ts })} />

                {/* Equity Curve + Drawdown */}
                {trades.length >= 2 && (
                  <div style={{ marginTop: 'var(--gap)' }}>
                    <EquityCurve trades={trades} />
                  </div>
                )}

                {/* Day-of-Week Breakdown */}
                {trades.length >= 3 && (
                  <div style={{ marginTop: 'var(--gap)' }}>
                    <DayOfWeekChart trades={trades} />
                  </div>
                )}

                {/* Recent Trades — fills dead space below calendar */}
                <div style={{ marginTop: 'var(--gap)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--fg)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Recent Trades</span>
                    <button onClick={() => setView('list')} className="btn-link" style={{ fontSize: 11, color: 'var(--purple)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>View all →</button>
                  </div>
                  {trades.length === 0
                    ? <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>No trades logged yet.</div>
                    : trades.slice(0, 6).map(t => {
                        const rr = calcRR(t);
                        const isWin = t.result === 'Win';
                        return (
                          <div
                            key={t.id}
                            onClick={() => setEditTrade(t)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 12px', marginBottom: 5,
                              background: 'var(--card)', border: '1px solid var(--border)',
                              borderRadius: 8, cursor: 'pointer',
                              transition: 'border-color 0.15s, background 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--purple)'; e.currentTarget.style.background = 'rgba(139,92,246,0.04)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)'; }}
                          >
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              background: t.direction === 'Long' ? 'var(--green)' : 'var(--red)',
                              boxShadow: t.direction === 'Long' ? '0 0 5px rgba(34,197,94,0.6)' : '0 0 5px rgba(239,68,68,0.6)',
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--fg)', whiteSpace: 'nowrap' }}>{t.asset}</span>
                                <span style={{
                                  fontSize: 10, padding: '1px 5px', borderRadius: 4, fontWeight: 500,
                                  background: t.direction === 'Long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                  color: t.direction === 'Long' ? 'var(--green)' : 'var(--red)',
                                }}>{t.direction}</span>
                                {t.strategy && <span style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.strategy}</span>}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{t.date}</div>
                            </div>
                            {rr !== null && (
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>R:R</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--purple)' }}>{rr.toFixed(2)}R</div>
                              </div>
                            )}
                            <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: isWin ? 'var(--green)' : 'var(--red)' }}>
                                {isWin ? '+' : ''}{t.pnlUsd?.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{isWin ? '+' : ''}{t.pnlPct?.toFixed(2)}%</div>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              </>
            )}

            {/* List */}
            {view === 'list' && (
              <>
                {sorted.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>No trades match this filter.</div>}
                {sorted.map(t => <TradeCard key={t.id} trade={t} onEdit={setEditTrade} onDelete={setDeleteTrade} />)}
              </>
            )}
          </div>

          {/* RIGHT: Metrics panel */}
          <div style={{ position: 'sticky', top: 0 }}>
            <MetricsPanel trades={trades} onLogTrade={() => setShowModal(true)} />
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal   && <TradeModal strategies={strategies} onSave={addTrade}  onAddStrategy={addStrategy} onClose={() => setShowModal(false)} />}
      {editTrade   && <TradeModal strategies={strategies} initial={editTrade} onSave={saveTrade} onAddStrategy={addStrategy} onClose={() => setEditTrade(null)} />}
      {deleteTrade && <DeleteConfirm trade={deleteTrade} onConfirm={confirmDelete} onCancel={() => setDeleteTrade(null)} />}
      {dayDrawer   && <DayDrawer dateStr={dayDrawer.dateStr} trades={dayDrawer.trades} onClose={() => setDayDrawer(null)} onEdit={setEditTrade} onDelete={setDeleteTrade} />}
      {(newPlan || editPlan) && (
        <PlanModal
          initial={editPlan || null}
          strategies={strategies}
          onSave={savePlan}
          onClose={() => { setNewPlan(false); setEditPlan(null); }}
        />
      )}
    </div>
  );
}
