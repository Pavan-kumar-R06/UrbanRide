const express = require('express');
const User = require('../models/User');
const wallet = require('../services/wallet');
const { serviceFeeFor } = require('../services/vehicles');
const { notifyUser } = require('../services/notify');
const router = express.Router();

/* Driver pays the service fee from their wallet; the vehicle goes back to Active. */
router.post('/vehicle/service', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.car || user.car.maintenance !== 'due') return res.status(409).json({ error: 'Your vehicle is not due for service.' });
    const fee = serviceFeeFor(user.car.type);
    if ((user.walletBalance || 0) < fee) return res.status(402).json({ error: `Service costs ₹${fee} but your wallet has ₹${user.walletBalance || 0}. Top up your Mobility Wallet first.` });
    // claim the state change first so a double click cannot charge twice
    const claimed = await User.findOneAndUpdate({ _id: user._id, 'car.maintenance': 'due' }, { $set: { 'car.maintenance': 'active', 'car.lastServiceAt': new Date() } }, { new: true });
    if (!claimed) return res.status(409).json({ error: 'Service was already completed.' });
    await wallet.post({ uid: user._id, type: 'service_fee', amount: -fee, note: `Vehicle service fee (${user.car.m})` });
    await wallet.post({ uid: 'platform', type: 'service_fee', amount: fee, note: `Service fee from ${user.name}` });
    res.json({ maintenance: 'active', fee, car: claimed.car });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Service payment failed.' }); }
});

/* Driver asks an admin to reactivate an inactive vehicle. */
router.post('/vehicle/reactivate', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.car || user.car.maintenance !== 'inactive') return res.status(409).json({ error: 'Your vehicle is not inactive.' });
    if (user.car.reactivationRequested) return res.status(409).json({ error: 'A reactivation request is already waiting for an admin.' });
    user.car.reactivationRequested = true; await user.save();
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    await Promise.all(admins.map(a => notifyUser(String(a._id), `${user.name} asked to reactivate ${user.car.m}.`, 'Vehicle', 'ver')));
    res.json({ reactivationRequested: true });
  } catch (e) { res.status(500).json({ error: 'Could not send the request.' }); }
});
module.exports = router;
