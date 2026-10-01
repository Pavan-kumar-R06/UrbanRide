async function syncAdminData(){
  try {
    const [dbUsers, dbIncidents] = await Promise.all([apiRequest('/users'), apiRequest('/incidents')]);
    users.splice(0, users.length, ...dbUsers.map(user => ({
      ...user,
      id: String(user._id || user.id),
      car: user.car || null,
      blocked: Boolean(user.blocked),
      ec: user.ec || ''
    })));
    incidents.splice(0, incidents.length, ...dbIncidents);
    vq = dbUsers.filter(user => user.car && user.car.m).map(user => ({
      name: user.car.m,
      owner: user.name,
      st: user.car.st || 'pending',
      uid: String(user._id || user.id)
    }));
    if (['users','ver','ana','inc'].includes(S.view)) render();
  } catch (e) {
    console.warn('Admin data could not be refreshed:', e.message);
  }
}
