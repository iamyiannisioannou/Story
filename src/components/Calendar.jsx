import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { moneyCompact, money } from '../lib/format.js';
import { dayKey } from '../../shared/metrics.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Month calendar with daily P&L and a weekly summary column. `daily` = output of dailyStats(). */
export default function Calendar({ daily, tz, initial }) {
  const nav = useNavigate();
  const today = dayKey(new Date().toISOString(), tz);
  const start = initial || (daily.length ? daily[daily.length - 1].date : today);
  const [ym, setYm] = useState(() => ({ y: +start.slice(0, 4), m: +start.slice(5, 7) - 1 }));
  const byDay = useMemo(() => new Map(daily.map(d => [d.date, d])), [daily]);

  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const daysIn = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(`${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthDays = cells.filter(Boolean).map(k => byDay.get(k)).filter(Boolean);
  const monthNet = monthDays.reduce((a, d) => a + d.net, 0);
  const go = delta => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  return (
    <div className="card">
      <div className="cal-head">
        <button className="btn ghost sm" onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <button className="btn ghost sm" onClick={() => go(1)} aria-label="Next month"><ChevronRight size={18} /></button>
        <span style={{ fontWeight: 500, fontSize: 16 }}>{MONTHS[ym.m]} {ym.y}</span>
        <button className="btn sm" onClick={() => setYm({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 })}>This month</button>
        <span className="spacer" />
        <span className="muted small">Monthly P&L: </span><b className={monthNet >= 0 ? 'pos' : 'neg'}>{money(monthNet)}</b>
        <span className="muted small">· {monthDays.length} days</span>
        <span className="info" title="Days are grouped by trade close time in your configured time zone. Click a day to open it in Day View."><Info size={16} /></span>
      </div>
      <div className="cal-grid">
        {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
        <div className="cal-dow">Week</div>
        {weeks.map((w, wi) => {
          const ds = w.filter(Boolean).map(k => byDay.get(k)).filter(Boolean);
          const wn = ds.reduce((a, d) => a + d.net, 0);
          return [
            ...w.map((k, i) => {
              if (!k) return <div key={`e${wi}${i}`} className="cal-cell out" />;
              const d = byDay.get(k);
              const c = d ? (d.net > 0 ? ' win' : d.net < 0 ? ' loss' : ' be') : '';
              return (
                <div key={k} className={'cal-cell' + c + (k === today ? ' today' : '')} onClick={d ? () => nav(`/day-view?date=${k}`) : undefined} title={d ? `${k}: ${money(d.net)}` : k}>
                  <span className="d">{String(+k.slice(8)).padStart(2, '0')}</span>
                  {d && <><span className="v">{moneyCompact(d.net)}</span><span className="n">{d.count} trade{d.count === 1 ? '' : 's'}</span><span className="n">{(d.winRate * 100).toFixed(0)}%</span></>}
                </div>
              );
            }),
            <div key={`w${wi}`} className="cal-week">
              <span className="muted">Week {wi + 1}</span>
              <span className={'v ' + (wn > 0 ? 'pos' : wn < 0 ? 'neg' : '')}>{ds.length ? moneyCompact(wn) : '$0'}</span>
              <span className="muted">{ds.length} day{ds.length === 1 ? '' : 's'}</span>
            </div>,
          ];
        })}
      </div>
    </div>
  );
}
