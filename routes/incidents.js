const express = require('express');
const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const incidentTypes = ['medical', 'collision', 'unsafe', 'vehicle', 'other'];
const resolutions = ['emergency-services-contacted', 'roadside-assistance-dispatched', 'user-safe', 'false-alarm', 'other'];

router.get('/incidents', requireAdmin, async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emergency reports.' });
  }
});

router.get('/incidents/mine', async (req, res) => {
  try {
    const ownedRideIds = await Ride.find({ own: req.user.id }).distinct('_id');
    const incidents = await Incident.find({
      $or: [
        { uid: req.user.id },
        { rideId: { $in: ownedRideIds.map(String) } }
      ]
    }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emergency updates.' });
  }
});

router.post('/incidents', async (req, res) => {
  try {
    const { type, details, location = '', rideId = '' } = req.body;
    if (!incidentTypes.includes(type) || typeof details !== 'string' || !details.trim() || details.trim().length > 1000) {
      return res.status(400).json({ error: 'Choose an emergency type and provide details (up to 1000 characters).' });
    }
    if (typeof location !== 'string' || location.length > 300) {
      return res.status(400).json({ error: 'Location must be 300 characters or fewer.' });
    }
    let rideRoute = '';
    if (rideId) {
      if (!mongoose.isValidObjectId(rideId)) return res.status(400).json({ error: 'Invalid ride reference.' });
      const ride = await Ride.findById(rideId).select('own path');
      if (!ride) return res.status(404).json({ error: 'The linked ride was not found.' });
      const isDriver = String(ride.own) === req.user.id;
      const isPassenger = await Booking.exists({ rid: String(ride._id), pid: req.user.id, st: 'confirmed' });
      if (!isDriver && !isPassenger) return res.status(403).json({ error: 'You must be part of the linked ride.' });
      rideRoute = ride.path.join(' to ');
    }
    const incident = await Incident.create({
      uid: req.user.id,
      by: req.user.name,
      rideId,
      rideRoute,
      type,
      details: details.trim(),
      location: location.trim()
    });
    res.status(201).json(incident);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send emergency report.' });
  }
});

router.put('/incidents/:id', requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid report id.' });
    const { resolution, resolutionNote = '' } = req.body;
    if (!resolutions.includes(resolution) || typeof resolutionNote !== 'string' || resolutionNote.length > 1000) {
      return res.status(400).json({ error: 'Choose a resolution and keep notes under 1000 characters.' });
    }
    const incident = await Incident.findByIdAndUpdate(req.params.id, {
      $set: {
        status: 'resolved',
        resolution,
        resolutionNote: resolutionNote.trim(),
        resolvedBy: req.user.name,
        resolvedAt: new Date()
      }
    }, { new: true, runValidators: true });
    if (!incident) return res.status(404).json({ error: 'Emergency report not found.' });
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve emergency report.' });
  }
});

module.exports = router;
