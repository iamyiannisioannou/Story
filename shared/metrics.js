// Pure trading-statistics functions shared by the client and the server.
// Every function takes plain trade objects:
//   { id, symbol, side, qty, entry_price, exit_price, open_time, close_time,
//     net_pnl, gross_pnl, fees, planned_risk, playbook_id, tags: [{id,name,category}] }
// Times are ISO-8601 strings (UTC). P&L values are numbers in account currency.

export const DEFAULT_TZ = 'America/New_York';

const dayFmtCache = new Map();
/** Calendar day (YYYY-MM-DD) of an ISO timestamp in the given IANA time zone. */
export function dayKey(iso, tz = DEFAULT_TZ) {
  if (!iso) return null;
  let f = dayFmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFmtCache.set(tz, f);
  }
  return f.format(new Date(iso));
}

const partsCache = new Map();
/** {weekday 0-6 (Sun=0), hour 0-23, minute} of a timestamp in a time zone. */
export function zonedParts(iso, tz = DEFAULT_TZ) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    partsCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { weekday: wd, hour: Number(p.hour), minute: Number(p.minute) };
}

export const net = t => Number(t.net_pnl) || 0;

/** 'win' | 'loss' | 'breakeven' based on net P&L. */
export function outcome(t) {
  const n = net(t);
  if (n > 0) return 'win';
  if (n < 0) return 'loss';
  return 'breakeven';
}

/** The timestamp a trade is attributed to (close time, falling back to open time). */
export const tradeTime = t => t.close_time || t.open_time;

export function sortChrono(trades) {
  return [...trades].sort((a, b) => String(tradeTime(a)).localeCompare(String(tradeTime(b))));
}

/** Realised R-multiple: net P&L divided by the planned risk (only when risk > 0). */
export function rMultiple(t) {
  const risk = Number(t.planned_risk);
  return risk > 0 ? net(t) / risk : null;
}

export function holdMs(t) {
  if (!t.open_time || !t.close_time) return null;
  const d = new Date(t.close_time) - new Date(t.open_time);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = xs => xs.reduce((a, b) => a + b, 0);

function streaks(values) {
  // values: array of 'win'|'loss'|'breakeven' in order. Break-evens reset both streaks.
  let maxW = 0, maxL = 0, w = 0, l = 0;
  for (const v of values) {
    if (v === 'win') { w++; l = 0; } else if (v === 'loss') { l++; w = 0; } else { w = 0; l = 0; }
    maxW = Math.max(maxW, w); maxL = Math.max(maxL, l);
  }
  return { maxW, maxL };
}

/**
 * Trade-level summary.
 * Win rate = wins / (wins + losses); break-even trades are excluded from the denominator.
 * Profit factor = gross profit / |gross loss| (Infinity when there are no losses).
 * Expectancy = net P&L / number of trades (average P&L per trade).
 */
export function summarize(trades) {
  const list = sortChrono(trades);
  const nets = list.map(net);
  const winners = list.filter(t => net(t) > 0);
  const losers = list.filter(t => net(t) < 0);
  const be = list.length - winners.length - losers.length;
  const grossProfit = sum(winners.map(net));
  const grossLoss = Math.abs(sum(losers.map(net)));
  const decided = winners.length + losers.length;
  const avgWin = winners.length ? grossProfit / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;
  const { maxW, maxL } = streaks(list.map(outcome));
  const holds = t => list.filter(t).map(holdMs).filter(x => x != null);
  const rs = list.map(rMultiple).filter(x => x != null);

  // Max drawdown on the trade-by-trade equity curve (peak-to-trough, as a positive number).
  let eq = 0, peak = 0, maxDD = 0;
  for (const n of nets) { eq += n; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, peak - eq); }

  return {
    count: list.length,
    wins: winners.length,
    losses: losers.length,
    breakevens: be,
    netPnl: sum(nets),
    grossProfit,
    grossLoss,
    winRate: decided ? winners.length / decided : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
    avgWin,
    avgLoss,
    avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0),
    expectancy: list.length ? sum(nets) / list.length : 0,
    largestWin: winners.length ? Math.max(...winners.map(net)) : 0,
    largestLoss: losers.length ? Math.min(...losers.map(net)) : 0,
    maxConsecWins: maxW,
    maxConsecLosses: maxL,
    totalFees: sum(list.map(t => Number(t.fees) || 0)),
    totalVolume: sum(list.map(t => Math.abs(Number(t.qty)) || 0)),
    avgHoldMs: mean(holds(() => true)),
    avgHoldWinMs: mean(holds(t => net(t) > 0)),
    avgHoldLossMs: mean(holds(t => net(t) < 0)),
    avgR: rs.length ? mean(rs) : null,
    maxDrawdown: maxDD,
  };
}

/** Per-day aggregates sorted by date. */
export function dailyStats(trades, tz = DEFAULT_TZ) {
  const map = new Map();
  for (const t of trades) {
    const k = dayKey(tradeTime(t), tz);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ts]) => {
      const s = summarize(ts);
      return { date, net: s.netPnl, count: s.count, wins: s.wins, losses: s.losses, breakevens: s.breakevens, winRate: s.winRate, trades: ts };
    });
}

/** Adds a running cumulative total to daily stats. */
export function cumulative(daily) {
  let c = 0;
  return daily.map(d => ({ ...d, cumulative: (c += d.net) }));
}

/** Day-level summary (winning/losing days, best/worst day, streaks of days). */
export function daySummary(daily) {
  const outs = daily.map(d => (d.net > 0 ? 'win' : d.net < 0 ? 'loss' : 'breakeven'));
  const { maxW, maxL } = streaks(outs);
  const best = daily.reduce((a, d) => (!a || d.net > a.net ? d : a), null);
  const worst = daily.reduce((a, d) => (!a || d.net < a.net ? d : a), null);
  const win = daily.filter(d => d.net > 0), loss = daily.filter(d => d.net < 0);
  return {
    tradingDays: daily.length,
    winningDays: win.length,
    losingDays: loss.length,
    breakevenDays: daily.length - win.length - loss.length,
    dayWinRate: win.length + loss.length ? win.length / (win.length + loss.length) : 0,
    avgDailyPnl: mean(daily.map(d => d.net)),
    avgWinningDay: mean(win.map(d => d.net)),
    avgLosingDay: mean(loss.map(d => d.net)),
    bestDay: best,
    worstDay: worst,
    maxConsecWinDays: maxW,
    maxConsecLossDays: maxL,
  };
}

/** Group trades by an arbitrary key and summarise each group. keyFn may return an array (e.g. tags). */
export function groupSummary(trades, keyFn, order) {
  const map = new Map();
  for (const t of trades) {
    let keys = keyFn(t);
    if (!Array.isArray(keys)) keys = [keys];
    for (const k of keys) {
      if (k == null) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
  }
  let rows = [...map.entries()].map(([key, ts]) => ({ key, ...summarize(ts) }));
  if (order) rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return rows;
}

export const DURATION_BUCKETS = [
  ['Under 1 min', 0, 60e3],
  ['1:00 to 1:59', 60e3, 120e3],
  ['2:00 to 4:59', 120e3, 300e3],
  ['5:00 to 9:59', 300e3, 600e3],
  ['10:00 to 29:59', 600e3, 1800e3],
  ['30:00 to 59:59', 1800e3, 3600e3],
  ['1:00:00 to 1:59:59', 3600e3, 7200e3],
  ['2:00:00 to 3:59:59', 7200e3, 14400e3],
  ['4:00:00 and over', 14400e3, Infinity],
];
export function durationBucket(t) {
  const ms = holdMs(t);
  if (ms == null) return null;
  return DURATION_BUCKETS.find(([, lo, hi]) => ms >= lo && ms < hi)[0];
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Kairos Score (0-100). Our own, documented formula — not TradeZella's proprietary "Zella Score".
 * Average of three capped components:
 *   win rate     : winRate / 0.60, capped at 1
 *   profit factor: profitFactor / 2.5, capped at 1
 *   avg win/loss : avgWinLossRatio / 2.0, capped at 1
 */
export function kairosScore(s) {
  if (!s.count) return { score: 0, parts: { winRate: 0, profitFactor: 0, avgWinLoss: 0 } };
  const cap = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 1));
  const parts = {
    winRate: cap(s.winRate / 0.6) * 100,
    profitFactor: cap(s.profitFactor / 2.5) * 100,
    avgWinLoss: cap(s.avgWinLossRatio / 2) * 100,
  };
  return { score: (parts.winRate + parts.profitFactor + parts.avgWinLoss) / 3, parts };
}

/** P&L of a closed position from prices: (exit-entry)*qty*multiplier for longs, reversed for shorts. */
export function pnlFromPrices({ side, qty, entry_price, exit_price, multiplier = 1 }) {
  const dir = String(side).toLowerCase() === 'short' ? -1 : 1;
  return (Number(exit_price) - Number(entry_price)) * Number(qty) * Number(multiplier || 1) * dir;
}

/** Common futures contract point values (USD per 1.0 price point). */
export const FUTURES_MULTIPLIERS = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
  CL: 1000, MCL: 100, GC: 100, MGC: 10, SI: 5000, NG: 10000, ZB: 1000, ZN: 1000,
  '6E': 125000, M6E: 12500,
};
/** Strip a futures month/year code: "MESZ5" / "MES Z25" / "MESZ2025" -> "MES". */
export function futuresRoot(symbol) {
  const s = String(symbol || '').toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^([A-Z0-9]{1,4}?)([FGHJKMNQUVXZ])(\d{1,4})$/);
  return m ? m[1] : s;
}
export function guessMultiplier(symbol) {
  return FUTURES_MULTIPLIERS[futuresRoot(symbol)] ?? null;
}
