// test.js — Quick sanity check (no Telegram, no live API needed)
// Run: node test.js

const { calcEMA, calcRSI, avgVolume, detectBullDivergence } = require('./indicators');
const { analyseSymbol } = require('./signal');

console.log('── Indicator Tests ──\n');

// Generate synthetic price data — uptrend
function syntheticCloses(start, count, drift = 0.001, noise = 0.002) {
  const arr = [start];
  for (let i = 1; i < count; i++) {
    const prev = arr[i - 1];
    arr.push(prev * (1 + drift + (Math.random() - 0.5) * noise));
  }
  return arr;
}

const closes = syntheticCloses(0.00008, 120, 0.0008, 0.003);

const ema20 = calcEMA(closes, 20);
const ema40 = calcEMA(closes, 40);
const ema80 = calcEMA(closes, 80);
const rsi   = calcRSI(closes, 14);
const vol   = avgVolume([1,2,3,4,5,6,7,8,9,10], 10);

console.log(`EMA20: ${ema20?.toFixed(8)}`);
console.log(`EMA40: ${ema40?.toFixed(8)}`);
console.log(`EMA80: ${ema80?.toFixed(8)}`);
console.log(`RSI14: ${rsi?.toFixed(2)}`);
console.log(`AvgVol: ${vol}`);
console.log(`Bull stack: ${ema20 > ema40 && ema40 > ema80}`);

console.log('\n── analyseSymbol mock test ──\n');

// Build mock data that should trigger a LONG signal
const mockCloses15m = syntheticCloses(0.0001, 120, 0.0005, 0.001);
// Force last price to be near EMA20
const ema20val = calcEMA(mockCloses15m, 20);
mockCloses15m[mockCloses15m.length - 1] = ema20val * 1.001; // within 0.1% of EMA20

const mockData15m = {
  opens:   mockCloses15m.map(c => c * 0.9995),
  highs:   mockCloses15m.map(c => c * 1.002),
  lows:    mockCloses15m.map((c, i) => {
    if (i === mockCloses15m.length - 1) return c * 0.998; // big lower wick
    return c * 0.9995;
  }),
  closes:  mockCloses15m,
  volumes: Array.from({ length: 120 }, (_, i) => i < 110 ? 1000 : 2000), // last bars high vol
};

const mockCloses5m = syntheticCloses(0.0001, 80, 0.0005, 0.001);
const mockData5m = { closes: mockCloses5m };

const signal = analyseSymbol('TESTUSDT', mockData15m, mockData5m);
if (signal) {
  console.log('✅ Signal generated:');
  console.log(JSON.stringify(signal, null, 2));
} else {
  console.log('ℹ️  No signal on mock data (conditions may not align — try adjusting synthetic data drift)');
}

console.log('\n── Tests complete ──');
