# 🕯️ Candle Formation Alert v2.0

Real-time Binance candle pattern scanner with 12 patterns across all USDT trading pairs.

## Features
- **12 candle patterns**: Green/Red >4, Bullish/Bearish Engulfing, Hammer, Shooting Star, Morning/Evening Star, Three White Soldiers, Three Black Crows, Tweezer Bottom/Top
- **Live Binance data**: Fetches real OHLCV candles from `api.binance.com` (multiple fallback mirrors)
- **Maximum pairs**: Scans Top 30 / Top 100 / Top 200 / ALL USDT pairs (~300+ symbols) sorted by 24h volume
- **Parallel scanning**: 6 concurrent fetch workers for fast bulk scans
- **Per-pattern enable/disable**: Toggle individual patterns on/off
- **Single symbol scan**: Quick scan for one specific pair
- **Sort & filter**: By time, symbol, pattern, gain%, volume
- **Cards + list view**: Toggle between full card view and compact list
- **Telegram alerts**: Sends alerts to any Telegram bot
- **Sound alerts**: Different tones for bull vs bear signals
- **Settings persist**: LocalStorage-backed settings
- **Mobile responsive**: Collapsible sidebar on mobile

## Quick Start
```bash
npm install
npm run dev
```

## Symbol Sets
| Set | Symbols |
|-----|---------|
| Top 30 | 30 highest-volume USDT pairs |
| Top 100 | 100 highest-volume USDT pairs |
| Top 200 | 200 highest-volume USDT pairs |
| All | All ~300+ active USDT pairs |
| Custom | Only your added pairs |

## Patterns
### Bull
- 🟢 Green Candle >4
- 📈 Bullish Engulfing
- 🔨 Hammer / Pin Bar
- ⭐ Morning Star
- 🕯️ Three White Soldiers
- 📌 Tweezer Bottom

### Bear
- 🔴 Red Candle >4
- 📉 Bearish Engulfing
- 💫 Shooting Star
- 🌙 Evening Star
- 🕯 Three Black Crows
- 📍 Tweezer Top

## Deploy
```bash
npm run build
# Deploy dist/ to Vercel, Netlify, etc.
```
