// Chart history API
// Binance klines for BTC/ETH/SOL (no auth, no rate limits)
// BTC.D: served from the shared domHistory buffer (filled by prices API every ~30s)
//        CoinGecko used ONLY as cold-start bootstrap when buffer has < 5 readings

import { queryDom, domCount } from '@/lib/domHistory';

const COIN_TO_SYMBOL = {
  bitcoin:  'BTCUSDT',
  ethereum: 'ETHUSDT',
  solana:   'SOLUSDT',
};

// Per-key cache: { [cacheKey]: { data, at } }
const cache = {};
const TTL         = 5      * 60_000; // 5 min  — Binance prices
const TTL_BTCD_CG = 24 * 60 * 60_000; // 24 h  — CoinGecko historical, one call per day

// ── BTC.D cold-start bootstrap (CoinGecko, only when buffer is empty) ─────────
// Two parallel calls: BTC market cap history + total market cap history
// Dominance = BTC mcap / total mcap × 100
async function fetchBTCDFromCoinGecko(days) {
  const opts = { cache: 'no-store', signal: AbortSignal.timeout(7000) };
  const [btcRes, globalRes] = await Promise.all([
    fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`, opts),
    fetch(`https://api.coingecko.com/api/v3/global/market_cap_chart?days=${days}`, opts),
  ]);
  if (!btcRes.ok || !globalRes.ok) throw new Error(`CoinGecko HTTP ${btcRes.status}/${globalRes.status}`);

  const btcData    = await btcRes.json();
  const globalData = await globalRes.json();
  const btcMcaps   = btcData?.market_caps;
  const totalMcaps = globalData?.market_cap_chart?.market_cap;
  if (!Array.isArray(btcMcaps) || !Array.isArray(totalMcaps)) throw new Error('Unexpected CoinGecko shape');

  const totalByDay = {};
  for (const [ts, mcap] of totalMcaps) totalByDay[Math.floor(ts / 86_400_000)] = mcap;

  const prices = btcMcaps
    .map(([ts, btcMcap]) => {
      const day   = Math.floor(ts / 86_400_000);
      const total = totalByDay[day] ?? totalByDay[day - 1] ?? totalByDay[day + 1];
      if (!total || !btcMcap) return null;
      return [ts, parseFloat(((btcMcap / total) * 100).toFixed(3))];
    })
    .filter(Boolean);

  if (prices.length < 3) throw new Error(`Only ${prices.length} points`);
  return { prices };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const coin     = searchParams.get('coin') || 'bitcoin';
  const days     = parseInt(searchParams.get('days') || '90', 10);
  const interval = searchParams.get('interval') || 'daily';

  // ── BTC Dominance ─────────────────────────────────────────────────────────
  if (coin === 'btcd') {
    // Always fetch 30 days from CoinGecko — one shared key, cached 24h.
    // Slicing to the requested TF happens below, so all three TF buttons
    // share the same single upstream call instead of triggering three separate ones.
    const BTCD_KEY = 'btcd-cg-30d';
    let historical = [];

    if (cache[BTCD_KEY] && Date.now() - cache[BTCD_KEY].at < TTL_BTCD_CG) {
      historical = cache[BTCD_KEY].data;
    } else {
      try {
        const payload  = await fetchBTCDFromCoinGecko(30);
        cache[BTCD_KEY] = { data: payload.prices, at: Date.now() };
        historical      = payload.prices;
        console.log(`[Chart] BTC.D: CoinGecko 30d seed — ${historical.length} pts (cached 24h)`);
      } catch (e) {
        console.warn('[Chart] BTC.D CoinGecko failed:', e.message);
        if (cache[BTCD_KEY]) historical = cache[BTCD_KEY].data; // serve stale on error
      }
    }

    // Slice to the requested timeframe
    const cutoff = Date.now() - days * 24 * 60 * 60_000;
    const slice  = historical.filter(([ts]) => ts >= cutoff);

    // Merge with live readings from domHistory buffer (finer-grained recent data)
    const live = queryDom(cutoff);
    let prices;

    if (live.length === 0) {
      prices = slice;
    } else if (slice.length === 0) {
      prices = live;
    } else {
      const liveStart = live[0][0];
      const base      = slice.filter(([ts]) => ts < liveStart);
      prices          = [...base, ...live].sort((a, b) => a[0] - b[0]);
    }

    console.log(`[Chart] BTC.D ${days}d: ${slice.length} historical + ${live.length} live = ${prices.length} pts`);
    return Response.json({ prices });
  }

  // ── Binance coins ─────────────────────────────────────────────────────────
  const symbol = COIN_TO_SYMBOL[coin];
  if (!symbol) {
    return Response.json({ error: `Unknown coin: ${coin}` }, { status: 400 });
  }

  const cacheKey = `${coin}-${days}-${interval}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].at < TTL) {
    return Response.json(cache[cacheKey].data);
  }

  const binanceInterval = interval === 'hourly' ? '1h' : '1d';
  const limit = interval === 'hourly'
    ? Math.min(days * 24, 1000)
    : Math.min(days + 1, 1000);

  try {
    let prices = null;

    // Try Binance first
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`,
        { cache: 'no-store', signal: AbortSignal.timeout(7000) }
      );
      if (res.ok) {
        const klines = await res.json();
        if (Array.isArray(klines) && klines.length) {
          prices = klines.map(c => [c[0], parseFloat(c[4])]);
        }
      }
    } catch (_) { /* fall through to CoinGecko */ }

    // Fall back to CoinGecko if Binance blocked (Vercel US regions)
    // Retry up to 3 times with backoff — CoinGecko free tier rate-limits bursts
    if (!prices || !prices.length) {
      const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      let lastStatus = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt)); // 800ms, 1600ms
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        lastStatus = res.status;
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.prices) && data.prices.length) {
            prices = data.prices;
            break;
          }
        } else if (res.status !== 429 && res.status !== 503) {
          break; // non-retryable error
        }
      }
      if (!prices || !prices.length) throw new Error(`CoinGecko failed after retries (status ${lastStatus})`);
    }

    if (!prices || !prices.length) throw new Error('No price data returned');

    const payload = { prices };
    // Only cache successful responses — never cache empty/failed results
    if (prices && prices.length > 0) {
      cache[cacheKey] = { data: payload, at: Date.now() };
    }
    return Response.json(payload);
  } catch (e) {
    console.error(`[Chart] ${coin} fetch failed:`, e.message);
    // Serve any stale cache (even if past TTL) as a last resort
    if (cache[cacheKey]) {
      console.warn(`[Chart] Serving stale cache for ${cacheKey}`);
      return Response.json(cache[cacheKey].data);
    }
    if (cache[cacheKey]) return Response.json(cache[cacheKey].data);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
