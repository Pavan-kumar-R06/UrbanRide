import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Stat, Tag } from '../../components/ui';
import MapSvg from '../../components/Map';
import { api } from '../../lib/api';
import { hourLabel } from '../../lib/format';
import { VEHICLES, P } from '../../lib/cityGraph';
import { Veh } from '../../components/Icons';

export default function Heat() {
  const { toast } = useApp();
  const [range, setRange] = useState('7d'), [vtype, setVt] = useState('all'), [hour, setHour] = useState('all');
  const [h, setH] = useState(null);
  useEffect(() => { api(`/analytics/heatmap?range=${range}&vtype=${vtype}`).then(setH).catch(e => toast(e.message)); }, [range, vtype]); // eslint-disable-line
  const view = useMemo(() => {
    if (!h) return null;
    const nodes = {};
    h.nodes.forEach(n => { const g = h.grid[n.id]; const dem = hour === 'all' ? n.demand : g.demand[hour], sup = hour === 'all' ? n.supply : g.supply[hour]; nodes[n.id] = { demand: dem, supply: sup, value: dem - sup }; });
    const edges = h.edges.map(e => ({ ...e, value: e.gap }));
    return { nodes, edges };
  }, [h, hour]);
  const maxH = h ? Math.max(1, ...h.hourDemand, ...h.hourSupply) : 1;
  return (
    <>
      <Hd t="Mobility demand & supply" s="Where and when passengers are asking for rides versus where drivers are actually available." />
      <div className="ana-toolbar" style={{ marginBottom: 14 }}>
        <div className="row"><span className="mu" style={{ fontSize: 12, fontWeight: 700 }}>TIME RANGE:</span><div className="ana-filter-group">{[['today', 'Today'], ['7d', '7 Days'], ['30d', '30 Days'], ['all', 'All data']].map(([k, l]) => <button key={k} className={'ana-filter-btn ' + (range === k ? 'active' : '')} onClick={() => setRange(k)}>{l}</button>)}</div></div>
        <div className="row"><span className="mu" style={{ fontSize: 12, fontWeight: 700 }}>VEHICLE:</span><div className="ana-filter-group"><button className={'ana-filter-btn ' + (vtype === 'all' ? 'active' : '')} onClick={() => setVt('all')}>All</button>{Object.entries(VEHICLES).map(([k, v]) => <button key={k} className={'ana-filter-btn ' + (vtype === k ? 'active' : '')} onClick={() => setVt(k)}><Veh t={k} z={16} /></button>)}</div></div>
      </div>
      {!h ? <p className="mu">Building heatmap…</p> : <>
        <div className="grid">
          <Stat i="search" v={h.totals.demand} l="Seat requests & searches" c="red" /><Stat i="car" v={h.totals.supply} l="Seats offered" c="blue" />
          <Stat i="clock" v={h.peakHour === null ? '—' : hourLabel(h.peakHour).toUpperCase()} l="Peak demand hour" c="amber" /><Stat i="alert" v={h.underservedNodes.length} l="Underserved hubs" c="purple" />
        </div>
        <div className="two">
          <div className="card">
            <div className="row sp" style={{ marginBottom: 8 }}><h3>Demand − supply map</h3><select style={{ width: 'auto' }} value={hour} onChange={e => setHour(e.target.value === 'all' ? 'all' : +e.target.value)}><option value="all">All day</option>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}</select></div>
            <MapSvg heat={view} fixed />
            <div className="row" style={{ marginTop: 8 }}><span className="tag r">● Demand exceeds supply</span><span className="tag b">● Supply exceeds demand</span><span className="mu" style={{ fontSize: 12 }}>Circle size = gap at that hub · line thickness = gap on that road</span></div>
          </div>
          <div className="card">
            <h3>Hour by hour</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 150, margin: '10px 0 4px' }}>
              {h.hourDemand.map((d, i) => (
                <div key={i} title={`${String(i).padStart(2, '0')}:00 · demand ${d}, supply ${h.hourSupply[i]}`} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%', cursor: 'pointer', opacity: hour === 'all' || hour === i ? 1 : .45 }} onClick={() => setHour(hour === i ? 'all' : i)}>
                  <div style={{ flex: 1, background: '#ef4444', height: Math.max(2, d / maxH * 100) + '%', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ flex: 1, background: '#38bdf8', height: Math.max(2, h.hourSupply[i] / maxH * 100) + '%', borderRadius: '3px 3px 0 0' }} />
                </div>))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>{h.hourDemand.map((_, i) => <span key={i} className="mu" style={{ flex: 1, fontSize: 9, textAlign: 'center' }}>{i % 3 === 0 ? hourLabel(i) : ''}</span>)}</div>
            <div className="row" style={{ marginTop: 8 }}><span className="tag r">Demand</span><span className="tag b">Supply</span><span className="mu" style={{ fontSize: 12 }}>Click a bar to filter the map to that hour.</span></div>
          </div>
        </div>
        <div className="two">
          <div className="card"><h3>Underserved hubs</h3>
            {h.underservedNodes.length ? h.underservedNodes.slice(0, 10).map(n => <div key={n.id} className="row sp" style={{ padding: '6px 0' }}><b>{n.name}</b><span className="mu">gap of {n.gap} seat(s) · {n.demand} wanted / {n.supply} offered</span></div>) : <p className="mu">All active hubs are covered.</p>}
          </div>
          <div className="card"><h3>Searches with no matching ride</h3>
            {h.unmatchedRoutes.length ? h.unmatchedRoutes.slice(0, 10).map(o => <div key={o.f + o.t} className="row sp" style={{ padding: '6px 0' }}><b>{o.label}</b><Tag c="w">{o.unmatched} unmet</Tag></div>) : <p className="mu">Every recorded search found a ride.</p>}
          </div>
        </div>
      </>}
    </>
  );
}
