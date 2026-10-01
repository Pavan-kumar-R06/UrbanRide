const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const Ride = require('../models/Ride');

const router = express.Router();

router.get('/messages/inbox', async (req, res) => {
  try {
    const [ownedRideIds, bookedRideIds] = await Promise.all([
      Ride.distinct('_id', { own: req.user.id }),
      Booking.distinct('rid', { pid: req.user.id, st: { $nin: ['cancelled','rejected','ride-cancelled'] } })
    ]);
    const rideIds=[...new Set([...ownedRideIds,...bookedRideIds].map(String))];
    if(!rideIds.length)return res.json([]);
    const requestedAfter=Date.parse(req.query.after);
    const after=new Date(Number.isFinite(requestedAfter)?requestedAfter:Date.now()-300000);
    const messages=await Message.find({
      rid:{$in:rideIds},
      uid:{$ne:req.user.id},
      createdAt:{$gt:after}
    }).sort({createdAt:-1}).limit(50).lean();
    res.json(messages.map(message=>({...message,id:String(message._id),_id:String(message._id)})));
  }catch(err){
    res.status(500).json({error:'Failed to fetch recent messages.'});
  }
});

async function canAccessConversation(rideId, user) {
  if (user.role === 'admin') return true;
  if (mongoose.isValidObjectId(rideId)) {
    const ride = await Ride.findById(rideId).select('own');
    if (ride && String(ride.own) === user.id) return true;
  }
  return Boolean(await Booking.exists({
    rid: String(rideId),
    pid: user.id,
    st: { $nin: ['cancelled', 'rejected', 'ride-cancelled'] }
  }));
}

router.get('/messages/:rideId', async (req, res) => {
  try {
    if (!await canAccessConversation(req.params.rideId, req.user)) {
      return res.status(403).json({ error: 'You are not a participant in this ride conversation.' });
    }
    const messages = await Message.find({ rid: String(req.params.rideId) }).sort({ createdAt: -1 }).limit(100).lean();
    messages.reverse();
    res.json(messages.map(message => ({ ...message, id: String(message._id), _id: String(message._id) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ride messages.' });
  }
});

router.post('/messages/:rideId', async (req, res) => {
  try {
    if (!await canAccessConversation(req.params.rideId, req.user)) {
      return res.status(403).json({ error: 'You are not a participant in this ride conversation.' });
    }
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 2000) {
      return res.status(400).json({ error: 'Message must contain 1 to 2000 characters.' });
    }
    const message = await Message.create({
      rid: String(req.params.rideId),
      uid: req.user.id,
      n: req.user.name,
      t: text,
      tm: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    res.status(201).json({ ...message.toObject(), id: String(message._id), _id: String(message._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send ride message.' });
  }
});

module.exports = router;