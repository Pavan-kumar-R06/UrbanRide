import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Av, Table, Empty } from '../../components/ui';
import { Veh } from '../../components/Icons';

export default function Users() {
  const { users, incidents, blk, deleteAdminUser } = useApp();
  const [aq, setAq] = useState('');
  const q = aq.toLowerCase();
  const l = users.filter(u => u.role == 'user' && ((u.name || '') + (u.email || '')).toLowerCase().includes(q)).slice(0, 10);
  return (
    <>
      <Hd t="Users" s="Search and review registered accounts (10 most recent shown; use search to find others)." />
      <div className="card"><input id="sq" placeholder="Search by name or email" value={aq} onChange={e => setAq(e.target.value)} /></div>
      {l.length ? <Table head={['User Name', 'Email', 'Vehicle Details', 'Account Status', 'Action']} rows={l.map(u => {
        const ec = incidents.filter(i => String(i.uid) === String(u.id)).length, name = u.name || (u.email ? u.email.split('@')[0] : 'User');
        return [
          <div className="row" style={{ gap: 8 }}><Av name={name} /><div><b>{name}</b><br /><span className="mu" style={{ fontSize: 11 }}>ID: {String(u.id).slice(-6)}</span></div></div>,
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.email}</span>,
          u.car ? <><b><Veh t={u.car.type} z={17} /> {u.car.m}</b> <span style={{ fontSize: 11 }} className="mu">(<Tag c={u.car.st === 'approved' ? '' : 'w'}>{u.car.st || 'pending'}</Tag>)</span></> : <span className="mu">No vehicle</span>,
          <>{u.blocked ? <Tag c="r">blocked</Tag> : <Tag>active</Tag>}{ec ? <><br /><span className="mu">{ec} emergency report(s)</span></> : null}</>,
          <div className="row"><button className="btn g s" onClick={() => blk(u.id)}>{u.blocked ? 'Unblock' : 'Block'}</button><button className="btn d s" onClick={() => deleteAdminUser(u.id)}>Delete</button></div>
        ];
      })} /> : <Empty i="users" t="No users found." />}
    </>
  );
}
