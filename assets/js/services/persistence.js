const TOKEN_KEY='urbanride_access_token';
const REMEMBERED_EMAIL_KEY='urbanride_remembered_email';
let sharedDataSyncing=false;
let myIncidentsSyncing=false;

function getRememberedEmail(){
  try{return localStorage.getItem(REMEMBERED_EMAIL_KEY)||''}catch(e){return ''}
}

async function rememberBrowserCredential(){
  const email=$('ae')&&$('ae').value.trim();
  const password=$('ap')&&$('ap').value;
  const remember=$('remember-login')&&$('remember-login').checked;
  try{
    if(!remember){localStorage.removeItem(REMEMBERED_EMAIL_KEY);return}
    if(email)localStorage.setItem(REMEMBERED_EMAIL_KEY,email);
  }catch(e){return}
  if(!email||!password||!window.PasswordCredential||!navigator.credentials?.store)return;
  try{
    await navigator.credentials.store(new PasswordCredential({id:email,password}));
  }catch(e){}
}

async function restoreBrowserCredential(){
  if(!window.PasswordCredential||!navigator.credentials?.get)return;
  try{
    const credential=await navigator.credentials.get({password:true,mediation:'optional'});
    if(!credential)return;
    if($('ae')&&!$('ae').value)$('ae').value=credential.id||'';
    if($('ap')&&!$('ap').value)$('ap').value=credential.password||'';
    if($('remember-login')&&credential.password){
      $('remember-login').checked=true;
      S.rememberLogin=true;
    }
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
    void restoreBrowserCredential();
    return;
  }

  try {
    const data = await apiRequest('/auth/me');
    S.me = data.user;
    S.isDataActive = true;
    sessionStorage.setItem(KEY + 'm', S.me.id);
    S.view = S.me.role === 'admin' ? 'ana' : 'find';
    render();
    await syncDatabaseData();
    if (S.me.role === 'admin') await syncAdminData();
    else void refreshMyIncidents();
  } catch (err) {
    clearAuthSession();
    render();
    void restoreBrowserCredential();
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
    const changed=mergeRemoteRecords(rides,storedRides,['status','prog','seats','rt','location'])|
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

async function refreshMyIncidents(){
  if(!S.me||S.me.role==='admin'||myIncidentsSyncing)return;
  const userId=String(S.me.id);
  myIncidentsSyncing=true;
  try{
    const updated=await apiRequest('/incidents/mine');
    if(!S.me||String(S.me.id)!==userId)return;
    const previous=new Map(myIncidents.map(incident=>[String(incident._id),incident.status]));
    myIncidents=updated;
    updated.forEach(incident=>{
      if(previous.get(String(incident._id))==='open'&&incident.status==='resolved'){
        toast('Emergency report resolved: '+incident.resolution.replaceAll('-',' ')+'.');
      }
    });
    if(S.view==='notif')render();
  }catch(err){console.warn('Emergency updates could not be refreshed:',err.message)}
  finally{myIncidentsSyncing=false}
}

function startLocationSharing(rideId){
  if(!navigator.geolocation)return toast('This browser cannot share GPS location.');
  if(S.locationWatchId!==null&&String(S.gpsRideId)===String(rideId))return;
  stopLocationSharing(false);
  S.gpsRideId=String(rideId);
  S.locationWatchId=navigator.geolocation.watchPosition(async position=>{
    const now=Date.now();
    if(now-S.lastLocationSent<8000)return;
    S.lastLocationSent=now;
    const ride=rides.find(item=>String(item.id)===String(rideId));
    if(!ride)return;
    const location={lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,updatedAt:new Date().toISOString()};
    ride.location=location;
    try{
      await apiRequest('/rides/'+encodeURIComponent(String(rideId))+'/location',{method:'PUT',body:location});
      if(S.view==='live')render();
    }catch(err){toast(err.message||'GPS location could not be shared.');stopLocationSharing(false)}
  },error=>{
    const messages={1:'Allow location access in your browser to share your ride position.',2:'Your current position could not be determined.',3:'GPS request timed out. Try sharing again.'};
    toast(messages[error.code]||'GPS location is unavailable.');
    stopLocationSharing(false);
  },{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
  toast('Location sharing started.');
  render();
}

async function stopLocationSharing(clearRemote=true){
  const rideId=S.gpsRideId;
  if(S.locationWatchId!==null)navigator.geolocation?.clearWatch(S.locationWatchId);
  S.locationWatchId=null;
  S.gpsRideId=null;
  S.lastLocationSent=0;
  if(rideId&&clearRemote){
    const ride=rides.find(item=>String(item.id)===String(rideId));
    if(ride)delete ride.location;
    try{await apiRequest('/rides/'+encodeURIComponent(rideId)+'/location',{method:'DELETE'})}
    catch(err){toast(err.message||'Could not clear the shared location.')}
  }
  if(S.me&&S.view==='live')render();
}