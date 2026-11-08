import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarize, dailyStats, cumulative, daySummary, dayKey, groupSummary, durationBucket,
  kairosScore, pnlFromPrices, futuresRoot, guessMultiplier, rMultiple,
} from './metrics.js';
import { evaluateLock } from './lockguard.js';

const T = (net, close, extra = {}) => ({ net_pnl: net, open_time: extra.open || close, close_time: close, qty: 1, fees: 0, ...extra });

const trades = [
  T(100, '2025-06-02T14:00:00Z', { fees: 2, open: '2025-06-02T13:59:30Z', planned_risk: 50 }), // 30s
  T(-50, '2025-06-02T15:00:00Z', { fees: 2, open: '2025-06-02T14:55:00Z' }),                     // 5 min
  T(200, '2025-06-03T14:00:00Z', { open: '2025-06-03T13:00:00Z', planned_risk: 100 }),            // 1h
  T(0, '2025-06-03T15:00:00Z'),
  T(-150, '2025-06-04T14:00:00Z'),
  T(-25, '2025-06-04T15:00:00Z'),
];

test('summarize computes core stats', () => {
  const s = summarize(trades);
  assert.equal(s.count, 6);
  assert.equal(s.wins, 2);
  assert.equal(s.losses, 3);
  assert.equal(s.breakevens, 1);
  assert.equal(s.netPnl, 75);
  assert.equal(s.grossProfit, 300);
  assert.equal(s.grossLoss, 225);
  assert.equal(s.winRate, 2 / 5); // break-even excluded
  assert.ok(Math.abs(s.profitFactor - 300 / 225) < 1e-12);
  assert.equal(s.avgWin, 150);
  assert.equal(s.avgLoss, 75);
  assert.equal(s.avgWinLossRatio, 2);
  assert.equal(s.expectancy, 75 / 6);
  assert.equal(s.largestWin, 200);
  assert.equal(s.largestLoss, -150);
  assert.equal(s.maxConsecLosses, 2);
  assert.equal(s.maxConsecWins, 1);
  assert.equal(s.totalFees, 4);
  // equity: 100, 50, 250, 250, 100, 75 -> peak 250, trough 75 -> DD 175
  assert.equal(s.maxDrawdown, 175);
  assert.equal(s.avgR, (2 + 2) / 2);
});

test('summarize handles empty and no-loss cases', () => {
  assert.equal(summarize([]).winRate, 0);
  assert.equal(summarize([]).profitFactor, 0);
  assert.equal(summarize([T(10, '2025-01-01T15:00:00Z')]).profitFactor, Infinity);
});

test('dayKey respects time zone', () => {
  // 02:00 UTC on Jun 3 is still Jun 2 in New York
  assert.equal(dayKey('2025-06-03T02:00:00Z', 'America/New_York'), '2025-06-02');
  assert.equal(dayKey('2025-06-03T02:00:00Z', 'Europe/Athens'), '2025-06-03');
});

test('daily stats, cumulative and day summary', () => {
  const d = cumulative(dailyStats(trades, 'America/New_York'));
  assert.deepEqual(d.map(x => [x.date, x.net, x.cumulative]), [
    ['2025-06-02', 50, 50], ['2025-06-03', 200, 250], ['2025-06-04', -175, 75],
  ]);
  const ds = daySummary(d);
  assert.equal(ds.winningDays, 2);
  assert.equal(ds.losingDays, 1);
  assert.equal(ds.bestDay.date, '2025-06-03');
  assert.equal(ds.worstDay.date, '2025-06-04');
});

test('groupSummary and duration buckets', () => {
  assert.equal(durationBucket(trades[0]), 'Under 1 min');
  assert.equal(durationBucket(trades[1]), '5:00 to 9:59');
  assert.equal(durationBucket(trades[2]), '1:00:00 to 1:59:59');
  const g = groupSummary(trades, t => (t.net_pnl >= 0 ? 'nonneg' : 'neg'));
  assert.equal(g.find(r => r.key === 'neg').count, 3);
  const multi = groupSummary([{ net_pnl: 5, tags: ['a', 'b'] }], t => t.tags);
  assert.equal(multi.length, 2);
});

test('kairosScore is bounded and documented', () => {
  const sc = kairosScore(summarize(trades));
  assert.ok(sc.score >= 0 && sc.score <= 100);
  assert.equal(sc.parts.avgWinLoss, 100); // ratio 2 => capped 100
});

test('pnl from prices, futures roots, R multiple', () => {
  assert.equal(pnlFromPrices({ side: 'long', qty: 2, entry_price: 5000, exit_price: 5010, multiplier: 5 }), 100);
  assert.equal(pnlFromPrices({ side: 'short', qty: 1, entry_price: 100, exit_price: 90 }), 10);
  assert.equal(futuresRoot('MESZ5'), 'MES');
  assert.equal(futuresRoot('NQH2026'), 'NQ');
  assert.equal(futuresRoot('AAPL'), 'AAPL');
  assert.equal(guessMultiplier('MNQU5'), 2);
  assert.equal(rMultiple({ net_pnl: -50, planned_risk: 100 }), -0.5);
  assert.equal(rMultiple({ net_pnl: 10 }), null);
});

test('evaluateLock: counts today only and locks on limits', () => {
  const now = new Date('2025-06-04T16:00:00Z'); // 12:00 New York
  const rules = { enabled: 1, max_losses: 2, max_trades: 5, lock_time: null };
  const r = evaluateLock(rules, trades, now);
  assert.equal(r.counts.trades, 2);
  assert.equal(r.counts.losses, 2);
  assert.equal(r.locked, true);
  assert.deepEqual(r.reasons, ['Losing-trade limit reached']);

  const r2 = evaluateLock({ ...rules, max_losses: 3 }, trades, now);
  assert.equal(r2.locked, false);

  const r3 = evaluateLock({ enabled: 1, max_daily_loss: 150 }, trades, now);
  assert.equal(r3.locked, true); // -175 <= -150

  const r4 = evaluateLock({ enabled: 1, lock_time: '11:30' }, [], now);
  assert.equal(r4.locked, true);
  const r5 = evaluateLock({ enabled: 1, lock_time: '12:30' }, [], now);
  assert.equal(r5.locked, false);

  const off = evaluateLock({ enabled: 0, max_trades: 1 }, trades, now);
  assert.equal(off.locked, false);
});

test('evaluateLock: consecutive losses', () => {
  const now = new Date('2025-06-04T16:00:00Z');
  const r = evaluateLock({ enabled: 1, max_consec_losses: 2 }, trades, now);
  assert.equal(r.counts.consecLosses, 2);
  assert.equal(r.locked, true);
});
