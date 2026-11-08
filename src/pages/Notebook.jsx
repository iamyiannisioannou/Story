import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import Screenshots from '../components/Screenshots.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { dailyStats, dayKey } from '../../shared/metrics.js';
import { money, fmtDay, cls } from '../lib/format.js';

const TEMPLATES = {
  'Pre-market plan': '## Pre-market plan\n- Market context / news:\n- Key levels:\n- Setups I will trade:\n- Max risk today:\n- What I will NOT do:\n',
  'Daily recap': '## Daily recap\n- Did I follow my plan? (Y/N)\n- Best trade and why:\n- Worst trade and why:\n- Emotions during the session:\n- One thing to improve tomorrow:\n',
  'Loss recap': '## Loss recap\n- What happened:\n- Was it a valid setup?\n- Rule broken (if any):\n- What I learned:\n',
};
const MOODS = ['😣', '😕', '😐', '🙂', '😄'];

export default function Notebook() {
  const { tz, filtered, notify } = useStore();
  const [list, setList] = useState([]);
  const today = dayKey(new Date().toISOString(), tz);
  const [date, setDate] = useState(today);
  const [entry, setEntry] = useState(null);
  const [text, setText] = useState('');
  const daily = useMemo(() => new Map(dailyStats(filtered, tz).map(d => [d.date, d])), [filtered, tz]);

  const loadList = () => api.get('/api/journal').then(setList);
  const loadEntry = d => api.get(`/api/journal/${d}`).then(e => { setEntry(e); setText(e.content); });
  useEffect(() => { loadList(); }, []);
  useEffect(() => { loadEntry(date); }, [date]);

  async function save(mood = entry?.mood) {
    await api.put(`/api/journal/${date}`, { content: text, mood });
    setEntry(e => ({ ...e, content: text, mood }));
    await loadList();
    notify('Notebook saved');
  }
  const day = daily.get(date);
  const dates = [...new Set([today, ...list.map(l => l.date)])].sort().reverse();

  return (
    <Page title="Notebook">
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <div className="card-h">Entries<span className="spacer" />
            <input type="date" className="input" style={{ width: 150, height: 32 }} value={date} onChange={e => e.target.value && setDate(e.target.value)} title="Open another date" /></div>
          <div style={{ padding: 8, maxHeight: '70vh', overflow: 'auto' }}>
            {dates.map(d => {
              const l = list.find(x => x.date === d);
              const dd = daily.get(d);
              return (
                <div key={d} className="dd-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2, background: d === date ? 'var(--primary-50)' : undefined }} onClick={() => setDate(d)}>
                  <div className="row"><b style={{ fontWeight: 500 }}>{fmtDay(d)}</b><span className="spacer" />{l?.mood != null && MOODS[l.mood]}{dd && <span className={'small ' + cls(dd.net)}>{money(dd.net)}</span>}</div>
                  <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l?.preview || (d === today ? 'Today — no entry yet' : '')}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-h">{fmtDay(date)}
            {day && <span className={'small ' + cls(day.net)}>· Net P&L {money(day.net)} · {day.count} trades</span>}
            <span className="spacer" />
            {MOODS.map((m, i) => <button key={i} className="btn ghost sm" style={{ fontSize: 18, opacity: entry?.mood === i ? 1 : 0.35 }} onClick={() => save(entry?.mood === i ? null : i)} title="Mood">{m}</button>)}
          </div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="muted small">Templates:</span>
              {Object.entries(TEMPLATES).map(([k, v]) => <button key={k} className="btn sm" onClick={() => setText(t => (t ? t + '\n' : '') + v)}><Plus size={13} />{k}</button>)}
            </div>
            <textarea className="input" style={{ minHeight: 340, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} value={text} onChange={e => setText(e.target.value)} placeholder="Write your plan, recap or lessons for this day…" />
            <div className="row"><span className="muted small">Saved in your local database</span><span className="spacer" /><button className="btn primary" disabled={!entry || text === entry.content} onClick={() => save()}>Save</button></div>
            {entry && <Screenshots items={entry.attachments} uploadUrl={`/api/journal/${date}/attachments`} onChange={() => loadEntry(date)} />}
          </div>
        </div>
      </div>
    </Page>
  );
}
