/* Ride matching, alternative suggestions and multi-vehicle ("ride transformation") planning */
const { P, near, km, priceFor, route, pathEdges, edgeKey, minsOf, etaMinutes, SPEED, rn } = require('./city-graph');

const reachable = (ride, f, t) => {
  const [i, d1] = near(ride.path, f), [j, d2] = near(ride.path, t);
  return i < j && d1 <= 15 && d2 <= 15 ? { i, j, d1, d2 } : null;
};

/* Direct rides, same logic as the browser search. */
function matchRides(rides, q, { skipRideId, userId, vtype } = {}) {
  return rides.filter(r => r.status === 'scheduled' && String(r._id || r.id) !== String(skipRideId) && String(r.own) !== String(userId) && (!vtype || vtype === 'all' || r.vtype === vtype))
    .map(r => {
      const hit = reachable(r, q.f, q.t);
      if (!hit) return null;
      const k = km(r.path, hit.i, hit.j), pr = priceFor(k, r.rate, q.seats || 1);
      const score = Math.round(Math.max(0, 100 - hit.d1 * 2 - hit.d2 * 2 - Math.abs(minsOf(r.time) - minsOf(q.time || r.time)) / 6));
      return { ride: r, score, pick: r.path[hit.i], drop: r.path[hit.j], k, perSeat: pr.perSeat, fare: pr.base, fee: pr.fee };
    }).filter(x => x && x.score > 20).sort((a, b) => b.score - a.score);
}

/* Two-vehicle plans: ride A (e.g. a bike through narrow lanes) hands the passenger over at a hub
   where ride B (e.g. a car on the main road) continues to the destination. */
function planTransfers(rides, q, { userId, maxWait = 60, limit = 5 } = {}) {
  const open = rides.filter(r => r.status === 'scheduled' && String(r.own) !== String(userId));
  const plans = [];
  for (const A of open) {
    const [i, d1] = near(A.path, q.f);
    if (d1 > 15) continue;
    for (let x = i + 1; x < A.path.length; x++) {
      const hub = A.path[x];
      if (hub === q.t) continue;
      for (const B of open) {
        if (B === A || String(B.own) === String(A.own)) continue;
        const m = B.path.indexOf(hub);
        if (m < 0) continue;
        const [j, d2] = near(B.path, q.t);
        if (j <= m || d2 > 15) continue;
        const arrive = etaMinutes(A, x), pass = etaMinutes(B, m), wait = Math.round(pass - arrive);
        if (wait < 0 || wait > maxWait) continue;
        const k1 = km(A.path, i, x), k2 = km(B.path, m, j);
        const p1 = priceFor(k1, A.rate, q.seats || 1), p2 = priceFor(k2, B.rate, q.seats || 1);
        const small = v => v === 'bike' || v === 'scooter';
        const bonus = small(A.vtype) && B.vtype === 'car' ? -12 : 0; // the favourite pattern: two-wheeler -> car
        plans.push({
          hub, hubName: P[hub][0], wait, total: p1.base + p2.base + p1.fee + p2.fee, distance: +(k1 + k2).toFixed(1),
          rank: p1.base + p2.base + wait * 0.8 + 15 + bonus,
          legs: [
            { ride: A, f: A.path[i], t: hub, k: k1, fare: p1.base, fee: p1.fee },
            { ride: B, f: hub, t: B.path[j], k: k2, fare: p2.base, fee: p2.fee, waitMinutes: wait }
          ]
        });
      }
    }
  }
  const seen = new Set();
  return plans.sort((a, b) => a.rank - b.rank).filter(p => {
    const key = p.legs.map(l => String(l.ride._id || l.ride.id)).join('>');
    if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, limit);
}

/* Alternative path for the same trip when some road segments are unavailable */
function rerouteAround(path, f, t, blockedEdges) {
  const blocked = new Set(blockedEdges);
  const i = path.indexOf(f), j = path.indexOf(t);
  if (i < 0 || j <= i) return null;
  const original = path.slice(i, j + 1);
  if (!pathEdges(original).some(e => blocked.has(e))) return { path: original, extraKm: 0, blockedOnRoute: false };
  const alt = route(f, t, blocked);
  if (!alt) return null;
  return { path: alt, extraKm: +(km(alt) - km(original)).toFixed(1), blockedOnRoute: true };
}

module.exports = { reachable, matchRides, planTransfers, rerouteAround };
