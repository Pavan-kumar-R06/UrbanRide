const express = require('express');
const mongoose = require('mongoose');
const Journey = require('../models/Journey');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { createBookingRecord } = require('./bookings');
const { openRidesFor } = require('../services/alternatives');
const { matchRides, planChains, etaMs, startMs } = require('../services/matching');
const { priceFor, km, P, nodeName: nm } = require('../services/city-graph');
const { computeJourneyDNA } = require('../services/dna');
const { reliabilityMap } = require('../services/reliability-db');
const { getWeather } = require('../services/weather');
const { notifyUser } = require('../services/notify');
const router = express.Router();

const ser = r => ({ id: String(r._id), drv: r.drv, veh: r.veh, vtype: r.vtype || 'car', time: r.time, date: r.date, rate: r.rate, seats: r.seats, path: r.path, own: r.own, rt: r.rt });

async function dnaForLegs(legs, rel) {
  const weather = await getWeather();
  return computeJourneyDNA({ weather, legs: legs.map(l => ({ path: l.ride.path, f: l.f, t: l.t, vtype: l.ride.vtype || 'car', seats: l.seats || 1, fare: l.fare, fee: l.fee, waitMinutes: l.waitMinutes, reliability: rel[String(l.ride.own)] ? rel[String(l.ride.own)].score : null })) });
}

/* Journey plans for a trip no single ride covers.
   mode "shared": 2 vehicles that cross at a hub (the original multi-vehicle search, up to 60 min wait)
   mode "chain" : "multiple journey" - up to 3 rides chained one after another (A: 1->5, B: 5->8 ...)
                  with a wait tolerance chosen by the traveller. */
router.post('/journeys/plan', async (req, res) => {
  try {
    const q = { f: req.body.f, t: req.body.t, time: req.body.time || '08:00', seats: Math.max(1, Math.min(6, Number(req.body.seats) || 1)) };
    if (!P[q.f] || !P[q.t] || q.f === q.t) return res.status(400).json({ error: 'Choose different start and end hubs.' });
    const mode = req.body.mode === 'chain' ? 'chain' : 'shared';
    const maxLegs = mode === 'chain' ? 3 : 2;
    const maxWait = mode === 'chain' ? Math.max(10, Math.min(240, Number(req.body.maxWait) || 90)) : 60;
    const rides = await openRidesFor(req.user.id, req.user.role);
    const { plans, nearMisses } = planChains(rides, q, { userId: req.user.id, maxLegs, maxWait, limit: 5 });
    const rel = await reliabilityMap([...plans.flatMap(p => p.legs.map(l => String(l.ride.own))), ...nearMisses.flatMap(m => [String(m.first.own), String(m.second.own)])]);
    const out = [];
    for (const p of plans) {
      out.push({
        hub: p.hub, hubName: p.hubName, hubs: p.hubs, hubNames: p.hubNames, wait: p.wait, waits: p.waits, total: p.total, distance: p.distance, departAt: p.departAt, arriveAt: p.arriveAt,
        legs: p.legs.map(l => ({ ride: ser(l.ride), f: l.f, t: l.t, k: l.k, fare: l.fare, fee: l.fee, waitMinutes: l.waitMinutes || 0, reliability: rel[String(l.ride.own)] ? rel[String(l.ride.own)].score : null })),
        dna: await dnaForLegs(p.legs.map(l => ({ ...l, seats: q.seats })), rel)
      });
    }
    res.json({
      query: q, mode, maxWait, direct: matchRides(rides, q, { userId: req.user.id }).length, plans: out,
      nearMisses: nearMisses.map(m => ({ hub: m.hub, hubName: m.hubName, gapMin: m.gapMin, kind: m.kind, arriveAt: m.arriveAt, departAt: m.departAt, first: ser(m.first), second: ser(m.second) }))
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to plan the journey.' }); }
});

/* Book every leg as one continuous journey. Fares are recomputed here from the ride rate. */
router.post('/journeys', async (req, res) => {
  const created = [];
  try {
    const legsIn = Array.isArray(req.body.legs) ? req.body.legs : [];
    if (legsIn.length < 2 || legsIn.length > 3) return res.status(400).json({ error: 'A multi-vehicle journey needs 2 or 3 legs.' });
    const seats = Math.max(1, Math.min(6, Number(req.body.seats) || 1));
    const rides = await Ride.find({ _id: { $in: legsIn.map(l => l.rid).filter(id => mongoose.isValidObjectId(id)) } });
    const byId = new Map(rides.map(r => [String(r._id), r]));
    legsIn.forEach((l, i) => {
      const r = byId.get(String(l.rid));
      if (!r) throw Object.assign(new Error('One of the rides no longer exists.'), { status: 404 });
      if (i && legsIn[i - 1].t !== l.f) throw Object.assign(new Error('Legs must connect: each leg starts where the previous one ends.'), { status: 400 });
    });
    // the next vehicle must reach the change point AFTER the previous one has arrived (and not hours later)
    for (let i = 1; i < legsIn.length; i++) {
      const prev = byId.get(String(legsIn[i - 1].rid)), cur = byId.get(String(legsIn[i].rid));
      const arrive = etaMs(prev, prev.path.indexOf(legsIn[i - 1].t)), leave = etaMs(cur, cur.path.indexOf(legsIn[i].f));
      const gap = Math.round((leave - arrive) / 60000);
      if (gap < 0) throw Object.assign(new Error(`Leg ${i + 1} leaves ${nm(legsIn[i].f)} ${-gap} min before leg ${i} arrives. These rides cannot be connected.`), { status: 409 });
      if (gap > 240) throw Object.assign(new Error(`Leg ${i + 1} leaves ${gap} min after leg ${i} arrives. That wait is too long for one journey.`), { status: 409 });
    }
    const journey = await Journey.create({ uid: req.user.id, from: legsIn[0].f, to: legsIn[legsIn.length - 1].t, seats });
    let committed = 0;
    for (let i = 0; i < legsIn.length; i++) {
      const l = legsIn[i], r = byId.get(String(l.rid));
      const a = r.path.indexOf(l.f), b = r.path.indexOf(l.t);
      if (a < 0 || b <= a) throw Object.assign(new Error('A leg has an invalid pickup or drop-off.'), { status: 400 });
      const price = priceFor(km(r.path, a, b), r.rate, seats);
      const booking = await createBookingRecord(req.user.id, { rid: String(r._id), f: l.f, t: l.t, seats, fare: price.base, fee: price.fee }, { alreadyCommitted: committed, fields: { journeyId: String(journey._id), legIndex: i } });
      created.push(booking);
      committed += price.base + price.fee;
      journey.legs.push({ bookingId: String(booking._id), rideId: String(r._id), f: l.f, t: l.t, vtype: r.vtype || 'car', fare: price.base, fee: price.fee, waitMinutes: Number(l.waitMinutes) || 0 });
      await notifyUser(r.own, `${req.user.name} requested a seat on your ride ${P[r.path[0]][0]} → ${P[r.path[r.path.length - 1]][0]} as leg ${i + 1} of a multi-vehicle journey.`, req.user.name, 'drive');
    }
    const rel = await reliabilityMap(rides.map(r => String(r.own)));
    journey.dna = await dnaForLegs(journey.legs.map(l => ({ ride: byId.get(l.rideId), f: l.f, t: l.t, seats, fare: l.fare, fee: l.fee, waitMinutes: l.waitMinutes })), rel);
    await journey.save();
    res.status(201).json({ journey: journey.toObject(), bookings: created });
  } catch (err) {
    // roll back already-created legs so the passenger never ends up with half a journey
    for (const b of created) { await Booking.updateOne({ _id: b._id }, { $set: { st: 'cancelled', cancelledAt: new Date() } }); await Ride.updateOne({ _id: b.rid }, { $inc: { seats: b.seats } }); }
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Journey creation error:', err);
    res.status(500).json({ error: 'Failed to book the journey.' });
  }
});

router.get('/journeys', async (req, res) => {
  try {
    const list = await Journey.find({ uid: req.user.id }).sort({ createdAt: -1 }).limit(30).lean();
    res.json(list.map(j => ({ ...j, id: String(j._id), _id: String(j._id) })));
  } catch (e) { res.status(500).json({ error: 'Failed to load journeys.' }); }
});

module.exports = router;
