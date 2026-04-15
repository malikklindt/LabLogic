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
    // OKX (works ✓)
    testFetch('okx-funding-btc', 'https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP'),
    // Deribit (we already use for volatility — should work)
    testFetch('deribit-funding', 'https://www.deribit.com/api/v2/public/get_funding_rate_value?instrument_name=BTC-PERPETUAL&start_timestamp=0&end_timestamp=9999999999999'),
    // BitMEX
    testFetch('bitmex-funding', 'https://www.bitmex.com/api/v1/funding?symbol=XBTUSDT&count=1&reverse=true'),
    // Hyperliquid (popular alternative)
    testFetch('hyperliquid-meta', 'https://api.hyperliquid.xyz/info', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'metaAndAssetCtxs'}) }),
    // Kraken Futures
    testFetch('kraken-tickers', 'https://futures.kraken.com/derivatives/api/v3/tickers'),
    // Gate.io
    testFetch('gate-funding',   'https://api.gateio.ws/api/v4/futures/usdt/funding_rate/BTC_USDT'),
    // MEXC
    testFetch('mexc-funding',   'https://contract.mexc.com/api/v1/contract/funding_rate/BTC_USDT'),
  ]);

  return Response.json(results);
}
