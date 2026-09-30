const TOKEN_KEY='urbanride_access_token';

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
    S.isMongoActive = true;
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
    S.isMongoActive = false;
    console.warn('Could not sync MongoDB data:', err.message);
  }
}

async function persistNewRide(ride) {
  try {
    const stored = await apiRequest('/rides', { method: 'POST', body: ride });
    ride.id = String(stored._id);
    ride._id = String(stored._id);
    return true;
  } catch (err) {
    if (S.isMongoActive) throw err;
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
    if (S.isMongoActive) throw err;
    return false;
  }
}

async function persistRideChanges(ride, changes) {
  if (!S.isMongoActive || !ride._id) return;
  try {
    await apiRequest('/rides/' + ride._id, { method: 'PUT', body: changes });
  } catch (err) {
    console.error('Ride update was not saved:', err.message);
    toast('Ride update could not be saved to MongoDB.');
  }
}

async function persistBookingChanges(booking, changes) {
  if (!S.isMongoActive || !booking._id) return;
  try {
    await apiRequest('/bookings/' + booking._id, { method: 'PUT', body: changes });
  } catch (err) {
    console.error('Booking update was not saved:', err.message);
    toast('Booking update could not be saved to MongoDB.');
  }
}