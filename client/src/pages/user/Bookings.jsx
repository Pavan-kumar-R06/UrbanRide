import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Av, Empty } from '../../components/ui';
import { AlternativesPanel, DnaLoader, SharePanel } from '../../components/features';
import { P } from '../../lib/cityGraph';
import { fareText } from '../../lib/format';
import { Veh } from '../../components/Icons';

const CL = { pending: 'w', confirmed: '', waitlisted: 'w', cancelled: 'r', 'ride-cancelled': 'r', rejected: 'r' };

export default function Bookings() {
  const { me, bookings, rides, go, cancelB, openChatThread, rateRide } = useApp();
  const [open, setOpen] = useState({});
  const toggle = (id, k) => setOpen(o => ({ ...o, [id + k]: !o[id + k] }));
  const newest = bookings.filter(b => String(b.pid) === String(me.id) && rides.some(x => x.id == b.rid)).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  // keep the legs of one multi-vehicle journey together and in travel order (leg 1, 2, 3)
  const ordered = [], seenJ = new Set();
  newest.forEach(b => {
    if (!b.journeyId) return ordered.push(b);
    if (seenJ.has(b.journeyId)) return;
    seenJ.add(b.journeyId);
    newest.filter(x => x.journeyId === b.journeyId).sort((x, y) => x.legIndex - y.legIndex).forEach(x => ordered.push(x));
  });
  const mine = ordered.slice(0, 10);
  if (!mine.length) return <><Hd t="My bookings" s="Track your seat requests, waitlist and completed trips." /><Empty i="ticket" t="No bookings yet."><button className="btn" onClick={() => go('find')}>Find a ride</button></Empty></>;
  const journeyIds = [...new Set(mine.filter(b => b.journeyId).map(b => b.journeyId))];
  return (
    <>
      <Hd t="My bookings" s="Your 10 most recent seat requests, waitlist entries and trips." />
      {mine.map(b => {
        const r = rides.find(x => x.id == b.rid), isCompleted = Boolean(b.tripCompletedAt) || (r && r.status === 'completed');
        const leg = b.journeyId ? bookings.filter(x => x.journeyId === b.journeyId).length : 0;
        const isFirstLeg = !b.journeyId || bookings.filter(x => x.journeyId === b.journeyId && ['pending', 'confirmed'].includes(x.st)).sort((x, y) => x.legIndex - y.legIndex)[0]?.id === b.id;
        const needsAlt = b.st === 'ride-cancelled' || (b.disruption && ['pending', 'confirmed'].includes(b.st));
        return (
          <div className="card" key={b.id}>
            <div className="row sp">
              <div className="row"><Av name={r.drv} /><div><h3>{P[b.f][0]} → {P[b.t][0]}</h3><span className="mu"><Veh t={r.vtype} z={17} /> {r.drv} · {r.date} {r.time} · {b.seats} seat(s) · {fareText(b)}</span></div></div>
              <div className="row">
                {b.journeyId && <Tag c="p"><Veh t={r.vtype} z={13} /> Leg {b.legIndex + 1} of {leg}</Tag>}
                {b.disruption && ['pending', 'confirmed'].includes(b.st) && <Tag c="r">⚠ Route disrupted</Tag>}
                {isCompleted ? <Tag c="b">trip completed</Tag> : <Tag c={CL[b.st]}>{b.st}</Tag>}
                {b.paymentState === 'held' && <Tag c="w">₹{b.paidAmount} held</Tag>}
                {b.paymentState === 'settled' && <Tag>paid</Tag>}
                {b.paymentState === 'refunded' && <Tag c="b">refunded</Tag>}
                {b.st === 'confirmed' && !isCompleted && <button className="btn s" onClick={() => go('live')}>Track</button>}
                {['pending', 'confirmed', 'waitlisted'].includes(b.st) && !isCompleted && <>{b.st !== 'waitlisted' && <button className="btn g s" onClick={() => openChatThread(r.id)}>Message</button>}<button className="btn g s" onClick={() => cancelB(b.id)}>Cancel</button></>}
              </div>
            </div>
            {b.disruption && ['pending', 'confirmed'].includes(b.st) && <div className="mu" style={{ marginTop: 8, color: '#f59e0b' }}>⚠ {b.disruption.reason || 'A road on your route is unavailable'}. Alternatives are shown below.</div>}
            {b.cancelFee > 0 && <div className="mu" style={{ marginTop: 6 }}>Late-cancellation fee charged: ₹{b.cancelFee}</div>}
            {isCompleted && (
              <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--bd)' }}>
                <div className="row sp">
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#10b981' }}>🎉 {b.tripCompletedAt ? 'You arrived at your drop-off with ' : 'Ride Completed with '}{r.drv}</span>
                  {b.rated ? <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13 }}>✓ Rated {b.rated} ★ / 5</span> : <span className="mu" style={{ fontSize: 12 }}>Please rate your experience:</span>}
                </div>
                {!b.rated ? <div className="row" style={{ gap: 8, marginTop: 8 }}>{[1, 2, 3, 4, 5].map(st => <button key={st} className="btn s" onClick={() => rateRide(b.id, r.id, st)} style={{ padding: '4px 12px', fontSize: 13, fontWeight: 700, background: 'var(--s3)', borderColor: 'var(--bd)', color: 'var(--tx)' }}>★ {st}</button>)}</div>
                  : <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 4 }}>Thank you for rating! Driver rating updated to {r.rt} ★.</div>}
              </div>
            )}
            {needsAlt && <AlternativesPanel booking={b} />}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn g s" onClick={() => toggle(b.id, 'dna')}>{open[b.id + 'dna'] ? 'Hide' : 'View'} Journey DNA</button>
              {['pending', 'confirmed'].includes(b.st) && !isCompleted && (!b.journeyId || isFirstLeg) && <button className="btn g s" onClick={() => toggle(b.id, 'share')}>{open[b.id + 'share'] ? 'Hide' : b.journeyId ? 'Share whole journey' : 'Share live tracking'}</button>}
              {b.journeyId && !isFirstLeg && <span className="mu" style={{ fontSize: 12 }}>Tracked by the journey link on leg 1</span>}
            </div>
            {open[b.id + 'dna'] && <DnaLoader body={{ bookingId: b.id }} />}
            {open[b.id + 'share'] && <SharePanel rideId={b.rid} bookingId={b.id} journeyId={b.journeyId || ''} />}
          </div>
        );
      })}
    </>
  );
}
