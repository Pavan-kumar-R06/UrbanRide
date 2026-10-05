const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const TripShare = require('../models/TripShare');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const { rideProgress, segmentProgress } = require('../services/progress');
const { scheduledAt, nodeName } = require('../services/city-graph');

const router = express.Router();          // authenticated
const publicRouter = express.Router();    // no login: the secret token is the credential

router.post('/shares', async (req, res) => {
  try {
    const { rideId, bookingId = '', contactName = '', contactPhone = '' } = req.body;
    if (!mongoose.isValidObjectId(rideId)) return res.status(400).json({ error: 'Choose a ride to share.' });
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found.' });
    if (String(ride.own) === req.user.id) return res.status(403).json({ error: 'Drivers cannot share live tracking. Only passengers can share their trip.' });
    const booking = await Booking.findOne({ rid: String(ride._id), pid: req.user.id, st: { $in: ['confirmed', 'pending'] } }).sort({ createdAt: -1 });
    if (!booking) return res.status(403).json({ error: 'Only a rider on this trip can share it.' });
    if (['completed', 'cancelled'].includes(ride.status) || booking.tripCompletedAt) return res.status(409).json({ error: 'This trip has already ended.' });
    const base = ride.completedAt ? new Date(ride.completedAt) : new Date(Math.max(Date.now(), scheduledAt(ride).getTime() || 0));
    const share = await TripShare.create({
      token: crypto.randomBytes(18).toString('hex'), uid: req.user.id, sharedBy: req.user.name,
      rideId: String(ride._id), bookingId: booking ? String(booking._id) : String(bookingId || ''),
      contactName: String(contactName).trim().slice(0, 60), contactPhone: String(contactPhone).replace(/[^0-9+]/g, '').slice(0, 20), expiresAt: new Date(base.getTime() + 12 * 3600 * 1000)
    });
    res.status(201).json({ id: String(share._id), token: share.token, contactName: share.contactName, contactPhone: share.contactPhone, expiresAt: share.expiresAt });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create the tracking link.' }); }
});

router.get('/shares', async (req, res) => {
  const list = await TripShare.find({ uid: req.user.id, revoked: false, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(20).lean();
  res.json(list.map(s => ({ id: String(s._id), token: s.token, rideId: s.rideId, contactName: s.contactName, contactPhone: s.contactPhone || '', expiresAt: s.expiresAt, views: s.views, lastViewedAt: s.lastViewedAt })));
});

router.delete('/shares/:id', async (req, res) => {
  const r = await TripShare.updateOne({ _id: req.params.id, uid: req.user.id }, { $set: { revoked: true } });
  res.json({ revoked: r.modifiedCount > 0 });
});

/* Public, read-only live view for the person the trip was shared with. */
publicRouter.get('/track/:token', async (req, res) => {
  try {
    const share = await TripShare.findOne({ token: String(req.params.token) });
    if (!share || share.revoked) return res.status(404).json({ error: 'This tracking link is no longer active.' });
    if (share.expiresAt < new Date()) return res.status(410).json({ error: 'This tracking link has expired.' });
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
