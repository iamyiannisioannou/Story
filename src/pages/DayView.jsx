import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, NotebookPen } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis, ReferenceLine } from 'recharts';
import { Page } from '../components/Layout.jsx';
import TradesTable from '../components/TradesTable.jsx';
import Calendar from '../components/Calendar.jsx';
import Screenshots from '../components/Screenshots.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { dailyStats, summarize, sortChrono, net } from '../../shared/metrics.js';
import { money, pct, num, fmtDay, cls } from '../lib/format.js';

function Intraday({ trades }) {
  let c = 0;
  const data = [{ i: 0, v: 0 }, ...sortChrono(trades).map((t, i) => ({ i: i + 1, v: (c += net(t)) }))];
  const col = c >= 0 ? '#4fc29b' : '#f07c85';
  return (
    <ResponsiveContainer width={220} height={90}>
      <AreaChart data={data} margin={{ top: 6, bottom: 6, left: 0, right: 0 }}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <ReferenceLine y={0} stroke="#d0cfdc" strokeDasharray="3 3" />
        <Area dataKey="v" stroke={col} fill={col} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DayNote({ date }) {
  const { notify } = useStore();
  const [entry, setEntry] = useState(null);
  const [text, setText] = useState('');
  const load = () => api.get(`/api/journal/${date}`).then(e => { setEntry(e); setText(e.content); });
  useEffect(() => { load(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!entry) return null;
  const save = async () => { await api.put(`/api/journal/${date}`, { content: text, mood: entry.mood }); notify('Day note saved'); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea className="input" value={text} onChange={e => setText(e.target.value)} placeholder="Pre-market plan, how the session went, lessons…" />
      <div className="row"><span className="spacer" /><button className="btn primary sm" onClick={save} disabled={text === entry.content}>Save note</button></div>
      <Screenshots items={entry.attachments} uploadUrl={`/api/journal/${date}/attachments`} onChange={load} />
    </div>
  );
}

export default function DayView() {
  const { filtered, tz } = useStore();
  const [params, setParams] = useSearchParams();
  const focus = params.get('date');
  const days = useMemo(() => dailyStats(filtered, tz).reverse(), [filtered, tz]);
  const [open, setOpen] = useState(() => new Set(focus ? [focus] : []));
  const [noteOpen, setNoteOpen] = useState(() => new Set());
  const [limit, setLimit] = useState(15);

  useEffect(() => {
    if (focus) {
      setOpen(o => new Set([...o, focus]));
      const idx = days.findIndex(d => d.date === focus);
      if (idx >= limit) setLimit(idx + 5);
      setTimeout(() => document.getElementById(`day-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [focus, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (set, setter, k) => { const s = new Set(set); s.has(k) ? s.delete(k) : s.add(k); setter(s); };

  return (
    <Page title="Day View">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 420px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {days.length === 0 && <div className="card empty">No trading days in the current selection.</div>}
          {days.slice(0, limit).map(d => {
            const s = summarize(d.trades);
            const isOpen = open.has(d.date);
            return (
              <div key={d.date} id={`day-${d.date}`} className="card" style={focus === d.date ? { borderColor: 'var(--primary)' } : null}>
                <div className="card-h" style={{ cursor: 'pointer' }} onClick={() => toggle(open, setOpen, d.date)}>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <span>{fmtDay(d.date)}</span>
                  <span className="muted">·</span>
                  <span className={cls(d.net)}>Net P&L {money(d.net)}</span>
                  <span className="spacer" />
                  <button className="btn sm" onClick={e => { e.stopPropagation(); toggle(noteOpen, setNoteOpen, d.date); }}><NotebookPen size={14} />{noteOpen.has(d.date) ? 'Hide note' : 'Day note'}</button>
                </div>
                <div className="card-b row" style={{ gap: 32, flexWrap: 'wrap' }}>
                  <Intraday trades={d.trades} />
                  <div className="grid3" style={{ flex: 1, minWidth: 360, gap: 12 }}>
                    <div><div className="muted small">Total trades</div><b>{s.count}</b></div>
                    <div><div className="muted small">Winners / losers</div><b>{s.wins} / {s.losses}</b></div>
                    <div><div className="muted small">Gross P&L</div><b>{money(d.trades.reduce((a, t) => a + (Number(t.gross_pnl) || 0), 0))}</b></div>
                    <div><div className="muted small">Win rate</div><b>{pct(s.winRate)}</b></div>
                    <div><div className="muted small">Profit factor</div><b>{num(s.profitFactor)}</b></div>
                    <div><div className="muted small">Fees</div><b>{money(s.totalFees)}</b></div>
                  </div>
                </div>
                {noteOpen.has(d.date) && <div className="card-b" style={{ borderTop: '1px solid var(--border)' }}><DayNote date={d.date} /></div>}
                {isOpen && <div className="card-b" style={{ borderTop: '1px solid var(--border)' }}><TradesTable trades={d.trades} columns={['time', 'symbol', 'side', 'qty', 'entry', 'exit', 'net', 'status', 'hold', 'playbook']} initialSort={['time', 'asc']} /></div>}
              </div>
            );
          })}
          {days.length > limit && <button className="btn" onClick={() => setLimit(l => l + 15)}>Load more days</button>}
        </div>
        <div style={{ position: 'sticky', top: 100 }}>
          <CompactCal days={days} tz={tz} onPick={k => setParams({ date: k })} />
        </div>
      </div>
    </Page>
  );
}

function CompactCal({ days, tz }) {
  return <Calendar daily={[...days].reverse()} tz={tz} />;
}
