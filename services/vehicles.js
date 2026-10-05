/* Vehicle ecosystem: cars, bikes, scooters + Vehicle Passport */
const crypto = require('crypto');

const VEHICLE_TYPES = {
  car:     { label: 'Car',     emoji: '🚗', maxSeats: 6, defaultSeats: 3, defaultRate: 8 },
  bike:    { label: 'Bike',    emoji: '🏍️', maxSeats: 1, defaultSeats: 1, defaultRate: 5 },
  scooter: { label: 'Scooter', emoji: '🛵', maxSeats: 1, defaultSeats: 1, defaultRate: 4 }
};
const MAINTENANCE = ['active', 'due', 'inactive'];
// Fee a driver pays from the Mobility Wallet to clear a 'service due' flag (INR)
const SERVICE_FEES = { car: 500, bike: 250, scooter: 200 };
const serviceFeeFor = type => SERVICE_FEES[type] || SERVICE_FEES.car;
const REG_RE = /[A-Z]{2}\s?-?\d{1,2}\s?-?[A-Z]{0,3}\s?-?\d{4}/i;

const isType = t => Object.prototype.hasOwnProperty.call(VEHICLE_TYPES, t);

/* Accepts the old free-text form ("Honda City · KA01 AB 1234") or structured fields. */
function normalizeVehicle(input = {}) {
  const raw = typeof input === 'string' ? { m: input } : input;
  let { make = '', model = '', reg = '', year = null, color = '', type = 'car', m = '' } = raw;
  make = String(make || '').trim(); model = String(model || '').trim();
  reg = String(reg || '').trim().toUpperCase();
  m = String(m || '').trim();
  if (!reg && m) { const hit = m.match(REG_RE); if (hit) reg = hit[0].toUpperCase(); }
  if (!m) m = [make, model].filter(Boolean).join(' ') + (reg ? ' · ' + reg : '');
  if (!m) return null;
  year = Number(year);
  const thisYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1990 || year > thisYear + 1) year = null;
  return { m: m.slice(0, 120), type: isType(type) ? type : 'car', make: make.slice(0, 40), model: model.slice(0, 40), reg: reg.slice(0, 20), year, color: String(color || '').trim().slice(0, 30) };
}

const passportId = car => 'UR-' + crypto.createHash('sha1').update(String(car.reg || car.m)).digest('hex').slice(0, 8).toUpperCase();

/* stats = { completedTrips, avgRating, ratingCount } computed by the route from live data */
function buildPassport(user, stats) {
  const car = user.car || {};
  const now = new Date();
  const age = car.year ? Math.max(0, now.getFullYear() - car.year) : null;
  const approved = car.st === 'approved';
  const validUntil = car.verifiedUntil ? new Date(car.verifiedUntil) : null;
  const verificationValid = approved && (!validUntil || validUntil > now);
  const t = VEHICLE_TYPES[car.type] || VEHICLE_TYPES.car;
  return {
    id: passportId(car),
    type: car.type || 'car', typeLabel: t.label, emoji: t.emoji,
    vehicle: [car.make, car.model].filter(Boolean).join(' ') || car.m,
    registration: car.reg || '—',
    color: car.color || '—',
    owner: user.name,
    ownerVerified: !user.blocked && approved,
    vehicleAge: age,
    year: car.year || null,
    completedTrips: stats.completedTrips,
    averageRating: stats.avgRating,
    ratingCount: stats.ratingCount,
    maintenance: MAINTENANCE.includes(car.maintenance) ? car.maintenance : 'active',
    serviceFee: serviceFeeFor(car.type),
    lastServiceAt: car.lastServiceAt || null,
    reactivationRequested: !!car.reactivationRequested,
    verification: verificationValid ? 'Valid' : approved ? 'Expired' : car.st === 'rejected' ? 'Rejected' : 'Pending',
    verifiedUntil: validUntil
  };
}

module.exports = { VEHICLE_TYPES, MAINTENANCE, SERVICE_FEES, serviceFeeFor, isType, normalizeVehicle, buildPassport, passportId };
