const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  rid: { type: String, required: true, index: true },
  uid: { type: String, required: true },
  n: { type: String, required: true },
  t: { type: String, required: true, maxlength: 2000 },
  tm: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ rid: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);