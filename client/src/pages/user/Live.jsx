import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Av, Empty } from '../../components/ui';
import MapSvg from '../../components/Map';
import { SharePanel } from '../../components/features';
import { P, rn, nm, rideProgress, rideSegmentForBooking } from '../../lib/cityGraph';
import { ago } from '../../lib/format';
import { Veh } from '../../components/Icons';

export default function Live() {
  const { me, rides, bookings, gpsRideId, startLocationSharing, stopLocationSharing, sosOpen, setSosOpen, setSosRide, sos, openChatThread, completePassengerSegment, go } = useApp();
  const [f, setF] = useState({ type: '', location: '', details: '' });
  const done = useRef(new Set());
  const id = me.id;
  let r = rides.find(x => String(x.own) === String(id) && ['boarding', 'active'].includes(x.status)), pb = null;
  if (!r) {
    pb = bookings.find(item => { const ride = rides.find(c => String(c.id) === String(item.rid)); return String(item.pid) === String(id) && item.st === 'confirmed' && !item.tripCompletedAt && ride && ['boarding', 'active'].includes(ride.status); });
    r = pb && rides.find(ride => String(ride.id) === String(pb.rid));
  }
  const segment = pb && r ? rideSegmentForBooking(r, pb) : null;
  useEffect(() => { if (pb && segment && segment.progress >= 1 && !done.current.has(pb.id)) { done.current.add(pb.id); completePassengerSegment(pb); } });

  if (!r) return (
    <>
      <Hd t="Trip status" s="Status updates and emergency support for your ride." />
      <div className="two"><div><MapSvg /><p className="mu">Your route and car appear here when a trip is active.</p></div>
        <div><Empty i="pin" t="No active trip right now. Tracking activates when a driver confirms and starts your trip."><button className="btn" onClick={() => go('find')}>Find a ride</button></Empty></div></div>
    </>
  );
  const path = segment ? segment.path : r.path, progress = segment ? segment.progress : rideProgress(r), pct = Math.round(progress * 100);
  const isOwner = String(r.own) === String(id), canShare = isOwner && ['boarding', 'active'].includes(r.status);
  const fresh = r.location && Date.now() - new Date(r.location.updatedAt).getTime() < 90000;
  const msg = fresh ? 'Driver location updated ' + ago(new Date(r.location.updatedAt).getTime()) + (r.location.accuracy ? ' · accuracy about ' + Math.round(r.location.accuracy) + ' m' : '') : r.status === 'completed' ? 'Trip completed.' : isOwner ? 'Share your location to show the car on the map.' : 'Waiting for the driver to share GPS location.';
  const legs = pb && pb.journeyId ? bookings.filter(b => b.journeyId === pb.journeyId).sort((a, b) => a.legIndex - b.legIndex) : [];
  const sharing = gpsRideId === String(r.id);

  return (
    <>
      <Hd t="Trip status" s={<>{rn(path)} · <Tag c="b">{r.status}</Tag></>} />
      <div className="two">
        <div>
          <MapSvg list={[{ id: r.id, path }]} hi={r.id} start={path[0]} end={path[path.length - 1]} progress={progress} location={fresh ? r.location : null} vtype={r.vtype} />
          <div className="row sp"><span className="mu">{segment ? 'Your trip segment' : 'Trip progress'}</span><b id="trip-progress-text">{pct}%</b></div>
          <div className="bar"><i id="trip-progress-bar" style={{ width: pct + '%' }} /></div>
          <p className="mu">{msg}</p>
        </div>
        <div>
          <div className="card">
            <div className="row"><Av name={r.drv} /><div><h3>{r.drv}</h3><span className="mu"><Veh t={r.vtype} z={17} /> {r.veh}</span></div></div>
            <p className="mu" style={{ marginTop: 14 }}>{segment ? 'Your tracking ends at ' + P[path[path.length - 1]][0] + '.' : r.status === 'active' ? 'The driver marked this ride in progress.' : 'Waiting for the driver to start.'}</p>
            {canShare && <><p className="mu">Confirmed passengers can see your location while sharing is on.</p><button className={'btn ' + (sharing ? 'd' : '')} onClick={() => sharing ? stopLocationSharing() : startLocationSharing(r.id)}>{sharing ? 'Stop location sharing' : 'Share my location'}</button></>}
          </div>
          {legs.length > 1 && (
            <div className="card"><h3>Your continuous journey</h3>
              {legs.map(l => { const lr = rides.find(x => x.id === l.rid); return (
                <div key={l.id} className="row sp" style={{ padding: '6px 0', opacity: l.tripCompletedAt ? .55 : 1 }}>
                  <span><Veh t={lr ? lr.vtype : 'car'} z={17} /> Leg {l.legIndex + 1}: {nm(l.f)} → {nm(l.t)}</span>
                  <Tag c={l.tripCompletedAt ? '' : l.id === pb.id ? 'b' : 'w'}>{l.tripCompletedAt ? 'done' : l.id === pb.id ? 'in progress' : 'next'}</Tag>
                </div>); })}
              <p className="mu" style={{ marginBottom: 0 }}>When this leg ends, your next vehicle is notified automatically.</p>
            </div>
          )}
          <div className="card"><div className="row">
            <button className="btn d" onClick={() => { setSosOpen(!sosOpen); setSosRide(r.id); }}>SOS Emergency</button>
            <button className="btn g" onClick={() => openChatThread(r.id)}>Message</button>
          </div></div>
          {!isOwner && pb && <SharePanel rideId={r.id} bookingId={pb.id} />}
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
