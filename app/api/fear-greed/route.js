// Fear & Greed Index — CoinMarketCap only
// /v3/fear-and-greed/latest    → current value   (cached 1h,  ~24 credits/day)
// /v3/fear-and-greed/historical → full history   (cached 24h, 1 credit/day)

const cacheLatest = { data: null, at: 0 };
const cacheHist   = { data: null, at: 0 };
const TTL_LATEST  =      60 * 60_000; // 1 hour
const TTL_HIST    = 24 * 60 * 60_000; // 24 hours (history updates once/day)

function fngLabel(v) {
  if (v <= 25) return 'Extreme Fear';
  if (v <= 45) return 'Fear';
  if (v <= 55) return 'Neutral';
  if (v <= 75) return 'Greed';
  return 'Extreme Greed';
}

async function fetchLatest(key) {
  if (cacheLatest.data && Date.now() - cacheLatest.at < TTL_LATEST) return cacheLatest.data;
  const res = await fetch('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
    cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CMC latest HTTP ${res.status}`);
  const json = await res.json();
  const v = json?.data?.value;
  if (v == null || !isFinite(+v)) throw new Error('CMC latest: unexpected response');
  const data = {
    value: Math.round(+v),
    label: json.data.value_classification ?? fngLabel(Math.round(+v)),
  };
  cacheLatest.data = data;
  cacheLatest.at   = Date.now();
  return data;
}

async function fetchHistory(key) {
  if (cacheHist.data && Date.now() - cacheHist.at < TTL_HIST) return cacheHist.data;

  // Paginate: CMC returns max 500 per call, newest first
  const allEntries = [];
  let start = 1;
  const limit = 500;

  while (true) {
    const res = await fetch(
      `https://pro-api.coinmarketcap.com/v3/fear-and-greed/historical?start=${start}&limit=${limit}`,
      {
        cache: 'no-store', signal: AbortSignal.timeout(10000),
        headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' },
      }
    );
    if (!res.ok) throw new Error(`CMC historical HTTP ${res.status}`);
    const json = await res.json();
    const batch = json?.data;
    if (!Array.isArray(batch) || batch.length === 0) break;
    allEntries.push(...batch);
    if (batch.length < limit) break; // got all data
    start += limit;
  }

  if (allEntries.length === 0) throw new Error('CMC historical: no data returned');
  cacheHist.data = allEntries; // newest first
  cacheHist.at   = Date.now();
  return allEntries;
}

export async function GET() {
  try {
    const key = process.env.CMC_API_KEY;
    if (!key) return Response.json({ error: 'CMC_API_KEY not set' }, { status: 500 });

    const [latest, histRaw] = await Promise.all([
      fetchLatest(key),
      fetchHistory(key),
    ]);

    // histRaw is newest-first; normalize timestamps
    const normalize = (entry) => ({
      value: Math.round(+entry.value),
      label: entry.value_classification ?? fngLabel(Math.round(+entry.value)),
      ts:    +entry.timestamp * 1000,
    });

    // Comparison points (index 0 = today/most recent)
    const pick = (i) => histRaw[i] ? normalize(histRaw[i]) : null;

    // Yearly high / low from last 365 entries
    const year = histRaw.slice(0, 365).map(normalize);
    const maxVal = Math.max(...year.map(d => d.value));
    const minVal = Math.min(...year.map(d => d.value));
    const yearlyHigh = year.find(d => d.value === maxVal);
    const yearlyLow  = year.find(d => d.value === minVal);

    // Chart history: oldest → newest, last entry patched with current value
    const history = histRaw.slice().reverse().map(normalize);
    if (history.length > 0) history[history.length - 1].value = latest.value;

    const payload = {
      current:    latest,
      yesterday:  pick(1),
      lastWeek:   pick(7),
      lastMonth:  pick(30),
      yearlyHigh,
      yearlyLow,
      history,
    };

    return Response.json(payload);
  } catch (e) {
    console.error('[FNG] fetch failed:', e.message);
    // Return stale cache if available
    const stale = cacheLatest.data && cacheHist.data;
    if (stale) {
      const histRaw = cacheHist.data;
      const normalize = (entry) => ({
        value: Math.round(+entry.value),
        label: entry.value_classification ?? fngLabel(Math.round(+entry.value)),
        ts:    +entry.timestamp * 1000,
      });
      const pick = (i) => histRaw[i] ? normalize(histRaw[i]) : null;
      const year = histRaw.slice(0, 365).map(normalize);
      const maxVal = Math.max(...year.map(d => d.value));
      const minVal = Math.min(...year.map(d => d.value));
      const history = histRaw.slice().reverse().map(normalize);
      if (history.length > 0) history[history.length - 1].value = cacheLatest.data.value;
      return Response.json({
        current: cacheLatest.data,
        yesterday: pick(1), lastWeek: pick(7), lastMonth: pick(30),
        yearlyHigh: year.find(d => d.value === maxVal),
        yearlyLow:  year.find(d => d.value === minVal),
        history,
      });
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}
