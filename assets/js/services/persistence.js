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
  const button=method!=='GET'&&!path.endsWith('/location')?document.activeElement?.closest('button'):null;
  const wasDisabled=button&&button.disabled;
  if(button&&!wasDisabled){
    button.disabled=true;
    button.setAttribute('aria-busy','true');
  }
  try{
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
  }finally{
    if(button&&!wasDisabled){
      button.disabled=false;
      button.removeAttribute('aria-busy');
    }
  }
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
    S.isDataActive = true;
    sessionStorage.setItem(KEY + 'm', S.me.id);
    S.view = S.me.role === 'admin' ? 'ana' : 'find';
    render();
    const syncTasks=[syncDatabaseData()];
    if(S.me.role==='admin')syncTasks.push(syncAdminData());
    else void refreshMessageNotifications();
    await Promise.all(syncTasks);
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
  localRecords.sort((a,b)=>new Date(b.createdAt||b.ts||0)-new Date(a.createdAt||a.ts||0));
  return changed;
}

async function refreshMessageNotifications(){
  if(!S.me||S.me.role==='admin'||!S.isDataActive)return;
  const userId=String(S.me.id),storageKey='urbanride_message_sync_'+userId;
  const storedAfter=Number(localStorage.getItem(storageKey));
  const after=Number.isFinite(storedAfter)&&storedAfter>0?storedAfter:Date.now()-300000;
  const nextAfter=Date.now();
  try{
    const incoming=await apiRequest('/messages/inbox?after='+encodeURIComponent(after));
    if(!S.me||String(S.me.id)!==userId)return;
    let added=0;
    incoming.forEach(message=>{
      const messageId=String(message._id||message.id);
      if(notes.some(note=>String(note.messageId||'')===messageId))return;
      const threadId=String(message.rid),openNow=S.view==='chat'&&String(S.th)===threadId;
      notes.unshift({
        id:nid++,uid:userId,t:'New message from '+message.n+': '+message.t,
        from:message.n,go:'chat',threadId,messageId,read:openNow,
        ts:new Date(message.createdAt||nextAfter).getTime(),tm:message.tm
      });
      added++;
      if(!msgs.some(item=>String(item._id||item.id)===messageId))msgs.push(message);
    });
    localStorage.setItem(storageKey,String(nextAfter));
    if(added){
      save();
      render();
      if(!incoming.every(message=>S.view==='chat'&&String(S.th)===String(message.rid)))toast(added===1?'New message from '+incoming[0].n:added+' new messages');
    }
  }catch(err){console.warn('Message notifications could not be refreshed:',err.message)}
}

async function refreshSharedRideData(){
  if(!S.me||!S.isDataActive||sharedDataSyncing)return;
  sharedDataSyncing=true;
  try{
    const needsBookings=['drive','bookings'].includes(S.view);
    const requests=[apiRequest('/rides')];
    if(needsBookings)requests.push(apiRequest('/bookings'));
    const [storedRides,storedBookings=[]]=await Promise.all(requests);
    const previousStatuses=new Map(rides.map(ride=>[String(ride.id),ride.status]));
    const changed=mergeRemoteRecords(rides,storedRides,['status','prog','seats','rt','location','startedAt','estimatedDurationMinutes'])|
      mergeRemoteRecords(bookings,storedBookings,['st','rated','seats','fare']);
    if(S.gpsRideId&&rides.some(ride=>String(ride.id)===String(S.gpsRideId)&&ride.status==='completed')){
      stopLocationSharing(false);
    }
    if(changed){
      save();
      if(['drive','bookings'].includes(S.view))render();
      else if(S.view==='live'){
        const statusChanged=rides.some(ride=>previousStatuses.has(String(ride.id))&&previousStatuses.get(String(ride.id))!==ride.status);
        if(statusChanged)render();
        else updateLiveRideProgress();
      }
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
    const updated=await apiRequest('/rides/' + ride._id, { method: 'PUT', body: changes });
    Object.assign(ride,updated,{id:String(updated._id||ride.id),_id:String(updated._id||ride._id)});
    return updated;
  } catch (err) {
    console.error('Ride update was not saved:', err.message);
    toast('Ride update could not be saved.');
    return null;
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

function startLocationSharing(rideId){
  if(!navigator.geolocation)return toast('This browser cannot share GPS location.');
  if(S.locationWatchId!==null&&String(S.gpsRideId)===String(rideId))return;
  stopLocationSharing(false);
  S.gpsRideId=String(rideId);
  S.locationWatchId=navigator.geolocation.watchPosition(async position=>{
    const now=Date.now();
    if(now-S.lastLocationSent<3000)return;
    S.lastLocationSent=now;
    const ride=rides.find(item=>String(item.id)===String(rideId));
    if(!ride)return;
    const location={lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,updatedAt:new Date().toISOString()};
    ride.location=location;
    try{
      const result=await apiRequest('/rides/'+encodeURIComponent(String(rideId))+'/location',{method:'PUT',body:location});
      ride.location=result.location||null;
      if(result.status)ride.status=result.status;
      if(result.completedAt)ride.completedAt=result.completedAt;
      if(ride.status==='completed'){
        ride.prog=1;
        stopLocationSharing(false);
        toast('Trip completed at the destination.');
      }
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