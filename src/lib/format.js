const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(n, { sign = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const v = Number(n);
  const s = '$' + nf2.format(Math.abs(v));
  if (v < 0) return '-' + s;
  return sign && v > 0 ? '+' + s : s;
}

export function moneyCompact(n) {
  const v = Number(n) || 0, a = Math.abs(v);
  const s = a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 1 : 2) + 'K' : a.toFixed(a % 1 ? 2 : 0);
  return (v < 0 ? '-$' : '$') + s;
}

export const pct = (x, d = 2) => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : '—');
export const num = (x, d = 2) => (x === Infinity ? '∞' : Number.isFinite(x) ? Number(x).toFixed(d) : '—');
export const cls = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

export function duration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function fmtDate(iso, tz, opts = { month: '2-digit', day: '2-digit', year: 'numeric' }) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(iso));
}
export function fmtTime(iso, tz) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
/** 'YYYY-MM-DD' -> 'Tue, Jun 04, 2025' */
export function fmtDay(key, opts = { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
}
