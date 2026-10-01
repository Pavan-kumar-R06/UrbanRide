/* MONGODB API HOOKS                                                         */
/* ========================================================================= */
async function checkMongoStatus() {
  try {
    const data = await apiRequest('/status');
    S.isMongoActive = data.status === 'connected';
    render();
  } catch(e) {
    S.isMongoActive = false;
  }
}
checkMongoStatus();

async function login(){
  const e=$('ae').value.trim().toLowerCase(), p=$('ap').value;
  if (!e || !p) {
    S.err = 'Please enter both email and password.';
    return render();
  }

  S.loading = true;
  render();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, password: p, asAdmin: S.tab === 'admin' })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      S.err = data.error || 'Unable to sign in.';
      S.loading = false;
      return render();
    }
    const u = data.user;
    u.id = u.id || u._id;
    await rememberBrowserCredential();
    storeAuthSession(data.token, u);
    const existing = users.find(x => x.email === u.email || x.id === u.id);
    if (existing) Object.assign(existing, u);
    else users.push(u);
    S.err = '';
    S.view = u.role === 'admin' ? 'ana' : 'find';
    S.res = null;
    S.th = 0;
    S.loading = false;
    toast('Welcome back, ' + (u.name ? u.name.split(' ')[0] : 'User') + '!');
    if (u.role === 'admin') await syncAdminData();
    await syncDatabaseData();
    render();
  } catch (err) {
    S.err = 'Could not connect to the authentication service.';
    S.loading = false;
    render();
  }
}
