const mongoose = require('mongoose');
/* A revocable, read-only live-tracking link that a rider/driver shares with someone they know. */
const schema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  uid: { type: String, required: true, index: true },
  sharedBy: { type: String, required: true },
  rideId: { type: String, required: true },
  bookingId: { type: String, default: '' },
  contactName: { type: String, default: '', maxlength: 60 },
  contactPhone: { type: String, default: '', maxlength: 20 },
  revoked: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  views: { type: Number, default: 0 },
  lastViewedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('TripShare', schema);
