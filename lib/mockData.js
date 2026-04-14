function genPrice(start, days, vol) {
  const d = [];
  let p = start;
  for (let i = 0; i < days; i++) {
    p *= 1 + (Math.random() - 0.49) * vol;
    d.push(parseFloat(p.toFixed(2)));
  }
  return d;
}

function genSmooth(start, days, drift, noise) {
  const out = [];
  let p = start, vel = 0;
  for (let i = 0; i < days; i++) {
    vel = vel * 0.78 + (Math.random() - 0.5) * noise;
    p *= (1 + drift + vel);
    out.push(parseFloat(p.toFixed(4)));
  }
  return out;
}

export const ASSET_DATA = {
  'BTC/USD': (() => { const d = genPrice(52000, 60, 0.034); d[59] = 67289; return d; })(),
  'ETH/USD': (() => { const d = genPrice(2600, 60, 0.038); d[59] = 3184; return d; })(),
  'SOL/USD': (() => { const d = genPrice(105, 60, 0.05); d[59] = 142.5; return d; })(),
  'BTC.D':   (() => { const d = genPrice(50, 60, 0.012); d[59] = 54.3; return d; })(),
};

export const VOL_IV_CUR = 80;
export const VOL_RV_CUR = 40;
export const VOL_DATA = {
  '1W': {
    iv: genPrice(82, 7, 0.055).map(v => Math.min(95, Math.max(58, v))),
    rv: genPrice(38, 7, 0.065).map(v => Math.min(52, Math.max(22, v))),
  },
  '1M': {
    iv: genPrice(72, 30, 0.060).map(v => Math.min(95, Math.max(55, v))),
    rv: genPrice(36, 30, 0.060).map(v => Math.min(55, Math.max(20, v))),
  },
  '3M': {
    iv: genPrice(65, 90, 0.060).map(v => Math.min(95, Math.max(35, v))),
    rv: genPrice(42, 90, 0.060).map(v => Math.min(75, Math.max(20, v))),
  },
};

export const CORR_DATA = {
  'BTC/DXY': {
    '1W': { d1: genSmooth(62000, 7, 0, 0.018),  d2: genSmooth(104, 7, 0.0004, 0.0025) },
    '1M': { d1: genSmooth(62000, 30, 0, 0.018), d2: genSmooth(104, 30, 0.0004, 0.0025) },
    '3M': { d1: genSmooth(62000, 90, 0, 0.018), d2: genSmooth(104, 90, 0.0004, 0.0025) },
  },
  'BTC/Gold': {
    '1W': { d1: genSmooth(62000, 7, 0, 0.018),  d2: genSmooth(1920, 7, 0.0005, 0.006) },
    '1M': { d1: genSmooth(62000, 30, 0, 0.018), d2: genSmooth(1920, 30, 0.0005, 0.006) },
    '3M': { d1: genSmooth(62000, 90, 0, 0.018), d2: genSmooth(1920, 90, 0.0005, 0.006) },
  },
  'BTC/M2': {
    '1W': { d1: genSmooth(62000, 7, 0, 0.018),  d2: genSmooth(108500, 7, 0.0008, 0.0008) },
    '1M': { d1: genSmooth(62000, 30, 0, 0.018), d2: genSmooth(108500, 30, 0.0008, 0.0008) },
    '3M': { d1: genSmooth(62000, 90, 0, 0.018), d2: genSmooth(108500, 90, 0.0008, 0.0008) },
  },
  'BTC/SPX': {
    '1W': { d1: genSmooth(62000, 7, 0, 0.018),  d2: genSmooth(5220, 7, 0.0004, 0.009) },
    '1M': { d1: genSmooth(62000, 30, 0, 0.018), d2: genSmooth(5220, 30, 0.0004, 0.009) },
    '3M': { d1: genSmooth(62000, 90, 0, 0.018), d2: genSmooth(5220, 90, 0.0004, 0.009) },
  },
};

export const ASSETS = [
  { id: 'BTC/USD', price: 67289, chg: -2.81 },
  { id: 'ETH/USD', price: 3184,  chg: -1.92 },
  { id: 'SOL/USD', price: 142.5, chg: +3.14 },
];

export const ASSET_SUMMARIES = {
  'BTC/USD': 'Bitcoin sold off during the overnight session following hawkish Fed commentary. Analysts predict this is a short-term pullback and a recovery leg is likely. At this time, bears continue to dominate price action.',
  'ETH/USD': 'Ethereum faces continued selling pressure as Layer-2 competition intensifies. Key support at $3,000 remains intact. Watch for ETF inflow catalysts to reverse the trend.',
  'SOL/USD': 'Solana outperforms the broader crypto market driven by DeFi activity surge and network upgrades. RSI approaching overbought territory — exercise caution on new longs.',
  'BTC.D':   'Bitcoin dominance rising as altcoins bleed. Risk-off environment favors BTC relative to the broader market. Watch for altcoin season triggers near 52% support.',
};

export const ECO_EVENTS = [
  { time: '14:30', flag: '🇨🇦', name: 'Exports', imp: 'Low' },
  { time: '14:30', flag: '🇨🇦', name: 'Imports', imp: 'Low' },
  { time: '14:30', flag: '🇨🇦', name: 'International Merchandise Trade', imp: 'Low' },
  { time: '14:30', flag: '🇺🇸', name: 'Continuing Jobless Claims', imp: 'Low' },
  { time: '14:30', flag: '🇺🇸', name: 'Initial Jobless Claims', imp: 'Medium' },
  { time: '16:00', flag: '🇺🇸', name: 'Fed Chair Powell Speech', imp: 'High' },
  { time: '19:00', flag: '🇺🇸', name: 'Consumer Credit', imp: 'Low' },
];

export const WATCH_NOTES = {
  'Exports':                        { beat: 'CAD strengthens on trade surplus — mild risk-on tailwind for BTC.', miss: 'CAD weakness signals softening economy — minor BTC headwind.' },
  'Imports':                        { beat: 'Demand signal healthy — supports broad risk appetite.', miss: 'Weak imports suggest demand slowdown — cautious for risk assets.' },
  'International Merchandise Trade':{ beat: 'Narrowing deficit supports CAD and risk-on positioning.', miss: 'Widening deficit may pressure CAD — limited direct BTC impact.' },
  'Continuing Jobless Claims':      { beat: 'Tighter labor market boosts risk appetite — bullish BTC.', miss: 'Rising claims stoke recession fears — potential BTC sell-off.' },
  'Initial Jobless Claims':         { beat: 'Strong labor data → risk-on, DXY may dip — BTC bullish.', miss: 'Weak jobs data → flight to safety, DXY up — BTC bearish pressure.' },
  'Fed Chair Powell Speech':        { beat: 'Dovish tone → DXY drops, liquidity expands — BTC bullish.', miss: 'Hawkish surprise → DXY rallies, risk-off — BTC likely sells off.' },
  'Consumer Credit':                { beat: 'Credit expansion signals consumer confidence — mild risk-on.', miss: 'Credit contraction warns of consumer stress — risk-off signal.' },
};

export const EARNINGS = [
  { time: 'BMO', flag: '🇺🇸', name: 'JPMorgan Chase (JPM)', imp: 'High' },
  { time: 'BMO', flag: '🇺🇸', name: 'Wells Fargo (WFC)', imp: 'Medium' },
  { time: 'AMC', flag: '🇺🇸', name: 'Delta Air Lines (DAL)', imp: 'Medium' },
  { time: 'AMC', flag: '🇺🇸', name: 'Fastenal Company (FAST)', imp: 'Low' },
];

export const NEWS = [
  { id: 1, src: 'Reuters',   dt: 'Apr 4, 2026 5:55 PM',  snt: 'BULLISH', hl: 'ADP NATIONAL EMPLOYMENT REPORT SHOWS U.S. EMPLOYMENT INCREASED BY 54,000 PRIVATE SECTOR JOBS IN APR', url: null },
  { id: 2, src: 'Bloomberg', dt: 'Apr 4, 2026 4:15 PM',  snt: 'BEARISH', hl: 'TRUMP TARIFF THREAT ON CHINESE SEMICONDUCTORS SPARKS RISK-OFF SELLOFF ACROSS EQUITY MARKETS', url: null },
  { id: 3, src: 'CoinDesk',  dt: 'Apr 4, 2026 1:17 PM',  snt: 'BULLISH', hl: 'BITCOIN ETF INFLOWS SURGE TO $820M AS INSTITUTIONAL DEMAND CONTINUES TO BUILD ON PRICE DIPS', url: null },
  { id: 4, src: 'WSJ',       dt: 'Apr 4, 2026 11:30 AM', snt: 'NEUTRAL', hl: 'FED OFFICIALS SIGNAL PATIENCE ON RATE CUTS AMID MIXED LABOR MARKET SIGNALS', url: null },
  { id: 5, src: 'FT',        dt: 'Apr 4, 2026 9:45 AM',  snt: 'BEARISH', hl: 'DOLLAR STRENGTHENS AS SAFE-HAVEN DEMAND RISES AMID GEOPOLITICAL TENSIONS IN SOUTHEAST ASIA', url: null },
];

export const CORR_CFG = {
  'BTC/DXY':  { corr: -5,  c1: '#f7931a', c2: '#94a3b8', l1: 'BTC', l2: 'DXY',  fullName: 'Bitcoin vs Dollar Index' },
  'BTC/Gold': { corr: 32,  c1: '#f7931a', c2: '#94a3b8', l1: 'BTC', l2: 'Gold', fullName: 'Bitcoin vs Gold' },
  'BTC/M2':   { corr: 72,  c1: '#f7931a', c2: '#94a3b8', l1: 'BTC', l2: 'M2',   fullName: 'Bitcoin vs Global Liquidity' },
  'BTC/SPX':  { corr: 61,  c1: '#f7931a', c2: '#94a3b8', l1: 'BTC', l2: 'SPX',  fullName: 'Bitcoin vs S&P 500' },
};
