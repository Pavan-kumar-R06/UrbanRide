async function register(){
  const n = $('an').value.trim();
  const e = $('ae').value.trim().toLowerCase();
  const p = $('ap').value;
  const c = $('av') ? $('av').value.trim() : '';

  if (!n || !e.includes('@') || p.length < 6) {
    S.err = 'Enter full name, valid email, and 6+ character password.';
    return render();
  }

  S.loading = true;
  render();

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, email: e, password: p, car: c })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const u = data.user;
      const uid = u.id || u._id || String(nid++);
      u.id = uid;
      storeAuthSession(data.token, u);
      S.isDataActive = true;
      const existing = users.find(x => x.email === e || x.id === uid);
      if (existing) {
        Object.assign(existing, u);
      } else {
        users.push(u);
      }
      if (c) {
        setCar(u, c);
      }
      S.err = '';
      S.reg = 0;
      S.view = 'find';
      S.loading = false;
      logEv('New user registered: ' + n + (c ? ' (Vehicle: ' + c + ')' : ''));
      toast('Welcome to UrbanRide, ' + n + '!' + (c ? ' Vehicle submitted for Admin verification.' : ''));
      render();
      return;
    } else {
      S.err = data.error || 'Unable to create the account.';
      S.loading = false;
      render();
      return;
    }
  } catch (netErr) {
    S.err = 'Could not connect to the authentication service.';
    S.loading = false;
    render();
    return;
  }
}

function setCar(u, c){
  const carModel = typeof c === 'string' ? c : (c.m || c.name);
  u.car = { m: carModel, st: 'pending' };
  const inVq = vq.find(v => v.uid == u.id && v.name == carModel);
  if (!inVq) {
    vq.unshift({ name: carModel, owner: u.name, st: 'pending', uid: u.id });
  }
}
async function addCar(){
  const input=$('cm'),m=input&&input.value.trim();
  if(!m)return toast('Enter your car model and registration number.');
  try{
    const updated=await apiRequest('/users/'+encodeURIComponent(S.me.id),{method:'PUT',body:{car:{m,st:'pending'}}});
    S.me.car=updated.car;
    setCar(S.me,m);
    toast('Vehicle submitted for admin verification.');
    render();
  }catch(err){toast(err.message || 'Vehicle could not be registered.')}
}
function logout(){
  if(S.locationWatchId!==null)void stopLocationSharing();
  clearAuthSession();
  S.res=null;
  toast('Logged out successfully.');
  render();
}
