import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Empty } from '../../components/ui';
import { api } from '../../lib/api';
import { Ic } from '../../components/Icons';

export default function Nets() {
  const { networks, syncAdmin, toast, confirmDialog } = useApp();
  const [f, setF] = useState({ name: '', kind: 'college', domain: '', inviteCode: '', description: '' }), [open, setOpen] = useState(null);
  const create = async () => { try { await api('/networks', { method: 'POST', body: f }); toast('Network created.'); setF({ name: '', kind: 'college', domain: '', inviteCode: '', description: '' }); syncAdmin(); } catch (e) { toast(e.message); } };
  const decide = async (n, uid, status) => { try { await api(`/networks/${n.id}/members/${uid}`, { method: 'PUT', body: { status } }); toast('Member ' + status + '.'); syncAdmin(); } catch (e) { toast(e.message); } };
  const toggle = async n => { try { await api('/networks/' + n.id, { method: 'PUT', body: { active: !n.active } }); syncAdmin(); } catch (e) { toast(e.message); } };
  const del = async n => { if (!await confirmDialog('Delete this network?', <><b>{n.name}</b><br />Members lose access; its private rides become public rides.</>)) return; try { await api('/networks/' + n.id, { method: 'DELETE' }); toast('Network deleted.'); syncAdmin(); } catch (e) { toast(e.message); } };
  return (
    <>
      <Hd t="Campus & company networks" s="Create private mobility communities. Every join request waits for your approval." />
      <div className="card"><h3>New network</h3>
        <div className="fg">
          <div><label>Name</label><input placeholder="UVCE Students" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div><label>Type</label><select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}><option value="college">College</option><option value="company">Company</option></select></div>
          <div><label>Verified e-mail domain</label><input placeholder="uvce.ac.in" value={f.domain} onChange={e => setF({ ...f, domain: e.target.value })} /></div>
          <div><label>Invite code (generated if empty)</label><input placeholder="UVCE2026" value={f.inviteCode} onChange={e => setF({ ...f, inviteCode: e.target.value })} /></div>
        </div>
        <label style={{ marginTop: 12 }}>Description</label><input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Carpooling for UVCE students & staff" />
        <div style={{ marginTop: 12 }}><button className="btn" onClick={create}>Create network</button></div>
      </div>
      {networks.length ? networks.slice(0, 10).map(n => (
        <div className="card" key={n.id}>
          <div className="row sp">
            <div><h3 style={{ margin: 0 }}><Ic n={n.kind === 'college' ? 'users' : 'building'} z={18} /> {n.name} {!n.active && <Tag c="r">disabled</Tag>}</h3><span className="mu">{n.verifiedCount} verified · <b style={{ color: n.pendingCount ? '#f59e0b' : 'inherit' }}>{n.pendingCount} awaiting your approval</b> · domain {n.domain ? '@' + n.domain : '—'} · invite code <b style={{ color: 'var(--tx)', fontFamily: 'monospace' }}>{n.inviteCode}</b></span></div>
            <div className="row"><button className="btn g s" onClick={() => setOpen(open === n.id ? null : n.id)}>{open === n.id ? 'Hide' : 'Members'} ({n.members.length})</button><button className="btn g s" onClick={() => toggle(n)}>{n.active ? 'Disable' : 'Enable'}</button><button className="btn d s" onClick={() => del(n)}>Delete</button></div>
          </div>
          {open === n.id && (n.members.length ? [...n.members].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0)).slice(0, 10).map(m => (
            <div key={m.uid} className="row sp" style={{ padding: '10px 0', borderTop: '1px solid var(--bd)' }}>
              <div><b>{m.name}</b> <Tag c={m.status === 'verified' ? '' : m.status === 'pending' ? 'w' : 'r'}>{m.status}</Tag> <br /><Tag c={m.domainMatch ? '' : 'w'}>{m.domainMatch ? '✓ e-mail domain matches' : '✗ e-mail domain differs'}</Tag> <Tag c={m.codeValid ? '' : 'w'}>{m.codeValid ? '✓ invite code correct' : 'no invite code'}</Tag><br /><span className="mu" style={{ fontSize: 12 }}>{m.orgEmail} · ID {m.idNumber}</span></div>
              <div className="row">{m.status !== 'verified' && <button className="btn s" onClick={() => decide(n, m.uid, 'verified')}>Verify</button>}{m.status !== 'rejected' && <button className="btn g s" onClick={() => decide(n, m.uid, 'rejected')}>{m.status === 'verified' ? 'Revoke' : 'Reject'}</button>}</div>
            </div>)) : <p className="mu" style={{ marginBottom: 0, marginTop: 10 }}>No members yet.</p>)}
        </div>
      )) : <Empty i="building" t="No networks yet. Create one above." />}
    </>
  );
}
