import { useEffect, useRef, useState } from 'react';
import { Brand, Veh } from '../components/Icons';
import { AppProvider } from '../state/AppContext';
import MapSvg from '../components/Map';
import { Tag } from '../components/ui';
import { vLabel } from '../lib/cityGraph';
import { ago } from '../lib/format';

const LEG_COLORS = ['#38bdf8', '#a855f7', '#f59e0b'];

/* ---- one multi-vehicle journey: every leg shown with its own vehicle ---- */
function JourneyView({ d }) {
  const pct = Math.round(d.progress * 100), cur = d.legs[d.currentLeg] || d.legs[0];
  const hubs = d.legs.slice(1).map(l => l.path[0]);
  const stateOf = (l, i) => l.status === 'completed' ? 'done' : i === d.currentLeg ? 'current' : 'next';
  const prev = d.legs[d.currentLeg - 1];
  // between two vehicles: the previous leg is done and the next vehicle has not started yet
  const waiting = !d.ended && !!prev && prev.status === 'completed' && !!cur && cur.status !== 'active';
  const chip = l => ({ completed: ['b', 'completed'], active: ['', 'on the way'], boarding: ['w', 'boarding'], scheduled: ['w', 'up next'], cancelled: ['r', 'cancelled'] }[l.status] || ['w', l.status]);
  return (
    <>
      <h2 style={{ marginBottom: 4 }}>{d.sharedBy} {d.ended ? (d.status === 'cancelled' ? 'had a journey' : 'completed the journey') : 'is on a journey'}{d.contactName ? ', ' + d.contactName : ''}</h2>
      <p className="sub">{d.from} → {d.to} · {d.legs.length} vehicles{hubs.length ? ' · changing at ' + hubs.map(h => d.legs.find(l => l.path[0] === h).from).join(' and ') : ''}</p>
      {d.ended && <div className="card" style={{ margin: '0 0 12px', padding: 14, borderColor: d.status === 'cancelled' ? '#ef4444' : '#10b981' }}><b style={{ color: d.status === 'cancelled' ? '#ef4444' : '#10b981', fontSize: 17 }}>{d.status === 'cancelled' ? 'Journey interrupted' : 'Journey completed'}</b><br /><span className="mu">{d.status === 'cancelled' ? 'One of the rides was cancelled, so live tracking has ended.' : d.sharedBy + ' has reached the destination' + (d.endedAt ? ' at ' + new Date(d.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '') + '. Live tracking has ended.'}</span></div>}
      <div className="card">
        <div className="row sp" style={{ marginBottom: 10 }}>
          <Tag c={d.ended ? (d.status === 'cancelled' ? 'r' : 'b') : d.status === 'active' ? '' : 'w'}>{d.ended ? (d.status === 'cancelled' ? 'interrupted' : 'completed') : d.status === 'active' ? 'on the way' : d.status}</Tag>
          {!d.ended && d.etaMinutes !== null && <b>About {d.etaMinutes} min left on this leg</b>}
        </div>
        <MapSvg fixed
          legs={d.legs.map((l, i) => ({ path: l.path, color: LEG_COLORS[i % 3], state: stateOf(l, i) }))} hubs={hubs}
          list={cur ? [{ id: 'cur', path: cur.path }] : []} hi="cur" start={d.legs[0].path[0]} end={d.legs[d.legs.length - 1].path.slice(-1)[0]}
          progress={d.ended || waiting ? undefined : cur.progress} location={d.ended ? null : d.location} vtype={cur && cur.vtype} />
        <div className="row sp"><span className="mu">Whole journey</span><b>{d.status === 'cancelled' ? '—' : pct + '%'}</b></div><div className="bar"><i style={{ width: pct + '%' }} /></div>
        {waiting && <p className="mu" style={{ marginBottom: 0 }}>Changing vehicle at {cur.from}. Next: {cur.driver} ({cur.vehicle.split(' · ')[0]}), departs {cur.departure.split(' ')[1]}.</p>}
        {!waiting && !d.ended && <p className="mu" style={{ marginBottom: 0 }}>{d.location ? 'Live GPS updated ' + ago(new Date(d.location.updatedAt).getTime()) + '.' : 'Position estimated from the route timeline.'} This page updates automatically.</p>}
      </div>
      {d.legs.map((l, i) => {
        const [c, label] = chip(l), isCur = i === d.currentLeg && !d.ended;
        return (
          <div key={i} className="card" style={{ borderLeft: '4px solid ' + LEG_COLORS[i % 3], ...(isCur ? { boxShadow: '0 0 0 2px rgba(56,189,248,0.18)' } : {}) }}>
            <div className="row sp">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <span className="profile-vehicle-icon" style={{ color: LEG_COLORS[i % 3] }}><Veh t={l.vtype} z={22} /></span>
                <div><b>Leg {i + 1} · {vLabel(l.vtype)}</b><br /><span className="mu">{l.vehicle} · driver {l.driver}</span></div>
              </div>
              <Tag c={c}>{label}</Tag>
            </div>
            <div style={{ marginTop: 8 }}>{l.from} → {l.to} <span className="mu">· {l.km} km · departs {l.departure.split(' ')[1]}</span></div>
            {l.status === 'active' && <><div className="bar" style={{ marginTop: 8 }}><i style={{ width: Math.round(l.progress * 100) + '%' }} /></div></>}
          </div>
        );
      })}
    </>
  );
}

/* Public, read-only live tracking page for the person a trip was shared with. */
function TrackInner({ token }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const stop = useRef(() => {});
  useEffect(() => { if (d && d.ended) stop.current(); }, [d]); // tracking ends with the ride: no more polling
  useEffect(() => {
    let dead = false;
    const load = async () => { try { const r = await fetch('/api/track/' + token); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Unavailable'); if (!dead) { setD(j); setErr(''); } } catch (e) { if (!dead) setErr(e.message); } };
    load(); const t = setInterval(load, 4000); stop.current = () => clearInterval(t);
    return () => { dead = true; clearInterval(t); };
  }, [token]);
  const pct = d && d.progress !== undefined ? Math.round(d.progress * 100) : 0;
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 18px' }}>
      <div style={{ marginBottom: 20 }}><Brand z={30} /></div>
      {err && !d ? <div className="card"><h3>Tracking unavailable</h3><p className="mu">{err}</p></div> : !d ? <p className="mu">Loading trip…</p> : d.kind === 'journey' ? <JourneyView d={d} /> : <>
        <h2 style={{ marginBottom: 4 }}>{d.sharedBy} {d.ended ? (d.status === 'cancelled' ? 'had a trip' : 'completed the trip') : 'is on a trip'}{d.contactName ? ', ' + d.contactName : ''}</h2>
        <p className="sub">{d.from} → {d.to} · <Veh t={d.vtype} z={16} /> {d.vehicle} · driver {d.driver}</p>
        <div className="card">
          {d.ended && <div className="card" style={{ margin: '0 0 12px', padding: 14, borderColor: d.status === 'cancelled' ? '#ef4444' : '#10b981' }}><b style={{ color: d.status === 'cancelled' ? '#ef4444' : '#10b981', fontSize: 17 }}>{d.status === 'cancelled' ? 'Ride cancelled' : 'Ride completed'}</b><br /><span className="mu">{d.status === 'cancelled' ? 'This trip was cancelled. Live tracking has ended.' : d.sharedBy + ' has reached the destination' + (d.endedAt ? ' at ' + new Date(d.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '') + '. Live tracking has ended.'}</span></div>}
          <div className="row sp" style={{ marginBottom: 10 }}><Tag c={d.ended ? (d.status === 'cancelled' ? 'r' : 'b') : d.status === 'active' ? '' : 'w'}>{d.ended ? (d.status === 'cancelled' ? 'cancelled' : 'completed') : d.status === 'active' ? 'on the way' : d.status}</Tag>{!d.ended && d.etaMinutes !== null && <b>About {d.etaMinutes} min to go</b>}</div>
          <MapSvg fixed list={[{ id: 'x', path: d.path }]} hi="x" start={d.path[0]} end={d.path[d.path.length - 1]} progress={d.ended ? undefined : d.progress} location={d.ended ? null : d.location} vtype={d.vtype} />
          <div className="row sp"><span className="mu">Progress</span><b>{d.status === 'cancelled' ? '—' : pct + '%'}</b></div><div className="bar"><i style={{ width: pct + '%' }} /></div>
          <p className="mu" style={{ marginBottom: 0 }}>{d.ended ? 'This page no longer updates.' : d.status === 'scheduled' ? 'Departs ' + d.departure + '.' : d.location ? 'Live GPS updated ' + ago(new Date(d.location.updatedAt).getTime()) + '.' : 'Position estimated from the route timeline.'} {d.ended ? '' : 'This page updates automatically.'}</p>
        </div>
      </>}
    </div>
  );
}
export default function Track({ token }) { return <AppProvider><TrackInner token={token} /></AppProvider>; }
