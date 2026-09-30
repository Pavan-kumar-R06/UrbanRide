require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');

const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://pavankumar060905_db_user:PavaN@cluster0.yruwyei.mongodb.net/?appName=Cluster0';

app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Seed default accounts if database is fresh
async function seedDefaultUsers() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      const adminPassword = await bcrypt.hash('admin123', 12);
      const demoPassword = await bcrypt.hash('demo123', 12);
      console.log('🌱 Seeding initial demo users into MongoDB...');
      await User.insertMany([
        {
          name: 'Platform Admin',
          email: 'admin@urbanmobility.com',
          password: adminPassword,
          role: 'admin',
          rating: 5.0
        },
        {
          name: 'Aarav Sharma',
          email: 'aarav@demo.com',
          password: demoPassword,
          role: 'user',
          rating: 4.7,
          ec: '9876543210'
        },
        {
          name: 'Meera K.',
          email: 'meera@demo.com',
          password: demoPassword,
          role: 'user',
          rating: 4.8,
          car: { m: 'Honda City · KA01 AB 1234', st: 'approved' },
          ec: '9123456780'
        },
        {
          name: 'Riya Nair',
          email: 'riya@demo.com',
          password: demoPassword,
          role: 'user',
          rating: 4.9
        }
      ]);
      console.log('✅ Demo users seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding demo users:', err.message);
  }
}

async function migratePlaintextPasswords() {
  const legacyUsers = await User.find({ password: { $not: /^\$2[aby]\$/ } }).select('+password');
  for (const user of legacyUsers) {
    user.password = await bcrypt.hash(user.password, 12);
    await user.save();
  }
}

let connectionPromise;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
      .then(async () => {
        console.log('Connected to MongoDB.');
        await seedDefaultUsers();
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
    console.error('MongoDB connection error:', err.message);
    res.status(503).json({ error: 'Database unavailable.' });
  }
});
app.use('/api', require('./routes'));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌐 UrbanRide server running with MongoDB support at http://localhost:${PORT}`);
  });
  connectToDatabase().catch((err) => {
    console.error('MongoDB connection error:', err.message);
  });
}

module.exports = app;
