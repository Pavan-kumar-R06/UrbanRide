const zm=x=>{S.z=Math.max(1,Math.min(4,S.z+x));render()};
const pn=(a,b)=>{S.cx=Math.max(0,Math.min(100,S.cx+a*10/S.z));S.cy=Math.max(0,Math.min(100,S.cy+b*10/S.z));render()};
const ly=k=>{S.lay[k]=!S.lay[k];render()};

function carPos(r){
  const n=r.path.length-1,p=Math.min(r.prog,.999)*n,s=Math.floor(p),f=p-s,a=P[r.path[s]],b=P[r.path[s+1]];
  return[a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
}

/* ========================================================================= */
/* REAL-WORLD CARTOGRAPHIC MAP ENGINE (MATCHING UPLOADED USER DESIGN)        */
/* ========================================================================= */
function mapSvg(o={}){
  const w=100/S.z, x=Math.max(0,Math.min(100-w,S.cx-w/2)), y=Math.max(0,Math.min(100-w,S.cy-w/2));
  const L=S.lay, list=o.list||[], hi=o.hi, car=o.car;
  const ln=p=>p.map(k=>P[k][1]+','+P[k][2]).join(' ');
  const c=car&&carPos(car);

  // Helper for buttons
  const b=(l,f,t,dis)=>`<button class="btn g" ${dis?'disabled':''} onclick="${f}" aria-label="${t||l}" title="${dis?'Zoom in to enable map panning':t||l}">${l}</button>`;

  // Clean vector Pin badge (Solid, high contrast, crisp)
  const pin=(k, col, t)=> {
    if (!k || !P[k]) return '';
    const px = P[k][1], py = P[k][2];
    const isP = t === 'P' || t === 'A';
    return `
      <g class="map-pin-group">
        ${isP ? `<circle class="pl" cx="${px}" cy="${py}" r="3.4" fill="${col}" opacity=".4"/>` : ''}
        <circle cx="${px}" cy="${py}" r="3.2" fill="${col}" stroke="#ffffff" stroke-width="1.2"/>
        <text x="${px}" y="${py+1.2}" font-size="3.4" font-weight="900" text-anchor="middle" fill="#ffffff" font-family="'Plus Jakarta Sans', Sora, sans-serif">${t}</text>
      </g>
    `;
  };

  // Clean Hub marker with collision-free placement
  const hubNode=(k)=> {
    const [name, px, py] = P[k];
    let tx = px + 3.2;
    let ty = py + 1.1;
    let anchor = 'start';
    
    if (k === 'wf') {
      tx = px - 3.2;
      anchor = 'end';
    } else if (k === 'mg') {
      tx = px;
      ty = py - 4.5;
      anchor = 'middle';
    }

    return `
      <g class="city-hub-marker">
        <circle cx="${px}" cy="${py}" r="1.8" fill="#0f172a" stroke="#ffffff" stroke-width="1.1"/>
        <circle cx="${px}" cy="${py}" r="0.6" fill="#38bdf8"/>
        <text x="${tx}" y="${ty}" font-size="3.1" font-weight="700" fill="#f8fafc" stroke="#0f172a" stroke-width="1.2" paint-order="stroke" text-anchor="${anchor}">${name}</text>
      </g>
    `;
  };

  return `
  <div class="mw ${S.big ? 'big' : ''}" id="mapWrapper">
    ${S.big ? `
      <div class="map-modal-top">
        <div class="map-modal-title">
          ${ic('route', 22)}
          <span>Bengaluru City Ride Map</span>
        </div>
        <button class="btn d s" onclick="S.big=0;render();">✕ Close Map (Esc)</button>
      </div>
    ` : ''}

    <svg class="map" onclick="S.big=!S.big;render()" viewBox="${x} ${y} ${w} ${w}" role="img" aria-label="Bengaluru City Transit Map">
      <title>Click to ${S.big ? 'shrink' : 'enlarge'} the map</title>
      
      <!-- Base Canvas (Clean Dark Cartographic Slate) -->
      <rect width="100" height="100" fill="#0c131d"/>

      <!-- REAL-WORLD WATER BODIES (Clean Solid Slate-Blue) -->
      <!-- Bellandur Lake -->
      <path d="M54 65 C57 62, 65 63, 67 66 C68 68, 64 71, 58 70 C55 69, 53 67, 54 65 Z" fill="#1e3a5f" stroke="#2563eb" stroke-width="0.3"/>
      <!-- Ulsoor Lake -->
      <path d="M56 46 C58 45, 61 46, 61 48 C60 50, 57 50, 56 48 Z" fill="#1e3a5f" stroke="#2563eb" stroke-width="0.3"/>
      <!-- Hebbal Lake -->
      <ellipse cx="48" cy="14" rx="3.8" ry="2" fill="#1e3a5f" stroke="#2563eb" stroke-width="0.3"/>
      <!-- Sankey Tank -->
      <ellipse cx="35" cy="27" rx="2.5" ry="1.5" fill="#1e3a5f" stroke="#2563eb" stroke-width="0.3"/>

      <!-- REAL-WORLD PARKS & BOTANICAL GARDENS (Clean Solid Forest Green) -->
      <!-- Cubbon Park -->
      <rect x="44" y="34" width="7" height="4.5" rx="1.5" fill="#133e2b" stroke="#15803d" stroke-width="0.3"/>
      <!-- Lalbagh Botanical Gardens -->
      <rect x="25" y="54" width="6" height="4" rx="1.5" fill="#133e2b" stroke="#15803d" stroke-width="0.3"/>

      <!-- OUTER RING ROAD (ORR) FREEWAY (Clean Dual-Stroke Casing) -->
      <path d="M12 60Q20 20 50 18Q88 20 94 55Q85 90 45 94Q15 92 12 60Z" fill="none" stroke="#1e293b" stroke-width="3"/>
      <path d="M12 60Q20 20 50 18Q88 20 94 55Q85 90 45 94Q15 92 12 60Z" fill="none" stroke="#334155" stroke-width="1.6"/>

      <!-- ROAD NETWORK HIGHWAYS (Dual-Layer Casing) -->
      ${L.road ? E.map(([a,z])=>`<line x1="${P[a][1]}" y1="${P[a][2]}" x2="${P[z][1]}" y2="${P[z][2]}" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>`).join('') +
                 E.map(([a,z])=>`<line x1="${P[a][1]}" y1="${P[a][2]}" x2="${P[z][1]}" y2="${P[z][2]}" stroke="#334155" stroke-width="1.4" stroke-linecap="round"/>`).join('') : ''}

      <!-- NAMMA METRO RAIL TRANSIT LINES -->
      ${L.metro ? `
        <!-- Purple Line -->
        <polyline points="87,42 77,54 64,46 52,42 22,52" fill="none" stroke="#8b5cf6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="87,42 77,54 64,46 52,42 22,52" fill="none" stroke="#ffffff" stroke-width=".5" stroke-dasharray="1 1.2"/>

        <!-- Green Line -->
        <polyline points="50,10 38,30 52,42 42,60 33,74" fill="none" stroke="#10b981" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="50,10 38,30 52,42 42,60 33,74" fill="none" stroke="#ffffff" stroke-width=".5" stroke-dasharray="1 1.2"/>
        
        <!-- Interchange at MG Road -->
        <circle cx="52" cy="42" r="2.6" fill="none" stroke="#8b5cf6" stroke-width="0.8"/>
        <circle cx="52" cy="42" r="1.8" fill="none" stroke="#10b981" stroke-width="0.8"/>
      ` : ''}

      <!-- ALL SCHEDULED RIDE CORRIDORS -->
      ${list.map(q=>`<polyline points="${ln(q.path)}" fill="none" stroke="#475569" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>`).join('')}

      <!-- ACTIVE NAVIGATION ROUTE (Solid Crisp Cyan Dashed Line) -->
      ${hi && list.find(q=>q.id==hi) ? `
        <polyline points="${ln(list.find(q=>q.id==hi).path)}" fill="none" stroke="#0284c7" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="rt" points="${ln(list.find(q=>q.id==hi).path)}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      ` : ''}

      <!-- Walk Distance Connection -->
      ${o.from&&o.pick&&o.from!=o.pick?`<line x1="${P[o.from][1]}" y1="${P[o.from][2]}" x2="${P[o.pick][1]}" y2="${P[o.pick][2]}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="1.2 1.2"/>`:''}

      <!-- CITY HUBS -->
      ${Object.keys(P).map(k=> hubNode(k)).join('')}

      <!-- CLEAN PICKUP & DROPOFF PINS -->
      ${pin(o.pick,'#16a34a','P')}
      ${pin(o.drop,'#dc2626','D')}
      ${pin(o.start,'#16a34a','A')}
      ${pin(o.end,'#dc2626','B')}

      <!-- Completed trip endpoint marker -->
      ${c?`
        <circle class="pl" cx="${c[0]}" cy="${c[1]}" r="2.8" fill="#f59e0b"/>
        <circle cx="${c[0]}" cy="${c[1]}" r="3.2" fill="#f59e0b" stroke="#ffffff" stroke-width=".9"/>
        <g transform="translate(${c[0]-2.2},${c[1]-1.2})">
          <rect width="4.4" height="2.4" rx=".6" fill="#ffffff"/>
          <rect x=".7" y=".3" width="3" height="1" rx=".3" fill="#f59e0b"/>
          <circle cx="1.1" cy="2.3" r=".4" fill="#000000"/>
          <circle cx="3.3" cy="2.3" r=".4" fill="#000000"/>
        </g>
      `:''}

      <!-- Compass: N ↑ -->
      <g transform="translate(${x+w-8}, ${y+4})">
        <text x="3" y="4" font-size="3.6" font-weight="900" fill="#ffffff" font-family="'Plus Jakarta Sans', Sora, sans-serif">N↑</text>
      </g>

      <!-- 3 km Scale Bar -->
      <g transform="translate(${x+3}, ${y+w-4})">
        <text x="0" y="-1.5" font-size="2.6" font-weight="700" fill="#94a3b8" font-family="'Plus Jakarta Sans', Sora, sans-serif">3 km</text>
        <line x1="0" y1="0" x2="11" y2="0" stroke="#94a3b8" stroke-width="0.8"/>
      </g>
    </svg>

    <!-- Interactive Layer Controls Bar -->
    <div class="mc">
      ${b('+','zm(1)','Zoom in')}
      ${b('−','zm(-1)','Zoom out')}
      <span class="map-pan-label">Pan</span><div class="map-pan-controls">
        ${b('◀','pn(-1,0)','Pan map left',S.z<=1)}
        ${b('▲','pn(0,-1)','Pan map up',S.z<=1)}
        ${b('▼','pn(0,1)','Pan map down',S.z<=1)}
        ${b('▶','pn(1,0)','Pan map right',S.z<=1)}
      </div>
      ${b('Reset','S.z=1;S.cx=50;S.cy=50;render()')}
      ${[['road','Roads'],['metro','Metro']].map(([k,l])=>`<button class="btn ${L[k]?'':'g'}" onclick="ly('${k}')">${l}</button>`).join('')}
      <button class="btn ${S.big ? 'd' : ''}" onclick="S.big=!S.big;render()">${S.big ? '✕ Close Map' : '⛶ Expand Map'}</button>
    </div>
  </div>
  `;
}

const CITY_GEO={
  ec:[12.839,77.677],hsr:[12.911,77.644],kor:[12.935,77.624],jay:[12.925,77.583],
  mg:[12.975,77.606],ind:[12.978,77.641],mar:[12.956,77.701],wf:[12.970,77.750],
  mal:[13.003,77.564],ya:[13.028,77.540],heb:[13.035,77.598]
};
let liveTrackingMap=null,liveTrackingMarker=null,liveTrackingRideId=null;

function renderLiveTrackingMap(ride){
  const element=$('live-map');
  if(!element)return;
  if(!window.L){
    element.textContent='Map tiles are unavailable. Allow network access to load the live map.';
    return;
  }
  const savedCenter=liveTrackingMap?liveTrackingMap.getCenter():null;
  const savedZoom=liveTrackingMap?liveTrackingMap.getZoom():null;
  const point=ride.location;
  const locationIsFresh=point&&Date.now()-new Date(point.updatedAt).getTime()<90000;
  if(liveTrackingMap)liveTrackingMap.remove();
  liveTrackingMap=L.map(element,{scrollWheelZoom:false}).setView(savedCenter||CITY_GEO[ride.path[0]]||[12.9716,77.5946],savedZoom||12);
  liveTrackingRideId=String(ride.id);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(liveTrackingMap);
  const route=ride.path.map(key=>CITY_GEO[key]).filter(Boolean);
  if(route.length>1)L.polyline(route,{color:'#0ea5e9',weight:5,opacity:.8}).addTo(liveTrackingMap);
  const start=route[0],end=route[route.length-1];
  if(start)L.circleMarker(start,{radius:6,color:'#fff',weight:2,fillColor:'#16a34a',fillOpacity:1}).addTo(liveTrackingMap).bindTooltip('Start');
  if(end)L.circleMarker(end,{radius:6,color:'#fff',weight:2,fillColor:'#dc2626',fillOpacity:1}).addTo(liveTrackingMap).bindTooltip('Destination');
  if(locationIsFresh){
    const position=[point.lat,point.lng];
    liveTrackingMarker=L.marker([point.lat,point.lng],{
      icon:L.divIcon({className:'live-car-marker',html:'<span></span>',iconSize:[24,24],iconAnchor:[12,12]})
    }).addTo(liveTrackingMap).bindTooltip('Driver location');
    if(!savedCenter&&route.length>1)liveTrackingMap.fitBounds([...route,position],{padding:[24,24],maxZoom:13});
    else if(!liveTrackingMap.getBounds().contains(position))liveTrackingMap.panTo(position);
  }else{
    liveTrackingMarker=null;
  }
  requestAnimationFrame(()=>liveTrackingMap&&liveTrackingMap.invalidateSize());
}

function destroyLiveTrackingMap(){
  if(liveTrackingMap)liveTrackingMap.remove();
  liveTrackingMap=null;
  liveTrackingMarker=null;
  liveTrackingRideId=null;
}
