import { Info } from 'lucide-react';
import { money, pct, num } from '../lib/format.js';

export const InfoTip = ({ text }) => <span className="info" title={text}><Info size={14} /></span>;

export function KpiCard({ title, tip, value, valueClass, badge, right }) {
  return (
    <div className="card kpi">
      <div className="kpi-l">
        <div className="kpi-t">{title}<InfoTip text={tip} />{badge}</div>
        <div className={'kpi-v ' + (valueClass || '')}>{value}</div>
      </div>
      {right}
    </div>
  );
}

/** Half-circle gauge for profit factor: green share = gross profit / (gross profit + gross loss). */
export function Gauge({ profit, loss, size = 100 }) {
  const total = profit + loss;
  const share = total > 0 ? profit / total : 0;
  const r = size / 2 - 7, cx = size / 2, cy = size / 2;
  const arc = (from, to) => {
    const a0 = Math.PI * (1 - from), a1 = Math.PI * (1 - to);
    const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  return (
    <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
      <path d={arc(0, 1)} stroke="#ececf2" strokeWidth="8" fill="none" strokeLinecap="round" />
      {total > 0 && share > 0 && <path d={arc(0, Math.max(share, 0.001))} stroke="var(--green-2)" strokeWidth="8" fill="none" strokeLinecap="round" />}
      {total > 0 && share < 1 && <path d={arc(Math.min(share + 0.02, 0.999), 1)} stroke="var(--red-2)" strokeWidth="8" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

/** Ring split into wins / break-even / losses. */
export function Donut({ wins, losses, be = 0, size = 64 }) {
  const total = wins + losses + be;
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  const segs = total ? [[wins, 'var(--green-2)'], [be, '#6c7cf0'], [losses, 'var(--red-2)']] : [];
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#ececf2" strokeWidth="6" fill="none" />
      {segs.map(([v, col], i) => {
        const len = (v / total) * c;
        const el = v ? <circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth="6" fill="none" strokeDasharray={`${Math.max(len - 2, 0.5)} ${c}`} strokeDashoffset={-off} /> : null;
        off += len;
        return el;
      })}
    </svg>
  );
}

export function WinLossBar({ avgWin, avgLoss }) {
  const t = avgWin + avgLoss;
  return (
    <div style={{ width: 130, flex: 'none' }}>
      <div className="wl-bar"><div style={{ width: t ? `${(avgWin / t) * 100}%` : '50%', background: 'var(--green-2)' }} /><div style={{ flex: 1, background: 'var(--red-2)' }} /></div>
      <div className="row small" style={{ justifyContent: 'space-between', marginTop: 6 }}><span className="pos">{money(avgWin)}</span><span className="neg">-{money(avgLoss)}</span></div>
    </div>
  );
}

export function KpiRow({ s }) {
  return (
    <div className="kpis">
      <KpiCard title="Net P&L" tip="Sum of net P&L (after fees) of the filtered trades" value={money(s.netPnl)} valueClass={s.netPnl < 0 ? 'neg' : ''} badge={<span className="pill">{s.count}</span>} />
      <KpiCard title="Trade expectancy" tip="Average net P&L per trade = Net P&L / number of trades" value={money(s.expectancy)} valueClass={s.expectancy < 0 ? 'neg' : ''} />
      <KpiCard title="Profit factor" tip="Gross profit / |gross loss|" value={num(s.profitFactor)} right={<Gauge profit={s.grossProfit} loss={s.grossLoss} />} />
      <KpiCard title="Win %" tip="Winning trades / (winning + losing trades). Break-even trades are excluded."
        value={pct(s.winRate)} badge={<><span className="pill g">{s.wins}</span><span className="pill">{s.breakevens}</span><span className="pill r">{s.losses}</span></>}
        right={<Donut wins={s.wins} losses={s.losses} be={s.breakevens} />} />
      <KpiCard title="Avg win/loss" tip="Average winning trade / average losing trade" value={num(s.avgWinLossRatio)} right={<WinLossBar avgWin={s.avgWin} avgLoss={s.avgLoss} />} />
    </div>
  );
}

/** Small "scale" bar like the journal screenshot: shows realised R relative to -1R..+3R. */
export function RScale({ r }) {
  if (r == null) return <span className="muted">—</span>;
  const lo = -1, hi = 3, pos = v => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
  const z = pos(0), p = pos(r);
  const col = r >= 0 ? 'var(--green-2)' : 'var(--red-2)';
  return (
    <div className="scale" title={`${r.toFixed(2)} R`}>
      <div className="line" style={{ background: 'var(--red-2)', left: 0, width: `${z}%` }} />
      <div className="line" style={{ background: 'var(--green-2)', left: `${z}%`, right: 0 }} />
      <div className="fill" style={{ left: `${Math.min(z, p)}%`, width: `${Math.max(Math.abs(p - z), 2)}%`, background: col }} />
    </div>
  );
}
