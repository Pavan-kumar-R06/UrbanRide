const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Network = require('../models/Network');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { requireAdmin } = require('../middleware/auth');
const { notifyUser } = require('../services/notify');
const router = express.Router();

const clean = (n, uid, isAdmin) => {
  const me = n.members.find(m => String(m.uid) === String(uid));
  const base = { id: String(n._id), _id: String(n._id), name: n.name, kind: n.kind, domain: n.domain, description: n.description, active: n.active, createdAt: n.createdAt,
    verifiedCount: n.members.filter(m => m.status === 'verified').length, myStatus: me ? me.status : null };
  if (!isAdmin) return base;
  return { ...base, inviteCode: n.inviteCode, pendingCount: n.members.filter(m => m.status === 'pending').length, members: n.members };
};
const domainOk = (email, domain) => { const e = String(email || '').toLowerCase(); return !!domain && (e.endsWith('@' + domain) || e.endsWith('.' + domain)); };

router.get('/networks', async (req, res) => {
  try {
    const admin = req.user.role === 'admin';
    const nets = await Network.find(admin ? {} : { active: true }).sort({ createdAt: -1 }).limit(100).lean();
    res.json(nets.map(n => clean(n, req.user.id, admin)));
  } catch (e) { res.status(500).json({ error: 'Failed to load networks.' }); }
});

router.post('/networks', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 3) return res.status(400).json({ error: 'Give the network a name (3+ characters).' });
    const domain = String(req.body.domain || '').trim().toLowerCase().replace(/^@/, '');
    if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return res.status(400).json({ error: 'Enter a valid email domain such as uvce.ac.in.' });
    const net = await Network.create({
      name, kind: req.body.kind === 'company' ? 'company' : 'college', domain,
      description: String(req.body.description || '').slice(0, 300),
      inviteCode: (String(req.body.inviteCode || '').trim().toUpperCase()) || crypto.randomBytes(3).toString('hex').toUpperCase(),
      createdBy: req.user.id
    });
    res.status(201).json(clean(net.toObject(), req.user.id, true));
  } catch (e) { res.status(500).json({ error: 'Failed to create network.' }); }
});

/* Join: verified automatically only when the org e-mail domain AND the invite code both match; otherwise pending admin review. */
router.post('/networks/:id/join', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid network.' });
    const net = await Network.findById(req.params.id);
    if (!net || !net.active) return res.status(404).json({ error: 'Network not found.' });
    if (net.members.some(m => String(m.uid) === req.user.id && m.status !== 'rejected')) return res.status(409).json({ error: 'You already belong to or have requested this network.' });
    const orgEmail = String(req.body.orgEmail || '').trim().toLowerCase();
    const idNumber = String(req.body.idNumber || '').trim().slice(0, 40);
    const code = String(req.body.inviteCode || '').trim().toUpperCase();
    if (!orgEmail.includes('@')) return res.status(400).json({ error: 'Enter your organisation e-mail address.' });
    if (!idNumber) return res.status(400).json({ error: `Enter your ${net.kind === 'college' ? 'student / staff (USN)' : 'employee'} ID.` });
    if (code && code !== net.inviteCode) return res.status(400).json({ error: 'That invite code is not valid for this network.' });
    // Every request now waits for an admin. The checks below are only hints shown to the admin.
    const domainMatch = domainOk(orgEmail, net.domain), codeValid = !!code && code === net.inviteCode;
    net.members = net.members.filter(m => String(m.uid) !== req.user.id);
    net.members.push({ uid: req.user.id, name: req.user.name, orgEmail, idNumber, status: 'pending', method: 'manual', domainMatch, codeValid, decidedAt: null });
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    await Promise.all(admins.map(a => notifyUser(String(a._id), `${req.user.name} requested to join ${net.name}. Review it in Networks.`, 'Networks', 'nets')));
    await net.save();
    res.json({ status: 'pending', network: clean(net.toObject(), req.user.id, false) });
  } catch (e) { res.status(500).json({ error: 'Failed to join network.' }); }
});

router.post('/networks/:id/leave', async (req, res) => {
  try {
    const net = await Network.findById(req.params.id);
    if (!net) return res.status(404).json({ error: 'Network not found.' });
    net.members = net.members.filter(m => String(m.uid) !== req.user.id);
    await net.save();
    res.json({ left: true });
  } catch (e) { res.status(500).json({ error: 'Failed to leave network.' }); }
});

router.put('/networks/:id/members/:uid', requireAdmin, async (req, res) => {
  try {
    const status = req.body.status;
    if (!['verified', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be verified or rejected.' });
    const net = await Network.findById(req.params.id);
    const m = net && net.members.find(x => String(x.uid) === req.params.uid);
    if (!m) return res.status(404).json({ error: 'Member not found.' });
    m.status = status; m.decidedAt = new Date();
    await net.save();
    await notifyUser(m.uid, status === 'verified' ? `You are now a verified member of ${net.name}. Private rides are unlocked.` : `Your request to join ${net.name} was declined.`, 'Networks', 'networks');
    res.json(clean(net.toObject(), req.user.id, true));
  } catch (e) { res.status(500).json({ error: 'Failed to update member.' }); }
});

router.put('/networks/:id', requireAdmin, async (req, res) => {
  try {
    const net = await Network.findById(req.params.id);
    if (!net) return res.status(404).json({ error: 'Network not found.' });
    if (typeof req.body.active === 'boolean') net.active = req.body.active;
    await net.save();
    res.json(clean(net.toObject(), req.user.id, true));
  } catch (e) { res.status(500).json({ error: 'Failed to update network.' }); }
});

router.delete('/networks/:id', requireAdmin, async (req, res) => {
  try {
    await Network.deleteOne({ _id: req.params.id });
    await Ride.updateMany({ networkId: String(req.params.id) }, { $set: { networkId: null } });
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete network.' }); }
});
module.exports = router;
