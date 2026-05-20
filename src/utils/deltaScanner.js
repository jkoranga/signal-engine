// ─── Delta Exchange India — Candle + Symbol Fetcher ───────────────────────────
// Completely separate from Binance scanner.
// Delta API docs: https://docs.delta.exchange
// Base URL: https://api.india.delta.exchange

const DELTA_BASE = 'https://api.india.delta.exchange'
const DELTA_TIMEOUT = 10000

// Delta interval map → their format
const DELTA_INTERVAL_MAP = {
  '1m':  '1m',
  '3m':  '3m',
  '5m':  '5m',
  '15m': '15m',
  '30m': '30m',
  '1h':  '1h',
  '4h':  '4h',
  '1d':  '1d',
}

// ── Fetch all active USDT perpetual products from Delta India ─────────────────
export async function fetchDeltaSymbols() {
  try {
    const res = await fetch(
      `${DELTA_BASE}/v2/products?contract_types=perpetual_futures&states=live&page_size=200`,
      { signal: AbortSignal.timeout(DELTA_TIMEOUT) }
    )
    if (!res.ok) throw new Error(`Delta API ${res.status}`)
    const data = await res.json()
    const products = data.result || []
    return products
      .filter(p =>
        p.quoting_asset?.symbol === 'USDT' &&
        p.state === 'live' &&
        p.contract_type === 'perpetual_futures'
      )
      .map(p => ({
        symbol:  p.symbol,           // e.g. "BTCUSDT"
        name:    p.underlying_asset?.symbol || p.symbol,
        markPrice: parseFloat(p.mark_price || 0),
        volume:  parseFloat(p.volume || 0),
      }))
      .sort((a, b) => b.volume - a.volume)
  } catch (e) {
    console.warn('[Delta] fetchDeltaSymbols failed:', e.message)
    return []
  }
}

// ── Fetch OHLCV candles from Delta India ──────────────────────────────────────
// Delta endpoint: GET /v2/history/candles?symbol=BTCUSDT&resolution=15&start=...&end=...
// resolution is in minutes for Delta (15 = 15m, 60 = 1h, 240 = 4h, D = 1d)
const DELTA_RES_MAP = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '4h': '240', '1d': 'D',
}

export async function fetchDeltaCandles(symbol, interval = '15m', limit = 60) {
  const resolution = DELTA_RES_MAP[interval] || '15'
  const resMs = intervalToMs(interval)
  const now   = Math.floor(Date.now() / 1000)
  const start = now - Math.ceil(resMs / 1000) * (limit + 5)

  try {
    const url = `${DELTA_BASE}/v2/history/candles?symbol=${symbol}&resolution=${resolution}&start=${start}&end=${now}`
    const res = await fetch(url, { signal: AbortSignal.timeout(DELTA_TIMEOUT) })
    if (!res.ok) throw new Error(`Delta candles ${res.status}`)
    const data = await res.json()
    const raw = data.result || []
    if (raw.length < 3) throw new Error('Too few candles')

    const candles = raw
      .map(c => ({
        time:   c.time * 1000,
        open:   parseFloat(c.open),
        high:   parseFloat(c.high),
        low:    parseFloat(c.low),
        close:  parseFloat(c.close),
        volume: parseFloat(c.volume),
      }))
      .sort((a, b) => a.time - b.time)
      .slice(-limit)

    // Attach same indicators as Binance scanner so patterns are compatible
    attachEMAn(candles,   5, 'ema5')
    attachEMAn(candles,   9, 'ema9')
    attachEMAn(candles,  15, 'ema15')
    attachEMAn(candles,  16, 'ema16')
    attachEMAn(candles,  20, 'ema20')
    attachEMAn(candles,  25, 'ema25')
    attachEMAn(candles,  30, 'ema30')
    attachEMAn(candles,  40, 'ema40')
    attachEMAn(candles,  50, 'ema50')
    attachEMAn(candles,  60, 'ema60')
    attachEMAn(candles,  75, 'ema75')
    attachEMAn(candles,  80, 'ema80')
    attachEMAn(candles, 100, 'ema100')
    attachEMAn(candles, 120, 'ema120')
    attachEMAn(candles, 150, 'ema150')
    attachEMAn(candles, 200, 'ema200')
    attachEMAn(candles, 300, 'ema300')
    attachEMAn(candles, 600, 'ema600')
    attachRSI(candles, 14)
    attachDMI(candles, 14)

    return candles
  } catch (e) {
    console.warn(`[Delta] fetchDeltaCandles ${symbol} failed:`, e.message)
    return null
  }
}

// ─── Indicator functions (same as Binance scanner) ───────────────────────────
function attachEMAn(candles, period, key) {
  const k = 2 / (period + 1)
  let ema = null
  for (const c of candles) {
    ema = ema === null ? c.close : c.close * k + ema * (1 - k)
    c[key] = ema
  }
}

function attachRSI(candles, period = 14) {
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period && i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close
    if (diff > 0) avgGain += diff / period
    else avgLoss += Math.abs(diff) / period
  }
  for (let i = period; i < candles.length; i++) {
    if (i > period) {
      const diff = candles[i].close - candles[i - 1].close
      const gain = diff > 0 ? diff : 0
      const loss = diff < 0 ? -diff : 0
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    candles[i].rsi14 = 100 - 100 / (1 + rs)
  }
}

function attachDMI(candles, period = 14) {
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i], prev = candles[i - 1]
    const upMove   = curr.high - prev.high
    const downMove = prev.low  - curr.low
    curr._pdm = upMove > downMove && upMove > 0 ? upMove : 0
    curr._ndm = downMove > upMove && downMove > 0 ? downMove : 0
    const hl = curr.high - curr.low
    const hc = Math.abs(curr.high - prev.close)
    const lc = Math.abs(curr.low  - prev.close)
    curr._tr = Math.max(hl, hc, lc)
  }
  let atr = 0, pdi = 0, ndi = 0, dx = 0
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    atr = i < period ? atr + c._tr : (atr * (period - 1) + c._tr) / period
    pdi = i < period ? pdi + c._pdm : (pdi * (period - 1) + c._pdm) / period
    ndi = i < period ? ndi + c._ndm : (ndi * (period - 1) + c._ndm) / period
    if (atr > 0) {
      const p = pdi / atr * 100, n = ndi / atr * 100
      const sum = p + n
      c.dmi_plus = p; c.dmi_minus = n
      c.adx = sum > 0 ? Math.abs(p - n) / sum * 100 : 0
    }
  }
}

function intervalToMs(tf) {
  const map = { '1m':60000,'3m':180000,'5m':300000,'15m':900000,
    '30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000 }
  return map[tf] || 900000
}
