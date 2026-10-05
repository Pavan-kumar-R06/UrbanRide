/* Live traffic per road segment.
   - If TOMTOM_API_KEY is set, uses TomTom Traffic Flow (real-time currentSpeed / freeFlowSpeed).
   - Otherwise falls back to a time-of-day simulation so the feature still works offline. */
const { E, CITY_GEO, edgeKey } = require('./city-graph');

let cache = { at: 0, data: null };

function simulated(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  const peak = Math.max(Math.exp(-((h - 9) ** 2) / 2.5), Math.exp(-((h - 18.5) ** 2) / 3));
  return E.map(([a, b]) => {
    const seed = ([...(a + b)].reduce((x, c) => x + c.charCodeAt(0) * 7, 0) % 100) / 100;
    const level = Math.max(0, Math.min(1, 0.12 + peak * (0.45 + seed * 0.45) + (seed - 0.5) * 0.1));
    return { a, b, key: edgeKey(a, b), level: +level.toFixed(2), speedKmh: Math.round(40 * (1 - level * 0.8)), source: 'simulated' };
  });
}

async function fetchTomTom(key) {
  const out = [];
  for (const [a, b] of E) {
    const lat = (CITY_GEO[a][0] + CITY_GEO[b][0]) / 2, lon = (CITY_GEO[a][1] + CITY_GEO[b][1]) / 2;
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=KMPH&key=${encodeURIComponent(key)}`;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      const j = await r.json();
      const f = j.flowSegmentData;
      const level = f && f.freeFlowSpeed ? Math.max(0, Math.min(1, 1 - f.currentSpeed / f.freeFlowSpeed)) : null;
      if (level === null) throw new Error('no flow data');
      out.push({ a, b, key: edgeKey(a, b), level: +level.toFixed(2), speedKmh: Math.round(f.currentSpeed), source: 'tomtom' });
    } catch (e) {
      out.push(simulated().find(x => x.key === edgeKey(a, b)));
    } finally { clearTimeout(t); }
  }
  return out;
}

async function getTraffic() {
  if (cache.data && Date.now() - cache.at < 120000) return cache.data;
  const key = process.env.TOMTOM_API_KEY;
  const data = key ? await fetchTomTom(key) : simulated();
  cache = { at: Date.now(), data };
  return data;
}
const trafficFactor = segs => segs.length ? 1 + segs.reduce((a, s) => a + s.level, 0) / segs.length * 0.8 : 1;

module.exports = { getTraffic, simulated, trafficFactor };
