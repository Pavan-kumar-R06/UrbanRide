import { useState } from 'react';
import { VEHICLES } from '../lib/cityGraph';
import { Veh } from './Icons';

export default function VehicleForm({ onSubmit, label = 'Register Vehicle' }) {
  const [v, setV] = useState({ type: 'car', make: '', model: '', reg: '', year: '', color: '' });
  const set = (k, val) => setV(s => ({ ...s, [k]: val }));
  const go = () => onSubmit({ ...v, year: v.year ? Number(v.year) : null });
  return (
    <>
      <label>Vehicle type</label>
      <div className="row" style={{ marginBottom: 12 }}>{Object.entries(VEHICLES).map(([k, t]) => <button key={k} type="button" className={'chip ' + (v.type === k ? 'on' : '')} onClick={() => set('type', k)}><Veh t={k} z={16} /> {t.label}</button>)}</div>
      <div className="fg">
        <div><label>Make</label><input value={v.make} placeholder="Hyundai" onChange={e => set('make', e.target.value)} /></div>
        <div><label>Model</label><input value={v.model} placeholder="Creta" onChange={e => set('model', e.target.value)} /></div>
        <div><label>Registration number</label><input id="cm" value={v.reg} placeholder="KA01 AB 1234" onChange={e => set('reg', e.target.value)} /></div>
        <div><label>Year</label><input type="number" min="1990" max={new Date().getFullYear() + 1} value={v.year} placeholder="2022" onChange={e => set('year', e.target.value)} /></div>
        <div><label>Colour</label><input value={v.color} placeholder="White" onChange={e => set('color', e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 14 }}><button className="btn" onClick={go}>{label}</button></div>
    </>
  );
}
