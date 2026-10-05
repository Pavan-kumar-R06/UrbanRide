/* Current weather for Bengaluru from Open-Meteo (free, no API key). Falls back to "Clear" offline. */
let cache = { at: 0, value: null };
const LABELS = (c) => c === 0 ? 'Clear' : c <= 3 ? 'Cloudy' : c <= 48 ? 'Fog' : c <= 67 || (c >= 80 && c <= 82) ? 'Rain' : c >= 95 ? 'Storm' : 'Cloudy';
const LEVEL = { Clear: 0, Cloudy: 2, Fog: 5, Rain: 7, Storm: 9 };

async function getWeather() {
  if (cache.value && Date.now() - cache.at < 15 * 60000) return cache.value;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946&current=temperature_2m,precipitation,weather_code', { signal: ctl.signal });
    clearTimeout(timer);
    const j = await r.json();
    const label = LABELS(Number(j.current.weather_code));
    cache = { at: Date.now(), value: { label, level: LEVEL[label], temp: j.current.temperature_2m, source: 'open-meteo' } };
  } catch (e) {
    cache = { at: Date.now() - 14 * 60000, value: { label: 'Clear', level: 0, temp: null, source: 'fallback' } };
  }
  return cache.value;
}
module.exports = { getWeather, LEVEL };
