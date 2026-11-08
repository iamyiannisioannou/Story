// Turn parsed CSV rows (array of objects keyed by header) into trade objects.
// No network access, no broker APIs: these read files you export yourself.
import { pnlFromPrices, guessMultiplier } from './metrics.js';

/** "$1,234.50" -> 1234.5, "$(25.00)" -> -25, "-12" -> -12 */
export function parseMoney(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s.replace(/[$€£\s]/g, ''))) neg = true;
  s = s.replace(/[()$€£,\s]/g, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/**
 * Parse a date-time string to ISO UTC.
 * Strings with an explicit offset/Z are honoured. Naive strings ("06/10/2024 09:41:06",
 * "2024-06-10 09:41:06") are interpreted in `tz` (the time zone your platform exported in).
 */
export function parseDateTime(v, tz = 'America/New_York') {
  if (!v) return null;
  const s = String(v).trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString();
  }
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  let Y, M, D, h, mi, se;
  if (m) {
    [, M, D, Y, h, mi, se] = m;
    if (Y.length === 2) Y = '20' + Y;
    h = Number(h);
    if (m[7]) { const pm = m[7].toUpperCase() === 'PM'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  } else {
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
    if (!m) { const d = new Date(s); return isNaN(d) ? null : d.toISOString(); }
    [, Y, M, D, h, mi, se] = m;
  }
  return zonedToUtc(+Y, +M, +D, +h, +mi, +(se || 0), tz);
}

/** Convert a wall-clock time in an IANA zone to an ISO UTC string. */
export function zonedToUtc(Y, M, D, h, mi, s, tz) {
  const guess = Date.UTC(Y, M - 1, D, h, mi, s);
  const off = tzOffsetMs(guess, tz);
  let t = guess - off;
  const off2 = tzOffsetMs(t, tz); // handle DST edges
  if (off2 !== off) t = guess - off2;
  return new Date(t).toISOString();
}
function tzOffsetMs(utcMs, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

const lc = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [String(k).trim().toLowerCase(), v]));

/**
 * Tradovate "Performance" report CSV (one row per matched buy/sell pair).
 * Expected columns: symbol, qty, buyPrice, sellPrice, pnl, boughtTimestamp, soldTimestamp,
 * buyFillId, sellFillId (others ignored). The pnl column is treated as GROSS (before
 * commissions) — verify against your own export and enter commissions per side if needed.
 */
export const tradovatePerformance = {
  id: 'tradovate-performance',
  label: 'Tradovate — Performance report (CSV)',
  detect: headers => {
    const h = headers.map(x => x.trim().toLowerCase());
    return ['buyprice', 'sellprice', 'boughttimestamp', 'soldtimestamp'].every(k => h.includes(k));
  },
  parse(rows, { tz = 'America/New_York', commissionPerContract = 0 } = {}) {
    const out = [], errors = [];
    rows.forEach((raw, i) => {
      const r = lc(raw);
      if (!r.symbol) return;
      const qty = Math.abs(Number(r.qty));
      const bought = parseDateTime(r.boughttimestamp, tz);
      const sold = parseDateTime(r.soldtimestamp, tz);
      const buyPrice = Number(r.buyprice), sellPrice = Number(r.sellprice);
      const gross = parseMoney(r.pnl);
      if (!qty || !bought || !sold || !Number.isFinite(buyPrice) || !Number.isFinite(sellPrice) || gross == null) {
        errors.push({ row: i + 2, message: 'Missing or invalid qty/price/timestamp/pnl' });
        return;
      }
      const isLong = bought <= sold;
      const fees = +(commissionPerContract * qty * 2).toFixed(2);
      out.push({
        symbol: String(r.symbol).trim(),
        instrument_type: 'future',
        side: isLong ? 'long' : 'short',
        qty,
        entry_price: isLong ? buyPrice : sellPrice,
        exit_price: isLong ? sellPrice : buyPrice,
        open_time: isLong ? bought : sold,
        close_time: isLong ? sold : bought,
        gross_pnl: gross,
        fees,
        net_pnl: +(gross - fees).toFixed(2),
        multiplier: guessMultiplier(r.symbol),
        external_id: r.buyfillid && r.sellfillid ? `${r.buyfillid}-${r.sellfillid}` : null,
      });
    });
    return { trades: out, errors };
  },
};

export const GENERIC_FIELDS = [
  ['symbol', 'Symbol', true],
  ['side', 'Side (long/short or buy/sell)', false],
  ['qty', 'Quantity', true],
  ['entry_price', 'Entry price', false],
  ['exit_price', 'Exit price', false],
  ['open_time', 'Open date/time', true],
  ['close_time', 'Close date/time', false],
  ['net_pnl', 'Net P&L', false],
  ['gross_pnl', 'Gross P&L', false],
  ['fees', 'Fees / commissions', false],
  ['external_id', 'Trade ID (for de-duplication)', false],
];

/**
 * Generic CSV with a user-supplied column mapping { field: headerName }.
 * If net P&L is not mapped it is computed from prices × qty × multiplier − fees.
 */
export function parseGeneric(rows, mapping, { tz = 'America/New_York', instrumentType = 'stock', multiplier = null } = {}) {
  const out = [], errors = [];
  const get = (r, f) => (mapping[f] ? r[mapping[f]] : undefined);
  rows.forEach((r, i) => {
    const symbol = String(get(r, 'symbol') ?? '').trim();
    if (!symbol) return;
    const sideRaw = String(get(r, 'side') ?? 'long').trim().toLowerCase();
    const side = /^(s|short|sell|sld|sold)/.test(sideRaw) ? 'short' : 'long';
    const qty = Math.abs(Number(String(get(r, 'qty') ?? '').replace(/,/g, '')));
    const open_time = parseDateTime(get(r, 'open_time'), tz);
    const close_time = parseDateTime(get(r, 'close_time'), tz) || open_time;
    const entry = parseMoney(get(r, 'entry_price'));
    const exit = parseMoney(get(r, 'exit_price'));
    const fees = Math.abs(parseMoney(get(r, 'fees')) || 0);
    const mult = multiplier ?? (instrumentType === 'future' ? guessMultiplier(symbol) : 1) ?? 1;
    let gross = parseMoney(get(r, 'gross_pnl'));
    let netv = parseMoney(get(r, 'net_pnl'));
    if (gross == null && entry != null && exit != null && qty) gross = pnlFromPrices({ side, qty, entry_price: entry, exit_price: exit, multiplier: mult });
    if (netv == null && gross != null) netv = gross - fees;
    if (gross == null && netv != null) gross = netv + fees;
    if (!qty || !open_time || netv == null) {
      errors.push({ row: i + 2, message: 'Need quantity, open time and either P&L or entry+exit prices' });
      return;
    }
    out.push({
      symbol, instrument_type: instrumentType, side, qty,
      entry_price: entry, exit_price: exit, open_time, close_time,
      gross_pnl: +gross.toFixed(2), fees, net_pnl: +netv.toFixed(2), multiplier: mult,
      external_id: get(r, 'external_id') ? String(get(r, 'external_id')) : null,
    });
  });
  return { trades: out, errors };
}
