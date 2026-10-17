import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Av, Empty } from '../../components/ui';
import MapSvg from '../../components/Map';
import { SharePanel } from '../../components/features';
import { P, rn, nm, km, rideProgress, rideSegmentForBooking } from '../../lib/cityGraph';

const LEG_COLORS = ['#38bdf8', '#a855f7', '#f59e0b'];
import { ago } from '../../lib/format';
import { Veh } from '../../components/Icons';

export default function Live() {
  const { me, rides, bookings, gpsRideId, startLocationSharing, stopLocationSharing, sosOpen, setSosOpen, setSosRide, sos, openChatThread, completePassengerSegment, go } = useApp();
  const [f, setF] = useState({ type: '', location: '', details: '' });
  const done = useRef(new Set());
  const id = me.id;
  let r = rides.find(x => String(x.own) === String(id) && ['boarding', 'active'].includes(x.status)), pb = null;

  /* A multi-vehicle journey is ONE continuous trip: it stays on screen while the traveller waits at a
     change-over, and its progress runs 0-100% across all legs (it never restarts for the next vehicle). */
  const buildJourney = () => {
    const groups = {};
    bookings.filter(b => String(b.pid) === String(id) && b.journeyId).forEach(b => { (groups[b.journeyId] = groups[b.journeyId] || []).push(b); });
    for (const list of Object.values(groups)) {
      list.sort((a, b) => a.legIndex - b.legIndex);
      const legs = list.map(b => {
        const ride = rides.find(x => String(x.id) === String(b.rid));
        if (!ride) return null;
        const seg = rideSegmentForBooking(ride, b), path = seg ? seg.path : ride.path, prog = seg ? seg.progress : rideProgress(ride);
        const cancelled = ['cancelled', 'rejected', 'ride-cancelled'].includes(b.st);
        const finished = !cancelled && (!!b.tripCompletedAt || ride.status === 'completed' || (ride.status === 'active' && prog >= 0.999));
        const status = cancelled ? 'cancelled' : finished ? 'done' : ride.status === 'active' ? 'active' : ride.status === 'boarding' ? 'boarding' : b.st === 'pending' ? 'awaiting' : 'next';
        return { b, ride, path, km: km(path), status, progress: finished ? 1 : status === 'active' ? prog : 0 };
      });
      if (legs.length < 2 || legs.some(l => !l)) continue;
      const started = legs.some(l => ['done', 'active', 'boarding'].includes(l.status));
      if (!started || legs.every(l => l.status === 'done')) continue;
      const idx = legs.findIndex(l => l.status !== 'done'), cur = legs[idx], prev = legs[idx - 1];
      const total = legs.reduce((a, l) => a + l.km, 0) || 1;
      return { legs, cur, idx, overall: legs.reduce((a, l) => a + l.km * l.progress, 0) / total, waiting: !!prev && prev.status === 'done' && cur.status !== 'active', broken: legs.some(l => l.status === 'cancelled') };
    }
    return null;
  };
  const J = r ? null : buildJourney();
  if (J) { r = J.cur.ride; pb = J.cur.b; }
  else if (!r) {
    pb = bookings.find(item => { const ride = rides.find(c => String(c.id) === String(item.rid)); return String(item.pid) === String(id) && item.st === 'confirmed' && !item.tripCompletedAt && ride && ['boarding', 'active'].includes(ride.status); });
    r = pb && rides.find(ride => String(ride.id) === String(pb.rid));
  }
  const segment = pb && r ? rideSegmentForBooking(r, pb) : null;
  useEffect(() => {
    // mark every leg the traveller has reached the end of (a journey moves on to the next leg immediately, so check them all)
    const reached = J ? J.legs.filter(l => l.status === 'done' && !l.b.tripCompletedAt).map(l => l.b) : (pb && segment && segment.progress >= 1 ? [pb] : []);
    reached.forEach(b => { if (!done.current.has(b.id)) { done.current.add(b.id); completePassengerSegment(b); } });
  });

  if (!r) return (
    <>
      <Hd t="Trip status" s="Status updates and emergency support for your ride." />
      <div className="two"><div><MapSvg /><p className="mu">Your route and car appear here when a trip is active.</p></div>
        <div><Empty i="pin" t="No active trip right now. Tracking activates when a driver confirms and starts your trip."><button className="btn" onClick={() => go('find')}>Find a ride</button></Empty></div></div>
    </>
  );
  const path = segment ? segment.path : r.path, legProgress = segment ? segment.progress : rideProgress(r);
  const progress = J ? J.overall : legProgress, pct = Math.round(progress * 100);
  const isOwner = String(r.own) === String(id), canShare = isOwner && ['boarding', 'active'].includes(r.status);
  const fresh = r.location && Date.now() - new Date(r.location.updatedAt).getTime() < 90000;
  const hubName = J ? nm(J.cur.path[0]) : '';
  const msg = J && J.broken ? 'One of your rides was cancelled. Check My bookings for alternative rides.'
    : J && J.waiting ? `Waiting at ${hubName} for your next ride: ${r.drv} (${String(r.veh).split(' · ')[0]}), departs ${r.time}. Your journey is ${pct}% complete and will carry on from here.`
    : J && J.cur.status === 'boarding' ? `Your next ride from ${hubName} is boarding. Journey ${pct}% complete.`
    : fresh ? 'Driver location updated ' + ago(new Date(r.location.updatedAt).getTime()) + (r.location.accuracy ? ' · accuracy about ' + Math.round(r.location.accuracy) + ' m' : '') : r.status === 'completed' ? 'Trip completed.' : isOwner ? 'Share your location to show the car on the map.' : 'Waiting for the driver to share GPS location.';
  const sharing = gpsRideId === String(r.id);

  return (
    <>
      <Hd t="Trip status" s={J ? <>{nm(J.legs[0].path[0])} → {nm(J.legs[J.legs.length - 1].path.slice(-1)[0])} · <Tag c={J.waiting ? 'w' : 'b'}>{J.waiting ? 'waiting for next vehicle' : 'journey in progress'}</Tag></> : <>{rn(path)} · <Tag c="b">{r.status}</Tag></>} />
      <div className="two">
        <div>
          {J ? (
            <MapSvg legs={J.legs.map((l, i) => ({ path: l.path, color: LEG_COLORS[i % 3], state: l.status === 'done' ? 'done' : i === J.idx ? 'current' : 'next' }))} hubs={J.legs.slice(1).map(l => l.path[0])}
              list={[{ id: r.id, path: J.cur.path }]} hi={r.id} start={J.legs[0].path[0]} end={J.legs[J.legs.length - 1].path.slice(-1)[0]}
              progress={J.cur.status === 'active' ? J.cur.progress : 0} location={fresh && J.cur.status === 'active' ? r.location : null} vtype={r.vtype} />
          ) : (
            <MapSvg list={[{ id: r.id, path }]} hi={r.id} start={path[0]} end={path[path.length - 1]} progress={progress} location={fresh ? r.location : null} vtype={r.vtype} />
          )}
          <div className="row sp"><span className="mu">{J ? 'Whole journey' : segment ? 'Your trip segment' : 'Trip progress'}</span><b id="trip-progress-text">{pct}%</b></div>
          <div className="bar"><i id="trip-progress-bar" style={{ width: pct + '%' }} /></div>
          {J && J.cur.status === 'active' && <><div className="row sp" style={{ marginTop: 8 }}><span className="mu">Leg {J.idx + 1} of {J.legs.length}</span><b>{Math.round(J.cur.progress * 100)}%</b></div><div className="bar"><i style={{ width: Math.round(J.cur.progress * 100) + '%', background: LEG_COLORS[J.idx % 3] }} /></div></>}
          <p className="mu">{msg}</p>
        </div>
        <div>
          <div className="card">
            <div className="row"><Av name={r.drv} /><div><h3>{r.drv}</h3><span className="mu"><Veh t={r.vtype} z={17} /> {r.veh}</span></div></div>
            <p className="mu" style={{ marginTop: 14 }}>{J ? (J.waiting ? 'Your next vehicle from ' + hubName + '.' : 'Leg ' + (J.idx + 1) + ' of ' + J.legs.length + '. Your journey ends at ' + nm(J.legs[J.legs.length - 1].path.slice(-1)[0]) + '.') : segment ? 'Your tracking ends at ' + P[path[path.length - 1]][0] + '.' : r.status === 'active' ? 'The driver marked this ride in progress.' : 'Waiting for the driver to start.'}</p>
            {canShare && <><p className="mu">Confirmed passengers can see your location while sharing is on.</p><button className={'btn ' + (sharing ? 'd' : '')} onClick={() => sharing ? stopLocationSharing() : startLocationSharing(r.id)}>{sharing ? 'Stop location sharing' : 'Share my location'}</button></>}
          </div>
          {J && (
            <div className="card"><h3>Your continuous journey</h3>
              {J.legs.map((l, i) => (
                <div key={l.b.id} className="row sp" style={{ padding: '6px 0', opacity: l.status === 'done' ? .55 : 1 }}>
                  <span style={{ color: LEG_COLORS[i % 3] }}><Veh t={l.ride.vtype} z={17} /> <span style={{ color: 'var(--tx)' }}>Leg {i + 1}: {nm(l.path[0])} → {nm(l.path[l.path.length - 1])}</span></span>
                  <Tag c={l.status === 'done' ? '' : l.status === 'active' ? 'b' : l.status === 'cancelled' ? 'r' : 'w'}>{l.status === 'done' ? 'done' : l.status === 'active' ? 'in progress' : l.status === 'boarding' ? 'boarding' : l.status === 'cancelled' ? 'cancelled' : i === J.idx && J.waiting ? 'waiting here' : l.status === 'awaiting' ? 'awaiting driver' : 'next'}</Tag>
                </div>))}
              <p className="mu" style={{ marginBottom: 0 }}>{J.waiting ? 'You are at the change point. Your progress is paused here until the next vehicle starts, then it continues.' : 'When a leg ends, your journey waits at the change point and the next vehicle is notified automatically.'}</p>
            </div>
          )}
          <div className="card"><div className="row">
            <button className="btn d" onClick={() => { setSosOpen(!sosOpen); setSosRide(r.id); }}>SOS Emergency</button>
            <button className="btn g" onClick={() => openChatThread(r.id)}>Message</button>
          </div></div>
          {!isOwner && pb && <SharePanel rideId={r.id} bookingId={pb.id} journeyId={pb.journeyId || ''} />}
          {sosOpen && (
            <div className="card"><h3>Emergency report</h3><p className="mu">Tell the response team what is happening. Include location details if you can.</p>
              <div className="fg">
                <div><label htmlFor="sos-type">Emergency type</label><select id="sos-type" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="">Choose an emergency</option><option value="medical">Medical emergency</option><option value="collision">Collision or crash</option><option value="unsafe">Personal safety concern</option><option value="vehicle">Vehicle breakdown</option><option value="other">Other</option></select></div>
                <div><label htmlFor="sos-location">Current location</label><input id="sos-location" maxLength={300} placeholder="Street, landmark, or pickup point" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></div>
              </div>
              <label htmlFor="sos-details" style={{ marginTop: 12 }}>What happened?</label>
              <textarea id="sos-details" maxLength={1000} rows={3} placeholder="Describe the help you need" value={f.details} onChange={e => setF({ ...f, details: e.target.value })} />
              <div className="row" style={{ marginTop: 12 }}><button className="btn d" onClick={() => sos({ type: f.type, details: f.details.trim(), location: f.location.trim() })}>Send emergency report</button><button className="btn g" onClick={() => setSosOpen(false)}>Cancel</button></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
