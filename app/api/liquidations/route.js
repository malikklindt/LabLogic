export const dynamic = 'force-dynamic';

const COINS = [
  { symbol: 'BTC', binance: 'BTCUSDT' },
  { symbol: 'ETH', binance: 'ETHUSDT' },
  { symbol: 'SOL', binance: 'SOLUSDT' },
  { symbol: 'BNB', binance: 'BNBUSDT' },
  { symbol: 'XRP', binance: 'XRPUSDT' },
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

async function fetchCoinData({ symbol, binance }) {
  const base = 'https://fapi.binance.com';

  const [priceR, oiR, lsR] = await Promise.allSettled([
    fetch(`${base}/fapi/v1/ticker/price?symbol=${binance}`,             { cache: 'no-store' }),
    fetch(`${base}/fapi/v1/openInterest?symbol=${binance}`,             { cache: 'no-store' }),
    fetch(`${base}/futures/data/globalLongShortAccountRatio?symbol=${binance}&period=5m&limit=1`, { cache: 'no-store' }),
  ]);

  if (priceR.status !== 'fulfilled' || oiR.status !== 'fulfilled') return null;

  const price    = parseFloat((await priceR.value.json()).price);
  const oiCoins  = parseFloat((await oiR.value.json()).openInterest);
  if (!price || !oiCoins) return null;

  const oiUsd = oiCoins * price;

  // Use real long/short ratio when available, otherwise assume slight long bias
  let longPct = 0.52, shortPct = 0.48;
  if (lsR.status === 'fulfilled') {
    try {
      const lsData = (await lsR.value.json())[0];
      if (lsData?.longAccount) {
        longPct  = parseFloat(lsData.longAccount);
        shortPct = parseFloat(lsData.shortAccount);
      }
    } catch (_) {}
  }

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
