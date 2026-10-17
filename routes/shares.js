const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const TripShare = require('../models/TripShare');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Journey = require('../models/Journey');
const { rideProgress, segmentProgress } = require('../services/progress');
const { scheduledAt, nodeName, km } = require('../services/city-graph');

const ENDED_BOOKING = ['cancelled', 'ride-cancelled', 'rejected'];
const cleanPhone = p => String(p || '').replace(/[^0-9+]/g, '').slice(0, 20);

const router = express.Router();          // authenticated
const publicRouter = express.Router();    // no login: the secret token is the credential

router.post('/shares', async (req, res) => {
  try {
    const { rideId, bookingId = '', journeyId = '', contactName = '', contactPhone = '' } = req.body;
    const phone = cleanPhone(contactPhone), name = String(contactName).trim().slice(0, 60);
    let ride, booking = null, jId = '', expiryBase;

    if (journeyId) {                                  // ONE link for the whole multi-vehicle journey
      if (!mongoose.isValidObjectId(journeyId)) return res.status(400).json({ error: 'Invalid journey.' });
      const journey = await Journey.findOne({ _id: journeyId, uid: req.user.id });
      if (!journey) return res.status(403).json({ error: 'Only the traveller on this journey can share it.' });
      const legs = await Booking.find({ journeyId: String(journey._id) }).sort({ legIndex: 1 }).lean();
      const rides = await Ride.find({ _id: { $in: legs.map(l => l.rid).filter(id => mongoose.isValidObjectId(id)) } }).lean();
      const live = legs.filter(l => !ENDED_BOOKING.includes(l.st) && !l.tripCompletedAt && rides.find(r => String(r._id) === String(l.rid) && !['completed', 'cancelled'].includes(r.status)));
      if (!live.length) return res.status(409).json({ error: 'This journey has already ended.' });
      ride = rides.find(r => String(r._id) === String(live[0].rid));
      jId = String(journey._id);
      expiryBase = new Date(Math.max(Date.now(), ...rides.map(r => scheduledAt(r).getTime() || 0)));
    } else {
      if (!mongoose.isValidObjectId(rideId)) return res.status(400).json({ error: 'Choose a ride to share.' });
      ride = await Ride.findById(rideId);
      if (!ride) return res.status(404).json({ error: 'Ride not found.' });
      if (String(ride.own) === req.user.id) return res.status(403).json({ error: 'Drivers cannot share live tracking. Only passengers can share their trip.' });
      booking = await Booking.findOne({ rid: String(ride._id), pid: req.user.id, st: { $in: ['confirmed', 'pending'] } }).sort({ createdAt: -1 });
      if (!booking) return res.status(403).json({ error: 'Only a rider on this trip can share it.' });
      if (['completed', 'cancelled'].includes(ride.status) || booking.tripCompletedAt) return res.status(409).json({ error: 'This trip has already ended.' });
      // a leg that belongs to a multi-vehicle journey is shared through the journey link, never on its own
      if (booking.journeyId) return res.status(409).json({ error: 'This ride is one leg of a multi-vehicle journey. Share the whole journey instead.', journeyId: booking.journeyId });
      expiryBase = ride.completedAt ? new Date(ride.completedAt) : new Date(Math.max(Date.now(), scheduledAt(ride).getTime() || 0));
    }

    // sharing the same trip with the same phone number again returns the existing link instead of a second one
    const same = { uid: req.user.id, journeyId: jId, rideId: String(ride._id), revoked: false, expiresAt: { $gt: new Date() } };
    const last10 = p => String(p || '').replace(/\D/g, '').slice(-10);
    if (phone) { const dup = (await TripShare.find({ ...same }).lean()).find(x => last10(x.contactPhone) && last10(x.contactPhone) === last10(phone)); if (dup) return res.status(200).json({ id: String(dup._id), token: dup.token, contactName: dup.contactName, contactPhone: dup.contactPhone, journeyId: jId, expiresAt: dup.expiresAt, reused: true }); }

    const share = await TripShare.create({
      token: crypto.randomBytes(18).toString('hex'), uid: req.user.id, sharedBy: req.user.name,
      rideId: String(ride._id), bookingId: booking ? String(booking._id) : String(bookingId || ''), journeyId: jId,
      contactName: name, contactPhone: phone, expiresAt: new Date(expiryBase.getTime() + 12 * 3600 * 1000)
    });
    res.status(201).json({ id: String(share._id), token: share.token, contactName: share.contactName, contactPhone: share.contactPhone, journeyId: jId, expiresAt: share.expiresAt });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create the tracking link.' }); }
});

router.get('/shares', async (req, res) => {
  const list = await TripShare.find({ uid: req.user.id, revoked: false, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(20).lean();
  res.json(list.map(s => ({ id: String(s._id), token: s.token, rideId: s.rideId, journeyId: s.journeyId || '', contactName: s.contactName, contactPhone: s.contactPhone || '', expiresAt: s.expiresAt, views: s.views, lastViewedAt: s.lastViewedAt })));
});

router.delete('/shares/:id', async (req, res) => {
  const r = await TripShare.updateOne({ _id: req.params.id, uid: req.user.id }, { $set: { revoked: true } });
  res.json({ revoked: r.modifiedCount > 0 });
});

/* Public view of a whole multi-vehicle journey: every leg with its own vehicle, driver and status. */
async function journeyView(share) {
  const bookings = await Booking.find({ journeyId: share.journeyId }).sort({ legIndex: 1 }).lean();
  const rides = await Ride.find({ _id: { $in: bookings.map(b => b.rid).filter(id => mongoose.isValidObjectId(id)) } }).lean();
  const byId = new Map(rides.map(r => [String(r._id), r]));
  const legs = bookings.map((b, i) => {
    const r = byId.get(String(b.rid));
    if (!r) return null;
    const a = r.path.indexOf(b.f), z = r.path.indexOf(b.t), ok = a >= 0 && z > a;
    const path = ok ? r.path.slice(a, z + 1) : r.path;
    let progress = ok ? segmentProgress(r, b) : rideProgress(r);
    const cancelled = ENDED_BOOKING.includes(b.st) || r.status === 'cancelled';
    const done = !cancelled && (!!b.tripCompletedAt || r.status === 'completed' || (r.status === 'active' && progress >= 0.999));
    const status = cancelled ? 'cancelled' : done ? 'completed' : r.status === 'active' ? 'active' : r.status === 'boarding' ? 'boarding' : 'scheduled';
    if (done) progress = 1; else if (status !== 'active') progress = 0;
    return { index: i, vtype: r.vtype || 'car', vehicle: r.veh, driver: String(r.drv || '').split(' ')[0], from: nodeName(path[0]), to: nodeName(path[path.length - 1]), path, km: km(path), status, progress, departure: r.date + ' ' + r.time, duration: Number(r.estimatedDurationMinutes) || 0, ride: r };
  }).filter(Boolean);
  const broken = legs.some(l => l.status === 'cancelled'), allDone = legs.length > 0 && legs.every(l => l.status === 'completed');
  const ended = broken || allDone, current = legs.find(l => l.status !== 'completed') || legs[legs.length - 1];
  const totalKm = legs.reduce((a, l) => a + l.km, 0) || 1;
  const overall = allDone ? 1 : legs.reduce((a, l) => a + l.km * l.progress, 0) / totalKm;
  const fresh = !ended && current && current.ride.location && current.status === 'active' && Date.now() - new Date(current.ride.location.updatedAt) < 90000;
  const endedAt = allDone ? bookings.map(b => b.tripCompletedAt).filter(Boolean).sort().pop() || new Date() : broken ? new Date() : null;
  await TripShare.updateOne({ _id: share._id }, { $inc: { views: 1 }, $set: { lastViewedAt: new Date() } });
  return {
    kind: 'journey', sharedBy: share.sharedBy.split(' ')[0], contactName: share.contactName,
    from: legs.length ? legs[0].from : '', to: legs.length ? legs[legs.length - 1].to : '',
    status: broken ? 'cancelled' : allDone ? 'completed' : legs.some(l => l.status === 'active') ? 'active' : legs.some(l => l.status === 'completed') ? 'active' : 'scheduled',
    ended, endedAt, progress: overall, currentLeg: current ? current.index : 0,
    location: fresh ? { lat: current.ride.location.lat, lng: current.ride.location.lng, updatedAt: current.ride.location.updatedAt } : null,
    etaMinutes: !ended && current && current.status === 'active' && current.duration ? Math.max(0, Math.round(current.duration * (1 - current.progress))) : null,
    legs: legs.map(({ ride, km: k, duration, ...l }) => ({ ...l, km: k })), updatedAt: new Date()
  };
}

/* Public, read-only live view for the person the trip was shared with. */
publicRouter.get('/track/:token', async (req, res) => {
  try {
    const share = await TripShare.findOne({ token: String(req.params.token) });
    if (!share || share.revoked) return res.status(404).json({ error: 'This tracking link is no longer active.' });
    if (share.expiresAt < new Date()) return res.status(410).json({ error: 'This tracking link has expired.' });
    if (share.journeyId) return res.json(await journeyView(share));
    const ride = await Ride.findById(share.rideId).lean();
    if (!ride) return res.status(404).json({ error: 'This trip is no longer available.' });
    const booking = share.bookingId && mongoose.isValidObjectId(share.bookingId) ? await Booking.findById(share.bookingId).lean() : null;
    const segment = booking && ride.path.indexOf(booking.f) >= 0 && ride.path.indexOf(booking.t) > ride.path.indexOf(booking.f);
    const path = segment ? ride.path.slice(ride.path.indexOf(booking.f), ride.path.indexOf(booking.t) + 1) : ride.path;
    const progress = segment ? segmentProgress(ride, booking) : rideProgress(ride);
    const cancelled = ride.status === 'cancelled';
    const ended = cancelled || ride.status === 'completed' || !!(booking && booking.tripCompletedAt) || (segment && ride.status === 'active' && progress >= 0.999);
    const status = cancelled ? 'cancelled' : ended ? 'completed' : ride.status;
    const fresh = !ended && ride.location && Date.now() - new Date(ride.location.updatedAt) < 90000 && ride.status === 'active';
    const duration = Number(ride.estimatedDurationMinutes) || 0;
    const endedAt = ended ? ((booking && booking.tripCompletedAt) || ride.completedAt || ride.cancelledAt || new Date()) : null;
    await TripShare.updateOne({ _id: share._id }, { $inc: { views: 1 }, $set: { lastViewedAt: new Date() } });
    res.json({
      sharedBy: share.sharedBy.split(' ')[0], contactName: share.contactName,
      status, ended, endedAt, path, from: nodeName(path[0]), to: nodeName(path[path.length - 1]),
      progress: ended && !cancelled ? 1 : progress, location: fresh ? { lat: ride.location.lat, lng: ride.location.lng, updatedAt: ride.location.updatedAt } : null,
      driver: String(ride.drv || '').split(' ')[0], vehicle: ride.veh, vtype: ride.vtype || 'car',
      etaMinutes: !ended && ride.status === 'active' && duration ? Math.max(0, Math.round(duration * (1 - progress))) : null,
      departure: ride.date + ' ' + ride.time, updatedAt: new Date()
    });
  } catch (e) { res.status(500).json({ error: 'Failed to load the trip.' }); }
});

module.exports = { router, publicRouter };
