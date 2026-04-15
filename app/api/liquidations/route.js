export const dynamic = 'force-dynamic';

const COINS = [
  { symbol: 'BTC', binance: 'BTCUSDT', bybit: 'BTCUSDT' },
  { symbol: 'ETH', binance: 'ETHUSDT', bybit: 'ETHUSDT' },
  { symbol: 'SOL', binance: 'SOLUSDT', bybit: 'SOLUSDT' },
  { symbol: 'BNB', binance: 'BNBUSDT', bybit: 'BNBUSDT' },
  { symbol: 'XRP', binance: 'XRPUSDT', bybit: 'XRPUSDT' },
];

// Realistic leverage distribution based on exchange research
// (approximate % of open interest at each leverage tier)
const LEV_DIST = [
  { lev: 100, share: 0.04 },
  { lev: 50,  share: 0.08 },
  { lev: 25,  share: 0.13 },
  { lev: 20,  share: 0.22 },
  { lev: 10,  share: 0.33 },
  { lev: 5,   share: 0.20 },
];

let cache = null, cacheTs = 0;
const TTL = 5 * 60 * 1000; // 5 min

async function fetchFromBinance(binance) {
  try {
    const base = 'https://fapi.binance.com';
    const [priceR, oiR, lsR] = await Promise.allSettled([
      fetch(`${base}/fapi/v1/ticker/price?symbol=${binance}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) }),
      fetch(`${base}/fapi/v1/openInterest?symbol=${binance}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) }),
      fetch(`${base}/futures/data/globalLongShortAccountRatio?symbol=${binance}&period=5m&limit=1`, { cache: 'no-store', signal: AbortSignal.timeout(6000) }),
    ]);
    if (priceR.status !== 'fulfilled' || oiR.status !== 'fulfilled') return null;
    if (!priceR.value.ok || !oiR.value.ok) return null;
    const price   = parseFloat((await priceR.value.json()).price);
    const oiCoins = parseFloat((await oiR.value.json()).openInterest);
    if (!price || !oiCoins) return null;

    let longPct = 0.52, shortPct = 0.48;
    if (lsR.status === 'fulfilled' && lsR.value.ok) {
      try {
        const lsData = (await lsR.value.json())[0];
        if (lsData?.longAccount) {
          longPct  = parseFloat(lsData.longAccount);
          shortPct = parseFloat(lsData.shortAccount);
        }
      } catch {}
    }
    return { price, oiCoins, longPct, shortPct };
  } catch { return null; }
}

async function fetchFromBybit(bybit) {
  try {
    // Bybit ticker has: lastPrice + openInterest (in coin units)
    const res = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${bybit}`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.result?.list?.[0];
    if (!item) return null;
    const price   = parseFloat(item.lastPrice);
    const oiCoins = parseFloat(item.openInterest);
    if (!price || !oiCoins) return null;
    // Bybit doesn't expose long/short account ratio publicly — use neutral default
    return { price, oiCoins, longPct: 0.52, shortPct: 0.48 };
  } catch { return null; }
}

async function fetchCoinData({ symbol, binance, bybit }) {
  let data = await fetchFromBinance(binance);
  if (!data) data = await fetchFromBybit(bybit);
  if (!data) return null;

  const { price, oiCoins, longPct, shortPct } = data;
  const oiUsd = oiCoins * price;

  // Build liquidation level ladder
  const levels = [];
  for (const { lev, share } of LEV_DIST) {
    const movePct = (1 / lev) * 100;
    // Long liq = price drops (triggers at -movePct%)
    levels.push({
      type:      'long',
      leverage:  lev,
      pricePct:  -movePct,
      price:     price * (1 - 1 / lev),
      usd:       oiUsd * longPct * share,
    });
    // Short liq = price rises (triggers at +movePct%)
    levels.push({
      type:      'short',
      leverage:  lev,
      pricePct:  movePct,
      price:     price * (1 + 1 / lev),
      usd:       oiUsd * shortPct * share,
    });
  }

  return { symbol, price, oiUsd, longPct, shortPct, levels };
}

export async function GET() {
  if (cache && Date.now() - cacheTs < TTL) return Response.json(cache);

  const results = await Promise.allSettled(COINS.map(fetchCoinData));
  const coins   = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  const data = { coins, ts: Date.now() };
  cache = data; cacheTs = Date.now();
  return Response.json(data);
}
