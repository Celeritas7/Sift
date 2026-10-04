export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const ts = (iso: string) => Date.parse(iso);
export const fmtLong = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtShort = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const ago = (t: number) => { const d = Math.round((Date.now() - t) / 864e5); if (d < 1) return 'today'; if (d < 45) return d + ' days ago'; const m = Math.round(d / 30.4); return m < 12 ? m + (m === 1 ? ' month ago' : ' months ago') : Math.round(m / 12) + ' yr ago'; };
export const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);
/** Monday of the week containing t, as YYYY-MM-DD in local time. */
export const mondayOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const weekLabel = (weekOf: string) => new Date(weekOf + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const uid = () => crypto.randomUUID();
export const shortId = () => 's_' + Math.random().toString(36).slice(2, 6);
export const nowIso = () => new Date().toISOString();
