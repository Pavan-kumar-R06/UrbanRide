async function syncAdminData(){
  try {
    const dbUsers = await apiRequest('/users');
    {
      dbUsers.forEach(dbU => {
        const uid = dbU._id ? dbU._id.toString() : dbU.id;
        const existing = users.find(x => x.id === uid || x.email === dbU.email);
        if (existing) {
          existing.id = uid;
          existing.name = dbU.name || existing.name;
          existing.email = dbU.email;
          existing.role = dbU.role;
          existing.car = dbU.car || existing.car;
          existing.rating = dbU.rating || existing.rating;
          existing.blocked = dbU.blocked;
        } else {
          users.push({
            id: uid,
            name: dbU.name || 'User ' + uid.slice(-4),
            email: dbU.email,
            role: dbU.role || 'user',
            car: dbU.car || null,
            rating: dbU.rating || 5.0,
            blocked: dbU.blocked || false,
            ec: dbU.ec || ''
          });
        }
        if (dbU.car && (dbU.car.m || typeof dbU.car === 'string')) {
          const carModel = typeof dbU.car === 'string' ? dbU.car : dbU.car.m;
          const carSt = (dbU.car && dbU.car.st) || 'pending';
          const inVq = vq.find(v => v.name === carModel || v.uid === uid);
          if (!inVq) {
            vq.unshift({
              name: carModel,
              owner: dbU.name || 'User ' + uid.slice(-4),
              st: carSt,
              uid: uid
            });
          }
        }
      });
      if (['users','ver','ana'].includes(S.view)) render();
    }
  } catch (e) {
    console.log('MongoDB sync error:', e);
  }
}
