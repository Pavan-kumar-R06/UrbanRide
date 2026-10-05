/* Side effects of a ride changing state: money, hand-overs, passenger alerts. Always idempotent. */
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const wallet = require('./wallet');
const { notifyUser } = require('./notify');
const { notifyWithAlternatives } = require('./alternatives');
const { P, rn } = require('./city-graph');

async function onStatusChange(ride, prev) {
  if (ride.status === prev) return;
  try {
    if (ride.status === 'active') await wallet.onRideStart(ride);
    if (ride.status === 'completed') {
      await wallet.onRideComplete(ride);
      const done = await Booking.find({ rid: String(ride._id), st: 'confirmed', journeyId: { $ne: null }, handoverAt: null });
      for (const b of done) await handoverAfterLeg(b);
    }
    if (ride.status === 'cancelled') await cancelRideBookings(ride);
  } catch (err) {
    console.error('Ride event handling failed:', err);
  }
}

async function cancelRideBookings(ride) {
  const list = await Booking.find({ rid: String(ride._id), st: { $in: ['pending', 'confirmed', 'waitlisted'] } });
  const now = new Date();
  for (const b of list) {
    const wasConfirmed = b.st === 'confirmed';
    b.st = 'ride-cancelled'; b.cancelledAt = now;
    await b.save();
    await wallet.onDriverCancel(ride, b, wasConfirmed);
    await notifyWithAlternatives(b, `The driver cancelled ${rn(ride.path)}.` + (wasConfirmed ? ` ₹${wallet.GOODWILL_CREDIT} goodwill credit added to your wallet.` : ''));
  }
  await Ride.updateOne({ _id: ride._id }, { $set: { cancelledAt: now, cancelledAfterBookings: list.length > 0 } });
}

/* When one leg of a multi-vehicle journey ends, tell the passenger and the next driver. */
async function handoverAfterLeg(booking) {
  if (!booking.journeyId || booking.handoverAt) return;
  const claimed = await Booking.findOneAndUpdate({ _id: booking._id, handoverAt: null }, { $set: { handoverAt: new Date() } });
  if (!claimed) return;
  const next = await Booking.findOne({ journeyId: booking.journeyId, legIndex: booking.legIndex + 1 });
  if (!next) return;
  const nextRide = await Ride.findById(next.rid).lean();
  if (!nextRide) return;
  const hub = P[next.f] ? P[next.f][0] : next.f;
  await notifyUser(booking.pid, `Leg ${booking.legIndex + 1} complete at ${hub}. Your journey continues with ${nextRide.drv} (${nextRide.veh}), departing ${nextRide.time}.`, 'Journey', 'bookings');
  await notifyUser(nextRide.own, `${booking.pn} is arriving at ${hub} from a previous vehicle to join your ride ${rn(nextRide.path)}.`, 'Journey handover', 'drive');
}

module.exports = { onStatusChange, handoverAfterLeg, cancelRideBookings };
