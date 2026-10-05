const express = require('express');
const mongoose = require('mongoose');
const Disruption = require('../models/Disruption');
const Booking = require('../models/Booking');
const { requireAdmin } = require('../middleware/auth');
const { applyDisruption, clearDisruption, alternativesForBooking } = require('../services/alternatives');
const { getTraffic } = require('../services/traffic');
const { P, E, edgeKey } = require('../services/city-graph');
const router = express.Router();

router.get('/disruptions', async (req, res) => {
  try {
    const list = await Disruption.find(req.user.role === 'admin' ? {} : { active: true }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(list.map(d => ({ ...d, id: String(d._id), _id: String(d._id), impacted: (d.impactedBookings || []).length })));
  } catch (e) { res.status(500).json({ error: 'Failed to load disruptions.' }); }
});

router.post('/disruptions', requireAdmin, async (req, res) => {
  try {
    const { a, b, kind = 'closure', reason = '' } = req.body;
    if (!P[a] || !P[b] || !E.some(([x, y]) => edgeKey(x, y) === edgeKey(a, b))) return res.status(400).json({ error: 'Choose two directly connected hubs.' });
    if (!['closure', 'traffic', 'accident', 'weather'].includes(kind)) return res.status(400).json({ error: 'Invalid disruption type.' });
    if (await Disruption.exists({ active: true, $or: [{ a, b }, { a: b, b: a }] })) return res.status(409).json({ error: 'That road segment already has an active disruption.' });
    const d = await Disruption.create({ a, b, kind, reason: String(reason).slice(0, 300), createdBy: req.user.name });
    const impacted = await applyDisruption(d);
    res.status(201).json({ ...d.toObject(), id: String(d._id), impacted: impacted.length });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create disruption.' }); }
});

router.put('/disruptions/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const d = await Disruption.findById(req.params.id);
    if (!d) return res.status(404).json({ error: 'Disruption not found.' });
    await clearDisruption(d);
    res.json({ ...d.toObject(), id: String(d._id) });
  } catch (e) { res.status(500).json({ error: 'Failed to clear disruption.' }); }
});

/* Live (or simulated) congestion per road segment, plus whether we are using a real feed. */
router.get('/traffic', async (req, res) => {
  try {
    const segments = await getTraffic();
    res.json({ live: segments.some(s => s.source === 'tomtom'), source: segments[0] ? segments[0].source : 'simulated', updatedAt: new Date(), segments });
  } catch (e) { res.status(500).json({ error: 'Failed to load traffic.' }); }
});

/* Admin: turn severe congestion into disruptions so affected passengers are re-routed automatically. */
router.post('/traffic/scan', requireAdmin, async (req, res) => {
  try {
    const threshold = Math.max(0.5, Math.min(1, Number(req.body.threshold) || 0.8));
    const segments = (await getTraffic()).filter(s => s.level >= threshold);
    const created = [];
    for (const s of segments) {
      if (await Disruption.exists({ active: true, $or: [{ a: s.a, b: s.b }, { a: s.b, b: s.a }] })) continue;
      const d = await Disruption.create({ a: s.a, b: s.b, kind: 'traffic', source: 'traffic-feed', reason: `Heavy congestion (${s.speedKmh} km/h, ${s.source})`, createdBy: 'Traffic monitor' });
      await applyDisruption(d);
      created.push(String(d._id));
    }
    res.json({ scanned: segments.length, created: created.length, threshold });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Traffic scan failed.' }); }
});

router.get('/alternatives/:bookingId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(400).json({ error: 'Invalid booking.' });
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (req.user.role !== 'admin' && booking.pid !== req.user.id) return res.status(403).json({ error: 'This is not your booking.' });
    res.json(await alternativesForBooking(booking, req.user));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to find alternatives.' }); }
});
module.exports = router;
