'use client';

// ── LocalStorage-backed journal, plans, strategies ─────────────────────────
// Serverless-safe replacement for the file-based /api/journal, /api/plans,
// /api/strategies routes. Each user's data lives in their browser.

const KEY_TRADES     = 'll_journal';
const KEY_PLANS      = 'll_plans';
const KEY_STRATEGIES = 'll_strategies';

const DEFAULT_STRATEGIES = ['Breakout','Mean Revert','Trend Follow','Range','Scalp','Swing','News Play','Other'];

// ── Seed data: first-time users get demo trades so the calendar isn't empty
const SEED_TRADES = [
  { id:'s1', createdAt: Date.now() - 5*86400000, asset:'BTC/USD', direction:'Long',  entryPrice:62371, size:11873, date: new Date(Date.now() - 5*86400000).toISOString().slice(0,10), strategy:'Trend Follow', notes:'Great trend continuation play. Established intra-day trend via market structure, waited for OTE pullback, ran to external highs.', takeProfit:64583, stopLoss:61733, pnlUsd:2736, pnlPct:23.04, result:'Win' },
  { id:'s2', createdAt: Date.now() - 4*86400000, asset:'ETH/USD', direction:'Long',  entryPrice:3124, size:8500, date: new Date(Date.now() - 4*86400000).toISOString().slice(0,10), strategy:'Optimal Trade Entry', notes:'OTE into daily bullish order block.', takeProfit:3290, stopLoss:3080, pnlUsd:1524, pnlPct:17.93, result:'Win' },
  { id:'s3', createdAt: Date.now() - 3*86400000, asset:'SOL/USD', direction:'Short', entryPrice:178, size:5000, date: new Date(Date.now() - 3*86400000).toISOString().slice(0,10), strategy:'Breakout', notes:'Failed breakout reversal — short into resistance.', takeProfit:165, stopLoss:183, pnlUsd:-463, pnlPct:-9.26, result:'Loss' },
  { id:'s4', createdAt: Date.now() - 1*86400000, asset:'BTC/USD', direction:'Long',  entryPrice:71200, size:15000, date: new Date(Date.now() - 1*86400000).toISOString().slice(0,10), strategy:'Trend Follow', notes:'Continuation long after liquidity sweep.', takeProfit:74500, stopLoss:69800, pnlUsd:568, pnlPct:3.79, result:'Win' },
];

// ── Safe localStorage helpers ──────────────────────────────────────────────
function read(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function write(key, data) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ── Trades ─────────────────────────────────────────────────────────────────
export function loadTrades() {
  const existing = read(KEY_TRADES, null);
  if (existing === null) {
    write(KEY_TRADES, SEED_TRADES);
    return SEED_TRADES;
  }
  return existing;
}

function computeTradeFields(body) {
  const pnlUsd = parseFloat(body.pnlUsd) || 0;
  const size   = parseFloat(body.size)   || 0;
  return {
    pnlUsd: parseFloat(pnlUsd.toFixed(2)),
    pnlPct: size ? parseFloat(((pnlUsd / size) * 100).toFixed(2)) : 0,
    result: pnlUsd >= 0 ? 'Win' : 'Loss',
    size,
  };
}

export function createTrade(body) {
  const computed = computeTradeFields(body);
  const trade = {
    id:          Date.now().toString(),
    createdAt:   Date.now(),
    asset:       body.asset       ?? '',
    direction:   body.direction   ?? 'Long',
    entryPrice:  body.entryPrice  ?? 0,
    size:        computed.size,
    date:        body.date        ?? new Date().toISOString().slice(0, 10),
    strategy:    body.strategy    ?? '',
    notes:       body.notes       ?? '',
    takeProfit:  body.takeProfit  ? parseFloat(body.takeProfit)  : null,
    stopLoss:    body.stopLoss    ? parseFloat(body.stopLoss)    : null,
    pnlUsd:      computed.pnlUsd,
    pnlPct:      computed.pnlPct,
    result:      computed.result,
  };
  const trades = loadTrades();
  trades.unshift(trade);
  write(KEY_TRADES, trades);
  return trade;
}

export function updateTrade(id, body) {
  const trades = loadTrades();
  const idx = trades.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const merged = { ...trades[idx], ...body };
  if (body.takeProfit !== undefined) merged.takeProfit = body.takeProfit ? parseFloat(body.takeProfit) : null;
  if (body.stopLoss   !== undefined) merged.stopLoss   = body.stopLoss   ? parseFloat(body.stopLoss)   : null;
  const computed = computeTradeFields(merged);
  trades[idx] = { ...merged, ...computed };
  write(KEY_TRADES, trades);
  return trades[idx];
}

export function deleteTrade(id) {
  const trades = loadTrades().filter(t => t.id !== id);
  write(KEY_TRADES, trades);
  return true;
}

// ── Plans ──────────────────────────────────────────────────────────────────
export function loadPlans() {
  return read(KEY_PLANS, []);
}

export function createPlan(body) {
  const plan = {
    id:            Date.now().toString(),
    createdAt:     Date.now(),
    asset:         body.asset       ?? 'BTC/USD',
    direction:     body.direction   ?? 'Long',
    entryTarget:   body.entryTarget ? parseFloat(body.entryTarget) : null,
    takeProfit:    body.takeProfit  ? parseFloat(body.takeProfit)  : null,
    stopLoss:      body.stopLoss    ? parseFloat(body.stopLoss)    : null,
    strategy:      body.strategy    ?? '',
    timeframe:     body.timeframe   ?? '',
    thesis:        body.thesis      ?? '',
    riskAmount:    body.riskAmount  ? parseFloat(body.riskAmount) : null,
    date:          body.date        ?? new Date().toISOString().slice(0, 10),
    status:        'open',
    linkedTradeId: null,
  };
  const plans = loadPlans();
  plans.unshift(plan);
  write(KEY_PLANS, plans);
  return plan;
}

export function updatePlan(id, body) {
  const plans = loadPlans();
  const idx = plans.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const merged = { ...plans[idx], ...body };
  if (body.entryTarget !== undefined) merged.entryTarget = body.entryTarget ? parseFloat(body.entryTarget) : null;
  if (body.takeProfit  !== undefined) merged.takeProfit  = body.takeProfit  ? parseFloat(body.takeProfit)  : null;
  if (body.stopLoss    !== undefined) merged.stopLoss    = body.stopLoss    ? parseFloat(body.stopLoss)    : null;
  if (body.riskAmount  !== undefined) merged.riskAmount  = body.riskAmount  ? parseFloat(body.riskAmount)  : null;
  plans[idx] = merged;
  write(KEY_PLANS, plans);
  return merged;
}

export function deletePlan(id) {
  const plans = loadPlans().filter(p => p.id !== id);
  write(KEY_PLANS, plans);
  return true;
}

// ── Strategies ─────────────────────────────────────────────────────────────
export function loadStrategies() {
  return read(KEY_STRATEGIES, [...DEFAULT_STRATEGIES]);
}

export function addStrategy(name) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return loadStrategies();
  const list = loadStrategies();
  if (list.includes(trimmed)) return list;
  list.splice(list.length - 1, 0, trimmed); // insert before "Other"
  write(KEY_STRATEGIES, list);
  return list;
}
