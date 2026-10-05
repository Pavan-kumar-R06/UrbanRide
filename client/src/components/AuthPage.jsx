import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Brand, Ic, Veh } from './Icons';
import { getRememberedEmail } from '../lib/api';
import { VEHICLES } from '../lib/cityGraph';

/* Identical layout & classes to the original sign-in card. The vehicle field now also captures vehicle type. */
export default function AuthPage() {
  const { login, register } = useApp();
  const [tab, setTab] = useState('user');
  const [reg, setReg] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(!!getRememberedEmail());
  const [f, setF] = useState({ name: '', email: getRememberedEmail(), password: '', vtype: 'car', car: '' });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const isAdmin = tab === 'admin', isReg = !!reg && tab === 'user';

  const submit = async e => {
    e.preventDefault(); setErr('');
    const email = f.email.trim().toLowerCase();
    if (isReg) {
      if (!f.name.trim() || !email.includes('@') || f.password.length < 6) return setErr('Enter full name, valid email, and 6+ character password.');
    } else if (!email || !f.password) return setErr('Please enter both email and password.');
    setLoading(true);
    try {
      if (isReg) await register({ name: f.name.trim(), email, password: f.password, vehicle: f.car.trim() ? { m: f.car.trim(), type: f.vtype } : undefined });
      else await login({ email, password: f.password, asAdmin: isAdmin, remember, form: e.currentTarget });
    } catch (ex) { setErr(ex.status ? ex.message : 'Could not connect to the authentication service.'); setLoading(false); }
  };
  const pick = (t, r = false) => { setTab(t); setReg(r); setErr(''); };

  return (
    <div className="auth-page-wrap">
      <div className="auth-card">
        <div className="auth-brand-row"><Brand z={32} /></div>
        <div className="auth-role-tabs">
          <button type="button" className={'auth-role-btn ' + (!isAdmin ? 'active' : '')} onClick={() => pick('user', reg)}><Ic n="user" z={16} /><span>User Login</span></button>
          <button type="button" className={'auth-role-btn ' + (isAdmin ? 'active' : '')} onClick={() => pick('admin')}><Ic n="shield" z={16} /><span>Admin Login</span></button>
        </div>
        <div className="auth-title-block">
          <h2>{isAdmin ? 'Admin Console' : isReg ? 'Create Account' : 'Sign in to UrbanRide'}</h2>
          <p>{isAdmin ? 'Restricted platform operations and monitoring portal.' : isReg ? 'Book seats or share your ride with one unified account.' : 'Enter your credentials to access your trips and routes.'}</p>
        </div>
        {!isAdmin && (
          <div className="auth-sub-toggle">
            <button type="button" className={'auth-sub-btn ' + (!isReg ? 'active' : '')} onClick={() => { setReg(false); setErr(''); }}>Sign In</button>
            <button type="button" className={'auth-sub-btn ' + (isReg ? 'active' : '')} onClick={() => { setReg(true); setErr(''); }}>Sign Up</button>
          </div>
        )}
        {err && <div className="auth-error"><Ic n="alert" z={16} /><span>{err}</span></div>}
        <form id="auth-form" autoComplete="on" onSubmit={submit}>
          {isReg && (
            <div className="auth-field"><label>Full Name</label>
              <div className="auth-input-box"><span className="auth-field-icon"><Ic n="user" z={18} /></span><input id="an" name="name" autoComplete="name" placeholder="John Doe" value={f.name} onChange={e => set('name', e.target.value)} /></div></div>
          )}
          <div className="auth-field"><label>Email Address</label>
            <div className="auth-input-box"><span className="auth-field-icon"><Ic n="mail" z={18} /></span>
              <input id="ae" name={isReg ? 'email' : 'username'} type="email" autoComplete={isReg ? 'email' : 'username'} placeholder="name@domain.com" value={f.email} onChange={e => set('email', e.target.value)} /></div></div>
          <div className="auth-field"><label><span>Password</span></label>
            <div className="auth-input-box"><span className="auth-field-icon"><Ic n="lock" z={18} /></span>
              <input id="ap" name="password" type={showPw ? 'text' : 'password'} autoComplete={isReg ? 'new-password' : 'current-password'} placeholder="Enter password" value={f.password} onChange={e => set('password', e.target.value)} />
              <button type="button" className="pw-toggle-btn" onClick={() => setShowPw(v => !v)} aria-label="Toggle password view" aria-pressed={showPw}><span><Ic n={showPw ? 'eyeOff' : 'eye'} z={18} /></span></button></div></div>
          {!isReg && <label className="auth-remember-login"><input id="remember-login" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span>Remember me on this device</span></label>}
          {isReg && <>
            <div className="auth-field"><label>Vehicle type <span style={{ color: '#64748b', fontWeight: 400 }}>(if you drive)</span></label>
              <div className="auth-sub-toggle" style={{ marginBottom: 0 }}>
                {Object.entries(VEHICLES).map(([k, v]) => <button type="button" key={k} className={'auth-sub-btn ' + (f.vtype === k ? 'active' : '')} onClick={() => set('vtype', k)}><Veh t={k} z={16} /> {v.label}</button>)}
              </div></div>
            <div className="auth-field"><label>Vehicle Model &amp; Registration <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional if not driving)</span></label>
              <div className="auth-input-box"><span className="auth-field-icon"><Ic n="car" z={18} /></span><input id="av" name="car" autoComplete="off" placeholder="e.g. Honda City · KA01 AB 1234" value={f.car} onChange={e => set('car', e.target.value)} /></div></div>
          </>}
          <button type="submit" className="auth-action-btn" disabled={loading}>
            <span>{loading ? 'Signing in...' : isReg ? 'Create Account' : isAdmin ? 'Access Admin Console' : 'Sign In'}</span><Ic n="arrowRight" z={18} />
          </button>
        </form>
        {!isAdmin ? (
          <div className="auth-bottom-link">{isReg ? <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setReg(false); setErr(''); }}>Sign In</a></> : <>New to UrbanRide? <a href="#" onClick={e => { e.preventDefault(); setReg(true); setErr(''); }}>Create an account</a></>}</div>
        ) : (
          <div className="auth-bottom-link">Commuter or driver? <a href="#" onClick={e => { e.preventDefault(); pick('user'); }}>Switch to User Sign In</a></div>
        )}
      </div>
    </div>
  );
}
