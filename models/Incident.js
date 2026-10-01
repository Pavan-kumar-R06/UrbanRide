const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  uid: { type: String, required: true, index: true },
  by: { type: String, required: true },
  rideId: { type: String, default: '' },
  rideRoute: { type: String, default: '' },
  type: { type: String, enum: ['medical', 'collision', 'unsafe', 'vehicle', 'other'], required: true },
  details: { type: String, required: true, maxlength: 1000 },
  location: { type: String, default: '', maxlength: 300 },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  resolution: { type: String, enum: ['emergency-services-contacted', 'roadside-assistance-dispatched', 'user-safe', 'false-alarm', 'other', ''], default: '' },
  resolutionNote: { type: String, default: '', maxlength: 1000 },
  resolvedBy: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Incident', incidentSchema);
