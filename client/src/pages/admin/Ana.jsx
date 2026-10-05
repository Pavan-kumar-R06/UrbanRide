import { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Stat, Tag, Bar } from '../../components/ui';
import { Veh } from '../../components/Icons';
import { api } from '../../lib/api';
import { rn, km, near, vLabel } from '../../lib/cityGraph';
import { dt, today, ago, inr } from '../../lib/format';

const bkm = (b, rides) => { const r = rides.find(x => x.id == b.rid); if (!r) return 0; const i = near(r.path, b.f)[0], j = near(r.path, b.t)[0]; return j > i ? km(r.path, i, j) : 0; };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function Columns({ data, color }) {
  const max = Math.max(1, ...data.map(d => d.v));
  return <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>{data.map((d, i) => <div key={i} title={`${d.l}: ${d.v}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}><div style={{ width: '100%', background: color, height: Math.max(d.v ? 6 : 2, d.v / max * 100) + '%', borderRadius: '3px 3px 0 0', opacity: d.v ? 1 : .3 }} /><span className="mu" style={{ fontSize: 9, marginTop: 3 }}>{d.s}</span></div>)}</div>;
}
const TXN = { topup: 'Top-up', ride_hold: 'Fare held', ride_payment: 'Ride payment', earning: 'Driver earning', refund: 'Refund', credit: 'Credit', cancellation_fee: 'Cancellation fee', cancellation_compensation: 'Cancellation compensation', platform_fee: 'Platform fee', service_fee: 'Service fee' };

export default function Ana() {
  const { rides, bookings, users, incidents, toast } = useApp();
  const [adv, setAdv] = useState(null), [money, setMoney] = useState(null), [mode, setMode] = useState('start');
  const [rng, setRng] = useState('7d'), [metric, setMetric] = useState('rides');
  const filterDays = rng === 'today' ? 1 : rng === '7d' ? 7 : rng === '30d' ? 30 : 999;
  const cutoff = rng === 'all' ? '2000-01-01' : dt(filterDays - 1);
  const activeRides = rides.filter(r => r.date >= cutoff && r.status !== 'cancelled');
  const activeBookings = bookings.filter(b => { const r = rides.find(x => x.id === b.rid); return r && r.date >= cutoff; });
  const confirmed = activeBookings.filter(b => b.st === 'confirmed');
  const rev = confirmed.reduce((a, b) => a + b.fare, 0);
  const co2Kg = confirmed.reduce((a, b) => a + (bkm(b, rides) * 0.12 * b.seats), 0).toFixed(1);
  const trees = Math.round(co2Kg / 21);
  const totalUsers = users.filter(u => u.role === 'user').length;
  const cancelCount = activeBookings.filter(b => ['cancelled', 'ride-cancelled', 'rejected'].includes(b.st)).length + rides.filter(r => r.date >= cutoff && r.status === 'cancelled').length;
  const confRate = activeBookings.length ? Math.round(confirmed.length / activeBookings.length * 100) : 0;
  const audit = [
    ...rides.map(r => ({ t: `${r.drv} published ${rn(r.path)}`, ts: new Date(r.createdAt || 0).getTime() })),
    ...bookings.map(b => { const r = rides.find(x => String(x.id) === String(b.rid)); return { t: `${b.pn} requested a seat${r ? ' on ' + rn(r.path) : ''}`, ts: new Date(b.createdAt || 0).getTime() }; }),
    ...incidents.map(i => ({ t: `Emergency report from ${i.by}: ${i.type}`, ts: new Date(i.createdAt || 0).getTime() }))
  ].filter(x => x.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 10);

  const bars = [];
  if (rng === 'today') {
    [...new Set(rides.filter(r => r.date === today).map(r => r.time.slice(0, 2)))].sort().slice(0, 6).forEach(h => {
      const count = rides.filter(r => r.date === today && r.time.slice(0, 2) === h).length;
      const rVal = bookings.filter(b => { const r = rides.find(x => x.id === b.rid); return r && r.date === today && r.time.slice(0, 2) === h && b.st === 'confirmed'; }).reduce((a, c) => a + c.fare, 0);
      bars.push({ label: h + ':00', val: metric === 'revenue' ? rVal : count });
    });
  } else {
    const days = rng === '7d' ? 7 : rng === '30d' ? 30 : (() => { const first = rides.map(r => r.date).filter(Boolean).sort()[0]; const span = first ? Math.round((new Date(today + 'T00:00') - new Date(first + 'T00:00')) / 864e5) + 1 : 7; return Math.max(7, Math.min(60, span)); })();
    const dense = false;
    for (let i = Math.min(days, 10) - 1; i >= 0; i--) {
      const ds = dt(i), label = new Date(ds + 'T00:00').toLocaleDateString([], dense ? { day: 'numeric', month: 'short' } : { weekday: 'short', month: 'numeric', day: 'numeric' });
      const count = rides.filter(r => r.date === ds).length;
      const rVal = bookings.filter(b => { const r = rides.find(x => x.id === b.rid); return r && r.date === ds && b.st === 'confirmed'; }).reduce((a, c) => a + c.fare, 0);
      bars.push({ label, val: metric === 'revenue' ? rVal : count });
    }
  }
  const maxVal = Math.max(1, ...bars.map(x => x.val));
  const isRev = metric === 'revenue';
  useEffect(() => { api('/analytics/advanced?range=' + rng).then(setAdv).catch(() => {}); }, [rng]);
  useEffect(() => { api('/wallet/platform').then(setMoney).catch(() => {}); api('/wallet/settings').then(x => setMode(x.mode)).catch(() => {}); }, [rng]);
  const setM = async m => { try { await api('/wallet/settings', { method: 'PUT', body: { mode: m } }); setMode(m); toast('Charge timing updated. It applies to new bookings.'); } catch (e) { toast(e.message); } };
  const maxRoute = adv ? Math.max(1, ...adv.routeDemand.map(r => r.requests + r.searches)) : 1;

  return (
    <>
      <div className="ana-header">
        <div className="row sp" style={{ alignItems: 'flex-start' }}><div><h2>Mobility &amp; Fleet Analytics</h2><p className="sub">Recent activity and fleet performance. Lists show the 10 most recent items.</p></div></div>
        <div className="ana-toolbar">
          <div className="row"><span className="mu" style={{ fontSize: 12, fontWeight: 700 }}>TIME RANGE:</span>
            <div className="ana-filter-group">{[['today', 'Today'], ['7d', '7 Days'], ['30d', '30 Days'], ['all', 'Available data']].map(([k, l]) => <button key={k} className={'ana-filter-btn ' + (rng === k ? 'active' : '')} onClick={() => setRng(k)}>{l}</button>)}</div></div>
          <div className="row"><span className="mu" style={{ fontSize: 12, fontWeight: 700 }}>CHART METRIC:</span>
            <div className="ana-filter-group"><button className={'ana-filter-btn ' + (metric === 'rides' ? 'active' : '')} onClick={() => setMetric('rides')}>Trips Volume</button><button className={'ana-filter-btn ' + (metric === 'revenue' ? 'active' : '')} onClick={() => setMetric('revenue')}>Gross Fares (₹)</button></div></div>
        </div>
      </div>
      <div className="grid">
        <Stat i="users" v={totalUsers} l="Recent Users (max 100)" c="blue" /><Stat i="car" v={activeRides.length} l="Trips in Range" c="purple" />
        <Stat i="ticket" v={activeBookings.length} l={`Bookings (${confRate}% confirmed)`} c="green" /><Stat i="rupee" v={'₹' + rev} l="Confirmed Ride Fares" c="amber" />
        <Stat i="leaf" v={co2Kg + ' kg'} l={`CO₂ Saved (~${trees} trees)`} c="green" /><Stat i="alert" v={cancelCount} l="Cancellations in Range" c="red" />
      </div>
      <div className="card ana-chart-card">
        <div className="row sp" style={{ marginBottom: 12 }}><h3>{isRev ? 'Daily Platform Gross Revenue (₹)' : 'Daily Carpool Commute Trips'}</h3><span className="tag b">{rng === 'today' ? 'TODAY' : 'LAST ' + bars.length + ' DAYS'}</span></div>
        <div className="ana-bars-container" style={{ gap: 12 }}>
          {bars.length ? bars.map((b, i) => {
            const text = isRev ? '₹' + b.val : b.val, showVal = b.val > 0;
            return <div key={i} className="ana-bar-col" title={`${b.label}: ${text}`}>{showVal && <span className="ana-bar-val">{text}</span>}<div className={`ana-bar-fill ${isRev ? 'revenue' : ''} ${b.val > 0 ? '' : 'zero'}`} style={{ height: (b.val > 0 ? Math.max(8, b.val / maxVal * 100) : 2) + '%' }} /><span className="ana-bar-label">{b.label}</span></div>;
          }) : <p className="mu">No trip activity in this period.</p>}
        </div>
        <p className="mu" style={{ margin: 0, fontSize: 12 }}>Calculated from the latest recorded trips and bookings available.</p>
      </div>

      {/* ---- Money & payments (moved here from the old Wallet ledger page) ---- */}
      <div className="card">
        <div className="row sp" style={{ marginBottom: 10 }}><h3 style={{ margin: 0 }}>Money &amp; payments</h3><Tag c="b">Mobility Wallet ledger</Tag></div>
        <div className="row" style={{ marginBottom: 12 }}><span className="mu" style={{ fontSize: 12, fontWeight: 700 }}>RIDERS ARE CHARGED:</span>
          <button className={'chip ' + (mode === 'start' ? 'on' : '')} onClick={() => setM('start')}>At ride start (held, released on completion)</button>
          <button className={'chip ' + (mode === 'end' ? 'on' : '')} onClick={() => setM('end')}>At ride end</button></div>
        {money ? <>
          <div className="grid" style={{ margin: '0 0 12px' }}>
            <Stat i="wallet" v={inr(money.topups)} l="Wallet top-ups" c="blue" /><Stat i="rupee" v={inr(money.driverEarnings)} l="Paid to drivers" c="green" />
            <Stat i="check" v={inr(money.refunds)} l="Refunds" c="amber" /><Stat i="zap" v={inr(money.creditsIssued)} l="Credits issued" c="purple" />
            <Stat i="alert" v={inr(money.lateFees)} l="Late-cancel fees" c="red" /><Stat i="car" v={inr(money.serviceFees || 0)} l="Vehicle service fees" c="neutral" />
          </div>
          <span className="mu" style={{ fontSize: 12, fontWeight: 700 }}>LATEST 10 TRANSACTIONS</span>
          {money.recent.slice(0, 10).map(t => <div key={t.id} className="row sp" style={{ padding: '8px 0', borderTop: '1px solid var(--bd)', flexWrap: 'nowrap' }}><div><Tag c="b">{TXN[t.type] || t.type}</Tag> <span className="mu">{t.note}</span></div><div style={{ textAlign: 'right' }}><b style={{ color: t.amount > 0 ? '#10b981' : '#ef4444' }}>{t.amount > 0 ? '+' : ''}{inr(t.amount)}</b> <span className="mu" style={{ fontSize: 12 }}>{t.uid === 'platform' ? 'platform' : 'user …' + t.uid.slice(-4)} · {ago(new Date(t.createdAt).getTime())}</span></div></div>)}
          {!money.recent.length && <p className="mu">No wallet activity yet.</p>}
        </> : <p className="mu">Loading ledger…</p>}
      </div>

      {adv && <>
        <div className="two">
          <div className="card"><h3>Route demand</h3>
            {adv.routeDemand.length ? adv.routeDemand.slice(0, 10).map(r => (
              <div key={r.f + r.t} className="corridor-row"><div className="corridor-info"><div className="row sp"><b style={{ fontSize: 13 }}>{r.label}</b><span className="mu">{r.requests} booked · {r.searches} searches</span></div><div className="corridor-bar-track"><div className="corridor-bar-progress" style={{ width: (r.requests + r.searches) / maxRoute * 100 + '%' }} /></div></div><span className="tag b">{r.conversion}% conv.</span></div>
            )) : <p className="mu">No route demand yet.</p>}
          </div>
          <div className="card"><h3>Cancellation patterns</h3>
            {adv.cancellations.causes.map(x => <div key={x.label} className="row sp" style={{ padding: '4px 0' }}><span>{x.label}</span><b>{x.count}</b></div>)}
            <div style={{ marginTop: 10 }}><span className="mu" style={{ fontSize: 12 }}>By day of week</span><Columns color="#ef4444" data={adv.cancellations.byDay.map((v, i) => ({ v, l: DAYS[i], s: DAYS[i][0] }))} /></div>
            {adv.cancellations.topRoutes.length > 0 && <div style={{ marginTop: 10 }}><span className="mu" style={{ fontSize: 12 }}>Most-cancelled routes</span>{adv.cancellations.topRoutes.map(r => <div key={r.label} className="row sp"><span>{r.label}</span><Tag c="r">{r.count}</Tag></div>)}</div>}
          </div>
        </div>
        <div className="card"><h3>Vehicle utilisation</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {adv.vehicles.map(v => (
              <div key={v.type} style={{ border: '1px solid var(--bd)', borderRadius: 12, padding: 14 }}>
                <div className="row sp"><b style={{ fontSize: 16 }}><Veh t={v.type} z={20} /> {vLabel(v.type)}s</b><Tag c="b">{v.utilization}% full</Tag></div>
                <Bar pct={v.utilization} color="#38bdf8" />
                <div className="mu" style={{ marginTop: 8, lineHeight: 1.7 }}>{v.rides} ride(s) · {v.completed} completed<br />{v.seatsFilled}/{v.seatsOffered} seats filled<br />{v.distanceKm} km driven · {inr(v.revenue)} fares</div>
              </div>))}
          </div>
        </div>
      </>}

      <div className="card">
        <div className="row sp" style={{ marginBottom: 12 }}><h3>Recent Activity</h3><span className="mu">Latest 10</span></div>
        {audit.length ? audit.map((l, i) => <div key={i} className="audit-stream-item"><span className="audit-dot" /><div style={{ flex: 1 }}><div>{l.t}</div><span className="mu">{ago(l.ts)}</span></div></div>) : <p className="mu">No recorded activity yet.</p>}
      </div>
    </>
  );
}
