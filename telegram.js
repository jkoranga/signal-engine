// telegram.js — Send signal alerts via Telegram Bot API

/**
 * Send a signal alert to Telegram
 * @param {string} botToken
 * @param {string} chatId
 * @param {Object} signal - from analyseSymbol()
 */
async function sendSignalAlert(botToken, chatId, signal) {
  const dir = signal.direction === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
  const scoreBar = buildScoreBar(signal.score);
  const wick = signal.wickReject ? '✅' : '—';
  const div  = signal.divergence  ? '✅' : '—';

  const msg = [
    `${dir} SIGNAL`,
    ``,
    `<b>${signal.symbol}</b> · 15m · Binance`,
    ``,
    `Score:   <b>${signal.score}/10</b>  ${scoreBar}`,
    `Price:   <code>${signal.price}</code>`,
    `EMA20:   <code>${signal.ema20}</code>  (${signal.emaDistPct}% away)`,
    `RSI 5m:  <b>${signal.rsi}</b>`,
    `Vol×:    <b>${signal.volRatio}×</b> avg`,
    ``,
    `Wick reject:  ${wick}`,
    `RSI diverge:  ${div}`,
    ``,
    `<i>${signal.time}</i>`,
  ].join('\n');

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram send failed: ${err}`);
  }

  return await res.json();
}

/**
 * Send a plain text message (startup, errors, status)
 */
async function sendText(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

function buildScoreBar(score, max = 10) {
  const filled = Math.round(score);
  return '█'.repeat(filled) + '░'.repeat(max - filled);
}

module.exports = { sendSignalAlert, sendText };
