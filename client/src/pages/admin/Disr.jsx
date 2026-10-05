import { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Empty } from '../../components/ui';
import MapSvg from '../../components/Map';
import { api } from '../../lib/api';
import { E, P, edgeKey } from '../../lib/cityGraph';
import { ago } from '../../lib/format';

export default function Disr() {
  const { disruptions, syncAdmin, toast } = useApp();
  const [tr, setTr] = useState(null), [edge, setEdge] = useState(edgeKey(...E[3])), [kind, setKind] = useState('closure'), [reason, setReason] = useState(''), [th, setTh] = useState(0.8);
  const loadTraffic = () => api('/traffic').then(setTr).catch(() => {});
  useEffect(() => { loadTraffic(); const t = setInterval(loadTraffic, 30000); return () => clearInterval(t); }, []);
  const active = disruptions.filter(d => d.active).slice(0, 10), past = disruptions.filter(d => !d.active).slice(0, 10);
  const blocked = active.map(d => edgeKey(d.a, d.b));
  const create = async () => { const [a, b] = edge.split('-'); try { const d = await api('/disruptions', { method: 'POST', body: { a, b, kind, reason } }); toast(`Disruption created. ${d.impacted} booking(s) affected — passengers were sent alternatives.`); setReason(''); syncAdmin(); } catch (e) { toast(e.message); } };
  const resolve = async d => { try { await api(`/disruptions/${d.id}/resolve`, { method: 'PUT', body: {} }); toast('Road reopened.'); syncAdmin(); } catch (e) { toast(e.message); } };
  const scan = async () => { try { const r = await api('/traffic/scan', { method: 'POST', body: { threshold: th } }); toast(r.created ? `${r.created} congested segment(s) turned into disruptions.` : 'No segment is above the threshold right now.'); syncAdmin(); } catch (e) { toast(e.message); } };
  return (
    <>
      <Hd t="Route disruptions" s="Close a road or react to heavy traffic — affected passengers automatically get alternative rides, transfers and detours." />
      <div className="two">
        <div className="card"><div className="row sp" style={{ marginBottom: 8 }}><h3>Live traffic</h3>{tr && <Tag c={tr.live ? '' : 'w'}>{tr.live ? 'Live (TomTom)' : 'Simulated (set TOMTOM_API_KEY for live data)'}</Tag>}</div>
          <MapSvg traffic={tr ? tr.segments : null} blocked={blocked} fixed />
          <div className="row" style={{ marginTop: 8 }}><span className="tag">● Free</span><span className="tag w">● Slow</span><span className="tag r">● Heavy</span><span className="tag r">✕ Closed</span></div>
        </div>
        <div>
          <div className="card"><h3>Report a disruption</h3>
            <div className="fg">
              <div><label>Road segment</label><select value={edge} onChange={e => setEdge(e.target.value)}>{E.map(([a, b]) => <option key={a + b} value={edgeKey(a, b)}>{P[a][0]} ↔ {P[b][0]}</option>)}</select></div>
              <div><label>Type</label><select value={kind} onChange={e => setKind(e.target.value)}><option value="closure">Road closure</option><option value="accident">Accident</option><option value="weather">Waterlogging / weather</option><option value="traffic">Heavy traffic</option></select></div>
            </div>
            <label style={{ marginTop: 12 }}>Reason (shown to passengers)</label><input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="Waterlogging near the flyover" />
            <div style={{ marginTop: 12 }}><button className="btn d" onClick={create}>Close segment &amp; notify passengers</button></div>
          </div>
          <div className="card"><h3>Auto-detect congestion</h3><p className="mu" style={{ marginTop: 0 }}>Turn severely congested segments into disruptions so passengers are re-routed.</p>
            <div className="row" style={{ flexWrap: 'nowrap' }}><select value={th} onChange={e => setTh(+e.target.value)}><option value={0.6}>Moderate (60%+)</option><option value={0.8}>Severe (80%+)</option><option value={0.9}>Gridlock (90%+)</option></select><button className="btn" onClick={scan}>Scan now</button></div></div>
        </div>
      </div>
      <div className="card"><h3>Active disruptions</h3>
        {active.length ? active.map(d => <div key={d.id} className="row sp" style={{ padding: '10px 0', borderTop: '1px solid var(--bd)' }}><div><b>{P[d.a][0]} ↔ {P[d.b][0]}</b> <Tag c="r">{d.kind}</Tag> {d.source === 'traffic-feed' && <Tag c="b">traffic feed</Tag>}<br /><span className="mu">{d.reason || 'No reason given'} · {ago(new Date(d.createdAt).getTime())} · {d.impacted} booking(s) affected</span></div><button className="btn s" onClick={() => resolve(d)}>Reopen road</button></div>) : <p className="mu">All roads are open.</p>}
        {past.length > 0 && <><p className="mu" style={{ marginBottom: 4, marginTop: 14 }}>Recently resolved</p>{past.map(d => <div key={d.id} className="mu">{P[d.a][0]} ↔ {P[d.b][0]} · {d.kind} · {d.impacted} affected</div>)}</>}
      </div>
    </>
  );
}
