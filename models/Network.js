const mongoose = require('mongoose');

/* Private mobility community for a college or company. Only verified members can see and book its rides. */
const memberSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  name: { type: String, default: '' },
  orgEmail: { type: String, default: '' },
  idNumber: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  method: { type: String, enum: ['domain+code', 'manual'], default: 'manual' },
  domainMatch: { type: Boolean, default: false },
  codeValid: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
  decidedAt: { type: Date, default: null }
}, { _id: false });

const networkSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  kind: { type: String, enum: ['college', 'company'], default: 'college' },
  domain: { type: String, default: '', lowercase: true, trim: true },   // e.g. uvce.ac.in
  inviteCode: { type: String, required: true },
  description: { type: String, default: '', maxlength: 300 },
  createdBy: { type: String, required: true },
  members: [memberSchema],
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Network', networkSchema);
