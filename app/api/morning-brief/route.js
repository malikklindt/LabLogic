// Morning Market Briefing API
// Aggregates overnight moves, today's events, current regime, and top whale activity
// into a single briefing payload. Called once per day per user on first visit.
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

function getAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const c = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    return c.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim() ?? null;
  } catch { return null; }
}

// Cache for 30 min — the briefing is refreshed periodically but not on every request
let cache = null;
let cacheTs = 0;
const TTL = 30 * 60 * 1000;

// ── Fetchers (internal APIs) ──────────────────────────────────────────────────
async function fetchInternal(base, path) {
  try {
    const res = await fetch(`${base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Regime classification (mirrors MacroRegimeCard logic) ────────────────────
function classifyRegime(ind) {
  if (!ind?.spy || !ind?.vix || !ind?.dxy) return { score: null, label: 'Unknown' };
  let score = 50;
  const spyChg  = ind.spy.changePct ?? 0;
  score += Math.max(-15, Math.min(15, spyChg * 10));
  const vixPrice = ind.vix.price ?? 20;
  if (vixPrice < 15)      score += 18;
  else if (vixPrice < 20) score += 10;
  else if (vixPrice < 25) score += 2;
  else if (vixPrice < 30) score -= 8;
  else if (vixPrice < 40) score -= 15;
  else                     score -= 20;
  const dxyChg = ind.dxy.changePct ?? 0;
  score -= Math.max(-12, Math.min(12, dxyChg * 15));
  const bondChg = ind.bonds?.changePct ?? 0;
  score += Math.max(-8, Math.min(8, bondChg * 8));
  const btcChg = ind.btc?.chg24h ?? 0;
  score += Math.max(-10, Math.min(10, btcChg * 3));
  score = Math.max(0, Math.min(100, Math.round(score)));

  let label;
  if (score <= 15) label = 'Crisis';
  else if (score <= 30) label = 'Risk-Off';
  else if (score <= 42) label = 'Cautious';
  else if (score <= 58) label = 'Neutral';
  else if (score <= 70) label = 'Risk-On';
  else if (score <= 85) label = 'Bullish';
  else                   label = 'Euphoria';

  return { score, label };
}

// ── Format helpers ───────────────────────────────────────────────────────────
const fmtPct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtUsd = (v) => {
  if (v == null) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
};

// ── AI summary ───────────────────────────────────────────────────────────────
async function generateSummary(data, apiKey) {
  if (!apiKey) return null;
  const prompt = `Write a 2-sentence morning market briefing headline for a crypto trader. Be direct, specific, actionable. End with a period.

Data:
- BTC: $${data.prices?.bitcoin?.usd?.toFixed(0)} (${fmtPct(data.prices?.bitcoin?.usd_24h_change)} 24h)
- ETH: $${data.prices?.ethereum?.usd?.toFixed(0)} (${fmtPct(data.prices?.ethereum?.usd_24h_change)} 24h)
- Regime: ${data.regime?.label} (score ${data.regime?.score}/100)
- DXY: ${fmtPct(data.indicators?.dxy?.changePct)}
- VIX: ${data.indicators?.vix?.price?.toFixed(1) ?? '?'}
- Top event today: ${data.topEvent?.name ?? 'none'} ${data.topEvent ? `(${data.topEvent.time} ${data.topEvent.imp})` : ''}
- Whale signal: ${data.topWhale ? `${fmtUsd(data.topWhale.amount_usd)} ${data.topWhale.symbol} ${data.topWhale.signal}` : 'quiet'}

Example: "BTC holding $75k after dovish Fed signals, but CPI at 2pm could shift momentum. Watch for volatility expansion around the print."

Write the briefing now. Two sentences max. No markdown.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() ?? null;
  } catch { return null; }
}

// ── Action advice ────────────────────────────────────────────────────────────
async function generateAction(data, apiKey) {
  if (!apiKey) return null;
  const prompt = `Write a 2-sentence actionable takeaway for a crypto trader for today. Based on the data, what should they watch for or do? Be specific. End with a period. No hedging.

Data:
- Regime: ${data.regime?.label} (${data.regime?.score}/100)
- BTC 24h: ${fmtPct(data.prices?.bitcoin?.usd_24h_change)}
- Top events today: ${(data.events ?? []).slice(0,3).map(e => `${e.time} ${e.name} [${e.imp}]`).join(', ') || 'none scheduled'}
- Whale activity: ${data.topWhale ? `${fmtUsd(data.topWhale.amount_usd)} ${data.topWhale.signal}` : 'quiet'}
- Funding bias: ${data.fundingAvg != null ? (data.fundingAvg > 0 ? 'positive (longs paying)' : 'negative (shorts paying)') : 'unknown'}

Example: "With CPI at 2pm, reduce directional exposure before the print. If the number comes in hot, be ready to fade initial move — recent prints have seen reversals within 30 minutes."

Write the action takeaway now. Two sentences max. Direct. No markdown.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() ?? null;
  } catch { return null; }
}

// ── Route ────────────────────────────────────────────────────────────────────
export async function GET(request) {
  if (cache && Date.now() - cacheTs < TTL) return Response.json(cache);

  const base = new URL(request.url).origin;
  const apiKey = getAnthropicKey();

  // Fetch all data sources in parallel
  const [prices, regimeData, events, whaleData, fearGreed, fundingData] = await Promise.all([
    fetchInternal(base, '/api/prices'),
    fetchInternal(base, '/api/macro-regime'),
    fetchInternal(base, '/api/events'),
    fetchInternal(base, '/api/whale'),
    fetchInternal(base, '/api/fear-greed'),
    fetchInternal(base, '/api/funding'),
  ]);

  const indicators = regimeData?.indicators ?? null;
  const regime = classifyRegime(indicators);

  // Pick today's highest-impact event (prefer High > Med > Low)
  const allEvents = events?.items ?? [];
  const high = allEvents.filter(e => e.imp === 'High');
  const med  = allEvents.filter(e => e.imp === 'Medium');
  const todayEvents = [...high, ...med, ...allEvents.filter(e => e.imp === 'Low')].slice(0, 5);
  const topEvent = todayEvents[0] ?? null;

  // Biggest whale transaction (exchange outflow preferred — bullish signal)
  const whales = whaleData?.transactions ?? [];
  const topWhale = whales
    .filter(w => w.amount_usd > 5_000_000) // $5M+
    .sort((a, b) => b.amount_usd - a.amount_usd)[0] ?? null;

  // Compile brief data for AI
  const briefData = {
    prices: prices ? { bitcoin: prices.bitcoin, ethereum: prices.ethereum, solana: prices.solana } : null,
    regime,
    indicators,
    events: todayEvents,
    topEvent,
    topWhale,
    fearGreed: fearGreed?.current ?? null,
    fundingAvg: fundingData?.marketAvg ?? null,
  };

  // Generate AI headline + action in parallel
  const [headline, action] = await Promise.all([
    generateSummary(briefData, apiKey),
    generateAction(briefData, apiKey),
  ]);

  const payload = {
    generatedAt: Date.now(),
    headline,
    action,
    prices: briefData.prices,
    regime,
    indicators,
    events: todayEvents,
    topWhale,
    fearGreed: fearGreed?.current ?? null,
    fundingAvg: fundingData?.marketAvg ?? null,
    btcDominance: prices?.btcDominance ?? null,
  };

  cache = payload;
  cacheTs = Date.now();
  return Response.json(payload);
}
