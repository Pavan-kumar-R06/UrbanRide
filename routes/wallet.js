const express = require('express');
const wallet = require('../services/wallet');
const WalletTxn = require('../models/WalletTxn');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/wallet', async (req, res) => {
  try { const [sum, settings] = await Promise.all([wallet.summary(req.user.id), wallet.getSettings()]); res.json({ ...sum, settings, goodwillCredit: wallet.GOODWILL_CREDIT, lateCancelMinutes: wallet.LATE_CANCEL_MINUTES }); }
  catch (e) { res.status(500).json({ error: 'Failed to load wallet.' }); }
});

/* Simulated top-up: there is no payment gateway wired in, so this only records a ledger entry. */
router.post('/wallet/topup', async (req, res) => {
  try {
    const amount = Math.round(Number(req.body.amount));
    if (!Number.isFinite(amount) || amount < 50 || amount > 10000) return res.status(400).json({ error: 'Top-up must be between ₹50 and ₹10,000.' });
    await wallet.post({ uid: req.user.id, type: 'topup', amount, note: 'Wallet top-up (simulated payment)' });
    res.status(201).json(await wallet.summary(req.user.id));
  } catch (e) { res.status(500).json({ error: 'Top-up failed.' }); }
});

router.get('/wallet/settings', async (req, res) => res.json(await wallet.getSettings()));
router.put('/wallet/settings', requireAdmin, async (req, res) => {
  if (!['start', 'end'].includes(req.body.mode)) return res.status(400).json({ error: 'Mode must be "start" or "end".' });
  res.json(await wallet.setMode(req.body.mode));
});

/* Platform-wide accounting for the admin dashboard */
router.get('/wallet/platform', requireAdmin, async (req, res) => {
  try {
    const rows = await WalletTxn.aggregate([{ $match: { uid: { $ne: 'platform' } } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
    const by = Object.fromEntries(rows.map(r => [r._id, r]));
    const sum = t => (by[t] ? by[t].total : 0);
    res.json({
      topups: sum('topup'), held: -sum('ride_hold'), paidAtEnd: -sum('ride_payment'), driverEarnings: sum('earning') + sum('cancellation_compensation'),
      refunds: sum('refund'), creditsIssued: sum('credit'), lateFees: -sum('cancellation_fee'), serviceFees: -sum('service_fee'), platformFees: sum('platform_fee'), transactions: rows.reduce((a, r) => a + r.count, 0),
      recent: (await WalletTxn.find().sort({ createdAt: -1 }).limit(10).lean()).map(t => ({ ...t, id: String(t._id), _id: String(t._id) }))
    });
  } catch (e) { res.status(500).json({ error: 'Failed to load platform ledger.' }); }
});
module.exports = router;
