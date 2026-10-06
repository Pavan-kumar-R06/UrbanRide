/* Server-side copy of the city graph used by the browser map.
   Keep node ids, positions and edges identical to client/src/lib/cityGraph.js */
const P = {
  ec: ['Electronic City', 18, 88], hsr: ['HSR Layout', 33, 74], kor: ['Koramangala', 42, 60],
  jay: ['Jayanagar', 22, 52], mg: ['MG Road', 52, 42], ind: ['Indiranagar', 64, 46],
  mar: ['Marathahalli', 77, 54], wf: ['Whitefield', 87, 42], mal: ['Malleshwaram', 38, 30],
  ya: ['Yeshwanthpur', 24, 22], heb: ['Hebbal', 50, 10]
};
const E = [['ec','hsr'],['hsr','kor'],['kor','jay'],['kor','mg'],['jay','mg'],['mg','ind'],['ind','mar'],['mar','wf'],['mg','mal'],['mal','ya'],['mal','heb'],['ya','heb'],['kor','ind'],['hsr','mar']];
const CITY_GEO = {
  ec: [12.839, 77.677], hsr: [12.911, 77.644], kor: [12.935, 77.624], jay: [12.925, 77.583],
  mg: [12.975, 77.606], ind: [12.978, 77.641], mar: [12.956, 77.701], wf: [12.970, 77.750],
  mal: [13.003, 77.564], ya: [13.028, 77.540], heb: [13.035, 77.598]
};
const SCALE = 0.3; // graph units -> km (same as the browser)

const d = (a, b) => Math.hypot(P[a][1] - P[b][1], P[a][2] - P[b][2]);
const edgeKey = (a, b) => [a, b].sort().join('-');
const rn = path => P[path[0]][0] + ' → ' + P[path[path.length - 1]][0];
const nodeName = k => (P[k] ? P[k][0] : k);

/* Dijkstra. `blocked` is a Set of edgeKey strings that must not be used. */
const routeCache = new Map();
function route(a, b, blocked = new Set()) {
  // Unblocked routes never change, so remember them (there are only 11x11 pairs).
  if (!blocked.size) {
    const key = a + '>' + b;
    if (!routeCache.has(key)) routeCache.set(key, computeRoute(a, b, blocked));
    const hit = routeCache.get(key);
    return hit && hit.slice();
  }
  return computeRoute(a, b, blocked);
}
function computeRoute(a, b, blocked) {
  const D = { [a]: 0 }, pr = {}, q = new Set(Object.keys(P));
  while (q.size) {
    let u = null;
    q.forEach(k => { if (D[k] !== undefined && (u === null || D[k] < D[u])) u = k; });
    if (u === null || u === b) break;
    q.delete(u);
    E.forEach(([x, y]) => {
      if (blocked.has(edgeKey(x, y))) return;
      const v = x === u ? y : y === u ? x : null;
      if (v && q.has(v)) {
        const n = D[u] + d(u, v);
        if (D[v] === undefined || n < D[v]) { D[v] = n; pr[v] = u; }
      }
    });
  }
  if (a !== b && pr[b] === undefined) return null; // unreachable
  const p = [b];
  while (p[0] !== a && pr[p[0]]) p.unshift(pr[p[0]]);
  return p;
}
const rt3 = (a, v, b) => v && v !== a && v !== b ? route(a, v).concat(route(v, b).slice(1)) : route(a, b);
const km = (p, i = 0, j = p.length - 1) => { let s = 0; for (let k = i; k < j; k++) s += d(p[k], p[k + 1]); return +(s * SCALE).toFixed(1); };
const near = (p, l) => { let bi = 0, bd = 1e9; p.forEach((x, i) => { const v = d(x, l); if (v < bd) { bd = v; bi = i; } }); return [bi, bd]; };
const pathEdges = p => p.slice(0, -1).map((x, i) => edgeKey(x, p[i + 1]));
const directKm = (a, b) => km(route(a, b));
const straightKm = (a, b) => +(d(a, b) * SCALE).toFixed(1);

const PLATFORM_FEE_PCT = 0;
const priceFor = (k, rate, seats = 1) => {
  const perSeat = Math.max(1, Math.round(k * rate)), base = perSeat * seats, fee = Math.round(base * PLATFORM_FEE_PCT / 100);
  return { k, perSeat, seats, base, fee, total: base + fee };
};

const SPEED = { car: 25, bike: 28, scooter: 24 }; // km/h in city traffic
const minsOf = t => { const [a, b] = String(t || '00:00').split(':'); return (+a) * 60 + (+b || 0); };
/* minutes after midnight when ride r reaches path index idx */
const etaMinutes = (ride, idx) => minsOf(ride.time) + km(ride.path, 0, idx) / (SPEED[ride.vtype] || SPEED.car) * 60;

module.exports = { P, E, CITY_GEO, SCALE, d, edgeKey, rn, nodeName, route, rt3, km, near, pathEdges, directKm, straightKm, priceFor, PLATFORM_FEE_PCT, SPEED, minsOf, etaMinutes, scheduledAt: r => new Date(`${r.date}T${r.time || '00:00'}:00`) };