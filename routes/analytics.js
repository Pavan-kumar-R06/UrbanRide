const express = require('express');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const DemandSignal = require('../models/DemandSignal');
const { requireAdmin } = require('../middleware/auth');
const { heatmap, advanced } = require('../services/analytics');
const { P } = require('../services/city-graph');
const router = express.Router();

/* Passengers' searches are the "where/when do people want to go" signal. */
router.post('/demand', async (req, res) => {
  try {
    const { f, t, time = '08:00', vtype = 'all', seats = 1, results = 0 } = req.body;
    if (!P[f] || !P[t] || f === t) return res.status(400).json({ error: 'Invalid search.' });
    const hour = Math.max(0, Math.min(23, parseInt(String(time).split(':')[0], 10) || 0));
    await DemandSignal.create({ uid: req.user.id, f, t, hour, vtype: ['car', 'bike', 'scooter'].includes(vtype) ? vtype : 'all', seats: Math.max(1, Math.min(6, Number(seats) || 1)), results: Math.max(0, Number(results) || 0) });
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Could not record the search.' }); }
});

const cutoffFor = range => range === 'today' ? Date.now() - 864e5 : range === '7d' ? Date.now() - 7 * 864e5 : range === '30d' ? Date.now() - 30 * 864e5 : 0;

/* Searches: fetch only the 6 fields needed, then collapse identical ones (route x hour x vehicle x matched?)
   into a few hundred weighted rows. Measured ~10x faster than a $group pipeline on the test database. */
async function loadSignals(since) {
  const raw = await DemandSignal.find({ createdAt: { $gte: since } }).select('f t hour vtype seats results').sort({ createdAt: -1 }).limit(10000).lean();
  const map = new Map();
  raw.forEach(s => {
    const matched = (s.results || 0) > 0, k = s.f + '|' + s.t + '|' + s.hour + '|' + s.vtype + '|' + matched;
    const o = map.get(k) || { f: s.f, t: s.t, hour: s.hour, vtype: s.vtype, seats: 0, count: 0, results: matched ? 1 : 0 };
    o.seats += s.seats || 1; o.count++; map.set(k, o);
  });
  return [...map.values()];
}

/* Only the fields the maths needs, fetched in parallel, and shared by the heatmap and
   analytics pages for 30 seconds so switching between them does not reload everything. */
const dataCache = new Map();
async function load(range) {
  const hit = dataCache.get(range);
  if (hit && Date.now() - hit.at < 30000) return hit.data;
  const since = new Date(cutoffFor(range));
  const p = Promise.all([
    Ride.find({ createdAt: { $gte: since } }).select('path time date vtype cap seats status rate own createdAt').sort({ createdAt: -1 }).limit(2000).lean(),
    Booking.find({ createdAt: { $gte: since } }).select('rid f t seats st fare').sort({ createdAt: -1 }).limit(5000).lean(),
    loadSignals(since)
  ]).then(([rides, bookings, signals]) => ({ rides: rides.map(r => ({ ...r, id: String(r._id) })), bookings, signals }));
  dataCache.set(range, { at: Date.now(), data: p });   // cache the promise: concurrent requests share one load
  p.catch(() => dataCache.delete(range));
  return p;
}
const outCache = new Map();
async function cached(key, build) {
  const hit = outCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.value;
  const value = await build(); outCache.set(key, { at: Date.now(), value });
  if (outCache.size > 60) outCache.delete(outCache.keys().next().value);
  return value;
}

router.get('/analytics/heatmap', requireAdmin, async (req, res) => {
  try { const range = req.query.range || '7d', vtype = req.query.vtype || 'all'; res.json(await cached('h:' + range + ':' + vtype, async () => ({ range, ...heatmap({ ...(await load(range)), vtype }) }))); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Failed to build the heatmap.' }); }
});
router.get('/analytics/advanced', requireAdmin, async (req, res) => {
  try { const range = req.query.range || '7d'; res.json(await cached('a:' + range, async () => ({ range, ...advanced(await load(range)) }))); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Failed to build analytics.' }); }
});
module.exports = router;
