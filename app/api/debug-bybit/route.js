export const dynamic = 'force-dynamic';

async function testFetch(label, url, opts = {}) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000), ...opts });
    const text = await res.text();
    return { label, ok: res.ok, status: res.status, bodyLen: text.length, snippet: text.slice(0, 180) };
  } catch (e) {
    return { label, error: e.message, name: e.name };
  }
}

export async function GET() {
  const results = await Promise.all([
    // Bybit (blocked on Vercel US — 403)
    testFetch('bybit-tickers-filtered', 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT'),
    testFetch('bybit-tickers-all',      'https://api.bybit.com/v5/market/tickers?category=linear'),
    testFetch('bybit-funding-hist',     'https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=5'),
    // OKX
    testFetch('okx-ticker',    'https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT-SWAP'),
    testFetch('okx-oi',        'https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP'),
    testFetch('okx-funding',   'https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP'),
    testFetch('okx-fundhist',  'https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=5'),
    // Binance retest
    testFetch('binance-spot',  'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
    testFetch('binance-fut',   'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'),
    // Coinglass (if they have public)
    testFetch('coinglass-oi',  'https://open-api.coinglass.com/public/v2/open_interest?symbol=BTC'),
  ]);

  return Response.json(results);
}
