const Network = require('../models/Network');

async function verifiedNetworkIds(uid) {
  const nets = await Network.find({ active: true, 'members.uid': String(uid) }).select('members').lean();
  return new Set(nets.filter(n => n.members.some(m => String(m.uid) === String(uid) && m.status === 'verified')).map(n => String(n._id)));
}
/* A ride tied to a private network is visible only to verified members and its owner. */
const rideVisible = (ride, netIds, userId, role) => role === 'admin' || !ride.networkId || String(ride.own) === String(userId) || netIds.has(String(ride.networkId));

module.exports = { verifiedNetworkIds, rideVisible };
