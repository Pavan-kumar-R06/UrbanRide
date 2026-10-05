/* Journey DNA - a 10-gene fingerprint for every journey (single ride or multi-vehicle).
   Genes: Distance, Time, route complexity (K), Passengers, Vehicle, Stops, Weather, Transfers, Cost, Reliability */
const crypto = require('crypto');
const { E, P, km, directKm, SPEED, SCALE } = require('./city-graph');
const { VEHICLE_TYPES } = require('./vehicles');

const lvl = (v, max) => Math.max(0, Math.min(9, Math.round(v / max * 9)));
const degree = k => E.filter(([a, b]) => a === k || b === k).length;

/* legs: [{ path, f, t, vtype, seats, fare, fee, reliability (0-100|null), waitMinutes }] */
function computeJourneyDNA({ legs, weather = { label: 'Clear', level: 0 }, trafficFactor = 1 }) {
  let distance = 0, minutes = 0, stops = 0, junctions = 0, hops = 0, cost = 0, direct = 0, rel = [];
  const types = new Set();
  let passengers = 1;
  legs.forEach((leg, n) => {
    const i = leg.path.indexOf(leg.f), j = leg.path.indexOf(leg.t);
    const seg = leg.path.slice(i, j + 1);
    const k = km(leg.path, i, j);
    distance += k;
    minutes += k / (SPEED[leg.vtype] || SPEED.car) * 60 * trafficFactor + (n ? (leg.waitMinutes || 0) : 0);
    stops += Math.max(0, seg.length - 2);
    hops += seg.length - 1;
    seg.slice(1, -1).forEach(h => { if (degree(h) >= 4) junctions++; });
    cost += Number(leg.fare || 0) + Number(leg.fee || 0);
    types.add(leg.vtype || 'car');
    passengers = Math.max(passengers, Number(leg.seats || 1));
    if (leg.reliability != null) rel.push(leg.reliability);
    direct += 0;
  });
  const first = legs[0], last = legs[legs.length - 1];
  const o = first.f, dest = last.t;
  const straight = Math.hypot(P[o][1] - P[dest][1], P[o][2] - P[dest][2]) * SCALE || 1;
  const detour = Math.max(1, distance / straight);
  const complexity = Math.min(100, Math.round(hops * 9 + (detour - 1) * 60 + junctions * 8 + (legs.length - 1) * 12));
  const transfers = legs.length - 1;
  const reliability = rel.length ? Math.round(rel.reduce((a, b) => a + b, 0) / rel.length) : null;
  const vlabel = [...types].map(t => (VEHICLE_TYPES[t] || VEHICLE_TYPES.car).label).join(' + ');
  const vcode = types.size > 1 ? 'M' : ({ car: 'C', bike: 'B', scooter: 'S' }[[...types][0]] || 'C');
  const vlevel = types.size > 1 ? 8 : ({ car: 5, bike: 3, scooter: 2 }[[...types][0]] || 5);

  const genes = [
    { key: 'distance', code: 'D', label: 'Distance', display: distance.toFixed(1) + ' km', level: lvl(distance, 30) },
    { key: 'time', code: 'T', label: 'Time', display: Math.round(minutes) + ' min', level: lvl(minutes, 90) },
    { key: 'complexity', code: 'K', label: 'Route complexity', display: complexity + '/100', level: lvl(complexity, 100) },
    { key: 'passengers', code: 'P', label: 'Passengers', display: String(passengers), level: Math.min(9, passengers) },
    { key: 'vehicle', code: vcode, label: 'Vehicle type', display: vlabel, level: vlevel },
    { key: 'stops', code: 'S', label: 'Stops', display: String(stops), level: Math.min(9, stops * 2) },
    { key: 'weather', code: 'W', label: 'Weather', display: weather.label, level: weather.level },
    { key: 'transfers', code: 'X', label: 'Transfers', display: String(transfers), level: Math.min(9, transfers * 4) },
    { key: 'cost', code: '₹', label: 'Cost', display: '₹' + cost, level: lvl(cost, 400) },
    { key: 'reliability', code: 'R', label: 'Reliability', display: reliability === null ? 'New' : reliability + '/100', level: reliability === null ? 5 : lvl(reliability, 100) }
  ];
  const signature = genes.map(g => g.code + g.level).join('·');
  const id = 'JD-' + crypto.createHash('sha1').update(signature + legs.map(l => l.path.join('')).join('|')).digest('hex').slice(0, 6).toUpperCase();
  const traits = [];
  if (transfers) traits.push('Multi-vehicle');
  if (complexity >= 60) traits.push('Complex route'); else if (complexity <= 25) traits.push('Straightforward');
  if (weather.level >= 5) traits.push('Weather-affected');
  if (reliability !== null && reliability >= 90) traits.push('Highly reliable');
  if (distance <= 6) traits.push('Short hop'); else if (distance >= 18) traits.push('Long haul');
  return { id, signature, genes, traits, summary: { distance: +distance.toFixed(1), minutes: Math.round(minutes), cost, transfers, stops, passengers, detourRatio: +detour.toFixed(2), weather: weather.label } };
}

module.exports = { computeJourneyDNA };
