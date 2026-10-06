const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  rid: { type: String, required: true },
  pid: { type: String, required: true },
  pn: { type: String, required: true },
  f: { type: String, required: true },
  t: { type: String, required: true },
  seats: { type: Number, default: 1 },
  fare: { type: Number, default: 0 },
  fee: { type: Number, default: 0 },
  st: { type: String, default: 'pending' },
  journeyId: { type: String, default: null, index: true },
  legIndex: { type: Number, default: 0 },
  paymentState: { type: String, enum: ['none', 'held', 'settled', 'refunded'], default: 'none' },
  paymentMode: { type: String, enum: ['start', 'end'], default: 'start' },
  paidAmount: { type: Number, default: 0 },
  handoverAt: { type: Date, default: null },
  decidedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelledAfterConfirm: { type: Boolean, default: false },
  cancelFee: { type: Number, default: 0 },
  disruption: { type: { _id: false, id: String, reason: String, at: Date }, default: null },
  tripCompletedAt: { type: Date, default: null },
  rated: { type: Number, min: 1, max: 5, default: null },
  createdAt: { type: Date, default: Date.now }
});

bookingSchema.index({ pid: 1, createdAt: -1 });
bookingSchema.index({ rid: 1 });
module.exports = mongoose.model('Booking', bookingSchema);