const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticateToken, createAccessToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, car } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Password must be at least 6 characters and no more than 72 UTF-8 bytes.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      password: await bcrypt.hash(password, 12),
      role: 'user',
      car: car ? { m: car.trim(), st: 'pending' } : null
    });

    await newUser.save();
    const user = {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      car: newUser.car,
      rating: newUser.rating,
      ec: newUser.ec
    };
    res.status(201).json({
      message: 'Account created successfully in MongoDB',
      token: createAccessToken(newUser),
      user
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error while registering user.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, asAdmin } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const isHashed = /^\$2[aby]\$/.test(user.password);
    const passwordMatches = isHashed
      ? await bcrypt.compare(password, user.password)
      : user.password === password;
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!isHashed) {
      user.password = await bcrypt.hash(password, 12);
      await user.save();
    }
    if (user.blocked) {
      return res.status(403).json({ error: 'This account has been suspended by administration.' });
    }
    if (asAdmin && user.role !== 'admin') {
      return res.status(403).json({ error: 'This credential does not have administrative access.' });
    }
    if (!asAdmin && user.role === 'admin') {
      return res.status(403).json({ error: 'Admins must switch to the Admin Portal tab.' });
    }

    res.json({
      message: 'Login successful via MongoDB',
      token: createAccessToken(user),
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        car: user.car,
        rating: user.rating,
        ec: user.ec,
        blocked: user.blocked
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user || user.blocked) {
      return res.status(401).json({ error: 'Account is unavailable. Please sign in again.' });
    }
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        car: user.car,
        rating: user.rating,
        ec: user.ec,
        blocked: user.blocked
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore session.' });
  }
});

module.exports = router;