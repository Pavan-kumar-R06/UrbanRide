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
    const trees = Math.max(1, Math.round(co2Kg / 21)); // 1 mature tree absorbs ~21kg/year
    const totalUsers = users.filter(u => u.role === 'user').length;
    const totalVehicles = users.filter(u => u.car).length;
    const cancellCount = activeBookings.filter(b => ['cancelled', 'ride-cancelled', 'rejected'].includes(b.st)).length + rides.filter(r => r.date >= cutoff && r.status === 'cancelled').length;
    const confirmationRate = activeBookings.length ? Math.round((confirmedBookings.length / activeBookings.length) * 100) : 100;

    // Daily volume calculation
    const numCols = rng === 'today' ? 6 : rng === '7d' ? 7 : 8;
    const chartBars = [];

    if (rng === 'today') {
      const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
      hours.forEach(h => {
        const count = rides.filter(r => r.date === today && r.time.slice(0,2) === h.slice(0,2)).length;
        const bks = bookings.filter(b => {
          const r = rides.find(x => x.id === b.rid);
          return r && r.date === today && r.time.slice(0,2) === h.slice(0,2) && b.st === 'confirmed';
        });
        const rVal = bks.reduce((a,c) => a + c.fare, 0);
        chartBars.push({ label: h, val: S.anaMetric === 'revenue' ? rVal : count });
      });
    } else {
      const daysCount = rng === '7d' ? 7 : 8;
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
          <p class="sub">Live telemetry synchronized with MongoDB database. Active monitoring across all corridors. <span class="live">Connected</span></p>
        </div>
        <div class="row">
          <button class="btn s" onclick="simReq(1);toast('⚡ Simulated live booking injected into MongoDB telemetry!');" style="background:#10b981;color:#fff;">
            ${ic('zap', 14)} Simulate Live Trip Booking
          </button>
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
            <button class="ana-filter-btn ${rng==='all'?'active':''}" onclick="S.anaRange='all';render()">All Time</button>
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
      ${sc('users', totalUsers, 'Total Registered Users', 'blue')}
      ${sc('car', activeRides.length, 'Trips in Range', 'purple')}
      ${sc('ticket', activeBookings.length, 'Bookings (' + confirmationRate + '% confirmed)', 'green')}
      ${sc('rupee', '₹' + rev, 'Platform Fares Earned', 'amber')}
      ${sc('leaf', co2Kg + ' kg', 'CO₂ Saved (~' + trees + ' trees)', 'green')}
      ${sc('alert', cancellCount, 'Cancellation Index', 'red')}
    </div>

    <!-- Chart 1: Dynamic Bar Volume & Conversion -->
    <div class="two">
      <div class="card ana-chart-card">
        <div class="row sp" style="margin-bottom:12px">
          <h3>${S.anaMetric==='revenue' ? 'Daily Platform Gross Revenue (₹)' : 'Daily Carpool Commute Trips'}</h3>
          <span class="tag b">${rng.toUpperCase()}</span>
        </div>
        
        <div class="ana-bars-container">
          ${chartBars.map(b => `
            <div class="ana-bar-col">
              <span class="ana-bar-val">${S.anaMetric==='revenue' ? '₹' : ''}${b.val}</span>
              <div class="ana-bar-fill ${S.anaMetric==='revenue' ? 'revenue' : ''}" style="height:${Math.max(8, (b.val / maxChartVal) * 100)}%"></div>
              <span class="ana-bar-label">${b.label}</span>
            </div>
          `).join('')}
        </div>
        <p class="mu" style="margin:0;font-size:12px">Data continuously aggregated from confirmed trip bookings in MongoDB.</p>
      </div>

      <!-- Booking Funnel & Capacity Efficiency -->
      <div class="card">
        <div class="row sp" style="margin-bottom:14px">
          <h3>Booking Conversion Distribution</h3>
          <span class="tag">${confirmedBookings.length} Completed</span>
        </div>
        
        <div style="margin:14px 0">
          <div class="row sp" style="margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">Confirmed &amp; Paid</span>
            <b style="color:#10b981">${Math.round((confirmedBookings.length / Math.max(1, activeBookings.length)) * 100)}%</b>
          </div>
          <div class="bar"><i style="width:${Math.round((confirmedBookings.length / Math.max(1, activeBookings.length)) * 100)}%;background:#10b981"></i></div>
        </div>

        <div style="margin:14px 0">
          <div class="row sp" style="margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">Pending Driver Verification</span>
            <b style="color:#f59e0b">${activeBookings.filter(b=>b.st==='pending').length} requests</b>
          </div>
          <div class="bar"><i style="width:${Math.round((activeBookings.filter(b=>b.st==='pending').length / Math.max(1, activeBookings.length)) * 100)}%;background:#f59e0b"></i></div>
        </div>

        <div style="margin:14px 0">
          <div class="row sp" style="margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">Fleet Utilization</span>
            <b style="color:#38bdf8">${totalVehicles} registered cars</b>
          </div>
          <div class="bar"><i style="width:78%;background:#38bdf8"></i></div>
        </div>

        <div class="row sp" style="margin-top:20px;padding-top:14px;border-top:1px solid var(--bd)">
          <span class="mu">Incident Safety Score</span>
          <span class="tag">100% Resolved</span>
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

      <!-- Real-Time Activity Stream -->
      <div class="card">
        <div class="row sp" style="margin-bottom:12px">
          <h3>Real-Time Audit Stream</h3>
          <span class="live">Live</span>
        </div>
        <div>
          ${log.slice(0, 5).map(l => `
            <div class="audit-stream-item">
              <span class="audit-dot"></span>
              <div style="flex:1">
                <div>${l.t}</div>
                <span class="mu">${ago(l.ts)}</span>
              </div>
            </div>
          `).join('') || `
            <div class="audit-stream-item">
              <span class="audit-dot" style="background:#10b981"></span>
              <div style="flex:1">
                <div>Aarav Sharma completed ride Electronic City → Whitefield</div>
                <span class="mu">4 min ago</span>
              </div>
            </div>
            <div class="audit-stream-item">
              <span class="audit-dot" style="background:#f59e0b"></span>
              <div style="flex:1">
                <div>Meera K. registered vehicle Honda City · KA01 AB 1234</div>
                <span class="mu">18 min ago</span>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>

    <!-- Live Telemetry Network Map -->
    <div class="card">
      <div class="row sp" style="margin-bottom:10px">
        <div>
          <h3>Live Transit &amp; Route Telemetry</h3>
          <span class="mu">Click the map or use the Expand button to launch the full-screen interactive view.</span>
        </div>
      </div>
      ${mapSvg({list: activeRides.map(r=>({id:r.id,path:r.path})), hi:0})}
    </div>

    <div class="row" style="margin-top:14px">
      <button class="btn g s" onclick="resetDemo()">Reset Demo Data</button>
    </div>
    `;
  },

  users(){
    const q=(S.aq||'').toLowerCase();
    const l=users.filter(u=>u.role=='user'&&((u.name||'')+(u.email||'')).toLowerCase().includes(q));
    return hd('Users','Search and review registered accounts.')+
    `<div class="card"><input id="sq" placeholder="Search by name or email" value="${S.aq||''}" oninput="S.aq=this.value;render()"></div>`+
    (l.length ? tb(['User Name','Email','Vehicle Details','Account Status','Action'], l.map(u=>{
      const carInfo = u.car ? `<b>${u.car.m || u.car}</b> <span style="font-size:11px;" class="mu">(${tg(u.car.st||'pending', u.car.st==='approved'?'':'w')})</span>` : '<span class="mu">No vehicle</span>';
      const displayName = u.name || (u.email ? u.email.split('@')[0] : 'User');
      return [
        `<div class="row" style="gap:8px;">${av(displayName)}<div><b>${displayName}</b><br><span class="mu" style="font-size:11px;">ID: ${String(u.id).slice(-6)}</span></div></div>`,
        `<span style="font-family:monospace;font-size:12px;">${u.email}</span>`,
        carInfo,
        u.blocked ? tg('blocked','r') : tg('active',''),
        `<button class="btn g s" onclick="blk('${u.id}')">${u.blocked?'Unblock':'Block'}</button>`
      ];
    })) : empty('users', 'No users found.'));
  },
  rides(){
    const f=S.rf,l=rides.filter(r=>f=='all'||r.status==f);
    return hd('Rides','Monitor all scheduled and completed trips.')+`<div class="row" style="margin-bottom:14px">${['all','scheduled','boarding','active','completed','cancelled'].map(s=>`<button class="chip ${f==s?'on':''}" onclick="S.rf='${s}';render()">${s} (${s=='all'?rides.length:rides.filter(r=>r.status==s).length})</button>`).join('')}</div>`+tb(['Driver','Route','Date','Seats','Status',''],l.map(r=>[r.drv,rn(r.path),r.date+' '+r.time,(r.cap-r.seats)+'/'+r.cap,tg(r.status,r.status=='cancelled'?'r':'b'),r.status=='scheduled'?`<button class="btn d s" onclick="cancelRide(${jsArg(r.id)})">Cancel</button>`:'']));
  },
  inc(){
    return hd('Incidents','Review security reports and SOS emergency alerts.')+(incidents.map(i=>`<div class="card row sp"><div><h3>${i.type}</h3><span class="mu">Reported by ${i.by}</span></div><div class="row">${tg(i.st,i.st=='open'?'r':'')}${i.st=='open'?`<button class="btn s" onclick="resInc(${i.id})">Resolve</button>`:''}</div></div>`).join('')||empty('check','No open incidents. All clear!'));
  },
  ver(){
    return hd('Vehicle verification','Review and approve vehicle documents & registrations.')+
    (vq.length ? vq.map((v,i)=>`
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

function vset(i,s){
  const v=vq[i];
  if(!v) return;
  v.st=s;
  const u=users.find(x=>x.id==v.uid || x.name==v.owner);
  if(u){
    if(!u.car) u.car={m:v.name,st:s};
    else u.car.st=s;
    notify(u.id,'Your vehicle '+v.name+' was '+s+' by Admin.','Admin','profile');
  }
  logEv('Vehicle '+v.name+' '+s+' for '+(v.owner||'user'));
  toast('Vehicle '+s+' for '+(v.owner||'user')+'.');
  render();
}
