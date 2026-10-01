function render(){
  if(S.view!=='live')destroyLiveTrackingMap();
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
        nn=notes.filter(x=>x.uid==me.id&&!x.read).length;

  $('root').innerHTML=`<div class="app"><aside><div class="logo">${brand(30)}</div>${(me.role=='admin'?ANAV:UNAV).map(x=>typeof x=='string'?`<div class="ns">${x}</div>`:`<button class="${S.view==x[0]?'on':''}" onclick="go('${x[0]}')">${ic(x[1])}<span>${x[2]}</span>${x[0]=='drive'&&pend?' '+tg(pend,'w'):''}${x[0]=='notif'&&nn?' '+tg(nn,'b'):''}</button>`).join('')}<div class="me">${av(me.name)}<div style="flex:1"><b>${me.name}</b><br><span class="mu">${me.role}</span></div><button class="btn g s" onclick="logout()">Logout</button></div></aside><main>${V[S.view]()}</main></div>`;
  if(S.view==='live'&&S.liveRideId){
    const liveRide=rides.find(ride=>String(ride.id)===String(S.liveRideId));
    if(liveRide)renderLiveTrackingMap(liveRide);
  }

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
setInterval(()=>{if(S.me&&S.isDataActive&&['live','drive','bookings','chat'].includes(S.view))refreshSharedRideData()},5000);
setInterval(async()=>{
  if(!S.me)return;
  if(S.me.role==='admin'&&['ana','users','rides','inc','ver'].includes(S.view)){
    await syncDatabaseData();
    await syncAdminData();
  }else if(['notif','live'].includes(S.view))render();
},30000);
setInterval(()=>{if(S.me&&S.me.role!=='admin')refreshMyIncidents()},10000);
restoreSession();
