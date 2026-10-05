import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag } from '../../components/ui';
import MapSvg from '../../components/Map';
import VehicleForm from '../../components/VehicleForm';
import { api } from '../../lib/api';
import { PF, P, VEHICLES, rn, rt3, km, priceFor, PLATFORM_FEE_PCT, serviceFeeFor } from '../../lib/cityGraph';
import { today } from '../../lib/format';
import { Veh } from '../../components/Icons';

let saved = null;
const so = () => Object.keys(P).map(k => <option key={k} value={k}>{P[k][0]}</option>);

export default function Offer() {
  const { me, activeJourneyForUser, go, publish, addVehicle, networks, refreshMe, toast } = useApp();
  const type = me.car?.type || 'car', vt = VEHICLES[type];
  const [c, setC] = useState(() => saved || { f: 'ec', t: 'wf', via: '', date: today, time: '09:00', seats: vt.defaultSeats, rate: vt.defaultRate, pf: ['ac'], rep: 'Once', note: '', networkId: '' });
  const set = (k, v) => { const n = { ...c, [k]: v }; saved = n; setC(n); };
  const tp = k => set('pf', c.pf.includes(k) ? c.pf.filter(x => x !== k) : [...c.pf, k]);
  const active = activeJourneyForUser();
  if (active) return <><Hd t="Finish your current trip first" s={<>{rn(active.path)} · <Tag c="b">{active.status}</Tag></>} /><div className="card"><p className="mu">You can publish or join another ride after this trip is completed.</p><button className="btn" onClick={() => go('live')}>Open current trip</button></div></>;
  if (!me.car || !me.car.m) return <><Hd t="Offer a ride" s="Publish a verified vehicle commute and share fuel costs." /><div className="card"><h3>Register your vehicle first</h3><p className="mu">An admin must verify the vehicle before you can publish a ride. Cars, bikes and scooters are all welcome.</p><VehicleForm onSubmit={addVehicle} /></div></>;
  if (me.car.st !== 'approved') return <><Hd t="Vehicle verification" s="Your vehicle must be approved before you can publish a ride." /><div className="card"><h3>Vehicle not verified by an admin</h3><p className="mu">{me.car.m} is {me.car.st === 'rejected' ? 'not approved' : 'awaiting admin review'}. You will be notified when its status changes.</p><Tag c={me.car.st === 'rejected' ? 'r' : 'w'}>{me.car.st}</Tag></div></>;
  const maint = me.car.maintenance || 'active';
  if (maint === 'due') {
    const fee = serviceFeeFor(type), bal = me.walletBalance || 0, short = bal < fee;
    const paySvc = async () => { try { await api('/vehicle/service', { method: 'POST', body: {} }); await refreshMe(); toast(`Service paid (₹${fee}). Your vehicle is active again.`); } catch (e) { toast(e.message); } };
    return (<><Hd t="Vehicle service due" s="Publishing is paused until your vehicle has been serviced." /><div className="card" style={{ borderColor: '#f59e0b' }}>
      <div className="row sp"><div className="row"><span className="profile-vehicle-icon"><Veh t={type} z={24} /></span><div><h3 style={{ margin: 0 }}>{me.car.m}</h3><span className="mu">Status: service due</span></div></div><Tag c="w">Service due</Tag></div>
      <p className="mu">An admin marked your vehicle as due for service. Pay the service fee from your Mobility Wallet to get it serviced and start publishing rides again.</p>
      <div className="grid" style={{ margin: '12px 0' }}><div><b style={{ fontSize: 22 }}>₹{fee}</b><br /><span className="mu">Service fee</span></div><div><b style={{ fontSize: 22, color: short ? '#ef4444' : '#10b981' }}>₹{bal}</b><br /><span className="mu">Wallet balance</span></div></div>
      <div className="row">{short ? <button className="btn" onClick={() => go('wallet')}>Top up wallet</button> : <button className="btn" onClick={paySvc}>Pay ₹{fee} &amp; complete service</button>}</div></div></>);
  }
  if (maint === 'inactive') {
    const asked = !!me.car.reactivationRequested;
    const ask = async () => { try { await api('/vehicle/reactivate', { method: 'POST', body: {} }); await refreshMe(); toast('Reactivation request sent to the admin team.'); } catch (e) { toast(e.message); } };
    return (<><Hd t="Vehicle inactive" s="Publishing is paused until an admin reactivates your vehicle." /><div className="card" style={{ borderColor: '#ef4444' }}>
      <div className="row sp"><div className="row"><span className="profile-vehicle-icon"><Veh t={type} z={24} /></span><div><h3 style={{ margin: 0 }}>{me.car.m}</h3><span className="mu">Status: inactive</span></div></div><Tag c="r">Inactive</Tag></div>
      <p className="mu">This vehicle was deactivated, so you cannot publish rides with it. Ask an admin to reactivate it; you will be notified once it is approved.</p>
      <div className="row">{asked ? <Tag c="w">Reactivation requested · waiting for admin</Tag> : <button className="btn" onClick={ask}>Request reactivation</button>}</div></div></>);
  }
  const p = rt3(c.f, c.via, c.t), k = km(p), fare = priceFor(k, c.rate, 1).perSeat, seats = Math.min(c.seats, vt.maxSeats);
  const myNets = networks.filter(n => n.myStatus === 'verified');
  return (
    <>
      <Hd t="Offer a ride" s="Publish your commute route. Nearby passengers can book empty seats." />
      <div className="two">
        <div><div className="card">
          <div className="row" style={{ marginBottom: 12 }}><Tag c="b"><Veh t={type} z={16} /> Riding a {vt.label.toLowerCase()}{vt.maxSeats === 1 ? ' · 1 passenger seat' : ''}</Tag></div>
          <div className="fg">
            <div><label>Start</label><select value={c.f} onChange={e => set('f', e.target.value)}>{so()}</select></div>
            <div><label>Destination</label><select value={c.t} onChange={e => set('t', e.target.value)}>{so()}</select></div>
            <div><label>Via Stop (optional)</label><select value={c.via} onChange={e => set('via', e.target.value)}><option value="">None</option>{so()}</select></div>
            <div><label>Date</label><input type="date" value={c.date} onChange={e => set('date', e.target.value)} /></div>
            <div><label>Departure</label><input type="time" value={c.time} onChange={e => set('time', e.target.value)} /></div>
            <div><label>Seats Offered</label><select value={seats} disabled={vt.maxSeats === 1} onChange={e => set('seats', +e.target.value)}>{Array.from({ length: vt.maxSeats }, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}</select></div>
            <div><label>Rate per km (₹)</label><input type="number" min="2" max="20" value={c.rate} onChange={e => set('rate', +e.target.value)} /></div>
            <div><label>Repeat</label><select value={c.rep} onChange={e => set('rep', e.target.value)}>{['Once', 'Weekdays', 'Daily'].map(x => <option key={x}>{x}</option>)}</select></div>
            {myNets.length > 0 && <div><label>Visible to</label><select value={c.networkId} onChange={e => set('networkId', e.target.value)}><option value="">Everyone on UrbanRide</option>{myNets.map(n => <option key={n.id} value={n.id}>{n.name} (members only)</option>)}</select></div>}
          </div>
          <label style={{ marginTop: 16 }}>Preferences</label>
          <div className="row">{Object.keys(PF).map(x => <button key={x} className={'chip ' + (c.pf.includes(x) ? 'on' : '')} onClick={() => tp(x)}>{PF[x]}</button>)}</div>
          <label style={{ marginTop: 16 }}>Note for passengers</label>
          <textarea rows={2} value={c.note} onChange={e => set('note', e.target.value)} placeholder="Pickup point details..." />
          <div className="row" style={{ marginTop: 16 }}><button className="btn" onClick={() => publish({ ...c, seats })}>Publish Ride</button><span className="mu">Vehicle: <Veh t={type} z={17} /> {me.car.m}</span></div>
        </div></div>
        <div><div className="card"><h3>Trip summary</h3>
          <MapSvg list={[{ id: 0, path: p }]} hi={0} start={c.f} end={c.t} />
          <div className="grid" style={{ margin: '14px 0 0' }}>
            <div><b>{k} km</b><br /><span className="mu">Distance</span></div>
            <div><b style={{ color: '#10b981' }}>₹{fare}</b><br /><span className="mu">Full route, per seat</span></div>
            <div><b style={{ color: '#38bdf8' }}>₹{fare * seats}</b><br /><span className="mu">If all seats fill</span></div>
          </div>
          <p className="mu" style={{ marginTop: 10 }}>Passengers pay ₹{c.rate}/km only for the distance they travel.{PLATFORM_FEE_PCT ? ' A ' + PLATFORM_FEE_PCT + '% platform fee is added separately for the passenger.' : ''} Earnings reach your Mobility Wallet when the ride completes.</p></div></div>
      </div>
    </>
  );
}
