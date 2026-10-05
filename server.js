require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Ride = require('./models/Ride');
const Booking = require('./models/Booking');
const Message = require('./models/Message');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27017/urbanride');

app.use(cors());
app.use(express.json());
const DIST = path.join(__dirname, 'client', 'dist');

async function migratePlaintextPasswords() {
  const legacyUsers = await User.find({ password: { $not: /^\$2[aby]\$/ } }).select('+password');
  for (const user of legacyUsers) {
    user.password = await bcrypt.hash(user.password, 12);
    await user.save();
  }
}

async function removeLegacyDemoData() {
  const migrations = mongoose.connection.collection('urbanride_migrations');
  const migrationId = 'remove-seeded-demo-accounts-v1';
  if (await migrations.findOne({ _id: migrationId })) return;

  const demoUsers = await User.find({ email: { $in: [
    'aarav@demo.com',
    'riya@demo.com',
    'meera@demo.com',
    'admin@urbanmobility.com'
  ] } }).select('_id').lean();
  const userIds = demoUsers.map(user => String(user._id));
  const ownedRides = await Ride.find({ own: { $in: userIds } }).select('_id').lean();
  const rideIds = ownedRides.map(ride => String(ride._id));

  await Promise.all([
    Ride.deleteMany({ _id: { $in: rideIds } }),
    Booking.deleteMany({ $or: [{ pid: { $in: userIds } }, { rid: { $in: rideIds } }] }),
    Message.deleteMany({ rid: { $in: rideIds } }),
    User.deleteMany({ _id: { $in: userIds } })
  ]);
  try {
    await migrations.insertOne({ _id: migrationId, completedAt: new Date() });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

async function ensureConfiguredAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email && !password) return;
  if (!email || password.length < 12) {
    throw new Error('Configure both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.');
  }
  if (await User.exists({ email })) return;
  await User.create({
    name: (process.env.ADMIN_NAME || 'Platform Administrator').trim(),
    email,
    password: await bcrypt.hash(password, 12),
    role: 'admin'
  });
}

let connectionPromise;

async function connectToDatabase() {
  if (!MONGO_URI) throw new Error('MONGO_URI must be configured in the production environment.');
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
      .then(async () => {
        console.log('Data store connected.');
        await removeLegacyDemoData();
        await ensureConfiguredAdmin();
        await migratePlaintextPasswords();
      })
      .catch((err) => {
        connectionPromise = null;
        throw err;
      });
  }
  return connectionPromise;
}

// API routes
app.use('/api', async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('Data store connection error:', err.message);
    res.status(503).json({ error: 'Database unavailable.' });
  }
});
app.use('/api', require('./routes'));

// Serve the React frontend (built into client/dist by `npm run build`)
if (fs.existsSync(DIST)) app.use(express.static(DIST));
app.get('*', (req, res) => {
  const index = path.join(DIST, 'index.html');
  if (!fs.existsSync(index)) {
    return res.status(503).send('UrbanRide frontend has not been built yet. Run "npm run build" (or "npm run dev:client" for development).');
  }
  res.sendFile(index);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`UrbanRide server running at http://localhost:${PORT}`);
  });
  connectToDatabase().catch((err) => {
    console.error('Data store connection error:', err.message);
  });
}

module.exports = app;
