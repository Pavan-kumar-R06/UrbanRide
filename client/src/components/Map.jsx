import { E, P, routePointForGps, routePointForProgress, edgeKey } from '../lib/cityGraph';
import { useApp } from '../state/AppContext';
import { Ic } from './Icons';

/* Same cartographic SVG engine as the original app, plus optional analytic layers
   (heat = per-hub values, traffic = per-segment congestion, blocked = closed segments). */
export default function MapSvg({ list = [], hi, pick, drop, from, start, end, progress, location, heat, traffic, blocked, vtype, fixed }) {
  const { map, toggleMap } = useApp();
  const { z, cx, cy, lay, big } = map;
  const w = 100 / z, x = Math.max(0, Math.min(100 - w, cx - w / 2)), y = Math.max(0, Math.min(100 - w, cy - w / 2));
  const ln = p => p.map(k => P[k][1] + ',' + P[k][2]).join(' ');
  const selected = list.find(q => q.id == hi);
  const carPoint = location && selected ? routePointForGps(location, selected.path) : selected && typeof progress === 'number' ? routePointForProgress(progress, selected.path) : null;
  const zm = v => toggleMap(m => ({ z: Math.max(1, Math.min(4, m.z + v)) }));
  const pn = (a, b) => toggleMap(m => { const zz = m.z <= 1 ? 1.6 : m.z; return { z: zz, cx: Math.max(0, Math.min(100, m.cx + a * 12 / zz)), cy: Math.max(0, Math.min(100, m.cy + b * 12 / zz)) }; });
  const Btn = ({ l, f, t, dis }) => <button className="btn g" disabled={dis} onClick={f} aria-label={t || l} title={dis ? 'Zoom in to enable map panning' : t || l}>{l}</button>;
  const blockedSet = new Set(blocked || []);
  const trafficColor = lvl => lvl > 0.75 ? '#ef4444' : lvl > 0.5 ? '#f97316' : lvl > 0.3 ? '#f59e0b' : '#22c55e';
  const heatMax = heat ? Math.max(1, ...Object.values(heat.nodes || {}).map(h => Math.abs(h.value)), ...(heat.edges || []).map(e => Math.abs(e.value))) : 1;

  const Pin = ({ k, col, t }) => {
    if (!k || !P[k]) return null;
    const px = P[k][1], py = P[k][2], isP = t === 'P' || t === 'A';
    return (
      <g className="map-pin-group">
        {isP && <circle className="pl" cx={px} cy={py} r="3.4" fill={col} opacity=".4" />}
        <circle cx={px} cy={py} r="3.2" fill={col} stroke="#ffffff" strokeWidth="1.2" />
        <text x={px} y={py + 1.2} fontSize="3.4" fontWeight="900" textAnchor="middle" fill="#ffffff" fontFamily="'Plus Jakarta Sans', Sora, sans-serif">{t}</text>
      </g>
    );
  };
  const Hub = ({ k }) => {
    const [name, px, py] = P[k];
    let tx = px + 3.2, ty = py + 1.1, anchor = 'start';
    if (k === 'wf') { tx = px - 3.2; anchor = 'end'; } else if (k === 'mg') { tx = px; ty = py - 4.5; anchor = 'middle'; }
    return (
      <g className="city-hub-marker">
        <circle cx={px} cy={py} r="1.8" fill="#0f172a" stroke="#ffffff" strokeWidth="1.1" />
        <circle cx={px} cy={py} r="0.6" fill="#38bdf8" />
        <text x={tx} y={ty} fontSize="3.1" fontWeight="700" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.2" paintOrder="stroke" textAnchor={anchor}>{name}</text>
      </g>
    );
  };

  return (
    <div className={'mw ' + (big ? 'big' : '')} id="mapWrapper">
      {big ? (
        <div className="map-modal-top">
          <div className="map-modal-title"><Ic n="route" z={22} /><span>Bengaluru City Ride Map</span></div>
          <button className="btn d s" onClick={() => toggleMap({ big: 0 })}>✕ Close Map (Esc)</button>
        </div>
      ) : null}
      <svg className="map" onClick={() => !fixed && toggleMap(m => ({ big: m.big ? 0 : 1 }))} viewBox={`${x} ${y} ${w} ${w}`} role="img" aria-label="Bengaluru City Transit Map">
        <title>Click to {big ? 'shrink' : 'enlarge'} the map</title>
        <rect width="100" height="100" fill="#0c131d" />
        <path d="M54 65 C57 62, 65 63, 67 66 C68 68, 64 71, 58 70 C55 69, 53 67, 54 65 Z" fill="#1e3a5f" stroke="#2563eb" strokeWidth="0.3" />
        <path d="M56 46 C58 45, 61 46, 61 48 C60 50, 57 50, 56 48 Z" fill="#1e3a5f" stroke="#2563eb" strokeWidth="0.3" />
        <ellipse cx="48" cy="14" rx="3.8" ry="2" fill="#1e3a5f" stroke="#2563eb" strokeWidth="0.3" />
        <ellipse cx="35" cy="27" rx="2.5" ry="1.5" fill="#1e3a5f" stroke="#2563eb" strokeWidth="0.3" />
        <rect x="44" y="34" width="7" height="4.5" rx="1.5" fill="#133e2b" stroke="#15803d" strokeWidth="0.3" />
        <rect x="25" y="54" width="6" height="4" rx="1.5" fill="#133e2b" stroke="#15803d" strokeWidth="0.3" />
        <path d="M12 60Q20 20 50 18Q88 20 94 55Q85 90 45 94Q15 92 12 60Z" fill="none" stroke="#1e293b" strokeWidth="3" />
        <path d="M12 60Q20 20 50 18Q88 20 94 55Q85 90 45 94Q15 92 12 60Z" fill="none" stroke="#334155" strokeWidth="1.6" />
        {lay.road ? <>
          {E.map(([a, zz]) => <line key={'c' + a + zz} x1={P[a][1]} y1={P[a][2]} x2={P[zz][1]} y2={P[zz][2]} stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />)}
          {E.map(([a, zz]) => <line key={'i' + a + zz} x1={P[a][1]} y1={P[a][2]} x2={P[zz][1]} y2={P[zz][2]} stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />)}
        </> : null}
        {lay.metro ? <>
          <polyline points="87,42 77,54 64,46 52,42 22,52" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="87,42 77,54 64,46 52,42 22,52" fill="none" stroke="#ffffff" strokeWidth=".5" strokeDasharray="1 1.2" />
          <polyline points="50,10 38,30 52,42 42,60 33,74" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="50,10 38,30 52,42 42,60 33,74" fill="none" stroke="#ffffff" strokeWidth=".5" strokeDasharray="1 1.2" />
          <circle cx="52" cy="42" r="2.6" fill="none" stroke="#8b5cf6" strokeWidth="0.8" />
          <circle cx="52" cy="42" r="1.8" fill="none" stroke="#10b981" strokeWidth="0.8" />
        </> : null}

        {traffic ? traffic.map(s => <line key={'t' + s.key} x1={P[s.a][1]} y1={P[s.a][2]} x2={P[s.b][1]} y2={P[s.b][2]} stroke={trafficColor(s.level)} strokeWidth="1.5" strokeLinecap="round" opacity=".9" />) : null}
        {heat && heat.edges ? heat.edges.map(e => <line key={'h' + e.key} x1={P[e.a][1]} y1={P[e.a][2]} x2={P[e.b][1]} y2={P[e.b][2]} stroke={e.value > 0 ? '#ef4444' : '#38bdf8'} strokeWidth={0.8 + 3.2 * Math.min(1, Math.abs(e.value) / heatMax)} strokeLinecap="round" opacity={e.value ? 0.75 : 0.15} />) : null}
        {blocked ? [...blockedSet].map(k => { const [a, b] = k.split('-'); if (!P[a] || !P[b]) return null; const mx = (P[a][1] + P[b][1]) / 2, my = (P[a][2] + P[b][2]) / 2; return (<g key={'x' + k}><line x1={P[a][1]} y1={P[a][2]} x2={P[b][1]} y2={P[b][2]} stroke="#ef4444" strokeWidth="2" strokeDasharray="1.6 1.2" /><circle cx={mx} cy={my} r="2.4" fill="#ef4444" stroke="#fff" strokeWidth=".6" /><text x={mx} y={my + 1.1} fontSize="3" fontWeight="900" textAnchor="middle" fill="#fff">✕</text></g>); }) : null}

        {list.map((q, i) => <polyline key={'l' + i} points={ln(q.path)} fill="none" stroke="#475569" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />)}
        {selected ? <>
          <polyline points={ln(selected.path)} fill="none" stroke="#0284c7" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline className="rt" points={ln(selected.path)} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </> : null}
        {from && pick && from !== pick ? <line x1={P[from][1]} y1={P[from][2]} x2={P[pick][1]} y2={P[pick][2]} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="1.2 1.2" /> : null}

        {Object.keys(P).map(k => <Hub key={k} k={k} />)}
        {heat && heat.nodes ? Object.entries(heat.nodes).map(([k, h]) => h.value ? <circle key={'hn' + k} cx={P[k][1]} cy={P[k][2]} r={2 + 6 * Math.min(1, Math.abs(h.value) / heatMax)} fill={h.value > 0 ? '#ef4444' : '#38bdf8'} opacity=".38" stroke={h.value > 0 ? '#ef4444' : '#38bdf8'} strokeWidth=".4" /> : null) : null}

        <Pin k={pick} col="#16a34a" t="P" /><Pin k={drop} col="#dc2626" t="D" /><Pin k={start} col="#16a34a" t="A" /><Pin k={end} col="#dc2626" t="B" />
        {carPoint ? (
          <g id="trip-car-marker" className="gps-car" transform={`translate(${carPoint.x} ${carPoint.y}) rotate(${carPoint.angle})`} aria-label="Vehicle position on the trip route">
            <circle className="pl" r="4.5" fill="#f59e0b" opacity=".28" />
            {vtype === 'bike' || vtype === 'scooter' ? <>
              <rect x="-2.6" y="-1" width="5.2" height="2" rx="1" fill="#f59e0b" stroke="#ffffff" strokeWidth=".6" />
              <circle cx="-2.2" cy="1.2" r="1" fill="#0c131d" stroke="#ffffff" strokeWidth=".35" /><circle cx="2.2" cy="1.2" r="1" fill="#0c131d" stroke="#ffffff" strokeWidth=".35" />
            </> : <>
              <rect x="-2.8" y="-1.8" width="5.6" height="3.6" rx="1.1" fill="#f59e0b" stroke="#ffffff" strokeWidth=".7" />
              <rect x="-1.6" y="-1.25" width="3.2" height="1.15" rx=".4" fill="#0c131d" />
              <circle cx="-1.6" cy="1.7" r=".55" fill="#0c131d" stroke="#ffffff" strokeWidth=".25" /><circle cx="1.6" cy="1.7" r=".55" fill="#0c131d" stroke="#ffffff" strokeWidth=".25" />
            </>}
          </g>
        ) : null}
        <g transform={`translate(${x + w - 8}, ${y + 4})`}><text x="3" y="4" fontSize="3.6" fontWeight="900" fill="#ffffff" fontFamily="'Plus Jakarta Sans', Sora, sans-serif">N↑</text></g>
        <g transform={`translate(${x + 3}, ${y + w - 4})`}><text x="0" y="-1.5" fontSize="2.6" fontWeight="700" fill="#94a3b8" fontFamily="'Plus Jakarta Sans', Sora, sans-serif">3 km</text><line x1="0" y1="0" x2="11" y2="0" stroke="#94a3b8" strokeWidth="0.8" /></g>
      </svg>
      <div className="mc">
        <Btn l="+" f={() => zm(1)} t="Zoom in" /><Btn l="−" f={() => zm(-1)} t="Zoom out" />
        <span className="map-pan-label">Pan</span>
        <div className="map-pan-controls"><Btn l="◀" f={() => pn(-1, 0)} t="Pan map left" /><Btn l="▲" f={() => pn(0, -1)} t="Pan map up" /><Btn l="▼" f={() => pn(0, 1)} t="Pan map down" /><Btn l="▶" f={() => pn(1, 0)} t="Pan map right" /></div>
        <Btn l="Reset" f={() => toggleMap({ z: 1, cx: 50, cy: 50 })} />
        {[['road', 'Roads'], ['metro', 'Metro']].map(([k, l]) => <button key={k} className={'btn ' + (lay[k] ? '' : 'g')} onClick={() => toggleMap(m => ({ lay: { ...m.lay, [k]: !m.lay[k] } }))}>{l}</button>)}
        <button className={'btn ' + (big ? 'd' : '')} onClick={() => toggleMap(m => ({ big: m.big ? 0 : 1 }))}>{big ? '✕ Close Map' : '⛶ Expand Map'}</button>
      </div>
    </div>
  );
}
