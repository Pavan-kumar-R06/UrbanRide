const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  uid: { type: String, required: true, index: true },
  t: { type: String, required: true, maxlength: 500 },
  from: { type: String, default: 'System' },
  go: { type: String, default: 'notif' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ uid: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', schema);
