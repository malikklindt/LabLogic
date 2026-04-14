import { readFileSync } from 'fs';
import { join } from 'path';

const CACHE_TTL = 60_000;
let cache = { data: null, ts: 0 };

function getFinnhubKey() {
  if (process.env.FINNHUB_KEY) return process.env.FINNHUB_KEY;
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    const m = content.match(/^FINNHUB_KEY=(.+)$/m);
    return m?.[1]?.trim() ?? null;
  } catch { return null; }
}

const MACRO = [
  { symbol: 'SPY',  label: 'S&P 500',   color: '#6366f1', unit: '' },
  { symbol: 'GLD',  label: 'Gold',      color: '#f59e0b', unit: '' },
  { symbol: 'CPER', label: 'Copper',    color: '#f97316', unit: '' }, // United States Copper Index Fund
  { symbol: 'USO',  label: 'Crude Oil', color: '#84cc16', unit: '' }, // United States Oil Fund
];

async function fetchCryptoCoins() {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h,7d',
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`CoinGecko coins ${res.status}`);
  return res.json();
}

async function fetchCryptoGlobal() {
  const res = await fetch('https://api.coingecko.com/api/v3/global', {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`CoinGecko global ${res.status}`);
  const { data } = await res.json();
  return {
    btc_dominance: data.market_cap_percentage?.btc ?? null,
    total_market_cap_usd: data.total_market_cap?.usd ?? null,
    market_cap_change_24h: data.market_cap_change_percentage_24h_usd ?? null,
  };
}

async function fetchQuote(symbol, key) {
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
    { signal: AbortSignal.timeout(6_000) }
  );
  if (!res.ok) return null;
  const d = await res.json();
  if (!d?.c || d.c === 0) return null;
  return { price: d.c, change: d.d, changePct: d.dp, high: d.h, low: d.l, prevClose: d.pc };
}

async function fetchCandles(symbol, key) {
  const to   = Math.floor(Date.now() / 1000);
  const from = to - 45 * 24 * 3600; // 45 days to ensure ~30 trading days
  const res  = await fetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${key}`,
    { signal: AbortSignal.timeout(6_000) }
  );
  if (!res.ok) return null;
  const d = await res.json();
  if (d.s !== 'ok' || !Array.isArray(d.c) || d.c.length === 0) return null;
  return d.c.slice(-30); // last 30 data points
}

export async function GET() {
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return Response.json(cache.data);
  }

  const finnhubKey = getFinnhubKey();

  // Fetch crypto + global in parallel
  const [coinsResult, globalResult] = await Promise.allSettled([
    fetchCryptoCoins(),
    fetchCryptoGlobal(),
  ]);

  // Fetch macro quotes + candles in parallel
  const macroResults = await Promise.allSettled(
    MACRO.map(async (asset) => {
      const [quoteResult, candlesResult] = await Promise.allSettled([
        finnhubKey ? fetchQuote(asset.symbol, finnhubKey) : Promise.resolve(null),
        finnhubKey ? fetchCandles(asset.symbol, finnhubKey) : Promise.resolve(null),
      ]);
      return {
        ...asset,
        quote:   quoteResult.status   === 'fulfilled' ? quoteResult.value   : null,
        candles: candlesResult.status === 'fulfilled' ? candlesResult.value : null,
      };
    })
  );

  const coins  = coinsResult.status  === 'fulfilled' ? coinsResult.value  : [];
  const global = globalResult.status === 'fulfilled' ? globalResult.value : null;
  const macro  = macroResults.map(r  => r.status === 'fulfilled' ? r.value : null).filter(Boolean);

  const data = { coins, global, macro, updatedAt: Date.now(), mock: coins.length === 0 };
  cache = { data, ts: Date.now() };

  return Response.json(data);
}
