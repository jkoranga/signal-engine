// ─── Binance API ──────────────────────────────────────────────────────────────
const BASES = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
]

export async function fetchCandles(symbol, interval = '15m', limit = 60) {
  const path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  for (const base of BASES) {
    try {
      const res = await fetch(base + path, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = await res.json()
      const candles = data.map(([t, o, h, l, c, v]) => ({
        time: t,
        open: parseFloat(o),
        high: parseFloat(h),
        low: parseFloat(l),
        close: parseFloat(c),
        volume: parseFloat(v),
      }))
      // Attach EMA10 and RSI14 to each candle
      attachEMA(candles, 10)
      attachEMAn(candles, 9,  'ema9')
      attachEMAn(candles, 20, 'ema20')
      attachEMAn(candles, 40, 'ema40')
      attachEMAn(candles, 50, 'ema50')
      attachEMAn(candles, 80, 'ema80')
      attachRSI(candles, 14)
      return candles
    } catch { /* try next mirror */ }
  }
  throw new Error(`Failed to fetch ${symbol}`)
}

// ─── RSI computation ──────────────────────────────────────────────────────────
// Computes RSI(14) and attaches .rsi to each candle in-place
export function attachRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close
    if (diff >= 0) gains += diff; else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  for (let i = 0; i < candles.length; i++) {
    if (i < period) { candles[i].rsi = null; continue }
    if (i === period) {
      candles[i].rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    } else {
      const diff = candles[i].close - candles[i - 1].close
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period
      candles[i].rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    }
  }
}

// ─── EMA computation ──────────────────────────────────────────────────────────
// Computes EMA(period) using close prices and attaches .ema10 to each candle in-place
export function attachEMA(candles, period = 10) {
  if (!candles || candles.length < period) return
  const k = 2 / (period + 1)
  let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      candles[i].ema10 = null
    } else if (i === period - 1) {
      ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period
      candles[i].ema10 = ema
    } else {
      ema = candles[i].close * k + ema * (1 - k)
      candles[i].ema10 = ema
    }
  }
}

// Generic EMA attacher — attaches .ema{N} to each candle
export function attachEMAn(candles, period, key) {
  if (!candles || candles.length < period) return
  const k = 2 / (period + 1)
  let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      candles[i][key] = null
    } else if (i === period - 1) {
      ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period
      candles[i][key] = ema
    } else {
      ema = candles[i].close * k + ema * (1 - k)
      candles[i][key] = ema
    }
  }
}

// ─── Fetch ALL tradable USDT pairs from Binance exchange info ─────────────────
export async function fetchAllUSDTSymbols() {
  for (const base of BASES) {
    try {
      const res = await fetch(`${base}/api/v3/exchangeInfo`, { signal: AbortSignal.timeout(12000) })
      if (!res.ok) continue
      const data = await res.json()
      return data.symbols
        .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT' && !s.symbol.includes('DOWN') && !s.symbol.includes('UP') && !s.symbol.includes('BULL') && !s.symbol.includes('BEAR'))
        .map(s => s.symbol)
        .sort()
    } catch { /* next mirror */ }
  }
  return TOP_SYMBOLS // fallback
}

// Fetch 24h ticker for all pairs (volume/price data)
export async function fetch24hTickers() {
  for (const base of BASES) {
    try {
      const res = await fetch(`${base}/api/v3/ticker/24hr`, { signal: AbortSignal.timeout(12000) })
      if (!res.ok) continue
      const data = await res.json()
      return data.filter(t => t.symbol.endsWith('USDT'))
        .reduce((acc, t) => {
          acc[t.symbol] = {
            priceChangePercent: parseFloat(t.priceChangePercent),
            volume: parseFloat(t.quoteVolume),
            lastPrice: parseFloat(t.lastPrice),
          }
          return acc
        }, {})
    } catch { /* next mirror */ }
  }
  return {}
}

// ─── Top 30 fallback symbols ─────────────────────────────────────────────────
export const TOP_SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
  'ADAUSDT','DOGEUSDT','AVAXUSDT','MATICUSDT','DOTUSDT',
  'LINKUSDT','UNIUSDT','LTCUSDT','ATOMUSDT','NEARUSDT',
  'APTUSDT','ARBUSDT','OPUSDT','INJUSDT','SUIUSDT',
  'SHIBUSDT','TRXUSDT','TONUSDT','FETUSDT','RNDRUSDT',
  'WIFUSDT','PEPEUSDT','FLOKIUSDT','TIAUSDT','JUPUSDT',
]

// ─── Sound ────────────────────────────────────────────────────────────────────
export function playBeep(isBear = false) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(isBear ? 440 : 880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(isBear ? 220 : 440, ctx.currentTime + 0.3)
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(); osc.stop(ctx.currentTime + 0.45)
  } catch { /* audio blocked */ }
}

// ─── Telegram ─────────────────────────────────────────────────────────────────
export async function sendTelegram(botToken, chatId, text) {
  if (!botToken || !chatId) return
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export function buildTelegramMsg(alert) {
  const isBull = alert.side === 'bull'
  const dir = isBull ? '🟢 BULL' : '🔴 BEAR'
  return `${dir} <b>${alert.symbol}</b> — ${alert.scannerName}\n📊 TF: ${alert.timeframe} | ${isBull ? '+' : '-'}${alert.details.gainPct}% | ${alert.details.candleCount} candles\n⏱ ${new Date(alert.time).toUTCString()}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function intervalToMs(i) {
  return {
    '1m': 60000,'3m': 180000,'5m': 300000,'15m': 900000,
    '30m': 1800000,'1h': 3600000,'4h': 14400000,'1d': 86400000,
  }[i] || 300000
}

export function fmt(n) {
  if (typeof n !== 'number' || isNaN(n)) return '—'
  if (n > 10000) return n.toFixed(0)
  if (n > 100) return n.toFixed(2)
  if (n > 1) return n.toFixed(4)
  return n.toFixed(6)
}

export function timeSince(ts) {
  const d = (Date.now() - ts) / 1000
  if (d < 60) return `${Math.floor(d)}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  return `${Math.floor(d / 3600)}h ago`
}

export function fmtVol(v) {
  if (v >= 1e9) return (v/1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v/1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v/1e3).toFixed(1) + 'K'
  return v.toFixed(0)
}
