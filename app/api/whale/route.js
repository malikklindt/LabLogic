// ── Server cache ──────────────────────────────────────────────────────────────
let cache = { data: null, fetchedAt: 0 };
const TTL = 90_000;

// ── Known exchange hot wallet addresses ───────────────────────────────────────
const EXCHANGE_WALLETS = {
  // ── Bitcoin ──────────────────────────────────────────────────────────────────
  '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo':                              'Binance',
  '1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s':                              'Binance',
  'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97': 'Binance',
  '1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1':                             'Binance',
  '3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6':                              'Binance',
  '3E3Mf7h6yxSNXuUNY6Y3YNT4p4C4yYD1nF':                             'Coinbase',
  '3AfLF46i1MqzStKDCE5EBuA5xEdNqY2NeD':                             'Kraken',
  '3FupZp77ySr7jwoLYEJ9mwzJpvoNBXsBnE':                             'Kraken',
  'bc1qn3deline7gcklk84cmtnxdmezqyqupxwqf4dxy':                     'Kraken',
  '3JZq4atEAaEy8j4fKG5L2cJbqPSEGkPNfN':                             'Bitfinex',
  '1KYiKJEfdJtap9QX2v9BXJMpz2SfU4pgZw':                             'Bitfinex',
  '3LQUu4v9z6KNch71j7kbj8GPeAGUo1FW6a':                             'OKX',
  '3Kzh9qAqVWQhEsfQz7zEQL1EuSx5tyNLNS':                             'OKX',
  '3LCGsSmfr24demGvriN4e3ft8wTcnAySyd':                             'Gemini',
  '393HnB2jMmBNMtPmN8MRVEJrZvSuKdE4T1':                             'Bybit',
  '3N5oTMd2p3WLfrCVBEQRwR7kGVERkFD8sM':                             'Bybit',
  // ── Ethereum (lowercase) ─────────────────────────────────────────────────────
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Binance',
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': 'Binance',
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': 'Binance',
  '0xf977814e90da44bfa03b6295a0616a897441acec': 'Binance',
  '0x8894e0a0c962cb723c1976a4421c95949be2d4e3': 'Binance',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase',
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': 'Coinbase',
  '0x3cd751e6b0078be393132286c442345e5dc49699': 'Coinbase',
  '0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511': 'Coinbase',
  '0xa090e606e30bd747d4e6245a1517ebe430f0057e': 'Coinbase',
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': 'Kraken',
  '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13': 'Kraken',
  '0xae2d4617c862309a3d75a0ffb358c7a5009c673f': 'Kraken',
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': 'OKX',
  '0x236f9f97e0e62388479bf9e5ba4889e46b0273c3': 'OKX',
  '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa': 'Bitfinex',
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40': 'Bybit',
  '0xd24400ae8bfebb18ca49be86258a3c749cf46853': 'Gemini',
  '0x07ee55aa48bb72dcc6e9d78256648910de513eca': 'Gemini',
};

function tagAddress(addr) {
  if (!addr) return { name: 'Unknown Wallet', type: 'unknown' };
  const name = EXCHANGE_WALLETS[addr] || EXCHANGE_WALLETS[addr.toLowerCase()];
  if (name) return { name, type: 'exchange' };
  const short = addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
  return { name: short, type: 'unknown' };
}

function classifySignal(from, to) {
  const fromEx = from?.type === 'exchange';
  const toEx   = to?.type   === 'exchange';
  if (fromEx && !toEx) return 'outflow';
  if (!fromEx && toEx) return 'inflow';
  if (fromEx && toEx)  return 'exchange';
  return 'transfer';
}

function signalMeta(signal) {
  switch (signal) {
    case 'outflow':  return { label: 'Exchange Outflow', sentiment: 'Bullish',  color: '#22c55e', explanation: 'Whales withdrawing from exchange — likely holding, not selling. Reduces available sell-side supply.' };
    case 'inflow':   return { label: 'Exchange Inflow',  sentiment: 'Bearish',  color: '#ef4444', explanation: 'Whales depositing to exchange — potential selling pressure ahead. Watch for price follow-through.' };
    case 'exchange': return { label: 'Exchange Transfer', sentiment: 'Neutral', color: '#f97316', explanation: 'Moving between exchanges — may indicate arbitrage or portfolio repositioning. No direct signal.' };
    default:         return { label: 'Wallet Transfer',  sentiment: 'Neutral',  color: '#a855f7', explanation: 'Between private wallets — intent unclear. Could be custody move, OTC deal, or internal transfer.' };
  }
}

// ── BTC price (for USD calculation) ──────────────────────────────────────────
async function fetchBTCPrice() {
  try {
    const res = await fetch('https://blockchain.info/ticker', {
      cache: 'no-store', signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return 95000;
    const data = await res.json();
    return data?.USD?.last ?? 95000;
  } catch (_) { return 95000; }
}

// ── BTC via blockchain.info — free, no API key ────────────────────────────────
async function fetchBTCTransactions(btcPrice) {
  // Fetch mempool transactions — includes full input/output addresses
  const res = await fetch(
    'https://blockchain.info/unconfirmed-transactions?format=json&limit=500',
    { cache: 'no-store', signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) throw new Error(`blockchain.info ${res.status}`);
  const data = await res.json();
  const allTxs = data.txs ?? [];

  // Minimum: 5 BTC ≈ ~$500K (adjusts with real price)
  const minSats = Math.floor((500_000 / btcPrice) * 1e8);

  const large = allTxs
    .map(tx => {
      const totalOut = (tx.out ?? []).reduce((s, o) => s + (o.value ?? 0), 0);
      return { tx, totalOut };
    })
    .filter(({ totalOut }) => totalOut >= minSats)
    .sort((a, b) => b.totalOut - a.totalOut)
    .slice(0, 12);

  return large.map(({ tx, totalOut }) => {
    const senderAddr   = tx.inputs?.[0]?.prev_out?.addr;
    const topOutput    = (tx.out ?? []).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    const receiverAddr = topOutput?.addr;

    const from   = tagAddress(senderAddr);
    const to     = tagAddress(receiverAddr);
    const signal = classifySignal(from, to);
    const amount = totalOut / 1e8;

    return {
      id: tx.hash,
      timestamp: tx.time ? tx.time * 1000 : Date.now(),
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount,
      amount_usd: amount * btcPrice,
      from, to, signal,
      ...signalMeta(signal),
      mock: false,
    };
  });
}

// ── ETH via Etherscan (optional — add ETHERSCAN_KEY to .env.local) ────────────
async function fetchETHTransactions(ethPrice) {
  const key = process.env.ETHERSCAN_KEY;
  if (!key) return [];

  // Get latest block number
  const blockRes = await fetch(
    `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_blockNumber&apikey=${key}`,
    { cache: 'no-store', signal: AbortSignal.timeout(6000) }
  );
  if (!blockRes.ok) throw new Error(`Etherscan blockNumber ${blockRes.status}`);
  const blockData = await blockRes.json();
  const blockNum = blockData.result;
  if (!blockNum) throw new Error('No block number from Etherscan');

  // Fetch full block with transactions
  const txRes = await fetch(
    `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getBlockByNumber&tag=${blockNum}&boolean=true&apikey=${key}`,
    { cache: 'no-store', signal: AbortSignal.timeout(8000) }
  );
  if (!txRes.ok) throw new Error(`Etherscan block ${txRes.status}`);
  const txData = await txRes.json();
  const txs = txData.result?.transactions ?? [];

  // Minimum ETH value for $500K threshold
  const minEth = 500_000 / (ethPrice || 3200);

  return txs
    .filter(tx => {
      const eth = parseInt(tx.value, 16) / 1e18;
      return eth >= minEth;
    })
    .slice(0, 8)
    .map(tx => {
      const amount = parseInt(tx.value, 16) / 1e18;
      const from   = tagAddress(tx.from);
      const to     = tagAddress(tx.to);
      const signal = classifySignal(from, to);
      return {
        id: tx.hash,
        timestamp: Date.now(),
        blockchain: 'ethereum',
        symbol: 'ETH',
        amount,
        amount_usd: amount * (ethPrice || 3200),
        from, to, signal,
        ...signalMeta(signal),
        mock: false,
      };
    });
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
function getMockTransactions() {
  const now = Date.now();
  const raw = [
    { blockchain: 'bitcoin',  symbol: 'BTC', from: { name: 'Coinbase',  type: 'exchange' }, to: { name: 'bc1q…4h',   type: 'unknown'  }, amount: 842,   amount_usd: 84_200_000,  minsAgo: 4  },
    { blockchain: 'bitcoin',  symbol: 'BTC', from: { name: '3Fc8…2R',   type: 'unknown'  }, to: { name: 'Binance',   type: 'exchange' }, amount: 245,   amount_usd: 24_500_000,  minsAgo: 9  },
    { blockchain: 'bitcoin',  symbol: 'BTC', from: { name: 'Kraken',    type: 'exchange' }, to: { name: 'bc1p…7s',   type: 'unknown'  }, amount: 310,   amount_usd: 31_000_000,  minsAgo: 17 },
    { blockchain: 'bitcoin',  symbol: 'BTC', from: { name: 'bc1p…3w',   type: 'unknown'  }, to: { name: 'bc1q…9m',   type: 'unknown'  }, amount: 1200,  amount_usd: 120_000_000, minsAgo: 26 },
    { blockchain: 'bitcoin',  symbol: 'BTC', from: { name: 'Binance',   type: 'exchange' }, to: { name: 'Coinbase',  type: 'exchange' }, amount: 175,   amount_usd: 17_500_000,  minsAgo: 52 },
    { blockchain: 'ethereum', symbol: 'ETH', from: { name: '0x4f2e…8a', type: 'unknown'  }, to: { name: 'Binance',   type: 'exchange' }, amount: 12400, amount_usd: 40_300_000,  minsAgo: 14 },
    { blockchain: 'ethereum', symbol: 'ETH', from: { name: 'Coinbase',  type: 'exchange' }, to: { name: '0x7c3a…2f', type: 'unknown'  }, amount: 8200,  amount_usd: 26_650_000,  minsAgo: 33 },
    { blockchain: 'ethereum', symbol: 'ETH', from: { name: 'Kraken',    type: 'exchange' }, to: { name: '0xa3c7…1b', type: 'unknown'  }, amount: 6800,  amount_usd: 22_100_000,  minsAgo: 88 },
  ];
  return raw.map((tx, i) => {
    const signal = classifySignal(tx.from, tx.to);
    return { id: `mock_${i}`, timestamp: now - tx.minsAgo * 60_000, ...tx, signal, ...signalMeta(signal), mock: true };
  });
}

function getMockLiquidations() {
  return {
    total_usd: 284_000_000, longs_usd: 180_000_000, shorts_usd: 104_000_000,
    recent: [
      { side: 'Long',  amount_usd: 4_200_000, symbol: 'BTC/USDT', exchange: 'Binance',  minsAgo: 12 },
      { side: 'Short', amount_usd: 2_800_000, symbol: 'BTC/USDT', exchange: 'OKX',      minsAgo: 28 },
      { side: 'Long',  amount_usd: 6_100_000, symbol: 'ETH/USDT', exchange: 'Bybit',    minsAgo: 41 },
      { side: 'Short', amount_usd: 1_900_000, symbol: 'BTC/USDT', exchange: 'Binance',  minsAgo: 67 },
      { side: 'Long',  amount_usd: 3_400_000, symbol: 'BTC/USDT', exchange: 'Bitfinex', minsAgo: 93 },
    ],
    mock: true,
  };
}

function calcStats(transactions) {
  const total_usd   = transactions.reduce((s, t) => s + t.amount_usd, 0);
  const inflow_usd  = transactions.filter(t => t.signal === 'inflow').reduce((s, t) => s + t.amount_usd, 0);
  const outflow_usd = transactions.filter(t => t.signal === 'outflow').reduce((s, t) => s + t.amount_usd, 0);
  const net_usd     = outflow_usd - inflow_usd;
  const largest     = transactions.reduce((b, t) => t.amount_usd > (b?.amount_usd ?? 0) ? t : b, null);
  return { total_usd, inflow_usd, outflow_usd, net_usd, largest };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < TTL) {
    return Response.json(cache.data);
  }

  let transactions = [];
  let live = false;

  try {
    // Fetch prices + transactions in parallel
    const [btcPrice, ethPriceRes] = await Promise.all([
      fetchBTCPrice(),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
        cache: 'no-store', signal: AbortSignal.timeout(4000)
      }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    const ethPrice = ethPriceRes?.ethereum?.usd ?? 3200;

    const [btcResult, ethResult] = await Promise.allSettled([
      fetchBTCTransactions(btcPrice),
      fetchETHTransactions(ethPrice),
    ]);

    const btc = btcResult.status === 'fulfilled' ? btcResult.value : [];
    const eth = ethResult.status === 'fulfilled' ? ethResult.value : [];
    if (btcResult.status === 'rejected') console.error('[whale] BTC:', btcResult.reason?.message);
    if (ethResult.status === 'rejected') console.error('[whale] ETH:', ethResult.reason?.message);

    transactions = [...btc, ...eth].sort((a, b) => b.timestamp - a.timestamp);
    live = transactions.length > 0;
  } catch (err) {
    console.error('[whale] error:', err.message);
  }

  const usingMock = !live;
  if (usingMock) transactions = getMockTransactions();

  const stats        = calcStats(transactions);
  const liquidations = getMockLiquidations();
  const hasEthKey    = !!process.env.ETHERSCAN_KEY;
  const data = { transactions, stats, liquidations, live, mock: usingMock, hasEthKey, updatedAt: now };

  cache = { data, fetchedAt: now };
  return Response.json(data);
}
