const set=(o,k,v)=>{o[k]=v;S.res=null;render()},go=v=>{S.view=v;if(['users','ver','ana'].includes(v))syncAdminData();render()};
function match(q,skip){
  return rides.filter(r=>r.status=='scheduled'&&r.id!=skip&&r.own!=(S.me&&S.me.id)&&(!q.ac||r.pf.includes('ac'))&&(!q.wo||r.pf.includes('wo'))).map(r=>{
    const[i,d1]=near(r.path,q.f),[j,d2]=near(r.path,q.t);
    if(i>=j||d1>15||d2>15)return null;
    const score=Math.round(Math.max(0,100-d1*2-d2*2-Math.abs(mins(r.time)-mins(q.time))/6)),k=km(r.path,i,j);
    return{r,score,walk:(d1*.3).toFixed(1),pick:r.path[i],drop:r.path[j],k,fare:Math.round(k*r.rate/(r.cap-r.seats+2))*q.seats}
  }).filter(x=>x&&x.score>20).sort((a,b)=>q.sort=='fare'?a.fare-b.fare:q.sort=='time'?mins(a.r.time)-mins(b.r.time):b.score-a.score);
}

async function book(rid,f,t,fare,n){
  const r=rides.find(x=>x.id==rid);
  if(r.seats<n){waitlist.push({rid,pid:S.me.id,pn:S.me.name,f,t,fare,seats:n});toast('Ride is full. You joined the waitlist.');return render()}
  const booking={id:nid++,rid,pid:S.me.id,pn:S.me.name,f,t,fare,seats:n,st:'pending'};
  try {
    await persistNewBooking(booking);
  } catch(err) {
    toast('Booking was not saved to MongoDB. Please try again.');
    return;
  }
  r.seats-=n;
  bookings.push(booking);
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
    const booking={id:nid++,rid:r.id,pid:x.pid,pn:x.pn,f:x.f,t:x.t,fare:x.fare,seats:x.seats,st:'pending'};
    try {
      await persistNewBooking(booking);
      bookings.push(booking);
    } catch(err) {
      toast('Waitlisted booking could not be saved to MongoDB.');
    }
    notify(x.pid,'A seat opened up! Your booking request is now with the driver.','System','bookings');
  }
}

async function cancelB(id){
  const b=bookings.find(x=>x.id==id),r=rides.find(x=>x.id==b.rid);
  b.st='cancelled';cancels++;
  if(r.status!='cancelled')r.seats+=b.seats;
  await persistBookingChanges(b,{st:b.st});
  await promote(r);
  if(r.own)notify(r.own,b.pn+' cancelled their booking on '+rn(r.path)+'.',b.pn,'drive');
  logEv(b.pn+' cancelled a booking on '+rn(r.path));
  toast('Booking cancelled.');
  render();
}

async function decide(id,ok){
  const b=bookings.find(x=>x.id==id),r=rides.find(x=>x.id==b.rid);
  b.st=ok?'confirmed':'rejected';
  await persistBookingChanges(b,{st:b.st});
  if(!ok){r.seats+=b.seats;await promote(r)}
  notify(b.pid,ok?'Your seat is confirmed for '+rn(r.path)+'.':'Your request for '+rn(r.path)+' was declined.',r.drv,'bookings');
  logEv((ok?'Accepted ':'Rejected ')+b.pn+' on '+rn(r.path));
  toast(ok?'Passenger accepted!':'Request declined.');
  render();
}

async function simReq(id){
  const r=rides.find(x=>x.id==id),p=r.path;
  if(r.seats<1)return toast('Ride is already full.');
  const booking={id:nid++,rid:id,pid:'3',pn:'Riya Nair',f:p[0],t:p[p.length-1],seats:1,fare:Math.round(km(p,0,p.length-1)*r.rate/(r.cap-r.seats+2)),st:'pending'};
  try {
    await persistNewBooking(booking);
  } catch(err) {
    toast('Demo booking could not be saved to MongoDB.');
    return;
  }
  r.seats--;
  bookings.push(booking);
  notify(S.me.id,'New booking request for '+rn(r.path)+'.','Riya Nair','drive');
  toast('Demo request received from Riya Nair.');
  render();
}

async function step(id){
  const r=rides.find(x=>x.id==id);
  const n={scheduled:'boarding',boarding:'active',active:'completed'}[r.status];
  r.status=n;
  await persistRideChanges(r,{status:n,prog:n=='completed'?1:r.prog});
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

function sos(){
  incidents.unshift({id:nid++,type:'SOS alert',by:S.me.name,ride:0,st:'open'});
  logEv('SOS alert from '+S.me.name);
  toast('🚨 SOS broadcasted to admin and emergency contacts.');
}

async function publish(){
  const c=S.cr;
  if(c.f==c.t)return toast('Choose different start and end points.');
  const path=rt3(c.f,c.via,c.t);
  const ride={id:nid++,own:S.me.id,drv:S.me.name,veh:S.me.car.m,path,time:c.time,date:c.date,cap:c.seats,seats:c.seats,rate:c.rate,status:'scheduled',prog:0,rt:S.me.rating,pf:[...c.pf],rep:c.rep,note:c.note};
  let savedToDatabase=false;
  try {
    savedToDatabase=await persistNewRide(ride);
  } catch(err) {
    toast('Ride was not saved to MongoDB. Please try again.');
    return;
  }
  rides.push(ride);
  S.res=null;
  logEv(S.me.name+' published '+rn(path));
  toast(savedToDatabase?'Ride published and saved to MongoDB.':'Ride published in local demo mode; MongoDB is offline.');
  S.view='drive';
  render();
}

const tp=k=>{const a=S.cr.pf,i=a.indexOf(k);i>-1?a.splice(i,1):a.push(k);render()};
const threads=()=>rides.filter(r=>r.own==S.me.id||bookings.some(b=>b.rid==r.id&&b.pid==S.me.id&&b.st!='cancelled'));

async function send(t){
  const i=$('ci'),tx=t||(i&&i.value.trim());
  if(!tx)return;
  const r=rides.find(x=>x.id==S.th);
  if(!r)return;
  const message={rid:String(r.id),uid:S.me.id,n:S.me.name,t:tx,tm:now()};
  if(r._id&&S.isMongoActive){
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
