import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../state/AppContext';
import { Ic, Veh } from './Icons';
import { Tag, Bar, Av } from './ui';
import { nm, rn } from '../lib/cityGraph';

/* ---------- Ride Reliability Score ---------- */
const relColor = s => s === null || s === undefined ? 'b' : s >= 90 ? '' : s >= 75 ? 'b' : s >= 55 ? 'w' : 'r';
const cache = new Map();
export function useReliability(uids) {
  const key = [...new Set(uids.filter(Boolean).map(String))].sort().join(',');
  const [map, setMap] = useState(() => Object.fromEntries(key.split(',').filter(Boolean).filter(k => cache.has(k)).map(k => [k, cache.get(k)])));
  useEffect(() => {
    const need = key.split(',').filter(k => k && !cache.has(k) || (cache.get(k) && Date.now() - cache.get(k).at > 60000));
    if (!need.length) { setMap(Object.fromEntries(key.split(',').filter(Boolean).map(k => [k, cache.get(k)]))); return; }
    let dead = false;
    api('/reliability?uids=' + need.slice(0, 30).join(',')).then(r => {
      Object.entries(r).forEach(([k, v]) => cache.set(k, { ...v, at: Date.now() }));
      if (!dead) setMap(Object.fromEntries(key.split(',').filter(Boolean).map(k => [k, cache.get(k)]).filter(([, v]) => v)));
    }).catch(() => {});
    return () => { dead = true; };
  }, [key]);
  return map;
}
export const ReliabilityBadge = ({ rel, onClick }) => rel
  ? <span title="Ride Reliability Score" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}><Tag c={relColor(rel.score)}>{rel.score === null ? 'New member' : rel.score + ' · ' + rel.tier}</Tag></span>
  : null;

export function ReliabilityBreakdown({ rel }) {
  if (!rel) return <p className="mu">Calculating…</p>;
  return (
    <div>
      <div className="row sp" style={{ marginBottom: 10 }}>
        <div><b style={{ fontSize: 34, letterSpacing: '-.03em' }}>{rel.score === null ? '—' : rel.score}</b><span className="mu"> / 100</span></div>
        <Tag c={relColor(rel.score)}>{rel.tier}</Tag>
      </div>
      {rel.components.map(c => (
        <div key={c.key} style={{ margin: '10px 0' }}>
          <div className="row sp" style={{ marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{c.label} <span className="mu">· weight {c.weight}%</span></span><b>{c.value === null ? 'No data' : c.value}</b></div>
          <Bar pct={c.value || 0} color={c.value === null ? '#334155' : c.value >= 75 ? '#10b981' : c.value >= 55 ? '#f59e0b' : '#ef4444'} />
          <span className="mu" style={{ fontSize: 12 }}>{c.detail}</span>
        </div>
      ))}
      <p className="mu" style={{ fontSize: 12, marginBottom: 0 }}>Signals without data are skipped and the rest re-weighted, so new members aren't penalised.</p>
    </div>
  );
}

/* ---------- Vehicle Passport ---------- */
export function PassportCard({ data }) {
  if (!data) return null;
  const p = data.passport;
  const row = (k, v) => <div className="profile-detail" key={k}><span>{k}</span><b>{v}</b></div>;
  return (
    <div className="card" style={{ borderColor: '#38bdf8' }}>
      <div className="row sp" style={{ marginBottom: 12 }}>
        <div className="row"><span className="profile-vehicle-icon"><Ic n="badge" z={24} /></span><div><span className="profile-eyebrow">UR VEHICLE PASSPORT</span><h3 style={{ margin: 0 }}><Veh t={p.type} z={22} /> {p.vehicle}</h3></div></div>
        <span className="mu" style={{ fontFamily: 'monospace' }}>{p.id}</span>
      </div>
      <div className="profile-details">
        {row('Vehicle', `${p.typeLabel} · ${p.vehicle}`)}
        {row('Registration', p.registration)}
        {row('Owner', <>{p.owner} {p.ownerVerified ? <Tag>Verified</Tag> : <Tag c="w">Unverified</Tag>}</>)}
        {row('Vehicle age', p.vehicleAge === null ? 'Not provided' : p.vehicleAge + (p.vehicleAge === 1 ? ' year' : ' years') + ` (${p.year})`)}
        {row('Completed UrbanRide trips', p.completedTrips)}
        {row('Average rating', p.averageRating ? <><span style={{ color: '#f59e0b' }}>★</span> {Number(p.averageRating).toFixed(1)} <span className="mu">({p.ratingCount} rating{p.ratingCount === 1 ? '' : 's'})</span></> : 'No ratings yet')}
        {row('Maintenance status', <Tag c={p.maintenance === 'active' ? '' : p.maintenance === 'due' ? 'w' : 'r'}>{p.maintenance[0].toUpperCase() + p.maintenance.slice(1)}</Tag>)}
        {row('Verification', <Tag c={p.verification === 'Valid' ? '' : p.verification === 'Pending' ? 'w' : 'r'}>{p.verification}</Tag>)}
      </div>
      {p.verifiedUntil && <p className="mu" style={{ margin: '10px 0 0', fontSize: 12 }}>Verification valid until {new Date(p.verifiedUntil).toLocaleDateString()}.</p>}
    </div>
  );
}
export function PassportModal({ uid, onClose }) {
  const [data, setData] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/passport/' + uid).then(setData).catch(e => setErr(e.message)); }, [uid]);
  return (
    <div className="ur-dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 'min(560px, 94vw)', maxHeight: '90vh', overflow: 'auto' }}>
        {err ? <div className="card"><p className="mu">{err}</p></div> : !data ? <div className="card"><p className="mu">Loading Vehicle Passport…</p></div> : <>
          <PassportCard data={data} />
          <div className="card"><h3 style={{ marginTop: 0 }}>Ride Reliability Score</h3><ReliabilityBreakdown rel={data.reliability} /></div>
        </>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn g" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
export const PassportLink = ({ uid, children = 'Vehicle Passport' }) => {
  const [open, setOpen] = useState(false);
  if (!uid) return null;
  return <><button className="btn g s" onClick={e => { e.stopPropagation(); setOpen(true); }}>{children}</button>{open && <PassportModal uid={uid} onClose={() => setOpen(false)} />}</>;
};

/* ---------- Journey DNA ---------- */
export function DnaCard({ dna, compact }) {
  if (!dna) return null;
  return (
    <div className="card" style={compact ? { margin: '10px 0 0', padding: 14 } : {}}>
      <div className="row sp" style={{ marginBottom: 10 }}>
        <div className="row"><Ic n="dna" z={20} /><h3 style={{ margin: 0 }}>Journey DNA</h3></div>
        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{dna.id}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 8 }}>
        {dna.genes.map(g => (
          <div key={g.key} style={{ background: 'var(--s2, #1a1e2b)', border: '1px solid var(--bd)', borderRadius: 10, padding: '8px 10px' }}>
            <div className="row sp" style={{ gap: 4 }}><span className="mu" style={{ fontSize: 11 }}>{g.label}</span><b style={{ fontFamily: 'monospace', fontSize: 11 }}>{g.code}{g.level}</b></div>
            <b style={{ fontSize: 14 }}>{g.display}</b>
            <div className="bar" style={{ marginTop: 5, height: 4 }}><i style={{ width: (g.level / 9 * 100) + '%' }} /></div>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>{dna.traits.map(t => <Tag key={t} c="p">{t}</Tag>)}<span className="mu" style={{ fontFamily: 'monospace', fontSize: 11 }}>{dna.signature}</span></div>
    </div>
  );
}
export function DnaLoader({ body }) {
  const [dna, setDna] = useState(null), [err, setErr] = useState('');
  const k = JSON.stringify(body);
  useEffect(() => { setDna(null); setErr(''); api('/dna', { method: 'POST', body }).then(setDna).catch(e => setErr(e.message)); }, [k]); // eslint-disable-line
  return err ? <p className="mu">{err}</p> : dna ? <DnaCard dna={dna} compact /> : <p className="mu">Reading journey DNA…</p>;
}

/* ---------- Share live tracking (passengers only) ---------- */
const digitsOf = ph => { let d = String(ph || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '0') d = d.slice(1); return d.length === 10 ? '91' + d : d; };
export function SharePanel({ rideId, bookingId }) {
  const { toast, me } = useApp();
  const [list, setList] = useState([]), [name, setName] = useState(''), [phone, setPhone] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api('/shares').then(l => setList(l.filter(s => s.rideId === String(rideId)).slice(0, 10))).catch(() => {});
  useEffect(() => { load(); }, [rideId]); // eslint-disable-line
  const link = t => location.origin + '/track/' + t;
  const message = t => `${me.name} shared a live UrbanRide trip with you. Follow it here: ${link(t)}`;

  /* Creates (or reuses) a link for this person, then opens WhatsApp / SMS straight to their number. */
  const sendTo = async (cName, cPhone, channel) => {
    if (busy) return;
    const num = digitsOf(cPhone);
    if (!num) return toast('Add a phone number for this contact first.');
    // open the target window right now (inside the click) so the browser does not block it
    const win = channel === 'wa' ? window.open('about:blank', '_blank') : null;
    setBusy(true);
    try {
      let share = list.find(s => digitsOf(s.contactPhone) === num);
      if (!share) share = await api('/shares', { method: 'POST', body: { rideId: String(rideId), bookingId: bookingId || '', contactName: cName, contactPhone: cPhone } });
      const url = channel === 'wa' ? `https://wa.me/${num}?text=${encodeURIComponent(message(share.token))}` : `sms:+${num}?&body=${encodeURIComponent(message(share.token))}`;
      if (channel === 'wa') { if (win) win.location.href = url; else window.location.href = url; } else window.location.href = url;
      toast(`Opening ${channel === 'wa' ? 'WhatsApp' : 'messages'} for ${cName || 'your contact'}…`); load();
    } catch (e) { if (win) win.close(); toast(e.message); } finally { setBusy(false); }
  };
  const copyOnly = async () => {
    try {
      const s = await api('/shares', { method: 'POST', body: { rideId: String(rideId), bookingId: bookingId || '', contactName: name.trim(), contactPhone: phone.trim() } });
      try { await navigator.clipboard.writeText(link(s.token)); toast('Tracking link copied.'); } catch (e) { toast(link(s.token)); }
      load();
    } catch (e) { toast(e.message); }
  };
  const revoke = async id => { try { await api('/shares/' + id, { method: 'DELETE' }); toast('Link stopped. They can no longer see this trip.'); load(); } catch (e) { toast(e.message); } };
  const contacts = me?.trustedContacts || [];
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 6 }}><Ic n="share" z={18} /><h3 style={{ margin: 0 }}>Share live tracking</h3></div>
      <p className="mu" style={{ marginTop: 0 }}>The link opens a read-only live view. It shows “Ride completed” and stops updating when your trip ends, and you can stop it any time.</p>
      {contacts.map(c => (
        <div key={c.phone} className="row sp" style={{ padding: '8px 0', borderTop: '1px solid var(--bd)' }}>
          <div><b>{c.name}</b><br /><span className="mu" style={{ fontSize: 12 }}>{c.phone}</span></div>
          <div className="row"><button className="btn s" disabled={busy} onClick={() => sendTo(c.name, c.phone, 'wa')}>WhatsApp</button><button className="btn g s" disabled={busy} onClick={() => sendTo(c.name, c.phone, 'sms')}>SMS</button></div>
        </div>
      ))}
      <div style={{ borderTop: contacts.length ? '1px solid var(--bd)' : 'none', paddingTop: contacts.length ? 10 : 0, marginTop: 4 }}>
        <span className="mu" style={{ fontSize: 12 }}>{contacts.length ? 'Someone else?' : 'Who should get the link?'}</span>
        <div className="row" style={{ flexWrap: 'nowrap', marginTop: 6 }}><input placeholder="Name" maxLength={60} value={name} onChange={e => setName(e.target.value)} /><input placeholder="Phone number" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} /></div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn s" disabled={busy} onClick={() => sendTo(name.trim(), phone.trim(), 'wa')}>Send on WhatsApp</button><button className="btn g s" onClick={copyOnly}>Just copy link</button></div>
      </div>
      {list.map(s => (
        <div key={s.id} className="row sp" style={{ padding: '10px 0', borderTop: '1px solid var(--bd)', marginTop: 10 }}>
          <div><b>{s.contactName || 'Shared link'}</b><br /><span className="mu" style={{ fontSize: 12 }}>{s.views} view{s.views === 1 ? '' : 's'}{s.lastViewedAt ? ' · last ' + new Date(s.lastViewedAt).toLocaleTimeString() : ''}</span></div>
          <div className="row">{s.contactPhone && <button className="btn g s" disabled={busy} onClick={() => sendTo(s.contactName, s.contactPhone, 'wa')}>Resend</button>}<button className="btn d s" onClick={() => revoke(s.id)}>Stop</button></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Alternative journeys for a disrupted / cancelled booking ---------- */
export function AlternativesPanel({ booking }) {
  const { book, toast, syncData, refreshMe, go } = useApp();
  const [alt, setAlt] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/alternatives/' + booking.id).then(setAlt).catch(e => setErr(e.message)); }, [booking.id, booking.st]);
  if (err) return <p className="mu">{err}</p>;
  if (!alt) return <p className="mu">Looking for alternatives…</p>;
  const bookJourney = async plan => {
    try { await api('/journeys', { method: 'POST', body: { seats: booking.seats, legs: plan.legs.map(l => ({ rid: l.ride.id, f: l.f, t: l.t, waitMinutes: l.waitMinutes })) } }); toast('Multi-vehicle journey requested.'); await Promise.all([syncData(), refreshMe()]); go('bookings'); }
    catch (e) { toast(e.message); }
  };
  const empty = !alt.rides.length && !alt.transfers.length && !alt.reroute;
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
      <div className="mu" style={{ marginBottom: 6 }}><b>Alternative journeys</b></div>
      {alt.reroute && <div className="row sp" style={{ marginBottom: 8 }}><span><Ic n="route" z={15} /> Driver detour: {alt.reroute.path.map(nm).join(' → ')}</span><Tag c="w">+{alt.reroute.extraKm} km</Tag></div>}
      {alt.rides.map(m => (
        <div key={m.ride.id} className="row sp" style={{ marginTop: 6 }}>
          <span><Veh t={m.ride.vtype} z={17} /> {m.ride.drv} · {m.ride.time} · ₹{m.fare + m.fee} · {m.score}% match</span>
          <button className="btn s" onClick={() => book(m.ride.id, m.pick, m.drop, m.fare, booking.seats, m.fee)}>Book</button>
        </div>
      ))}
      {alt.transfers.map((p, i) => (
        <div key={i} className="card" style={{ margin: '8px 0 0', padding: 12 }}>
          <div className="row sp"><b>Transfer at {p.hubName}</b><span><Tag c="p">{p.wait} min wait</Tag> <b>₹{p.total}</b></span></div>
          {p.legs.map((l, j) => <div key={j} className="mu">{j + 1}. <Veh t={l.ride.vtype} z={17} /> {l.ride.drv}: {nm(l.f)} → {nm(l.t)} ({l.ride.time})</div>)}
          <div className="row" style={{ marginTop: 8 }}><button className="btn s" onClick={() => bookJourney(p)}>Book this journey</button></div>
        </div>
      ))}
      {empty && <div className="mu">No alternatives yet — we'll notify you as soon as one appears.</div>}
    </div>
  );
}
