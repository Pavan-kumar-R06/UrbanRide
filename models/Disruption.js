const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  a: { type: String, required: true },
  b: { type: String, required: true },
  kind: { type: String, enum: ['closure', 'traffic', 'accident', 'weather', 'cancellation'], default: 'closure' },
  reason: { type: String, default: '', maxlength: 300 },
  source: { type: String, enum: ['admin', 'traffic-feed'], default: 'admin' },
  active: { type: Boolean, default: true },
  createdBy: { type: String, default: '' },
  impactedBookings: [{ _id: false, bookingId: String, uid: String, rideId: String }],
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null }
});
module.exports = mongoose.model('Disruption', schema);
