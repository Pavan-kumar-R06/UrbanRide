const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number, default: null },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const rideSchema = new mongoose.Schema({
  own: { type: String, default: null },
  drv: { type: String, required: true },
  veh: { type: String, default: 'Sedan' },
  path: [{ type: String }],
  time: { type: String, required: true },
  date: { type: String, required: true },
  cap: { type: Number, default: 4 },
  seats: { type: Number, default: 3 },
  rate: { type: Number, default: 8 },
  status: { type: String, default: 'scheduled' },
  prog: { type: Number, default: 0 },
  location: { type: locationSchema, default: undefined },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  estimatedDurationMinutes: { type: Number, default: null },
  rt: { type: Number, default: 4.8 },
  pf: [{ type: String }],
  rep: { type: String, default: 'Once' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ride', rideSchema);
