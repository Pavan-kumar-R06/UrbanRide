const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  car: {
    m: { type: String, default: null },
    st: { type: String, default: 'pending' },
    type: { type: String, enum: ['car', 'bike', 'scooter'], default: 'car' },
    make: { type: String, default: '' },
    model: { type: String, default: '' },
    reg: { type: String, default: '' },
    year: { type: Number, default: null },
    color: { type: String, default: '' },
    maintenance: { type: String, enum: ['active', 'due', 'inactive'], default: 'active' },
    lastServiceAt: { type: Date, default: null },
    reactivationRequested: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verifiedUntil: { type: Date, default: null }
  },
  rating: { type: Number, default: 4.8 },
  ec: { type: String, default: '' },
  blocked: { type: Boolean, default: false },
  walletBalance: { type: Number, default: 0 },
  trustedContacts: [{ _id: false, name: { type: String, maxlength: 60 }, phone: { type: String, maxlength: 20 } }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
