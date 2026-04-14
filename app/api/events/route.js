export const dynamic = 'force-dynamic';

function toFlag(country) {
  const m = {
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
    CAD: '🇨🇦', AUD: '🇦🇺', CHF: '🇨🇭', CNY: '🇨🇳',
    NZD: '🇳🇿', MXN: '🇲🇽',
  };
  return m[country] || '🌐';
}

function normImpact(v) {
  if (!v) return 'Low';
  const s = String(v).toLowerCase();
  if (s === 'high' || s === '3') return 'High';
  if (s === 'medium' || s === 'moderate' || s === '2') return 'Medium';
  return 'Low';
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}


function getEventType(name) {
  const t = (name || '').toLowerCase();
  if (/\bgdp\b|trade balance|retail sales|industrial prod|factory orders|exports|imports|current account/.test(t)) return 'Growth';
  if (/\bcpi\b|\bpce\b|inflation|price index|deflator|\brpi\b|\bhicp\b|\bppi\b/.test(t)) return 'Inflation';
  if (/nonfarm|payroll|unemployment|jobless|claimant|average earnings|employment change/.test(t)) return 'Employment';
  if (/cash rate|interest rate|rate decision|rate statement|\bfomc\b|\becb\b|\bboe\b|\bboj\b|\brba\b|\brbnz\b|monetary policy|quantitative/.test(t)) return 'Central Bank';
  if (/bond|treasury|auction|gilt|bund/.test(t)) return 'Bonds';
  if (/housing|home sales|house price|mortgage|building permit|construction|\bhpi\b|housing start/.test(t)) return 'Housing';
  if (/consumer confidence|consumer sentiment|michigan|consumer survey/.test(t)) return 'Consumer Surveys';
  if (/\bpmi\b|manufacturing pmi|services pmi|composite pmi|\bifo\b|\bzew\b|tankan|business climate/.test(t)) return 'Business Surveys';
  if (/speech|speak|testif|remarks|statement|press conference|press briefing|forum|appearance/.test(t)) return 'Speeches';
  return 'Misc';
}

function mapEvent(ev) {
  const timePart = typeof ev.date === 'string' ? ev.date.slice(11, 16) : '—';
  const country  = ev.country || '?';
  return {
    time:     timePart || '—',
    flag:     toFlag(country),
    country,
    currency: country, // ForexFactory uses currency codes as country (USD, EUR etc.)
    name:     ev.title,
    imp:      normImpact(ev.impact),
    type:     getEventType(ev.title),
    actual:   ev.actual   || null,
    estimate: ev.forecast || null,
    prev:     ev.previous || null,
  };
}

// ── Server-side cache: store raw ForexFactory arrays to avoid hammering the API
let ffCache = { thisWeek: null, nextWeek: null, fetchedAt: 0 };
const FF_TTL = 15 * 60_000; // 15 minutes

async function getFFData() {
  const now = Date.now();
  if (ffCache.thisWeek && now - ffCache.fetchedAt < FF_TTL) {
    return ffCache;
  }
  const fetchOpts = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  };
  let thisWeek = null, nextWeek = null;
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', fetchOpts);
    if (res.ok) thisWeek = await res.json();
  } catch (_) {}
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_nextweek.json', fetchOpts);
    if (res.ok) nextWeek = await res.json();
  } catch (_) {}
  if (thisWeek) {
    ffCache = { thisWeek, nextWeek, fetchedAt: now };
  }
  return { thisWeek: thisWeek ?? ffCache.thisWeek, nextWeek: nextWeek ?? ffCache.nextWeek };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range     = searchParams.get('range');
  const dateParam = searchParams.get('date');

  let targetDate = todayStr();
  if (dateParam === 'tomorrow') {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    targetDate = d.toISOString().split('T')[0];
  } else if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = dateParam;
  }

  const { thisWeek, nextWeek } = await getFFData();
  const allThisWeek = thisWeek ?? [];
  const allNextWeek = nextWeek ?? [];

  // ── Range: this week + next week grouped by date ─────────────────────────
  if (range === 'week') {
    const pool2 = [...allThisWeek, ...allNextWeek];
    if (pool2.length > 0) {
      const grouped = {};
      pool2.forEach(ev => {
        const evDate = new Date(ev.date).toISOString().split('T')[0];
        if (!grouped[evDate]) grouped[evDate] = [];
        grouped[evDate].push(mapEvent(ev));
      });
      for (const d of Object.keys(grouped)) {
        grouped[d].sort((a, b) => a.time.localeCompare(b.time));
      }
      return Response.json({ grouped, source: 'forexfactory' });
    }
    return Response.json({ grouped: {}, source: 'unavailable' });
  }

  // ── Single date ──────────────────────────────────────────────────────────
  // Always include both weeks so weekends/end-of-week days still have data
  const pool = [...allThisWeek, ...allNextWeek];

  const filtered = pool.filter(ev => {
    const evDate = new Date(ev.date).toISOString().split('T')[0];
    return evDate === targetDate;
  });

  if (filtered.length > 0) {
    const items = filtered
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 15)
      .map(mapEvent);
    return Response.json({ items, source: 'forexfactory' });
  }

  // No events today — check for upcoming events first
  const upcoming = pool
    .filter(ev => new Date(ev.date).toISOString().split('T')[0] > targetDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (upcoming.length > 0) {
    const nextDate = new Date(upcoming[0].date).toISOString().split('T')[0];
    const items = upcoming
      .filter(ev => new Date(ev.date).toISOString().split('T')[0] === nextDate)
      .slice(0, 15)
      .map(mapEvent);
    const label = new Date(nextDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return Response.json({ items, source: 'forexfactory', note: `Next events: ${label}` });
  }

  // Weekend / feed gap — show most recent past events as context
  const recent = pool
    .filter(ev => new Date(ev.date).toISOString().split('T')[0] < targetDate)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (recent.length > 0) {
    // Get the last 2 days that had events
    const dates = [...new Set(recent.map(ev => new Date(ev.date).toISOString().split('T')[0]))].slice(0, 2);
    const items = recent
      .filter(ev => dates.includes(new Date(ev.date).toISOString().split('T')[0]))
      .slice(0, 15)
      .map(mapEvent);
    return Response.json({ items, source: 'forexfactory', note: 'Weekend · Showing last week\'s events · Next week updates Sunday' });
  }

  return Response.json({ items: [], source: 'unavailable' });
}
