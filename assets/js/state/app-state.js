const mins=t=>{let[a,b]=t.split(':');return+a*60+ +b},today=new Date().toISOString().slice(0,10),now=()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const PF={ac:'AC',mu:'Music',ns:'No smoking',wo:'Women only',pt:'Pets ok'};
let nid=25;

/* Default seed accounts */
let users=[
  {id:'1',name:'Platform Admin',email:'admin@urbanmobility.com',role:'admin'},
  {id:'2',name:'Aarav Sharma',email:'aarav@demo.com',role:'user',car:null,rating:4.7,ec:'9876543210'},
  {id:'3',name:'Riya Nair',email:'riya@demo.com',role:'user',car:null,rating:4.9,ec:''},
  {id:'4',name:'Meera K.',email:'meera@demo.com',role:'user',car:{m:'Honda City · KA01 AB 1234',st:'approved'},rating:4.8,ec:''}
];

let rides=[
  {id:1,own:'4',drv:'Meera K.',veh:'Honda City · KA01 AB 1234',path:route('ec','wf'),time:'08:30',date:today,cap:4,seats:2,rate:8,status:'scheduled',prog:0,rt:4.8,pf:['ac','ns']},
  {id:2,own:'0',drv:'Rahul S.',veh:'Swift · KA03 MC 5521',path:route('jay','heb'),time:'08:30',date:today,cap:3,seats:1,rate:7,status:'scheduled',prog:0,rt:4.6,pf:['mu']},
  {id:3,own:'0',drv:'Sana P.',veh:'Creta · KA05 ZX 9090',path:route('hsr','mg'),time:'08:45',date:today,cap:3,seats:0,rate:9,status:'scheduled',prog:0,rt:4.9,pf:['ac','wo']},
  {id:4,own:'0',drv:'Vikram D.',veh:'i20 · KA51 QR 7788',path:route('jay','ind'),time:'09:15',date:today,cap:3,seats:2,rate:7,status:'scheduled',prog:0,rt:4.4,pf:['pt']}
];

const dt=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
[['ind','ec',1],['wf','mg',2],['heb','kor',3],['jay','ya',5],['mg','mar',5]].forEach(([a,b,n],i)=>rides.push({id:5+i,own:'0',drv:['Rahul S.','Vikram D.','Sana P.'][i%3],veh:'Sedan',path:route(a,b),time:'08:30',date:dt(n),cap:3,seats:1,rate:8,status:'completed',prog:1,rt:4.6,pf:[]}));
let bookings=rides.filter(r=>r.id>4).flatMap(r=>[1,2].map(k=>({id:100+r.id*2+k,rid:r.id,pid:'0',pn:['Anita','Kabir'][k-1],f:r.path[0],t:r.path[r.path.length-1],seats:1,fare:Math.round(km(r.path,0,r.path.length-1)*r.rate/3),st:'confirmed'}))),waitlist=[],notes=[],log=[],msgs=[{rid:1,uid:'0',n:'Meera K.',t:'Hi! I will wait at the main gate of the pickup point.',tm:'08:01'}];
let incidents=[{id:1,type:'Route deviation',by:'Passenger #204',ride:2,st:'open'},{id:2,type:'Late arrival report',by:'Passenger #118',ride:3,st:'open'}];
let vq=[
  {name:'Honda City · KA01 AB 1234',owner:'Meera K.',st:'approved',uid:'4'},
  {name:'Baleno · KA02 HH 4410',owner:'Arjun T.',st:'pending',uid:'5'},
  {name:'Nexon EV · KA01 EV 0007',owner:'Divya R.',st:'pending',uid:'6'}
];
let hist=[6,9,11,8,14,17,12],cancels=2;

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
  aq:'',
  rf:'all',
  z:1,
  cx:50,
  cy:50,
  lay:{metro:1,road:1,traf:0},
  showPw:false,
  isMongoActive:false,
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
const KEY='urbanride_v3';

function save(){try{const safeUsers=users.map(({pw,...user})=>user);localStorage.setItem(KEY,JSON.stringify({users:safeUsers,rides,bookings,waitlist,notes,msgs,incidents,vq,log,nid}));sessionStorage.setItem(KEY+'m',S.me?S.me.id:'')}catch(e){}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(!s)return;const id=S.me&&S.me.id;const safeUsers=(s.users||users).map(({pw,...user})=>user);users.splice(0,users.length,...safeUsers);rides=s.rides||rides;bookings=s.bookings||bookings;waitlist=s.waitlist||waitlist;notes=s.notes||notes;msgs=s.msgs||msgs;incidents=s.incidents||incidents;vq=s.vq||vq;log=s.log||log;nid=s.nid||nid;S.me=id?users.find(u=>u.id==id)||null:null}catch(e){}}
const ago=ts=>{const s=(Date.now()-ts)/1e3;return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago'};
const bkm=b=>{const r=rides.find(x=>x.id==b.rid),i=near(r.path,b.f)[0],j=near(r.path,b.t)[0];return j>i?km(r.path,i,j):0};

const blk=id=>{const u=users.find(x=>x.id==id);u.blocked=!u.blocked;logEv((u.blocked?'Blocked ':'Unblocked ')+u.name);toast('User updated.');render()};
const resInc=id=>{incidents.find(x=>x.id==id).st='resolved';logEv('Incident #'+id+' resolved');toast('Incident resolved and logged.');render()};
const resetDemo=()=>{try{localStorage.removeItem(KEY)}catch(e){}location.reload()};
