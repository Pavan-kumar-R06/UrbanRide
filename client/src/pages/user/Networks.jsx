import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Empty } from '../../components/ui';
import { api } from '../../lib/api';
import { Ic } from '../../components/Icons';

export default function Networks() {
  const { networks, syncNetworks, toast, me, go } = useApp();
  const [form, setForm] = useState({}), [openId, setOpenId] = useState(null);
  const set = (id, k, v) => setForm(f => ({ ...f, [id]: { ...(f[id] || {}), [k]: v } }));
  const join = async n => {
    const f = form[n.id] || {};
    try { const r = await api('/networks/' + n.id + '/join', { method: 'POST', body: { orgEmail: f.orgEmail || '', idNumber: f.idNumber || '', inviteCode: f.inviteCode || '' } }); toast('Request sent. An admin will review and verify your membership.'); setOpenId(null); syncNetworks(); }
    catch (e) { toast(e.message); }
  };
  const leave = async n => { try { await api('/networks/' + n.id + '/leave', { method: 'POST', body: {} }); toast('You left ' + n.name + '.'); syncNetworks(); } catch (e) { toast(e.message); } };
  const verified = networks.filter(n => n.myStatus === 'verified');
  return (
    <>
      <Hd t="Campus & company networks" s="Private mobility communities. Only verified members can see and book each other's rides." />
      {verified.length > 0 && <div className="card" style={{ borderColor: '#10b981' }}><b>Your verified networks:</b> {verified.map(n => n.name).join(', ')} <div className="row" style={{ marginTop: 10 }}><button className="btn s" onClick={() => go('offer')}>Publish a members-only ride</button><button className="btn g s" onClick={() => go('find')}>Find rides</button></div></div>}
      {networks.length ? networks.slice(0, 10).map(n => {
        const f = form[n.id] || {}, isOpen = openId === n.id;
        return (
          <div className="card" key={n.id}>
            <div className="row sp">
              <div className="row"><span className="profile-vehicle-icon"><Ic n={n.kind === 'college' ? 'users' : 'building'} z={22} /></span><div><h3 style={{ margin: 0 }}>{n.name}</h3><span className="mu">{n.kind === 'college' ? 'College' : 'Company'} · {n.verifiedCount} verified member(s){n.domain ? ' · @' + n.domain : ''}</span></div></div>
              <div className="row">
                {n.myStatus === 'verified' && <><Tag>✓ verified member</Tag><button className="btn g s" onClick={() => leave(n)}>Leave</button></>}
                {n.myStatus === 'pending' && <Tag c="w">verification pending</Tag>}
                {n.myStatus === 'rejected' && <Tag c="r">declined</Tag>}
                {(!n.myStatus || n.myStatus === 'rejected') && <button className="btn s" onClick={() => setOpenId(isOpen ? null : n.id)}>{isOpen ? 'Close' : 'Join'}</button>}
              </div>
            </div>
            {n.description && <p className="mu" style={{ marginBottom: 0 }}>{n.description}</p>}
            {isOpen && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
                <p className="mu" style={{ marginTop: 0 }}>Every request is checked by an admin before you can see or book private rides. Using your <b style={{ color: 'var(--tx)' }}>{n.domain ? '@' + n.domain : 'organisation'}</b> e-mail and the invite code helps them approve you faster.</p>
                <div className="fg">
                  <div><label>Organisation e-mail</label><input type="email" placeholder={n.domain ? 'you@' + n.domain : 'you@company.com'} value={f.orgEmail || ''} onChange={e => set(n.id, 'orgEmail', e.target.value)} /></div>
                  <div><label>{n.kind === 'college' ? 'Student / staff ID (USN)' : 'Employee ID'}</label><input value={f.idNumber || ''} onChange={e => set(n.id, 'idNumber', e.target.value)} /></div>
                  <div><label>Invite code (optional)</label><input value={f.inviteCode || ''} onChange={e => set(n.id, 'inviteCode', e.target.value)} /></div>
                </div>
                <div style={{ marginTop: 12 }}><button className="btn" onClick={() => join(n)}>Send request to admin</button></div>
              </div>
            )}
          </div>
        );
      }) : <Empty i="building" t="No networks have been created yet. An admin can set up a college or company network." />}
    </>
  );
}
