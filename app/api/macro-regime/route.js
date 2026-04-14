import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// ── Keys ────────────────────────────────────────────────────────────────────
function getFinnhubKey() {
  if (process.env.FINNHUB_KEY) return process.env.FINNHUB_KEY;
  try {
    const c = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    return c.match(/^FINNHUB_KEY=(.+)$/m)?.[1]?.trim() ?? null;
  } catch { return null; }
}

// ── Cache ───────────────────────────────────────────────────────────────────
let cache = null, cacheTs = 0;
const TTL = 5 * 60 * 1000; // 5 min

// ── Fetch a Finnhub quote ──────────────────────────────────────────────────
async function quote(symbol, key) {
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  const d = await res.json();
  return d?.c ? { price: d.c, change: d.d, changePct: d.dp } : null;
}

export async function GET(request) {
  if (cache && Date.now() - cacheTs < TTL) return Response.json(cache);

  const key = getFinnhubKey();
  if (!key) return Response.json({ error: 'No Finnhub key' }, { status: 500 });

  // Derive base URL from request to work in any environment
  const base = new URL(request.url).origin;

  try {
    // Fetch all macro indicators in parallel
    const [dxy, vix, bonds, spy] = await Promise.allSettled([
      quote('UUP', key),    // Dollar index proxy (Invesco DB USD Index)
      quote('VIXY', key),   // VIX proxy (ProShares VIX Short-Term)
      quote('TLT', key),    // 20+ Year Treasury Bond ETF (inverse proxy for yields)
      quote('SPY', key),    // S&P 500
    ]);

    // Also fetch BTC + funding from our own APIs
    const [btcRes, fundingRes] = await Promise.allSettled([
      fetch(`${base}/api/prices`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`${base}/api/funding`, { cache: 'no-store' }).then(r => r.json()),
    ]);

    const btcData = btcRes.status === 'fulfilled' ? btcRes.value : {};
    const fundingData = fundingRes.status === 'fulfilled' ? fundingRes.value : {};

    const indicators = {
      dxy:     dxy.status     === 'fulfilled' ? dxy.value     : null,
      vix:     vix.status     === 'fulfilled' ? vix.value     : null,
      bonds:   bonds.status   === 'fulfilled' ? bonds.value   : null,
      spy:     spy.status     === 'fulfilled' ? spy.value     : null,
      btc: {
        price:    btcData.bitcoin?.usd ?? null,
        chg24h:   btcData.bitcoin?.usd_24h_change ?? null,
        chg7d:    btcData.bitcoin?.usd_7d_change ?? null,
        dominance: btcData.btcDominance ?? null,
      },
      funding: {
        avgRate: fundingData.marketAvg ?? null,
      },
    };

    const data = { indicators, ts: Date.now() };
    cache = data; cacheTs = Date.now();
    return Response.json(data);

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
