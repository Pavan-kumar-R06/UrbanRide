import { useApp } from '../../state/AppContext';
import { Hd, Tag, Av, Stat, Empty } from '../../components/ui';
import { PF, P, rn } from '../../lib/cityGraph';
import { Veh } from '../../components/Icons';

export default function Drive() {
  const { me, rides, bookings, go, step, cancelRide, deleteMyRide, canDeleteRide, decide, openChatThread } = useApp();
  const rank = { boarding: 0, active: 0, scheduled: 1 };
  const allMine = rides.filter(r => String(r.own) === String(me.id)).sort((a, b) => (rank[a.status] ?? 2) - (rank[b.status] ?? 2) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), mine = allMine.slice(0, 10);
  if (!me.car || !me.car.m) return <><Hd t="Driver hub" s="Manage your published rides and passenger requests." /><Empty i="car" t="Add a vehicle to start offering rides."><button className="btn" onClick={() => go('offer')}>Add vehicle</button></Empty></>;
  const bs = bookings.filter(b => allMine.some(r => r.id == b.rid));
  const earn = bs.filter(b => b.st == 'confirmed' && rides.find(r => r.id == b.rid).status == 'completed').reduce((a, b) => a + b.fare, 0);
  return (
    <>
      <Hd t="Driver hub" s={'Your rides, passenger requests and earnings.' + (allMine.length > 10 ? ' Showing your 10 latest of ' + allMine.length + ' rides.' : '')} />
      <div className="grid">
        <Stat i="car" v={allMine.length} l="Rides published" c="blue" />
        <Stat i="mail" v={bs.filter(b => b.st == 'pending').length} l="Pending requests" c="amber" />
        <Stat i="users" v={bs.filter(b => b.st == 'confirmed').length} l="Confirmed passengers" c="green" />
        <Stat i="rupee" v={'₹' + earn} l="Total earned" c="purple" />
      </div>
      {mine.length ? mine.map(r => {
        const rs = bookings.filter(b => b.rid == r.id).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 10), nx = { scheduled: 'Start boarding', boarding: 'Start ride', active: 'Complete ride' }[r.status];
        return (
          <div className="card" key={r.id}>
            <div className="row sp">
              <div><h3><Veh t={r.vtype} z={17} /> {rn(r.path)}</h3><span className="mu">{r.date} · {r.time} · {r.cap - r.seats}/{r.cap} seats filled · ₹{r.rate}/km</span></div>
              <div className="row">
                <Tag c={r.status == 'cancelled' ? 'r' : 'b'}>{r.status}</Tag>
                {nx && <button className="btn s" onClick={() => step(r.id)}>{nx}</button>}
                {r.status == 'scheduled' && <button className="btn d s" onClick={() => cancelRide(r.id)}>Cancel</button>}
                {canDeleteRide(r) && <button className="btn g s" onClick={() => deleteMyRide(r.id)}>Delete</button>}
                {['boarding', 'active'].includes(r.status) && <button className="btn g s" onClick={() => go('live')}>Live map</button>}
              </div>
            </div>
            <div className="row" style={{ margin: '10px 0' }}>
              <div className="bar"><i style={{ width: (r.cap - r.seats) / r.cap * 100 + '%' }} /></div>
              <span className="mu">{r.networkId ? 'Network only · ' : ''}{r.pf.map(k => PF[k]).join(' · ')}</span>
            </div>
            {rs.length ? rs.map(b => (
              <div key={b.id} className="row sp" style={{ padding: '10px 0', borderTop: '1px solid var(--bd)' }}>
                <div className="row"><Av name={b.pn} /><div><b>{b.pn}</b>{b.journeyId && <> <Tag c="p">journey leg {b.legIndex + 1}</Tag></>}<br /><span className="mu">{P[b.f][0]} → {P[b.t][0]} · {b.seats} seat(s) · ₹{b.fare}</span></div></div>
                <div className="row">
                  {b.tripCompletedAt ? <Tag>arrived</Tag> : <Tag c={b.st == 'pending' || b.st === 'waitlisted' ? 'w' : b.st == 'confirmed' ? '' : 'r'}>{b.st}</Tag>}
                  {b.st == 'waitlisted' && <Tag c="w">waiting for a seat</Tag>}
                  {b.st == 'pending' && <><button className="btn s" onClick={() => decide(b.id, 1)}>Accept</button><button className="btn g s" onClick={() => decide(b.id, 0)}>Reject</button></>}
                  <button className="btn g s" onClick={() => openChatThread(r.id)}>Message</button>
                </div>
              </div>
            )) : <p className="mu" style={{ margin: 0 }}>No requests yet.</p>}
          </div>
        );
      }) : <Empty i="compass" t="You have not published any ride yet."><button className="btn" onClick={() => go('offer')}>Offer a ride</button></Empty>}
    </>
  );
}
