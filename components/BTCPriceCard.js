'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from './DataProvider';
import LineChart from './LineChart';
import { timeSince, streamAI } from '@/lib/utils';
import { ASSETS, ASSET_DATA } from '@/lib/mockData';

// COIN_MAP: BTC.D uses the special 'btcd' coin handled by /api/chart
const COIN_MAP   = { 'BTC/USD': 'bitcoin', 'ETH/USD': 'ethereum', 'SOL/USD': 'solana', 'BTC.D': 'btcd' };
const ASSET_NAME = { 'BTC/USD': 'Bitcoin', 'ETH/USD': 'Ethereum', 'SOL/USD': 'Solana', 'BTC.D': 'Bitcoin Dominance' };

// TF params sent to /api/chart — BTC.D always uses daily (CoinGecko, no hourly dominance)
const TF_FETCH      = { '1D': 'days=1&interval=hourly', '1W': 'days=7&interval=daily', '1M': 'days=30&interval=daily' };
const TF_FETCH_BTCD = { '1D': 'days=7', '1W': 'days=14', '1M': 'days=30' };

// Fallback from DataProvider preloaded history when live chart hasn't arrived yet
const TF_HIST = { '1D': '1W', '1W': '1W', '1M': '1M' };

// Client-side chart cache with TTL — prevents serving stale data after long sessions
const CHART_CACHE_TTL = 5 * 60_000; // 5 minutes

function TfButtons({ current, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {['1D', '1W', '1M'].map(t => (
        <button key={t} onClick={() => onChange(t)} className="btn-ghost" style={{
          fontSize: 'var(--fs-xs)', padding: '2px 7px', cursor: 'pointer', borderRadius: 4,
          background: 'transparent',
          color: current === t ? 'var(--fg)' : 'var(--muted3)',
          border: current === t ? '1px solid rgba(240,240,255,0.25)' : '1px solid transparent',
          fontWeight: current === t ? 600 : 400,
        }}>
          {t}
        </button>
      ))}
    </div>
  );
}

export default function BTCPriceCard() {
  const { prices, history, loading, lastUpdated, isLive } = useData();
  const [sel,       setSel]       = useState('BTC/USD');
  const [tf,        setTf]        = useState('1M');
  const [chartData, setChartData] = useState(null);

  // Cache: { [key]: { data: number[], at: number } }
  const chartCache = useRef({});

  // ── AI summary ───────────────────────────────────────────────────────────
  const [summaryText,  setSummaryText]  = useState('');
  const [summaryState, setSummaryState] = useState('idle');
  const typeQueue       = useRef([]);
  const typeTimer       = useRef(null);
  const genId           = useRef(0);
  const drainRef        = useRef(null);
  const aiFiredForAsset = useRef(null);

  drainRef.current = (id) => {
    if (id !== genId.current) return;
    if (typeQueue.current.length === 0) { typeTimer.current = null; return; }
    const char = typeQueue.current.shift();
    setSummaryText(prev => prev + char);
    typeTimer.current = setTimeout(() => drainRef.current(id), 18);
  };

  const liveAsset = prices[sel];
  const asset     = liveAsset
    ? { id: sel, price: liveAsset.price, chg: liveAsset.chg, chg7d: liveAsset.chg7d ?? null }
    : null;

  const showSkeleton  = !liveAsset && loading.prices;
  const showLoadError = !liveAsset && !loading.prices;

  const fmt = (id, p) =>
    id === 'BTC.D' ? p.toFixed(2) + '%' : p > 1000 ? '$' + p.toLocaleString() : '$' + p.toFixed(2);

  // ── Chart data fetch ─────────────────────────────────────────────────────
  const fetchChart = useCallback(async (assetId, timeframe) => {
    const coin = COIN_MAP[assetId];
    if (!coin) return null;
    const key = `${assetId}-${timeframe}`;

    // Check client-side cache with TTL
    const entry = chartCache.current[key];
    if (entry && Date.now() - entry.at < CHART_CACHE_TTL) return entry.data;

    try {
      // BTC.D: fetch directly from CoinGecko via corsproxy (avoids server-side rate limits)
      if (assetId === 'BTC.D') {
        const days = { '1D': 7, '1W': 14, '1M': 30 }[timeframe] ?? 30;
        const proxy = url => 'https://corsproxy.io/?' + encodeURIComponent(url);
        const [btcRes, globalRes] = await Promise.all([
          fetch(proxy(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`)),
          fetch(proxy(`https://api.coingecko.com/api/v3/global/market_cap_chart?days=${days}`)),
        ]);
        if (!btcRes.ok || !globalRes.ok) return null;
        const btcData    = await btcRes.json();
        const globalData = await globalRes.json();
        const btcMcaps   = btcData?.market_caps;
        const totalMcaps = globalData?.market_cap_chart?.market_cap;
        if (!Array.isArray(btcMcaps) || !Array.isArray(totalMcaps)) return null;

        const totalByDay = {};
        for (const [ts, mcap] of totalMcaps) totalByDay[Math.floor(ts / 86_400_000)] = mcap;

        const pts = btcMcaps
          .map(([ts, btcMcap]) => {
            const day   = Math.floor(ts / 86_400_000);
            const total = totalByDay[day] ?? totalByDay[day - 1] ?? totalByDay[day + 1];
            if (!total || !btcMcap) return null;
            return parseFloat(((btcMcap / total) * 100).toFixed(3));
          })
          .filter(v => v != null);

        if (pts.length > 0) {
          chartCache.current[key] = { data: pts, at: Date.now() };
          return pts;
        }
        return null;
      }

      const params = TF_FETCH[timeframe];
      const res  = await fetch(`/api/chart?coin=${coin}&${params}`);
      const data = await res.json();
      const pts  = (data.prices ?? []).map(p => p[1]);
      if (pts.length > 0) {
        chartCache.current[key] = { data: pts, at: Date.now() };
        return pts;
      }
    } catch (_) {}
    return null;
  }, []);

  useEffect(() => {
    const key   = `${sel}-${tf}`;
    const entry = chartCache.current[key];

    // Serve cached data immediately if still fresh
    if (entry && Date.now() - entry.at < CHART_CACHE_TTL) {
      setChartData(entry.data);
      return;
    }

    // Show interim fallback while fetching
    const interim = sel !== 'BTC.D'
      ? (history[sel]?.[TF_HIST[tf]] ?? ASSET_DATA[sel])
      : null; // no mock fallback for BTC.D — empty is better than wrong
    setChartData(interim);

    fetchChart(sel, tf).then(pts => { if (pts) setChartData(pts); });
  }, [sel, tf, history]);

  // ── AI summary — fires once per asset, never on price ticks ──────────────
  const priceAvailable = liveAsset?.price != null;
  useEffect(() => {
    if (!asset?.price) return;
    if (aiFiredForAsset.current === sel) return;
    aiFiredForAsset.current = sel;

    if (typeTimer.current) { clearTimeout(typeTimer.current); typeTimer.current = null; }
    const id = ++genId.current;
    typeQueue.current = [];
    setSummaryText('');
    setSummaryState('loading');

    const price = fmt(sel, asset.price);
    const name  = ASSET_NAME[sel] ?? sel;

    // BTC.D prompt: talk about what the dominance level signals, not price change %
    const content = sel === 'BTC.D'
      ? `Bitcoin dominance is at ${price}. In one sentence (max 20 words), what does this signal for the altcoin market right now?`
      : `${name} is at ${price}, ${asset.chg > 0 ? '+' : ''}${asset.chg}% in 24h, ${asset.chg7d != null ? (asset.chg7d > 0 ? '+' : '') + asset.chg7d + '% in 7 days' : ''}. One sentence summary.`;

    streamAI(
      {
        system: sel === 'BTC.D'
          ? 'Reply with a 3-5 word headline only. Example: "Altcoin rotation likely." or "Dominance compressing alts." End with period.'
          : 'Reply with a 3-5 word headline only. Example: "Consolidating near support." or "Bullish momentum building." End with period.',
        messages: [{ role: 'user', content }],
        max_tokens: 60,
      },
      (chunk) => {
        if (id !== genId.current) return;
        for (const char of chunk) typeQueue.current.push(char);
        if (!typeTimer.current) drainRef.current(id);
        setSummaryState(s => s === 'loading' ? 'streaming' : s);
      },
      () => { if (id === genId.current) setSummaryState('done'); },
      () => { if (id === genId.current) setSummaryState('error'); },
    );
  }, [sel, priceAvailable]);

  useEffect(() => {
    return () => { if (typeTimer.current) clearTimeout(typeTimer.current); };
  }, []);

  // For BTC.D: derive a meaningful change from chart endpoints (first vs last point)
  const btcdChartChg = (sel === 'BTC.D' && chartData && chartData.length >= 2)
    ? parseFloat((chartData[chartData.length - 1] - chartData[0]).toFixed(2))
    : null;

  const displayChg  = sel === 'BTC.D' ? btcdChartChg : asset?.chg;
  const pos         = displayChg != null ? displayChg > 0 : (asset?.chg ?? 0) > 0;
  const color       = pos ? '#22c55e' : '#ef4444'; // Must be hex for Chart.js canvas
  const displayData = chartData ?? (sel !== 'BTC.D' ? ASSET_DATA[sel] : []) ?? [];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 0, overflow: 'hidden' }}>
      <div className="fb" style={{ marginBottom: 12 }}>
        <div className="fc gap1">
          <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--fg)' }}>
            {sel === 'BTC.D' ? 'BTC Dominance' : sel}
          </span>
          {isLive && lastUpdated.prices && (
            <span className="live-indicator">
              <span className="live-dot" />
              {timeSince(lastUpdated.prices)}
            </span>
          )}
        </div>
        <div className="tabs">
          {ASSETS.map(a => (
            <button key={a.id} className={`tab${sel === a.id ? ' act' : ''}`} onClick={() => setSel(a.id)}>
              {a.id}
            </button>
          ))}
        </div>
      </div>

      {showSkeleton ? (
        <>
          <div className="skeleton skel-val" />
          <div className="skeleton skel-line" style={{ width: '85%' }} />
          <div className="skeleton skel-line" style={{ width: '65%', marginBottom: 10 }} />
          <div className="skeleton" style={{ flex: 1, minHeight: 100, borderRadius: 8 }} />
        </>
      ) : showLoadError ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--muted3)' }}>Price unavailable</span>
          <button
            onClick={() => window.location.reload()}
            style={{ fontSize: 11, color: 'var(--muted)', background: 'transparent', border: '1px solid var(--muted4)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
          >↻ Retry</button>
        </div>
      ) : (
        <>
          <div className="fc gap1" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--fg)' }}>
              {fmt(sel, asset.price)}
            </span>
            {/* Only show change badge when we have a meaningful value */}
            {displayChg != null && (
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color }}>
                {pos ? '▲' : '▼'} {Math.abs(displayChg)}%
              </span>
            )}
          </div>
          <p className="ai-oneliner" style={{ fontSize: 'var(--fs-base)', color: 'var(--muted3)', lineHeight: 1.55, marginBottom: 8, flexShrink: 0 }}>
            {summaryState === 'loading' && <span style={{ fontStyle: 'italic' }}>Analyzing...</span>}
            {(summaryState === 'streaming' || summaryState === 'done') && summaryText}
            {summaryState === 'error' && <span style={{ color: '#f87171' }}>Unable to load summary.</span>}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 2, marginBottom: 4 }}>
            <TfButtons current={tf} onChange={setTf} />
          </div>
          <div style={{ flex: 1, minHeight: 100, marginLeft: 'calc(-1 * var(--pad-h))', marginRight: 'calc(-1 * var(--pad-h))' }}>
            <LineChart
              key={`${sel}-${tf}-${displayData.length}`}
              data={displayData}
              color={color}
              height="100%"
              padding={{ right: 20 }}
              dynamicScale={true}
            />
          </div>
        </>
      )}
    </div>
  );
}
