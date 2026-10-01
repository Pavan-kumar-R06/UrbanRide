const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');
const hasActiveJourney = require('../middleware/active-journey');

const router = express.Router();

router.get('/bookings', async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      const ownedRides = await Ride.find({ own: req.user.id }).select('_id').lean();
      query = {
        $or: [
          { pid: req.user.id },
          { rid: { $in: ownedRides.map(ride => String(ride._id)) } }
        ]
      };
    }
    const bookings = await Booking.find(query).sort({ createdAt: -1 }).limit(100);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

router.post('/bookings', async (req, res) => {
  let reservedRideId;
  try {
    const { rid, f, t, seats = 1, fare = 0 } = req.body;
    const passenger = await User.findById(req.user.id).select('name blocked');
    if (!passenger || passenger.blocked) return res.status(403).json({ error: 'This account cannot book rides.' });
    if (await hasActiveJourney(req.user.id)) {
      return res.status(409).json({ error: 'Complete your current trip before booking another ride.' });
    }
    if (!rid || !f || !t || !Number.isInteger(Number(seats)) || Number(seats) < 1) {
      return res.status(400).json({ error: 'Ride, passenger, route, and a positive seat count are required.' });
    }

    if (mongoose.isValidObjectId(rid)) {
      const candidateRide = await Ride.findById(rid).select('status');
      if (!candidateRide) return res.status(404).json({ error: 'Ride not found.' });
      if (candidateRide.status !== 'scheduled') return res.status(409).json({ error: 'This ride is not accepting bookings.' });
      const ride = await Ride.findOneAndUpdate(
        { _id: rid, status: 'scheduled', seats: { $gte: Number(seats) } },
        { $inc: { seats: -Number(seats) } },
        { new: true }
      );
      if (!ride) {
        const exists = await Ride.exists({ _id: rid });
        return res.status(exists ? 409 : 404).json({ error: exists ? 'Not enough seats remain.' : 'Ride not found.' });
      }
      reservedRideId = ride._id;
    }

    const booking = await Booking.create({ rid: String(rid), pid: req.user.id, pn: passenger.name, f, t, seats: Number(seats), fare, st: 'pending' });
    res.status(201).json(booking);
  } catch (err) {
    if (reservedRideId) await Ride.updateOne({ _id: reservedRideId }, { $inc: { seats: Number(req.body.seats || 1) } });
    console.error('Booking creation error:', err);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
});

router.put('/bookings/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking id.' });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const { st, rated } = req.body;
    const ride = mongoose.isValidObjectId(booking.rid) ? await Ride.findById(booking.rid).select('own status') : null;
    const isAdmin = req.user.role === 'admin';
    const isPassenger = booking.pid === req.user.id;
    const isDriver = ride && String(ride.own) === req.user.id;
    if (!isAdmin && !isPassenger && !isDriver) {
      return res.status(403).json({ error: 'You cannot update this booking.' });
    }
    if (!isAdmin && isPassenger && st !== undefined && st !== 'cancelled') {
      return res.status(403).json({ error: 'Passengers may only cancel their own booking.' });
    }
    if (!isAdmin && isDriver && rated !== undefined) {
      return res.status(403).json({ error: 'Only the passenger may rate this booking.' });
    }
    if (st !== undefined && !['confirmed', 'rejected', 'cancelled', 'ride-cancelled'].includes(st)) {
      return res.status(400).json({ error: 'Invalid booking status.' });
    }
    if (rated !== undefined && (!Number.isInteger(rated) || rated < 1 || rated > 5 || !isPassenger || ride?.status !== 'completed')) {
      return res.status(400).json({ error: 'A rating from 1 to 5 can be submitted by the passenger after ride completion.' });
    }
    const releaseSeats = st && ['cancelled', 'rejected', 'ride-cancelled'].includes(st) && !['cancelled', 'rejected', 'ride-cancelled'].includes(booking.st);
    if (st !== undefined) booking.st = st;
    if (rated !== undefined) booking.rated = rated;
    await booking.save();

    if (releaseSeats && ride && mongoose.isValidObjectId(booking.rid)) {
      await Ride.updateOne({ _id: booking.rid }, { $inc: { seats: booking.seats } });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking.' });
  }
});

module.exports = router;