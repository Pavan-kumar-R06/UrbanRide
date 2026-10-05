import { Ic } from './Icons';
export const Hd = ({ t, s }) => (<><h2>{t}</h2><p className="sub">{s}</p></>);
export const Tag = ({ c = '', children }) => <span className={'tag ' + c}>{children}</span>;
export const Av = ({ name }) => <span className="av" style={{ background: '#ffffff', color: '#090a0f' }}>{(name || '?')[0]}</span>;
export const Stat = ({ i, v, l, c = 'neutral' }) => (<div className={'card stat ' + c}><i><Ic n={i} z={22} /></i><div><b>{v}</b><span className="mu">{l}</span></div></div>);
export const Empty = ({ i, t, children }) => (<div className="card empty"><b><Ic n={i} z={44} /></b><p style={{ fontWeight: 600, margin: '6px 0' }}>{t}</p><div style={{ marginTop: 14 }}>{children}</div></div>);
export const Table = ({ head, rows }) => (
  <div className="card tw"><table><tbody><tr>{head.map(h => <th key={h}>{h}</th>)}</tr>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
);
export const Stars = ({ n }) => <><span style={{ color: '#f59e0b' }}>★</span> {n}</>;
export const Bar = ({ pct, color }) => <div className="bar"><i style={{ width: Math.max(0, Math.min(100, pct)) + '%', ...(color ? { background: color } : {}) }} /></div>;
export const Spinner = ({ text = 'Loading…' }) => <p className="mu">{text}</p>;

export function Toasts({ toasts }) { return <>{toasts.map(t => <div key={t.id} className="toast">{t.t}</div>)}</>; }

export function Dialog({ dialog, setDialog }) {
  if (!dialog) return null;
  const done = v => { setDialog(null); dialog.resolve(v); };
  return (
    <div className="ur-dialog-overlay" onClick={e => { if (e.target === e.currentTarget) done(false); }}>
      <div className="ur-dialog card" role="dialog" aria-modal="true">
        <h3>{dialog.title}</h3><p className="mu">{dialog.message}</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn g" autoFocus onClick={() => done(false)}>Cancel</button>
          <button className="btn d" onClick={() => done(true)}>{dialog.okLabel}</button>
        </div>
      </div>
    </div>
  );
}
