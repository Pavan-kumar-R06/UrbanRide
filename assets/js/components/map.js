const zm=x=>{S.z=Math.max(1,Math.min(4,S.z+x));render()};
const pn=(a,b)=>{if(S.z<=1)S.z=1.6;S.cx=Math.max(0,Math.min(100,S.cx+a*12/S.z));S.cy=Math.max(0,Math.min(100,S.cy+b*12/S.z));render()};
const ly=k=>{S.lay[k]=!S.lay[k];render()};

const CITY_GEO={
  ec:[12.839,77.677],hsr:[12.911,77.644],kor:[12.935,77.624],jay:[12.925,77.583],
  mg:[12.975,77.606],ind:[12.978,77.641],mar:[12.956,77.701],wf:[12.970,77.750],
  mal:[13.003,77.564],ya:[13.028,77.540],heb:[13.035,77.598]
};

function routePointForGps(location,path){
  if(!location||!Number.isFinite(Number(location.lat))||!Number.isFinite(Number(location.lng))||!path||path.length<2)return null;
  const latitude=Number(location.lat),longitude=Number(location.lng),cos=Math.cos(latitude*Math.PI/180);
  const point=[longitude*cos,latitude];
  let nearest=null;
  for(let index=0;index<path.length-1;index++){
    const from=CITY_GEO[path[index]],to=CITY_GEO[path[index+1]],start=P[path[index]],end=P[path[index+1]];
    if(!from||!to||!start||!end)continue;
    const a=[from[1]*cos,from[0]],b=[to[1]*cos,to[0]],dx=b[0]-a[0],dy=b[1]-a[1];
    const fraction=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    const distance=Math.hypot(point[0]-(a[0]+dx*fraction),point[1]-(a[1]+dy*fraction));
    if(!nearest||distance<nearest.distance){
      nearest={distance,x:start[1]+(end[1]-start[1])*fraction,y:start[2]+(end[2]-start[2])*fraction,angle:Math.atan2(end[2]-start[2],end[1]-start[1])*180/Math.PI};
    }
  }
  return nearest;
}

function routePointForProgress(progress,path){
  if(!path||path.length<2)return null;
  const lengths=[];
  let total=0;
  for(let index=0;index<path.length-1;index++){
    const from=P[path[index]],to=P[path[index+1]];
    const length=from&&to?Math.hypot(to[1]-from[1],to[2]-from[2]):0;
    lengths.push(length);
    total+=length;
  }
  if(!total)return null;
  let remaining=Math.max(0,Math.min(1,progress))*total;
  for(let index=0;index<lengths.length;index++){
    const from=P[path[index]],to=P[path[index+1]],length=lengths[index];
    if(remaining<=length||index===lengths.length-1){
      const part=length?Math.min(1,remaining/length):0;
      return{x:from[1]+(to[1]-from[1])*part,y:from[2]+(to[2]-from[2])*part,angle:Math.atan2(to[2]-from[2],to[1]-from[1])*180/Math.PI};
    }
    remaining-=length;
  }
  return null;
}

/* ========================================================================= */
/* REAL-WORLD CARTOGRAPHIC MAP ENGINE (MATCHING UPLOADED USER DESIGN)        */
/* ========================================================================= */
function mapSvg(o={}){
  const w=100/S.z, x=Math.max(0,Math.min(100-w,S.cx-w/2)), y=Math.max(0,Math.min(100-w,S.cy-w/2));
  const L=S.lay, list=o.list||[], hi=o.hi;
  const ln=p=>p.map(k=>P[k][1]+','+P[k][2]).join(' ');
  const selected=list.find(q=>q.id==hi);
  const carPoint=o.location&&selected?routePointForGps(o.location,selected.path):selected&&typeof o.progress==='number'?routePointForProgress(o.progress,selected.path):null;

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
      ${selected ? `
        <polyline points="${ln(selected.path)}" fill="none" stroke="#0284c7" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline class="rt" points="${ln(selected.path)}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
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

      ${carPoint?`
        <g id="trip-car-marker" class="gps-car" transform="translate(${carPoint.x} ${carPoint.y}) rotate(${carPoint.angle})" aria-label="Car position on the trip route">
          <circle class="pl" r="4.5" fill="#f59e0b" opacity=".28"/>
          <rect x="-2.8" y="-1.8" width="5.6" height="3.6" rx="1.1" fill="#f59e0b" stroke="#ffffff" stroke-width=".7"/>
          <rect x="-1.6" y="-1.25" width="3.2" height="1.15" rx=".4" fill="#0c131d"/>
          <circle cx="-1.6" cy="1.7" r=".55" fill="#0c131d" stroke="#ffffff" stroke-width=".25"/>
          <circle cx="1.6" cy="1.7" r=".55" fill="#0c131d" stroke="#ffffff" stroke-width=".25"/>
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
        ${b('◀','pn(-1,0)','Pan map left')}
        ${b('▲','pn(0,-1)','Pan map up')}
        ${b('▼','pn(0,1)','Pan map down')}
        ${b('▶','pn(1,0)','Pan map right')}
      </div>
      ${b('Reset','S.z=1;S.cx=50;S.cy=50;render()')}
      ${[['road','Roads'],['metro','Metro']].map(([k,l])=>`<button class="btn ${L[k]?'':'g'}" onclick="ly('${k}')">${l}</button>`).join('')}
      <button class="btn ${S.big ? 'd' : ''}" onclick="S.big=!S.big;render()">${S.big ? '✕ Close Map' : '⛶ Expand Map'}</button>
    </div>
  </div>
  `;
}

