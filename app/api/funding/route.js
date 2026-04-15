export const dynamic = 'force-dynamic';

// ── Server-side cache (5 min TTL) ─────────────────────────────────────────────
let cache = null;
let cacheTs = 0;
const TTL = 5 * 60 * 1000;

const COINS = [
  { symbol: 'BTC',  binance: 'BTCUSDT',  bybit: 'BTCUSDT',  okx: 'BTC-USDT-SWAP'  },
  { symbol: 'ETH',  binance: 'ETHUSDT',  bybit: 'ETHUSDT',  okx: 'ETH-USDT-SWAP'  },
  { symbol: 'SOL',  binance: 'SOLUSDT',  bybit: 'SOLUSDT',  okx: 'SOL-USDT-SWAP'  },
  { symbol: 'BNB',  binance: 'BNBUSDT',  bybit: 'BNBUSDT',  okx: 'BNB-USDT-SWAP'  },
  { symbol: 'XRP',  binance: 'XRPUSDT',  bybit: 'XRPUSDT',  okx: 'XRP-USDT-SWAP'  },
  { symbol: 'DOGE', binance: 'DOGEUSDT', bybit: 'DOGEUSDT', okx: 'DOGE-USDT-SWAP' },
  { symbol: 'AVAX', binance: 'AVAXUSDT', bybit: 'AVAXUSDT', okx: 'AVAX-USDT-SWAP' },
  { symbol: 'LINK', binance: 'LINKUSDT', bybit: 'LINKUSDT', okx: 'LINK-USDT-SWAP' },
  { symbol: 'ADA',  binance: 'ADAUSDT',  bybit: 'ADAUSDT',  okx: 'ADA-USDT-SWAP'  },
  { symbol: 'SUI',  binance: 'SUIUSDT',  bybit: 'SUIUSDT',  okx: 'SUI-USDT-SWAP'  },
];

// Fresh timeout signal per call — module-level AbortSignal.timeout() starts
// its timer at module load and would abort after 8s regardless of call time.
const newSig = () => AbortSignal.timeout(8_000);

async function fetchBinance() {
  try {
    const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex', { signal: newSig() });
    if (!res.ok) return {};
    const data = await res.json();
    const out = {};
    for (const item of data) {
      out[item.symbol] = {
        rate:          parseFloat(item.lastFundingRate),
        nextFundingTs: item.nextFundingTime,
      };
    }
    return out;
  } catch { return {}; }
}

async function fetchBybit() {
  try {
    const res = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', { signal: newSig() });
    if (!res.ok) return {};
    const data = await res.json();
    const out = {};
    for (const item of data?.result?.list ?? []) {
      if (item.fundingRate != null) {
        out[item.symbol] = {
          rate:          parseFloat(item.fundingRate),
          nextFundingTs: parseInt(item.nextFundingTime, 10),
        };
      }
    }
    return out;
  } catch { return {}; }
}

async function fetchOKX(instId) {
  try {
    const res = await fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`, { signal: newSig() });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.data?.[0];
    if (!item) return null;
    return {
      rate:          parseFloat(item.fundingRate),
      nextFundingTs: parseInt(item.nextFundingTime, 10),
    };
  } catch { return null; }
}

async function fetchHistorical(symbol) {
  // Try Binance first (may be blocked on Vercel US)
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=90`,
      { signal: AbortSignal.timeout(6_000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        return data.map(d => ({ ts: d.fundingTime, rate: parseFloat(d.fundingRate) }));
      }
    }
  } catch {}

  // Fallback: Bybit funding history
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbol}&limit=90`,
      { signal: AbortSignal.timeout(6_000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.result?.list;
    if (!Array.isArray(list)) return [];
    // Bybit returns newest first — reverse to chronological
    return list.reverse().map(d => ({
      ts:   parseInt(d.fundingRateTimestamp, 10),
      rate: parseFloat(d.fundingRate),
    }));
  } catch { return []; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const histSymbol = searchParams.get('history'); // e.g. ?history=BTCUSDT

  // Historical mode — no cache, just fetch Binance history for one coin
  if (histSymbol) {
    const history = await fetchHistorical(histSymbol);
    return Response.json({ history });
  }

  // Serve from cache if fresh
  if (cache && Date.now() - cacheTs < TTL) {
    return Response.json(cache);
  }

  // Fetch all three exchanges in parallel
  const [binance, bybit, okxResults] = await Promise.all([
    fetchBinance().catch(() => ({})),
    fetchBybit().catch(() => ({})),
    Promise.all(COINS.map(c => fetchOKX(c.okx).catch(() => null))),
  ]);

  const okx = {};
  COINS.forEach((c, i) => { if (okxResults[i]) okx[c.okx] = okxResults[i]; });

  // Build per-coin rows
  const coins = COINS.map(c => {
    const b  = binance[c.binance] ?? null;
    const by = bybit[c.bybit]    ?? null;
    const o  = okx[c.okx]        ?? null;

    const rates = [b?.rate, by?.rate, o?.rate].filter(r => r != null);
    const avg   = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

    // Next funding time — use first available
    const nextFundingTs = b?.nextFundingTs ?? by?.nextFundingTs ?? o?.nextFundingTs ?? null;

    return {
      symbol: c.symbol,
      binance: b?.rate  ?? null,
      bybit:   by?.rate ?? null,
      okx:     o?.rate  ?? null,
      avg,
      nextFundingTs,
    };
  });

  // Overall market bias — avg of all available rates
  const allRates  = coins.flatMap(c => [c.binance, c.bybit, c.okx]).filter(r => r != null);
  const marketAvg = allRates.length ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 0;

  cache   = { coins, marketAvg, updatedAt: Date.now() };
  cacheTs = Date.now();
  return Response.json(cache);
}
