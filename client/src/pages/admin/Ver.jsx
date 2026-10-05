import { useApp } from '../../state/AppContext';
import { Hd, Tag, Empty } from '../../components/ui';
import { Veh } from '../../components/Icons';
import { vLabel, serviceFeeFor } from '../../lib/cityGraph';

const STATES = {
  active: ['Active', 'No charges. The driver can publish rides.'],
  due: ['Service due', 'Publishing paused. The driver pays the service fee from their wallet, gets serviced, and continues.'],
  inactive: ['Inactive', 'Publishing paused. The driver must request reactivation and you approve it.']
};

export default function Ver() {
  const { users, vset } = useApp();
  const list = users.filter(u => u.car && u.car.m).slice(0, 10);
  return (
    <>
      <Hd t="Vehicle verification" s="Approve vehicles and manage their maintenance status (latest 10)." />
      {list.length ? list.map(u => {
        const v = u.car, m = v.maintenance || 'active';
        return (
          <div key={u.id} className="card" style={{ marginBottom: 12 }}>
            <div className="row sp">
              <div>
                <h3 style={{ margin: '0 0 4px 0' }}><Veh t={v.type} z={18} /> {v.m}</h3>
                <span className="mu">Owner: <b style={{ color: 'var(--tx)', fontWeight: 700 }}>{u.name || 'Registered User'}</b> · {vLabel(v.type)}{v.reg ? ' · ' + v.reg : ''}{v.year ? ' · ' + v.year : ''} · Status: <Tag c={v.st === 'pending' ? 'w' : v.st === 'rejected' ? 'r' : ''}>{v.st}</Tag></span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {v.st === 'pending' ? <><button className="btn s" onClick={() => vset(u.id, 'approved')} style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}>✓ Approve</button><button className="btn g s" onClick={() => vset(u.id, 'rejected')} style={{ color: '#ef4444' }}>✕ Reject</button></>
                  : <span className="mu" style={{ fontWeight: 700, fontSize: 12 }}>{v.st.toUpperCase()}</span>}
              </div>
            </div>
            {v.st === 'approved' && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
                <div className="row sp">
                  <div className="row"><span className="mu">Maintenance status:</span>
                    <select style={{ width: 'auto' }} value={m} onChange={e => vset(u.id, 'approved', { maintenance: e.target.value })}>{Object.entries(STATES).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
                    <Tag c={m === 'active' ? '' : m === 'due' ? 'w' : 'r'}>{STATES[m][0]}</Tag>
                    {m !== 'active' && <Tag c="r">cannot publish rides</Tag>}
                    {v.verifiedUntil && <span className="mu">Verification valid until {new Date(v.verifiedUntil).toLocaleDateString()}</span>}
                  </div>
                  {m === 'inactive' && <div className="row">{v.reactivationRequested && <Tag c="w">Reactivation requested</Tag>}<button className="btn s" onClick={() => vset(u.id, 'approved', { maintenance: 'active' })}>Reactivate vehicle</button></div>}
                  {m === 'due' && <div className="row"><Tag c="w">Waiting for ₹{serviceFeeFor(v.type)} service payment</Tag><button className="btn g s" onClick={() => vset(u.id, 'approved', { maintenance: 'active' })}>Mark serviced</button></div>}
                </div>
                <p className="mu" style={{ margin: '8px 0 0', fontSize: 12 }}>{STATES[m][1]}{v.lastServiceAt ? ' Last service: ' + new Date(v.lastServiceAt).toLocaleDateString() + '.' : ''}</p>
              </div>
            )}
          </div>
        );
      }) : <Empty i="check" t="No vehicle verification requests pending." />}
    </>
  );
}
