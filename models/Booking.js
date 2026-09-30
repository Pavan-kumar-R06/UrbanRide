const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  rid: { type: String, required: true },
  pid: { type: String, required: true },
  pn: { type: String, required: true },
  f: { type: String, required: true },
  t: { type: String, required: true },
  seats: { type: Number, default: 1 },
  fare: { type: Number, default: 0 },
  st: { type: String, default: 'pending' },
  rated: { type: Number, min: 1, max: 5, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
