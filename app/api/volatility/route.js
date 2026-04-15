function calcRV(prices) {
  if (prices.length < 2) return 0;
  const logs = [];
  for (let i = 1; i < prices.length; i++) logs.push(Math.log(prices[i] / prices[i - 1]));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance = logs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / logs.length;
  return Math.sqrt(variance) * Math.sqrt(365) * 100;
}

function rvSpark(slice) {
  return slice.map((_, i, a) => {
    if (i < 2) return parseFloat(calcRV(a.slice(0, Math.min(3, a.length))).toFixed(1));
    return parseFloat(calcRV(a.slice(0, i + 1)).toFixed(1));
  });
}

function ivSpark(dvolHistorical, ivLive, days) {
  if (dvolHistorical.length > 0) {
    const step = Math.max(1, Math.floor(dvolHistorical.length / days));
    return Array.from({ length: days }, (_, i) =>
      dvolHistorical[Math.min(i * step, dvolHistorical.length - 1)]
    );
  }
  return Array.from({ length: days }, () => ivLive ?? 72);
}

export async function GET() {
  let ivLive = null;
  let dvolHistorical = [];

  // Primary: Deribit spot index
  try {
    const res = await fetch('https://www.deribit.com/api/v2/public/get_index_price?index_name=btcdvol_usdc');
    const data = await res.json();
    const val = data?.result?.index_price;
    if (val != null && val > 0) ivLive = Math.round(val);
  } catch (_) {
    // Fallback: last hourly candle close
    try {
      const now = Date.now();
      const res = await fetch(
        `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&resolution=3600&start_timestamp=${now - 86400000}&end_timestamp=${now}`
      );
      const data = await res.json();
      const rows = data?.result?.data ?? [];
      if (rows.length > 0) {
        const last = rows[rows.length - 1][4];
        if (last > 0) ivLive = Math.round(last);
      }
    } catch (_) {}
  }

  // Historical DVOL 90d daily for sparklines
  try {
    const now = Date.now();
    const start = now - 90 * 86400000;
    const res = await fetch(
      `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=${start}&end_timestamp=${now}&resolution=86400`
    );
    const data = await res.json();
    dvolHistorical = (data?.result?.data ?? []).map(d => d[4]);
  } catch (_) {}

  // RV from daily BTC candles — CoinGecko first (Binance blocked on Vercel US)
  async function fetchCandles(days) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`,
        { cache: 'no-store', signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.prices) && data.prices.length) {
          return data.prices.map(p => p[1]);
        }
      }
    } catch {}
    // Binance fallback
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=${days + 1}`,
        { cache: 'no-store', signal: AbortSignal.timeout(7000) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data.map(c => parseFloat(c[4])) : [];
    } catch { return []; }
  }

  let rv = null;
  const btcPrices30 = await fetchCandles(30);
  if (btcPrices30.length > 1) rv = parseFloat(calcRV(btcPrices30).toFixed(1));
  const btcPrices90 = await fetchCandles(90);

  const volHistory = {
    '1W': { iv: ivSpark(dvolHistorical, ivLive, 7),  rv: rvSpark(btcPrices30.slice(-8)) },
    '1M': { iv: ivSpark(dvolHistorical, ivLive, 30), rv: rvSpark(btcPrices30) },
    '3M': { iv: ivSpark(dvolHistorical, ivLive, 90), rv: rvSpark(btcPrices90.length > 0 ? btcPrices90 : btcPrices30) },
  };

  return Response.json({ iv: ivLive, rv, volHistory });
}
