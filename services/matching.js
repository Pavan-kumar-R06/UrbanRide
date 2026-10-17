/* Ride matching, alternative suggestions and multi-vehicle ("ride transformation") planning */
const { P, near, km, priceFor, route, pathEdges, edgeKey, minsOf, etaMinutes, SPEED, rn, scheduledAt } = require('./city-graph');

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

/* ------------------------------------------------------------------------------------------
   Journey chains ("ride transformation" / "multiple journey").
   A takes the passenger 1 -> 5, B takes them 5 -> 8: one continuous journey over 2 or 3 rides.
   - Times are DATE-aware (a ride tomorrow never connects to a ride today).
   - A change is feasible when the next vehicle reaches the hub 0..maxWaitMin minutes after the
     previous vehicle arrives there.
   - Close calls that fail only on timing are returned as `nearMisses` so the UI can explain why.
   ------------------------------------------------------------------------------------------ */
const startMs = r => scheduledAt(r).getTime();
const etaMs = (ride, idx) => startMs(ride) + km(ride.path, 0, idx) / (SPEED[ride.vtype] || SPEED.car) * 3600000;
const small = v => v === 'bike' || v === 'scooter';
const NEAR = 15; // same pick-up / drop-off tolerance as direct search (graph units)

function planChains(rides, q, { userId, maxLegs = 3, maxWait = 60, limit = 5 } = {}) {
  const seats = q.seats || 1;
  const open = rides.filter(r => r.status === 'scheduled' && String(r.own) !== String(userId) && Number.isFinite(startMs(r)));
  const rid = r => String(r._id || r.id);

  // which hubs can still reach the destination in k more rides (ignoring time) - keeps the search small
  const finishIdx = R => { const [j, d2] = near(R.path, q.t); return d2 <= NEAR ? j : -1; };
  const reach = [null, new Set()];                       // reach[k] = nodes from which k rides can finish
  open.forEach(R => { const j = finishIdx(R); if (j > 0) R.path.slice(0, j).forEach(n => reach[1].add(n)); });
  for (let k = 2; k < maxLegs; k++) {
    reach[k] = new Set(reach[k - 1]);
    open.forEach(R => { const last = Math.max(...R.path.map((n, i) => reach[k - 1].has(n) || n === q.t ? i : -1)); if (last > 0) R.path.slice(0, last).forEach(n => reach[k].add(n)); });
  }

  const byNode = {};
  open.forEach(R => R.path.forEach((n, i) => { (byNode[n] = byNode[n] || []).push([R, i]); }));

  const plans = [], misses = [];
  const mkLeg = (L, wait) => {
    const k = km(L.ride.path, L.m, L.x), p = priceFor(k, L.ride.rate, seats);
    return { ride: L.ride, f: L.ride.path[L.m], t: L.ride.path[L.x], k, fare: p.base, fee: p.fee, waitMinutes: wait };
  };
  const emit = legs => {
    const out = legs.map((L, n) => mkLeg(L, n ? L.wait : 0));
    const hubs = out.slice(0, -1).map(l => l.t), waits = out.slice(1).map(l => l.waitMinutes);
    const total = out.reduce((a, l) => a + l.fare + l.fee, 0), fares = out.reduce((a, l) => a + l.fare, 0);
    const bonus = out.reduce((a, l, n) => a + (n && small(out[n - 1].ride.vtype) && l.ride.vtype === 'car' ? -12 : 0), 0);
    plans.push({
      hub: hubs[0], hubName: P[hubs[0]][0], hubs, hubNames: hubs.map(h => P[h][0]),
      wait: waits.reduce((a, b) => a + b, 0), waits, total, distance: +out.reduce((a, l) => a + l.k, 0).toFixed(1),
      departAt: new Date(etaMs(legs[0].ride, legs[0].m)).toISOString(), arriveAt: new Date(etaMs(legs[legs.length - 1].ride, legs[legs.length - 1].x)).toISOString(),
      rank: fares + waits.reduce((a, b) => a + b, 0) * 0.8 + (out.length - 1) * 15 + bonus, legs: out
    });
  };

  function dfs(legs, node, readyMs, visited) {
    const depth = legs.length, remaining = maxLegs - depth;
    if (plans.length > 400) return;
    const cands = depth === 0
      ? open.map(R => { const [i, d1] = near(R.path, q.f); return d1 <= NEAR ? [R, i] : null; }).filter(Boolean)
      : (byNode[node] || []);
    for (const [R, m] of cands) {
      if (legs.some(l => l.ride === R) || (depth && String(R.own) === String(legs[depth - 1].ride.own))) continue;
      let wait = 0;
      if (depth) {
        wait = Math.round((etaMs(R, m) - readyMs) / 60000);
        const j = finishIdx(R);
        if (wait < 0 || wait > maxWait) {          // timing fails: remember it if this ride would have finished the trip
          if (depth === 1 && j > m) misses.push({ hub: node, hubName: P[node][0], gapMin: wait, kind: wait < 0 ? 'too_early' : 'too_long', first: legs[0].ride, second: R, arriveAt: new Date(readyMs).toISOString(), departAt: new Date(etaMs(R, m)).toISOString() });
          continue;
        }
      }
      const here = { ride: R, m, wait };
      const j = finishIdx(R);
      if (depth >= 1 && j > m) { emit([...legs, { ...here, x: j }]); }
      if (remaining > 1) {
        for (let x = m + 1; x < R.path.length; x++) {
          const hub = R.path[x];
          if (hub === q.t || visited.has(hub) || !reach[remaining - 1].has(hub)) continue;
          dfs([...legs, { ...here, x }], hub, etaMs(R, x), new Set([...visited, hub]));
        }
      }
    }
  }
  dfs([], q.f, 0, new Set([q.f]));

  const seen = new Set();
  const best = plans.sort((a, b) => a.rank - b.rank).filter(p => {
    const key = p.legs.map(l => rid(l.ride) + ':' + l.f + '>' + l.t).join('|');
    if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, limit);
  const nearMisses = best.length ? [] : misses.sort((a, b) => Math.abs(a.gapMin) - Math.abs(b.gapMin)).slice(0, 3);
  return { plans: best, nearMisses };
}

/* Two-vehicle plans (kept for the existing callers: "multi-vehicle" button + disruption alternatives). */
function planTransfers(rides, q, { userId, maxWait = 60, limit = 5 } = {}) {
  return planChains(rides, q, { userId, maxLegs: 2, maxWait, limit }).plans;
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

module.exports = { reachable, matchRides, planTransfers, planChains, rerouteAround, etaMs, startMs };
