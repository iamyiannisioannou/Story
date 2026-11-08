import { useMemo, useState } from 'react';
import { Page } from '../components/Layout.jsx';
import { GroupBars, CumulativeChart } from '../components/Charts.jsx';
import { useStore } from '../lib/store.jsx';
import {
  summarize, dailyStats, daySummary, cumulative, groupSummary, durationBucket, DURATION_BUCKETS, WEEKDAYS, zonedParts, tradeTime, dayKey,
} from '../../shared/metrics.js';
import { money, pct, num, duration, cls, fmtDay } from '../lib/format.js';

const SECTIONS = [
  ['overview', 'Overview'],
  ['days', 'Day of week'],
  ['weeks', 'Weeks'],
  ['months', 'Months'],
  ['time', 'Trade time (hour)'],
  ['duration', 'Trade duration'],
  ['symbol', 'Symbol'],
  ['side', 'Side'],
  ['playbook', 'Playbook'],
  ['setup', 'Setups'],
  ['mistake', 'Mistakes'],
  ['r', 'R-multiple'],
];

function HBar({ value, max }) {
  const w = max ? Math.min(Math.abs(value) / max, 1) * 100 : 0;
  return (
    <div className="hbar">
      <div className="half l">{value < 0 && <div style={{ width: `${w}%`, background: 'var(--red-2)' }} />}</div>
      <div className="mid" />
      <div className="half r">{value > 0 && <div style={{ width: `${w}%`, background: 'var(--green-2)' }} />}</div>
    </div>
  );
}

function GroupTable({ rows, keyLabel }) {
  const max = Math.max(0, ...rows.map(r => Math.abs(r.netPnl)));
  if (!rows.length) return <div className="empty">No data for this report in the current selection.</div>;
  return (
    <>
      <GroupBars rows={rows} />
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>{keyLabel}</th><th className="num">Net P&L</th><th></th><th className="num">Trades</th><th className="num">Win %</th><th className="num">Profit factor</th><th className="num">Avg win</th><th className="num">Avg loss</th><th className="num">Expectancy</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.key}>
              <td>{r.label ?? r.key}</td>
              <td className={'num ' + cls(r.netPnl)}>{money(r.netPnl)}</td>
              <td><HBar value={r.netPnl} max={max} /></td>
              <td className="num">{r.count}</td>
              <td className="num">{pct(r.winRate)}</td>
              <td className="num">{num(r.profitFactor)}</td>
              <td className="num pos">{money(r.avgWin)}</td>
              <td className="num neg">{r.avgLoss ? '-' + money(r.avgLoss) : money(0)}</td>
              <td className={'num ' + cls(r.expectancy)}>{money(r.expectancy)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

function Overview({ trades, tz }) {
  const s = summarize(trades);
  const daily = cumulative(dailyStats(trades, tz));
  const d = daySummary(daily);
  const months = groupSummary(trades, t => dayKey(tradeTime(t), tz)?.slice(0, 7));
  const best = months.reduce((a, m) => (!a || m.netPnl > a.netPnl ? m : a), null);
  const worst = months.reduce((a, m) => (!a || m.netPnl < a.netPnl ? m : a), null);
  const L = [
    ['Total P&L', money(s.netPnl)], ['Average trade P&L', money(s.expectancy)], ['Total number of trades', s.count],
    ['Number of winning trades', s.wins], ['Number of losing trades', s.losses], ['Number of break-even trades', s.breakevens],
    ['Win rate (excl. break-even)', pct(s.winRate)], ['Profit factor', num(s.profitFactor)], ['Average winning trade', money(s.avgWin)],
    ['Average losing trade', s.avgLoss ? '-' + money(s.avgLoss) : money(0)], ['Largest profit', money(s.largestWin)], ['Largest loss', money(s.largestLoss)],
    ['Max consecutive wins', s.maxConsecWins], ['Max consecutive losses', s.maxConsecLosses], ['Total fees & commissions', money(s.totalFees)],
    ['Max drawdown (trade equity)', s.maxDrawdown ? '-' + money(s.maxDrawdown) : money(0)], ['Average hold time (all)', duration(s.avgHoldMs)],
    ['Average hold time (winners)', duration(s.avgHoldWinMs)], ['Average hold time (losers)', duration(s.avgHoldLossMs)],
  ];
  const R = [
    ['Total trading days', d.tradingDays], ['Winning days', d.winningDays], ['Losing days', d.losingDays], ['Break-even days', d.breakevenDays],
    ['Day win rate', pct(d.dayWinRate)], ['Average daily P&L', money(d.avgDailyPnl)], ['Average winning day P&L', money(d.avgWinningDay)],
    ['Average losing day P&L', money(d.avgLosingDay)], ['Largest profitable day', d.bestDay ? `${money(d.bestDay.net)} (${fmtDay(d.bestDay.date, { month: 'short', day: 'numeric', year: 'numeric' })})` : '—'],
    ['Largest losing day', d.worstDay ? `${money(d.worstDay.net)} (${fmtDay(d.worstDay.date, { month: 'short', day: 'numeric', year: 'numeric' })})` : '—'],
    ['Max consecutive winning days', d.maxConsecWinDays], ['Max consecutive losing days', d.maxConsecLossDays], ['Total volume (contracts/shares)', s.totalVolume],
    ['Average realized R-multiple', s.avgR == null ? '—' : num(s.avgR) + 'R'], ['Trade expectancy', money(s.expectancy)],
  ];
  return (
    <>
      <div className="grid3">
        <div><div className="muted small">Best month</div><b className={cls(best?.netPnl)}>{best ? money(best.netPnl) : '—'}</b> <span className="muted small">{best?.key}</span></div>
        <div><div className="muted small">Lowest month</div><b className={cls(worst?.netPnl)}>{worst ? money(worst.netPnl) : '—'}</b> <span className="muted small">{worst?.key}</span></div>
        <div><div className="muted small">Average per month</div><b>{months.length ? money(s.netPnl / months.length) : '—'}</b></div>
      </div>
      <CumulativeChart data={daily} height={240} />
      <div className="stat-list">
        <div style={{ display: 'block', border: 0, padding: 0 }}>{L.map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 4px', borderBottom: '1px solid var(--border)' }}><span>{k}</span><b style={{ fontWeight: 500 }}>{v}</b></div>)}</div>
        <div style={{ display: 'block', border: 0, padding: 0 }}>{R.map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 4px', borderBottom: '1px solid var(--border)' }}><span>{k}</span><b style={{ fontWeight: 500 }}>{v}</b></div>)}</div>
      </div>
    </>
  );
}

function weekStart(key) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const { filtered, tz, playbooks } = useStore();
  const [sec, setSec] = useState('overview');
  const rows = useMemo(() => {
    const t = filtered;
    switch (sec) {
      case 'days': return groupSummary(t, x => WEEKDAYS[zonedParts(tradeTime(x), tz).weekday], WEEKDAYS);
      case 'weeks': return groupSummary(t, x => weekStart(dayKey(tradeTime(x), tz))).sort((a, b) => a.key.localeCompare(b.key)).map(r => ({ ...r, label: `Week of ${r.key}` }));
      case 'months': return groupSummary(t, x => dayKey(tradeTime(x), tz).slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
      case 'time': return groupSummary(t, x => zonedParts(x.open_time, tz).hour).sort((a, b) => a.key - b.key).map(r => ({ ...r, key: `${String(r.key).padStart(2, '0')}:00` }));
      case 'duration': return groupSummary(t, durationBucket, DURATION_BUCKETS.map(b => b[0]));
      case 'symbol': return groupSummary(t, x => x.symbol).sort((a, b) => b.netPnl - a.netPnl);
      case 'side': return groupSummary(t, x => (x.side === 'long' ? 'Long' : 'Short'));
      case 'playbook': { const m = new Map(playbooks.map(p => [p.id, p.name])); return groupSummary(t, x => m.get(x.playbook_id) || 'No playbook').sort((a, b) => b.netPnl - a.netPnl); }
      case 'setup': return groupSummary(t, x => x.tags.filter(g => g.category === 'setup').map(g => g.name)).sort((a, b) => b.netPnl - a.netPnl);
      case 'mistake': return groupSummary(t, x => x.tags.filter(g => g.category === 'mistake').map(g => g.name)).sort((a, b) => a.netPnl - b.netPnl);
      case 'r': {
        const B = ['< -2R', '-2R to -1R', '-1R to 0R', '0R to 1R', '1R to 2R', '2R to 3R', '≥ 3R'];
        const b = r => (r < -2 ? B[0] : r < -1 ? B[1] : r < 0 ? B[2] : r < 1 ? B[3] : r < 2 ? B[4] : r < 3 ? B[5] : B[6]);
        return groupSummary(t.filter(x => Number(x.planned_risk) > 0), x => b(x.net_pnl / x.planned_risk), B);
      }
      default: return [];
    }
  }, [sec, filtered, tz, playbooks]);
  const label = SECTIONS.find(s => s[0] === sec)[1];
  return (
    <Page title="Reports">
      <div className="card" style={{ display: 'flex', alignItems: 'stretch' }}>
        <div className="report-nav" style={{ borderRight: '1px solid var(--border)' }}>
          {SECTIONS.map(([k, l]) => <button key={k} className={sec === k ? 'on' : ''} onClick={() => setSec(k)}>{l}</button>)}
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="row"><h2 style={{ fontSize: 18 }}>{sec === 'overview' ? 'Your stats' : label}</h2><span className="muted small">({filtered.length} trades in selection)</span></div>
          {sec === 'overview' ? <Overview trades={filtered} tz={tz} /> : (
            <>
              {sec === 'r' && <div className="banner info">Only trades with a planned risk are included (R = net P&L ÷ planned risk).</div>}
              <GroupTable rows={rows} keyLabel={label} />
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
