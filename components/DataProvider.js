'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';

const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx) || {};


function compositeLabel(score) {
  if (score <= 20) return { label: 'Extreme Bearish', pillColor: '#7f1d1d' };
  if (score <= 35) return { label: 'Bearish',         pillColor: '#ef4444' };
  if (score <= 45) return { label: 'Cautious',        pillColor: '#f97316' };
  if (score <= 54) return { label: 'Neutral',         pillColor: '#6b7280' };
  if (score <= 65) return { label: 'Cautious Bullish',pillColor: '#a3e635' };
  if (score <= 80) return { label: 'Bullish',         pillColor: '#22c55e' };
  return                 { label: 'Extreme Bullish',  pillColor: '#4ade80' };
}

export function DataProvider({ children }) {
  const [prices,       setPrices]      = useState({});
  const [history,      setHistory]     = useState({});
  const [news,         setNews]        = useState(null);
  const [events,       setEvents]      = useState(null);
  const [eventsNote,   setEventsNote]  = useState(null);
  const [ivCur,        setIvCur]       = useState(null);
  const [rvCur,        setRvCur]       = useState(null);
  const [volHistory,   setVolHistory]  = useState(null);
  const [corrVals,     setCorrVals]    = useState({});
  const [corrHistory,  setCorrHistory] = useState({});
  const [newsSentiment,setNewsSentiment] = useState(null);
  const [btcDomChg,    setBtcDomChg]  = useState(null);
  const [sentiment,    setSentiment]  = useState(null);
  const [loadingMap,   setLoadingMap] = useState({ prices: true, news: true, events: true, vol: true, corr: true });
  const [errors,       setErrors]     = useState({});
  const [lastUpdated,  setLastUpdated]= useState({});

  const prevBtcDomRef = useRef(null);

  // ── Prices ────────────────────────────────────────────────────────────────
  const fetchPrices = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const data = await fetch('/api/prices', { signal: ctrl.signal }).then(r => r.json());
      const out = {};
      if (data.bitcoin) out['BTC/USD'] = {
        price:  data.bitcoin.usd,
        chg:    +((data.bitcoin.usd_24h_change ?? 0).toFixed(2)),
        chg7d:  +((data.bitcoin.usd_7d_change  ?? 0).toFixed(2)),
      };
      if (data.ethereum) out['ETH/USD'] = { price: data.ethereum.usd, chg: +((data.ethereum.usd_24h_change ?? 0).toFixed(2)), chg7d: +((data.ethereum.usd_7d_change ?? 0).toFixed(2)) };
      if (data.solana)   out['SOL/USD'] = { price: data.solana.usd,   chg: +((data.solana.usd_24h_change   ?? 0).toFixed(2)), chg7d: +((data.solana.usd_7d_change   ?? 0).toFixed(2)) };
      const dom = data.btcDominance;
      if (dom != null) {
        const domVal = parseFloat(dom.toFixed(2));
        const domChg = prevBtcDomRef.current !== null ? domVal - prevBtcDomRef.current : 0;
        prevBtcDomRef.current = domVal;
        out['BTC.D'] = { price: parseFloat(domVal.toFixed(1)), chg: parseFloat(domChg.toFixed(2)) };
        setBtcDomChg(domChg);
      }
      setPrices(p => ({ ...p, ...out }));
      setLastUpdated(p => ({ ...p, prices: Date.now() }));
      setErrors(e => ({ ...e, prices: null }));
    } catch (err) {
      setErrors(e => ({ ...e, prices: err.message }));
    } finally {
      clearTimeout(timer);
      setLoadingMap(l => ({ ...l, prices: false }));
    }
  };

  // ── Chart history ─────────────────────────────────────────────────────────
  const fetchHistory = async () => {
    const COINS = { 'BTC/USD': 'bitcoin', 'ETH/USD': 'ethereum', 'SOL/USD': 'solana' };
    const hist = {};
    for (const [assetId, coin] of Object.entries(COINS)) {
      hist[assetId] = {};
      try {
        const data = await fetch(`/api/chart?coin=${coin}&days=90&interval=daily`).then(r => r.json());
        const pts = (data.prices ?? []).map(p => p[1]);
        if (pts.length > 0) {
          hist[assetId]['3M'] = pts;
          hist[assetId]['1M'] = pts.slice(-30);
          hist[assetId]['1W'] = pts.slice(-7);
        }
      } catch (_) {}
    }
    if (Object.keys(hist).some(k => Object.keys(hist[k]).length > 0)) {
      setHistory(h => ({ ...h, ...hist }));
    }
  };

  // ── Volatility ────────────────────────────────────────────────────────────
  const fetchVol = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const data = await fetch('/api/volatility', { signal: ctrl.signal }).then(r => r.json());
      if (data.iv != null) setIvCur(data.iv);
      if (data.rv != null) setRvCur(data.rv);
      if (data.volHistory) setVolHistory(data.volHistory);
      setLastUpdated(p => ({ ...p, vol: Date.now() }));
      setErrors(e => ({ ...e, vol: null }));
    } catch (err) {
      setErrors(e => ({ ...e, vol: err.message }));
    } finally {
      clearTimeout(timer);
      setLoadingMap(l => ({ ...l, vol: false }));
    }
  };

  // ── News ──────────────────────────────────────────────────────────────────
  const fetchNews = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const data = await fetch('/api/news', { signal: ctrl.signal }).then(r => r.json());
      const items = data.items ?? [];
      if (items.length > 0) {
        const bullish = items.filter(n => n.snt === 'BULLISH').length;
        const bearish = items.filter(n => n.snt === 'BEARISH').length;
        setNewsSentiment({ bullish, bearish, total: items.length });
        setNews(items);
        setLastUpdated(p => ({ ...p, news: Date.now() }));
        setErrors(e => ({ ...e, news: null }));
      }
    } catch (err) {
      setErrors(e => ({ ...e, news: err.message }));
    } finally {
      clearTimeout(timer);
      setLoadingMap(l => ({ ...l, news: false }));
    }
  };

  // ── Events ────────────────────────────────────────────────────────────────
  // Fetched client-side via corsproxy so ForexFactory IP rate-limits don't apply
  const fetchEvents = async () => {
    const COUNTRY_TO_FLAG = {
      USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
      CAD: '🇨🇦', AUD: '🇦🇺', CHF: '🇨🇭', CNY: '🇨🇳',
      NZD: '🇳🇿', MXN: '🇲🇽',
    };
    function normImp(v) {
      if (!v) return 'Low';
      const s = String(v).toLowerCase();
      if (s === 'high' || s === '3') return 'High';
      if (s === 'medium' || s === 'moderate' || s === '2') return 'Medium';
      return 'Low';
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      const mapEv = ev => ({
        time:     typeof ev.date === 'string' ? ev.date.slice(11, 16) : '—',
        flag:     COUNTRY_TO_FLAG[ev.country] || '🌐',
        country:  ev.country || '?',
        name:     ev.title,
        imp:      normImp(ev.impact),
        actual:   ev.actual   || null,
        estimate: ev.forecast || null,
        prev:     ev.previous || null,
      });

      // Fetch both weeks in parallel
      const [thisWeekRes, nextWeekRes] = await Promise.allSettled([
        fetch('https://corsproxy.io/?' + encodeURIComponent('https://nfs.faireconomy.media/ff_calendar_thisweek.json')),
        fetch('https://corsproxy.io/?' + encodeURIComponent('https://nfs.faireconomy.media/ff_calendar_nextweek.json')),
      ]);

      const thisWeek = thisWeekRes.status === 'fulfilled' && thisWeekRes.value.ok ? await thisWeekRes.value.json() : [];
      const nextWeek = nextWeekRes.status === 'fulfilled' && nextWeekRes.value.ok ? await nextWeekRes.value.json() : [];
      const allEvents = [...thisWeek, ...nextWeek];

      if (allEvents.length === 0) throw new Error('no data from proxy');

      // Try today first
      let items = allEvents
        .filter(ev => new Date(ev.date).toISOString().split('T')[0] === today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 15)
        .map(mapEv);

      let note = null;

      // No events today — try upcoming first, then fall back to recent past
      if (items.length === 0) {
        const upcoming = allEvents
          .filter(ev => new Date(ev.date).toISOString().split('T')[0] > today)
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (upcoming.length > 0) {
          const nextDate = new Date(upcoming[0].date).toISOString().split('T')[0];
          items = upcoming
            .filter(ev => new Date(ev.date).toISOString().split('T')[0] === nextDate)
            .slice(0, 15)
            .map(mapEv);
          const label = new Date(nextDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          note = `Next events: ${label}`;
        } else {
          // Weekend / feed gap — show most recent past events as context
          const recent = allEvents
            .filter(ev => new Date(ev.date).toISOString().split('T')[0] < today)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          if (recent.length > 0) {
            const dates = [...new Set(recent.map(ev => new Date(ev.date).toISOString().split('T')[0]))].slice(0, 2);
            items = recent
              .filter(ev => dates.includes(new Date(ev.date).toISOString().split('T')[0]))
              .slice(0, 15)
              .map(mapEv);
            note = "Weekend · Showing last week's events · Next week updates Sunday";
          }
        }
      }

      setEvents(items);
      setEventsNote(note);
      setLastUpdated(p => ({ ...p, events: Date.now() }));
      setErrors(e => ({ ...e, events: null }));
    } catch (err) {
      // Fallback to server route (may return static data)
      try {
        const data = await fetch('/api/events').then(r => r.json());
        setEvents(data.items ?? []);
        setEventsNote(data.note ?? null);
        setLastUpdated(p => ({ ...p, events: Date.now() }));
      } catch (_) {}
      setErrors(e => ({ ...e, events: err.message }));
    } finally {
      setLoadingMap(l => ({ ...l, events: false }));
    }
  };

  // ── Correlations ──────────────────────────────────────────────────────────
  // API now returns { 'BTC/DXY': { corr: {'1W':x,'1M':x,'3M':x}, history: {...} }, ... }
  const fetchCorrelations = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000); // correlations fetch several external APIs
    try {
      const data = await fetch('/api/correlation', { signal: ctrl.signal }).then(r => r.json());
      const newVals = {}, newHist = {};
      for (const [pair, pairData] of Object.entries(data)) {
        if (pairData?.corr)    newVals[pair] = pairData.corr;    // { '1W': num, '1M': num, '3M': num }
        if (pairData?.history) newHist[pair] = pairData.history; // { '1W': { d1, d2 }, ... }
      }
      if (Object.keys(newVals).length > 0) {
        setCorrVals(v => ({ ...v, ...newVals }));
        setCorrHistory(h => ({ ...h, ...newHist }));
        setLastUpdated(p => ({ ...p, corr: Date.now() }));
      }
      setErrors(e => ({ ...e, corr: null }));
    } catch (err) {
      setErrors(e => ({ ...e, corr: err.message }));
    } finally {
      clearTimeout(timer);
      setLoadingMap(l => ({ ...l, corr: false }));
    }
  };

  // ── Composite sentiment ───────────────────────────────────────────────────
  // Weights: 35% 7D price momentum, 30% news sentiment, 20% IV level, 15% BTC dominance change
  useEffect(() => {
    // S1 — 7D price momentum (35%)
    const btc7d = prices['BTC/USD']?.chg7d ?? null;
    let s1 = 55;
    if (btc7d !== null) {
      s1 = btc7d > 15 ? 95 : btc7d > 10 ? 85 : btc7d > 5 ? 72 : btc7d > 2 ? 62 : btc7d > 0 ? 54
         : btc7d > -2 ? 46 : btc7d > -5 ? 36 : btc7d > -10 ? 22 : 8;
    }

    // S2 — news sentiment ratio (30%)
    let s2 = 50;
    if (newsSentiment && newsSentiment.total > 0) {
      // Raw bullish% but weighted: bearish headlines hurt more than bullish help
      const bullRatio = newsSentiment.bullish / newsSentiment.total;
      const bearRatio = newsSentiment.bearish / newsSentiment.total;
      s2 = Math.round(Math.max(0, Math.min(100, 50 + (bullRatio - bearRatio * 1.2) * 80)));
    }

    // S3 — IV level (20%): high IV signals fear/uncertainty → bearish lean
    // IV < 40 = calm (bullish), 40-60 = normal, 60-80 = elevated (bearish), >80 = extreme fear
    let s3 = 55; // neutral default
    if (ivCur !== null) {
      s3 = ivCur < 30 ? 75 : ivCur < 40 ? 65 : ivCur < 55 ? 55 : ivCur < 65 ? 42 : ivCur < 80 ? 30 : 15;
    }

    // S4 — BTC dominance change (15%): rising dom = capital rotating into BTC = bullish
    const domChg = btcDomChg ?? 0;
    const s4 = domChg > 1 ? 78 : domChg > 0.3 ? 65 : domChg > 0 ? 55
             : domChg > -0.3 ? 45 : domChg > -1 ? 35 : 22;

    const score = Math.round(s1 * 0.35 + s2 * 0.30 + s3 * 0.20 + s4 * 0.15);
    const { label, pillColor } = compositeLabel(score);
    setSentiment({ value: score, label, pillColor });
  }, [prices, newsSentiment, btcDomChg, ivCur]);

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPrices();
    fetchHistory();
    fetchVol();
    fetchNews();
    fetchEvents();
    fetchCorrelations();
    const intervals = [
      setInterval(fetchPrices,         60_000),
      setInterval(fetchHistory,   5 * 60_000),
      setInterval(fetchNews,      5 * 60_000),
      setInterval(fetchEvents,   15 * 60_000),
      setInterval(fetchVol,       5 * 60_000),
      setInterval(fetchCorrelations, 15 * 60_000),
    ];
    return () => intervals.forEach(clearInterval);
  }, []);

  return (
    <DataCtx.Provider value={{
      prices, history, news, events, eventsNote, ivCur, rvCur, volHistory,
      corrVals, corrHistory, sentiment, newsSentiment, btcDomChg,
      loading: loadingMap, errors, lastUpdated,
      isLive: Object.keys(prices).length > 0,
    }}>
      {children}
    </DataCtx.Provider>
  );
}
