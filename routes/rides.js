const express = require('express');
const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Message = require('../models/Message');

const router = express.Router();

router.get('/rides', async (req, res) => {
  try {
    const rides = await Ride.find().sort({ createdAt: -1 }).limit(100);
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rides.' });
  }
});

router.post('/rides', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name car blocked');
    if (!user || user.blocked) return res.status(403).json({ error: 'This account cannot publish rides.' });
    if (!user.car || user.car.st !== 'approved') {
      return res.status(403).json({ error: 'Your vehicle has not been verified by an administrator yet.' });
    }
    const fields = ['path', 'time', 'date', 'cap', 'seats', 'rate', 'pf', 'rep', 'note'];
    const rideData = Object.fromEntries(fields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]]));
    const ride = new Ride({
      ...rideData,
      own: req.user.id,
      drv: user.name,
      veh: user.car.m
    });
    await ride.save();
    res.status(201).json(ride);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ride.' });
  }
});

router.put('/rides/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ride id.' });
    }
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found.' });
    if (req.user.role !== 'admin' && String(ride.own) !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own rides.' });
    }
    const fields = ['status', 'prog', 'rt'];
    const updates = Object.fromEntries(fields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]]));
    Object.assign(ride, updates);
    await ride.save();
    res.json(ride);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ride.' });
  }
});

router.delete('/rides/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ride id.' });
    const ride = await Ride.findById(req.params.id).select('_id');
    if (!ride) return res.status(404).json({ error: 'Ride not found.' });
    const rideId = String(ride._id);
    await Promise.all([
      Booking.deleteMany({ rid: rideId }),
      Message.deleteMany({ rid: rideId }),
      Ride.deleteOne({ _id: ride._id })
    ]);
    res.json({ deleted: true, rideId });
  } catch (err) {
    console.error('Ride deletion error:', err);
    res.status(500).json({ error: 'Failed to delete ride and related records.' });
  }
});

module.exports = router;