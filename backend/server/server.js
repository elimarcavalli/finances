// server/server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Simples datafeed UDF-compatible com gerador de candles sintéticos para testes
// Em produção: substitua a função getCandles(...) pela sua fonte real (BD, exchange, etc.)

const app = express();
app.use(cors({ origin: ['http://localhost:5173'] })); // front origin
app.use(express.json());
app.use(morgan('dev'));

function resolutionToSeconds(res) {
  if (res === '1D') return 86400;
  const n = parseInt(res, 10);
  if (!isNaN(n)) return n * 60;
  return 60;
}

// Pseudo-random deterministic generator (por símbolo) para criar candles plausíveis
function pseudoSeededPrice(symbol, idx) {
  // deterministic base from symbol chars
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) % 100000;
  const base = 20000 + (seed % 10000); // base price range
  // make a smooth-ish walk using sin + small noise
  return base * (1 + 0.02 * Math.sin((idx / 10) + (seed % 10)) + (Math.sin(idx) * 0.002));
}

function getCandles(symbol, resolution, fromS, toS) {
  const step = resolutionToSeconds(resolution);
  const bars = [];
  // ensure not too many points
  const maxPoints = 2000;
  let count = Math.floor((toS - fromS) / step);
  if (count > maxPoints) {
    fromS = toS - maxPoints * step;
    count = maxPoints;
  }
  for (let i = 0; i <= count; i++) {
    const t = fromS + i * step;
    const idx = Math.floor(t / step);
    const p = pseudoSeededPrice(symbol, idx);
    // create O H L C around p
    const o = Number((p * (1 + (Math.sin(idx + 1) * 0.003))).toFixed(2));
    const c = Number((p * (1 + (Math.cos(idx + 2) * 0.003))).toFixed(2));
    const h = Number(Math.max(o, c) * (1 + Math.random() * 0.002 + 0.001)).toFixed(2);
    const l = Number(Math.min(o, c) * (1 - (Math.random() * 0.002 + 0.001))).toFixed(2);
    const v = Math.floor(100 + (Math.abs(Math.sin(idx)) * 1000));
    bars.push({ time: t * 1000, open: o, high: Number(h), low: Number(l), close: c, volume: v });
  }
  return bars;
}

app.get('/datafeed/config', (req, res) => {
  res.json({
    supports_search: true,
    supports_group_request: false,
    supported_resolutions: ['1','5','15','60','240','1D'],
    supports_marks: false,
    supports_time: true
  });
});

app.get('/datafeed/symbol_info', (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const symbolInfo = {
    name: symbol,
    full_name: symbol,
    ticker: symbol,
    description: symbol,
    type: 'crypto',
    session: '24x7',
    timezone: 'UTC',
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    supported_resolutions: ['1','5','15','60','240','1D']
  };
  res.json(symbolInfo);
});

app.get('/datafeed/history', (req, res) => {
  try {
    const { symbol, resolution, from, to } = req.query;
    if (!symbol || !resolution || !from || !to) return res.status(400).json({ s: 'error', errmsg: 'missing params' });
    const fromS = Math.floor(Number(from));
    const toS = Math.floor(Number(to));
    if (toS <= fromS) return res.json({ s: 'no_data' });
    const bars = getCandles(symbol, resolution, fromS, toS);
    if (!bars || bars.length === 0) return res.json({ s: 'no_data' });
    const t = bars.map(b => Math.floor(b.time / 1000));
    const o = bars.map(b => b.open);
    const h = bars.map(b => b.high);
    const l = bars.map(b => b.low);
    const c = bars.map(b => b.close);
    const v = bars.map(b => b.volume);
    return res.json({ s: 'ok', t, o, h, l, c, v });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ s: 'error', errmsg: String(err) });
  }
});

app.get('/datafeed/time', (req, res) => res.json({ time: Math.floor(Date.now()/1000) }));

const PORT = 8000;
app.listen(PORT, () => console.log(`UDF datafeed listening on ${PORT}`));
