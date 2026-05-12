// scanner.js — Main orchestrator
// Usage: node scanner.js
// Or:    BOT_TOKEN=xxx CHAT_ID=yyy node scanner.js

const { fetchKlines, fetchMultiKlines } = require('./binance');
const { analyseSymbol } = require('./signal');
const { sendSignalAlert, sendText } = require('./telegram');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  // Telegram credentials — set via env vars or fill directly
  BOT_TOKEN: process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN',
  CHAT_ID:   process.env.CHAT_ID   || 'YOUR_CHAT_ID',

  // Watchlist — add/remove any Binance USDT pairs
  WATCHLIST: [
    'LUNCUSDT',
    'PIXELUSDT',
    'SOLUSDT',
    'BTCUSDT',
    'ETHUSDT',
    'BNBUSDT',
    'DOGEUSDT',
    'SHIBUSDT',
    'XRPUSDT',
    'ADAUSDT',
    'DOTUSDT',
    'MATICUSDT',
    'AVAXUSDT',
    'LINKUSDT',
    'LTCUSDT',
  ],

  // Scan interval — 15 minutes in ms
  // Set to 60000 (1 min) for testing
  SCAN_INTERVAL_MS: 15 * 60 * 1000,

  // How many candles to fetch per symbol
  KLINE_LIMIT: 120,

  // Stagger between API calls (ms) — safe for Binance free tier
  API_DELAY_MS: 250,

  // Log signals to console even without Telegram
  LOG_SIGNALS: true,
};
// ────────────────────────────────────────────────────────────────────────────

let scanCount = 0;

async function runScan() {
  scanCount++;
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] ── Scan #${scanCount} · ${CONFIG.WATCHLIST.length} symbols ──`);

  // Fetch 15m klines for all symbols
  const data15m = await fetchMultiKlines(CONFIG.WATCHLIST, '15m', CONFIG.KLINE_LIMIT, CONFIG.API_DELAY_MS);

  // Fetch 5m klines for RSI lock (slightly fewer needed)
  const data5m  = await fetchMultiKlines(CONFIG.WATCHLIST, '5m',  80, CONFIG.API_DELAY_MS);

  const signals = [];

  for (const symbol of CONFIG.WATCHLIST) {
    try {
      const signal = analyseSymbol(symbol, data15m[symbol], data5m[symbol]);
      if (signal) {
        signals.push(signal);
        if (CONFIG.LOG_SIGNALS) logSignal(signal);
        await sendSignalAlert(CONFIG.BOT_TOKEN, CONFIG.CHAT_ID, signal);
        console.log(`[FIRED] ${signal.direction} ${symbol} score=${signal.score}/10`);
      } else {
        console.log(`[skip]  ${symbol}`);
      }
    } catch (e) {
      console.error(`[error] ${symbol}: ${e.message}`);
    }
  }

  if (signals.length === 0) {
    console.log('[scan] No signals this round.');
  } else {
    console.log(`[scan] ${signals.length} signal(s) fired.`);
  }
}

function logSignal(s) {
  console.log(`\n╔══ ${s.direction} ${s.symbol} ══╗`);
  console.log(`  Score:  ${s.score}/10`);
  console.log(`  Price:  ${s.price}`);
  console.log(`  EMA20:  ${s.ema20} (${s.emaDistPct}% away)`);
  console.log(`  RSI5m:  ${s.rsi}`);
  console.log(`  Vol×:   ${s.volRatio}x`);
  console.log(`  Wick:   ${s.wickReject ? 'YES' : 'no'}`);
  console.log(`  Diverg: ${s.divergence ? 'YES' : 'no'}`);
  console.log(`╚${'═'.repeat(20 + s.symbol.length)}╝`);
}

async function start() {
  console.log('═══════════════════════════════════════');
  console.log('  EMA Bounce Signal Engine — v1.0');
  console.log('═══════════════════════════════════════');
  console.log(`  Watching: ${CONFIG.WATCHLIST.length} pairs`);
  console.log(`  Interval: ${CONFIG.SCAN_INTERVAL_MS / 60000}m`);
  console.log(`  Min score: 6/10`);
  console.log('═══════════════════════════════════════\n');

  await sendText(CONFIG.BOT_TOKEN, CONFIG.CHAT_ID,
    `🚀 <b>EMA Signal Engine started</b>\nWatching ${CONFIG.WATCHLIST.length} pairs · 15m TF\nMin score: 6/10`
  ).catch(() => console.warn('[warn] Telegram startup message failed — check credentials'));

  // Run immediately on start
  await runScan();

  // Then run on 15m schedule
  setInterval(runScan, CONFIG.SCAN_INTERVAL_MS);
}

start().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
