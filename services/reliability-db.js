const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const { computeReliability } = require('./reliability');
const { buildPassport } = require('./vehicles');

/* Batch loader: 3 queries for any number of users. */
async function reliabilityMap(uids) {
  uids = [...new Set(uids.map(String))].slice(0, 30);
  const [users, rides, passengerBookings] = await Promise.all([
    User.find({ _id: { $in: uids } }).select('createdAt rating').lean(),
    Ride.find({ own: { $in: uids } }).lean(),
    Booking.find({ pid: { $in: uids } }).lean()
  ]);
  const driverBookings = await Booking.find({ rid: { $in: rides.map(r => String(r._id)) } }).lean();
  const out = {};
  for (const u of users) {
    const id = String(u._id);
    const driverRides = rides.filter(r => String(r.own) === id);
    const ids = new Set(driverRides.map(r => String(r._id)));
    const mine = driverBookings.filter(b => ids.has(String(b.rid)));
    out[id] = computeReliability({
      user: u, driverRides, driverBookings: mine,
      passengerBookings: passengerBookings.filter(b => String(b.pid) === id),
      ratings: mine.filter(b => b.rated).map(b => b.rated)
    });
  }
  return out;
}

async function passportFor(uid) {
  const user = await User.findById(uid).select('name car blocked rating createdAt').lean();
  if (!user || !user.car || !user.car.m) return null;
  const rel = (await reliabilityMap([uid]))[String(uid)];
  const stats = {
    completedTrips: rel.stats.completedDriver,
    avgRating: rel.stats.averageRating || user.rating || null,
    ratingCount: rel.stats.ratingCount
  };
  return { passport: buildPassport(user, stats), reliability: rel };
}

module.exports = { reliabilityMap, passportFor };
