// Daily rule-lock evaluation ("Lock Guard").
// Rules apply per account to the current trading day in the rules' time zone
// (default New York). Counters reset automatically at midnight in that zone.
import { dayKey, outcome, net, tradeTime, zonedParts, DEFAULT_TZ } from './metrics.js';

export const RULE_FIELDS = [
  ['max_trades', 'Max trades per day'],
  ['max_wins', 'Lock after N winning trades'],
  ['max_losses', 'Lock after N losing trades'],
  ['max_breakevens', 'Lock after N break-even trades'],
  ['max_consec_losses', 'Lock after N consecutive losses'],
  ['max_daily_loss', 'Max daily loss (amount)'],
  ['max_daily_profit', 'Daily profit target (amount)'],
];

const isSet = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

/**
 * @param rules {enabled, timezone, lock_time 'HH:MM' | null, max_* numbers | null}
 * @param trades all trades of the account (any day)
 * @param now Date
 * @returns {locked, reasons[], day, counts, progress[]}
 */
export function evaluateLock(rules, trades, now = new Date()) {
  const tz = rules?.timezone || DEFAULT_TZ;
  const day = dayKey(now.toISOString(), tz);
  const today = trades
    .filter(t => dayKey(tradeTime(t), tz) === day)
    .sort((a, b) => String(tradeTime(a)).localeCompare(String(tradeTime(b))));

  let consecL = 0, maxConsecL = 0;
  for (const t of today) {
    if (outcome(t) === 'loss') { consecL++; maxConsecL = Math.max(maxConsecL, consecL); } else consecL = 0;
  }
  const counts = {
    trades: today.length,
    wins: today.filter(t => outcome(t) === 'win').length,
    losses: today.filter(t => outcome(t) === 'loss').length,
    breakevens: today.filter(t => outcome(t) === 'breakeven').length,
    consecLosses: consecL,
    net: today.reduce((a, t) => a + net(t), 0),
  };

  const progress = [];
  const reasons = [];
  const check = (key, label, value, limit, hit) => {
    if (!isSet(limit)) return;
    const p = { key, label, value, limit: Number(limit), hit };
    progress.push(p);
    if (hit) reasons.push(label);
  };
  if (rules && rules.enabled) {
    check('max_trades', 'Max trades reached', counts.trades, rules.max_trades, counts.trades >= Number(rules.max_trades));
    check('max_wins', 'Winning-trade limit reached', counts.wins, rules.max_wins, counts.wins >= Number(rules.max_wins));
    check('max_losses', 'Losing-trade limit reached', counts.losses, rules.max_losses, counts.losses >= Number(rules.max_losses));
    check('max_breakevens', 'Break-even limit reached', counts.breakevens, rules.max_breakevens, counts.breakevens >= Number(rules.max_breakevens));
    check('max_consec_losses', 'Consecutive-loss limit reached', consecL, rules.max_consec_losses, consecL >= Number(rules.max_consec_losses));
    check('max_daily_loss', 'Daily loss limit reached', counts.net, rules.max_daily_loss, counts.net <= -Math.abs(Number(rules.max_daily_loss)));
    check('max_daily_profit', 'Daily profit target reached', counts.net, rules.max_daily_profit, counts.net >= Math.abs(Number(rules.max_daily_profit)));
    if (rules.lock_time && /^\d{2}:\d{2}$/.test(rules.lock_time)) {
      const { hour, minute } = zonedParts(now.toISOString(), tz);
      const [lh, lm] = rules.lock_time.split(':').map(Number);
      const hit = hour * 60 + minute >= lh * 60 + lm;
      progress.push({ key: 'lock_time', label: `Daily lock at ${rules.lock_time}`, value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, limit: rules.lock_time, hit });
      if (hit) reasons.push(`Daily lock time ${rules.lock_time} passed`);
    }
  }
  return { locked: reasons.length > 0, reasons, day, timezone: tz, counts, progress };
}
