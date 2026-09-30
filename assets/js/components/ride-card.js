const stars=n=>`<span style="color:#f59e0b">★</span> ${n}`;
function rc(m,q){
  const r=m.r;
  return`<div class="card" style="cursor:pointer;${m.r.id==(S.pv||S.res[0].r.id)?'border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,0.2)':''}" onclick="S.pv=${jsArg(r.id)};render()"><div class="row sp"><div class="row">${av(r.drv)}<div><h3>${r.drv}</h3><span class="mu">${stars(r.rt)} · ${r.veh}</span></div></div><div style="text-align:right"><b style="font-size:20px;color:#10b981">₹${m.fare}</b><br><span class="mu">${q.seats} seat(s)</span></div></div>
  <div class="row" style="margin:10px 0">${tg(m.score+'% match')}${tg(r.seats?r.seats+' seats left':'Full',r.seats?'':'r')}${tg('Departs '+r.time,'b')}${r.pf.map(k=>tg(PF[k],'p')).join('')}</div>
  <div class="mu">Pickup <b>${P[m.pick][0]}</b> (${m.walk} km walk) → Drop <b>${P[m.drop][0]}</b> · ${m.k} km</div>
  <div class="row" style="margin-top:12px"><button class="btn s" onclick="event.stopPropagation();book(${jsArg(r.id)},'${q.f}','${q.t}',${m.fare},${q.seats})">${r.seats>=q.seats?'Request seat':'Join waitlist'}</button></div></div>`;
}

/* ========================================================================= */
/* VIEWS: FIND, BOOKINGS, LIVE, OFFER, DRIVE, CHAT, PROFILE                  */
/* ========================================================================= */
