export const TOKEN_KEY = 'urbanride_access_token';
export const REMEMBERED_EMAIL_KEY = 'urbanride_remembered_email';
let onUnauthorized = () => {};
export const setUnauthorizedHandler = fn => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { localStorage.removeItem(TOKEN_KEY); onUnauthorized(); }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: res.status });
  return data;
}
export const getRememberedEmail = () => { try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''; } catch (e) { return ''; } };
