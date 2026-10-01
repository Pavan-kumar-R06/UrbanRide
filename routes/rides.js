const express = require('express');
const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Message = require('../models/Message');

const router = express.Router();
const CITY_GEO={
  ec:[12.839,77.677],hsr:[12.911,77.644],kor:[12.935,77.624],jay:[12.925,77.583],
  mg:[12.975,77.606],ind:[12.978,77.641],mar:[12.956,77.701],wf:[12.970,77.750],
  mal:[13.003,77.564],ya:[13.028,77.540],heb:[13.035,77.598]
};
let lastCompletionSweep=0;

function distanceMeters(a,b){
  const radians=value=>value*Math.PI/180;
  const lat1=radians(a[0]),lat2=radians(b[0]),dLat=lat2-lat1,dLng=radians(b[1]-a[1]);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

function estimateDurationMinutes(path){
  let distance=0;
  for(let index=0;index<(path||[]).length-1;index++){
    const from=CITY_GEO[path[index]],to=CITY_GEO[path[index+1]];
    if(from&&to)distance+=distanceMeters(from,to)/1000;
  }
  return Math.max(8,Math.ceil(distance/35*60+5));
}

async function syncActiveRideProgress(){
  if(Date.now()-lastCompletionSweep<2000)return;
  lastCompletionSweep=Date.now();
  const active=await Ride.find({status:'active'}).limit(100);
  const progressById=new Map(),now=Date.now();
  for(const ride of active){
    if(!ride.startedAt){
      ride.startedAt=new Date(now);
      ride.estimatedDurationMinutes=estimateDurationMinutes(ride.path);
      await ride.save();
    }
    const duration=Math.max(1,Number(ride.estimatedDurationMinutes||estimateDurationMinutes(ride.path)))*60000;
    const progress=Math.max(0,Math.min(1,(now-new Date(ride.startedAt).getTime())/duration));
    if(progress>=1){
      ride.status='completed';
      ride.completedAt=new Date(now);
      ride.prog=1;
      ride.location=undefined;
      await ride.save();
    }
    progressById.set(String(ride._id),progress);
  }
  return progressById;
}

router.get('/rides', async (req, res) => {
  try {
    const progressById=await syncActiveRideProgress()||new Map();
    const rides = await Ride.find().sort({ createdAt: -1 }).limit(100);
    if (req.user.role === 'admin') return res.json(rides.map(ride=>{
      const data=ride.toObject();
      if(progressById.has(String(ride._id)))data.prog=progressById.get(String(ride._id));
      return data;
    }));
    const rideIds = rides.map(ride => String(ride._id));
    const passengerRides = await Booking.find({
      pid: req.user.id,
      rid: { $in: rideIds },
      st: 'confirmed'
    }).distinct('rid');
    const visibleRideIds = new Set(passengerRides.map(String));
    res.json(rides.map(ride => {
      const data = ride.toObject();
      if(progressById.has(String(ride._id)))data.prog=progressById.get(String(ride._id));
      if (String(ride.own) !== req.user.id && !visibleRideIds.has(String(ride._id))) delete data.location;
      return data;
    }));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rides.' });
  }
});

router.put('/rides/:id/location', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ride id.' });
    const { lat, lng, accuracy } = req.body;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0))) {
      return res.status(400).json({ error: 'Valid GPS coordinates and accuracy are required.' });
    }
    const ride = await Ride.findOne({
      _id: req.params.id,
      own: req.user.id,
      status: { $in: ['boarding', 'active'] }
    });
    if (!ride) return res.status(404).json({ error: 'Only the driver of an active ride can share its location.' });
    const now=new Date();
    const destination=CITY_GEO[ride.path[ride.path.length-1]];
    const arrived=destination&&distanceMeters([lat,lng],destination)<=Math.max(200,Math.min(500,accuracy||0));
    const duration=Number(ride.estimatedDurationMinutes||estimateDurationMinutes(ride.path));
    const timedOut=ride.status==='active'&&ride.startedAt&&now-new Date(ride.startedAt).getTime()>=duration*60000;
    if((ride.status==='active'&&arrived)||timedOut){
      ride.status='completed';
      ride.completedAt=now;
      ride.prog=1;
      ride.location=undefined;
    }else{
      ride.location = { lat, lng, accuracy, updatedAt: now };
    }
    await ride.save();
    res.json({ status: ride.status, completedAt: ride.completedAt, prog: ride.prog, location: ride.location||null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ride location.' });
  }
});

router.delete('/rides/:id/location', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ride id.' });
    const ride = await Ride.findOne({ _id: req.params.id, own: req.user.id });
    if (!ride) return res.status(404).json({ error: 'Ride not found.' });
    ride.location = undefined;
    await ride.save();
    res.json({ stopped: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop ride location sharing.' });
  }
});

router.post('/rides', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name car blocked');
    if (!user || user.blocked) return res.status(403).json({ error: 'This account cannot publish rides.' });
    if (!user.car || user.car.st !== 'approved') {
      return res.status(403).json({ error: 'Your vehicle has not been verified by an administrator yet.' });
    }
    const fields = ['path', 'time', 'date', 'cap', 'seats', 'rate', 'pf', 'rep', 'note'];
    const rideData = Object.fromEntries(fields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]]));
    const ride = new Ride({
      ...rideData,
      own: req.user.id,
      drv: user.name,
      veh: user.car.m
    });
    await ride.save();
    res.status(201).json(ride);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ride.' });
  }
});

router.put('/rides/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ride id.' });
    }
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found.' });
    if (req.user.role !== 'admin' && String(ride.own) !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own rides.' });
    }
    const fields = ['status', 'prog', 'rt'];
    const updates = Object.fromEntries(fields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]]));
    if(updates.status==='active'&&ride.status!=='active'){
      ride.startedAt=new Date();
      ride.completedAt=null;
      ride.estimatedDurationMinutes=estimateDurationMinutes(ride.path);
      ride.prog=0;
    }
    if(updates.status==='completed'){
      ride.completedAt=new Date();
      ride.prog=1;
      ride.location=undefined;
    }
    Object.assign(ride, updates);
    await ride.save();
    res.json(ride);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ride.' });
  }
});

router.delete('/rides/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ride id.' });
    const ride = await Ride.findById(req.params.id).select('_id');
    if (!ride) return res.status(404).json({ error: 'Ride not found.' });
    const rideId = String(ride._id);
    await Promise.all([
      Booking.deleteMany({ rid: rideId }),
      Message.deleteMany({ rid: rideId }),
      Ride.deleteOne({ _id: ride._id })
    ]);
    res.json({ deleted: true, rideId });
  } catch (err) {
    console.error('Ride deletion error:', err);
    res.status(500).json({ error: 'Failed to delete ride and related records.' });
  }
});

module.exports = router;