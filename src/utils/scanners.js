// ─── ACF — Advance Candle Formation Alert ─────────────────────────────────────
// Standard patterns
// Advanced patterns: EMA10 Breaker Bull/Bear, Reversal After Bull/Bear

export const SCANNERS = []

// ── ADVANCED PATTERNS ─────────────────────────────────────────────────────────
// Candle index layout:
//   [ -7 ][ -6 ][ -5 ][ -4 ][ -3 ] [ -2 ][ -1 ][ curr ]
//    ←──────── prev5 (max close) ──────────→  prev  prev  current

export const ADVANCED_SCANNERS = [
  {
    id: 'ema_base_rev_bull_v2', side: 'bull', icon: '💹',
    name: 'Buy Near EMA9',
    sub: 'Triple slope + EMA stack + body ≥20% + tight wick tag + RSI>50',
    badge: 'BULL', badgeCls: 'badge-green',
    group: 'advanced',
    tfs: ['15m', '1h'],
    conditions: [
      'EMA20[-2] > EMA20[-12] × 1.0035  (long slope ≥ 0.35%)',
      'EMA20[-2] > EMA20[-5] × 1.0015   (near slope ≥ 0.15%)',
      'EMA20[-6] > EMA20[-8] × 1.0015   (mid slope ≥ 0.15%)',
      'Candles -2 and -3 red (open > close)',
      'Reversal candle green with body ≥ 20% of its range',
      'Reversal low < low of candle -3 AND -4',
      'Low ≤ EMA9 × 1.001  OR  ≤ EMA20 × 1.001  (tight wick tag)',
      'RSI(14) current > 50',
      'EMA20 > EMA40 × 1.005 on last 3 candles each',
      'EMA9 > EMA20 × 1.002 on last 3 candles each  (0.2% separation)',
    ],
    logic(candles) {
      if (!candles || candles.length < 15) return null
      const len  = candles.length
      const curr = candles[len - 1]   // 0
      const c1   = candles[len - 2]   // -1
      const c2   = candles[len - 3]   // -2
      const c3   = candles[len - 4]   // -3
      const c4   = candles[len - 5]   // -4
      const c5   = candles[len - 6]   // -5
      const c6   = candles[len - 7]   // -6
      const c8   = candles[len - 9]   // -8
      const c12  = candles[len - 13]  // -12

      // All EMAs required
      if (c2.ema20 == null || c12.ema20 == null) return null
      if (c5.ema20 == null || c6.ema20 == null || c8.ema20 == null) return null
      if (curr.ema9 == null || curr.ema20 == null || curr.ema40 == null) return null
      if (c1.ema9 == null || c1.ema20 == null || c1.ema40 == null) return null
      if (c2.ema9 == null || c2.ema40 == null) return null

      // ① Triple EMA20 slope checks
      if (c2.ema20 <= c12.ema20 * 1.0035) return null   // long slope
      if (c2.ema20 <= c5.ema20  * 1.0015) return null   // near slope
      if (c6.ema20 <= c8.ema20  * 1.0015) return null   // mid slope

      // ② Candles -2 and -3 red
      if (!(c2.open > c2.close)) return null
      if (!(c3.open > c3.close)) return null

      // ③ Current OR -1 candle is green WITH body ≥ 20% of range
      const currGreen = curr.close > curr.open
      const c1Green   = c1.close > c1.open
      if (!currGreen && !c1Green) return null

      const rc      = currGreen ? curr : c1
      const rcRange = rc.high - rc.low
      const rcBody  = rc.close - rc.open
      // body must be ≥ 20% of full candle range (avoid doji)
      if (rcRange <= 0 || rcBody / rcRange < 0.20) return null

      const revLow  = rc.low
      const revEma9 = rc.ema9
      const revEma20= rc.ema20

      // ④ Reversal low < both -3 and -4 lows
      if (revLow >= c3.low || revLow >= c4.low) return null

      // ⑤ Tight wick tag: EMA9 × 1.001 OR EMA20 × 1.001
      const tagEma9  = revLow <= revEma9  * 1.001
      const tagEma20 = revLow <= revEma20 * 1.001
      if (!tagEma9 && !tagEma20) return null

      // ⑥ RSI > 50
      if (curr.rsi == null || curr.rsi <= 50) return null

      // ⑦ EMA alignment — last 3 candles: EMA20 > EMA40 × 1.005
      const align3 = [curr, c1, c2]
      for (const c of align3) {
        if (c.ema20 == null || c.ema40 == null) return null
        if (c.ema20 <= c.ema40 * 1.005) return null
      }
      // ⑦ EMA alignment — last 3 candles: EMA9 > EMA20 × 1.002 (0.2% separation)
      for (const c of align3) {
        if (c.ema9 == null || c.ema20 == null) return null
        if (c.ema9 <= c.ema20 * 1.002) return null
      }

      const gain    = ((curr.close - revLow) / revLow * 100).toFixed(2)
      const run     = candles.slice(len - 9, len)
      const tagStr  = tagEma9 ? 'EMA9' : 'EMA20'
      const nearPct = ((c2.ema20/c5.ema20 - 1)*100).toFixed(2)
      const midPct  = ((c6.ema20/c8.ema20 - 1)*100).toFixed(2)
      const bodyPct = (rcBody / rcRange * 100).toFixed(0)
      return {
        candleCount: 9,
        gainPct: gain,
        highestClose: curr.close,
        lowestOpen: revLow,
        conds: [
          `✓ Long slope +${((c2.ema20/c12.ema20-1)*100).toFixed(2)}% (≥0.35%)`,
          `✓ Near slope +${nearPct}% (≥0.15%)`,
          `✓ Mid slope +${midPct}% (≥0.15%)`,
          `✓ 2 red candles (-2/-3)`,
          `✓ Reversal green body ${bodyPct}% of range (≥20%)`,
          `✓ Low < c3/c4 (${revLow.toFixed(4)})`,
          `✓ Tight wick tagged ${tagStr} (×1.001)`,
          `✓ RSI ${curr.rsi.toFixed(1)} > 50`,
          `✓ EMA20>EMA40×1.005 aligned`,
          `✓ EMA9>EMA20×1.002 (0.2% sep)`,
        ],
        run,
        ema9:  curr.ema9,
        ema20: curr.ema20,
        ema40: curr.ema40,
        rsi:   curr.rsi,
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EMA Base Reversal Bear v2  —  mirror
  // ① EMA20 slope falling (3 checks) ② 2 green candles ③ red reversal w/ body ≥20%
  // ④ high exceeds -3/-4 ⑤ tight wick tag ×0.999 ⑥ RSI<50
  // ⑦ EMA alignment: EMA20<EMA40×0.995 AND EMA9<EMA20×0.998 (last 3 candles)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ema_base_rev_bear_v2', side: 'bear', icon: '📉',
    name: 'Sell Near EMA9',
    sub: 'Triple slope falling + EMA stack + body ≥20% + tight wick tag + RSI<50',
    badge: 'BEAR', badgeCls: 'badge-red',
    group: 'advanced',
    tfs: ['15m', '1h'],
    conditions: [
      'EMA20[-2] < EMA20[-12] × 0.9965  (long slope ≤ -0.35%)',
      'EMA20[-2] < EMA20[-5] × 0.9985   (near slope ≤ -0.15%)',
      'EMA20[-6] < EMA20[-8] × 0.9985   (mid slope ≤ -0.15%)',
      'Candles -2 and -3 green (close > open)',
      'Reversal candle red with body ≥ 20% of its range',
      'Reversal high > high of candle -3 AND -4',
      'High ≥ EMA9 × 0.999  OR  ≥ EMA20 × 0.999  (tight wick tag)',
      'RSI(14) current < 50',
      'EMA20 < EMA40 × 0.995 on last 3 candles each',
      'EMA9 < EMA20 × 0.998 on last 3 candles each  (0.2% separation)',
    ],
    logic(candles) {
      if (!candles || candles.length < 15) return null
      const len  = candles.length
      const curr = candles[len - 1]
      const c1   = candles[len - 2]
      const c2   = candles[len - 3]
      const c3   = candles[len - 4]
      const c4   = candles[len - 5]
      const c5   = candles[len - 6]
      const c6   = candles[len - 7]
      const c8   = candles[len - 9]
      const c12  = candles[len - 13]

      if (c2.ema20 == null || c12.ema20 == null) return null
      if (c5.ema20 == null || c6.ema20 == null || c8.ema20 == null) return null
      if (curr.ema9 == null || curr.ema20 == null || curr.ema40 == null) return null
      if (c1.ema9  == null || c1.ema20  == null || c1.ema40  == null) return null
      if (c2.ema9  == null || c2.ema40  == null) return null

      // ① Triple EMA20 slope (falling)
      if (c2.ema20 >= c12.ema20 * 0.9965) return null   // long slope
      if (c2.ema20 >= c5.ema20  * 0.9985) return null   // near slope
      if (c6.ema20 >= c8.ema20  * 0.9985) return null   // mid slope

      // ② Candles -2 and -3 green
      if (!(c2.close > c2.open)) return null
      if (!(c3.close > c3.open)) return null

      // ③ Current OR -1 candle is red WITH body ≥ 20% of range
      const currRed = curr.open > curr.close
      const c1Red   = c1.open > c1.close
      if (!currRed && !c1Red) return null

      const rc       = currRed ? curr : c1
      const rcRange  = rc.high - rc.low
      const rcBody   = rc.open - rc.close
      // body must be ≥ 20% of full candle range (avoid doji)
      if (rcRange <= 0 || rcBody / rcRange < 0.20) return null

      const revHigh  = rc.high
      const revEma9  = rc.ema9
      const revEma20 = rc.ema20

      // ④ Reversal high > both -3 and -4 highs
      if (revHigh <= c3.high || revHigh <= c4.high) return null

      // ⑤ Tight wick tag: EMA9 × 0.999 OR EMA20 × 0.999
      const tagEma9  = revHigh >= revEma9  * 0.999
      const tagEma20 = revHigh >= revEma20 * 0.999
      if (!tagEma9 && !tagEma20) return null

      // ⑥ RSI < 50
      if (curr.rsi == null || curr.rsi >= 50) return null

      // ⑦ EMA alignment — last 3 candles: EMA20 < EMA40 × 0.995
      const align3 = [curr, c1, c2]
      for (const c of align3) {
        if (c.ema20 == null || c.ema40 == null) return null
        if (c.ema20 >= c.ema40 * 0.995) return null
      }
      // ⑦ EMA alignment — last 3 candles: EMA9 < EMA20 × 0.998 (0.2% separation)
      for (const c of align3) {
        if (c.ema9 == null || c.ema20 == null) return null
        if (c.ema9 >= c.ema20 * 0.998) return null
      }

      const drop    = ((revHigh - curr.close) / revHigh * 100).toFixed(2)
      const run     = candles.slice(len - 9, len)
      const tagStr  = tagEma9 ? 'EMA9' : 'EMA20'
      const nearPct = ((c2.ema20/c5.ema20 - 1)*100).toFixed(2)
      const midPct  = ((c6.ema20/c8.ema20 - 1)*100).toFixed(2)
      const bodyPct = (rcBody / rcRange * 100).toFixed(0)
      return {
        candleCount: 9,
        gainPct: drop,
        highestClose: revHigh,
        lowestOpen: curr.close,
        conds: [
          `✓ Long slope ${((c2.ema20/c12.ema20-1)*100).toFixed(2)}% (≤-0.35%)`,
          `✓ Near slope ${nearPct}% (≤-0.15%)`,
          `✓ Mid slope ${midPct}% (≤-0.15%)`,
          `✓ 2 green candles (-2/-3)`,
          `✓ Reversal red body ${bodyPct}% of range (≥20%)`,
          `✓ High > c3/c4 (${revHigh.toFixed(4)})`,
          `✓ Tight wick tagged ${tagStr} (×0.999)`,
          `✓ RSI ${curr.rsi.toFixed(1)} < 50`,
          `✓ EMA20<EMA40×0.995 aligned`,
          `✓ EMA9<EMA20×0.998 (0.2% sep)`,
        ],
        run,
        ema9:  curr.ema9,
        ema20: curr.ema20,
        ema40: curr.ema40,
        rsi:   curr.rsi,
        isBear: true,
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EMA20 Reversal Bull
  // Strong uptrend → dip below EMA20 on -1 or -2 → recross above EMA20
  // ① EMA20 > EMA40 × 1.0075  (current, strong uptrend)
  // ② EMA20[-10] > EMA50[-10] × 1.0075  (trend was established)
  // ③ Candle -1 OR -2 closed below its own EMA20  (pullback dip)
  // ④ Current close ≥ EMA20  (recross / recovery)
  // ⑤ |close - open| / close < 1%  (tight body — conviction candle)
  // ⑥ EMA40 > avg(EMA40 last 10 candles) × 1.005  (EMA40 rising slope)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ema20_reversal_bull', side: 'bull', icon: '📈',
    name: 'Buy Near EMA20-40',
    sub: 'EMA20 uptrend dip → recross above EMA20 with tight body',
    badge: 'BULL', badgeCls: 'badge-green',
    group: 'advanced',
    tfs: ['15m', '1h'],
    conditions: [
      'EMA20 > EMA40 × 1.0075  (strong uptrend)',
      'EMA20[-10] > EMA50[-10] × 1.0075  (established trend)',
      'Candle -1 or -2 closed below its own EMA20  (pullback)',
      'Current close ≥ EMA20  (recross / bounce)',
      '|close − open| / close < 1%  (tight body)',
      'EMA40 > avg(EMA40 last 10 candles) × 1.005  (EMA40 rising)',
    ],
    logic(candles) {
      if (!candles || candles.length < 15) return null
      const len  = candles.length
      const curr = candles[len - 1]
      const c1   = candles[len - 2]
      const c2   = candles[len - 3]
      const c10  = candles[len - 11]  // index -10

      // All required EMAs must exist
      if (curr.ema20 == null || curr.ema40 == null) return null
      if (c1.ema20  == null) return null
      if (c2.ema20  == null) return null
      if (c10.ema20 == null || c10.ema50 == null) return null

      // ① Current EMA20 > EMA40 × 1.0075
      if (curr.ema20 <= curr.ema40 * 1.0075) return null

      // ② EMA20[-10] > EMA50[-10] × 1.0075
      if (c10.ema20 <= c10.ema50 * 1.0075) return null

      // ③ Candle -1 OR -2 closed below its own EMA20 (pullback dip)
      const c1DippedBelow = c1.close < c1.ema20
      const c2DippedBelow = c2.close < c2.ema20
      if (!c1DippedBelow && !c2DippedBelow) return null

      // ④ Current close ≥ EMA20 (recovered / recrossed)
      if (curr.close < curr.ema20) return null

      // ⑤ Tight body: |close - open| / close < 1%
      const bodyPct = Math.abs(curr.close - curr.open) / curr.close
      if (bodyPct >= 0.01) return null

      // ⑥ EMA40 rising: curr.ema40 > avg(last 10 EMA40 values) × 1.005
      const last10 = candles.slice(len - 11, len - 1)
      const validEma40 = last10.filter(c => c.ema40 != null)
      if (validEma40.length < 8) return null
      const avgEma40 = validEma40.reduce((s, c) => s + c.ema40, 0) / validEma40.length
      if (curr.ema40 <= avgEma40 * 1.005) return null

      const dippedCandle = c1DippedBelow ? c1 : c2
      const dippedLabel  = c1DippedBelow ? '-1' : '-2'
      const gain = ((curr.close - dippedCandle.low) / dippedCandle.low * 100).toFixed(2)
      const run  = candles.slice(len - 8, len)

      return {
        candleCount: 8,
        gainPct: gain,
        highestClose: curr.close,
        lowestOpen: dippedCandle.low,
        conds: [
          `✓ EMA20 ${curr.ema20.toFixed(4)} > EMA40×1.0075 (${(curr.ema40*1.0075).toFixed(4)})`,
          `✓ EMA20[-10] ${c10.ema20.toFixed(4)} > EMA50[-10]×1.0075`,
          `✓ Candle ${dippedLabel} dipped below EMA20 (close ${dippedCandle.close.toFixed(4)})`,
          `✓ Current close ${curr.close.toFixed(4)} ≥ EMA20 ${curr.ema20.toFixed(4)}`,
          `✓ Body ${(bodyPct*100).toFixed(2)}% < 1%`,
          `✓ EMA40 ${curr.ema40.toFixed(4)} > avg×1.005 (${(avgEma40*1.005).toFixed(4)})`,
        ],
        run,
        ema20: curr.ema20,
        ema40: curr.ema40,
        rsi:   curr.rsi,
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EMA20 Reversal Bear  (mirror)
  // Strong downtrend → spike above EMA20 on -1 or -2 → recross below EMA20
  // ① EMA20 < EMA40 × 0.9925
  // ② EMA20[-10] < EMA50[-10] × 0.9925
  // ③ Candle -1 OR -2 closed above its own EMA20
  // ④ Current close ≤ EMA20
  // ⑤ |close - open| / close < 1%
  // ⑥ EMA40 < avg(EMA40 last 10 candles) × 0.995
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ema20_reversal_bear', side: 'bear', icon: '📉',
    name: 'Sell Near EMA20-40',
    sub: 'EMA20 downtrend spike → recross below EMA20 with tight body',
    badge: 'BEAR', badgeCls: 'badge-red',
    group: 'advanced',
    tfs: ['15m', '1h'],
    conditions: [
      'EMA20 < EMA40 × 0.9925  (strong downtrend)',
      'EMA20[-10] < EMA50[-10] × 0.9925  (established downtrend)',
      'Candle -1 or -2 closed above its own EMA20  (spike)',
      'Current close ≤ EMA20  (recross / rejection)',
      '|close − open| / close < 1%  (tight body)',
      'EMA40 < avg(EMA40 last 10 candles) × 0.995  (EMA40 falling)',
    ],
    logic(candles) {
      if (!candles || candles.length < 15) return null
      const len  = candles.length
      const curr = candles[len - 1]
      const c1   = candles[len - 2]
      const c2   = candles[len - 3]
      const c10  = candles[len - 11]

      if (curr.ema20 == null || curr.ema40 == null) return null
      if (c1.ema20  == null) return null
      if (c2.ema20  == null) return null
      if (c10.ema20 == null || c10.ema50 == null) return null

      // ① EMA20 < EMA40 × 0.9925
      if (curr.ema20 >= curr.ema40 * 0.9925) return null

      // ② EMA20[-10] < EMA50[-10] × 0.9925
      if (c10.ema20 >= c10.ema50 * 0.9925) return null

      // ③ Candle -1 OR -2 closed above its own EMA20 (spike up)
      const c1SpikedAbove = c1.close > c1.ema20
      const c2SpikedAbove = c2.close > c2.ema20
      if (!c1SpikedAbove && !c2SpikedAbove) return null

      // ④ Current close ≤ EMA20 (rejected back below)
      if (curr.close > curr.ema20) return null

      // ⑤ Tight body: |close - open| / close < 1%
      const bodyPct = Math.abs(curr.close - curr.open) / curr.close
      if (bodyPct >= 0.01) return null

      // ⑥ EMA40 falling: curr.ema40 < avg(last 10 EMA40 values) × 0.995
      const last10 = candles.slice(len - 11, len - 1)
      const validEma40 = last10.filter(c => c.ema40 != null)
      if (validEma40.length < 8) return null
      const avgEma40 = validEma40.reduce((s, c) => s + c.ema40, 0) / validEma40.length
      if (curr.ema40 >= avgEma40 * 0.995) return null

      const spikedCandle = c1SpikedAbove ? c1 : c2
      const spikedLabel  = c1SpikedAbove ? '-1' : '-2'
      const drop = ((spikedCandle.high - curr.close) / spikedCandle.high * 100).toFixed(2)
      const run  = candles.slice(len - 8, len)

      return {
        candleCount: 8,
        gainPct: drop,
        highestClose: spikedCandle.high,
        lowestOpen: curr.close,
        conds: [
          `✓ EMA20 ${curr.ema20.toFixed(4)} < EMA40×0.9925 (${(curr.ema40*0.9925).toFixed(4)})`,
          `✓ EMA20[-10] ${c10.ema20.toFixed(4)} < EMA50[-10]×0.9925`,
          `✓ Candle ${spikedLabel} spiked above EMA20 (close ${spikedCandle.close.toFixed(4)})`,
          `✓ Current close ${curr.close.toFixed(4)} ≤ EMA20 ${curr.ema20.toFixed(4)}`,
          `✓ Body ${(bodyPct*100).toFixed(2)}% < 1%`,
          `✓ EMA40 ${curr.ema40.toFixed(4)} < avg×0.995 (${(avgEma40*0.995).toFixed(4)})`,
        ],
        run,
        ema20: curr.ema20,
        ema40: curr.ema40,
        rsi:   curr.rsi,
        isBear: true,
      }
    },
  },




  // ─────────────────────────────────────────────────────────────────────────
  // EMA Slope Reversal Bull
  //
  // ① EMA20 ptc > 0.001 for 5 consecutive candles from -4 to current
  // ② EMA40 ptc > 0.001 for same 5 consecutive candles
  // ③ Current candle green  (close > open)
  // ④ Previous candle red   (open > close)
  // ⑤ Current or previous candle low < EMA20 * 1.0025  (price hugging EMA20)
  // ⑥ EMA20 > EMA40 * 1.0025  (gap between EMAs > 0.25%)
  // ⑦ EMA9 > EMA20
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ema_slope_reversal_bull', side: 'bull', icon: '📈',
    name: 'Bullish Trend',
    sub: 'EMA20+EMA40 rising 5 bars + green after red + low tags EMA20 + EMA9>20>40',
    badge: 'BULL', badgeCls: 'badge-green',
    group: 'advanced',
    tfs: ['15m', '1h'],
    conditions: [
      'EMA20 ptc > 0.1% for each of candles -4 → 0  (5 consecutive bars rising)',
      'EMA40 ptc > 0.1% for same 5 consecutive candles',
      'Current candle green: close > open',
      'Previous candle red: open > close',
      'Current or prev candle low ≤ EMA20 × 1.0025  (price tags EMA20)',
      'EMA20 > EMA40 × 1.0025  (gap ≥ 0.25%)',
      'EMA9 > EMA20',
    ],
    logic(candles) {
      if (!candles || candles.length < 11) return null
      const len = candles.length
      const curr = candles[len - 1]   //  0
      const c1   = candles[len - 2]   // -1
      const c4   = candles[len - 5]   // -4
      const c5   = candles[len - 6]   // -5
      const c6   = candles[len - 7]   // -6
      const c7   = candles[len - 8]   // -7
      const c8   = candles[len - 9]   // -8
      const c9   = candles[len - 10]  // -9

      // All EMAs must exist
      if (curr.ema9==null || curr.ema20==null || curr.ema40==null) return null
      if (c1.ema20==null  || c1.ema40==null)  return null
      if (c4.ema20==null  || c4.ema40==null)  return null
      if (c5.ema20==null  || c5.ema40==null)  return null
      if (c6.ema20==null  || c6.ema40==null)  return null
      if (c7.ema20==null  || c7.ema40==null)  return null
      if (c8.ema20==null  || c8.ema40==null)  return null
      if (c9.ema20==null  || c9.ema40==null)  return null

      // ① EMA20 ptc > 0.0005 for 5 candles: -8→-7, -7→-6, -6→-5, -5→-4, -4 checks vs -5
      // Window: -4,-5,-6,-7,-8  vs prev: -5,-6,-7,-8,-9
      const ema20Window = [c4, c5, c6, c7, c8]
      const ema20Prev   = [c5, c6, c7, c8, c9]
      for (let i = 0; i < 5; i++) {
        const ptc = (ema20Window[i].ema20 - ema20Prev[i].ema20) / ema20Prev[i].ema20
        if (ptc <= 0.0005) return null
      }

      // ② EMA40 ptc > 0.0005 for same 5 candles (-4 to -9)
      const ema40Window = [c4, c5, c6, c7, c8]
      const ema40Prev   = [c5, c6, c7, c8, c9]
      for (let i = 0; i < 5; i++) {
        const ptc = (ema40Window[i].ema40 - ema40Prev[i].ema40) / ema40Prev[i].ema40
        if (ptc <= 0.0005) return null
      }

      // ③ Current candle green
      if (curr.close <= curr.open) return null

      // ④ Previous candle red
      if (c1.open <= c1.close) return null

      // ⑤ Current or previous candle low ≤ EMA20 × 1.0025
      const currTagsEma20 = curr.low <= curr.ema20 * 1.0025
      const prevTagsEma20 = c1.low   <= curr.ema20 * 1.0025
      if (!currTagsEma20 && !prevTagsEma20) return null

      // ⑥ EMA20 > EMA40 × 1.0025  (gap > 0.25%)
      if (curr.ema20 <= curr.ema40 * 1.0025) return null

      // ⑦ EMA9 > EMA20
      if (curr.ema9 <= curr.ema20) return null

      // ─── Build result ───────────────────────────────────────────────────
      const tagStr  = currTagsEma20 ? 'curr' : 'prev'
      const tagLow  = currTagsEma20 ? curr.low : c1.low
      const gapPct  = ((curr.ema20 / curr.ema40 - 1) * 100).toFixed(3)
      const e20ptc  = ((c4.ema20 - c5.ema20) / c5.ema20 * 100).toFixed(4)
      const e40ptc  = ((c4.ema40 - c5.ema40) / c5.ema40 * 100).toFixed(4)
      const gain    = ((curr.close - tagLow) / tagLow * 100).toFixed(2)
      const run     = candles.slice(len - 9, len)

      return {
        candleCount: 9,
        gainPct:     gain,
        highestClose: curr.close,
        lowestOpen:  tagLow,
        conds: [
          `✓ EMA20 rising -4→-9 (ptc at -4: +${e20ptc}%)`,
          `✓ EMA40 rising -4→-9 (ptc at -4: +${e40ptc}%)`,
          `✓ Current green: close ${curr.close.toFixed(4)} > open ${curr.open.toFixed(4)}`,
          `✓ Prev red: open ${c1.open.toFixed(4)} > close ${c1.close.toFixed(4)}`,
          `✓ ${tagStr} low ${tagLow.toFixed(4)} ≤ EMA20×1.0025 (${(curr.ema20*1.0025).toFixed(4)})`,
          `✓ EMA gap ${gapPct}% (EMA20>EMA40×1.0025)`,
          `✓ EMA9 ${curr.ema9.toFixed(4)} > EMA20 ${curr.ema20.toFixed(4)}`,
        ],
        run,
        ema9:  curr.ema9,
        ema20: curr.ema20,
        ema40: curr.ema40,
        rsi:   curr.rsi,
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EMA Slope Reversal Bear  —  mirror
  //
  // ① EMA20 ptc < -0.001 for 5 consecutive candles from -4 to current
  // ② EMA40 ptc < -0.001 for same 5 consecutive candles
  // ③ Current candle red   (open > close)
  // ④ Previous candle green (close > open)
  // ⑤ Current or previous candle high ≥ EMA20 * 0.9975  (price tags EMA20)
  // ⑥ EMA40 > EMA20 * 1.0025  (EMA20 below EMA40 with gap)
  // ⑦ EMA20 > EMA9  (EMA9 below EMA20)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ema_slope_reversal_bear', side: 'bear', icon: '📉',
    name: 'Bearish Trend',
    sub: 'EMA20+EMA40 falling 5 bars + red after green + high tags EMA20 + EMA9<20<40',
    badge: 'BEAR', badgeCls: 'badge-red',
    group: 'advanced',
    tfs: ['15m', '1h'],
    conditions: [
      'EMA20 ptc < -0.1% for each of candles -4 → 0  (5 consecutive bars falling)',
      'EMA40 ptc < -0.1% for same 5 consecutive candles',
      'Current candle red: open > close',
      'Previous candle green: close > open',
      'Current or prev candle high ≥ EMA20 × 0.9975  (price tags EMA20)',
      'EMA40 > EMA20 × 1.0025  (gap ≥ 0.25%)',
      'EMA20 > EMA9',
    ],
    logic(candles) {
      if (!candles || candles.length < 11) return null
      const len = candles.length
      const curr = candles[len - 1]   //  0
      const c1   = candles[len - 2]   // -1
      const c4   = candles[len - 5]   // -4
      const c5   = candles[len - 6]   // -5
      const c6   = candles[len - 7]   // -6
      const c7   = candles[len - 8]   // -7
      const c8   = candles[len - 9]   // -8
      const c9   = candles[len - 10]  // -9

      // All EMAs must exist
      if (curr.ema9==null || curr.ema20==null || curr.ema40==null) return null
      if (c1.ema20==null  || c1.ema40==null)  return null
      if (c4.ema20==null  || c4.ema40==null)  return null
      if (c5.ema20==null  || c5.ema40==null)  return null
      if (c6.ema20==null  || c6.ema40==null)  return null
      if (c7.ema20==null  || c7.ema40==null)  return null
      if (c8.ema20==null  || c8.ema40==null)  return null
      if (c9.ema20==null  || c9.ema40==null)  return null

      // ① EMA20 ptc < -0.0005 for 5 candles: -4 to -9
      // Window: -4,-5,-6,-7,-8  vs prev: -5,-6,-7,-8,-9
      const ema20Window = [c4, c5, c6, c7, c8]
      const ema20Prev   = [c5, c6, c7, c8, c9]
      for (let i = 0; i < 5; i++) {
        const ptc = (ema20Window[i].ema20 - ema20Prev[i].ema20) / ema20Prev[i].ema20
        if (ptc >= -0.0005) return null
      }

      // ② EMA40 ptc < -0.0005 for same 5 candles (-4 to -9)
      const ema40Window = [c4, c5, c6, c7, c8]
      const ema40Prev   = [c5, c6, c7, c8, c9]
      for (let i = 0; i < 5; i++) {
        const ptc = (ema40Window[i].ema40 - ema40Prev[i].ema40) / ema40Prev[i].ema40
        if (ptc >= -0.0005) return null
      }

      // ③ Current candle red
      if (curr.open <= curr.close) return null

      // ④ Previous candle green
      if (c1.close <= c1.open) return null

      // ⑤ Current or previous candle high ≥ EMA20 × 0.9975
      const currTagsEma20 = curr.high >= curr.ema20 * 0.9975
      const prevTagsEma20 = c1.high   >= curr.ema20 * 0.9975
      if (!currTagsEma20 && !prevTagsEma20) return null

      // ⑥ EMA40 > EMA20 × 1.0025  (EMA20 below EMA40 with gap > 0.25%)
      if (curr.ema40 <= curr.ema20 * 1.0025) return null

      // ⑦ EMA20 > EMA9
      if (curr.ema20 <= curr.ema9) return null

      // ─── Build result ───────────────────────────────────────────────────
      const tagStr  = currTagsEma20 ? 'curr' : 'prev'
      const tagHigh = currTagsEma20 ? curr.high : c1.high
      const gapPct  = ((curr.ema40 / curr.ema20 - 1) * 100).toFixed(3)
      const e20ptc  = ((c4.ema20 - c5.ema20) / c5.ema20 * 100).toFixed(4)
      const e40ptc  = ((c4.ema40 - c5.ema40) / c5.ema40 * 100).toFixed(4)
      const drop    = ((tagHigh - curr.close) / tagHigh * 100).toFixed(2)
      const run     = candles.slice(len - 9, len)

      return {
        candleCount: 9,
        gainPct:      drop,
        highestClose: tagHigh,
        lowestOpen:   curr.close,
        conds: [
          `✓ EMA20 falling -4→-9 (ptc at -4: ${e20ptc}%)`,
          `✓ EMA40 falling -4→-9 (ptc at -4: ${e40ptc}%)`,
          `✓ Current red: open ${curr.open.toFixed(4)} > close ${curr.close.toFixed(4)}`,
          `✓ Prev green: close ${c1.close.toFixed(4)} > open ${c1.open.toFixed(4)}`,
          `✓ ${tagStr} high ${tagHigh.toFixed(4)} ≥ EMA20×0.9975 (${(curr.ema20*0.9975).toFixed(4)})`,
          `✓ EMA gap ${gapPct}% (EMA40>EMA20×1.0025)`,
          `✓ EMA20 ${curr.ema20.toFixed(4)} > EMA9 ${curr.ema9.toFixed(4)}`,
        ],
        run,
        ema9:  curr.ema9,
        ema20: curr.ema20,
        ema40: curr.ema40,
        rsi:   curr.rsi,
        isBear: true,
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Buy Signal 3M  —  Bull  (First-Touch EMA16 Entry)
  //
  // Pattern (from chart image):
  //   c1  = TOUCH candle : low dips to EMA16 (first time after a run-up)
  //   curr = ENTRY candle : green body candle immediately after the touch
  //
  // Conditions:
  //   ① EMA stack (curr): EMA16 > EMA25 > EMA50                (bullish order)
  //   ② EMA25 overall rising: curr.ema25 > c6.ema25            (net rising over 6 bars)
  //   ③ EMA50 overall rising: curr.ema50 > c6.ema50            (net rising over 6 bars)
  //   ④ TOUCH candle (c1): c1.low < c1.ema16 × 1.002           (low tagged EMA16)
  //   ⑤ FRESH touch — c2, c3, c4 did NOT touch EMA16:
  //        c2.low > c2.ema16 × 1.002  AND
  //        c3.low > c3.ema16 × 1.002  AND
  //        c4.low > c4.ema16 × 1.002  (price was running above EMA16)
  //   ⑥ RSI > 60 (current)
  //   ⑦ ENTRY candle (curr): open < close × 0.999              (green body)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'buy_signal_3m', side: 'bull', icon: '🚀',
    name: 'Buy Signal 3M',
    sub: 'First EMA16 touch after run-up · EMA stack bullish · RSI>60 · green entry',
    badge: 'BULL', badgeCls: 'badge-green',
    group: 'advanced',
    tfs: ['3m', '5m', '15m'],
    conditions: [
      'EMA stack: EMA16 > EMA25 > EMA50  (bullish order, current candle)',
      'EMA25 net rising: curr.ema25 > candle[-6].ema25',
      'EMA50 net rising: curr.ema50 > candle[-6].ema50',
      'Touch candle (c1): c1.low < c1.ema16 × 1.002  (low tagged EMA16)',
      'Fresh touch: c2/c3/c4 lows all > their EMA16 × 1.002  (price ran above EMA16 before touch)',
      'Current RSI > 60',
      'Entry candle (curr): open < close × 0.999  (green body)',
    ],
    logic(candles) {
      if (!candles || candles.length < 15) return null
      const len  = candles.length
      const curr = candles[len - 1]   // entry candle (green)
      const c1   = candles[len - 2]   // touch candle (low tags EMA16)
      const c2   = candles[len - 3]   // must NOT have tagged EMA16
      const c3   = candles[len - 4]   // must NOT have tagged EMA16
      const c4   = candles[len - 5]   // must NOT have tagged EMA16
      const c6   = candles[len - 7]   // for net-rising EMA25/50 check

      // EMA existence checks
      if (curr.ema16 == null || curr.ema25 == null || curr.ema50 == null) return null
      if (curr.rsi   == null) return null
      if (c1.ema16   == null) return null
      if (c2.ema16   == null || c3.ema16 == null || c4.ema16 == null) return null
      if (c6.ema25   == null || c6.ema50 == null) return null

      // ① EMA stack: EMA16 > EMA25 > EMA50
      if (curr.ema16 <= curr.ema25) return null
      if (curr.ema25 <= curr.ema50) return null

      // ② EMA25 net rising over 6 bars
      if (curr.ema25 <= c6.ema25) return null

      // ③ EMA50 net rising over 6 bars
      if (curr.ema50 <= c6.ema50) return null

      // ④ Touch candle: c1.low < c1.ema16 × 1.002  (tagged EMA16)
      if (c1.low >= c1.ema16 * 1.002) return null

      // ⑤ Fresh touch: c2, c3, c4 did NOT touch EMA16 (they were running above it)
      if (c2.low < c2.ema16 * 1.002) return null
      if (c3.low < c3.ema16 * 1.002) return null
      if (c4.low < c4.ema16 * 1.002) return null

      // ⑥ RSI > 60
      if (curr.rsi <= 60) return null

      // ⑦ Entry candle: green body
      if (curr.open >= curr.close * 0.999) return null

      // ─── Build result ─────────────────────────────────────────────────
      const e25rise = ((curr.ema25 - c6.ema25) / c6.ema25 * 100).toFixed(3)
      const e50rise = ((curr.ema50 - c6.ema50) / c6.ema50 * 100).toFixed(3)
      const gap16   = ((c1.low / c1.ema16 - 1) * 100).toFixed(3)
      const run     = candles.slice(len - 8, len)

      return {
        candleCount: 8,
        gainPct: ((curr.close - c1.low) / c1.low * 100).toFixed(2),
        highestClose: curr.close,
        lowestOpen:   c1.low,
        conds: [
          `✓ EMA stack: EMA16 ${curr.ema16.toFixed(4)} > EMA25 ${curr.ema25.toFixed(4)} > EMA50 ${curr.ema50.toFixed(4)}`,
          `✓ EMA25 net +${e25rise}% over 6 bars`,
          `✓ EMA50 net +${e50rise}% over 6 bars`,
          `✓ Touch(c1) low ${c1.low.toFixed(4)} < EMA16×1.002 (${(c1.ema16*1.002).toFixed(4)}) · gap ${gap16}%`,
          `✓ Fresh: c2/c3/c4 lows were above EMA16 (price ran up before touch)`,
          `✓ RSI ${curr.rsi.toFixed(1)} > 60`,
          `✓ Entry green: open ${curr.open.toFixed(4)} < close×0.999 (${(curr.close*0.999).toFixed(4)})`,
        ],
        run,
        ema16: curr.ema16,
        ema25: curr.ema25,
        ema50: curr.ema50,
        rsi:   curr.rsi,
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Sell Signal 3M  —  Bear  (exact mirror of Buy Signal 3M)
  //
  // Skip the 2 most recent candles.
  // Evaluate candles -2 through -7:
  //   ① EMA25 ptc < -0.0015 for every candle  (EMA25 falling ≥ 0.15%/bar)
  //   ② EMA50 ptc < -0.0015 for every candle  (EMA50 falling ≥ 0.15%/bar)
  // ③ Current RSI < 40                         (RSI breakdown)
  // ④ Current OR previous candle high > EMA16 × 0.998   (price near EMA16)
  // ⑤ Current candle close < open × 0.999               (red body candle)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'sell_signal_3m', side: 'bear', icon: '💣',
    name: 'Sell Signal 3M',
    sub: 'EMA25/50 falling ptc<-0.0015 [-2→-7] + RSI<40 + price tags EMA16',
    badge: 'BEAR', badgeCls: 'badge-red',
    group: 'advanced',
    tfs: ['3m', '5m', '15m'],
    conditions: [
      'Skip candles 0 and -1 (most recent 2 not evaluated)',
      'EMA25 ptc < -0.0015 for each of candles -2 → -7  (falling ≥ 0.15% per bar)',
      'EMA50 ptc < -0.0015 for each of candles -2 → -7  (falling ≥ 0.15% per bar)',
      'Current RSI < 40  (RSI breakdown below 40)',
      'Current or previous candle high > EMA16 × 0.998  (price tags EMA16)',
      'Current candle: close < open × 0.999  (bearish body, not doji)',
    ],
  // ─────────────────────────────────────────────────────────────────────────
  // Sell Signal 3M  —  Bear  (exact mirror of Buy Signal 3M)
  //
  // Pattern:
  //   c1  = TOUCH candle : high spikes UP to EMA16 (first time after a run-down)
  //   curr = ENTRY candle : red body candle immediately after the touch
  //
  // Conditions:
  //   ① EMA stack (curr): EMA16 < EMA25 < EMA50                (bearish order)
  //   ② EMA25 overall falling: curr.ema25 < c6.ema25           (net falling over 6 bars)
  //   ③ EMA50 overall falling: curr.ema50 < c6.ema50           (net falling over 6 bars)
  //   ④ TOUCH candle (c1): c1.high > c1.ema16 × 0.998          (high tagged EMA16)
  //   ⑤ FRESH touch — c2, c3, c4 did NOT touch EMA16:
  //        c2.high < c2.ema16 × 0.998  AND
  //        c3.high < c3.ema16 × 0.998  AND
  //        c4.high < c4.ema16 × 0.998  (price was running below EMA16)
  //   ⑥ RSI < 40 (current)
  //   ⑦ ENTRY candle (curr): close < open × 0.999              (red body)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'sell_signal_3m', side: 'bear', icon: '💣',
    name: 'Sell Signal 3M',
    sub: 'First EMA16 touch after run-down · EMA stack bearish · RSI<40 · red entry',
    badge: 'BEAR', badgeCls: 'badge-red',
    group: 'advanced',
    tfs: ['3m', '5m', '15m'],
    conditions: [
      'EMA stack: EMA16 < EMA25 < EMA50  (bearish order, current candle)',
      'EMA25 net falling: curr.ema25 < candle[-6].ema25',
      'EMA50 net falling: curr.ema50 < candle[-6].ema50',
      'Touch candle (c1): c1.high > c1.ema16 × 0.998  (high spiked to EMA16)',
      'Fresh touch: c2/c3/c4 highs all < their EMA16 × 0.998  (price ran below EMA16 before touch)',
      'Current RSI < 40',
      'Entry candle (curr): close < open × 0.999  (red body)',
    ],
    logic(candles) {
      if (!candles || candles.length < 15) return null
      const len  = candles.length
      const curr = candles[len - 1]   // entry candle (red)
      const c1   = candles[len - 2]   // touch candle (high tags EMA16)
      const c2   = candles[len - 3]   // must NOT have tagged EMA16
      const c3   = candles[len - 4]   // must NOT have tagged EMA16
      const c4   = candles[len - 5]   // must NOT have tagged EMA16
      const c6   = candles[len - 7]   // for net-falling EMA25/50 check

      // EMA existence checks
      if (curr.ema16 == null || curr.ema25 == null || curr.ema50 == null) return null
      if (curr.rsi   == null) return null
      if (c1.ema16   == null) return null
      if (c2.ema16   == null || c3.ema16 == null || c4.ema16 == null) return null
      if (c6.ema25   == null || c6.ema50 == null) return null

      // ① EMA stack: EMA16 < EMA25 < EMA50  (bearish)
      if (curr.ema16 >= curr.ema25) return null
      if (curr.ema25 >= curr.ema50) return null

      // ② EMA25 net falling over 6 bars
      if (curr.ema25 >= c6.ema25) return null

      // ③ EMA50 net falling over 6 bars
      if (curr.ema50 >= c6.ema50) return null

      // ④ Touch candle: c1.high > c1.ema16 × 0.998  (tagged EMA16 from below)
      if (c1.high <= c1.ema16 * 0.998) return null

      // ⑤ Fresh touch: c2, c3, c4 did NOT touch EMA16 (running below it)
      if (c2.high > c2.ema16 * 0.998) return null
      if (c3.high > c3.ema16 * 0.998) return null
      if (c4.high > c4.ema16 * 0.998) return null

      // ⑥ RSI < 40
      if (curr.rsi >= 40) return null

      // ⑦ Entry candle: red body
      if (curr.close >= curr.open * 0.999) return null

      // ─── Build result ─────────────────────────────────────────────────
      const e25fall = ((curr.ema25 - c6.ema25) / c6.ema25 * 100).toFixed(3)
      const e50fall = ((curr.ema50 - c6.ema50) / c6.ema50 * 100).toFixed(3)
      const gap16   = ((c1.high / c1.ema16 - 1) * 100).toFixed(3)
      const run     = candles.slice(len - 8, len)

      return {
        candleCount: 8,
        gainPct: ((c1.high - curr.close) / c1.high * 100).toFixed(2),
        highestClose: c1.high,
        lowestOpen:   curr.close,
        conds: [
          `✓ EMA stack: EMA16 ${curr.ema16.toFixed(4)} < EMA25 ${curr.ema25.toFixed(4)} < EMA50 ${curr.ema50.toFixed(4)}`,
          `✓ EMA25 net ${e25fall}% over 6 bars  (falling)`,
          `✓ EMA50 net ${e50fall}% over 6 bars  (falling)`,
          `✓ Touch(c1) high ${c1.high.toFixed(4)} > EMA16×0.998 (${(c1.ema16*0.998).toFixed(4)}) · gap ${gap16}%`,
          `✓ Fresh: c2/c3/c4 highs were below EMA16 (price ran down before touch)`,
          `✓ RSI ${curr.rsi.toFixed(1)} < 40`,
          `✓ Entry red: close ${curr.close.toFixed(4)} < open×0.999 (${(curr.open*0.999).toFixed(4)})`,
        ],
        run,
        ema16: curr.ema16,
        ema25: curr.ema25,
        ema50: curr.ema50,
        rsi:   curr.rsi,
        isBear: true,
      }
    },
  },

]

// Combined for convenience
export const ALL_SCANNERS = [...SCANNERS, ...ADVANCED_SCANNERS]

// ── TF metadata — add new TFs here once, tabs auto-appear ─────────────────────
export const TF_ORDER = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','12h','1d']

export const TF_META = {
  '1m':  { id:'1m',  label:'1m',  color:'#ff6b6b', desc:'Scalping' },
  '3m':  { id:'3m',  label:'3m',  color:'#ffa94d', desc:'Fast momentum' },
  '5m':  { id:'5m',  label:'5m',  color:'#ffd43b', desc:'Short-term' },
  '15m': { id:'15m', label:'15m', color:'#69db7c', desc:'Intraday trend' },
  '30m': { id:'30m', label:'30m', color:'#38d9a9', desc:'Mid intraday' },
  '1h':  { id:'1h',  label:'1h',  color:'#4dabf7', desc:'Swing conditions' },
  '2h':  { id:'2h',  label:'2h',  color:'#74c0fc', desc:'Extended swing' },
  '4h':  { id:'4h',  label:'4h',  color:'#9775fa', desc:'Position setups' },
  '6h':  { id:'6h',  label:'6h',  color:'#e599f7', desc:'Daily prep' },
  '12h': { id:'12h', label:'12h', color:'#f783ac', desc:'Overnight range' },
  '1d':  { id:'1d',  label:'Day', color:'#ffc078', desc:'Macro trend' },
}
