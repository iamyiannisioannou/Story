import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, parseDateTime, tradovatePerformance, parseGeneric } from './importers.js';

test('parseMoney', () => {
  assert.equal(parseMoney('$1,234.50'), 1234.5);
  assert.equal(parseMoney('$(25.00)'), -25);
  assert.equal(parseMoney('-12'), -12);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
});

test('parseDateTime interprets naive times in the given zone', () => {
  // 09:41:06 New York in June (EDT, UTC-4) = 13:41:06Z
  assert.equal(parseDateTime('06/10/2024 09:41:06', 'America/New_York'), '2024-06-10T13:41:06.000Z');
  assert.equal(parseDateTime('2024-01-10 09:30:00', 'America/New_York'), '2024-01-10T14:30:00.000Z');
  assert.equal(parseDateTime('2024-06-10T13:41:06Z'), '2024-06-10T13:41:06.000Z');
  assert.equal(parseDateTime('06/10/2024 01:05:00 PM', 'UTC'), '2024-06-10T13:05:00.000Z');
});

test('tradovate performance rows -> trades (long and short)', () => {
  const headers = ['symbol', 'qty', 'buyPrice', 'sellPrice', 'pnl', 'boughtTimestamp', 'soldTimestamp', 'buyFillId', 'sellFillId'];
  assert.ok(tradovatePerformance.detect(headers));
  const rows = [
    { symbol: 'MESM4', qty: '2', buyPrice: '5300.25', sellPrice: '5302.25', pnl: '$20.00', boughtTimestamp: '06/10/2024 09:41:06', soldTimestamp: '06/10/2024 09:45:00', buyFillId: '1', sellFillId: '2' },
    { symbol: 'MESM4', qty: '1', buyPrice: '5310.00', sellPrice: '5305.00', pnl: '$(25.00)', boughtTimestamp: '06/10/2024 10:05:00', soldTimestamp: '06/10/2024 10:01:00', buyFillId: '4', sellFillId: '3' },
    { symbol: 'MESM4', qty: '', buyPrice: 'x' },
  ];
  const { trades, errors } = tradovatePerformance.parse(rows, { commissionPerContract: 0.5 });
  assert.equal(trades.length, 2);
  assert.equal(errors.length, 1);
  const [a, b] = trades;
  assert.equal(a.side, 'long');
  assert.equal(a.entry_price, 5300.25);
  assert.equal(a.gross_pnl, 20);
  assert.equal(a.fees, 2);
  assert.equal(a.net_pnl, 18);
  assert.equal(a.multiplier, 5);
  assert.equal(a.external_id, '1-2');
  assert.equal(b.side, 'short');
  assert.equal(b.entry_price, 5305);
  assert.equal(b.exit_price, 5310);
  assert.equal(b.open_time, '2024-06-10T14:01:00.000Z');
  assert.equal(b.net_pnl, -26);
});

test('generic import computes P&L from prices when not mapped', () => {
  const rows = [{ Sym: 'AAPL', Dir: 'Sell', Q: '10', In: '200', Out: '190', T: '2024-06-10 10:00:00', C: '1.00' }];
  const map = { symbol: 'Sym', side: 'Dir', qty: 'Q', entry_price: 'In', exit_price: 'Out', open_time: 'T', fees: 'C' };
  const { trades, errors } = parseGeneric(rows, map);
  assert.equal(errors.length, 0);
  assert.equal(trades[0].side, 'short');
  assert.equal(trades[0].gross_pnl, 100);
  assert.equal(trades[0].net_pnl, 99);
});
