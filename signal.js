// signal.js — EMA Bounce Confluence Signal Engine

const { calcEMA, calcRSI, avgVolume, detectBullDivergence, detectBearDivergence } = require('./indicators');

const CONFIG = {
  EMA_TOUCH_PCT:    0.003,  // price within 0.3% of EMA20 = "touch zone"
  RSI_LONG_MIN:     40,     // RSI floor for long
  RSI_LONG_MAX:     65,     // RSI ceiling for long
  RSI_SHORT_MIN:    35,     // RSI floor for short
  RSI_SHORT_MAX:    60,     // RSI ceiling for short
  VOL_RATIO:        1.5,    // volume must be 1.5x avg
  WICK_RATIO:       1.2,    // wick must be 1.2x body size
  MIN_SCORE:        6,      // minimum score to fire alert
  COOLDOWN_CANDLES: 3,      // 3 × 15m = 45 min cooldown per symbol
};

// Track last signal time per symbol
const cooldowns = new Map();

/**
 * Analyse a single symbol and return signal or null
 * @param {string} symbol
 * @param {Object} data15m - OHLCV from 15m klines
 * @param {Object} data5m  - OHLCV from 5m klines (for RSI lock)
 * @returns {Object|null} signal object or null
 */
function analyseSymbol(symbol, data15m, data5m) {
  if (!data15m || !data5m) return null;

  const { closes: c15, highs, lows, volumes } = data15m;
  const { closes: c5 } = data5m;

  // ── Indicators ──────────────────────────────────────────────────────
  const ema20 = calcEMA(c15, 20);
  const ema40 = calcEMA(c15, 40);
  const ema80 = calcEMA(c15, 80);
  const rsi5m = calcRSI(c5, 14);
  const volAvg = avgVolume(volumes, 10);
  const lastVol = volumes[volumes.length - 1];
  const price = c15[c15.length - 1];

  if (!ema20 || !ema40 || !ema80 || rsi5m === null) return null;

  // ── Determine direction from EMA stack ──────────────────────────────
  const isBullStack = ema20 > ema40 && ema40 > ema80;
  const isBearStack = ema20 < ema40 && ema40 < ema80;
  if (!isBullStack && !isBearStack) return null; // No clear trend — skip

  const direction = isBullStack ? 'LONG' : 'SHORT';

  // ── C1: Price touch zone ─────────────────────────────────────────────
  const emaDist = Math.abs(price - ema20) / ema20;
  const c1_touch = emaDist <= CONFIG.EMA_TOUCH_PCT;

  // ── C2: EMA stack aligned ────────────────────────────────────────────
  const c2_trend = isBullStack || isBearStack; // already checked above

  // ── C3: RSI in range ─────────────────────────────────────────────────
  let c3_rsi = false;
  if (direction === 'LONG')  c3_rsi = rsi5m >= CONFIG.RSI_LONG_MIN  && rsi5m <= CONFIG.RSI_LONG_MAX;
  if (direction === 'SHORT') c3_rsi = rsi5m >= CONFIG.RSI_SHORT_MIN && rsi5m <= CONFIG.RSI_SHORT_MAX;

  // ── C4: Volume spike ─────────────────────────────────────────────────
  const volRatio = volAvg > 0 ? lastVol / volAvg : 0;
  const c4_vol = volRatio >= CONFIG.VOL_RATIO;

  // Gate: all 4 core conditions must pass
  if (!c1_touch || !c2_trend || !c3_rsi || !c4_vol) return null;

  // ── C5: Rejection wick (bonus) ───────────────────────────────────────
  const lastOpen  = data15m.opens[data15m.opens.length - 1];
  const lastHigh  = highs[highs.length - 1];
  const lastLow   = lows[lows.length - 1];
  const bodySize  = Math.abs(price - lastOpen);
  let c5_wick = false;
  if (direction === 'LONG') {
    const lowerWick = Math.min(lastOpen, price) - lastLow;
    c5_wick = bodySize > 0 && lowerWick >= bodySize * CONFIG.WICK_RATIO;
  } else {
    const upperWick = lastHigh - Math.max(lastOpen, price);
    c5_wick = bodySize > 0 && upperWick >= bodySize * CONFIG.WICK_RATIO;
  }

  // ── C6: RSI divergence (bonus) ───────────────────────────────────────
  // Build rolling RSI values for divergence check
  const rsiHistory = buildRSIHistory(c5, 14, 20);
  let c6_div = false;
  if (direction === 'LONG')  c6_div = detectBullDivergence(c15.slice(-20), rsiHistory);
  if (direction === 'SHORT') c6_div = detectBearDivergence(c15.slice(-20), rsiHistory);

  // ── Score ────────────────────────────────────────────────────────────
  // C1–C4: 2pts each (already passed = 8 base)
  // C5: +1, C6: +1 → max 10
  let score = 8;
  if (c5_wick) score += 1;
  if (c6_div)  score += 1;

  if (score < CONFIG.MIN_SCORE) return null;

  // ── Cooldown check ───────────────────────────────────────────────────
  const lastFired = cooldowns.get(symbol);
  const now = Date.now();
  if (lastFired && (now - lastFired) < CONFIG.COOLDOWN_CANDLES * 15 * 60 * 1000) return null;

  // Record fire time
  cooldowns.set(symbol, now);

  return {
    symbol,
    direction,
    score,
    price,
    ema20: +ema20.toFixed(8),
    ema40: +ema40.toFixed(8),
    ema80: +ema80.toFixed(8),
    emaDistPct: +(emaDist * 100).toFixed(3),
    rsi: +rsi5m.toFixed(1),
    volRatio: +volRatio.toFixed(2),
    wickReject: c5_wick,
    divergence: c6_div,
    time: new Date().toISOString(),
    conditions: { c1_touch, c2_trend, c3_rsi, c4_vol, c5_wick, c6_div },
  };
}

/**
 * Build array of RSI values for the last N windows
 */
function buildRSIHistory(closes, period = 14, windows = 20) {
  const result = [];
  for (let i = closes.length - windows; i <= closes.length; i++) {
    if (i < period + 1) { result.push(50); continue; }
    const slice = closes.slice(0, i);
    const rsi = calcRSI(slice, period);
    result.push(rsi !== null ? rsi : 50);
  }
  return result;
}

module.exports = { analyseSymbol, CONFIG };
