const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');
const hasActiveJourney = require('../middleware/active-journey');
const wallet = require('../services/wallet');
const { notifyUser } = require('../services/notify');
const { handoverAfterLeg } = require('../services/ride-events');
const { verifiedNetworkIds, rideVisible } = require('../services/networks');
const { priceFor, km } = require('../services/city-graph');

const router = express.Router();
const CITY_GEO={
  ec:[12.839,77.677],hsr:[12.911,77.644],kor:[12.935,77.624],jay:[12.925,77.583],
  mg:[12.975,77.606],ind:[12.978,77.641],mar:[12.956,77.701],wf:[12.970,77.750],
  mal:[13.003,77.564],ya:[13.028,77.540],heb:[13.035,77.598]
};

function segmentProgress(ride,booking){
  if(ride.status==='completed')return 1;
  if(!ride.startedAt||!ride.estimatedDurationMinutes)return 0;
  const start=ride.path.indexOf(booking.f),end=ride.path.indexOf(booking.t);
  if(start<0||end<=start)return 0;
  const distance=(from,to)=>{
    const radians=value=>value*Math.PI/180;
    const lat1=radians(from[0]),lat2=radians(to[0]),dLat=lat2-lat1,dLng=radians(to[1]-from[1]);
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  };
  let total=0,segment=0,offset=0;
  for(let index=0;index<ride.path.length-1;index++){
    const from=CITY_GEO[ride.path[index]],to=CITY_GEO[ride.path[index+1]];
    if(!from||!to)continue;
    const leg=distance(from,to);
    total+=leg;
    if(index<start)offset+=leg;
    if(index>=start&&index<end)segment+=leg;
  }
  if(!total||!segment)return 0;
  const overall=Math.max(0,Math.min(1,(Date.now()-new Date(ride.startedAt).getTime())/(ride.estimatedDurationMinutes*60000)));
  return Math.max(0,Math.min(1,(overall*total-offset)/segment));
}

async function promoteWaitlistedPassengers(rideId){
  while(true){
    const ride=await Ride.findById(rideId).select('seats');
    if(!ride||ride.seats<1)return;
    const candidate=await Booking.findOneAndUpdate(
      {rid:String(rideId),st:'waitlisted',seats:{$lte:ride.seats}},
      {$set:{st:'promoting'}},
      {new:true,sort:{createdAt:1}}
    );
    if(!candidate)return;
    const reserved=await Ride.findOneAndUpdate(
      {_id:rideId,seats:{$gte:candidate.seats}},
      {$inc:{seats:-candidate.seats}},
      {new:true}
    );
    if(!reserved){
      await Booking.updateOne({_id:candidate._id,st:'promoting'},{$set:{st:'waitlisted'}});
      return;
    }
    await Booking.updateOne({_id:candidate._id,st:'promoting'},{$set:{st:'pending'}});
  }
}

router.get('/bookings', async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      const ownedRides = await Ride.find({ own: req.user.id }).select('_id').lean();
      query = {
        $or: [
          { pid: req.user.id },
          { rid: { $in: ownedRides.map(ride => String(ride._id)) } }
        ]
      };
    }
    const bookings = await Booking.find(query).sort({ createdAt: -1 }).limit(100);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

/* Shared by single bookings and by multi-vehicle journeys. Throws {status, error} on failure. */
async function createBookingRecord(userId, body, extra = {}) {
  let reservedRideId;
  const fail = (status, error) => Object.assign(new Error(error), { status });
  try {
    const { rid, f, t, seats = 1, fare = 0, fee = 0 } = body;
    const passenger = await User.findById(userId).select('name blocked role');
    if (!passenger || passenger.blocked) throw fail(403, 'This account cannot book rides.');
    if (await hasActiveJourney(userId) && !extra.skipActiveCheck) throw fail(409, 'Complete your current trip before booking another ride.');
    if (!rid || !f || !t || !Number.isInteger(Number(seats)) || Number(seats) < 1) throw fail(400, 'Ride, passenger, route, and a positive seat count are required.');
    if (![fare, fee].every(value => Number.isFinite(Number(value)) && Number(value) >= 0)) throw fail(400, 'Fare and fee must be non-negative numbers.');
    const settings = await wallet.getSettings();
    let chargeFare = Number(fare), chargeFee = Number(fee);
    let bookingStatus = 'pending';
    if (mongoose.isValidObjectId(rid)) {
      const candidateRide = await Ride.findById(rid).select('status seats path networkId own rate');
      if (!candidateRide) throw fail(404, 'Ride not found.');
      if (candidateRide.status !== 'scheduled') throw fail(409, 'This ride is not accepting bookings.');
      if (String(candidateRide.own) === String(userId)) throw fail(400, 'You cannot book your own ride.');
      const nets = await verifiedNetworkIds(userId);
      if (!rideVisible(candidateRide, nets, userId, passenger.role)) throw fail(403, 'This ride is only open to verified members of a private network.');
      const i = candidateRide.path.indexOf(f), j = candidateRide.path.indexOf(t);
      if (i < 0 || j <= i) throw fail(400, 'Pickup and drop-off must be on the ride route, in order.');
      const price = priceFor(km(candidateRide.path, i, j), candidateRide.rate, Number(seats)); // server is the source of truth for money
      chargeFare = price.base; chargeFee = price.fee;
      if (settings.mode === 'start' && !extra.skipBalanceCheck) {
        const bal = ((await User.findById(userId).select('walletBalance').lean()) || {}).walletBalance || 0;
        const need = chargeFare + chargeFee + (extra.alreadyCommitted || 0);
        if (bal < need) throw fail(402, `Wallet balance ₹${bal} is below the fare ₹${need}. Top up your Mobility Wallet to book (rides are paid when they start).`);
      }
      const ride = await Ride.findOneAndUpdate(
        { _id: rid, status: 'scheduled', seats: { $gte: Number(seats) } },
        { $inc: { seats: -Number(seats) } },
        { new: true }
      );
      if (!ride) {
        bookingStatus = 'waitlisted';
      } else {
        reservedRideId = ride._id;
      }
    }
    const booking = await Booking.create({ rid: String(rid), pid: userId, pn: passenger.name, f, t, seats: Number(seats), fare: chargeFare, fee: chargeFee, st: bookingStatus, paymentMode: settings.mode, ...extra.fields });
    return booking;
  } catch (err) {
    if (reservedRideId) await Ride.updateOne({ _id: reservedRideId }, { $inc: { seats: Number(body.seats || 1) } });
    throw err;
  }
}

router.post('/bookings', async (req, res) => {
  try {
    res.status(201).json(await createBookingRecord(req.user.id, req.body));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Booking creation error:', err);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
});

router.post('/bookings/:id/complete-leg', async (req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid booking id.'});
    const booking=await Booking.findById(req.params.id);
    if(!booking)return res.status(404).json({error:'Booking not found.'});
    if(String(booking.pid)!==req.user.id)return res.status(403).json({error:'Only the passenger can complete this trip segment.'});
    if(booking.st!=='confirmed')return res.status(409).json({error:'Only a confirmed booking can be completed.'});
    if(booking.tripCompletedAt)return res.json(booking);
    const ride=mongoose.isValidObjectId(booking.rid)?await Ride.findById(booking.rid):null;
    if(!ride)return res.status(404).json({error:'Ride not found.'});
    if(ride.status!=='completed'&&segmentProgress(ride,booking)<1)return res.status(409).json({error:'Your drop-off point has not been reached yet.'});
    booking.tripCompletedAt=new Date();
    await booking.save();
    await handoverAfterLeg(booking);
    res.json(booking);
  }catch(err){res.status(500).json({error:'Failed to complete passenger trip.'})}
});

router.put('/bookings/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking id.' });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const { st, rated } = req.body;
    const ride = mongoose.isValidObjectId(booking.rid) ? await Ride.findById(booking.rid).select('own status') : null;
    const isAdmin = req.user.role === 'admin';
    const isPassenger = booking.pid === req.user.id;
    const isDriver = ride && String(ride.own) === req.user.id;
    if (!isAdmin && !isPassenger && !isDriver) {
      return res.status(403).json({ error: 'You cannot update this booking.' });
    }
    if (!isAdmin && isPassenger && st !== undefined && st !== 'cancelled') {
      return res.status(403).json({ error: 'Passengers may only cancel their own booking.' });
    }
    if (!isAdmin && isDriver && rated !== undefined) {
      return res.status(403).json({ error: 'Only the passenger may rate this booking.' });
    }
    if (st !== undefined && !['confirmed', 'rejected', 'cancelled', 'ride-cancelled', 'waitlisted'].includes(st)) {
      return res.status(400).json({ error: 'Invalid booking status.' });
    }
    if (rated !== undefined && (!Number.isInteger(rated) || rated < 1 || rated > 5 || !isPassenger || (!booking.tripCompletedAt&&ride?.status!=='completed'))) {
      return res.status(400).json({ error: 'A rating from 1 to 5 can be submitted by the passenger after ride completion.' });
    }
    const releaseSeats = st && ['cancelled', 'rejected', 'ride-cancelled'].includes(st) && !['cancelled', 'rejected', 'ride-cancelled','waitlisted'].includes(booking.st);
    const previousSt = booking.st;
    if (st !== undefined) {
      booking.st = st;
      if (['confirmed', 'rejected'].includes(st)) booking.decidedAt = new Date();
      if (['cancelled', 'rejected', 'ride-cancelled'].includes(st)) {
        booking.cancelledAt = new Date();
        booking.cancelledAfterConfirm = st === 'cancelled' && previousSt === 'confirmed';
      }
    }
    if (rated !== undefined) booking.rated = rated;
    await booking.save();
    if (st === 'cancelled' && previousSt !== 'cancelled' && ride) {
      const fullRide = await Ride.findById(booking.rid);
      if (fullRide) await wallet.onPassengerCancel(fullRide, booking, previousSt === 'confirmed');
      if (booking.journeyId) {
        const siblings = await Booking.find({ journeyId: booking.journeyId, _id: { $ne: booking._id }, st: { $in: ['pending', 'confirmed'] } });
        for (const sib of siblings) {
          sib.st = 'cancelled'; sib.cancelledAt = new Date(); await sib.save();
          await Ride.updateOne({ _id: sib.rid }, { $inc: { seats: sib.seats } });
          await notifyUser(sib.pid, 'The other leg of your multi-vehicle journey was cancelled, so this leg was cancelled too.', 'Journey', 'bookings');
        }
      }
    }
    if (st === 'rejected' && booking.journeyId) {
      await notifyUser(booking.pid, `A driver declined leg ${booking.legIndex + 1} of your multi-vehicle journey. Open My bookings to rebook that leg or cancel the journey.`, 'Journey', 'bookings');
    }

    if (releaseSeats && ride && mongoose.isValidObjectId(booking.rid)) {
      await Ride.updateOne({ _id: booking.rid }, { $inc: { seats: booking.seats } });
      await promoteWaitlistedPassengers(booking.rid);
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking.' });
  }
});

module.exports = router;
module.exports.createBookingRecord = createBookingRecord;