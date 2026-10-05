const mongoose = require('mongoose');

/* Every money movement is one row. amount > 0 = money in for `uid`, amount < 0 = money out.
   The platform's own income (fees) is recorded against uid = 'platform'. */
const walletTxnSchema = new mongoose.Schema({
  uid: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['topup', 'ride_hold', 'ride_payment', 'earning', 'refund', 'credit', 'cancellation_fee', 'cancellation_compensation', 'platform_fee', 'service_fee', 'adjustment'] },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, default: null },
  rideId: { type: String, default: '' },
  bookingId: { type: String, default: '', index: true },
  journeyId: { type: String, default: '' },
  note: { type: String, default: '', maxlength: 300 },
  createdAt: { type: Date, default: Date.now }
});
walletTxnSchema.index({ uid: 1, createdAt: -1 });
module.exports = mongoose.model('WalletTxn', walletTxnSchema);
