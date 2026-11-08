// Creates a clearly-labelled DEMO account with generated sample trades so the
// screens can be explored before importing real data. Nothing here is real.

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function createDemoData(db, insertTrade, setTags) {
  const acct = Number(db.prepare("INSERT INTO accounts (name, broker, currency, initial_balance, is_demo) VALUES ('Demo — sample data', 'Generated', 'USD', 50000, 1)").run().lastInsertRowid);
  const pbs = [
    ['Opening Drive', '🚀', 'Trade in the direction of the first 5-minute range break.', ['Wait for the 5m opening range', 'Enter on break with volume', 'Stop below range midpoint', 'Target 2R']],
    ['Pullback Retest', '🎯', 'Buy the first pullback to VWAP in a trending session.', ['Trend confirmed on 15m', 'Pullback to VWAP', 'Rejection candle', 'Risk ≤ 1% of account']],
    ['Morning Top Reversal', '🔄', 'Fade an exhausted morning high after a failed breakout.', ['Failed breakout above HOD', 'Divergence on delta', 'Stop above the high']],
  ].map(([name, icon, description, rules]) => {
    const r = db.prepare('INSERT INTO playbooks (name, icon, description, rules) VALUES (?, ?, ?, ?)').run(`${name} (demo)`, icon, description, JSON.stringify(rules.map((text, i) => ({ key: `r${i}`, text }))));
    return Number(r.lastInsertRowid);
  });
  const mistakes = ['FOMO entry', 'Moved stop', 'Oversized', 'Early exit'];
  const rand = rng(42);
  const symbols = [['MES', 5, 5300], ['MNQ', 2, 18500], ['ES', 50, 5300]];
  const today = new Date();
  let n = 0;
  for (let d = 75; d >= 1; d--) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - d));
    const wd = day.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const count = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const [sym, mult, base] = symbols[Math.floor(rand() * (rand() < 0.8 ? 2 : 3))];
      const side = rand() < 0.55 ? 'long' : 'short';
      const qty = 1 + Math.floor(rand() * 3);
      const openMin = 13 * 60 + 30 + Math.floor(rand() * 240); // 09:30–13:30 New York (UTC-4 in summer)
      const hold = 30 + Math.floor(rand() * 3600);
      const open = new Date(day.getTime() + openMin * 60e3 + Math.floor(rand() * 60) * 1e3);
      const close = new Date(open.getTime() + hold * 1e3);
      const entry = +(base + (rand() - 0.5) * 100).toFixed(2);
      const win = rand() < 0.52;
      const pts = +((win ? 1 : -1) * (1 + rand() * (win ? 8 : 5))).toFixed(2);
      const exit = +(side === 'long' ? entry + pts : entry - pts).toFixed(2);
      const gross = +(pts * qty * mult).toFixed(2);
      const fees = +(qty * 2 * (sym === 'ES' ? 2.1 : 0.62)).toFixed(2);
      const risk = +(3 * qty * mult).toFixed(2);
      const id = insertTrade({
        account_id: acct, symbol: sym, instrument_type: 'future', side, qty, entry_price: entry, exit_price: exit,
        open_time: open.toISOString(), close_time: close.toISOString(), gross_pnl: gross, fees, net_pnl: +(gross - fees).toFixed(2),
        multiplier: mult, planned_risk: risk, playbook_id: pbs[Math.floor(rand() * pbs.length)], rating: 1 + Math.floor(rand() * 5),
        source: 'demo', external_id: `demo-${acct}-${n++}`,
      });
      if (rand() < 0.25) setTags(id, [{ name: mistakes[Math.floor(rand() * mistakes.length)], category: 'mistake' }]);
    }
  }
  return { account_id: acct, trades: n };
}
