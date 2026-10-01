const mins=t=>{let[a,b]=t.split(':');return+a*60+ +b},today=new Date().toISOString().slice(0,10),now=()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const PF={ac:'AC',mu:'Music',ns:'No smoking',wo:'Women only',pt:'Pets ok'};
let nid=1;
let users=[],rides=[],bookings=[],waitlist=[],notes=[],log=[],msgs=[],incidents=[],vq=[];
const dt=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
/* Application State */
const S={
  me:null,
  tab:'user', // 'user' or 'admin'
  reg:0,
  err:'',
  view:'find',
  th:0,
  q:{f:'ec',t:'wf',time:'08:30',seats:1,sort:'match',ac:0,wo:0},
  res:null,
  pv:0,
  cr:{f:'ec',t:'wf',via:'',date:today,time:'09:00',seats:3,rate:8,pf:['ac'],rep:'Once',note:''},
  big:0,
  sosOpen:false,
  sosRide:null,
  locationWatchId:null,
  gpsRideId:null,
  lastLocationSent:0,
  liveRideId:null,
  aq:'',
  rf:'all',
  z:1,
  cx:50,
  cy:50,
  lay:{metro:1,road:1},
  showPw:false,
  rememberLogin:false,
  isDataActive:false,
  loading:false,
  anaRange:'7d', // 'today', '7d', '30d', 'all'
  anaMetric:'rides' // 'rides' or 'revenue'
};

const $=id=>document.getElementById(id);
const jsArg=value=>JSON.stringify(value).replace(/"/g,'&quot;');
const hc=n=>[...n].reduce((a,c)=>a+c.charCodeAt(0),0)%360;
const av=n=>`<span class="av" style="background:#ffffff;color:#090a0f">${n[0]}</span>`;
const hd=(t,s)=>`<h2>${t}</h2><p class="sub">${s}</p>`;
const so=v=>Object.keys(P).map(k=>`<option value="${k}" ${k==v?'selected':''}>${P[k][0]}</option>`).join('');
const sc=(i,v,l,c='neutral')=>`<div class="card stat ${c}"><i>${ic(i,22)}</i><div><b>${v}</b><span class="mu">${l}</span></div></div>`;
const empty=(i,t,b='')=>`<div class="card empty"><b>${ic(i,44)}</b><p style="font-weight:600;margin:6px 0">${t}</p><div style="margin-top:14px">${b}</div></div>`;
const tb=(h,r)=>`<div class="card tw"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const tg=(s,c='')=>`<span class="tag ${c}">${s}</span>`,rn=p=>P[p[0]][0]+' → '+P[p[p.length-1]][0];

function toast(t){
  const e=document.createElement('div');
  e.className='toast';
  e.textContent=t;
  document.body.append(e);
  setTimeout(()=>e.remove(),2800);
}
const notify=(u,t,from='System',go='notif')=>notes.unshift({id:nid++,uid:u,t,from,go,ts:Date.now(),tm:now()});
const logEv=t=>log.unshift({t,ts:Date.now()});
const KEY='urbanride_v4';

function save(){try{const safeUsers=users.map(({pw,...user})=>user);localStorage.setItem(KEY,JSON.stringify({users:safeUsers,rides,bookings,waitlist,notes,msgs,incidents,vq,log,nid}));sessionStorage.setItem(KEY+'m',S.me?S.me.id:'')}catch(e){}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(!s)return;const id=S.me&&S.me.id;const safeUsers=(s.users||users).map(({pw,...user})=>user);users.splice(0,users.length,...safeUsers);rides=s.rides||rides;bookings=s.bookings||bookings;waitlist=s.waitlist||waitlist;notes=s.notes||notes;msgs=s.msgs||msgs;incidents=s.incidents||incidents;vq=s.vq||vq;log=s.log||log;nid=s.nid||nid;S.me=id?users.find(u=>u.id==id)||null:null}catch(e){}}
const ago=ts=>{const s=(Date.now()-ts)/1e3;return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago'};
const bkm=b=>{const r=rides.find(x=>x.id==b.rid),i=near(r.path,b.f)[0],j=near(r.path,b.t)[0];return j>i?km(r.path,i,j):0};

async function blk(id){
  const u=users.find(x=>String(x.id)===String(id));
  if(!u)return;
  try{
    const updated=await apiRequest('/users/'+encodeURIComponent(id),{method:'PUT',body:{blocked:!u.blocked}});
    u.blocked=updated.blocked;
    logEv((u.blocked?'Blocked ':'Unblocked ')+u.name);
    toast('User updated.');
    render();
  }catch(err){toast(err.message)}
}
