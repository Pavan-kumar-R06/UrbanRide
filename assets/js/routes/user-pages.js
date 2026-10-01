const V = {};
Object.assign(V, {
find(){
    const q=S.q;if(!S.res)S.res=match(q);const pv=S.res.find(m=>m.r.id==S.pv)||S.res[0];
    return hd('Find a ride','Search routes shared by verified commuters. Book a seat and split fuel costs.')+`<div class="card"><div class="fg"><div><label>From</label><select onchange="set(S.q,'f',this.value)">${so(q.f)}</select></div><div><label>To</label><select onchange="set(S.q,'t',this.value)">${so(q.t)}</select></div><div><label>Time</label><input type="time" value="${q.time}" onchange="set(S.q,'time',this.value)"></div><div><label>Seats</label><select onchange="set(S.q,'seats',+this.value)">${[1,2,3].map(n=>`<option ${n==q.seats?'selected':''}>${n}</option>`).join('')}</select></div><div><label>Sort by</label><select onchange="set(S.q,'sort',this.value)">${[['match','Best match'],['fare','Lowest fare'],['time','Earliest']].map(([v,l])=>`<option value="${v}" ${q.sort==v?'selected':''}>${l}</option>`).join('')}</select></div></div>
    <div class="row" style="margin-top:14px"><button class="chip ${q.ac?'on':''}" onclick="set(S.q,'ac',!S.q.ac)">AC only</button><button class="chip ${q.wo?'on':''}" onclick="set(S.q,'wo',!S.q.wo)">Women only</button><span class="mu">${S.res.length} ride(s) found</span></div></div>
    <div class="two"><div>${S.res.length?S.res.map(m=>rc(m,q)).join(''):empty('search','No compatible rides for this route and time.','<button class="btn g" onclick="go(\'offer\')">Offer your own ride</button>')}</div>
    <div><div class="card"><h3>Route preview${pv?': '+pv.r.drv:''}</h3>${mapSvg(pv?{list:[{id:pv.r.id,path:pv.r.path}],hi:pv.r.id,pick:pv.pick,drop:pv.drop,from:q.f}:{})}</div></div></div>`;
  },
  bookings(){
    const mine=bookings.filter(b=>String(b.pid)===String(S.me.id)).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,25),w=waitlist.filter(x=>String(x.pid)===String(S.me.id)).slice(0,20);
    const cl={pending:'w',confirmed:'',cancelled:'r','ride-cancelled':'r',rejected:'r'};
    return hd('My bookings','Track your seat requests, waitlist and completed trips.')+(mine.map(b=>{
      const r=rides.find(x=>x.id==b.rid);let ex='';
      const isCompleted = r && r.status === 'completed';
      if(b.st=='ride-cancelled'){
        const al=match({f:b.f,t:b.t,time:r.time,seats:b.seats,sort:'match'},r.id);
        ex=`<div class="mu" style="margin-top:10px"><b>Alternative rides</b></div>`+(al.map(m=>`<div class="row sp" style="margin-top:6px"><span>${m.r.drv} · ${m.r.time} · ₹${m.fare}</span><button class="btn s" onclick="book(${jsArg(m.r.id)},'${b.f}','${b.t}',${m.fare},${b.seats})">Book</button></div>`).join('')||'<div class="mu">No alternatives yet.</div>');
      }
      return`<div class="card">
        <div class="row sp">
          <div class="row">${av(r.drv)}<div><h3>${P[b.f][0]} → ${P[b.t][0]}</h3><span class="mu">${r.drv} · ${r.date} ${r.time} · ${b.seats} seat(s) · ₹${b.fare}</span></div></div>
          <div class="row">
            ${isCompleted ? tg('trip completed','b') : tg(b.st,cl[b.st])}
            ${b.st=='confirmed' && !isCompleted ? `<button class="btn s" onclick="go('live')">Track</button>` : ''}
            ${['pending','confirmed'].includes(b.st) && !isCompleted ? `<button class="btn g s" onclick="openChatThread(${jsArg(r.id)})">Message</button><button class="btn g s" onclick="cancelB(${jsArg(b.id)})">Cancel</button>` : ''}
          </div>
        </div>
        ${isCompleted ? `
          <div style="margin-top:12px;padding:12px 14px;background:var(--s2);border-radius:10px;border:1px solid var(--bd);">
            <div class="row sp">
              <span style="font-weight:700;font-size:13px;color:#10b981;">🎉 Ride Completed with ${r.drv}</span>
              ${b.rated ? `<span style="color:#f59e0b;font-weight:700;font-size:13px;">✓ Rated ${b.rated} ★ / 5</span>` : '<span class="mu" style="font-size:12px;">Please rate your experience:</span>'}
            </div>
            ${!b.rated ? `
              <div class="row" style="gap:8px;margin-top:8px;">
                ${[1,2,3,4,5].map(st=>`<button class="btn s" onclick="rateRide(${jsArg(b.id)},${jsArg(r.id)},${st})" style="padding:4px 12px;font-size:13px;font-weight:700;background:var(--s3);border-color:var(--bd);color:var(--tx);">★ ${st}</button>`).join('')}
              </div>
            ` : `
              <div style="font-size:12px;color:var(--mu);margin-top:4px;">Thank you for rating! Driver rating updated to ${r.rt} ★.</div>
            `}
          </div>
        ` : ''}
        ${ex}
      </div>`;
    }).join('')+w.map(x=>`<div class="card row sp"><span>${P[x.f][0]} → ${P[x.t][0]} · ride #${x.rid}</span>${tg('waitlisted','w')}</div>`).join('')||empty('ticket','No bookings yet.','<button class="btn" onclick="go(\'find\')">Find a ride</button>'));
  },
  live(){
    const id=S.me.id;let r=rides.find(x=>x.own==id&&['boarding','active'].includes(x.status));
    if(!r){
      const booking=bookings.find(item=>{
        const ride=rides.find(candidate=>String(candidate.id)===String(item.rid));
        return String(item.pid)===String(id)&&item.st==='confirmed'&&ride&&['boarding','active'].includes(ride.status);
      });
      r=booking&&rides.find(ride=>String(ride.id)===String(booking.rid));
    }
    if(!r)return hd('Trip status','Status updates and emergency support for your ride.')+`<div class="two"><div>${mapSvg()}<p class="mu">Your route and car appear here when a trip is active.</p></div><div>${empty('pin','No active trip right now. Tracking activates when a driver confirms and starts your trip.','<button class="btn" onclick="go(\'find\')">Find a ride</button>')}</div></div>`;
    const isOwner=String(r.own)===String(id),canShare=isOwner&&['boarding','active'].includes(r.status);
    const locationFresh=r.location&&Date.now()-new Date(r.location.updatedAt).getTime()<90000;
    const locationMessage=locationFresh?'Driver location updated '+ago(new Date(r.location.updatedAt).getTime())+(r.location.accuracy?' · accuracy about '+Math.round(r.location.accuracy)+' m':''):r.status==='completed'?'Trip completed.':(isOwner?'Share your location to show the car on the map.':'Waiting for the driver to share GPS location.');
    const progress=rideProgress(r);
    return hd('Trip status',rn(r.path)+' · '+tg(r.status,'b'))+`<div class="two"><div>${mapSvg({list:[{id:r.id,path:r.path}],hi:r.id,start:r.path[0],end:r.path[r.path.length-1],progress,location:locationFresh?r.location:null})}<div class="row sp"><span class="mu">Trip progress</span><b id="trip-progress-text" data-ride-id="${r.id}">${Math.round(progress*100)}%</b></div><div class="bar"><i id="trip-progress-bar" style="width:${Math.round(progress*100)}%"></i></div><p class="mu">${locationMessage}</p></div><div><div class="card"><div class="row">${av(r.drv)}<div><h3>${r.drv}</h3><span class="mu">${r.veh}</span></div></div><p class="mu" style="margin-top:14px">${r.status==='active'?'The driver marked this ride in progress.':r.status==='completed'?'Trip completed.':'Waiting for the driver to start.'}</p>${canShare?`<p class="mu">Confirmed passengers can see your location while sharing is on.</p><button class="btn ${S.gpsRideId===String(r.id)?'d':''}" onclick="${S.gpsRideId===String(r.id)?'stopLocationSharing()':'startLocationSharing('+jsArg(r.id)+')'}">${S.gpsRideId===String(r.id)?'Stop location sharing':'Share my location'}</button>`:''}</div>
    <div class="card"><div class="row"><button class="btn d" onclick="S.sosOpen=!S.sosOpen;S.sosRide=${jsArg(r.id)};render()">SOS Emergency</button><button class="btn g" onclick="toast('Live trip link copied.')">Share trip</button><button class="btn g" onclick="openChatThread(${jsArg(r.id)})">Message</button></div></div>
    ${S.sosOpen?`<div class="card"><h3>Emergency report</h3><p class="mu">Tell the response team what is happening. Include location details if you can.</p><div class="fg"><div><label for="sos-type">Emergency type</label><select id="sos-type"><option value="">Choose an emergency</option><option value="medical">Medical emergency</option><option value="collision">Collision or crash</option><option value="unsafe">Personal safety concern</option><option value="vehicle">Vehicle breakdown</option><option value="other">Other</option></select></div><div><label for="sos-location">Current location</label><input id="sos-location" maxlength="300" placeholder="Street, landmark, or pickup point"></div></div><label for="sos-details" style="margin-top:12px">What happened?</label><textarea id="sos-details" maxlength="1000" rows="3" placeholder="Describe the help you need"></textarea><div class="row" style="margin-top:12px"><button class="btn d" onclick="sos()">Send emergency report</button><button class="btn g" onclick="S.sosOpen=false;render()">Cancel</button></div></div>`:''}
    </div></div>`;
  },
  offer(){
    const activeJourney=activeJourneyForUser();
    if(activeJourney)return hd('Finish your current trip first',rn(activeJourney.path)+' · '+tg(activeJourney.status,'b'))+`<div class="card"><p class="mu">You can publish or join another ride after this trip is completed.</p><button class="btn" onclick="go('live')">Open current trip</button></div>`;
    const me=S.me;if(!me.car)return hd('Offer a ride','Publish a verified vehicle commute and share fuel costs.')+`<div class="card"><h3>Register your vehicle first</h3><p class="mu">An admin must verify the vehicle before you can publish a ride.</p><label>Vehicle Model & Number</label><input id="cm" placeholder="Vehicle model and registration"><div style="margin-top:14px"><button class="btn" onclick="addCar()">Register Vehicle</button></div></div>`;
    if(me.car.st!=='approved')return hd('Vehicle verification','Your vehicle must be approved before you can publish a ride.')+`<div class="card"><h3>Vehicle not verified by an admin</h3><p class="mu">${me.car.m} is ${me.car.st==='rejected'?'not approved':'awaiting admin review'}. You will be notified when its status changes.</p>${tg(me.car.st,me.car.st==='rejected'?'r':'w')}</div>`;
    const c=S.cr,p=rt3(c.f,c.via,c.t),k=km(p,0,p.length-1),fare=Math.round(k*c.rate/(c.seats+1));
    return hd('Offer a ride','Publish your commute route. Nearby passengers can book empty seats.')+`<div class="two"><div><div class="card"><div class="fg"><div><label>Start</label><select onchange="set(S.cr,'f',this.value)">${so(c.f)}</select></div><div><label>Destination</label><select onchange="set(S.cr,'t',this.value)">${so(c.t)}</select></div><div><label>Via Stop (optional)</label><select onchange="set(S.cr,'via',this.value)"><option value="">None</option>${so(c.via)}</select></div><div><label>Date</label><input type="date" value="${c.date}" onchange="set(S.cr,'date',this.value)"></div><div><label>Departure</label><input type="time" value="${c.time}" onchange="set(S.cr,'time',this.value)"></div><div><label>Seats Offered</label><select onchange="set(S.cr,'seats',+this.value)">${[1,2,3,4,5,6].map(n=>`<option ${n==c.seats?'selected':''}>${n}</option>`).join('')}</select></div><div><label>Rate per km (₹)</label><input type="number" min="2" max="20" value="${c.rate}" onchange="set(S.cr,'rate',+this.value)"></div><div><label>Repeat</label><select onchange="set(S.cr,'rep',this.value)">${['Once','Weekdays','Daily'].map(x=>`<option ${x==c.rep?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <label style="margin-top:16px">Preferences</label><div class="row">${Object.keys(PF).map(x=>`<button class="chip ${c.pf.includes(x)?'on':''}" onclick="tp('${x}')">${PF[x]}</button>`).join('')}</div><label style="margin-top:16px">Note for passengers</label><textarea rows="2" oninput="S.cr.note=this.value" placeholder="Pickup point details...">${c.note}</textarea><div class="row" style="margin-top:16px"><button class="btn" onclick="publish()">Publish Ride</button><span class="mu">Vehicle: ${me.car.m}</span></div></div></div>
    <div><div class="card"><h3>Trip summary</h3>${mapSvg({list:[{id:0,path:p}],hi:0,start:c.f,end:c.t})}<div class="grid" style="margin:14px 0 0"><div><b>${k} km</b><br><span class="mu">Distance</span></div><div><b style="color:#10b981">₹${fare}</b><br><span class="mu">Per passenger</span></div><div><b style="color:#38bdf8">₹${fare*c.seats}</b><br><span class="mu">Max earning</span></div></div></div></div></div>`;
  },
  drive(){
    const me=S.me,mine=rides.filter(r=>String(r.own)===String(me.id)).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,20);if(!me.car)return hd('Driver hub','Manage your published rides and passenger requests.')+empty('car','Add a vehicle to start offering rides.','<button class="btn" onclick="go(\'offer\')">Add vehicle</button>');
    const bs=bookings.filter(b=>mine.some(r=>r.id==b.rid)),earn=bs.filter(b=>b.st=='confirmed'&&rides.find(r=>r.id==b.rid).status=='completed').reduce((a,b)=>a+b.fare,0);
    return hd('Driver hub','Your rides, passenger requests and earnings.')+`<div class="grid">${sc('car',mine.length,'Rides published','blue')}${sc('mail',bs.filter(b=>b.st=='pending').length,'Pending requests','amber')}${sc('users',bs.filter(b=>b.st=='confirmed').length,'Confirmed passengers','green')}${sc('rupee','₹'+earn,'Total earned','purple')}</div>`+
    (mine.map(r=>{
      const rs=bookings.filter(b=>b.rid==r.id),nx={scheduled:'Start boarding',boarding:'Start ride',active:'Complete ride'}[r.status];
      return`<div class="card"><div class="row sp"><div><h3>${rn(r.path)}</h3><span class="mu">${r.date} · ${r.time} · ${r.cap-r.seats}/${r.cap} seats filled · ₹${r.rate}/km</span></div><div class="row">${tg(r.status,r.status=='cancelled'?'r':'b')}${nx?`<button class="btn s" onclick="step(${jsArg(r.id)})">${nx}</button>`:''}${r.status=='scheduled'?`<button class="btn d s" onclick="cancelRide(${jsArg(r.id)})">Cancel</button>`:''}${['boarding','active'].includes(r.status)?`<button class="btn g s" onclick="go('live')">Live map</button>`:''}</div></div>
      <div class="row" style="margin:10px 0"><div class="bar"><i style="width:${(r.cap-r.seats)/r.cap*100}%"></i></div><span class="mu">${r.pf.map(k=>PF[k]).join(' · ')}</span></div>
      ${rs.length?rs.map(b=>`<div class="row sp" style="padding:10px 0;border-top:1px solid var(--bd)"><div class="row">${av(b.pn)}<div><b>${b.pn}</b><br><span class="mu">${P[b.f][0]} → ${P[b.t][0]} · ${b.seats} seat(s) · ₹${b.fare}</span></div></div><div class="row">${tg(b.st,b.st=='pending'?'w':b.st=='confirmed'?'':'r')}${b.st=='pending'?`<button class="btn s" onclick="decide(${jsArg(b.id)},1)">Accept</button><button class="btn g s" onclick="decide(${jsArg(b.id)},0)">Reject</button>`:''}<button class="btn g s" onclick="openChatThread(${jsArg(r.id)})">Message</button></div></div>`).join(''):'<p class="mu" style="margin:0">No requests yet.</p>'}</div>`;
    }).join('')||empty('compass','You have not published any ride yet.','<button class="btn" onclick="go(\'offer\')">Offer a ride</button>'));
  },
  chat(){
    const ths=threads().map(ride=>{
      const latest=msgs.filter(message=>String(message.rid)===String(ride.id)).reduce((time,message)=>Math.max(time,Date.parse(message.createdAt)||0),Date.parse(ride.createdAt)||0);
      return{ride,latest};
    }).sort((a,b)=>b.latest-a.latest).slice(0,5).map(item=>item.ride);
    if(!ths.length)return hd('Messages','Ride-specific chat with drivers and passengers.')+empty('chat','No conversations yet.');
    const cur=ths.find(r=>r.id==S.th)||ths[0];S.th=cur.id;const ms=msgs.filter(m=>m.rid==cur.id);
    return hd('Messages','Ride-specific chat with drivers and passengers.')+`<div class="chat"><div>${ths.map(r=>`<div class="th ${r.id==cur.id?'on':''}" onclick="openChatThread(${jsArg(r.id)})"><b>${r.drv}</b><br><span class="mu">${rn(r.path)}</span></div>`).join('')}</div>
    <div class="card"><div class="row sp" style="margin-bottom:10px"><h3>${rn(cur.path)}</h3>${tg(cur.status,'b')}</div><div class="msgs">${ms.map(m=>`<div class="msg ${m.uid==S.me.id?'me':''}"><small>${m.n} · ${m.tm}</small>${m.t}</div>`).join('')||'<p class="mu">Say hello</p>'}</div>
    <div class="row" style="flex-wrap:nowrap"><input id="ci" placeholder="Type a message..." onkeydown="if(event.key=='Enter')send()"><button class="btn" onclick="send()">Send</button></div></div></div>`;
  },
  notif(){
    const n=notes.filter(x=>String(x.uid)===String(S.me.id)).sort((a,b)=>b.ts-a.ts).slice(0,10);
    return hd('Notifications','Your 10 most recent updates and messages.')+`<div class="row" style="margin-bottom:14px"><button class="btn g s" onclick="notes.forEach(x=>{if(x.uid==S.me.id)x.read=1});render()">Mark all as read</button><span class="mu">${n.filter(x=>!x.read).length} unread</span></div>`+(n.map(x=>`<div class="card row sp" style="cursor:pointer;${x.read?'':'border-left:4px solid #38bdf8'}" onclick="const item=notes.find(y=>y.id==${x.id});if(item){item.read=1;if(item.threadId)S.th=item.threadId}go('${x.go||'notif'}')"><div class="row" style="flex-wrap:nowrap">${av(x.from)}<div><b>${x.messageId?'New message':'Notification'}</b><br><span class="mu">From <b>${x.from}</b></span><div style="margin-top:2px">${x.t}</div></div></div><span class="mu">${ago(x.ts)}</span></div>`).join('')||empty('bell','No notifications yet.'));
  },
  profile(){
    const me=S.me,confirmed=bookings.filter(b=>String(b.pid)===String(me.id)&&b.st==='confirmed').length;
    const offered=rides.filter(r=>String(r.own)===String(me.id)).length;
    const completed=rides.filter(r=>String(r.own)===String(me.id)&&r.status==='completed').length;
    const memberSince=me.createdAt?new Date(me.createdAt).toLocaleDateString():'Active member';
    const vehicleStatus=me.car?.st||'not-registered';
    return hd('Your profile','Account details, ride activity, and vehicle status.')+
    `<div class="profile-hero"><div class="profile-identity"><div class="profile-avatar">${av(me.name)}</div><div><span class="profile-eyebrow">${me.role==='admin'?'Platform administrator':'URBANRIDE MEMBER'}</span><h2>${me.name}</h2><p>${me.email}</p></div></div><button class="btn g" onclick="logout()">Log out</button></div>
    <div class="grid profile-stats">${sc('ticket',confirmed,'Confirmed bookings','blue')}${sc('car',offered,'Rides offered','green')}${sc('check',completed,'Completed rides','amber')}</div>
    <div class="profile-sections"><section class="profile-section"><div class="profile-section-heading"><div><span class="profile-eyebrow">ACCOUNT</span><h3>Personal details</h3></div><span class="tag">${me.role}</span></div><div class="profile-details"><div class="profile-detail"><span>Name</span><b>${me.name}</b></div><div class="profile-detail"><span>Email</span><b>${me.email}</b></div><div class="profile-detail"><span>Member since</span><b>${memberSince}</b></div><div class="profile-detail"><span>Driver rating</span><b>${stars(me.rating)}</b></div></div></section>
    <section class="profile-section"><div class="profile-section-heading"><div><span class="profile-eyebrow">VEHICLE</span><h3>Vehicle verification</h3></div>${tg(vehicleStatus,vehicleStatus==='approved'?'':vehicleStatus==='rejected'?'r':'w')}</div>${me.car?`<div class="profile-vehicle"><span class="profile-vehicle-icon">${ic('car',24)}</span><div><b>${me.car.m}</b><p class="mu">${vehicleStatus==='approved'?'Verified for ride publishing':vehicleStatus==='rejected'?'Vehicle needs an update':'Waiting for admin review'}</p></div></div>`:`<p class="mu">Register a vehicle to offer rides.</p><div class="row profile-add-vehicle"><input id="cm" placeholder="Vehicle model and registration"><button class="btn" onclick="addCar()">Add vehicle</button></div>`}</section></div>`;
  },

  /* ======================================================================= */
});
