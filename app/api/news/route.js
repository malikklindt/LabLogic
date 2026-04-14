const BULLISH = ['surge','rally','bull','gain','rise','soar','pump','inflow','adopt','etf','breakout','record','high','buy','accumulate','approval','launch','partnership','upgrade'];
const BEARISH = ['crash','drop','fall','bear','sell','loss','decline','fear','risk','ban','hack','fraud','dump','selloff','tariff','hawkish','recession','plunge','warning','breakdown'];

function tagSentiment(text) {
  const t = (text || '').toLowerCase();
  const bull = BULLISH.filter(w => t.includes(w)).length;
  const bear = BEARISH.filter(w => t.includes(w)).length * 1.2;
  return bull > bear ? 'BULLISH' : bear > bull ? 'BEARISH' : 'NEUTRAL';
}

function formatDate(raw) {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

// Simple RSS XML parser — no dependencies needed
function parseRSS(xml, sourceName) {
  const items = [];
  // Extract all <item> blocks
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      // Handle CDATA and plain text
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
      const m = r.exec(block);
      return m ? m[1].trim() : null;
    };
    const title = get('title');
    const link  = get('link') || get('guid');
    const date  = get('pubDate') || get('dc:date') || get('published');
    if (!title || title.length < 10) continue;
    items.push({
      src:     sourceName,
      rawDate: date ? new Date(date).getTime() : 0,
      dt:      formatDate(date),
      snt:     tagSentiment(title + ' ' + (get('description') ?? '')),
      hl:      title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#\d+;/g,'').trim(),
      url:     link?.trim() ?? null,
    });
  }
  return items;
}

// Server-side cache — 5 min TTL
let cache = { items: null, fetchedAt: 0 };
const TTL = 5 * 60_000;

// ── RSS sources — fetched directly (no rss2json middleman) ───────────────────
const RSS_SOURCES = [
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { name: 'CoinDesk',      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'Decrypt',       url: 'https://decrypt.co/feed' },
  { name: 'The Block',     url: 'https://www.theblock.co/rss.xml' },
];

async function fetchRSS({ name, url }) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LabLogic/1.0)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml, name).slice(0, 8);
  } catch {
    return [];
  }
}

export async function GET() {
  const now = Date.now();
  if (cache.items && now - cache.fetchedAt < TTL) {
    return Response.json({ items: cache.items });
  }

  // ── 1. CryptoPanic (real-time, best for crypto) ───────────────────────────
  const key = process.env.CRYPTOPANIC_KEY;
  if (key && !key.startsWith('your_')) {
    try {
      const res = await fetch(
        `https://cryptopanic.com/api/free/v1/posts/?auth_token=${key}&currencies=BTC&kind=news&public=true`,
        { cache: 'no-store', signal: AbortSignal.timeout(6000) }
      );
      const data = await res.json();
      const items = (data.results ?? []).slice(0, 12).map((item, i) => ({
        id: i + 1,
        src: item.source?.title ?? 'News',
        dt: formatDate(item.published_at),
        snt: tagSentiment((item.title ?? '') + ' ' + (item.domain ?? '')),
        hl: item.title ?? '',
        url: item.url ?? null,
      }));
      if (items.length > 0) {
        cache = { items, fetchedAt: now };
        return Response.json({ items });
      }
    } catch (_) {}
  }

  // ── 2. Multi-source RSS: Cointelegraph + CoinDesk + Decrypt + The Block ────
  try {
    const results = await Promise.allSettled(RSS_SOURCES.map(fetchRSS));

    const allItems = results.flatMap(r =>
      r.status === 'fulfilled' ? r.value : []
    );

    // Deduplicate by normalized headline (first 55 chars)
    const seen = new Set();
    const deduped = allItems.filter(item => {
      const key = item.hl.toLowerCase().slice(0, 55).replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Newest first
    deduped.sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0));

    const items = deduped.slice(0, 15).map((item, i) => ({
      id: i + 1,
      src: item.src,
      dt: item.dt,
      snt: item.snt,
      hl: item.hl,
      url: item.url,
    }));

    if (items.length > 0) {
      cache = { items, fetchedAt: now };
      return Response.json({ items });
    }
  } catch (_) {}

  // ── 3. Stale cache rather than empty ─────────────────────────────────────
  if (cache.items) return Response.json({ items: cache.items });
  return Response.json({ items: [] });
}
