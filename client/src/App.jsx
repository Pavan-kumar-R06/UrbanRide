import { AppProvider, useApp } from './state/AppContext';
import AuthPage from './components/AuthPage';
import { Brand, Ic } from './components/Icons';
import { Av, Tag, Toasts, Dialog } from './components/ui';
import Track from './pages/Track';
import Find from './pages/user/Find';
import Bookings from './pages/user/Bookings';
import Live from './pages/user/Live';
import Offer from './pages/user/Offer';
import Drive from './pages/user/Drive';
import Chat from './pages/user/Chat';
import Profile from './pages/user/Profile';
import Wallet from './pages/user/Wallet';
import Networks from './pages/user/Networks';
import Ana from './pages/admin/Ana';
import Heat from './pages/admin/Heat';
import Users from './pages/admin/Users';
import Rides from './pages/admin/Rides';
import Inc from './pages/admin/Inc';
import Ver from './pages/admin/Ver';
import Nets from './pages/admin/Nets';
import Disr from './pages/admin/Disr';

const UNAV = ['Ride', ['find', 'search', 'Find rides'], ['bookings', 'ticket', 'My bookings'], ['live', 'pin', 'Trip status'], 'Drive', ['offer', 'car', 'Offer a ride'], ['drive', 'compass', 'Driver hub'], 'Community', ['networks', 'building', 'Networks'], ['wallet', 'wallet', 'Mobility wallet'], 'Account', ['chat', 'chat', 'Messages'], ['profile', 'user', 'Profile']];
const ANAV = ['Admin', ['ana', 'chart', 'Analytics'], ['heat', 'flame', 'Demand heatmap'], ['users', 'users', 'Users'], ['rides', 'car', 'Rides'], ['inc', 'alert', 'Incidents'], ['ver', 'check', 'Verification'], 'Operations', ['nets', 'building', 'Networks'], ['disr', 'route', 'Disruptions']];
const VIEWS = { find: Find, bookings: Bookings, live: Live, offer: Offer, drive: Drive, chat: Chat, profile: Profile, wallet: Wallet, networks: Networks, ana: Ana, heat: Heat, users: Users, rides: Rides, inc: Inc, ver: Ver, nets: Nets, disr: Disr };

function Shell() {
  const { me, booting, view, go, rides, bookings, notes, logout, toasts, dialog, setDialog } = useApp();
  if (booting) return <><div style={{ minHeight: '100vh' }} /><Toasts toasts={toasts} /></>;
  if (!me) return <><AuthPage /><Toasts toasts={toasts} /><Dialog dialog={dialog} setDialog={setDialog} /></>;
  const nav = me.role === 'admin' ? ANAV : UNAV;
  const pend = bookings.filter(b => rides.some(r => r.id == b.rid && r.own == me.id) && b.st == 'pending').length;
  const unreadM = notes.filter(n => !n.read).length;
  const adminOk = me.role === 'admin', allowed = { ...VIEWS };
  const View = allowed[view] && (adminOk === ['ana', 'heat', 'users', 'rides', 'inc', 'ver', 'nets', 'disr'].includes(view)) ? allowed[view] : (adminOk ? Ana : Find);
  const badge = (key) => key === 'drive' && pend ? <> <Tag c="w">{pend}</Tag></> : key === 'chat' && unreadM ? <> <Tag c="b">{unreadM}</Tag></> : null;
  return (
    <>
      <div className="app">
        <aside>
          <div className="logo"><Brand z={30} /></div>
          {nav.map((x, i) => typeof x === 'string' ? <div key={i} className="ns">{x}</div> :
            <button key={x[0]} className={view == x[0] ? 'on' : ''} onClick={() => go(x[0])}><Ic n={x[1]} /><span>{x[2]}</span>{badge(x[0])}</button>)}
          <div className="me"><Av name={me.name} /><div style={{ flex: 1 }}><b>{me.name}</b><br /><span className="mu">{me.role}</span></div><button className="btn g s" onClick={logout}>Logout</button></div>
        </aside>
        <main><View /></main>
      </div>
      <Toasts toasts={toasts} /><Dialog dialog={dialog} setDialog={setDialog} />
    </>
  );
}

export default function App() {
  const m = window.location.pathname.match(/^\/track\/([a-f0-9]+)\/?$/i);
  if (m) return <Track token={m[1]} />;
  return <AppProvider><Shell /></AppProvider>;
}
