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
async function load(range) {
  const since = new Date(cutoffFor(range));
  const [rides, bookings, signals] = await Promise.all([
    Ride.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(2000).lean(),
    Booking.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(5000).lean(),
    DemandSignal.find({ createdAt: { $gte: since } }).limit(10000).lean()
  ]);
  return { rides: rides.map(r => ({ ...r, id: String(r._id) })), bookings, signals };
}

router.get('/analytics/heatmap', requireAdmin, async (req, res) => {
  try { res.json({ range: req.query.range || '7d', ...heatmap({ ...(await load(req.query.range || '7d')), vtype: req.query.vtype || 'all' }) }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Failed to build the heatmap.' }); }
});
router.get('/analytics/advanced', requireAdmin, async (req, res) => {
  try { res.json({ range: req.query.range || '7d', ...advanced(await load(req.query.range || '7d')) }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Failed to build analytics.' }); }
});
module.exports = router;
