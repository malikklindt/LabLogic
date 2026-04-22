// Prices API
// Provider fallback chain (first success wins, per coin):
//   1. Binance ticker/24hr   — fastest when available; blocked on Vercel US, some VPN regions
//   2. CoinGecko simple/price — works globally but rate-limits free tier (429)
//   3. Coinbase Exchange stats — unauthenticated, global, rock-solid
//   4. Kraken public Ticker   — unauthenticated, global, rock-solid
// 7d change uses Binance klines → CoinGecko market_chart → Coinbase candles chain.
// BTC dominance uses CoinMarketCap /global-metrics (5-min TTL → ~288 calls/day < 333 limit).
// If ALL providers fail, the route serves last-known cache with { stale: true } rather than 500.
import { recordDom } from '@/lib/domHistory';

let cached    = null;
let cachedAt  = 0;
const TTL     = 30_000; // 30s — prices

// Dominance has its own slower cache to respect CMC free-tier limit (333 calls/day)
let cachedDom   = null;
let cachedDomAt = 0;
const TTL_DOM   = 5 * 60_000; // 5 min

async function fetchBinanceTicker(symbol) {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      { cache: 'no-store', signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.lastPrice) return null;
    return data;
  } catch { return null; }
}

// CoinGecko fallback — used when Binance blocks our region (Vercel US)
async function fetchGeckoPrices() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d?.bitcoin?.usd) return null;
    const convert = (key) => d[key] ? {
      lastPrice: String(d[key].usd),
      priceChangePercent: String(d[key].usd_24h_change ?? 0),
    } : null;
    return {
      BTCUSDT: convert('bitcoin'),
      ETHUSDT: convert('ethereum'),
      SOLUSDT: convert('solana'),
    };
  } catch { return null; }
}

// Compute 7d change from CoinGecko market_chart (used when Binance klines blocked)
async function fetchGecko7dChange(id) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=7&interval=daily`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const prices = d?.prices;
    if (!Array.isArray(prices) || prices.length < 2) return null;
    const start = prices[0][1];
    const end   = prices[prices.length - 1][1];
    if (!start || !end) return null;
    return parseFloat(((end - start) / start * 100).toFixed(2));
  } catch { return null; }
}

// Coinbase Exchange — unauthenticated, globally available, reliable
async function fetchCoinbaseStats(productId) {
  try {
    const res = await fetch(
      `https://api.exchange.coinbase.com/products/${productId}/stats`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const last = parseFloat(d.last);
    const open = parseFloat(d.open);
    if (!isFinite(last) || !isFinite(open) || open === 0) return null;
    return {
      lastPrice: String(last),
      priceChangePercent: ((last - open) / open * 100).toFixed(2),
    };
  } catch { return null; }
}

async function fetchCoinbasePrices() {
  const [btc, eth, sol] = await Promise.all([
    fetchCoinbaseStats('BTC-USD'),
    fetchCoinbaseStats('ETH-USD'),
    fetchCoinbaseStats('SOL-USD'),
  ]);
  if (!btc) return null;
  return { BTCUSDT: btc, ETHUSDT: eth, SOLUSDT: sol };
}

// Coinbase candles — 7d change (daily granularity, 8 days to ensure ≥ 2 points)
async function fetchCoinbase7dChange(productId) {
  try {
    const end   = Math.floor(Date.now() / 1000);
    const start = end - 8 * 86400;
    const res = await fetch(
      `https://api.exchange.coinbase.com/products/${productId}/candles?granularity=86400&start=${start}&end=${end}`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!Array.isArray(d) || d.length < 2) return null;
    // Candle: [time, low, high, open, close, volume] — API returns newest first
    const sorted = [...d].sort((a, b) => a[0] - b[0]);
    const open7d = sorted[0][3];
    const close  = sorted[sorted.length - 1][4];
    if (!open7d || !close) return null;
    return parseFloat(((close - open7d) / open7d * 100).toFixed(2));
  } catch { return null; }
}

// Kraken — unauthenticated, globally available, reliable
async function fetchKrakenPrices() {
  try {
    const res = await fetch(
      'https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD',
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.error?.length) return null;
    const r = d?.result;
    if (!r) return null;
    const build = (key) => {
      const t = r[key];
      if (!t) return null;
      const last = parseFloat(t.c?.[0]);
      const open = parseFloat(t.o);
      if (!isFinite(last) || !isFinite(open) || open === 0) return null;
      return {
        lastPrice: String(last),
        priceChangePercent: ((last - open) / open * 100).toFixed(2),
      };
    };
    const btc = build('XXBTZUSD');
    if (!btc) return null;
    return {
      BTCUSDT: btc,
      ETHUSDT: build('XETHZUSD'),
      SOLUSDT: build('SOLUSD'),
    };
  } catch { return null; }
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
    let [btcT, ethT, solT, btc7d, eth7d, sol7d, btcDom] = await Promise.all([
      fetchBinanceTicker('BTCUSDT'),
      fetchBinanceTicker('ETHUSDT'),
      fetchBinanceTicker('SOLUSDT'),
      fetchBinance7dChange('BTCUSDT'),
      fetchBinance7dChange('ETHUSDT'),
      fetchBinance7dChange('SOLUSDT'),
      fetchBtcDominance(),
    ]);

    // Provider fallback chain: Binance → CoinGecko → Coinbase → Kraken
    if (!btcT) {
      const gecko = await fetchGeckoPrices();
      if (gecko) {
        btcT = gecko.BTCUSDT; ethT = gecko.ETHUSDT; solT = gecko.SOLUSDT;
      }
    }
    if (!btcT) {
      const cb = await fetchCoinbasePrices();
      if (cb) {
        btcT = cb.BTCUSDT; ethT = cb.ETHUSDT; solT = cb.SOLUSDT;
      }
    }
    if (!btcT) {
      const kr = await fetchKrakenPrices();
      if (kr) {
        btcT = kr.BTCUSDT; ethT = kr.ETHUSDT; solT = kr.SOLUSDT;
      }
    }
    // 7d change: Binance klines → CoinGecko market_chart → Coinbase candles
    if (btc7d == null || eth7d == null || sol7d == null) {
      const [b7, e7, s7] = await Promise.all([
        btc7d == null ? fetchGecko7dChange('bitcoin')  : Promise.resolve(btc7d),
        eth7d == null ? fetchGecko7dChange('ethereum') : Promise.resolve(eth7d),
        sol7d == null ? fetchGecko7dChange('solana')   : Promise.resolve(sol7d),
      ]);
      btc7d = b7; eth7d = e7; sol7d = s7;
    }
    if (btc7d == null || eth7d == null || sol7d == null) {
      const [b7, e7, s7] = await Promise.all([
        btc7d == null ? fetchCoinbase7dChange('BTC-USD') : Promise.resolve(btc7d),
        eth7d == null ? fetchCoinbase7dChange('ETH-USD') : Promise.resolve(eth7d),
        sol7d == null ? fetchCoinbase7dChange('SOL-USD') : Promise.resolve(sol7d),
      ]);
      btc7d = b7; eth7d = e7; sol7d = s7;
    }

    if (!btcT) throw new Error('BTC ticker unavailable (all providers failed)');

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
    // Serve last-known cache with staleness indicator — better than a 500 to the UI.
    if (cached) {
      return Response.json({ ...cached, stale: true, stalenessMs: Date.now() - cachedAt });
    }
    return Response.json({ error: e.message }, { status: 503 });
  }
}
