/* Pure analytics: demand/supply heatmap + advanced mobility metrics.
   Works on plain arrays so it can be unit-tested without a database. */
const { P, E, km, near, route, pathEdges, edgeKey, etaMinutes, directKm, minsOf, rn } = require('./city-graph');

const NODES = Object.keys(P);
const hourOf = t => Math.floor(minsOf(t) / 60) % 24;
const blank24 = () => Array.from({ length: 24 }, () => 0);
const active = r => r.status !== 'cancelled';

function bookingPath(b, ride) {
  if (!ride) return route(b.f, b.t) || [b.f, b.t];
  const i = ride.path.indexOf(b.f), j = ride.path.indexOf(b.t);
  return i >= 0 && j > i ? ride.path.slice(i, j + 1) : (route(b.f, b.t) || [b.f, b.t]);
}

function heatmap({ rides, bookings, signals, vtype = 'all' }) {
  const byId = new Map(rides.map(r => [String(r._id || r.id), r]));
  const rs = rides.filter(r => active(r) && (vtype === 'all' || r.vtype === vtype));
  const grid = Object.fromEntries(NODES.map(n => [n, { demand: blank24(), supply: blank24() }]));
  const edge = Object.fromEntries(E.map(([a, b]) => [edgeKey(a, b), { a, b, demand: 0, supply: 0 }]));
  const hourDemand = blank24(), hourSupply = blank24();
  const od = {};

  const addDemand = (f, t, hour, seats, path) => {
    grid[f].demand[hour] += seats; hourDemand[hour] += seats;
    pathEdges(path || route(f, t) || []).forEach(k => { if (edge[k]) edge[k].demand += seats; });
    const key = f + '>' + t; od[key] = od[key] || { f, t, requests: 0, unmatched: 0 }; od[key].requests += seats;
  };
  bookings.forEach(b => {
    const ride = byId.get(String(b.rid));
    if (!ride || (vtype !== 'all' && ride.vtype !== vtype) || !P[b.f] || !P[b.t]) return;
    addDemand(b.f, b.t, hourOf(ride.time), b.seats || 1, bookingPath(b, ride));
  });
  signals.filter(s => (vtype === 'all' || s.vtype === 'all' || s.vtype === vtype) && P[s.f] && P[s.t] && s.f !== s.t).forEach(s => {
    addDemand(s.f, s.t, s.hour, s.seats || 1);
    if (!s.results) od[s.f + '>' + s.t].unmatched += s.seats || 1;
  });
  rs.forEach(r => {
    r.path.forEach((n, idx) => {
      if (idx < r.path.length - 1 && grid[n]) { const h = Math.floor(etaMinutes(r, idx) / 60) % 24; grid[n].supply[h] += r.cap || 1; hourSupply[h] += r.cap || 1; }
    });
    pathEdges(r.path).forEach(k => { if (edge[k]) edge[k].supply += r.cap || 1; });
  });

  const nodes = NODES.map(n => {
    const demand = grid[n].demand.reduce((a, b) => a + b, 0), supply = grid[n].supply.reduce((a, b) => a + b, 0);
    return { id: n, name: P[n][0], demand, supply, gap: demand - supply, ratio: supply ? +(demand / supply).toFixed(2) : (demand ? null : 0) };
  });
  const edges = Object.values(edge).map(e => ({ ...e, key: edgeKey(e.a, e.b), names: P[e.a][0] + ' ↔ ' + P[e.b][0], gap: e.demand - e.supply, ratio: e.supply ? +(e.demand / e.supply).toFixed(2) : (e.demand ? null : 0) }));
  const underservedNodes = nodes.filter(n => n.demand > 0 && n.gap > 0).sort((a, b) => b.gap - a.gap);
  const underservedCorridors = edges.filter(e => e.demand > 0 && (e.supply === 0 || e.ratio > 1)).sort((a, b) => b.gap - a.gap);
  const peakCorridors = edges.filter(e => e.demand > 0).sort((a, b) => b.demand - a.demand).slice(0, 6);
  const unmatchedRoutes = Object.values(od).filter(o => o.unmatched > 0).sort((a, b) => b.unmatched - a.unmatched).slice(0, 8)
    .map(o => ({ ...o, label: P[o.f][0] + ' → ' + P[o.t][0] }));
  const peakHour = hourDemand.indexOf(Math.max(...hourDemand));
  return { grid, nodes, edges, hourDemand, hourSupply, underservedNodes, underservedCorridors, peakCorridors, unmatchedRoutes, peakHour: Math.max(...hourDemand) ? peakHour : null,
    totals: { demand: hourDemand.reduce((a, b) => a + b, 0), supply: hourSupply.reduce((a, b) => a + b, 0) } };
}

const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0;

function advanced({ rides, bookings, signals }) {
  const byId = new Map(rides.map(r => [String(r._id || r.id), r]));
  const live = rides.filter(active);

  // route demand
  const routes = {};
  bookings.forEach(b => {
    if (!P[b.f] || !P[b.t]) return;
    const k = b.f + '>' + b.t; const o = routes[k] = routes[k] || { f: b.f, t: b.t, requests: 0, confirmed: 0, searches: 0, fare: 0 };
    o.requests += b.seats || 1; if (b.st === 'confirmed') { o.confirmed += b.seats || 1; o.fare += b.fare || 0; }
  });
  signals.forEach(s => { if (!P[s.f] || !P[s.t]) return; const k = s.f + '>' + s.t; const o = routes[k] = routes[k] || { f: s.f, t: s.t, requests: 0, confirmed: 0, searches: 0, fare: 0 }; o.searches += s.seats || 1; });
  const routeDemand = Object.values(routes).map(o => ({ ...o, label: P[o.f][0] + ' → ' + P[o.t][0], conversion: pct(o.confirmed, o.requests) }))
    .sort((a, b) => (b.requests + b.searches) - (a.requests + a.searches)).slice(0, 8);

  // occupancy
  const occ = live.filter(r => r.cap).map(r => (r.cap - r.seats) / r.cap);
  const buckets = [0, 0, 0, 0];
  occ.forEach(o => { buckets[o <= 0 ? 0 : o <= 0.5 ? 1 : o < 1 ? 2 : 3]++; });
  const occupancy = { average: Math.round(avg(occ) * 100), buckets: [
    { label: 'Empty', count: buckets[0] }, { label: 'Up to 50%', count: buckets[1] }, { label: '51–99%', count: buckets[2] }, { label: 'Full', count: buckets[3] }] };

  // vehicle utilisation
  const vehicles = ['car', 'bike', 'scooter'].map(t => {
    const rs = live.filter(r => (r.vtype || 'car') === t);
    const cap = rs.reduce((a, r) => a + (r.cap || 0), 0), filled = rs.reduce((a, r) => a + ((r.cap || 0) - (r.seats || 0)), 0);
    const done = rs.filter(r => r.status === 'completed');
    const rev = bookings.filter(b => b.st === 'confirmed' && (byId.get(String(b.rid)) || {}).vtype === t).reduce((a, b) => a + (b.fare || 0), 0);
    return { type: t, rides: rs.length, completed: done.length, seatsOffered: cap, seatsFilled: filled, utilization: pct(filled, cap), distanceKm: +done.reduce((a, r) => a + km(r.path), 0).toFixed(1), revenue: rev };
  });

  // peak hours
  const rideHours = blank24(), reqHours = blank24();
  live.forEach(r => { rideHours[hourOf(r.time)]++; });
  bookings.forEach(b => { const r = byId.get(String(b.rid)); if (r) reqHours[hourOf(r.time)] += b.seats || 1; });
  signals.forEach(s => { reqHours[s.hour] += s.seats || 1; });
  const peakHours = Array.from({ length: 24 }, (_, h) => ({ hour: h, rides: rideHours[h], requests: reqHours[h] }));

  // cancellation patterns
  const driverCancelled = rides.filter(r => r.status === 'cancelled');
  const passengerCancelled = bookings.filter(b => b.st === 'cancelled');
  const rejected = bookings.filter(b => b.st === 'rejected');
  const rideCancelledBookings = bookings.filter(b => b.st === 'ride-cancelled');
  const cancelByHour = blank24(), cancelByDay = [0, 0, 0, 0, 0, 0, 0];
  const noteCancel = (time, date) => { cancelByHour[hourOf(time)]++; const d = new Date(date + 'T00:00:00').getDay(); if (!isNaN(d)) cancelByDay[d]++; };
  driverCancelled.forEach(r => noteCancel(r.time, r.date));
  [...passengerCancelled, ...rejected].forEach(b => { const r = byId.get(String(b.rid)); if (r) noteCancel(r.time, r.date); });
  const totalCommit = bookings.length + rides.length;
  const cancelRoutes = {};
  driverCancelled.forEach(r => { const k = rn(r.path); cancelRoutes[k] = (cancelRoutes[k] || 0) + 1; });
  passengerCancelled.forEach(b => { const r = byId.get(String(b.rid)); if (r) { const k = rn(r.path); cancelRoutes[k] = (cancelRoutes[k] || 0) + 1; } });
  const cancellations = {
    total: driverCancelled.length + passengerCancelled.length + rejected.length,
    rate: pct(driverCancelled.length + passengerCancelled.length + rejected.length, totalCommit),
    causes: [
      { label: 'Driver cancelled ride', count: driverCancelled.length },
      { label: 'Passenger cancelled', count: passengerCancelled.length },
      { label: 'Request declined', count: rejected.length },
      { label: 'Passengers affected by driver cancel', count: rideCancelledBookings.length }
    ],
    byHour: cancelByHour, byDay: cancelByDay,
    topRoutes: Object.entries(cancelRoutes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, count]) => ({ label, count }))
  };

  // detours
  const rideDetours = live.map(r => { const direct = directKm(r.path[0], r.path[r.path.length - 1]); return direct ? km(r.path) / direct : 1; });
  const paxDetours = bookings.filter(b => b.st === 'confirmed').map(b => {
    const r = byId.get(String(b.rid)); if (!r) return null;
    const seg = bookingPath(b, r), direct = directKm(b.f, b.t);
    return direct ? km(seg) / direct : null;
  }).filter(x => x !== null);
  const detours = { avgRide: avg(rideDetours), avgPassenger: avg(paxDetours),
    detouredRides: pct(rideDetours.filter(x => x > 1.05).length, rideDetours.length), maxRide: rideDetours.length ? +Math.max(...rideDetours).toFixed(2) : 0 };

  return { routeDemand, occupancy, vehicles, peakHours, cancellations, detours,
    totals: { rides: live.length, bookings: bookings.length, searches: signals.length } };
}

module.exports = { heatmap, advanced, bookingPath };
