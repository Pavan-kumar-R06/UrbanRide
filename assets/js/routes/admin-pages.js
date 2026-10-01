Object.assign(V, {
/* DYNAMIC ADMIN ANALYTICS DASHBOARD                                       */
  /* ======================================================================= */
  ana(){
    const rng = S.anaRange;
    const filterDays = rng === 'today' ? 1 : rng === '7d' ? 7 : rng === '30d' ? 30 : 999;
    
    // Filter rides based on date range
    const cutoff = rng === 'all' ? '2000-01-01' : dt(filterDays - 1);
    const activeRides = rides.filter(r => r.date >= cutoff && r.status !== 'cancelled');
    const activeBookings = bookings.filter(b => {
      const r = rides.find(x => x.id === b.rid);
      return r && r.date >= cutoff;
    });

    const confirmedBookings = activeBookings.filter(b => b.st === 'confirmed');
    const rev = confirmedBookings.reduce((a, b) => a + b.fare, 0);
    const co2Kg = confirmedBookings.reduce((a, b) => a + (bkm(b) * 0.12 * b.seats), 0).toFixed(1);
    const trees = Math.round(co2Kg / 21);
    const totalUsers = users.filter(u => u.role === 'user').length;
    const seatCapacity = activeRides.reduce((sum, ride) => sum + Number(ride.cap || 0), 0);
    const occupiedSeats = activeRides.reduce((sum, ride) => sum + Math.max(0, Number(ride.cap || 0) - Number(ride.seats || 0)), 0);
    const fleetUtilization = seatCapacity ? Math.round(occupiedSeats / seatCapacity * 100) : 0;
    const cancellCount = activeBookings.filter(b => ['cancelled', 'ride-cancelled', 'rejected'].includes(b.st)).length + rides.filter(r => r.date >= cutoff && r.status === 'cancelled').length;
    const confirmationRate = activeBookings.length ? Math.round((confirmedBookings.length / activeBookings.length) * 100) : 0;
    const rangeIncidents = incidents.filter(incident => rng === 'all' || new Date(incident.createdAt || 0) >= new Date(cutoff + 'T00:00:00'));
    const resolvedIncidents = rangeIncidents.filter(incident => incident.status === 'resolved').length;
    const incidentResolutionRate = rangeIncidents.length ? Math.round(resolvedIncidents / rangeIncidents.length * 100) : null;
    const auditStream = [
      ...rides.map(ride => ({ t: `${ride.drv} published ${rn(ride.path)}`, ts: new Date(ride.createdAt || 0).getTime() })),
      ...bookings.map(booking => {
        const ride = rides.find(item => String(item.id) === String(booking.rid));
        return { t: `${booking.pn} requested a seat${ride ? ' on ' + rn(ride.path) : ''}`, ts: new Date(booking.createdAt || 0).getTime() };
      }),
      ...incidents.map(incident => ({ t: `Emergency report from ${incident.by}: ${incident.type}`, ts: new Date(incident.createdAt || 0).getTime() }))
    ].filter(item => item.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 5);

    // Daily volume calculation
    const numCols = rng === 'today' ? 6 : rng === '7d' ? 7 : 8;
    const chartBars = [];

    if (rng === 'today') {
      const hours = [...new Set(rides.filter(ride => ride.date === today).map(ride => ride.time.slice(0, 2)))].sort().slice(0, 6);
      hours.forEach(h => {
        const count = rides.filter(r => r.date === today && r.time.slice(0,2) === h).length;
        const bks = bookings.filter(b => {
          const r = rides.find(x => x.id === b.rid);
          return r && r.date === today && r.time.slice(0,2) === h && b.st === 'confirmed';
        });
        const rVal = bks.reduce((a,c) => a + c.fare, 0);
        chartBars.push({ label: h + ':00', val: S.anaMetric === 'revenue' ? rVal : count });
      });
    } else {
      const daysCount = rng === '7d' ? 7 : rng === '30d' ? 30 : 14;
      for (let i = daysCount - 1; i >= 0; i--) {
        const dStr = dt(i);
        const dayLabel = new Date(dStr + 'T00:00').toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
        const count = rides.filter(r => r.date === dStr).length;
        const bks = bookings.filter(b => {
          const r = rides.find(x => x.id === b.rid);
          return r && r.date === dStr && b.st === 'confirmed';
        });
        const rVal = bks.reduce((a,c) => a + c.fare, 0);
        chartBars.push({ label: dayLabel, val: S.anaMetric === 'revenue' ? rVal : count });
      }
    }

    const maxChartVal = Math.max(1, ...chartBars.map(x => x.val));

    // Corridor popularity
    const routeStats = {};
    activeRides.forEach(r => {
      const k = rn(r.path);
      if (!routeStats[k]) routeStats[k] = { count: 0, seats: 0, cap: 0, fareSum: 0 };
      routeStats[k].count++;
      routeStats[k].cap += r.cap;
      routeStats[k].seats += (r.cap - r.seats);
      routeStats[k].fareSum += (r.rate * 14);
    });

    const topCorridors = Object.entries(routeStats).sort((a,b) => b[1].count - a[1].count).slice(0, 4);
    const maxCorridorCount = Math.max(1, ...topCorridors.map(c => c[1].count));

    return `
    <div class="ana-header">
      <div class="row sp" style="align-items:flex-start">
        <div>
          <h2>Mobility &amp; Fleet Analytics</h2>
          <p class="sub">Recent activity and fleet performance, limited to the latest 100 records per category.</p>
        </div>
      </div>

      <!-- Time Range & Metric Filter Toolbar -->
      <div class="ana-toolbar">
        <div class="row">
          <span class="mu" style="font-size:12px;font-weight:700">TIME RANGE:</span>
          <div class="ana-filter-group">
            <button class="ana-filter-btn ${rng==='today'?'active':''}" onclick="S.anaRange='today';render()">Today</button>
            <button class="ana-filter-btn ${rng==='7d'?'active':''}" onclick="S.anaRange='7d';render()">7 Days</button>
            <button class="ana-filter-btn ${rng==='30d'?'active':''}" onclick="S.anaRange='30d';render()">30 Days</button>
            <button class="ana-filter-btn ${rng==='all'?'active':''}" onclick="S.anaRange='all';render()">Available data</button>
          </div>
        </div>

        <div class="row">
          <span class="mu" style="font-size:12px;font-weight:700">CHART METRIC:</span>
          <div class="ana-filter-group">
            <button class="ana-filter-btn ${S.anaMetric==='rides'?'active':''}" onclick="S.anaMetric='rides';render()">Trips Volume</button>
            <button class="ana-filter-btn ${S.anaMetric==='revenue'?'active':''}" onclick="S.anaMetric='revenue';render()">Gross Fares (₹)</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 6 Executive KPI Metric Cards -->
    <div class="grid">
      ${sc('users', totalUsers, 'Recent Users (max 100)', 'blue')}
      ${sc('car', activeRides.length, 'Trips in Range', 'purple')}
      ${sc('ticket', activeBookings.length, 'Bookings (' + confirmationRate + '% confirmed)', 'green')}
      ${sc('rupee', '₹' + rev, 'Confirmed Ride Fares', 'amber')}
      ${sc('leaf', co2Kg + ' kg', 'CO₂ Saved (~' + trees + ' trees)', 'green')}
      ${sc('alert', cancellCount, 'Cancellations in Range', 'red')}
    </div>

    <!-- Chart 1: Dynamic Bar Volume & Conversion -->
    <div class="two">
      <div class="card ana-chart-card">
        <div class="row sp" style="margin-bottom:12px">
          <h3>${S.anaMetric==='revenue' ? 'Daily Platform Gross Revenue (₹)' : 'Daily Carpool Commute Trips'}</h3>
          <span class="tag b">${rng.toUpperCase()}</span>
        </div>
        
        <div class="ana-bars-container">
          ${chartBars.length ? chartBars.map(b => `
            <div class="ana-bar-col">
              <span class="ana-bar-val">${S.anaMetric==='revenue' ? '₹' : ''}${b.val}</span>
              <div class="ana-bar-fill ${S.anaMetric==='revenue' ? 'revenue' : ''}" style="height:${Math.max(8, (b.val / maxChartVal) * 100)}%"></div>
              <span class="ana-bar-label">${b.label}</span>
            </div>
          `).join('') : '<p class="mu">No trip activity in this period.</p>'}
        </div>
        <p class="mu" style="margin:0;font-size:12px">Calculated from the latest recorded trips and bookings available.</p>
      </div>

      <!-- Booking Funnel & Capacity Efficiency -->
      <div class="card">
        <div class="row sp" style="margin-bottom:14px">
          <h3>Booking Conversion Distribution</h3>
          <span class="tag">${confirmedBookings.length} Completed</span>
        </div>
        
        <div style="margin:14px 0">
          <div class="row sp" style="margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">Confirmed bookings</span>
            <b style="color:#10b981">${Math.round((confirmedBookings.length / Math.max(1, activeBookings.length)) * 100)}%</b>
          </div>
          <div class="bar"><i style="width:${Math.round((confirmedBookings.length / Math.max(1, activeBookings.length)) * 100)}%;background:#10b981"></i></div>
        </div>

        <div style="margin:14px 0">
          <div class="row sp" style="margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">Pending requests</span>
            <b style="color:#f59e0b">${activeBookings.filter(b=>b.st==='pending').length} requests</b>
          </div>
          <div class="bar"><i style="width:${Math.round((activeBookings.filter(b=>b.st==='pending').length / Math.max(1, activeBookings.length)) * 100)}%;background:#f59e0b"></i></div>
        </div>

        <div style="margin:14px 0">
          <div class="row sp" style="margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">Fleet Utilization</span>
            <b style="color:#38bdf8">${fleetUtilization}% occupied seats</b>
          </div>
          <div class="bar"><i style="width:${fleetUtilization}%;background:#38bdf8"></i></div>
        </div>

        <div class="row sp" style="margin-top:20px;padding-top:14px;border-top:1px solid var(--bd)">
          <span class="mu">Emergency report resolution</span>
          <span class="tag ${incidentResolutionRate === null ? '' : incidentResolutionRate === 100 ? '' : 'w'}">${incidentResolutionRate === null ? 'No reports' : incidentResolutionRate + '% resolved'}</span>
        </div>
      </div>
    </div>

    <!-- Chart 2: Route Corridor Load & Dynamic Feed -->
    <div class="two">
      <div class="card">
        <div class="row sp" style="margin-bottom:12px">
          <h3>Highest Demand Commute Corridors</h3>
          <span class="mu">Route Frequency</span>
        </div>
        ${topCorridors.length ? topCorridors.map(([cName, cData]) => `
          <div class="corridor-row">
            <div class="corridor-info">
              <div class="row sp">
                <b style="font-size:13px">${cName}</b>
                <span class="mu">${cData.count} trips (${cData.seats} riders)</span>
              </div>
              <div class="corridor-bar-track">
                <div class="corridor-bar-progress" style="width:${(cData.count / maxCorridorCount) * 100}%"></div>
              </div>
            </div>
            <span class="tag b">${Math.round((cData.seats / Math.max(1, cData.cap)) * 100)}% Load</span>
          </div>
        `).join('') : '<p class="mu">No corridor data in this date range.</p>'}
      </div>

      <!-- Recent Activity -->
      <div class="card">
        <div class="row sp" style="margin-bottom:12px">
          <h3>Recent Activity</h3>
        </div>
        <div>
          ${auditStream.map(l => `
            <div class="audit-stream-item">
              <span class="audit-dot"></span>
              <div style="flex:1">
                <div>${esc(l.t)}</div>
                <span class="mu">${ago(l.ts)}</span>
              </div>
            </div>
          `).join('') || '<p class="mu">No recorded activity yet.</p>'}
        </div>
      </div>
    </div>

    <!-- Recent ride routes -->
    <div class="card">
      <div class="row sp" style="margin-bottom:10px">
        <div>
          <h3>Recent Trip Routes</h3>
          <span class="mu">Routes from the latest recorded trips.</span>
        </div>
      </div>
      ${mapSvg({list: activeRides.map(r=>({id:r.id,path:r.path})), hi:0})}
    </div>

    `;
  },

  users(){
    const q=(S.aq||'').toLowerCase();
    const l=users.filter(u=>u.role=='user'&&((u.name||'')+(u.email||'')).toLowerCase().includes(q)).slice(0,25);
    return hd('Users','Search and review registered accounts.')+
    `<div class="card"><input id="sq" placeholder="Search by name or email" value="${S.aq||''}" oninput="S.aq=this.value;render()"></div>`+
    (l.length ? tb(['User Name','Email','Vehicle Details','Account Status','Action'], l.map(u=>{
      const emergencyCount=incidents.filter(incident=>String(incident.uid)===String(u.id)).length;
      const carInfo = u.car ? `<b>${u.car.m || u.car}</b> <span style="font-size:11px;" class="mu">(${tg(u.car.st||'pending', u.car.st==='approved'?'':'w')})</span>` : '<span class="mu">No vehicle</span>';
      const displayName = u.name || (u.email ? u.email.split('@')[0] : 'User');
      return [
        `<div class="row" style="gap:8px;">${av(displayName)}<div><b>${displayName}</b><br><span class="mu" style="font-size:11px;">ID: ${String(u.id).slice(-6)}</span></div></div>`,
        `<span style="font-family:monospace;font-size:12px;">${u.email}</span>`,
        carInfo,
        `${u.blocked ? tg('blocked','r') : tg('active','')}${emergencyCount?`<br><span class="mu">${emergencyCount} emergency report(s)</span>`:''}`,
        `<div class="row"><button class="btn g s" onclick="blk('${u.id}')">${u.blocked?'Unblock':'Block'}</button><button class="btn d s" onclick="deleteAdminUser('${u.id}')">Delete</button></div>`
      ];
    })) : empty('users', 'No users found.'));
  },
  rides(){
    const f=S.rf,l=rides.filter(r=>f=='all'||r.status==f).slice(0,50);
    return hd('Rides','Review the 50 most recent trips. Delete a ride to remove its bookings and messages.')+`<div class="row" style="margin-bottom:14px">${['all','scheduled','boarding','active','completed','cancelled'].map(s=>`<button class="chip ${f==s?'on':''}" onclick="S.rf='${s}';render()">${s} (${s=='all'?rides.length:rides.filter(r=>r.status==s).length})</button>`).join('')}</div>`+tb(['Driver','Route','Date','Seats','Status','Actions'],l.map(r=>[r.drv,rn(r.path),r.date+' '+r.time,(r.cap-r.seats)+'/'+r.cap,tg(r.status,r.status=='cancelled'?'r':'b'),`<div class="row">${r.status=='scheduled'?`<button class="btn g s" onclick="cancelRide(${jsArg(r.id)})">Cancel</button>`:''}<button class="btn d s" onclick="deleteAdminRide(${jsArg(r.id)})">Delete</button></div>`]));
  },
  inc(){
    const recent=incidents.slice(0,50);
    return hd('Emergency reports','Review the latest 50 reports, record the outcome, and take account or ride action when needed.')+(recent.map(i=>{
      const repeatCount=incidents.filter(item=>String(item.uid)===String(i.uid)).length;
      const linkedRide=rides.find(ride=>String(ride.id)===String(i.rideId));
      const routeLabel=linkedRide?rn(linkedRide.path):i.rideRoute||'No linked ride';
      return `<div class="card">
        <div class="row sp"><div><h3>${i.type==='unsafe'?'Personal safety':i.type==='vehicle'?'Vehicle issue':i.type==='medical'?'Medical emergency':i.type==='collision'?'Collision':'Other emergency'}</h3><span class="mu">Reported by ${esc(i.by)} · ${ago(new Date(i.createdAt||Date.now()).getTime())} · ${repeatCount} report(s) from this user</span></div>${tg(i.status,i.status==='open'?'r':'')}</div>
        <p>${esc(i.details)}</p><p class="mu">Location: ${esc(i.location||'Not provided')} · Ride: ${esc(routeLabel)}</p>
        ${i.status==='resolved'?`<div class="tag">Resolution: ${esc(i.resolution)}${i.resolutionNote?' · '+esc(i.resolutionNote):''}</div>`:`<div class="fg"><div><label for="resolution-${i._id}">Resolution</label><select id="resolution-${i._id}"><option value="">Choose outcome</option><option value="emergency-services-contacted">Emergency services contacted</option><option value="roadside-assistance-dispatched">Roadside assistance dispatched</option><option value="user-safe">User confirmed safe</option><option value="false-alarm">False alarm</option><option value="other">Other</option></select></div><div><label for="resolution-note-${i._id}">Admin notes</label><input id="resolution-note-${i._id}" placeholder="Actions taken or follow-up needed"></div></div><div class="row" style="margin-top:12px"><button class="btn s" onclick="resolveIncident('${i._id}')">Save resolution</button><button class="btn d s" onclick="deleteAdminUser('${i.uid}')">Delete reported user</button>${i.rideId?`<button class="btn d s" onclick="deleteAdminRide('${i.rideId}')">Delete linked ride</button>`:''}</div>`}
      </div>`;
    }).join('')||empty('check','No emergency reports yet.'));
  },
  ver(){
    return hd('Vehicle verification','Review and approve vehicle documents & registrations.')+
    (vq.length ? vq.slice(0,25).map((v,i)=>`
      <div class="card row sp" style="margin-bottom:12px">
        <div>
          <h3 style="margin:0 0 4px 0;">${v.name}</h3>
          <span class="mu">Owner: <b style="color:var(--tx);font-weight:700;">${v.owner || 'Registered User'}</b> · Status: ${tg(v.st, v.st=='pending'?'w':v.st=='rejected'?'r':'')}</span>
        </div>
        <div class="row" style="gap:8px;">
          ${v.st=='pending'?`
            <button class="btn s" onclick="vset(${i},'approved')" style="background:#10b981;border-color:#10b981;color:#fff;">✓ Approve</button>
            <button class="btn g s" onclick="vset(${i},'rejected')" style="color:#ef4444;">✕ Reject</button>
          `:`<span class="mu" style="font-weight:700;font-size:12px;">${v.st.toUpperCase()}</span>`}
        </div>
      </div>
    `).join('') : empty('check','No vehicle verification requests pending.'));
  }
});

// function vset(i,s){
//   const v=vq[i];
//   if(!v) return;
//   v.st=s;
//   const u=users.find(x=>x.id==v.uid || x.name==v.owner);
//   if(u){
//     if(!u.car) u.car={m:v.name,st:s};
//     else u.car.st=s;
//     notify(u.id,'Your vehicle '+v.name+' was '+s+' by Admin.','Admin','profile');
//   }
//   logEv('Vehicle '+v.name+' '+s+' for '+(v.owner||'user'));
//   toast('Vehicle '+s+' for '+(v.owner||'user')+'.');
//   render();
// }

async function vset(i, s) {
  const v = vq[i];
  if (!v) return;

  const u = users.find(x => x.id == v.uid || x.name == v.owner);
  if (!u) {
    toast('User not found.');
    return;
  }

  try {
    await apiRequest('/users/' + u.id, {
      method: 'PUT',
      body: {
        car: {
          m: v.name,
          st: s
        }
      }
    });

    // Update frontend state
    v.st = s;
    if (!u.car) {
      u.car = { m: v.name, st: s };
    } else {
      u.car.st = s;
    }

    notify(
      u.id,
      'Your vehicle ' + v.name + ' was ' + s + ' by Admin.',
      'Admin',
      'profile'
    );

    logEv('Vehicle ' + v.name + ' ' + s + ' for ' + (v.owner || 'user'));

    toast('Vehicle ' + s + ' for ' + (v.owner || 'user') + '.');

    render();

  } catch (err) {
    console.error('Vehicle approval error:', err);
    toast(err.message || 'Failed to update vehicle.');
  }
}

async function resolveIncident(id){
  const resolution=$('resolution-'+id)?.value;
  const resolutionNote=$('resolution-note-'+id)?.value.trim()||'';
  if(!resolution)return toast('Choose a resolution before closing this report.');
  try{
    const incident=await apiRequest('/incidents/'+encodeURIComponent(id),{method:'PUT',body:{resolution,resolutionNote}});
    Object.assign(incidents.find(item=>String(item._id)===String(id))||{},incident);
    logEv('Emergency report resolved: '+incident.by+' ('+resolution+')');
    toast('Resolution saved.');
    render();
  }catch(err){toast(err.message)}
}

async function deleteAdminUser(id){
  const user=users.find(item=>String(item.id)===String(id));
  if(!user)return toast('User not found.');
  if(!confirm('Delete '+user.name+' and remove their rides, bookings, and ride messages? Emergency reports will remain for audit.'))return;
  try{
    const result=await apiRequest('/users/'+encodeURIComponent(id),{method:'DELETE'});
    const deletedRideIds=new Set((result.rideIds||[]).map(String));
    users=users.filter(item=>String(item.id)!==String(id));
    rides=rides.filter(item=>!deletedRideIds.has(String(item.id)));
    bookings=bookings.filter(item=>String(item.pid)!==String(id)&&!deletedRideIds.has(String(item.rid)));
    msgs=msgs.filter(item=>!deletedRideIds.has(String(item.rid)));
    vq=vq.filter(item=>String(item.uid)!==String(id));
    toast('User and related records deleted.');
    render();
  }catch(err){toast(err.message)}
}

async function deleteAdminRide(id){
  const ride=rides.find(item=>String(item.id)===String(id));
  if(!ride)return toast('Ride not found.');
  if(!confirm('Delete this ride and its bookings and messages?'))return;
  try{
    await apiRequest('/rides/'+encodeURIComponent(id),{method:'DELETE'});
    rides=rides.filter(item=>String(item.id)!==String(id));
    bookings=bookings.filter(item=>String(item.rid)!==String(id));
    msgs=msgs.filter(item=>String(item.rid)!==String(id));
    toast('Ride and related records deleted.');
    render();
  }catch(err){toast(err.message)}
}
