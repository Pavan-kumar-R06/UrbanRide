const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const { requireAdmin } = require('../middleware/auth');
const { normalizeVehicle, MAINTENANCE } = require('../services/vehicles');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(100);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && req.params.id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own vehicle details.' });
    }
    const updates = {};

    if (isAdmin && typeof req.body.blocked === 'boolean') {
      updates.blocked = req.body.blocked;
    }

    if (req.body.car && typeof req.body.car === 'object') {
      const body = req.body.car;
      if (isAdmin) {
        const target = await User.findById(req.params.id).select('car');
        if (!target) return res.status(404).json({ error: 'User not found.' });
        const cur = target.car && target.car.toObject ? target.car.toObject() : (target.car || {});
        const merged = normalizeVehicle({ ...cur, ...body }) || {};
        merged.st = ['pending', 'approved', 'rejected'].includes(body.st) ? body.st : (cur.st || 'pending');
        merged.maintenance = MAINTENANCE.includes(body.maintenance) ? body.maintenance : (cur.maintenance || 'active');
        merged.lastServiceAt = cur.lastServiceAt || null;
        merged.reactivationRequested = merged.maintenance === 'inactive' ? !!cur.reactivationRequested : false;
        if (merged.maintenance !== (cur.maintenance || 'active')) {
          const { notifyUser } = require('../services/notify'), { serviceFeeFor } = require('../services/vehicles');
          const msg = { active: 'Your vehicle is active again. You can publish rides.', due: `Your vehicle is due for service. Pay the ₹${serviceFeeFor(merged.type)} service fee in Offer a ride to continue publishing.`, inactive: 'Your vehicle was marked inactive. Request reactivation in Offer a ride.' }[merged.maintenance];
          await notifyUser(req.params.id, msg, 'Vehicle', 'offer');
        }
        merged.verifiedAt = cur.verifiedAt || null;
        merged.verifiedUntil = cur.verifiedUntil || null;
        if (merged.st === 'approved' && cur.st !== 'approved') {
          merged.verifiedAt = new Date();
          merged.verifiedUntil = new Date(Date.now() + 365 * 864e5);
        }
        updates.car = merged;
      } else {
        const vehicle = normalizeVehicle(body);
        if (!vehicle) return res.status(400).json({ error: 'Vehicle model and registration are required.' });
        const prev = await User.findById(req.params.id).select('car');
        const same = prev && prev.car && prev.car.reg && prev.car.reg === vehicle.reg;
        updates.car = { ...vehicle, st: 'pending', maintenance: same ? (prev.car.maintenance || 'active') : 'active', lastServiceAt: same ? prev.car.lastServiceAt : null, reactivationRequested: same ? !!prev.car.reactivationRequested : false };
      }
    }

    if (!isAdmin && Array.isArray(req.body.trustedContacts)) {
      updates.trustedContacts = req.body.trustedContacts.slice(0, 5)
        .map(c => ({ name: String((c && c.name) || '').trim().slice(0, 60), phone: String((c && c.phone) || '').trim().slice(0, 20) }))
        .filter(c => c.name && c.phone);
    }

    if (isAdmin && typeof req.body.rating === 'number') {
      updates.rating = req.body.rating;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No permitted user details were provided.' });

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(updated);

  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    const user = await User.findById(req.params.id).select('_id role');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be deleted here.' });
    const ownedRides = await Ride.find({ own: req.params.id }).select('_id').lean();
    const rideIds = ownedRides.map(ride => String(ride._id));
    await Promise.all([
      Ride.deleteMany({ own: req.params.id }),
      Booking.deleteMany({ $or: [{ pid: req.params.id }, { rid: { $in: rideIds } }] }),
      Message.deleteMany({ rid: { $in: rideIds } }),
      User.deleteOne({ _id: req.params.id })
    ]);
    res.json({ deleted: true, rideIds });
  } catch (err) {
    console.error('User deletion error:', err);
    res.status(500).json({ error: 'Failed to delete user and related records.' });
  }
});

module.exports = router;