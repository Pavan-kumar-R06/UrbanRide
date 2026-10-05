/* City graph + routing. Same data & maths as the original app; server/services/city-graph.js mirrors it. */
export const P = { ec: ['Electronic City', 18, 88], hsr: ['HSR Layout', 33, 74], kor: ['Koramangala', 42, 60], jay: ['Jayanagar', 22, 52], mg: ['MG Road', 52, 42], ind: ['Indiranagar', 64, 46], mar: ['Marathahalli', 77, 54], wf: ['Whitefield', 87, 42], mal: ['Malleshwaram', 38, 30], ya: ['Yeshwanthpur', 24, 22], heb: ['Hebbal', 50, 10] };
export const E = [['ec','hsr'],['hsr','kor'],['kor','jay'],['kor','mg'],['jay','mg'],['mg','ind'],['ind','mar'],['mar','wf'],['mg','mal'],['mal','ya'],['mal','heb'],['ya','heb'],['kor','ind'],['hsr','mar']];
export const CITY_GEO = { ec: [12.839, 77.677], hsr: [12.911, 77.644], kor: [12.935, 77.624], jay: [12.925, 77.583], mg: [12.975, 77.606], ind: [12.978, 77.641], mar: [12.956, 77.701], wf: [12.970, 77.750], mal: [13.003, 77.564], ya: [13.028, 77.540], heb: [13.035, 77.598] };
export const PF = { ac: 'AC', mu: 'Music', ns: 'No smoking', wo: 'Women only', pt: 'Pets ok' };
export const VEHICLES = {
  car: { label: 'Car', emoji: '🚗', maxSeats: 6, defaultSeats: 3, defaultRate: 8 },
  bike: { label: 'Bike', emoji: '🏍️', maxSeats: 1, defaultSeats: 1, defaultRate: 5 },
  scooter: { label: 'Scooter', emoji: '🛵', maxSeats: 1, defaultSeats: 1, defaultRate: 4 }
};
export const SERVICE_FEES = { car: 500, bike: 250, scooter: 200 };
export const serviceFeeFor = t => SERVICE_FEES[t] || SERVICE_FEES.car;
export const vIcon = t => (VEHICLES[t] || VEHICLES.car).emoji;
export const vLabel = t => (VEHICLES[t] || VEHICLES.car).label;

export const edgeKey = (a, b) => [a, b].sort().join('-');
export const d = (a, b) => Math.hypot(P[a][1] - P[b][1], P[a][2] - P[b][2]);
export function route(a, b) {
  const D = { [a]: 0 }, pr = {}, q = new Set(Object.keys(P));
  while (q.size) {
    let u = null;
    q.forEach(k => { if (D[k] !== undefined && (u === null || D[k] < D[u])) u = k; });
    if (u === null || u === b) break;
    q.delete(u);
    E.forEach(([x, y]) => {
      const v = x === u ? y : y === u ? x : null;
      if (v && q.has(v)) { const n = D[u] + d(u, v); if (D[v] === undefined || n < D[v]) { D[v] = n; pr[v] = u; } }
    });
  }
  const p = [b];
  while (p[0] !== a && pr[p[0]]) p.unshift(pr[p[0]]);
  return p;
}
export const rt3 = (a, v, b) => v && v !== a && v !== b ? route(a, v).concat(route(v, b).slice(1)) : route(a, b);
export const km = (p, i = 0, j = p.length - 1) => { let s = 0; for (let k = i; k < j; k++) s += d(p[k], p[k + 1]); return +(s * .3).toFixed(1); };
export const near = (p, l) => { let bi = 0, bd = 1e9; p.forEach((x, i) => { const v = d(x, l); if (v < bd) { bd = v; bi = i; } }); return [bi, bd]; };
export const rn = p => P[p[0]][0] + ' → ' + P[p[p.length - 1]][0];
export const nm = k => (P[k] ? P[k][0] : k);

export const PLATFORM_FEE_PCT = 0;
export const priceFor = (k, rate, seats = 1) => {
  const perSeat = Math.max(1, Math.round(k * rate)), base = perSeat * seats, fee = Math.round(base * PLATFORM_FEE_PCT / 100);
  return { k, perSeat, seats, base, fee, total: base + fee };
};
export const mins = t => { const [a, b] = String(t || '0:0').split(':'); return +a * 60 + +b; };

export function match(rides, q, { skip, userId } = {}) {
  return rides.filter(r => r.status === 'scheduled' && r.id !== skip && String(r.own) !== String(userId) && (!q.ac || r.pf.includes('ac')) && (!q.wo || r.pf.includes('wo')) && (!q.vtype || q.vtype === 'all' || (r.vtype || 'car') === q.vtype))
    .map(r => {
      const [i, d1] = near(r.path, q.f), [j, d2] = near(r.path, q.t);
      if (i >= j || d1 > 15 || d2 > 15) return null;
      const score = Math.round(Math.max(0, 100 - d1 * 2 - d2 * 2 - Math.abs(mins(r.time) - mins(q.time)) / 6)), k = km(r.path, i, j);
      const pr = priceFor(k, r.rate, q.seats);
      return { r, score, walk: (d1 * .3).toFixed(1), pick: r.path[i], drop: r.path[j], k, perSeat: pr.perSeat, fare: pr.base, fee: pr.fee };
    }).filter(x => x && x.score > 20).sort((a, b) => q.sort === 'fare' ? a.fare - b.fare : q.sort === 'time' ? mins(a.r.time) - mins(b.r.time) : b.score - a.score);
}

/* ---- tracking geometry (identical to the original map engine) ---- */
const dist = (from, to) => { const r = v => v * Math.PI / 180, dLat = r(to[0] - from[0]), dLng = r(to[1] - from[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(from[0])) * Math.cos(r(to[0])) * Math.sin(dLng / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); };
export const rideProgress = ride => {
  if (!ride) return 0;
  if (ride.status === 'completed') return 1;
  if (ride.status !== 'active' || !ride.startedAt || !ride.estimatedDurationMinutes) return Math.max(0, Math.min(1, Number(ride.prog) || 0));
  return Math.max(0, Math.min(1, (Date.now() - new Date(ride.startedAt).getTime()) / (Number(ride.estimatedDurationMinutes) * 60000)));
};
export function rideSegmentForBooking(ride, booking) {
  const start = ride.path.indexOf(booking.f), end = ride.path.indexOf(booking.t);
  if (start < 0 || end <= start) return null;
  const segment = ride.path.slice(start, end + 1);
  let total = 0, offset = 0, seg = 0;
  for (let i = 0; i < ride.path.length - 1; i++) {
    const a = CITY_GEO[ride.path[i]], b = CITY_GEO[ride.path[i + 1]]; if (!a || !b) continue;
    const l = dist(a, b); total += l; if (i < start) offset += l; if (i >= start && i < end) seg += l;
  }
  if (!total || !seg) return null;
  return { path: segment, start: segment[0], end: segment[segment.length - 1], progress: Math.max(0, Math.min(1, (rideProgress(ride) * total - offset) / seg)) };
}
export function routePointForGps(location, path) {
  if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng)) || !path || path.length < 2) return null;
  const lat = Number(location.lat), lng = Number(location.lng), cos = Math.cos(lat * Math.PI / 180), pt = [lng * cos, lat];
  let nearest = null;
  for (let i = 0; i < path.length - 1; i++) {
    const from = CITY_GEO[path[i]], to = CITY_GEO[path[i + 1]], s = P[path[i]], e = P[path[i + 1]];
    if (!from || !to || !s || !e) continue;
    const a = [from[1] * cos, from[0]], b = [to[1] * cos, to[0]], dx = b[0] - a[0], dy = b[1] - a[1];
    const f = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const dd = Math.hypot(pt[0] - (a[0] + dx * f), pt[1] - (a[1] + dy * f));
    if (!nearest || dd < nearest.distance) nearest = { distance: dd, x: s[1] + (e[1] - s[1]) * f, y: s[2] + (e[2] - s[2]) * f, angle: Math.atan2(e[2] - s[2], e[1] - s[1]) * 180 / Math.PI };
  }
  return nearest;
}
export function routePointForProgress(progress, path) {
  if (!path || path.length < 2) return null;
  const lengths = []; let total = 0;
  for (let i = 0; i < path.length - 1; i++) { const f = P[path[i]], t = P[path[i + 1]]; const l = f && t ? Math.hypot(t[1] - f[1], t[2] - f[2]) : 0; lengths.push(l); total += l; }
  if (!total) return null;
  let rem = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < lengths.length; i++) {
    const f = P[path[i]], t = P[path[i + 1]], l = lengths[i];
    if (rem <= l || i === lengths.length - 1) { const part = l ? Math.min(1, rem / l) : 0; return { x: f[1] + (t[1] - f[1]) * part, y: f[2] + (t[2] - f[2]) * part, angle: Math.atan2(t[2] - f[2], t[1] - f[1]) * 180 / Math.PI }; }
    rem -= l;
  }
  return null;
}
