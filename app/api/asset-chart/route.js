import { readFileSync } from 'fs';
import { join } from 'path';

const CACHE     = new Map();
const CACHE_TTL = 60 * 60 * 1_000; // 1 hour — chart data doesn't need to be fresh
const ERR_TTL   = 30_000;           // retry errors after 30s

function getFinnhubKey() {
  if (process.env.FINNHUB_KEY) return process.env.FINNHUB_KEY;
  try {
    const c = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    return c.match(/^FINNHUB_KEY=(.+)$/m)?.[1]?.trim() ?? null;
  } catch { return null; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type   = searchParams.get('type');
  const id     = searchParams.get('id');     // CoinGecko id  (crypto)
  const symbol = searchParams.get('symbol'); // Finnhub symbol (macro)

  const cacheKey = `${type}:${id ?? symbol}`;
  const hit = CACHE.get(cacheKey);
  const ttl = hit?.error ? ERR_TTL : CACHE_TTL;
  if (hit && Date.now() - hit.ts < ttl) return Response.json(hit.data, { status: hit.error ? 502 : 200 });

  try {
    if (type === 'crypto') {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=365&interval=daily`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      const raw = await res.json();
      const data = {
        prices:  (raw.prices       ?? []).map(([ts, v]) => ({ ts, price: v })),
        volumes: (raw.total_volumes ?? []).map(([ts, v]) => ({ ts, value: v })),
      };
      CACHE.set(cacheKey, { data, ts: Date.now() });
      return Response.json(data);
    }

    if (type === 'macro') {
      const key = getFinnhubKey();
      const to  = Math.floor(Date.now() / 1000);

      // Try progressively shorter ranges — free tier allows candles but has daily limits
      const RANGES = [365, 180, 90];
      let prices = null;

      for (const days of RANGES) {
        const from = to - days * 24 * 3600;
        const res  = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${key}`,
          { signal: AbortSignal.timeout(8_000) }
        );
        if (!res.ok) continue; // try shorter range
        const d = await res.json();
        if (d.s !== 'ok' || !d.c?.length) continue;
        prices = d.t.map((ts, i) => ({ ts: ts * 1000, price: d.c[i] }));
        break;
      }

      if (!prices?.length) throw new Error('Finnhub candle rate limited — retry in a moment');
      const data = { prices, volumes: [] };
      CACHE.set(cacheKey, { data, ts: Date.now() });
      return Response.json(data);
    }

    return Response.json({ error: 'invalid type' }, { status: 400 });
  } catch (e) {
    CACHE.set(cacheKey, { data: { error: e.message }, ts: Date.now(), error: true });
    return Response.json({ error: e.message }, { status: 502 });
  }
}
