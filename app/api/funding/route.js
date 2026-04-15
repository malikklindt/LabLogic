export const dynamic = 'force-dynamic';

// ── Server-side cache (5 min TTL) ─────────────────────────────────────────────
let cache = null;
let cacheTs = 0;
const TTL = 5 * 60 * 1000;

// Exchange coverage from Vercel US:
//   OKX ✓, MEXC ✓, BitMEX ✓ (BTC uses XBT)
//   Binance, Bybit blocked. Kraken ✓ but their altcoin coverage is limited.
const COINS = [
  { symbol: 'BTC',  okx: 'BTC-USDT-SWAP',  mexc: 'BTC_USDT',  bitmex: 'XBTUSDT'  },
  { symbol: 'ETH',  okx: 'ETH-USDT-SWAP',  mexc: 'ETH_USDT',  bitmex: 'ETHUSDT'  },
  { symbol: 'SOL',  okx: 'SOL-USDT-SWAP',  mexc: 'SOL_USDT',  bitmex: 'SOLUSDT'  },
  { symbol: 'BNB',  okx: 'BNB-USDT-SWAP',  mexc: 'BNB_USDT',  bitmex: null       },
  { symbol: 'XRP',  okx: 'XRP-USDT-SWAP',  mexc: 'XRP_USDT',  bitmex: 'XRPUSDT'  },
  { symbol: 'DOGE', okx: 'DOGE-USDT-SWAP', mexc: 'DOGE_USDT', bitmex: 'DOGEUSDT' },
  { symbol: 'AVAX', okx: 'AVAX-USDT-SWAP', mexc: 'AVAX_USDT', bitmex: 'AVAXUSDT' },
  { symbol: 'LINK', okx: 'LINK-USDT-SWAP', mexc: 'LINK_USDT', bitmex: 'LINKUSDT' },
  { symbol: 'ADA',  okx: 'ADA-USDT-SWAP',  mexc: 'ADA_USDT',  bitmex: 'ADAUSDT'  },
  { symbol: 'SUI',  okx: 'SUI-USDT-SWAP',  mexc: 'SUI_USDT',  bitmex: 'SUIUSDT'  },
];

// Fresh timeout signal per call — module-level AbortSignal.timeout() starts
// its timer at module load and would abort after 8s regardless of call time.
const newSig = () => AbortSignal.timeout(8_000);

// MEXC — one call per coin, returns current funding rate + next settle time
async function fetchMEXC(mexcSym) {
  if (!mexcSym) return null;
  try {
    const res = await fetch(`https://contract.mexc.com/api/v1/contract/funding_rate/${mexcSym}`, { signal: newSig() });
    if (!res.ok) return null;
    const data = await res.json();
    const d = data?.data;
    if (!d?.fundingRate && d?.fundingRate !== 0) return null;
    return {
      rate:          parseFloat(d.fundingRate),
      nextFundingTs: parseInt(d.nextSettleTime, 10) || null,
    };
  } catch { return null; }
}

// BitMEX — historical funding (latest entry). Note: BitMEX funding is 8-hourly.
async function fetchBitMEX(bitmexSym) {
  if (!bitmexSym) return null;
  try {
    const res = await fetch(`https://www.bitmex.com/api/v1/funding?symbol=${bitmexSym}&count=1&reverse=true`, { signal: newSig() });
    if (!res.ok) return null;
    const data = await res.json();
    const d = data?.[0];
    if (!d) return null;
    return {
      rate:          parseFloat(d.fundingRate),
      nextFundingTs: null, // BitMEX doesn't return nextFundingTs in this endpoint
    };
  } catch { return null; }
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
  // OKX first — only exchange reliably reachable from Vercel US
  // Map Binance-style symbol (BTCUSDT) to OKX instId (BTC-USDT-SWAP)
  const base = symbol.replace(/USDT$/, '');
  const okxInstId = `${base}-USDT-SWAP`;
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/public/funding-rate-history?instId=${okxInstId}&limit=90`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (res.ok) {
      const data = await res.json();
      const list = data?.data;
      if (Array.isArray(list) && list.length) {
        // OKX returns newest first — reverse to chronological
        return list.reverse().map(d => ({
          ts:   parseInt(d.fundingTime, 10),
          rate: parseFloat(d.fundingRate),
        }));
      }
    }
  } catch {}

  // Fallback: Bybit (blocked on Vercel US but try anyway)
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbol}&limit=90`,
      { signal: AbortSignal.timeout(6_000) }
    );
    if (res.ok) {
      const data = await res.json();
      const list = data?.result?.list;
      if (Array.isArray(list) && list.length) {
        return list.reverse().map(d => ({
          ts:   parseInt(d.fundingRateTimestamp, 10),
          rate: parseFloat(d.fundingRate),
        }));
      }
    }
  } catch {}

  // Final fallback: Binance
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=90`,
      { signal: AbortSignal.timeout(6_000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(d => ({ ts: d.fundingTime, rate: parseFloat(d.fundingRate) }));
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

  // Fetch all three exchanges in parallel (per-coin calls for OKX, MEXC, BitMEX)
  const [okxResults, mexcResults, bitmexResults] = await Promise.all([
    Promise.all(COINS.map(c => fetchOKX(c.okx).catch(() => null))),
    Promise.all(COINS.map(c => fetchMEXC(c.mexc).catch(() => null))),
    Promise.all(COINS.map(c => fetchBitMEX(c.bitmex).catch(() => null))),
  ]);

  // Build per-coin rows
  const coins = COINS.map((c, i) => {
    const o  = okxResults[i];
    const m  = mexcResults[i];
    const bm = bitmexResults[i];

    const rates = [o?.rate, m?.rate, bm?.rate].filter(r => r != null);
    const avg   = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

    const nextFundingTs = o?.nextFundingTs ?? m?.nextFundingTs ?? bm?.nextFundingTs ?? null;

    return {
      symbol: c.symbol,
      okx:     o?.rate  ?? null,
      mexc:    m?.rate  ?? null,
      bitmex:  bm?.rate ?? null,
      avg,
      nextFundingTs,
    };
  });

  // Overall market bias — avg of all available rates
  const allRates  = coins.flatMap(c => [c.okx, c.mexc, c.bitmex]).filter(r => r != null);
  const marketAvg = allRates.length ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 0;

  cache   = { coins, marketAvg, updatedAt: Date.now() };
  cacheTs = Date.now();
  return Response.json(cache);
}
