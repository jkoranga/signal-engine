// binance.js — Binance public API fetcher (no key required)

const BASE = 'https://api.binance.com';

/**
 * Fetch klines from Binance
 * @param {string} symbol - e.g. 'LUNCUSDT'
 * @param {string} interval - e.g. '15m', '5m'
 * @param {number} limit - number of candles (max 1000)
 * @returns {Promise<Object>} parsed OHLCV arrays
 */
async function fetchKlines(symbol, interval, limit = 100) {
  const url = `${BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance fetch failed: ${res.status} ${symbol} ${interval}`);
  const raw = await res.json();

  // Binance kline format:
  // [openTime, open, high, low, close, volume, closeTime, ...]
  return {
    opens:   raw.map(k => parseFloat(k[1])),
    highs:   raw.map(k => parseFloat(k[2])),
    lows:    raw.map(k => parseFloat(k[3])),
    closes:  raw.map(k => parseFloat(k[4])),
    volumes: raw.map(k => parseFloat(k[5])),
    times:   raw.map(k => k[0]),
  };
}

/**
 * Fetch top N USDT pairs by volume from Binance
 * Uses the 24hr ticker endpoint
 */
async function fetchTopPairs(limit = 30) {
  const url = `${BASE}/api/v3/ticker/24hr`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ticker fetch failed: ${res.status}`);
  const data = await res.json();
  return data
    .filter(t => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 0)
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, limit)
    .map(t => t.symbol);
}

/**
 * Staggered multi-symbol fetch — respects Binance rate limits
 * @param {string[]} symbols
 * @param {string} interval
 * @param {number} limit
 * @param {number} delayMs - ms between requests
 */
async function fetchMultiKlines(symbols, interval, limit = 100, delayMs = 200) {
  const results = {};
  for (const sym of symbols) {
    try {
      results[sym] = await fetchKlines(sym, interval, limit);
    } catch (e) {
      console.error(`[binance] skip ${sym}: ${e.message}`);
      results[sym] = null;
    }
    if (delayMs > 0) await sleep(delayMs);
  }
  return results;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { fetchKlines, fetchTopPairs, fetchMultiKlines };
