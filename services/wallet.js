/* Mobility Wallet: a simple double-entry style ledger.
   Every movement is a WalletTxn row; User.walletBalance is the running total ($inc, atomic).
   Money for a booking moves in exactly one of two modes (configurable by admin, snapshotted per booking):
     'start' - fare is HELD from the passenger when the driver starts the ride
     'end'   - fare is DEBITED when the ride completes
   In both modes the driver is credited only when the ride completes. */
const User = require('../models/User');
const WalletTxn = require('../models/WalletTxn');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');
const { notifyUser } = require('./notify');

const GOODWILL_CREDIT = 20;       // INR credited to passengers when a driver cancels a confirmed seat
const LATE_CANCEL_MINUTES = 30;   // cancelling a confirmed seat this close to departure costs a fee

async function getSettings() {
  const doc = await Setting.findById('wallet').lean();
  return { mode: doc && ['start', 'end'].includes(doc.value && doc.value.mode) ? doc.value.mode : 'start' };
}
async function setMode(mode) {
  await Setting.findByIdAndUpdate('wallet', { value: { mode } }, { upsert: true });
  return getSettings();
}

async function post({ uid, type, amount, rideId = '', bookingId = '', journeyId = '', note = '' }) {
  amount = Math.round(Number(amount));
  if (!amount) return null;
  let balanceAfter = null;
  if (uid !== 'platform') {
    const u = await User.findByIdAndUpdate(uid, { $inc: { walletBalance: amount } }, { new: true });
    if (!u) return null;
    balanceAfter = u.walletBalance;
  }
  return WalletTxn.create({ uid: String(uid), type, amount, balanceAfter, rideId: String(rideId), bookingId: String(bookingId), journeyId, note });
}

const totalOf = b => Number(b.fare || 0) + Number(b.fee || 0);

/* Ride started: hold funds for 'start'-mode bookings. */
async function onRideStart(ride) {
  const rideId = String(ride._id);
  const list = await Booking.find({ rid: rideId, st: 'confirmed', paymentState: 'none', paymentMode: 'start' });
  for (const b of list) {
    const won = await Booking.findOneAndUpdate({ _id: b._id, paymentState: 'none' }, { $set: { paymentState: 'held', paidAmount: totalOf(b) } });
    if (!won) continue;
    await post({ uid: b.pid, type: 'ride_hold', amount: -totalOf(b), rideId, bookingId: b._id, journeyId: b.journeyId || '', note: `Held for ride ${ride.path[0]} → ${ride.path[ride.path.length - 1]} (released to driver on completion)` });
  }
}

/* Ride completed: settle everything exactly once. */
async function onRideComplete(ride) {
  const rideId = String(ride._id);
  const list = await Booking.find({ rid: rideId, st: 'confirmed', paymentState: { $in: ['none', 'held'] } });
  for (const b of list) {
    const prev = b.paymentState;
    const won = await Booking.findOneAndUpdate({ _id: b._id, paymentState: prev }, { $set: { paymentState: 'settled', paidAmount: totalOf(b) } });
    if (!won) continue;
    const route = `${ride.path[0]} → ${ride.path[ride.path.length - 1]}`;
    if (prev === 'none') await post({ uid: b.pid, type: 'ride_payment', amount: -totalOf(b), rideId, bookingId: b._id, journeyId: b.journeyId || '', note: `Ride payment (${route})` });
    if (ride.own) await post({ uid: ride.own, type: 'earning', amount: Number(b.fare || 0), rideId, bookingId: b._id, journeyId: b.journeyId || '', note: `Earning from ${b.pn} (${route})` });
    if (Number(b.fee)) await post({ uid: 'platform', type: 'platform_fee', amount: Number(b.fee), rideId, bookingId: b._id, note: 'Platform fee' });
  }
}

/* Driver cancelled the whole ride: refund anything held, add a goodwill credit for confirmed seats. */
async function onDriverCancel(ride, booking, wasConfirmed) {
  const rideId = String(ride._id);
  if (booking.paymentState === 'held') {
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentState: 'refunded' } });
    await post({ uid: booking.pid, type: 'refund', amount: booking.paidAmount || totalOf(booking), rideId, bookingId: booking._id, note: 'Refund: driver cancelled the ride' });
  }
  if (wasConfirmed) {
    await post({ uid: booking.pid, type: 'credit', amount: GOODWILL_CREDIT, rideId, bookingId: booking._id, note: 'Goodwill credit: driver cancelled your confirmed ride' });
    await post({ uid: 'platform', type: 'credit', amount: -GOODWILL_CREDIT, rideId, bookingId: booking._id, note: 'Goodwill credit issued to a passenger' });
  }
}

/* Passenger cancelled their own seat. Late cancellations of confirmed seats pay the driver a small fee. */
async function onPassengerCancel(ride, booking, wasConfirmed) {
  const rideId = String(ride._id);
  let fee = 0;
  const late = ride.status !== 'scheduled' || (new Date(`${ride.date}T${ride.time}:00`) - Date.now()) / 60000 < LATE_CANCEL_MINUTES;
  if (wasConfirmed && late) fee = Math.min(50, Math.max(10, Math.round(Number(booking.fare || 0) * 0.1)));
  if (booking.paymentState === 'held') {
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentState: 'refunded' } });
    await post({ uid: booking.pid, type: 'refund', amount: booking.paidAmount || totalOf(booking), rideId, bookingId: booking._id, note: 'Refund: booking cancelled' });
  }
  if (fee) {
    await post({ uid: booking.pid, type: 'cancellation_fee', amount: -fee, rideId, bookingId: booking._id, note: 'Late cancellation fee' });
    if (ride.own) await post({ uid: ride.own, type: 'cancellation_compensation', amount: fee, rideId, bookingId: booking._id, note: `Compensation: ${booking.pn} cancelled late` });
    await Booking.updateOne({ _id: booking._id }, { $set: { cancelFee: fee } });
    await notifyUser(booking.pid, `A late-cancellation fee of ₹${fee} was charged to your wallet.`, 'Wallet', 'wallet');
  }
  return fee;
}

async function summary(uid) {
  const u = await User.findById(uid).select('walletBalance').lean();
  const [txns, rows] = await Promise.all([
    WalletTxn.find({ uid: String(uid) }).sort({ createdAt: -1 }).limit(10).lean(),
    WalletTxn.aggregate([{ $match: { uid: String(uid) } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }])
  ]);
  const by = Object.fromEntries(rows.map(r => [r._id, r.total]));
  const sum = t => t.reduce((a, k) => a + (by[k] || 0), 0);
  return {
    balance: (u && u.walletBalance) || 0,
    totals: { spent: -sum(['ride_hold', 'ride_payment']), earned: sum(['earning', 'cancellation_compensation']), refunded: sum(['refund']), credits: sum(['credit']), fees: -sum(['cancellation_fee', 'service_fee']), topups: sum(['topup']) },
    pendingHolds: await Booking.countDocuments({ pid: String(uid), paymentState: 'held' }),
    transactions: txns.map(t => ({ ...t, id: String(t._id), _id: String(t._id) }))
  };
}

module.exports = { getSettings, setMode, post, onRideStart, onRideComplete, onDriverCancel, onPassengerCancel, summary, GOODWILL_CREDIT, LATE_CANCEL_MINUTES };
