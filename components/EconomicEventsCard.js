'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from './DataProvider';
import { streamAI } from '@/lib/utils';
import { ECO_EVENTS, WATCH_NOTES } from '@/lib/mockData';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getEventType(name) {
  const t = (name || '').toLowerCase();
  if (/\bgdp\b|trade balance|retail sales|industrial prod|factory orders|exports|imports|current account/.test(t)) return 'Growth';
  if (/\bcpi\b|\bpce\b|inflation|price index|deflator|\brpi\b|\bhicp\b/.test(t)) return 'Inflation';
  if (/nonfarm|payroll|unemployment|jobless|claimant|average earnings|employment change/.test(t)) return 'Employment';
  if (/cash rate|interest rate|rate decision|rate statement|\bfomc\b|\becb\b|\bboe\b|\bboj\b|\brba\b|\brbnz\b|monetary policy|quantitative/.test(t)) return 'Central Bank';
  if (/bond|treasury|auction|gilt|bund/.test(t)) return 'Bonds';
  if (/housing|home sales|house price|mortgage|building permit|construction|\bhpi\b|housing start/.test(t)) return 'Housing';
  if (/consumer confidence|consumer sentiment|michigan|consumer survey/.test(t)) return 'Consumer Surveys';
  if (/\bpmi\b|manufacturing pmi|services pmi|composite pmi|\bifo\b|\bzew\b|tankan|business climate/.test(t)) return 'Business Surveys';
  if (/speech|speak|testif|remarks|statement|press conference|press briefing|forum|appearance/.test(t)) return 'Speeches';
  return 'Misc';
}

const FLAG_TO_CURRENCY = {
  '🇺🇸': 'USD', '🇪🇺': 'EUR', '🇬🇧': 'GBP', '🇯🇵': 'JPY',
  '🇨🇦': 'CAD', '🇦🇺': 'AUD', '🇨🇭': 'CHF', '🇨🇳': 'CNY',
  '🇳🇿': 'NZD', '🇲🇽': 'MXN',
};

const COUNTRY_TO_FLAG = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CAD: '🇨🇦', AUD: '🇦🇺', CHF: '🇨🇭', CNY: '🇨🇳',
  NZD: '🇳🇿', MXN: '🇲🇽',
};

function normImpact(v) {
  if (!v) return 'Low';
  const s = String(v).toLowerCase();
  if (s === 'high' || s === '3') return 'High';
  if (s === 'medium' || s === 'moderate' || s === '2') return 'Medium';
  return 'Low';
}

function mapFFEvent(ev) {
  const timePart = typeof ev.date === 'string' ? ev.date.slice(11, 16) : '—';
  const flag = COUNTRY_TO_FLAG[ev.country] || '🌐';
  return enrichEvent({
    time:     timePart || '—',
    flag,
    country:  ev.country || '?',
    name:     ev.title,
    imp:      normImpact(ev.impact),
    actual:   ev.actual   || null,
    estimate: ev.forecast || null,
    prev:     ev.previous || null,
  });
}

const FF_THIS_WEEK = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FF_NEXT_WEEK = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

async function fetchFFClientSide(url) {
  // Client-side fetch via corsproxy to bypass server IP rate limits on ForexFactory
  const res = await fetch('https://corsproxy.io/?' + encodeURIComponent(url));
  if (!res.ok) throw new Error('proxy failed');
  return await res.json();
}

const ALL_IMPACTS    = ['High', 'Medium', 'Low'];
const ALL_CURRENCIES = ['AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'JPY', 'NZD', 'USD'];
const ALL_TYPES      = ['Growth', 'Inflation', 'Employment', 'Central Bank', 'Bonds', 'Housing', 'Consumer Surveys', 'Business Surveys', 'Speeches', 'Misc'];

const IMPACT_ICON = { High: '🔴', Medium: '🟠', Low: '🟡' };

function enrichEvent(ev) {
  return {
    ...ev,
    currency: FLAG_TO_CURRENCY[ev.flag] || (ev.country ? ev.country.toUpperCase().slice(0, 3) : 'OTH'),
    type: getEventType(ev.name),
  };
}

function filterEvents(evs, impacts, currencies, types) {
  return evs.filter(ev =>
    impacts.has(ev.imp) &&
    (currencies.has(ev.currency) || !ALL_CURRENCIES.includes(ev.currency)) &&
    types.has(ev.type)
  );
}

function impKey(imp) {
  return imp === 'High' ? 'h' : imp === 'Medium' ? 'm' : 'l';
}

// ── Event Detail Card ─────────────────────────────────────────────────────────
function CalEventDetail({ ev, onClose }) {
  if (!ev) {
    return (
      <div style={{
        flexShrink: 0,
        border: '1px dashed var(--border)',
        borderRadius: 14,
        padding: '14px 22px',
        textAlign: 'center',
        color: 'var(--border2)',
        fontSize: 12,
      }}>
        Click any event for details
      </div>
    );
  }

  const hasActual  = ev.actual != null;
  const numActual  = hasActual   ? parseFloat(String(ev.actual).replace(/[^\d.\-]/g, ''))   : NaN;
  const numForecast = ev.estimate != null ? parseFloat(String(ev.estimate).replace(/[^\d.\-]/g, '')) : NaN;
  const beat = !isNaN(numActual) && !isNaN(numForecast) ? (numActual > numForecast ? true : numActual < numForecast ? false : null) : null;

  const boxes = [
    ev.prev != null ? {
      label: 'Previous',
      value: ev.prev,
      color: 'var(--text)',
      bg: 'rgba(255,255,255,0.03)',
      bdr: 'rgba(255,255,255,0.07)',
      badge: null,
    } : null,
    ev.estimate != null ? {
      label: 'Forecast',
      value: ev.estimate,
      color: 'var(--indigo)',
      bg: 'rgba(99,102,241,0.06)',
      bdr: 'rgba(99,102,241,0.2)',
      badge: null,
    } : null,
    hasActual ? {
      label: 'Actual',
      value: ev.actual,
      color: beat === true ? '#4ade80' : beat === false ? '#f87171' : 'var(--text)',
      bg:    beat === true ? 'rgba(34,197,94,0.08)' : beat === false ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
      bdr:   beat === true ? 'rgba(34,197,94,0.25)' : beat === false ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)',
      badge: beat !== null ? (beat ? '▲ Beat' : '▼ Miss') : null,
      badgeColor: beat ? '#4ade80' : '#f87171',
    } : null,
  ].filter(Boolean);

  return (
    <div style={{
      flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, transparent 60%), #0d0d1e',
      border: '1px solid rgba(139,92,246,0.25)',
      borderRadius: 14,
      padding: '18px 22px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.08)',
      animation: 'modalEnter 0.18s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{ev.flag}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.2 }}>{ev.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted3)', marginTop: 3 }}>{ev.country} · {ev.time} · {ev.type}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`imp imp-${impKey(ev.imp)}`}>{ev.imp}</span>
          <button onClick={onClose} className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--muted3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${boxes.length}, 1fr)`, gap: 10 }}>
        {boxes.map(({ label, value, color, bg, bdr, badge, badgeColor }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {value != null ? value : <span style={{ fontSize: 12, color: 'var(--muted4)' }}>—</span>}
            </div>
            {badge && (
              <div style={{ fontSize: 9, marginTop: 5, fontWeight: 600, color: badgeColor }}>{badge}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EconomicEventsCard() {
  const { events: liveEvents, eventsNote, news: liveNews, prices: livePrices, sentiment: liveSentiment } = useData();
  const todayEvents = (liveEvents ?? []).map(enrichEvent);

  const [tab, setTab] = useState('Data');

  // Tomorrow
  const [showTomorrow,    setShowTomorrow]    = useState(false);
  const [tomorrowEvents,  setTomorrowEvents]  = useState(null);
  const [loadingTmrw,     setLoadingTmrw]     = useState(false);

  // Calendar
  const [calendarOpen,    setCalendarOpen]    = useState(false);
  const [weekEvents,      setWeekEvents]      = useState(null);
  const [loadingWeek,     setLoadingWeek]     = useState(false);
  const [selectedCalEvent, setSelectedCalEvent] = useState(null);

  // Earnings
  const [earnings,     setEarnings]     = useState(null);
  const [loadingEarn,  setLoadingEarn]  = useState(false);
  const [earningsNote, setEarningsNote] = useState(null);

  // Filter (applied) — persisted to localStorage
  const [fImpact,  setFImpact]  = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('ll_filter_impact'));  return s ? new Set(s) : new Set(ALL_IMPACTS); } catch { return new Set(ALL_IMPACTS); }
  });
  const [fCurr,    setFCurr]    = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('ll_filter_curr'));   return s ? new Set(s) : new Set(ALL_CURRENCIES); } catch { return new Set(ALL_CURRENCIES); }
  });
  const [fTypes,   setFTypes]   = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('ll_filter_types'));  return s ? new Set(s) : new Set(ALL_TYPES); } catch { return new Set(ALL_TYPES); }
  });
  // Filter (pending — shown in modal before Apply)
  const [filterOpen, setFilterOpen] = useState(false);
  const [pImpact,  setPImpact]  = useState(new Set(ALL_IMPACTS));
  const [pCurr,    setPCurr]    = useState(new Set(ALL_CURRENCIES));
  const [pTypes,   setPTypes]   = useState(new Set(ALL_TYPES));

  // AI
  const [aiText,  setAiText]  = useState('');
  const [aiState, setAiState] = useState('idle');
  const typeQueue = useRef([]);
  const typeTimer = useRef(null);

  // ── Fetches ───────────────────────────────────────────────────────────────
  const fetchTomorrow = useCallback(async () => {
    if (tomorrowEvents !== null || loadingTmrw) return;
    setLoadingTmrw(true);
    try {
      const tmrw = new Date();
      tmrw.setUTCDate(tmrw.getUTCDate() + 1);
      const tmrwStr = tmrw.toISOString().split('T')[0];
      // Try this week client-side first, then next week
      let raw = [];
      try { raw = await fetchFFClientSide(FF_THIS_WEEK); } catch (_) {}
      let filtered = raw.filter(ev => new Date(ev.date).toISOString().split('T')[0] === tmrwStr);
      if (filtered.length === 0) {
        try {
          const nw = await fetchFFClientSide(FF_NEXT_WEEK);
          filtered = nw.filter(ev => new Date(ev.date).toISOString().split('T')[0] === tmrwStr);
        } catch (_) {}
      }
      setTomorrowEvents(filtered.sort((a, b) => new Date(a.date) - new Date(b.date)).map(mapFFEvent));
    } catch (_) { setTomorrowEvents([]); }
    finally { setLoadingTmrw(false); }
  }, [tomorrowEvents, loadingTmrw]);

  const fetchWeek = useCallback(async (force = false) => {
    if ((weekEvents !== null && !force) || loadingWeek) return;
    setLoadingWeek(true);
    setWeekEvents(null);
    try {
      // Fetch both weeks client-side via corsproxy to avoid server-side rate limits
      const [thisWeekRaw, nextWeekRaw] = await Promise.allSettled([
        fetchFFClientSide(FF_THIS_WEEK),
        fetchFFClientSide(FF_NEXT_WEEK),
      ]);
      const pool = [
        ...(thisWeekRaw.status === 'fulfilled' ? thisWeekRaw.value : []),
        ...(nextWeekRaw.status === 'fulfilled' ? nextWeekRaw.value : []),
      ];
      if (pool.length === 0) throw new Error('no data');
      const grouped = {};
      pool.forEach(ev => {
        const d = new Date(ev.date).toISOString().split('T')[0];
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(mapFFEvent(ev));
      });
      Object.values(grouped).forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)));
      setWeekEvents(grouped);
    } catch (_) { setWeekEvents({}); }
    finally { setLoadingWeek(false); }
  }, [weekEvents, loadingWeek]);

  const fetchEarnings = useCallback(async () => {
    if (earnings !== null || loadingEarn) return;
    setLoadingEarn(true);
    try {
      const data = await fetch('/api/earnings').then(r => r.json());
      setEarnings(data.items ?? []);
      if (data.note) setEarningsNote(data.note);
    } catch (_) { setEarnings([]); }
    finally { setLoadingEarn(false); }
  }, [earnings, loadingEarn]);

  // ── AI ─────────────────────────────────────────────────────────────────────
  const drainQueue = useCallback(() => {
    if (typeQueue.current.length === 0) { typeTimer.current = null; return; }
    const char = typeQueue.current.shift();
    setAiText(prev => prev + char);
    typeTimer.current = setTimeout(drainQueue, 20);
  }, []);

  const loadAI = () => {
    if (typeTimer.current) { clearTimeout(typeTimer.current); typeTimer.current = null; }
    typeQueue.current = [];
    setAiState('loading');
    setAiText('');

    const highEvents   = todayEvents.filter(e => e.imp === 'High');
    const medEvents    = todayEvents.filter(e => e.imp === 'Medium');
    const allEcoLines  = [...highEvents, ...medEvents]
      .map(e => `- ${e.time} ${e.flag} ${e.name} [${e.imp} impact]${e.estimate != null ? ` — Forecast: ${e.estimate}` : ''}${e.prev != null ? `, Prior: ${e.prev}` : ''}`)
      .join('\n');

    const btcLive  = livePrices?.['BTC/USD'];
    const btcPrice = btcLive ? `$${btcLive.price.toLocaleString()} (${btcLive.chg > 0 ? '+' : ''}${btcLive.chg}% 24h)` : 'N/A';

    const prompt =
      `BTC/USD: ${btcPrice}\n\n` +
      `Today's economic calendar (high & medium impact):\n${allEcoLines || 'No significant events today'}\n\n` +
      `Based on this economic calendar, provide a concise briefing for a Bitcoin trader. ` +
      `Focus on: (1) which events matter most for risk assets and why, (2) what the expected data implies for Fed/central bank policy, ` +
      `(3) what a beat or miss on key numbers would mean for BTC specifically.`;

    streamAI(
      {
        system: 'You are a macro analyst briefing a Bitcoin trader before the trading day. Be direct and specific — name the exact events, explain the mechanism (e.g. hot CPI → hawkish Fed → risk-off → BTC down). Plain English, no hedging. 3-4 sentences max.',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 220,
      },
      (chunk) => {
        for (const char of chunk) typeQueue.current.push(char);
        if (!typeTimer.current) drainQueue();
        setAiState(s => s === 'loading' ? 'streaming' : s);
      },
      () => setAiState('done'),
      () => setAiState('error'),
    );
  };

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleTabClick = t => {
    setTab(t);
    if (t === 'AI' && aiState === 'idle') loadAI();
    if (t === 'Earnings') fetchEarnings();
  };

  const toggleTomorrow = () => {
    const next = !showTomorrow;
    setShowTomorrow(next);
    if (next) fetchTomorrow();
  };

  const openCalendar = () => {
    // Force retry if previous fetch returned nothing
    const isEmpty = weekEvents !== null && Object.keys(weekEvents).length === 0;
    fetchWeek(isEmpty);
    setCalendarOpen(true);
  };

  // ── Filter helpers ────────────────────────────────────────────────────────
  const openFilter = () => {
    setPImpact(new Set(fImpact));
    setPCurr(new Set(fCurr));
    setPTypes(new Set(fTypes));
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setFImpact(new Set(pImpact));
    setFCurr(new Set(pCurr));
    setFTypes(new Set(pTypes));
    setFilterOpen(false);
    // Persist so filters survive page changes and calendar opens
    try {
      localStorage.setItem('ll_filter_impact', JSON.stringify([...pImpact]));
      localStorage.setItem('ll_filter_curr',   JSON.stringify([...pCurr]));
      localStorage.setItem('ll_filter_types',  JSON.stringify([...pTypes]));
    } catch (_) {}
  };

  const toggleSet = (setter, key) => setter(prev => {
    const s = new Set(prev);
    s.has(key) ? s.delete(key) : s.add(key);
    return s;
  });

  const CheckAll  = ({ setter, all }) => {
    const [hov, setHov] = useState(false);
    return <a href="#" onClick={e => { e.preventDefault(); setter(new Set(all)); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ color: hov ? 'var(--text)' : 'var(--muted3)', textDecoration: 'none', transition: 'color 150ms' }}>all</a>;
  };
  const CheckNone = ({ setter }) => {
    const [hov, setHov] = useState(false);
    return <a href="#" onClick={e => { e.preventDefault(); setter(new Set()); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ color: hov ? 'var(--text)' : 'var(--muted3)', textDecoration: 'none', transition: 'color 150ms' }}>none</a>;
  };

  // Escape to close overlays
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') { if (selectedCalEvent) { setSelectedCalEvent(null); } else { setCalendarOpen(false); setFilterOpen(false); } } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // Computed
  const baseEvents     = showTomorrow ? (tomorrowEvents ?? []) : todayEvents;
  const displayEvents  = filterEvents(baseEvents, fImpact, fCurr, fTypes);
  const isFiltered     = fImpact.size < ALL_IMPACTS.length || fCurr.size < ALL_CURRENCIES.length || fTypes.size < ALL_TYPES.length;

  const todayISO = new Date().toISOString().split('T')[0];

  const EventRow = ({ ev }) => (
    <div className="ev-row" style={{ flexWrap: 'wrap', gap: '2px 0' }}>
      <span className="ev-time">{ev.time}</span>
      <span className="ev-flag">{ev.flag}</span>
      <span className="ev-name">{ev.name}</span>
      <span className={`imp imp-${impKey(ev.imp)}`}>{ev.imp}</span>
      {(ev.actual != null || ev.estimate != null || ev.prev != null) && (
        <div style={{ width: '100%', paddingLeft: 44, display: 'flex', gap: 10, fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
          {ev.actual   != null && <span>Act: <span style={{ color: 'var(--text)' }}>{ev.actual}</span></span>}
          {ev.estimate != null && <span>Est: <span style={{ color: 'var(--text)' }}>{ev.estimate}</span></span>}
          {ev.prev     != null && <span>Prev: <span style={{ color: 'var(--text)' }}>{ev.prev}</span></span>}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="fb" style={{ marginBottom: 12, flexShrink: 0 }}>
          <div className="fc gap1">
            <div className="card-title" style={{ marginBottom: 0 }}>Upcoming Economic Events</div>
          </div>
          <div className="tabs">
            {['Data', 'Earnings', 'Watch', 'AI'].map(t => (
              <button key={t}
                className={`tab${t === 'AI' ? ' tab-ai' : ''}${tab === t && t !== 'AI' ? ' act' : ''}${tab === t && t === 'AI' ? ' act-ai' : ''}`}
                onClick={() => handleTabClick(t)}>
                {t === 'AI' ? '🤖 AI' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Data tab */}
        {tab === 'Data' && (
          <div className="tab-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="fc gap1" style={{ fontSize: 11, color: 'var(--muted3)', marginBottom: 8, flexWrap: 'wrap', gap: '4px 0', flexShrink: 0 }}>
              <span style={{ cursor: 'pointer', color: showTomorrow ? 'var(--muted)' : 'var(--muted3)' }} onClick={toggleTomorrow}>
                {showTomorrow ? '☑' : '☐'} Show Tomorrow
              </span>
              <span style={{ margin: '0 6px', color: 'var(--muted4)' }}>|</span>
              <span style={{ cursor: 'pointer' }} onClick={openCalendar}>→ View Calendar</span>
              <span style={{ margin: '0 6px', color: 'var(--muted4)' }}>|</span>
              <span style={{ cursor: 'pointer', color: isFiltered ? 'var(--muted)' : 'var(--muted3)' }} onClick={openFilter}>
                ⚙ Filter{isFiltered ? ' ●' : ''}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted5)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {showTomorrow ? 'Tomorrow' : 'Upcoming'}
            </div>
            <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
              {loadingTmrw && <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--muted)' }}>Loading...</div>}
              {!loadingTmrw && displayEvents.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2a2a48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span style={{ fontSize: 12, color: 'var(--muted5)' }}>
                    {isFiltered ? 'No events match the current filter' : 'No major events today'}
                  </span>
                </div>
              )}
              {!loadingTmrw && displayEvents.map((ev, i) => <EventRow key={i} ev={ev} />)}
            </div>
          </div>
        )}

        {/* Earnings tab */}
        {tab === 'Earnings' && (
          <div className="tab-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="fc gap1" style={{ fontSize: 11, color: 'var(--muted3)', marginBottom: 8, flexShrink: 0 }}>
              <span style={{ cursor: 'pointer' }} onClick={openCalendar}>→ View Calendar</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted5)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
              Today's Earnings Reports
            </div>
            <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
              {loadingEarn && <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--muted)' }}>Loading earnings...</div>}
              {!loadingEarn && earningsNote && (
                <div style={{ fontSize: 10, color: 'var(--muted3)', fontStyle: 'italic', marginBottom: 8 }}>{earningsNote}</div>
              )}
              {!loadingEarn && (earnings ?? []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: 'var(--muted)' }}>No earnings reports today</div>
              )}
              {!loadingEarn && (earnings ?? []).map((ev, i) => (
                <div key={i} className="ev-row" style={{ flexWrap: 'wrap', gap: '2px 0' }}>
                  <span className="ev-time" style={{ minWidth: 36, fontSize: 10 }}>{ev.time}</span>
                  <span className="ev-flag">🇺🇸</span>
                  <span className="ev-name">{ev.name}{ev.ticker && ev.ticker !== ev.name ? ` (${ev.ticker})` : ''}</span>
                  <span className={`imp imp-${impKey(ev.imp)}`}>{ev.imp}</span>
                  {(ev.eps_est || ev.eps_act || ev.rev_est) && (
                    <div style={{ width: '100%', paddingLeft: 44, display: 'flex', gap: 10, fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                      {ev.eps_act && <span>EPS: <span style={{ color: 'var(--text)' }}>{ev.eps_act}</span></span>}
                      {ev.eps_est && <span>Est: <span style={{ color: 'var(--text)' }}>{ev.eps_est}</span></span>}
                      {ev.rev_est && <span>Rev: <span style={{ color: 'var(--text)' }}>{ev.rev_est}</span></span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Watch tab */}
        {tab === 'Watch' && (
          <div className="tab-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--muted5)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              What to Watch
            </div>
            <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
              {todayEvents.map((ev, i) => {
                const notes = WATCH_NOTES[ev.name];
                return (
                  <div key={i} className="watch-card">
                    <div className="watch-card-hdr">
                      <span className="watch-card-name">{ev.name}</span>
                      <span className={`imp imp-${impKey(ev.imp)}`}>{ev.imp}</span>
                    </div>
                    {notes && (
                      <>
                        <div className="watch-line" style={{ marginBottom: 4 }}>
                          <span className="watch-lbl" style={{ color: 'var(--green)' }}>BEAT</span>
                          <span style={{ color: 'var(--green-light)' }}>{notes.beat}</span>
                        </div>
                        <div className="watch-line">
                          <span className="watch-lbl" style={{ color: 'var(--red)' }}>MISS</span>
                          <span style={{ color: '#fca5a5' }}>{notes.miss}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI tab */}
        {tab === 'AI' && (
          <div className="tab-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted5)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
              Today's Calendar
            </div>
            <div className="scroll" style={{ flex: '0 0 auto', maxHeight: '38%', minHeight: 0 }}>
              {todayEvents.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 'var(--fs-base)', color: 'var(--muted)' }}>No major events scheduled today</div>
              )}
              {todayEvents.filter(e => e.imp === 'High' || e.imp === 'Medium').map((ev, i) => (
                <div key={i} className="ev-row" style={{ flexWrap: 'wrap', gap: '2px 0' }}>
                  <span className="ev-time">{ev.time}</span>
                  <span className="ev-flag">{ev.flag}</span>
                  <span className="ev-name">{ev.name}</span>
                  <span className={`imp imp-${impKey(ev.imp)}`}>{ev.imp}</span>
                </div>
              ))}
            </div>
            <div className="ai-panel" style={{ marginTop: 10, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="fb" style={{ marginBottom: 8, flexShrink: 0 }}>
                <div className="ai-badge">🤖 AI Macro Briefing</div>
                {aiState === 'done' && (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted3)', cursor: 'pointer' }} onClick={loadAI}>↻ Refresh</span>
                )}
              </div>
              {aiState === 'loading' && (
                <div className="ai-loading">
                  <div className="ai-loading-dot" /><div className="ai-loading-dot" /><div className="ai-loading-dot" />
                  <span>Reading the economic calendar...</span>
                </div>
              )}
              {(aiState === 'streaming' || aiState === 'done') && aiText.length > 0 && (
                <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
                  <p className="ai-txt">{aiText}</p>
                </div>
              )}
              {aiState === 'error' && (
                <div style={{ paddingTop: 6 }}>
                  <p style={{ fontSize: 'var(--fs-base)', color: '#f87171', marginBottom: 8 }}>Unable to load briefing.</p>
                  <button className="ai-retry" onClick={loadAI}>↻ Retry</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Filter modal ──────────────────────────────────────────────────────── */}
      {filterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setFilterOpen(false)}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12,
            padding: '22px 26px', width: 600, maxWidth: '95vw',
            fontFamily: 'Inter, sans-serif', boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
          }} onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.2px' }}>Filter Events</div>
              <button onClick={() => setFilterOpen(false)} className="btn-icon" style={{
                background: 'transparent', border: 'none', color: 'var(--muted3)', cursor: 'pointer',
                fontSize: 16, lineHeight: 1, padding: 2,
              }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 0 }}>
              {/* Left: Impact + Event Types */}
              <div style={{ flex: '1 1 60%', paddingRight: 22 }}>

                {/* Impact section */}
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                  Impact &nbsp;
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    (<CheckAll setter={setPImpact} all={ALL_IMPACTS} />, <CheckNone setter={setPImpact} />)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {ALL_IMPACTS.map(imp => {
                    const active = pImpact.has(imp);
                    const dotColor = imp === 'High' ? 'var(--red)' : imp === 'Medium' ? 'var(--orange)' : 'var(--yellow)';
                    return (
                      <button key={imp} onClick={() => toggleSet(setPImpact, imp)} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                        fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: active ? 600 : 400,
                        color: active ? 'var(--text)' : 'var(--muted3)',
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: active ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
                        transition: 'all 150ms ease',
                      }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--muted)'; } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted3)'; } }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? dotColor : 'var(--muted4)', display: 'inline-block', flexShrink: 0, transition: 'background 150ms' }} />
                        {imp}
                      </button>
                    );
                  })}
                </div>

                <div style={{ borderTop: '1px solid var(--border3)', marginBottom: 16 }} />

                {/* Event Types section */}
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                  Event Types &nbsp;
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    (<CheckAll setter={setPTypes} all={ALL_TYPES} />, <CheckNone setter={setPTypes} />)
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                  {ALL_TYPES.map(t => {
                    const checked = pTypes.has(t);
                    return (
                      <div key={t} onClick={() => toggleSet(setPTypes, t)} style={{
                        display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
                        padding: '5px 7px', borderRadius: 6, userSelect: 'none',
                        transition: 'background 150ms',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          background: checked ? 'var(--indigo)' : 'transparent',
                          border: checked ? '1px solid var(--indigo)' : '1px solid #2a2a50',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 150ms',
                        }}>
                          {checked && <span style={{ color: 'var(--text)', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 12, color: checked ? 'var(--text)' : 'var(--muted)', transition: 'color 150ms' }}>{t}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Currencies */}
              <div style={{ flex: '1 1 40%', borderLeft: '1px solid var(--border3)', paddingLeft: 22 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted5)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                  Currencies &nbsp;
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    (<CheckAll setter={setPCurr} all={ALL_CURRENCIES} />, <CheckNone setter={setPCurr} />)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {ALL_CURRENCIES.map(cur => {
                    const checked = pCurr.has(cur);
                    return (
                      <div key={cur} onClick={() => toggleSet(setPCurr, cur)} style={{
                        display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
                        padding: '5px 7px', borderRadius: 6, userSelect: 'none',
                        transition: 'background 150ms',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          background: checked ? 'var(--indigo)' : 'transparent',
                          border: checked ? '1px solid var(--indigo)' : '1px solid #2a2a50',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 150ms',
                        }}>
                          {checked && <span style={{ color: 'var(--text)', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 12, color: checked ? 'var(--text)' : 'var(--muted)', transition: 'color 150ms' }}>
                          {COUNTRY_TO_FLAG[cur]} {cur}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border3)', paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setFilterOpen(false)} className="btn-ghost" style={{
                padding: '7px 20px', background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                color: 'var(--muted3)', fontFamily: 'Inter, sans-serif',
              }}>Cancel</button>
              <button onClick={applyFilter} className="btn-primary" style={{
                padding: '7px 20px', background: 'var(--card3)', border: '1px solid #3535a0',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: 'var(--text)', fontFamily: 'Inter, sans-serif',
              }}>Apply Filter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen calendar ─────────────────────────────────────────────── */}
      {calendarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: '24px 32px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)', marginBottom: 3 }}>Economic Calendar</div>
              <div style={{ fontSize: 12, color: 'var(--muted3)' }}>This week + next week — all events from ForexFactory</div>
            </div>
            <button onClick={() => setCalendarOpen(false)} className="btn-icon" style={{
              background: 'transparent', border: '1px solid var(--muted4)', color: 'var(--muted)',
              cursor: 'pointer', fontSize: 16, width: 32, height: 32, borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {loadingWeek && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted3)', fontSize: 14 }}>
              Loading calendar...
            </div>
          )}

          {!loadingWeek && weekEvents && Object.keys(weekEvents).length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted3)', fontSize: 14 }}>
              <span>No calendar data available</span>
              <button onClick={() => fetchWeek(true)} className="btn-ghost" style={{ fontSize: 12, color: 'var(--muted)', background: 'transparent', border: '1px solid #2a2a50', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>↻ Retry</button>
            </div>
          )}

          {!loadingWeek && weekEvents && Object.keys(weekEvents).length > 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 16 }}>
            {/* Active filter indicator */}
            {isFiltered && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '6px 12px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, fontSize: 11, color: 'var(--purple)' }}>
                <span>⚙ Filters active — showing filtered results</span>
                <button onClick={() => {
                  setFImpact(new Set(ALL_IMPACTS)); setFCurr(new Set(ALL_CURRENCIES)); setFTypes(new Set(ALL_TYPES));
                  try { localStorage.removeItem('ll_filter_impact'); localStorage.removeItem('ll_filter_curr'); localStorage.removeItem('ll_filter_types'); } catch(_) {}
                }} style={{ background: 'none', border: 'none', color: 'var(--purple-deep)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0 }}>Clear all</button>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
              {Object.entries(weekEvents)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, evs]) => {
                  const filteredEvs = filterEvents(evs, fImpact, fCurr, fTypes);
                  const isToday = date === todayISO;
                  const d = new Date(date + 'T12:00:00Z');
                  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
                  return (
                    <div key={date} style={{ marginBottom: 28 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
                        color: isToday ? 'var(--indigo)' : 'var(--muted3)',
                        borderBottom: isToday ? '1px solid #4040a0' : '1px solid #18182e',
                        paddingBottom: 6, marginBottom: 8,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        {dayLabel}
                        {isToday && <span style={{ background: 'var(--indigo)', color: 'var(--text)', fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>TODAY</span>}
                        <span style={{ fontWeight: 400, color: 'var(--muted4)' }}>— {filteredEvs.length} event{filteredEvs.length !== 1 ? 's' : ''}</span>
                      </div>
                      {filteredEvs.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--muted4)', fontStyle: 'italic' }}>No events match current filters</div>
                      ) : filteredEvs.map((ev, i) => {
                        const isSelected = selectedCalEvent === ev;
                        return (
                          <div key={i} className="ev-row"
                            onClick={() => setSelectedCalEvent(isSelected ? null : ev)}
                            style={{
                              cursor: 'pointer',
                              borderRadius: 6,
                              background: isSelected ? 'rgba(139,92,246,0.08)' : 'transparent',
                              borderLeft: isSelected ? '2px solid var(--purple)' : '2px solid transparent',
                              paddingLeft: isSelected ? 6 : 8,
                              transition: 'background 0.15s, border-color 0.15s',
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <span className="ev-time">{ev.time}</span>
                            <span className="ev-flag">{ev.flag}</span>
                            <span className="ev-name">{ev.name}</span>
                            <span className={`imp imp-${impKey(ev.imp)}`}>{ev.imp}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>

            {/* ── Event Detail Card ───────────────────────────────────────── */}
            <CalEventDetail ev={selectedCalEvent} onClose={() => setSelectedCalEvent(null)} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
