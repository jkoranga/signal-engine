// indicators.js — EMA, RSI, Volume calculations

/**
 * Exponential Moving Average
 * @param {number[]} closes - array of close prices
 * @param {number} period
 * @returns {number} current EMA value
 */
function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * RSI (Wilder smoothing)
 * @param {number[]} closes
 * @param {number} period - default 14
 * @returns {number} RSI 0–100
 */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Average volume over last N bars
 */
function avgVolume(volumes, period = 10) {
  const slice = volumes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Detect bullish RSI divergence
 * Price: lower low, RSI: higher low — over last N bars
 */
function detectBullDivergence(closes, rsiValues, lookback = 5) {
  if (closes.length < lookback + 1 || rsiValues.length < lookback + 1) return false;
  const priceSlice = closes.slice(-lookback);
  const rsiSlice = rsiValues.slice(-lookback);
  const priceMin = Math.min(...priceSlice);
  const rsiAtPriceMin = rsiSlice[priceSlice.indexOf(priceMin)];
  const prevPriceMin = Math.min(...closes.slice(-(lookback * 2), -lookback));
  const prevRsiMin = Math.min(...rsiValues.slice(-(lookback * 2), -lookback));
  return priceMin < prevPriceMin && rsiAtPriceMin > prevRsiMin;
}

/**
 * Detect bearish RSI divergence
 * Price: higher high, RSI: lower high
 */
function detectBearDivergence(closes, rsiValues, lookback = 5) {
  if (closes.length < lookback + 1 || rsiValues.length < lookback + 1) return false;
  const priceSlice = closes.slice(-lookback);
  const rsiSlice = rsiValues.slice(-lookback);
  const priceMax = Math.max(...priceSlice);
  const rsiAtPriceMax = rsiSlice[priceSlice.indexOf(priceMax)];
  const prevPriceMax = Math.max(...closes.slice(-(lookback * 2), -lookback));
  const prevRsiMax = Math.max(...rsiValues.slice(-(lookback * 2), -lookback));
  return priceMax > prevPriceMax && rsiAtPriceMax < prevRsiMax;
}

module.exports = { calcEMA, calcRSI, avgVolume, detectBullDivergence, detectBearDivergence };
