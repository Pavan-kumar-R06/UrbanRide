import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Av, Stars, Empty } from '../../components/ui';
import MapSvg from '../../components/Map';
import { DnaCard, PassportLink, ReliabilityBadge, useReliability } from '../../components/features';
import { P, PF, match, nm, VEHICLES } from '../../lib/cityGraph';
import { api } from '../../lib/api';
import { inr } from '../../lib/format';
import { Veh, Ic } from '../../components/Icons';

let savedQ = { f: 'ec', t: 'wf', time: '08:30', seats: 1, sort: 'match', ac: 0, wo: 0, vtype: 'all' };
const so = v => Object.keys(P).map(k => <option key={k} value={k}>{P[k][0]}</option>);

function RideCard({ m, q, active, onPick, rel, onBook, balance, mode }) {
  const r = m.r, total = m.fare + m.fee, short = mode === 'start' && balance < total;
  return (
    <div className="card" style={{ cursor: 'pointer', ...(active ? { borderColor: '#38bdf8', boxShadow: '0 0 0 2px rgba(56,189,248,0.2)' } : {}) }} onClick={onPick}>
      <div className="row sp">
        <div className="row"><Av name={r.drv} /><div><h3>{r.drv}</h3><span className="mu"><Stars n={r.rt} /> · <Veh t={r.vtype} z={17} /> {r.veh}</span></div></div>
        <div style={{ textAlign: 'right' }}><b style={{ fontSize: 20, color: '#10b981' }}>₹{m.fare}</b><br /><span className="mu">₹{m.perSeat} × {q.seats} seat(s)</span>
          {m.fee ? <><br /><span className="mu">+ ₹{m.fee} platform fee</span><br /><b>Total ₹{total}</b></> : null}</div>
      </div>
      <div className="row" style={{ margin: '10px 0' }}>
        <Tag>{m.score}% match</Tag><Tag c={r.seats ? '' : 'r'}>{r.seats ? r.seats + ' seats left' : 'Full'}</Tag><Tag c="b">Departs {r.time}</Tag>
        {r.networkId && <Tag c="p"><Ic n="building" z={12} /> Private network</Tag>}
        <ReliabilityBadge rel={rel} />
        {r.pf.map(k => <Tag key={k} c="p">{PF[k]}</Tag>)}
      </div>
      <div className="mu">Pickup <b>{P[m.pick][0]}</b> ({m.walk} km walk) → Drop <b>{P[m.drop][0]}</b> · {m.k} km</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn s" onClick={e => { e.stopPropagation(); onBook(); }}>{r.seats >= q.seats ? 'Request seat' : 'Join waitlist'}</button>
        <PassportLink uid={r.own} />
        {short && <span className="mu" style={{ fontSize: 12 }}>Wallet {inr(balance)} · top up to cover ₹{total}</span>}
      </div>
    </div>
  );
}

export default function Find() {
  const { me, rides, book, go, recordSearch, preview, setPreview, toast, syncData, refreshMe } = useApp();
  const [q, setQ] = useState(savedQ);
  const [plans, setPlans] = useState(null), [planning, setPlanning] = useState(false);
  const [mode, setMode] = useState('start');
  const set = (k, v) => { savedQ = { ...savedQ, [k]: v }; setQ(savedQ); setPlans(null); };
  const res = useMemo(() => match(rides, q, { userId: me.id }), [rides, q, me.id]);
  const rel = useReliability(res.map(m => m.r.own));
  const pv = res.find(m => m.r.id == preview) || res[0];

  useEffect(() => { api('/wallet/settings').then(s => setMode(s.mode)).catch(() => {}); }, []);
  const lastKey = useRef('');
  useEffect(() => {
    const key = [q.f, q.t, q.time, q.vtype, q.seats].join('|');
    if (q.f === q.t || key === lastKey.current) return;
    const t = setTimeout(() => { lastKey.current = key; recordSearch(q, res.length); }, 1200);
    return () => clearTimeout(t);
  }, [q.f, q.t, q.time, q.vtype, q.seats, rides.length]); // eslint-disable-line

  const plan = async () => {
    setPlanning(true);
    try { setPlans(await api('/journeys/plan', { method: 'POST', body: { f: q.f, t: q.t, time: q.time, seats: q.seats } })); }
    catch (e) { toast(e.message); } finally { setPlanning(false); }
  };
  const bookPlan = async p => {
    try {
      await api('/journeys', { method: 'POST', body: { seats: q.seats, legs: p.legs.map(l => ({ rid: l.ride.id, f: l.f, t: l.t, waitMinutes: l.waitMinutes })) } });
      toast('Multi-vehicle journey requested. Both drivers have been notified.');
      await Promise.all([syncData(), refreshMe()]); go('bookings');
    } catch (e) { toast(e.message); }
  };

  return (
    <>
      <Hd t="Find a ride" s="Search routes shared by verified commuters. Book a seat and split fuel costs." />
      <div className="card">
        <div className="fg">
          <div><label>From</label><select value={q.f} onChange={e => set('f', e.target.value)}>{so()}</select></div>
          <div><label>To</label><select value={q.t} onChange={e => set('t', e.target.value)}>{so()}</select></div>
          <div><label>Time</label><input type="time" value={q.time} onChange={e => set('time', e.target.value)} /></div>
          <div><label>Seats</label><select value={q.seats} onChange={e => set('seats', +e.target.value)}>{[1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></div>
          <div><label>Sort by</label><select value={q.sort} onChange={e => set('sort', e.target.value)}>{[['match', 'Best match'], ['fare', 'Lowest fare'], ['time', 'Earliest']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className={'chip ' + (q.vtype === 'all' ? 'on' : '')} onClick={() => set('vtype', 'all')}>All vehicles</button>
          {Object.entries(VEHICLES).map(([k, v]) => <button key={k} className={'chip ' + (q.vtype === k ? 'on' : '')} onClick={() => set('vtype', k)}><Veh t={k} z={16} /> {v.label}s</button>)}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className={'chip ' + (q.ac ? 'on' : '')} onClick={() => set('ac', !q.ac)}>AC only</button>
          <button className={'chip ' + (q.wo ? 'on' : '')} onClick={() => set('wo', !q.wo)}>Women only</button>
          <span className="mu">{res.length > 10 ? 'Showing the best 10 of ' + res.length : res.length} ride(s) found</span>
        </div>
      </div>
      <div className="two">
        <div>
          {res.length ? res.slice(0, 10).map(m => <RideCard key={m.r.id} m={m} q={q} active={pv && m.r.id === pv.r.id} onPick={() => setPreview(m.r.id)} rel={rel[String(m.r.own)]} balance={me.walletBalance || 0} mode={mode}
            onBook={() => book(m.r.id, m.pick, m.drop, m.fare, q.seats, m.fee)} />)
            : <Empty i="search" t="No single ride covers this route and time."><div className="row" style={{ justifyContent: 'center' }}><button className="btn" onClick={plan} disabled={planning}>{planning ? 'Searching…' : 'Try a multi-vehicle journey'}</button><button className="btn g" onClick={() => go('offer')}>Offer your own ride</button></div></Empty>}
          {res.length > 0 && !plans && <div className="row" style={{ margin: '4px 0 14px' }}><button className="btn g" onClick={plan} disabled={planning}>{planning ? 'Searching…' : 'Compare multi-vehicle journeys'}</button></div>}
          {plans && (
            <div className="card">
              <div className="row sp"><h3>Ride transformation</h3><Tag c="p">One journey · {plans.plans.length ? 'multiple vehicles' : 'none found'}</Tag></div>
              <p className="mu" style={{ marginTop: 0 }}>Your trip continues in a different UrbanRide vehicle — e.g. a bike through narrow lanes, then a car on the main road.</p>
              {!plans.plans.length && <p className="mu">No connecting rides line up at the moment. Try a different time or ask a driver to publish a route.</p>}
              {plans.plans.map((p, i) => (
                <div key={i} style={{ borderTop: '1px solid var(--bd)', paddingTop: 12, marginTop: 12 }}>
                  <div className="row sp"><b>Transfer at {p.hubName}</b><span><Tag c="b">{p.distance} km</Tag> <Tag c="p">{p.wait} min wait</Tag> <b style={{ color: '#10b981', fontSize: 18 }}>₹{p.total}</b></span></div>
                  {p.legs.map((l, j) => (
                    <div key={j} className="row sp" style={{ margin: '8px 0' }}>
                      <div className="row"><span style={{ fontSize: 22 }}><Veh t={l.ride.vtype} z={17} /></span><div><b>Leg {j + 1}: {nm(l.f)} → {nm(l.t)}</b><br /><span className="mu">{l.ride.drv} · departs {l.ride.time} · {l.k} km · ₹{l.fare}</span></div></div>
                      <div className="row"><ReliabilityBadge rel={l.reliability === null ? { score: null } : { score: l.reliability, tier: l.reliability >= 90 ? 'Excellent' : l.reliability >= 75 ? 'Reliable' : 'Fair' }} /><PassportLink uid={l.ride.own} /></div>
                    </div>
                  ))}
                  <DnaCard dna={p.dna} compact />
                  <div className="row" style={{ marginTop: 10 }}><button className="btn s" onClick={() => bookPlan(p)}>Request both legs</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div><div className="card"><h3>Route preview{pv ? ': ' + pv.r.drv : ''}</h3>
          <MapSvg {...(pv ? { list: [{ id: pv.r.id, path: pv.r.path }], hi: pv.r.id, pick: pv.pick, drop: pv.drop, from: q.f } : {})} /></div></div>
      </div>
    </>
  );
}
