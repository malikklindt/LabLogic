// Server-side rolling buffer for BTC dominance readings.
// Populated by /api/prices on every successful fetch (~30s intervals).
// Read by /api/chart when coin=btcd is requested.
//
// Why this exists: CoinGecko rate-limits aggressively when multiple calls
// arrive at once (prices + chart). This module makes the BTC.D chart
// completely independent of CoinGecko after the first few minutes of running.

const readings = [];       // { t: timestamp_ms, v: dominance_pct }
const MAX_READINGS = 3000; // ~25 hours at 30s intervals — auto-expiring rolling window

/**
 * Push a new dominance reading. Called by the prices API after every
 * successful Binance + CoinGecko fetch. Deduplicates rapid calls.
 */
export function recordDom(value) {
  if (value == null || !isFinite(value)) return;
  const now  = Date.now();
  const last = readings.at(-1);
  if (last && now - last.t < 20_000) return; // skip if called within 20s
  readings.push({ t: now, v: parseFloat(value.toFixed(3)) });
  if (readings.length > MAX_READINGS) readings.shift();
}

/**
 * Return all readings since `sinceMs` as [[timestamp_ms, dominance%], ...].
 * Sorted oldest-first (already the case since we push in order).
 */
export function queryDom(sinceMs) {
  return readings
    .filter(r => r.t >= sinceMs)
    .map(r => [r.t, r.v]);
}

/** Total number of readings accumulated so far. */
export function domCount() {
  return readings.length;
}
