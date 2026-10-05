const mongoose = require('mongoose');
/* One continuous passenger journey that may change vehicles (ride transformation). */
const schema = new mongoose.Schema({
  uid: { type: String, required: true, index: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  seats: { type: Number, default: 1 },
  legs: [{ _id: false, bookingId: String, rideId: String, f: String, t: String, vtype: String, fare: Number, fee: Number, waitMinutes: { type: Number, default: 0 } }],
  dna: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Journey', schema);
