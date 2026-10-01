const express = require('express');
const User = require('../models/User');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};

    if (typeof req.body.blocked === 'boolean') {
      updates.blocked = req.body.blocked;
    }

    if (req.body.car && typeof req.body.car === 'object') {
      updates.car = req.body.car;
    }

    if (typeof req.body.rating === 'number') {
      updates.rating = req.body.rating;
    }

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

module.exports = router;