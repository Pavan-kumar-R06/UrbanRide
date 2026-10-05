import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Hd, Tag, Empty } from '../../components/ui';
import { rn } from '../../lib/cityGraph';

export default function Chat() {
  const { me, rides, bookings, msgs, thread, setThread, openChatThread, send } = useApp();
  const [text, setText] = useState('');
  const box = useRef(null);
  const threads = rides.filter(r => String(r.own) === String(me.id) || bookings.some(b => String(b.rid) === String(r.id) && String(b.pid) === String(me.id) && b.st !== 'cancelled'));
  const ths = threads.map(ride => ({ ride, latest: msgs.filter(m => String(m.rid) === String(ride.id)).reduce((t, m) => Math.max(t, Date.parse(m.createdAt) || 0), Date.parse(ride.createdAt) || 0) })).sort((a, b) => b.latest - a.latest).slice(0, 10).map(x => x.ride);
  const cur = ths.find(r => r.id == thread) || ths[0];
  useEffect(() => { if (cur && cur.id !== thread) setThread(cur.id); }, [cur?.id]); // eslint-disable-line
  const ms = cur ? msgs.filter(m => m.rid == cur.id).slice(-10) : [];
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [ms.length, cur?.id]);
  const title = r => { if (String(r.own) !== String(me.id)) return r.drv; const names = [...new Set(bookings.filter(b => String(b.rid) === String(r.id) && ['pending', 'confirmed'].includes(b.st)).map(b => b.pn))]; return names.length ? names.join(', ') : 'No passengers yet'; };
  if (!ths.length) return <><Hd t="Messages" s="Ride-specific chat with drivers and passengers." /><Empty i="chat" t="No conversations yet." /></>;
  const submit = async () => { const t = text.trim(); if (!t) return; if (await send(t)) setText(''); };
  return (
    <>
      <Hd t="Messages" s="Ride chats with drivers and passengers (latest 10 conversations, latest 10 messages each)." />
      <div className="chat">
        <div>{ths.map(r => <div key={r.id} className={'th ' + (r.id == cur.id ? 'on' : '')} onClick={() => openChatThread(r.id)}><b>{title(r)}</b><br /><span className="mu">{rn(r.path)}</span></div>)}</div>
        <div className="card">
          <div className="row sp" style={{ marginBottom: 10 }}><h3>{rn(cur.path)}</h3><Tag c="b">{cur.status}</Tag></div>
          <div className="msgs" ref={box}>{ms.map(m => <div key={m._id || m.id} className={'msg ' + (m.uid == me.id ? 'me' : '')}><small>{m.n} · {m.tm}</small>{m.t}</div>)}{!ms.length && <p className="mu">Say hello</p>}</div>
          <div className="row" style={{ flexWrap: 'nowrap' }}><input placeholder="Type a message..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} /><button className="btn" onClick={submit}>Send</button></div>
        </div>
      </div>
    </>
  );
}
