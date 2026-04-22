// ══════════════════════════════════════════════════════════════════════════════
//  Bitcoin Correlations — Production-grade methodology
//
//  Pipeline (strictly in this order):
//    1. Fetch raw price data (400 days to support 180-day window + buffer)
//    2. Normalize all timestamps → UTC 'YYYY-MM-DD'
//    3. Deduplicate (keep last close per day)
//    4. Forward-fill TradFi across every calendar day (weekends/holidays)
//    5. Align BTC + asset on exact UTC date matches
//    6. Compute log returns AFTER alignment  ← CRITICAL ORDER
//    7. Pearson correlation on those returns
//
//  Window sizes (minimum data per timeframe):
//    1W → 30 days   (≥30 aligned points required)
//    1M → 90 days   (≥90 aligned points required)
//    3M → 180 days  (≥180 aligned points required)
//
//  M2 special case: Year-over-Year % change (not monthly log returns)
//  Gold source: XAUUSD=X spot price (avoids futures roll distortion)
// ══════════════════════════════════════════════════════════════════════════════

let cache = { result: null, fetchedAt: 0 };
const CACHE_TTL = 4 * 60 * 60_000; // 4 hours — correlations don't need sub-hourly updates

const TF_WINDOWS = { '1W': 30, '1M': 90, '3M': 180 };

// ── Math ──────────────────────────────────────────────────────────────────────

function logRet(prev, curr) {
  return prev > 0 && curr > 0 ? Math.log(curr / prev) : null;
}

// Pearson correlation on two arrays of numbers; returns integer in -100..100
function pearson(x, y) {
  const pairs = [];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    if (x[i] != null && y[i] != null && isFinite(x[i]) && isFinite(y[i])) {
      pairs.push([x[i], y[i]]);
    }
  }
  if (pairs.length < 10) return null; // need at least 10 valid pairs
  const np = pairs.length;
  const mx = pairs.reduce((s, [a]) => s + a, 0) / np;
  const my = pairs.reduce((s, [, b]) => s + b, 0) / np;
  let num = 0, dx2 = 0, dy2 = 0;
  for (const [a, b] of pairs) {
    const da = a - mx, db = b - my;
    num += da * db; dx2 += da * da; dy2 += db * db;
  }
  if (dx2 * dy2 <= 0) return null;
  return Math.round((num / Math.sqrt(dx2 * dy2)) * 100); // -100 to 100
}

function normalizeArr(arr) {
  const first = arr?.find(v => v != null && isFinite(v) && v > 0);
  if (!first) return arr ?? [];
  return arr.map(v => v != null ? parseFloat(((v / first) * 100).toFixed(2)) : null);
}

// ── Date utilities ────────────────────────────────────────────────────────────

// Generate every calendar day in range [startDate, endDate] as 'YYYY-MM-DD'
function calendarDays(startDate, endDate) {
  const days = [];
  const d = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (d <= end) {
    days.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

// Unix milliseconds → UTC 'YYYY-MM-DD'  (used by CoinGecko BTC fetch)
function msToDate(ms) {
  return new Date(ms).toISOString().split('T')[0];
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

// BTC daily closes — Binance preferred, CoinGecko fallback for blocked regions
async function fetchBTC(days = 200) {
  // Try Binance first
  try {
    const limit = Math.min(days, 1000);
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=${limit}`,
      { cache: 'no-store', signal: AbortSignal.timeout(7000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length >= 10) {
        const byDate = {};
        for (const candle of data) {
          const close = parseFloat(candle[4]);
          if (!isFinite(close) || close <= 0) continue;
          byDate[msToDate(candle[0])] = close;
        }
        return Object.entries(byDate)
          .sort(([a], [b]) => a < b ? -1 : 1)
          .map(([date, close]) => ({ date, close }));
      }
    }
  } catch {}

  // CoinGecko fallback (capped at 365 days on free tier) — retry on rate limit
  const cgDays = Math.min(days, 365);
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${cgDays}&interval=daily`;
  let data = null;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt));
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    lastStatus = res.status;
    if (res.ok) { data = await res.json(); break; }
    if (res.status !== 429 && res.status !== 503) break;
  }
  if (!data) throw new Error(`CoinGecko BTC HTTP ${lastStatus}`);
  if (!Array.isArray(data?.prices) || data.prices.length < 10) throw new Error(`CoinGecko BTC: insufficient rows`);

  const byDate = {};
  for (const [ts, close] of data.prices) {
    if (!isFinite(close) || close <= 0) continue;
    byDate[msToDate(ts)] = close;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([date, close]) => ({ date, close }));
}

// FRED CSV — no API key, no rate limits, highly reliable
// Series used: SP500, DTWEXBGS (trade-weighted dollar index), M2SL
async function fetchFRED(seriesId) {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`FRED ${seriesId} HTTP ${res.status}`);
  const text = await res.text();
  // Some FRED responses redirect to HTML on error
  if (text.includes('<html') || text.includes('<!DOCTYPE')) throw new Error(`FRED ${seriesId}: returned HTML`);
  const rows = text.trim().split('\n').slice(1)
    .map(line => {
      const parts = line.split(',');
      const date  = parts[0]?.trim();
      const close = parseFloat(parts[1]);
      // FRED uses '.' for missing values — skip those
      return date && !isNaN(close) && close > 0 ? { date, close } : null;
    })
    .filter(Boolean);
  if (rows.length < 10) throw new Error(`FRED ${seriesId}: insufficient rows (${rows.length})`);
  return rows;
}

// Gold daily closes — Binance PAXG preferred, CoinGecko pax-gold fallback
async function fetchGold(days = 600) {
  // Try Binance PAXG
  try {
    const limit = Math.min(days, 1000);
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=1d&limit=${limit}`,
      { cache: 'no-store', signal: AbortSignal.timeout(7000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length >= 10) {
        const byDate = {};
        for (const candle of data) {
          const close = parseFloat(candle[4]);
          if (!isFinite(close) || close <= 0) continue;
          byDate[msToDate(candle[0])] = close;
        }
        return Object.entries(byDate)
          .sort(([a], [b]) => a < b ? -1 : 1)
          .map(([date, close]) => ({ date, close }));
      }
    }
  } catch {}

  // CoinGecko fallback (pax-gold tracks spot gold)
  const cgDays = Math.min(days, 365);
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?vs_currency=usd&days=${cgDays}&interval=daily`,
    { cache: 'no-store', signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`CoinGecko gold HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.prices) || data.prices.length < 10) throw new Error(`CoinGecko gold: insufficient rows`);

  const byDate = {};
  for (const [ts, close] of data.prices) {
    if (!isFinite(close) || close <= 0) continue;
    byDate[msToDate(ts)] = close;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([date, close]) => ({ date, close }));
}

// ── Forward-fill ──────────────────────────────────────────────────────────────
// Propagates TradFi closes across weekends/holidays.
// Returns a plain object: { 'YYYY-MM-DD': close } for every calendar day.
function forwardFill(series, startDate, endDate) {
  const srcMap = {};
  series.forEach(d => { srcMap[d.date] = d.close; });

  const days = calendarDays(startDate, endDate);
  const out = {};
  let last = null;

  for (const day of days) {
    if (srcMap[day] != null) last = srcMap[day];
    if (last !== null) out[day] = last;
  }
  return out;
}

// ── Alignment ─────────────────────────────────────────────────────────────────
// Returns sorted array of { date, btc, asset } for days where BOTH have values.
// Both maps must already be forward-filled before calling this.
function alignDates(btcMap, assetMap, sortedDays) {
  const out = [];
  for (const day of sortedDays) {
    if (btcMap[day] != null && assetMap[day] != null) {
      out.push({ date: day, btc: btcMap[day], asset: assetMap[day] });
    }
  }
  return out;
}

// ── Per-timeframe computation (fully independent per TF) ─────────────────────
// Each TF independently: slice → log returns → pearson. No shared intermediate arrays.
function computeDailyPair(label, aligned) {
  if (aligned.length < 30) {
    console.warn(`[Corr] ${label}: only ${aligned.length} aligned points — skipping`);
    return null;
  }

  const corr = {}, history = {};

  for (const [tf, w] of Object.entries(TF_WINDOWS)) {
    if (aligned.length < w) continue; // not enough data for this window

    // ── Step 1: Slice the last N aligned price points (independent per TF) ──
    const priceSlice = aligned.slice(-w);

    // ── Step 2: Compute log returns from that slice (AFTER slicing, not before) ──
    const btcRet = [], assetRet = [];
    for (let i = 1; i < priceSlice.length; i++) {
      btcRet.push(logRet(priceSlice[i - 1].btc,   priceSlice[i].btc));
      assetRet.push(logRet(priceSlice[i - 1].asset, priceSlice[i].asset));
    }

    // ── Step 3: Pearson on those returns ────────────────────────────────────
    const c = pearson(btcRet, assetRet);
    corr[tf] = c;

    // ── Step 4: Normalized price history from the same slice (for chart) ────
    history[tf] = {
      d1: normalizeArr(priceSlice.map(d => d.btc)),
      d2: normalizeArr(priceSlice.map(d => d.asset)),
    };

    console.log(`[Corr] ${label} ${tf} | slice:${priceSlice.length}pts → ${btcRet.length}rets | corr:${c}`);
  }

  if (Object.keys(corr).length === 0) return null;
  return { corr, history };
}

// ── M2: Year-over-Year methodology ───────────────────────────────────────────
// Per spec: correlate YoY% change in M2 with BTC log returns over same period.
// M2 is monthly data — align to BTC end-of-month closes, then compute YoY.
function computeM2Pair(btcData, m2Data) {
  // Build month → last BTC close of that month
  const btcByMonth = {};
  for (const { date, close } of btcData) {
    if (close > 0) btcByMonth[date.slice(0, 7)] = close;
  }

  // Build month → M2 value
  const m2ByMonth = {};
  for (const { date, close } of m2Data) {
    if (close > 0) m2ByMonth[date.slice(0, 7)] = close;
  }

  // Sorted months where both assets have data
  const months = [...new Set([...Object.keys(btcByMonth), ...Object.keys(m2ByMonth)])]
    .filter(m => btcByMonth[m] && m2ByMonth[m])
    .sort();

  if (months.length < 14) {
    console.warn(`[Corr] BTC/M2: only ${months.length} monthly overlapping points — need 14+`);
    return null;
  }

  const monthly = months.map(m => ({ month: m, btc: btcByMonth[m], m2: m2ByMonth[m] }));

  // Compute YoY series (requires 12-month lookback per point)
  const btcYoY = [], m2YoY = [];
  for (let i = 12; i < monthly.length; i++) {
    const { btc: bCurr, m2: mCurr } = monthly[i];
    const { btc: bPrev, m2: mPrev } = monthly[i - 12];
    if (bPrev > 0 && bCurr > 0 && mPrev > 0 && mCurr > 0) {
      btcYoY.push(Math.log(bCurr / bPrev));         // BTC: log YoY return
      m2YoY.push((mCurr - mPrev) / mPrev);          // M2:  YoY % change
    }
  }

  if (btcYoY.length < 4) return null;

  const corrVal = pearson(btcYoY, m2YoY);
  console.log(`[Corr] BTC/M2 YoY (${btcYoY.length} months): ${corrVal}  (expected: positive long-term, noisy short-term)`);

  // Build chart history for each TF (show normalized monthly closes)
  const hist = (n) => {
    const sl = monthly.slice(-n);
    return { d1: normalizeArr(sl.map(d => d.btc)), d2: normalizeArr(sl.map(d => d.m2)) };
  };

  return {
    corr:    { '1W': corrVal, '1M': corrVal, '3M': corrVal }, // same YoY value across all TFs
    history: { '1W': hist(6), '1M': hist(12), '3M': hist(24) },
  };
}

// ── Master builder ────────────────────────────────────────────────────────────
async function buildAllPairs() {
  const DAYS = 900; // 30 months: covers 180-day window + M2 YoY (needs 12mo lookback + 10 pairs)

  // Step 1: Fetch all raw data in parallel
  // All sources are auth-free and reliable:
  //   Binance  → BTC + Gold (PAXG tokenized gold, 1:1 peg to troy oz)
  //   FRED     → DXY equivalent (DTWEXBGS), S&P 500, M2 money supply
  const [btcRes, dxyRes, goldRes, spxRes, m2Res] = await Promise.allSettled([
    fetchBTC(DAYS),            // Binance BTCUSDT daily
    fetchFRED('DTWEXBGS'),     // FRED trade-weighted USD index (broad goods)
    fetchGold(DAYS),           // Binance PAXGUSDT (tokenized gold, tracks spot price)
    fetchFRED('SP500'),        // FRED S&P 500 daily
    fetchFRED('M2SL'),         // FRED M2 money supply (monthly)
  ]);

  const btcRaw  = btcRes.status  === 'fulfilled' ? btcRes.value  : null;
  let   dxyRaw  = dxyRes.status  === 'fulfilled' ? dxyRes.value  : null;
  let   goldRaw = goldRes.status === 'fulfilled' ? goldRes.value : null;
  let   spxRaw  = spxRes.status  === 'fulfilled' ? spxRes.value  : null;
  const m2Raw   = m2Res.status   === 'fulfilled' ? m2Res.value   : null;

  // Log any fetch failures immediately
  if (!dxyRaw)  console.error('[Corr] DXY (FRED DTWEXBGS) fetch failed:',  dxyRes.reason?.message);
  if (!goldRaw) console.error('[Corr] Gold (Binance PAXG) fetch failed:',  goldRes.reason?.message);
  if (!spxRaw)  console.error('[Corr] SPX (FRED SP500) fetch failed:',     spxRes.reason?.message);
  if (!m2Raw)   console.error('[Corr] M2 (FRED M2SL) fetch failed:',       m2Res.reason?.message);

  if (!btcRaw?.length) throw new Error('BTC data unavailable');

  // Step 2: Establish the full calendar date grid (BTC anchors the range — 24/7 asset)
  const startDate = btcRaw[0].date;
  const endDate   = btcRaw[btcRaw.length - 1].date;
  const allDays   = calendarDays(startDate, endDate);

  // BTC is 24/7 — no forward-fill needed; just map it
  const btcMap = {};
  btcRaw.forEach(d => { btcMap[d.date] = d.close; });

  // Step 3: Forward-fill TradFi data across every calendar day (weekends + holidays)
  const dxyMap  = dxyRaw  ? forwardFill(dxyRaw,  startDate, endDate) : null;
  const goldMap = goldRaw ? forwardFill(goldRaw, startDate, endDate) : null;
  const spxMap  = spxRaw  ? forwardFill(spxRaw,  startDate, endDate) : null;

  // Step 4: Align each asset to BTC dates (only days where BOTH have values)
  const alignedDXY  = dxyMap  ? alignDates(btcMap, dxyMap,  allDays) : [];
  const alignedGold = goldMap ? alignDates(btcMap, goldMap, allDays) : [];
  const alignedSPX  = spxMap  ? alignDates(btcMap, spxMap,  allDays) : [];

  // ── Debug logging ─────────────────────────────────────────────────────────
  console.log(
    `[Corr] Raw rows — BTC: ${btcRaw.length}  DXY: ${dxyRaw?.length ?? 'FAILED'}` +
    `  Gold: ${goldRaw?.length ?? 'FAILED'}  SPX: ${spxRaw?.length ?? 'FAILED'}  M2: ${m2Raw?.length ?? 'FAILED'}`
  );
  console.log(
    `[Corr] Aligned pts — DXY: ${alignedDXY.length}  Gold: ${alignedGold.length}  SPX: ${alignedSPX.length}`
  );

  // Steps 5–7: For each pair, compute corr per TF (returns computed inside computeCorr)
  const output = {};

  const buildPair = (label, aligned) => {
    const pair = computeDailyPair(label, aligned);
    if (!pair) return;
    output[label] = pair;
  };

  buildPair('BTC/DXY',  alignedDXY);
  buildPair('BTC/Gold', alignedGold);
  buildPair('BTC/SPX',  alignedSPX);

  // Print diagnostic values with expected ranges
  if (output['BTC/SPX']?.corr?.['1M'] != null) {
    console.log(`[Corr] BTC/SPX 90D: ${output['BTC/SPX'].corr['1M']}  (expected: +20 to +60)`);
  }
  if (output['BTC/DXY']?.corr?.['1M'] != null) {
    console.log(`[Corr] BTC/DXY 90D: ${output['BTC/DXY'].corr['1M']}  (expected: -50 to +30)`);
  }
  if (output['BTC/Gold']?.corr?.['1M'] != null) {
    console.log(`[Corr] BTC/Gold 90D: ${output['BTC/Gold'].corr['1M']}  (expected: -20 to +30)`);
  }

  // M2: special YoY methodology
  if (m2Raw?.length) {
    const m2Pair = computeM2Pair(btcRaw, m2Raw);
    if (m2Pair) output['BTC/M2'] = m2Pair;
  }

  console.log(`[Corr] Done. Pairs: ${Object.keys(output).join(', ')}`);
  return output;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const now = Date.now();

  if (cache.result && now - cache.fetchedAt < CACHE_TTL) {
    return Response.json(cache.result);
  }

  try {
    const result = await buildAllPairs();
    if (Object.keys(result).length > 0) {
      cache = { result, fetchedAt: now };
    }
    return Response.json(result);
  } catch (e) {
    console.error('[Corr] Fatal:', e.message);
    if (cache.result) return Response.json(cache.result);
    return Response.json({}, { status: 500 });
  }
}
