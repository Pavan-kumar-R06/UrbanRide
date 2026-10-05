/* Ride Reliability Score (0-100) built from five weighted signals.
   If a signal has no data yet it is left out and the remaining weights are re-scaled,
   so a brand-new member is shown as "New" rather than punished. */
const { scheduledAt } = require('./city-graph');

const WEIGHTS = { punctuality: 25, cancellation: 25, completed: 20, acceptance: 15, history: 15 };
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/* ctx: { user, driverRides[], driverBookings[] (bookings on rides they drove), passengerBookings[], ratings[] } */
function computeReliability({ user, driverRides = [], driverBookings = [], passengerBookings = [], ratings = [] }) {
  const comps = [];
  const completedDriver = driverRides.filter(r => r.status === 'completed').length;
  const completedPass = passengerBookings.filter(b => b.st === 'confirmed' && b.tripCompletedAt).length;
  const completed = completedDriver + completedPass;

  // 1. punctuality: how close to the scheduled time did the driver actually start (5 min grace, 0 at 35 min late)
  const started = driverRides.filter(r => r.startedAt);
  let punctuality = null, punctDetail = 'No started rides yet';
  if (started.length) {
    const scores = started.map(r => {
      const late = (new Date(r.startedAt) - scheduledAt(r)) / 60000;
      return clamp(100 - Math.max(0, late - 5) * (100 / 30));
    });
    punctuality = scores.reduce((a, b) => a + b, 0) / scores.length;
    const onTime = scores.filter(s => s >= 99).length;
    punctDetail = `${onTime}/${started.length} rides started on time`;
  }
  comps.push({ key: 'punctuality', label: 'Punctuality', value: punctuality, detail: punctDetail });

  // 2. cancellation rate (driver cancelling rides + passenger cancelling confirmed seats)
  const published = driverRides.length;
  const cancelledRides = driverRides.filter(r => r.status === 'cancelled' && r.cancelledAfterBookings).length;
  const committedPass = passengerBookings.filter(b => b.decidedAt || b.st === 'confirmed').length;
  const cancelledPass = passengerBookings.filter(b => b.cancelledAfterConfirm).length;
  const commitments = published + committedPass;
  let cancellation = null, cancelDetail = 'No commitments yet';
  if (commitments) {
    const rate = (cancelledRides + cancelledPass) / commitments;
    cancellation = clamp(100 - rate * 200); // 50% cancelled => 0
    cancelDetail = `${cancelledRides + cancelledPass} cancelled of ${commitments} commitments (${Math.round(rate * 100)}%)`;
  }
  comps.push({ key: 'cancellation', label: 'Cancellation rate', value: cancellation, detail: cancelDetail });

  // 3. completed rides (diminishing returns)
  const completedScore = completed ? clamp(100 * (1 - Math.exp(-completed / 6))) : null;
  comps.push({ key: 'completed', label: 'Completed rides', value: completedScore, detail: `${completed} completed (${completedDriver} driven, ${completedPass} ridden)` });

  // 4. booking acceptance (driver side)
  const decided = driverBookings.filter(b => ['confirmed', 'rejected'].includes(b.st) || b.decidedAt);
  const accepted = decided.filter(b => !['rejected'].includes(b.st)).length;
  const acceptance = decided.length ? 100 * accepted / decided.length : null;
  comps.push({ key: 'acceptance', label: 'Booking acceptance', value: acceptance, detail: decided.length ? `${accepted}/${decided.length} requests accepted` : 'No decided requests yet' });

  // 5. ride history: rating + tenure + volume
  const ageDays = user.createdAt ? (Date.now() - new Date(user.createdAt)) / 864e5 : 0;
  const parts = [];
  if (ratings.length) parts.push([0.4, (ratings.reduce((a, b) => a + b, 0) / ratings.length) / 5 * 100]);
  parts.push([0.3, clamp(ageDays / 60 * 100)]);
  parts.push([0.3, clamp((published + committedPass) / 10 * 100)]);
  const wsum = parts.reduce((a, [w]) => a + w, 0);
  const history = parts.reduce((a, [w, v]) => a + w * v, 0) / wsum;
  const avg = ratings.length ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : null;
  comps.push({ key: 'history', label: 'Ride history', value: published + committedPass ? history : null, detail: `${Math.round(ageDays)} days on UrbanRide${avg ? ' · ' + avg + '★ from ' + ratings.length + ' rating(s)' : ''}` });

  const present = comps.filter(c => c.value !== null);
  const totalWeight = present.reduce((a, c) => a + WEIGHTS[c.key], 0);
  const active = published + committedPass;
  let score = null;
  if (active > 0 && totalWeight) score = Math.round(present.reduce((a, c) => a + c.value * WEIGHTS[c.key], 0) / totalWeight);
  const tier = score === null ? 'New' : score >= 90 ? 'Excellent' : score >= 75 ? 'Reliable' : score >= 55 ? 'Fair' : 'Needs attention';
  return {
    score, tier,
    components: comps.map(c => ({ ...c, value: c.value === null ? null : Math.round(c.value), weight: WEIGHTS[c.key] })),
    stats: { completed, completedDriver, completedPass, published, cancelledRides, cancelledPass, averageRating: avg, ratingCount: ratings.length }
  };
}

module.exports = { computeReliability, WEIGHTS };
