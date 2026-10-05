/* Route-disruption & alternative-journey engine */
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Disruption = require('../models/Disruption');
const { matchRides, planTransfers, rerouteAround } = require('./matching');
const { verifiedNetworkIds, rideVisible } = require('./networks');
const { pathEdges, rn, P } = require('./city-graph');
const { notifyUser } = require('./notify');

async function activeBlockedEdges() {
  const list = await Disruption.find({ active: true }).lean();
  return list.filter(d => ['closure', 'accident', 'weather', 'traffic'].includes(d.kind)).map(d => [d.a, d.b].sort().join('-'));
}

async function openRidesFor(userId, role) {
  const [rides, nets, blocked] = await Promise.all([
    Ride.find({ status: 'scheduled', seats: { $gt: 0 } }).sort({ createdAt: -1 }).limit(200).lean(),
    verifiedNetworkIds(userId), activeBlockedEdges()
  ]);
  const bset = new Set(blocked);
  // never recommend a ride that itself runs through a closed segment
  return rides.filter(r => rideVisible(r, nets, userId, role) && !pathEdges(r.path).some(e => bset.has(e)));
}

async function alternativesForBooking(booking, user) {
  const ride = await Ride.findById(booking.rid).lean();
  const q = { f: booking.f, t: booking.t, time: ride ? ride.time : '08:00', seats: booking.seats || 1 };
  const rides = (await openRidesFor(user.id, user.role)).filter(r => !ride || String(r._id) !== String(ride._id));
  const direct = matchRides(rides, q, { userId: user.id }).slice(0, 5);
  const transfers = direct.length ? [] : planTransfers(rides, q, { userId: user.id, limit: 3 });
  const blocked = await activeBlockedEdges();
  const reroute = ride ? rerouteAround(ride.path, booking.f, booking.t, blocked) : null;
  const ser = r => ({ id: String(r._id), drv: r.drv, veh: r.veh, vtype: r.vtype, time: r.time, date: r.date, rate: r.rate, seats: r.seats, path: r.path, rt: r.rt });
  return {
    reroute: reroute && reroute.blockedOnRoute ? reroute : null,
    rides: direct.map(m => ({ ride: ser(m.ride), pick: m.pick, drop: m.drop, k: m.k, fare: m.fare, fee: m.fee, score: m.score })),
    transfers: transfers.map(p => ({ hub: p.hub, hubName: p.hubName, wait: p.wait, total: p.total, distance: p.distance,
      legs: p.legs.map(l => ({ ride: ser(l.ride), f: l.f, t: l.t, k: l.k, fare: l.fare, fee: l.fee, waitMinutes: l.waitMinutes || 0 })) }))
  };
}

/* Notify one passenger with a short summary of what they can do instead. */
async function notifyWithAlternatives(booking, headline) {
  const alt = await alternativesForBooking(booking, { id: booking.pid, role: 'user' });
  let tail = ' No alternatives are available yet - we will keep checking.';
  if (alt.rides.length) tail = ` ${alt.rides.length} alternative ride(s) found, best: ${alt.rides[0].ride.drv} at ${alt.rides[0].ride.time}.`;
  else if (alt.transfers.length) tail = ` A multi-vehicle journey via ${alt.transfers[0].hubName} is available.`;
  else if (alt.reroute) tail = ` The driver can detour via ${alt.reroute.path.map(k => P[k][0]).join(' → ')} (+${alt.reroute.extraKm} km).`;
  await notifyUser(booking.pid, headline + tail, 'Route alerts', 'bookings');
  return alt;
}

/* Called when a road segment becomes unavailable. Flags every affected booking and informs passengers + drivers. */
async function applyDisruption(disruption) {
  const key = [disruption.a, disruption.b].sort().join('-');
  const rides = await Ride.find({ status: { $in: ['scheduled', 'boarding', 'active'] } }).lean();
  const hit = rides.filter(r => pathEdges(r.path).includes(key));
  const impacted = [];
  for (const r of hit) {
    const bookings = await Booking.find({ rid: String(r._id), st: { $in: ['pending', 'confirmed'] } });
    for (const b of bookings) {
      const i = r.path.indexOf(b.f), j = r.path.indexOf(b.t);
      if (i < 0 || j <= i || !pathEdges(r.path.slice(i, j + 1)).includes(key)) continue; // this passenger doesn't use the segment
      b.disruption = { id: String(disruption._id), reason: disruption.reason || disruption.kind, at: new Date() };
      await b.save();
      impacted.push({ bookingId: String(b._id), uid: b.pid, rideId: String(r._id) });
      await notifyWithAlternatives(b, `Route disruption on ${rn(r.path)}: ${P[disruption.a][0]} ↔ ${P[disruption.b][0]} is ${disruption.kind === 'closure' ? 'closed' : 'affected'}${disruption.reason ? ' (' + disruption.reason + ')' : ''}.`);
    }
    if (r.own) {
      const alt = rerouteAround(r.path, r.path[0], r.path[r.path.length - 1], [key]);
      await notifyUser(r.own, `Your ride ${rn(r.path)} is affected by a disruption between ${P[disruption.a][0]} and ${P[disruption.b][0]}.` + (alt ? ` Suggested detour: ${alt.path.map(k => P[k][0]).join(' → ')} (+${alt.extraKm} km).` : ''), 'Route alerts', 'drive');
    }
  }
  disruption.impactedBookings = impacted;
  await disruption.save();
  return impacted;
}

/* Disruption cleared: remove the flag from bookings. */
async function clearDisruption(disruption) {
  await Booking.updateMany({ 'disruption.id': String(disruption._id) }, { $set: { disruption: null } });
  disruption.active = false; disruption.resolvedAt = new Date();
  await disruption.save();
}

module.exports = { alternativesForBooking, notifyWithAlternatives, applyDisruption, clearDisruption, activeBlockedEdges, openRidesFor };
