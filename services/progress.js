const { CITY_GEO } = require('./city-graph');
const dist = (from, to) => {
  const r = v => v * Math.PI / 180, dLat = r(to[0] - from[0]), dLng = r(to[1] - from[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(from[0])) * Math.cos(r(to[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
function rideProgress(ride) {
  if (ride.status === 'completed') return 1;
  if (ride.status !== 'active' || !ride.startedAt || !ride.estimatedDurationMinutes) return Math.max(0, Math.min(1, Number(ride.prog) || 0));
  return Math.max(0, Math.min(1, (Date.now() - new Date(ride.startedAt)) / (ride.estimatedDurationMinutes * 60000)));
}
/* progress of one passenger's segment (pickup -> drop) inside the ride */
function segmentProgress(ride, booking) {
  const start = ride.path.indexOf(booking.f), end = ride.path.indexOf(booking.t);
  if (start < 0 || end <= start) return rideProgress(ride);
  let total = 0, offset = 0, seg = 0;
  for (let i = 0; i < ride.path.length - 1; i++) {
    const a = CITY_GEO[ride.path[i]], b = CITY_GEO[ride.path[i + 1]]; if (!a || !b) continue;
    const l = dist(a, b); total += l; if (i < start) offset += l; if (i >= start && i < end) seg += l;
  }
  if (!total || !seg) return rideProgress(ride);
  return Math.max(0, Math.min(1, (rideProgress(ride) * total - offset) / seg));
}
module.exports = { rideProgress, segmentProgress };
