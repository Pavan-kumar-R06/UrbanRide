export const today = new Date().toISOString().slice(0, 10);
export const dt = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
export const ago = ts => { const s = (Date.now() - ts) / 1e3; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; };
export const inr = n => (n < 0 ? '−₹' : '₹') + Math.abs(Math.round(n)).toLocaleString('en-IN');
export const hourLabel = h => (h % 12 || 12) + (h < 12 ? 'a' : 'p');
export const fareText = b => { const fee = Number(b.fee) || 0; return fee ? `₹${b.fare} + ₹${fee} platform fee = ₹${Number(b.fare) + fee}` : `₹${b.fare}`; };
export const norm = r => ({ ...r, id: String(r._id || r.id), _id: String(r._id || r.id) });
