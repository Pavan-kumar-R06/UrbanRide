const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

async function hasActiveJourney(userId, excludeRideId) {
  const activeStatuses = ['boarding', 'active'];
  const [ownedRide, bookedRideIds] = await Promise.all([
    Ride.exists({
      own: String(userId),
      status: { $in: activeStatuses },
      ...(excludeRideId ? { _id: { $ne: excludeRideId } } : {})
    }),
    Booking.distinct('rid', { pid: String(userId), st: 'confirmed', tripCompletedAt: null })
  ]);
  if (ownedRide) return true;
  if (!bookedRideIds.length) return false;
  return Boolean(await Ride.exists({
    _id: { $in: bookedRideIds, ...(excludeRideId ? { $ne: excludeRideId } : {}) },
    status: { $in: activeStatuses }
  }));
}

module.exports = hasActiveJourney;
