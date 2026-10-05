const Notification = require('../models/Notification');
async function notifyUser(uid, t, from = 'System', go = 'notif') {
  if (!uid) return null;
  try { return await Notification.create({ uid: String(uid), t, from, go }); }
  catch (e) { console.error('notify failed:', e.message); return null; }
}
module.exports = { notifyUser };
