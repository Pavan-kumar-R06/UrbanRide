const express = require('express');
const Notification = require('../models/Notification');
const router = express.Router();

router.get('/notifications', async (req, res) => {
  try {
    const list = await Notification.find({ uid: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(list.map(n => ({ ...n, id: String(n._id), _id: String(n._id) })));
  } catch (e) { res.status(500).json({ error: 'Failed to load notifications.' }); }
});
router.put('/notifications/read', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : null;
    await Notification.updateMany({ uid: req.user.id, ...(ids ? { _id: { $in: ids } } : {}) }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed to update notifications.' }); }
});
module.exports = router;
