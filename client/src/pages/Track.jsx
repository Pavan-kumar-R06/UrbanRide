import { useEffect, useRef, useState } from 'react';
import { Brand, Veh } from '../components/Icons';
import { AppProvider } from '../state/AppContext';
import MapSvg from '../components/Map';
import { Tag } from '../components/ui';
import { ago } from '../lib/format';

/* Public, read-only live tracking page for the person a trip was shared with. */
function TrackInner({ token }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const stop = useRef(() => {});
  useEffect(() => { if (d && d.ended) stop.current(); }, [d]); // tracking ends with the ride: no more polling
  useEffect(() => {
    let dead = false;
    const load = async () => { try { const r = await fetch('/api/track/' + token); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Unavailable'); if (!dead) { setD(j); setErr(''); } } catch (e) { if (!dead) setErr(e.message); } };
    let t; const run = async () => { await load(); };
    run(); t = setInterval(run, 4000); stop.current = () => clearInterval(t);
    return () => { dead = true; clearInterval(t); };
  }, [token]);
  const pct = d ? Math.round(d.progress * 100) : 0;
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 18px' }}>
      <div style={{ marginBottom: 20 }}><Brand z={30} /></div>
      {err && !d ? <div className="card"><h3>Tracking unavailable</h3><p className="mu">{err}</p></div> : !d ? <p className="mu">Loading trip…</p> : <>
        <h2 style={{ marginBottom: 4 }}>{d.sharedBy} {d.ended ? (d.status === 'cancelled' ? 'had a trip' : 'completed the trip') : 'is on a trip'}{d.contactName ? ', ' + d.contactName : ''}</h2>
        <p className="sub">{d.from} → {d.to} · <Veh t={d.vtype} z={17} /> {d.vehicle} · driver {d.driver}</p>
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
