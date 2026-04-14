'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from './DataProvider';
import { timeSince, streamAI } from '@/lib/utils';
import { NEWS } from '@/lib/mockData';

export default function MarketNewsCard() {
  const { news: liveNews, prices: livePrices, sentiment: liveSentiment, events: liveEvents, loading, lastUpdated } = useData();
  const newsItems = liveNews ?? NEWS;

  const [aiText,  setAiText]  = useState('');
  const [aiState, setAiState] = useState('idle'); // idle | loading | streaming | done | error
  const typeQueue = useRef([]);
  const typeTimer = useRef(null);
  const aiGen     = useRef(0);

  const drainRef = useRef(null);
  drainRef.current = (genId) => {
    if (genId !== aiGen.current) return;
    if (typeQueue.current.length === 0) { typeTimer.current = null; return; }
    const char = typeQueue.current.shift();
    setAiText(prev => prev + char);
    typeTimer.current = setTimeout(() => drainRef.current(genId), 18);
  };

  const loadAI = useCallback(() => {
    if (typeTimer.current) { clearTimeout(typeTimer.current); typeTimer.current = null; }
    const genId = ++aiGen.current;
    typeQueue.current = [];
    setAiText('');
    setAiState('loading');

    const items    = liveNews ?? NEWS;
    const bullish  = items.filter(n => n.snt === 'BULLISH');
    const bearish  = items.filter(n => n.snt === 'BEARISH');
    const neutral  = items.filter(n => n.snt === 'NEUTRAL');
    const btcLive  = livePrices?.['BTC/USD'];
    const btcPrice = btcLive ? `$${btcLive.price.toLocaleString()} (${btcLive.chg > 0 ? '+' : ''}${btcLive.chg}% 24h)` : 'N/A';
    const sentVal  = liveSentiment?.value ?? 68;
    const sentLabel = liveSentiment?.label ?? 'Neutral';

    const fmt = (arr) => arr.slice(0, 3).map(n => `- ${n.hl}`).join('\n');
    const userPrompt =
      `BTC/USD: ${btcPrice} — Sentiment score: ${sentVal}/100 (${sentLabel})\n` +
      `News breakdown: ${bullish.length} bullish, ${bearish.length} bearish, ${neutral.length} neutral out of ${items.length} stories\n\n` +
      (bullish.length > 0 ? `Top bullish headlines:\n${fmt(bullish)}\n\n` : '') +
      (bearish.length > 0 ? `Top bearish headlines:\n${fmt(bearish)}\n\n` : '') +
      `Summarize the overall sentiment, highlight the 2-3 most important stories, and explain what traders should watch for.`;

    streamAI(
      {
        system: 'You are a Bitcoin news analyst. In 3-4 sentences: (1) state the overall market sentiment and why, (2) call out the 2-3 headlines that matter most and their direct implication for BTC price, (3) tell traders what to watch. Be specific and direct. No fluff.',
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 160,
      },
      (chunk) => {
        if (genId !== aiGen.current) return;
        for (const char of chunk) typeQueue.current.push(char);
        if (!typeTimer.current) drainRef.current(genId);
        setAiState(s => s === 'loading' ? 'streaming' : s);
      },
      () => { if (genId === aiGen.current) setAiState('done'); },
      () => { if (genId === aiGen.current) setAiState('error'); },
    );
  }, [liveNews, livePrices, liveSentiment]);

  useEffect(() => {
    return () => { if (typeTimer.current) clearTimeout(typeTimer.current); };
  }, []);

  const isActive = aiState !== 'idle';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="fb" style={{ marginBottom: 12, flexShrink: 0 }}>
        <div className="fc gap1">
          <div className="card-title" style={{ marginBottom: 0 }}>Market News</div>
          <div className="live-dot" />
          {lastUpdated.news && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>{timeSince(lastUpdated.news)}</span>
          )}
        </div>
        {/* AI Summary button — always visible in header */}
        {!isActive && (
          <button onClick={loadAI} className="btn-primary" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.28)',
            color: 'var(--purple)', fontSize: 'var(--fs-xs)', fontWeight: 600,
            fontFamily: 'inherit',
          }}>🤖 AI Summary</button>
        )}
        {isActive && (
          <div className="fc gap1">
            <div className="ai-badge">🤖 AI Summary</div>
            {aiState === 'done' && (
              <button onClick={loadAI} className="btn-ghost" style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--muted3)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
              }}>↻ Refresh</button>
            )}
          </div>
        )}
      </div>

      {/* News list */}
      {loading.news && !liveNews ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          {[85, 70, 90, 65, 75].map((w, i) => (
            <div key={i} style={{ padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton skel-line" style={{ width: '30%', marginBottom: 6 }} />
              <div className="skeleton skel-line" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          {newsItems.map(n => (
            <div key={n.id} className="news-item"
              style={{ cursor: n.url ? 'pointer' : 'default' }}
              onClick={() => n.url && window.open(n.url, '_blank', 'noopener,noreferrer')}>
              <div className="news-meta">
                <span className={`nbadge nb-${n.snt === 'BULLISH' ? 'bull' : n.snt === 'BEARISH' ? 'bear' : 'neu'}`}>{n.snt}</span>
                <span className="news-src">{n.src}</span>
                <span className="news-dt">{n.dt}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <div className="news-hl" style={{ flex: 1 }}>{n.hl}</div>
                {n.url && (
                  <span style={{ color: 'var(--muted5)', fontSize: 'var(--fs-sm)', flexShrink: 0, marginTop: 1, transition: 'color 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--muted)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted5)'}>›</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI panel — only shown after button clicked */}
      {isActive && (
        <div className="ai-panel" style={{ flexShrink: 0 }}>
          {aiState === 'loading' && (
            <div className="ai-loading" style={{ paddingTop: 0 }}>
              <div className="ai-loading-dot" /><div className="ai-loading-dot" /><div className="ai-loading-dot" />
              <span>Analyzing market conditions...</span>
            </div>
          )}
          {(aiState === 'streaming' || aiState === 'done') && aiText.length > 0 && (
            <p className="ai-txt">{aiText}</p>
          )}
          {aiState === 'error' && (
            <div>
              <p style={{ fontSize: 'var(--fs-base)', color: '#f87171', marginBottom: 8 }}>Unable to load AI summary.</p>
              <button className="ai-retry" onClick={loadAI}>↻ Retry</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
