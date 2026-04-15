export const dynamic = 'force-dynamic';

export async function GET() {
  const results = {};

  // Test 1: Bybit tickers (used by liquidations fallback)
  try {
    const res = await fetch(
      'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT',
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    const text = await res.text();
    results.bybitTickers = {
      ok: res.ok,
      status: res.status,
      bodyLen: text.length,
      snippet: text.slice(0, 300),
    };
  } catch (e) {
    results.bybitTickers = { error: e.message, name: e.name };
  }

  // Test 2: Bybit funding history
  try {
    const res = await fetch(
      'https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=5',
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    const text = await res.text();
    results.bybitFunding = {
      ok: res.ok,
      status: res.status,
      bodyLen: text.length,
      snippet: text.slice(0, 300),
    };
  } catch (e) {
    results.bybitFunding = { error: e.message, name: e.name };
  }

  return Response.json(results);
}
