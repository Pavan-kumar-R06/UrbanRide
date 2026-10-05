const mongoose = require('mongoose');
/* One row each time a passenger searches for a ride: where/when they want to go, and whether supply existed. */
const schema = new mongoose.Schema({
  uid: { type: String, required: true },
  f: { type: String, required: true },
  t: { type: String, required: true },
  hour: { type: Number, min: 0, max: 23, required: true },
  vtype: { type: String, default: 'all' },
  seats: { type: Number, default: 1 },
  results: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: { expireAfterSeconds: 90 * 86400 } }
});
module.exports = mongoose.model('DemandSignal', schema);
