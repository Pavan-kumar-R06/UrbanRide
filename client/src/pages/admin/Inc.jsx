import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Empty } from '../../components/ui';
import { rn } from '../../lib/cityGraph';
import { ago } from '../../lib/format';

const TITLES = { unsafe: 'Personal safety', vehicle: 'Vehicle issue', medical: 'Medical emergency', collision: 'Collision' };
function Item({ i }) {
  const { incidents, rides, resolveIncident, deleteAdminUser, deleteAdminRide } = useApp();
  const [res, setRes] = useState(''), [note, setNote] = useState('');
  const repeat = incidents.filter(x => String(x.uid) === String(i.uid)).length, ride = rides.find(r => String(r.id) === String(i.rideId));
  const label = ride ? rn(ride.path) : i.rideRoute || 'No linked ride';
  return (
    <div className="card">
      <div className="row sp"><div><h3>{TITLES[i.type] || 'Other emergency'}</h3><span className="mu">Reported by {i.by} · {ago(new Date(i.createdAt || Date.now()).getTime())} · {repeat} report(s) from this user</span></div><Tag c={i.status === 'open' ? 'r' : ''}>{i.status}</Tag></div>
      <p>{i.details}</p><p className="mu">Location: {i.location || 'Not provided'} · Ride: {label}</p>
      {i.status === 'resolved' ? <div className="tag">Resolution: {i.resolution}{i.resolutionNote ? ' · ' + i.resolutionNote : ''}</div> : <>
        <div className="fg">
          <div><label>Resolution</label><select value={res} onChange={e => setRes(e.target.value)}><option value="">Choose outcome</option><option value="emergency-services-contacted">Emergency services contacted</option><option value="roadside-assistance-dispatched">Roadside assistance dispatched</option><option value="user-safe">User confirmed safe</option><option value="false-alarm">False alarm</option><option value="other">Other</option></select></div>
          <div><label>Admin notes</label><input placeholder="Actions taken or follow-up needed" value={note} onChange={e => setNote(e.target.value)} /></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}><button className="btn s" onClick={() => resolveIncident(i._id, res, note.trim())}>Save resolution</button><button className="btn d s" onClick={() => deleteAdminUser(i.uid)}>Delete reported user</button>{i.rideId && <button className="btn d s" onClick={() => deleteAdminRide(i.rideId)}>Delete linked ride</button>}</div>
      </>}
    </div>
  );
}
export default function Inc() {
  const { incidents } = useApp();
  return <><Hd t="Emergency reports" s="Review the latest 10 reports, record the outcome, and take account or ride action when needed." />{incidents.slice(0, 10).map(i => <Item key={i._id} i={i} />)}{!incidents.length && <Empty i="check" t="No emergency reports yet." />}</>;
}
