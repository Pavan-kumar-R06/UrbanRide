import { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Stat, Tag, Empty } from '../../components/ui';
import { api } from '../../lib/api';
import { inr, ago } from '../../lib/format';

const LABEL = { topup: 'Top-up', ride_hold: 'Fare held', ride_payment: 'Ride payment', earning: 'Ride earning', refund: 'Refund', credit: 'Credit', cancellation_fee: 'Cancellation fee', cancellation_compensation: 'Cancellation compensation', platform_fee: 'Platform fee', service_fee: 'Vehicle service fee' };

export default function Wallet() {
  const { me, refreshMe, toast, bookings } = useApp();
  const [w, setW] = useState(null), [amt, setAmt] = useState(200);
  const load = () => api('/wallet').then(setW).catch(e => toast(e.message));
  useEffect(() => { load(); }, [bookings.length]); // eslint-disable-line
  const topup = async () => { try { setW({ ...(await api('/wallet/topup', { method: 'POST', body: { amount: amt } })), settings: w.settings, goodwillCredit: w.goodwillCredit, lateCancelMinutes: w.lateCancelMinutes }); await refreshMe(); toast(`₹${amt} added to your wallet.`); } catch (e) { toast(e.message); } };
  if (!w) return <><Hd t="Mobility Wallet" s="Ride contributions, refunds, credits and cancellations." /><p className="mu">Loading…</p></>;
  const start = w.settings.mode === 'start';
  return (
    <>
      <Hd t="Mobility Wallet" s="Ride contributions, refunds, credits and cancellations." />
      <div className="grid">
        <Stat i="wallet" v={inr(w.balance)} l="Available balance" c="blue" />
        <Stat i="rupee" v={inr(w.totals.earned)} l="Earned as a driver" c="green" />
        <Stat i="ticket" v={inr(w.totals.spent)} l="Spent on rides" c="purple" />
        <Stat i="check" v={inr(w.totals.refunded + w.totals.credits)} l="Refunds & credits" c="amber" />
      </div>
      <div className="two">
        <div>
          <div className="card"><h3>Add money</h3>
            <p className="mu" style={{ marginTop: 0 }}>Demo wallet: top-ups are simulated (no real payment gateway is connected).</p>
            <div className="row">{[100, 200, 500, 1000].map(a => <button key={a} className={'chip ' + (amt === a ? 'on' : '')} onClick={() => setAmt(a)}>₹{a}</button>)}</div>
            <div className="row" style={{ marginTop: 12, flexWrap: 'nowrap' }}><input type="number" min="50" max="10000" value={amt} onChange={e => setAmt(+e.target.value)} /><button className="btn" onClick={topup}>Add ₹{amt}</button></div>
          </div>
          <div className="card"><h3>How payments work</h3>
            <p className="mu" style={{ marginTop: 0 }}>{start ? <>Fares are <b style={{ color: 'var(--tx)' }}>held from your wallet when the driver starts the ride</b> and released to the driver when it completes.</> : <>Fares are <b style={{ color: 'var(--tx)' }}>debited when the ride completes</b>.</>} Settlement mode is set by the platform admin.</p>
            <p className="mu">If a driver cancels, any held fare is refunded and you receive a <b style={{ color: 'var(--tx)' }}>₹{w.goodwillCredit} credit</b> for a confirmed seat. Cancelling a confirmed seat within {w.lateCancelMinutes} minutes of departure (or after the ride starts) costs a small fee paid to the driver.</p>
            {w.pendingHolds > 0 && <Tag c="w">{w.pendingHolds} fare(s) currently held</Tag>}
          </div>
        </div>
        <div className="card"><h3>Latest 10 transactions</h3>
          {w.transactions.length ? w.transactions.slice(0, 10).map(t => (
            <div key={t.id} className="row sp" style={{ padding: '10px 0', borderTop: '1px solid var(--bd)', flexWrap: 'nowrap' }}>
              <div><b>{LABEL[t.type] || t.type}</b><br /><span className="mu" style={{ fontSize: 12 }}>{t.note} · {ago(new Date(t.createdAt).getTime())}</span></div>
              <div style={{ textAlign: 'right' }}><b style={{ color: t.amount > 0 ? '#10b981' : '#ef4444' }}>{t.amount > 0 ? '+' : ''}{inr(t.amount)}</b><br /><span className="mu" style={{ fontSize: 12 }}>Bal {inr(t.balanceAfter ?? 0)}</span></div>
            </div>
          )) : <Empty i="wallet" t="No transactions yet." />}
        </div>
      </div>
    </>
  );
}
