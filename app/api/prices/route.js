// Prices API
// Binance ticker/24hr (per-symbol) — price + 24h change
// Binance klines                   — 7d change
// CoinMarketCap /global-metrics    — BTC dominance (free key, 5-min TTL → ~288 calls/day < 333 limit)
import { recordDom } from '@/lib/domHistory';

let cached    = null;
let cachedAt  = 0;
const TTL     = 30_000; // 30s — prices

// Dominance has its own slower cache to respect CMC free-tier limit (333 calls/day)
let cachedDom   = null;
let cachedDomAt = 0;
const TTL_DOM   = 5 * 60_000; // 5 min

async function fetchBinanceTicker(symbol) {
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
    { cache: 'no-store', signal: AbortSignal.timeout(7000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.lastPrice) return null;
  return data;
}

async function fetchBinance7dChange(symbol) {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=8`,
    { cache: 'no-store', signal: AbortSignal.timeout(7000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length < 2) return null;
  const open7d = parseFloat(data[0][4]);
  const close  = parseFloat(data[data.length - 1][4]);
  if (!open7d || !close) return null;
  return parseFloat(((close - open7d) / open7d * 100).toFixed(2));
}

async function fetchBtcDominance() {
  // Serve from slow cache if still fresh (5-min TTL to respect CMC 333 calls/day free limit)
  if (cachedDom !== null && Date.now() - cachedDomAt < TTL_DOM) return cachedDom;

  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) {
    console.warn('[Prices] CMC_API_KEY not set — BTC dominance unavailable');
    return cachedDom; // return last known value if key missing
  }

  const res = await fetch(
    'https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest',
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
      headers: { 'X-CMC_PRO_API_KEY': apiKey, 'Accept': 'application/json' },
    }
  );
  if (!res.ok) {
    console.warn(`[Prices] CMC dominance HTTP ${res.status}`);
    return cachedDom; // stale on error
  }
  const data = await res.json();
  const pct  = parseFloat(data?.data?.btc_dominance);
  if (!isFinite(pct)) return cachedDom;

  cachedDom   = pct;
  cachedDomAt = Date.now();
  return pct;
}

export async function GET() {
  if (cached && Date.now() - cachedAt < TTL) {
    return Response.json(cached);
  }

  try {
    const [btcT, ethT, solT, btc7d, eth7d, sol7d, btcDom] = await Promise.all([
      fetchBinanceTicker('BTCUSDT'),
      fetchBinanceTicker('ETHUSDT'),
      fetchBinanceTicker('SOLUSDT'),
      fetchBinance7dChange('BTCUSDT'),
      fetchBinance7dChange('ETHUSDT'),
      fetchBinance7dChange('SOLUSDT'),
      fetchBtcDominance(),
    ]);

    if (!btcT) throw new Error('BTC ticker unavailable');

    const payload = {
      bitcoin: {
        usd:            parseFloat(btcT.lastPrice),
        usd_24h_change: parseFloat(parseFloat(btcT.priceChangePercent).toFixed(2)),
        usd_7d_change:  btc7d ?? 0,
      },
      ethereum: ethT ? {
        usd:            parseFloat(ethT.lastPrice),
        usd_24h_change: parseFloat(parseFloat(ethT.priceChangePercent).toFixed(2)),
        usd_7d_change:  eth7d ?? 0,
      } : null,
      solana: solT ? {
        usd:            parseFloat(solT.lastPrice),
        usd_24h_change: parseFloat(parseFloat(solT.priceChangePercent).toFixed(2)),
        usd_7d_change:  sol7d ?? 0,
      } : null,
      btcDominance: btcDom ?? (cached?.btcDominance ?? null),
    };

    const liveDom = btcDom ?? cached?.btcDominance;
    if (liveDom != null) recordDom(liveDom);

    cached   = payload;
    cachedAt = Date.now();
    return Response.json(payload);
  } catch (e) {
    console.error('[Prices] fetch failed:', e.message);
    if (cached) return Response.json(cached);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
