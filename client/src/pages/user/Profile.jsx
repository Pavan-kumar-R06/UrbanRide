import { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Stat } from '../../components/ui';
import { Ic, Veh } from '../../components/Icons';
import VehicleForm from '../../components/VehicleForm';
import { PassportCard, ReliabilityBreakdown } from '../../components/features';
import { api } from '../../lib/api';
import { Stars } from '../../components/ui';

export default function Profile() {
  const { me, setMe, rides, bookings, logout, addVehicle, toast } = useApp();
  const [pass, setPass] = useState(null), [rel, setRel] = useState(null);
  const [contacts, setContacts] = useState(me.trustedContacts || []), [cn, setCn] = useState(''), [cp, setCp] = useState('');
  const hasCar = !!(me.car && me.car.m);
  useEffect(() => {
    api('/reliability/' + me.id).then(setRel).catch(() => {});
    if (hasCar) api('/passport/' + me.id).then(setPass).catch(() => {}); else setPass(null);
  }, [me.id, hasCar, me.car?.st, rides.length, bookings.length]);
  const confirmed = bookings.filter(b => String(b.pid) === String(me.id) && b.st === 'confirmed').length;
  const offered = rides.filter(r => String(r.own) === String(me.id)).length;
  const completed = rides.filter(r => String(r.own) === String(me.id) && r.status === 'completed').length;
  const memberSince = me.createdAt ? new Date(me.createdAt).toLocaleDateString() : 'Active member';
  const vs = me.car?.st || 'not-registered';
  const saveContacts = async list => { try { const u = await api('/users/' + me.id, { method: 'PUT', body: { trustedContacts: list } }); setContacts(u.trustedContacts); setMe(m => ({ ...m, trustedContacts: u.trustedContacts })); toast('Trusted contacts saved.'); } catch (e) { toast(e.message); } };
  const addContact = () => { if (!cn.trim() || !cp.trim()) return toast('Enter a name and phone number.'); saveContacts([...contacts, { name: cn.trim(), phone: cp.trim() }]); setCn(''); setCp(''); };
  return (
    <>
      <Hd t="Your profile" s="Account details, ride activity, and vehicle status." />
      <div className="profile-hero"><div className="profile-identity"><div className="profile-avatar"><span className="av" style={{ background: '#ffffff', color: '#090a0f' }}>{me.name[0]}</span></div><div><span className="profile-eyebrow">{me.role === 'admin' ? 'Platform administrator' : 'URBANRIDE MEMBER'}</span><h2>{me.name}</h2><p>{me.email}</p></div></div><button className="btn g" onClick={logout}>Log out</button></div>
      <div className="grid profile-stats"><Stat i="ticket" v={confirmed} l="Confirmed bookings" c="blue" /><Stat i="car" v={offered} l="Rides offered" c="green" /><Stat i="check" v={completed} l="Completed rides" c="amber" /></div>
      <div className="profile-sections">
        <section className="profile-section"><div className="profile-section-heading"><div><span className="profile-eyebrow">ACCOUNT</span><h3>Personal details</h3></div><span className="tag">{me.role}</span></div>
          <div className="profile-details">
            <div className="profile-detail"><span>Name</span><b>{me.name}</b></div><div className="profile-detail"><span>Email</span><b>{me.email}</b></div>
            <div className="profile-detail"><span>Member since</span><b>{memberSince}</b></div><div className="profile-detail"><span>Driver rating</span><b><Stars n={me.rating} /></b></div>
          </div></section>
        <section className="profile-section"><div className="profile-section-heading"><div><span className="profile-eyebrow">VEHICLE</span><h3>Vehicle verification</h3></div><Tag c={vs === 'approved' ? '' : vs === 'rejected' ? 'r' : 'w'}>{vs}</Tag></div>
          {hasCar ? <div className="profile-vehicle"><span className="profile-vehicle-icon"><Ic n="car" z={24} /></span><div><b>{me.car.m}</b><p className="mu">{vs !== 'approved' ? (vs === 'rejected' ? 'Vehicle needs an update' : 'Waiting for admin review') : me.car.maintenance === 'due' ? 'Service due: pay the service fee in Offer a ride to continue' : me.car.maintenance === 'inactive' ? 'Inactive: request reactivation in Offer a ride' : 'Verified for ride publishing'}</p></div>{vs === 'approved' && <Tag c={me.car.maintenance === 'due' ? 'w' : me.car.maintenance === 'inactive' ? 'r' : ''}>{{ due: 'Service due', inactive: 'Inactive' }[me.car.maintenance] || 'Active'}</Tag>}</div>
            : <><p className="mu">Register a car, bike or scooter to offer rides.</p><VehicleForm onSubmit={addVehicle} label="Add vehicle" /></>}
        </section>
      </div>
      <div className="two" style={{ marginTop: 18 }}>
        <div className="card"><div className="row" style={{ marginBottom: 10 }}><Ic n="shield" z={18} /><h3 style={{ margin: 0 }}>Ride Reliability Score</h3></div><ReliabilityBreakdown rel={rel} /></div>
        <div>
          {pass ? <PassportCard data={pass} /> : <div className="card"><div className="row" style={{ marginBottom: 6 }}><Ic n="badge" z={18} /><h3 style={{ margin: 0 }}>UR Vehicle Passport</h3></div><p className="mu" style={{ margin: 0 }}>Register a vehicle and your digital Vehicle Passport appears here.</p></div>}
          <div className="card"><div className="row" style={{ marginBottom: 6 }}><Ic n="share" z={18} /><h3 style={{ margin: 0 }}>Trusted contacts</h3></div>
            <p className="mu" style={{ marginTop: 0 }}>People you can share live trip tracking with in one tap.</p>
            {contacts.map((c, i) => <div key={i} className="row sp" style={{ padding: '6px 0' }}><span><b>{c.name}</b> · {c.phone}</span><button className="btn g s" onClick={() => saveContacts(contacts.filter((_, j) => j !== i))}>Remove</button></div>)}
            {contacts.length < 5 && <div className="row" style={{ flexWrap: 'nowrap', marginTop: 8 }}><input placeholder="Name" value={cn} maxLength={60} onChange={e => setCn(e.target.value)} /><input placeholder="Phone" value={cp} maxLength={20} onChange={e => setCp(e.target.value)} /><button className="btn" onClick={addContact}>Add</button></div>}
          </div>
        </div>
      </div>
    </>
  );
}
