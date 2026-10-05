import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Table } from '../../components/ui';
import { rn } from '../../lib/cityGraph';
import { Veh } from '../../components/Icons';

export default function Rides() {
  const { rides, cancelRide, deleteAdminRide } = useApp();
  const [f, setF] = useState('all');
  const l = rides.filter(r => f == 'all' || r.status == f).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 10);
  return (
    <>
      <Hd t="Rides" s="Review the 10 most recent trips. Delete a ride to remove its bookings and messages." />
      <div className="row" style={{ marginBottom: 14 }}>{['all', 'scheduled', 'boarding', 'active', 'completed', 'cancelled'].map(s => <button key={s} className={'chip ' + (f == s ? 'on' : '')} onClick={() => setF(s)}>{s} ({s == 'all' ? rides.length : rides.filter(r => r.status == s).length})</button>)}</div>
      <Table head={['Driver', 'Route', 'Date', 'Seats', 'Status', 'Actions']} rows={l.map(r => [<><Veh t={r.vtype} z={17} /> {r.drv}</>, <>{rn(r.path)}{r.networkId ? <> <Tag c="p">private</Tag></> : null}</>, r.date + ' ' + r.time, (r.cap - r.seats) + '/' + r.cap, <Tag c={r.status == 'cancelled' ? 'r' : 'b'}>{r.status}</Tag>,
        <div className="row">{r.status == 'scheduled' && <button className="btn g s" onClick={() => cancelRide(r.id)}>Cancel</button>}<button className="btn d s" onClick={() => deleteAdminRide(r.id)}>Delete</button></div>])} />
    </>
  );
}
