const TOKEN_KEY='urbanride_access_token';
const REMEMBERED_EMAIL_KEY='urbanride_remembered_email';
let sharedDataSyncing=false;

function getRememberedEmail(){
  try{return localStorage.getItem(REMEMBERED_EMAIL_KEY)||''}catch(e){return ''}
}

async function rememberBrowserCredential(){
  const email=$('ae')&&$('ae').value.trim();
  const remember=$('remember-login')&&$('remember-login').checked;
  if(!remember){localStorage.removeItem(REMEMBERED_EMAIL_KEY);return}
  if(email)localStorage.setItem(REMEMBERED_EMAIL_KEY,email);
  if(!email||!window.PasswordCredential||!navigator.credentials?.store)return;
  try{
    await navigator.credentials.store(new PasswordCredential($('auth-form')));
  }catch(e){}
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch('/api' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(KEY + 'm');
    S.me = null;
  }
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function storeAuthSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  S.me = user;
  sessionStorage.setItem(KEY + 'm', user.id);
}

function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(KEY + 'm');
  S.me = null;
}

async function restoreSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    S.me = null;
    render();
    return;
  }

  try {
    const data = await apiRequest('/auth/me');
    S.me = data.user;
    sessionStorage.setItem(KEY + 'm', S.me.id);
    S.view = S.me.role === 'admin' ? 'ana' : 'find';
    render();
    await syncDatabaseData();
    if (S.me.role === 'admin') await syncAdminData();
  } catch (err) {
    clearAuthSession();
    render();
  }
}

async function syncDatabaseData() {
  try {
    const [storedRides, storedBookings] = await Promise.all([
      apiRequest('/rides'),
      apiRequest('/bookings')
    ]);
    S.isDataActive = true;
    const rideIds = new Set(storedRides.map(ride => String(ride._id)));
    const bookingIds = new Set(storedBookings.map(booking => String(booking._id)));
    rides = [
      ...storedRides.map(ride => ({ ...ride, id: String(ride._id), _id: String(ride._id) })),
      ...rides.filter(ride => !ride._id && !rideIds.has(String(ride.id)))
    ];
    bookings = [
      ...storedBookings.map(booking => ({ ...booking, id: String(booking._id), _id: String(booking._id) })),
      ...bookings.filter(booking => !booking._id && !bookingIds.has(String(booking.id)))
    ];
    save();
    render();
  } catch (err) {
    S.isDataActive = false;
    console.warn('Could not sync saved trip data:', err.message);
  }
}

function mergeRemoteRecords(localRecords, remoteRecords, compareFields){
  let changed=false;
  remoteRecords.forEach(remote=>{
    const id=String(remote._id);
    const current=localRecords.find(record=>String(record._id||record.id)===id);
    const normalized={...remote,id,_id:id};
    if(!current){localRecords.push(normalized);changed=true;return}
    if(compareFields.some(field=>JSON.stringify(current[field])!==JSON.stringify(normalized[field])))changed=true;
    Object.assign(current,normalized);
  });
  return changed;
}

async function refreshSharedRideData(){
  if(!S.me||!S.isDataActive||sharedDataSyncing)return;
  sharedDataSyncing=true;
  try{
    const [storedRides,storedBookings]=await Promise.all([apiRequest('/rides'),apiRequest('/bookings')]);
    const changed=mergeRemoteRecords(rides,storedRides,['status','prog','seats','rt'])|
      mergeRemoteRecords(bookings,storedBookings,['st','rated','seats','fare']);
    if(changed){
      save();
      if(['live','drive','bookings'].includes(S.view))render();
    }
        if(S.view==='chat'&&S.th){
          const messages=await apiRequest('/messages/'+encodeURIComponent(String(S.th)));
          const messageIds=new Set(msgs.filter(message=>String(message.rid)===String(S.th)).map(message=>String(message._id||message.id)));
          let messagesChanged=false;
          messages.forEach(message=>{
            if(messageIds.has(String(message._id)))return;
            msgs.push(message);
            messagesChanged=true;
          });
          if(messagesChanged){save();render()}
        }
  }catch(err){
    if(!S.me)render();
    else console.warn('Live ride sync failed:',err.message);
  }finally{
    sharedDataSyncing=false;
  }
}

async function persistNewRide(ride) {
  try {
    const stored = await apiRequest('/rides', { method: 'POST', body: ride });
    ride.id = String(stored._id);
    ride._id = String(stored._id);
    return true;
  } catch (err) {
    if (S.isDataActive) throw err;
    return false;
  }
}

async function persistNewBooking(booking) {
  try {
    const stored = await apiRequest('/bookings', {
      method: 'POST',
      body: { ...booking, rid: String(booking.rid), pid: String(booking.pid) }
    });
    booking.id = String(stored._id);
    booking._id = String(stored._id);
    return true;
  } catch (err) {
    if (S.isDataActive) throw err;
    return false;
  }
}

async function persistRideChanges(ride, changes) {
  if (!S.isDataActive || !ride._id) return;
  try {
    await apiRequest('/rides/' + ride._id, { method: 'PUT', body: changes });
  } catch (err) {
    console.error('Ride update was not saved:', err.message);
    toast('Ride update could not be saved.');
  }
}

async function persistBookingChanges(booking, changes) {
  if (!S.isDataActive || !booking._id) return;
  try {
    await apiRequest('/bookings/' + booking._id, { method: 'PUT', body: changes });
  } catch (err) {
    console.error('Booking update was not saved:', err.message);
    toast('Booking update could not be saved.');
  }
}