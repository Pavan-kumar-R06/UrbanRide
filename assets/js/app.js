function updateLiveRideProgress(){
  const progressText=$('trip-progress-text');
  if(!progressText)return;
  const ride=rides.find(item=>String(item.id)===progressText.dataset.rideId);
  if(!ride)return;
  let progress=rideProgress(ride),path=ride.path;
  const bookingId=progressText.dataset.bookingId;
  if(bookingId){
    const booking=bookings.find(item=>String(item._id||item.id)===String(bookingId));
    if(booking?.tripCompletedAt)progress=1;
    else if(booking){
      const segment=rideSegmentForBooking(ride,booking);
      if(segment){path=segment.path;progress=segment.progress;if(progress>=1)void completePassengerSegment(booking);}
    }
  }
  const percentage=Math.round(progress*100);
  progressText.textContent=percentage+'%';
  const bar=$('trip-progress-bar');
  if(bar)bar.style.width=percentage+'%';
  const marker=$('trip-car-marker');
  if(marker){
    const fresh=ride.location&&Date.now()-new Date(ride.location.updatedAt).getTime()<90000;
    const point=fresh?routePointForGps(ride.location,path):routePointForProgress(progress,path);
    if(point)marker.setAttribute('transform',`translate(${point.x} ${point.y}) rotate(${point.angle})`);
  }
}

function render(){
  const a=document.activeElement,id=a&&a.id,v=a&&a.value;
  const authValues=!S.me?['an','ae','ap','av'].reduce((values,key)=>{
    const input=$(key);
    if(input)values[key]=input.value;
    return values;
  },{}):null;
  save();

  if(!S.me){
    $('root').innerHTML=authV();
    Object.entries(authValues).forEach(([key,value])=>{if($(key))$(key).value=value});
    if(id&&$(id)&&v!=null&&a.tagName=='INPUT'&&['text','email'].includes(a.type)){
      $(id).value=v;
      $(id).focus();
      try{$(id).setSelectionRange(v.length,v.length)}catch(e){}
    }
    return;
  }

  const me=S.me,
        pend=bookings.filter(b=>rides.some(r=>r.id==b.rid&&r.own==me.id)&&b.st=='pending').length,
      unreadNotifications=notes.filter(note=>String(note.uid)===String(me.id)&&!note.read&&!note.messageId).length,
      unreadMessages=notes.filter(note=>String(note.uid)===String(me.id)&&!note.read&&note.messageId).length;

    $('root').innerHTML=`<div class="app"><aside><div class="logo">${brand(30)}</div>${(me.role=='admin'?ANAV:UNAV).map(x=>typeof x=='string'?`<div class="ns">${x}</div>`:`<button class="${S.view==x[0]?'on':''}" onclick="go('${x[0]}')">${ic(x[1])}<span>${x[2]}</span>${x[0]=='drive'&&pend?' '+tg(pend,'w'):''}${x[0]=='notif'&&unreadNotifications?' '+tg(unreadNotifications,'b'):''}${x[0]=='chat'&&unreadMessages?' '+tg(unreadMessages,'b'):''}</button>`).join('')}<div class="me">${av(me.name)}<div style="flex:1"><b>${me.name}</b><br><span class="mu">${me.role}</span></div><button class="btn g s" onclick="logout()">Logout</button></div></aside><main>${V[S.view]()}</main></div>`;

  if(id&&$(id)&&v!=null&&a.tagName=='INPUT'&&['text','email'].includes(a.type)){
    $(id).value=v;
    $(id).focus();
    try{$(id).setSelectionRange(v.length,v.length)}catch(e){}
  }
  const c=document.querySelector('.msgs');
  if(c)c.scrollTop=c.scrollHeight;
}

try{
  load();
}catch(e){}

window.addEventListener('storage',e=>{
  if(e.key!=KEY)return;
  const me=S.me&&S.me.id,b=notes.filter(n=>n.uid==me).length;
  load();
  const a=notes.filter(n=>n.uid==me);
  render();
  if(a.length>b)toast('New notification from '+a[0].from);
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&S.big){
    S.big=0;
    render();
  }
});
setInterval(()=>{if(S.me&&S.isDataActive&&['live','drive','bookings','chat'].includes(S.view))refreshSharedRideData()},2000);
setInterval(()=>{if(S.me&&S.isDataActive)refreshMessageNotifications()},5000);
setInterval(()=>{if(S.me&&S.view==='live')updateLiveRideProgress()},1000);
setInterval(async()=>{
  if(!S.me)return;
  if(S.me.role==='admin'&&['ana','users','rides','inc','ver'].includes(S.view)){
    await Promise.all([syncDatabaseData(),syncAdminData()]);
  }else if(['notif','live'].includes(S.view))render();
},30000);
restoreSession();
