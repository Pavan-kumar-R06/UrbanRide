import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, TOKEN_KEY, REMEMBERED_EMAIL_KEY, setUnauthorizedHandler } from '../lib/api';
import { norm, today } from '../lib/format';
import { clearCache, prefetch } from '../lib/useCachedApi';
import { P, rn, rt3, nm, priceFor, km } from '../lib/cityGraph';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
const LIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'waitlisted', 'promoting'];

export function AppProvider({ children }) {
  /* ---------------- core state ---------------- */
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(!!localStorage.getItem(TOKEN_KEY));
  const [view, setView] = useState('find');
  const [rides, setRides] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [msgNotes, setMsgNotes] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [disruptions, setDisruptions] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [thread, setThread] = useState(0);
  const [preview, setPreview] = useState(0);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosRide, setSosRide] = useState(null);
  const [gpsRideId, setGpsRideId] = useState(null);
  const [map, setMap] = useState({ z: 1, cx: 50, cy: 50, lay: { metro: 1, road: 1 }, big: 0, heat: 0 });
  const [, tick] = useState(0);
  const rerender = () => tick(n => n + 1);

  /* always-fresh references for timers and async handlers */
  const R = useRef({});
  R.current = { me, view, rides, bookings, msgs, thread, gpsRideId };
  const seenNotes = useRef(new Set()), watchRef = useRef(null), lastSent = useRef(0), syncing = useRef(false);

  const toast = useCallback(t => {
    const id = Math.random().toString(36).slice(2);
    setToasts(l => [...l, { id, t }]);
    setTimeout(() => setToasts(l => l.filter(x => x.id !== id)), 2800);
  }, []);
  const confirmDialog = useCallback((title, message, okLabel = 'Delete') => new Promise(resolve => setDialog({ title, message, okLabel, resolve })), []);
  const go = useCallback(v => { setView(v); }, []);
  const toggleMap = patch => setMap(m => ({ ...m, ...(typeof patch === 'function' ? patch(m) : patch) }));

  /* ---------------- derived notifications ---------------- */
  const notes = msgNotes; // only unread chat messages are tracked now (for the Messages badge)

  /* ---------------- loading ---------------- */
  const syncData = useCallback(async () => {
    try {
      const [r, b] = await Promise.all([api('/rides'), api('/bookings')]);
      setRides(r.map(norm)); setBookings(b.map(norm));
    } catch (e) { console.warn('Could not sync trip data:', e.message); }
  }, []);
  /* System alerts (disruptions, refunds, hand-overs…) are shown as toasts now that there is no Notifications page. */
  const syncNotes = useCallback(async () => {
    try {
      const list = (await api('/notifications')).map(norm).filter(n => !n.read);
      if (!list.length) return;
      const fresh = list.filter(n => !seenNotes.current.has(n.id));
      fresh.forEach(n => seenNotes.current.add(n.id));
      fresh.slice(0, 3).forEach(n => toast(n.t));
      if (fresh.length > 3) toast(`+${fresh.length - 3} more updates`);
      api('/notifications/read', { method: 'PUT', body: {} }).catch(() => {});
    } catch (e) { /* ignore */ }
  }, [toast]);
  const syncAdmin = useCallback(async () => {
    try {
      const [u, i, n, d] = await Promise.all([api('/users'), api('/incidents'), api('/networks'), api('/disruptions')]);
      setUsers(u.map(x => ({ ...x, id: String(x._id || x.id), car: x.car && x.car.m ? x.car : null, blocked: !!x.blocked })));
      setIncidents(i); setNetworks(n.map(norm)); setDisruptions(d.map(norm));
    } catch (e) { console.warn('Admin data could not be refreshed:', e.message); }
  }, []);
  const syncNetworks = useCallback(async () => {
    try { setNetworks((await api('/networks')).map(norm)); } catch (e) { /* ignore */ }
  }, []);

  const refreshMessageNotifications = useCallback(async () => {
    const m = R.current.me;
    if (!m || m.role === 'admin') return;
    const uid = String(m.id), key = 'urbanride_message_sync_' + uid;
    const stored = Number(localStorage.getItem(key));
    const after = Number.isFinite(stored) && stored > 0 ? stored : Date.now() - 300000;
    const nextAfter = Date.now();
    try {
      const incoming = await api('/messages/inbox?after=' + encodeURIComponent(after));
      if (!R.current.me || String(R.current.me.id) !== uid) return;
      const fresh = [];
      incoming.forEach(message => {
        const messageId = String(message._id || message.id);
        const openNow = R.current.view === 'chat' && String(R.current.thread) === String(message.rid);
        fresh.push({ id: 'm' + messageId, messageId, t: 'New message from ' + message.n + ': ' + message.t, from: message.n, go: 'chat', threadId: String(message.rid), read: openNow, ts: new Date(message.createdAt || nextAfter).getTime() });
      });
      localStorage.setItem(key, String(nextAfter));
      if (fresh.length) {
        setMsgNotes(prev => { const have = new Set(prev.map(x => x.id)); return [...fresh.filter(x => !have.has(x.id)), ...prev]; });
        setMsgs(prev => { const have = new Set(prev.map(x => String(x._id))); return [...prev, ...incoming.filter(x => !have.has(String(x._id)))]; });
        if (!incoming.every(x => R.current.view === 'chat' && String(R.current.thread) === String(x.rid))) toast(fresh.length === 1 ? 'New message from ' + incoming[0].n : fresh.length + ' new messages');
      }
    } catch (e) { /* ignore */ }
  }, [toast]);

  const loadAfterLogin = useCallback(async u => {
    const jobs = [syncData(), syncNotes()];
    // warm the two data-heavy pages in the background so they open instantly
    if (u.role === 'admin') { prefetch('/analytics/heatmap?range=7d&vtype=all'); prefetch('/analytics/advanced?range=7d'); jobs.push(syncAdmin()); } else { prefetch('/wallet'); jobs.push(syncNetworks()); void refreshMessageNotifications(); }
    await Promise.all(jobs);
  }, [syncData, syncNotes, syncAdmin, syncNetworks, refreshMessageNotifications]);

  /* ---------------- auth ---------------- */
  const clearSession = useCallback(() => {
    clearCache();
    localStorage.removeItem(TOKEN_KEY);
    setMe(null); setRides([]); setBookings([]); setUsers([]); setIncidents([]); setMsgNotes([]); setMsgs([]); setNetworks([]); setDisruptions([]);
  }, []);
  useEffect(() => { setUnauthorizedHandler(() => { clearCache(); setMe(null); }); }, []);

  useEffect(() => {
    (async () => {
      if (!localStorage.getItem(TOKEN_KEY)) { setBooting(false); return; }
      try {
        const { user } = await api('/auth/me');
        setMe(user); setView(user.role === 'admin' ? 'ana' : 'find'); setBooting(false);
        await loadAfterLogin(user);
      } catch (e) { clearSession(); setBooting(false); }
    })();
    // eslint-disable-next-line
  }, []);

  const login = async ({ email, password, asAdmin, remember, form }) => {
    clearCache();
    const data = await api('/auth/login', { method: 'POST', body: { email, password, asAdmin } });
    if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email); else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    if (remember && form && window.PasswordCredential && navigator.credentials?.store) { try { await navigator.credentials.store(new window.PasswordCredential(form)); } catch (e) { /* ignore */ } }
    localStorage.setItem(TOKEN_KEY, data.token);
    setMe(data.user); setView(data.user.role === 'admin' ? 'ana' : 'find');
    toast('Welcome back, ' + (data.user.name ? data.user.name.split(' ')[0] : 'User') + '!');
    void loadAfterLogin(data.user);
  };
  const register = async body => {
    clearCache();
    const data = await api('/auth/register', { method: 'POST', body });
    localStorage.setItem(TOKEN_KEY, data.token);
    setMe(data.user); setView('find');
    toast('Welcome to UrbanRide, ' + data.user.name + '!' + (body.vehicle || body.car ? ' Vehicle submitted for Admin verification.' : '') + ' ₹500 welcome credit added to your wallet.');
    void loadAfterLogin(data.user);
  };
  const refreshMe = useCallback(async () => { try { const { user } = await api('/auth/me'); setMe(user); return user; } catch (e) { return null; } }, []);

  /* ---------------- GPS sharing (driver) ---------------- */
  const stopLocationSharing = useCallback(async (clearRemote = true) => {
    const id = R.current.gpsRideId;
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null; setGpsRideId(null); lastSent.current = 0;
    if (id && clearRemote) {
      setRides(l => l.map(r => r.id === id ? { ...r, location: undefined } : r));
      try { await api('/rides/' + encodeURIComponent(id) + '/location', { method: 'DELETE' }); } catch (e) { toast(e.message || 'Could not clear the shared location.'); }
    }
  }, [toast]);
  const startLocationSharing = rideId => {
    if (!navigator.geolocation) return toast('This browser cannot share GPS location.');
    if (watchRef.current !== null && String(R.current.gpsRideId) === String(rideId)) return;
    stopLocationSharing(false);
    setGpsRideId(String(rideId));
    watchRef.current = navigator.geolocation.watchPosition(async pos => {
      const nowMs = Date.now();
      if (nowMs - lastSent.current < 3000) return;
      lastSent.current = nowMs;
      const location = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, updatedAt: new Date().toISOString() };
      setRides(l => l.map(r => r.id === String(rideId) ? { ...r, location } : r));
      try {
        const result = await api('/rides/' + encodeURIComponent(String(rideId)) + '/location', { method: 'PUT', body: location });
        setRides(l => l.map(r => r.id === String(rideId) ? { ...r, location: result.location || null, status: result.status || r.status, completedAt: result.completedAt || r.completedAt, prog: result.status === 'completed' ? 1 : r.prog } : r));
        if (result.status === 'completed') { stopLocationSharing(false); toast('Trip completed at the destination.'); }
      } catch (e) { toast(e.message || 'GPS location could not be shared.'); stopLocationSharing(false); }
    }, error => {
      toast({ 1: 'Allow location access in your browser to share your ride position.', 2: 'Your current position could not be determined.', 3: 'GPS request timed out. Try sharing again.' }[error.code] || 'GPS location is unavailable.');
      stopLocationSharing(false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    toast('Location sharing started.');
  };
  const logout = () => { if (watchRef.current !== null) void stopLocationSharing(); clearSession(); toast('Logged out successfully.'); };

  /* ---------------- helpers ---------------- */
  const activeJourneyForUser = excludeRideId => {
    const { me: m, rides: rs, bookings: bs } = R.current;
    if (!m) return null;
    const active = ['boarding', 'active'];
    return rs.find(r => String(r.own) === String(m.id) && String(r.id) !== String(excludeRideId) && active.includes(r.status)) ||
      rs.find(r => String(r.id) !== String(excludeRideId) && active.includes(r.status) && bs.some(b => String(b.rid) === String(r.id) && String(b.pid) === String(m.id) && b.st === 'confirmed' && !b.tripCompletedAt)) || null;
  };
  const patchRide = (id, patch) => setRides(l => l.map(r => String(r.id) === String(id) ? { ...r, ...patch } : r));
  const patchBooking = (id, patch) => setBookings(l => l.map(b => String(b.id) === String(id) ? { ...b, ...patch } : b));
  const recordSearch = useCallback((q, results) => { api('/demand', { method: 'POST', body: { f: q.f, t: q.t, time: q.time, vtype: q.vtype || 'all', seats: q.seats, results } }).catch(() => {}); }, []);

  /* ---------------- ride & booking actions ---------------- */
  const book = async (rid, f, t, fare, n, fee = 0) => {
    if (activeJourneyForUser()) return toast('Complete your current trip before booking another ride.');
    try {
      const stored = await api('/bookings', { method: 'POST', body: { rid: String(rid), f, t, fare, fee, seats: n } });
      const b = norm(stored);
      setBookings(l => [b, ...l]);
      await syncData(); await refreshMe();
      toast(b.st === 'waitlisted' ? 'Ride is full. You joined the waitlist.' : 'Seat requested. Driver notified!');
      setView('bookings');
    } catch (e) { toast(e.message || 'Booking could not be saved. Please try again.'); }
  };
  const cancelB = async id => {
    try {
      await api('/bookings/' + id, { method: 'PUT', body: { st: 'cancelled' } });
      toast('Booking cancelled.'); await syncData(); await refreshMe(); await syncNotes();
    } catch (e) { toast(e.message); }
  };
  const decide = async (id, ok) => {
    try {
      await api('/bookings/' + id, { method: 'PUT', body: { st: ok ? 'confirmed' : 'rejected' } });
      toast(ok ? 'Passenger accepted!' : 'Request declined.'); await syncData();
    } catch (e) { toast(e.message); }
  };
  const step = async id => {
    const r = R.current.rides.find(x => x.id === String(id));
    const n = { scheduled: 'boarding', boarding: 'active', active: 'completed' }[r.status];
    if (['boarding', 'active'].includes(n) && activeJourneyForUser(r.id)) return toast('Complete your other trip before starting this ride.');
    if (n === 'completed' && String(R.current.gpsRideId) === String(r.id)) void stopLocationSharing();
    try {
      const updated = await api('/rides/' + r.id, { method: 'PUT', body: { status: n, prog: n === 'completed' ? 1 : r.prog } });
      patchRide(r.id, norm(updated)); toast('Ride status: ' + n);
      await Promise.all([syncData(), syncNotes(), refreshMe()]);
    } catch (e) { toast(e.message || 'Ride update could not be saved.'); }
  };
  const rateRide = async (bid, rid, stars) => {
    try {
      await api('/bookings/' + bid, { method: 'PUT', body: { rated: stars } });
      const r = R.current.rides.find(x => x.id === String(rid));
      toast(`Thank you! You rated ${r ? r.drv : 'driver'} ${stars} ★.`); await syncData();
    } catch (e) { toast(e.message); }
  };
  const cancelRide = async id => {
    if (String(R.current.gpsRideId) === String(id)) await stopLocationSharing();
    try { await api('/rides/' + id, { method: 'PUT', body: { status: 'cancelled' } }); toast('Ride cancelled. Passengers notified.'); await Promise.all([syncData(), syncNotes()]); }
    catch (e) { toast(e.message); }
  };
  const publish = async cr => {
    if (activeJourneyForUser()) return toast('Complete your current trip before publishing another ride.');
    if (cr.f === cr.t) return toast('Choose different start and end points.');
    const path = rt3(cr.f, cr.via, cr.t);
    try {
      await api('/rides', { method: 'POST', body: { path, time: cr.time, date: cr.date, cap: cr.seats, seats: cr.seats, rate: cr.rate, pf: cr.pf, rep: cr.rep, note: cr.note, networkId: cr.networkId || undefined } });
      toast('Ride published.'); await syncData(); setView('drive');
    } catch (e) { toast(e.message || 'Ride could not be published. Please try again.'); }
  };
  const canDeleteRide = r => {
    if (!r || String(r.own) !== String(R.current.me?.id)) return false;
    if (['boarding', 'active'].includes(r.status)) return false;
    if (r.status === 'scheduled') return !R.current.bookings.some(b => String(b.rid) === String(r.id) && LIVE_BOOKING_STATUSES.includes(b.st));
    return true;
  };
  const removeRideLocal = ids => {
    const gone = new Set(ids.map(String));
    setRides(l => l.filter(r => !gone.has(String(r.id)))); setBookings(l => l.filter(b => !gone.has(String(b.rid)))); setMsgs(l => l.filter(m => !gone.has(String(m.rid))));
  };
  const deleteMyRide = async id => {
    const ride = R.current.rides.find(r => String(r.id) === String(id));
    if (!ride) return toast('Ride not found.');
    if (!canDeleteRide(ride)) return toast('Cancel the ride first (or wait until it finishes) before deleting it.');
    const detail = ride.status === 'completed' ? 'This permanently removes the ride, its passenger history, earnings, and messages.' : 'This permanently removes the ride, its bookings, and messages.';
    if (!await confirmDialog('Delete this ride?', <><b>{rn(ride.path)}</b><br />{detail}</>)) return;
    try { await api('/rides/' + encodeURIComponent(id), { method: 'DELETE' }); removeRideLocal([id]); toast('Ride deleted.'); } catch (e) { toast(e.message || 'Ride could not be deleted.'); }
  };
  const sos = async ({ type, details, location }) => {
    if (!type) return toast('Choose the type of emergency.');
    if (!details) return toast('Describe what is happening before sending the report.');
    try {
      const inc = await api('/incidents', { method: 'POST', body: { type, details, location, rideId: sosRide ? String(sosRide) : '' } });
      setIncidents(l => [inc, ...l]); setSosOpen(false); toast('Emergency report sent to the admin team.');
    } catch (e) { toast(e.message || 'Emergency report could not be sent.'); }
  };
  const completePassengerSegment = useCallback(async booking => {
    try {
      const done = await api('/bookings/' + encodeURIComponent(booking.id) + '/complete-leg', { method: 'POST', body: {} });
      setBookings(l => l.map(b => b.id === booking.id ? { ...b, ...norm(done) } : b));
      toast('You reached your drop-off point.');
      syncNotes();
    } catch (e) { if (!String(e.message).includes('has not been reached')) console.warn(e.message); }
  }, [toast, syncNotes]);

  /* ---------------- chat ---------------- */
  const openChatThread = id => {
    setThread(String(id));
    setMsgNotes(l => l.map(n => String(n.threadId) === String(id) ? { ...n, read: true } : n));
    setView('chat');
  };
  const send = async text => {
    const r = R.current.rides.find(x => String(x.id) === String(R.current.thread));
    if (!r || !text) return false;
    try {
      const stored = await api('/messages/' + encodeURIComponent(r.id), { method: 'POST', body: { text } });
      setMsgs(l => [...l, { ...stored, rid: String(stored.rid), uid: String(stored.uid), id: String(stored._id) }]);
      return true;
    } catch (e) { toast('Message could not be sent. Please try again.'); return false; }
  };

  /* ---------------- vehicle ---------------- */
  const addVehicle = async vehicle => {
    try {
      const updated = await api('/users/' + encodeURIComponent(me.id), { method: 'PUT', body: { car: vehicle } });
      setMe(m => ({ ...m, car: updated.car })); toast('Vehicle submitted for admin verification.');
    } catch (e) { toast(e.message || 'Vehicle could not be registered.'); }
  };

  /* ---------------- admin actions ---------------- */
  const blk = async id => {
    const u = users.find(x => String(x.id) === String(id)); if (!u) return;
    try { const upd = await api('/users/' + encodeURIComponent(id), { method: 'PUT', body: { blocked: !u.blocked } }); setUsers(l => l.map(x => x.id === u.id ? { ...x, blocked: upd.blocked } : x)); toast('User updated.'); } catch (e) { toast(e.message); }
  };
  const vset = async (uid, status, extra = {}) => {
    const u = users.find(x => x.id == uid); if (!u || !u.car) return toast('User not found.');
    try {
      const upd = await api('/users/' + u.id, { method: 'PUT', body: { car: { st: status, ...extra } } });
      setUsers(l => l.map(x => x.id === u.id ? { ...x, car: upd.car } : x)); toast('Vehicle ' + status + ' for ' + u.name + '.');
    } catch (e) { toast(e.message || 'Failed to update vehicle.'); }
  };
  const resolveIncident = async (id, resolution, resolutionNote) => {
    if (!resolution) return toast('Choose a resolution before closing this report.');
    try { const inc = await api('/incidents/' + encodeURIComponent(id), { method: 'PUT', body: { resolution, resolutionNote } }); setIncidents(l => l.map(x => String(x._id) === String(id) ? { ...x, ...inc } : x)); toast('Resolution saved.'); } catch (e) { toast(e.message); }
  };
  const deleteAdminUser = async id => {
    const user = users.find(x => String(x.id) === String(id)); if (!user) return toast('User not found.');
    if (!await confirmDialog('Delete this user?', <><b>{user.name}</b><br />This permanently removes their rides, bookings, and ride messages. Emergency reports are kept for audit.</>, 'Delete user')) return;
    try {
      const result = await api('/users/' + encodeURIComponent(id), { method: 'DELETE' });
      setUsers(l => l.filter(x => String(x.id) !== String(id))); removeRideLocal(result.rideIds || []);
      setBookings(l => l.filter(b => String(b.pid) !== String(id))); toast('User and related records deleted.');
    } catch (e) { toast(e.message); }
  };
  const deleteAdminRide = async id => {
    const ride = R.current.rides.find(x => String(x.id) === String(id)); if (!ride) return toast('Ride not found.');
    if (!await confirmDialog('Delete this ride?', <><b>{rn(ride.path)}</b><br />This permanently removes the ride, its bookings, and messages.</>)) return;
    try { await api('/rides/' + encodeURIComponent(id), { method: 'DELETE' }); removeRideLocal([id]); toast('Ride and related records deleted.'); } catch (e) { toast(e.message); }
  };

  /* ---------------- polling ---------------- */
  useEffect(() => {
    if (!me) return;
    const timers = [];
    timers.push(setInterval(async () => {
      const { view: v, thread: th } = R.current;
      if (!['live', 'drive', 'bookings', 'chat', 'find'].includes(v) || syncing.current) return;
      syncing.current = true;
      try {
        await syncData();
        if (v === 'chat' && th) {
          const list = await api('/messages/' + encodeURIComponent(String(th)));
          setMsgs(prev => { const have = new Set(prev.map(m => String(m._id))); const add = list.filter(m => !have.has(String(m._id))); return add.length ? [...prev, ...add] : prev; });
        }
      } finally { syncing.current = false; }
    }, 2000));
    timers.push(setInterval(() => { if (R.current.me?.role !== 'admin') refreshMessageNotifications(); syncNotes(); }, 5000));
    timers.push(setInterval(() => { if (['live'].includes(R.current.view)) rerender(); }, 1000));
    timers.push(setInterval(() => { if (R.current.me?.role === 'admin' && ['ana', 'users', 'rides', 'inc', 'ver', 'nets', 'disr'].includes(R.current.view)) { syncData(); syncAdmin(); } }, 30000));
    return () => timers.forEach(clearInterval);
  }, [me, syncData, syncNotes, syncAdmin, refreshMessageNotifications]);

  /* admin lists are loaded when entering an admin page */
  useEffect(() => { if (me?.role === 'admin' && ['users', 'ver', 'ana', 'inc', 'nets', 'disr', 'rides'].includes(view)) syncAdmin(); }, [view]); // eslint-disable-line
  useEffect(() => { if (me && me.role !== 'admin' && view === 'networks') syncNetworks(); }, [view]); // eslint-disable-line
  useEffect(() => { const h = e => { if (e.key === 'Escape') setMap(m => m.big ? { ...m, big: 0 } : m); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, []);

  const value = {
    me, setMe, booting, view, go, rides, bookings, users, incidents, notes, msgs, networks, disruptions, map, toggleMap,
    thread, setThread, preview, setPreview, sosOpen, setSosOpen, sosRide, setSosRide, gpsRideId, toasts, dialog, setDialog,
    toast, confirmDialog, login, register, logout, refreshMe, syncData, syncNotes, syncAdmin, syncNetworks, activeJourneyForUser,
    startLocationSharing, stopLocationSharing, book, cancelB, decide, step, rateRide, cancelRide, publish, canDeleteRide, deleteMyRide,
    sos, completePassengerSegment, openChatThread, send, addVehicle, blk, vset, resolveIncident,
    deleteAdminUser, deleteAdminRide, recordSearch, patchBooking
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
