const express = require('express');
const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const { passportFor, reliabilityMap } = require('../services/reliability-db');
const { computeJourneyDNA } = require('../services/dna');
const { getWeather } = require('../services/weather');
const { getTraffic, trafficFactor } = require('../services/traffic');
const { pathEdges, P } = require('../services/city-graph');
const router = express.Router();

/* Vehicle Passport + reliability for any driver (visible to every signed-in user) */
router.get('/passport/:uid', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.uid)) return res.status(400).json({ error: 'Invalid driver.' });
    const data = await passportFor(req.params.uid);
    if (!data) return res.status(404).json({ error: 'This member has no registered vehicle.' });
    res.json(data);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load the Vehicle Passport.' }); }
});

router.get('/reliability', async (req, res) => {
  try {
    const ids = String(req.query.uids || '').split(',').filter(id => mongoose.isValidObjectId(id)).slice(0, 30);
    const map = await reliabilityMap(ids.length ? ids : [req.user.id]);
    res.json(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, ids.length ? { score: v.score, tier: v.tier } : v])));
  } catch (e) { res.status(500).json({ error: 'Failed to calculate reliability.' }); }
});
router.get('/reliability/:uid', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.uid)) return res.status(400).json({ error: 'Invalid member.' });
    res.json((await reliabilityMap([req.params.uid]))[req.params.uid] || null);
  } catch (e) { res.status(500).json({ error: 'Failed to calculate reliability.' }); }
});

/* Journey DNA: for a prospective ride (rideId,f,t,seats) or an existing booking */
router.post('/dna', async (req, res) => {
  try {
    let items = [];
    if (req.body.bookingId) {
      const b = await Booking.findById(req.body.bookingId).lean();
      if (!b || (b.pid !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ error: 'Booking not found.' });
      const siblings = b.journeyId ? await Booking.find({ journeyId: b.journeyId }).sort({ legIndex: 1 }).lean() : [b];
      items = siblings.map(x => ({ rid: x.rid, f: x.f, t: x.t, seats: x.seats, fare: x.fare, fee: x.fee }));
    } else items = [{ rid: req.body.rideId, f: req.body.f, t: req.body.t, seats: req.body.seats || 1, fare: req.body.fare || 0, fee: req.body.fee || 0 }];
    const rides = await Ride.find({ _id: { $in: items.map(i => i.rid).filter(id => mongoose.isValidObjectId(id)) } }).lean();
    const byId = new Map(rides.map(r => [String(r._id), r]));
    if (items.some(i => !byId.get(String(i.rid)) || !P[i.f] || !P[i.t])) return res.status(404).json({ error: 'Ride not found.' });
    const rel = await reliabilityMap(rides.map(r => String(r.own)));
    const segs = await getTraffic();
    const keys = new Set(items.flatMap(i => { const r = byId.get(String(i.rid)); const a = r.path.indexOf(i.f), z = r.path.indexOf(i.t); return pathEdges(r.path.slice(a, z + 1)); }));
    const dna = computeJourneyDNA({
      weather: await getWeather(), trafficFactor: trafficFactor(segs.filter(s => keys.has(s.key))),
      legs: items.map((i, n) => { const r = byId.get(String(i.rid)); return { path: r.path, f: i.f, t: i.t, vtype: r.vtype || 'car', seats: i.seats, fare: i.fare, fee: i.fee, waitMinutes: n ? 10 : 0, reliability: rel[String(r.own)] ? rel[String(r.own)].score : null }; })
    });
    res.json(dna);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to compute Journey DNA.' }); }
});
module.exports = router;
