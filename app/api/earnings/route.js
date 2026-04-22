// Earnings data doesn't change intra-day — cache aggressively.
// FMP demo key is ~25 calls/day, NASDAQ unauth is also limited → caching is critical.
let cache    = null;
let cacheAt  = 0;
let cacheDay = null;
const TTL    = 10 * 60_000; // 10 min

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export async function GET() {
  const today = todayStr();

  // Fresh cache — serve immediately
  if (cache && cacheDay === today && Date.now() - cacheAt < TTL) {
    return Response.json(cache);
  }

  // ── Primary: Financial Modeling Prep (free demo key) ─────────────────────
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/earning_calendar?from=${today}&to=${today}&apikey=demo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(7000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const items = data.slice(0, 25).map(e => ({
          time:    e.time === 'bmo' ? 'BMO' : e.time === 'amc' ? 'AMC' : (e.time || '--').toUpperCase(),
          flag:    '🇺🇸',
          name:    e.symbol,
          ticker:  e.symbol,
          eps_est: e.epsEstimated != null ? `$${Number(e.epsEstimated).toFixed(2)}` : null,
          eps_act: e.eps          != null ? `$${Number(e.eps).toFixed(2)}`          : null,
          rev_est: e.revenueEstimated != null
            ? (e.revenueEstimated >= 1e9
                ? `$${(e.revenueEstimated / 1e9).toFixed(1)}B`
                : `$${(e.revenueEstimated / 1e6).toFixed(0)}M`)
            : null,
          imp:     'Medium',
        }));
        cache = { items, source: 'fmp' };
        cacheAt = Date.now();
        cacheDay = today;
        return Response.json(cache);
      }
    }
  } catch (e) {
    console.error('[Earnings FMP]', e.message);
  }

  // ── Fallback: NASDAQ public calendar ─────────────────────────────────────
  try {
    const res = await fetch(
      `https://api.nasdaq.com/api/calendar/earnings?date=${today}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const rows = data?.data?.rows ?? [];
      if (rows.length > 0) {
        const items = rows.slice(0, 25).map(r => ({
          time:    r.time?.toLowerCase().includes('before') ? 'BMO'
                 : r.time?.toLowerCase().includes('after')  ? 'AMC' : '--',
          flag:    '🇺🇸',
          name:    r.name || r.symbol,
          ticker:  r.symbol || '',
          eps_est: r.eps_forecast || null,
          eps_act: (r.eps && r.eps !== '--') ? r.eps : null,
          rev_est: null,
          imp:     'Medium',
        }));
        cache = { items, source: 'nasdaq' };
        cacheAt = Date.now();
        cacheDay = today;
        return Response.json(cache);
      }
    }
  } catch (e) {
    console.error('[Earnings NASDAQ]', e.message);
  }

  // Both providers dead — serve stale cache (even stale/day-old data beats an
  // empty list) before giving up.
  if (cache?.items?.length) {
    return Response.json({ ...cache, stale: true, stalenessMs: Date.now() - cacheAt });
  }

  return Response.json({ items: [], source: 'unavailable', note: 'Earnings data unavailable today' });
}
