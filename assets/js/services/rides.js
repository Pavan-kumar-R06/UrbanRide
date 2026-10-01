const set=(o,k,v)=>{o[k]=v;S.res=null;render()},go=v=>{S.view=v;if(['users','ver','ana'].includes(v))syncAdminData();render()};
function match(q,skip){
  return rides.filter(r=>r.status=='scheduled'&&r.id!=skip&&r.own!=(S.me&&S.me.id)&&(!q.ac||r.pf.includes('ac'))&&(!q.wo||r.pf.includes('wo'))).map(r=>{
    const[i,d1]=near(r.path,q.f),[j,d2]=near(r.path,q.t);
    if(i>=j||d1>15||d2>15)return null;
    const score=Math.round(Math.max(0,100-d1*2-d2*2-Math.abs(mins(r.time)-mins(q.time))/6)),k=km(r.path,i,j);
    return{r,score,walk:(d1*.3).toFixed(1),pick:r.path[i],drop:r.path[j],k,fare:Math.round(k*r.rate/(r.cap-r.seats+2))*q.seats}
  }).filter(x=>x&&x.score>20).sort((a,b)=>q.sort=='fare'?a.fare-b.fare:q.sort=='time'?mins(a.r.time)-mins(b.r.time):b.score-a.score);
}

function activeJourneyForUser(excludeRideId){
  const activeStatuses=['boarding','active'];
  return rides.find(ride=>String(ride.own)===String(S.me.id)&&String(ride.id)!==String(excludeRideId)&&activeStatuses.includes(ride.status))||
    rides.find(ride=>String(ride.id)!==String(excludeRideId)&&activeStatuses.includes(ride.status)&&bookings.some(booking=>String(booking.rid)===String(ride.id)&&String(booking.pid)===String(S.me.id)&&booking.st==='confirmed'&&!booking.tripCompletedAt))||null;
}

function openChatThread(threadId){
  S.th=String(threadId);
  notes.forEach(note=>{
    if(String(note.uid)===String(S.me.id)&&String(note.threadId)===S.th&&note.messageId)note.read=1;
  });
  save();
  go('chat');
}

const completingPassengerTrips=new Set();
async function completePassengerSegment(booking){
  const bookingId=String(booking._id||booking.id);
  if(booking.tripCompletedAt||completingPassengerTrips.has(bookingId))return;
  completingPassengerTrips.add(bookingId);
  try{
    const completed=await apiRequest('/bookings/'+encodeURIComponent(bookingId)+'/complete-leg',{method:'POST',body:{}});
    Object.assign(booking,completed,{id:String(completed._id||booking.id),_id:String(completed._id||booking._id)});
    save();
    toast('You reached your drop-off point.');
    if(S.view==='live')render();
  }catch(err){
    if(!err.message.includes('has not been reached'))console.warn('Passenger trip completion failed:',err.message);
  }finally{completingPassengerTrips.delete(bookingId)}
}

async function book(rid,f,t,fare,n){
  if(activeJourneyForUser())return toast('Complete your current trip before booking another ride.');
  const r=rides.find(x=>x.id==rid);
  const booking={id:nid++,rid,pid:S.me.id,pn:S.me.name,f,t,fare,seats:n,st:'pending',createdAt:new Date().toISOString()};
  try {
    await persistNewBooking(booking);
  } catch(err) {
    toast(err.message || 'Booking could not be saved. Please try again.');
    return;
  }
  if(booking.st==='waitlisted'){
    bookings.unshift(booking);
    toast('Ride is full. You joined the waitlist.');
    S.view='bookings';
    return render();
  }
  r.seats-=n;
  bookings.unshift(booking);
  if(r.own)notify(r.own,'Requested '+n+' seat(s) on your ride '+rn(r.path)+'.',S.me.name,'drive');
  logEv(S.me.name+' requested a seat on '+rn(r.path));
  toast('Seat requested. Driver notified!');
  S.view='bookings';
  render();
}

async function promote(r){
  const w=waitlist.findIndex(x=>x.rid==r.id&&r.seats>=x.seats);
  if(w>-1){
    const x=waitlist.splice(w,1)[0];
    r.seats-=x.seats;
    const booking={id:nid++,rid:r.id,pid:x.pid,pn:x.pn,f:x.f,t:x.t,fare:x.fare,seats:x.seats,st:'pending',createdAt:new Date().toISOString()};
    try {
      await persistNewBooking(booking);
      bookings.unshift(booking);
    } catch(err) {
      toast('Waitlisted booking could not be saved.');
    }
    notify(x.pid,'A seat opened up! Your booking request is now with the driver.','System','bookings');
  }
}

async function cancelB(id){
  const b=bookings.find(x=>x.id==id),r=rides.find(x=>x.id==b.rid);
  const wasWaitlisted=b.st==='waitlisted';
  b.st='cancelled';
  if(!wasWaitlisted&&r.status!='cancelled')r.seats+=b.seats;
  await persistBookingChanges(b,{st:b.st});
  if(!S.isDataActive)await promote(r);
  if(r.own)notify(r.own,b.pn+' cancelled their booking on '+rn(r.path)+'.',b.pn,'drive');
  logEv(b.pn+' cancelled a booking on '+rn(r.path));
  toast('Booking cancelled.');
  render();
}

async function decide(id,ok){
  const b=bookings.find(x=>x.id==id),r=rides.find(x=>x.id==b.rid);
  b.st=ok?'confirmed':'rejected';
  await persistBookingChanges(b,{st:b.st});
  if(!ok){r.seats+=b.seats;if(!S.isDataActive)await promote(r)}
  notify(b.pid,ok?'Your seat is confirmed for '+rn(r.path)+'.':'Your request for '+rn(r.path)+' was declined.',r.drv,'bookings');
  logEv((ok?'Accepted ':'Rejected ')+b.pn+' on '+rn(r.path));
  toast(ok?'Passenger accepted!':'Request declined.');
  render();
}

async function step(id){
  const r=rides.find(x=>x.id==id);
  const n={scheduled:'boarding',boarding:'active',active:'completed'}[r.status];
  if(['boarding','active'].includes(n)&&activeJourneyForUser(r.id))return toast('Complete your other trip before starting this ride.');
  const previousStatus=r.status;
  r.status=n;
  if(n==='completed'&&String(S.gpsRideId)===String(r.id))void stopLocationSharing();
  const persisted=await persistRideChanges(r,{status:n,prog:n=='completed'?1:r.prog});
  if(S.isDataActive&&!persisted){r.status=previousStatus;render();return}
  if(persisted)Object.assign(r,persisted,{id:String(persisted._id||r.id),_id:String(persisted._id||r._id)});
  if(n=='completed'){
    r.prog=1;
    bookings.filter(b=>b.rid==id&&b.st=='confirmed').forEach(b=>{
      notify(b.pid,'🎉 Trip Completed! Your ride '+rn(r.path)+' is completed. Please rate your driver '+r.drv+'.',r.drv,'bookings');
    });
    logEv('Trip completed: '+rn(r.path)+' by '+r.drv);
  } else {
    bookings.filter(b=>b.rid==id&&b.st=='confirmed').forEach(b=>notify(b.pid,'Your ride '+rn(r.path)+' is now '+n+'.',r.drv,'live'));
  }
  toast('Ride status: '+n);
  render();
}

async function rateRide(bid, rid, stars){
  const b=bookings.find(x=>x.id==bid);
  const r=rides.find(x=>x.id==rid);
  if(b) b.rated = stars;
  if(b) await persistBookingChanges(b,{rated:stars});
  if(r){
    const d=users.find(u=>u.name===r.drv||u.id===r.own);
    if(d){
      d.rating = Number(((d.rating * 4 + stars) / 5).toFixed(1));
    }
    r.rt = d ? d.rating : stars;
  }
  toast(`Thank you! You rated ${r ? r.drv : 'driver'} ${stars} ★.`);
  logEv(`Rating submitted: ${stars} ★ for ${r ? r.drv : 'driver'}`);
  render();
}

async function cancelRide(id){
  const r=rides.find(x=>x.id==id);
  if(String(S.gpsRideId)===String(r.id))await stopLocationSharing();
  r.status='cancelled';
  await persistRideChanges(r,{status:'cancelled'});
  for (const b of bookings.filter(b=>b.rid==id&&['pending','confirmed'].includes(b.st))) {
    b.st='ride-cancelled';
    await persistBookingChanges(b,{st:b.st});
    notify(b.pid,'The driver cancelled '+rn(r.path)+'. See alternatives in My bookings.',r.drv,'bookings');
  }
  logEv('Ride cancelled: '+rn(r.path));
  toast('Ride cancelled. Passengers notified.');
  render();
}

async function sos(){
  const type=$('sos-type')?.value;
  const details=$('sos-details')?.value.trim();
  const location=$('sos-location')?.value.trim()||'';
  if(!type)return toast('Choose the type of emergency.');
  if(!details)return toast('Describe what is happening before sending the report.');
  try{
    const incident=await apiRequest('/incidents',{method:'POST',body:{type,details,location,rideId:S.sosRide?String(S.sosRide):''}});
    incidents.unshift(incident);
    S.sosOpen=false;
    logEv('Emergency report from '+S.me.name+': '+type);
    toast('Emergency report sent to the admin team.');
    render();
  }catch(err){toast(err.message || 'Emergency report could not be sent.')}
}

async function publish(){
  if(activeJourneyForUser())return toast('Complete your current trip before publishing another ride.');
  const c=S.cr;
  if(c.f==c.t)return toast('Choose different start and end points.');
  const path=rt3(c.f,c.via,c.t);
  const ride={id:nid++,own:S.me.id,drv:S.me.name,veh:S.me.car.m,path,time:c.time,date:c.date,cap:c.seats,seats:c.seats,rate:c.rate,status:'scheduled',prog:0,rt:S.me.rating,pf:[...c.pf],rep:c.rep,note:c.note,createdAt:new Date().toISOString()};
  let savedToDatabase=false;
  try {
    savedToDatabase=await persistNewRide(ride);
  } catch(err) {
    toast(err.message || 'Ride could not be published. Please try again.');
    return;
  }
  rides.unshift(ride);
  S.res=null;
  logEv(S.me.name+' published '+rn(path));
  toast(savedToDatabase?'Ride published.':'Ride published locally; synchronization is unavailable.');
  S.view='drive';
  render();
}

const tp=k=>{const a=S.cr.pf,i=a.indexOf(k);i>-1?a.splice(i,1):a.push(k);render()};
const threads=()=>rides.filter(r=>String(r.own)===String(S.me.id)||bookings.some(b=>String(b.rid)===String(r.id)&&String(b.pid)===String(S.me.id)&&b.st!=='cancelled'));

async function send(t){
  const i=$('ci'),tx=t||(i&&i.value.trim());
  if(!tx)return;
  const r=rides.find(x=>x.id==S.th);
  if(!r)return;
  const message={rid:String(r.id),uid:S.me.id,n:S.me.name,t:tx,tm:now(),createdAt:new Date().toISOString()};
  if(r._id&&S.isDataActive){
    try{
      const stored=await apiRequest('/messages/'+encodeURIComponent(r._id),{method:'POST',body:{text:tx}});
      Object.assign(message,stored,{rid:String(stored.rid),uid:String(stored.uid),id:String(stored._id),_id:String(stored._id)});
    }catch(err){
      toast('Message could not be sent. Please try again.');
      console.error('Message send failed:',err.message);
      return;
    }
  }
  msgs.push(message);
  if(i)i.value='';
  save();
  render();
}

function threadTitle(r){
  if(String(r.own)!==String(S.me.id))return r.drv;
  const names=[...new Set(bookings.filter(b=>String(b.rid)===String(r.id)&&['pending','confirmed'].includes(b.st)).map(b=>b.pn))];
  return names.length?names.join(', '):'No passengers yet';
}