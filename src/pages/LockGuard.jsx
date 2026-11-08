import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Info } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { RULE_FIELDS } from '../../shared/lockguard.js';
import { money, fmtDay } from '../lib/format.js';

const TZS = ['America/New_York', 'America/Chicago', 'Europe/London', 'Europe/Athens', 'UTC'];

function RulesForm({ account, onSaved }) {
  const { notify } = useStore();
  const [r, setR] = useState(null);
  useEffect(() => { api.get(`/api/lock-rules/${account.id}`).then(setR); }, [account.id]);
  if (!r) return null;
  const set = (k, v) => setR(x => ({ ...x, [k]: v }));
  async function save() {
    const body = { ...r };
    for (const [k] of RULE_FIELDS) body[k] = r[k] === '' || r[k] == null ? null : Number(r[k]);
    body.lock_time = r.lock_time || null;
    setR(await api.put(`/api/lock-rules/${account.id}`, body));
    notify('Rules saved');
    onSaved();
  }
  return (
    <div className="card">
      <div className="card-h">{account.name}<span className="spacer" />
        <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" checked={!!r.enabled} onChange={e => set('enabled', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />Rules enabled</label></div>
      <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid3">
          {RULE_FIELDS.map(([k, label]) => (
            <div key={k} className="field"><label>{label}</label>
              <input className="input" type="number" min="0" step={k.includes('daily') ? 'any' : '1'} value={r[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder="off" /></div>
          ))}
          <div className="field"><label>Daily lock time (HH:MM)</label><input className="input" type="time" value={r.lock_time || ''} onChange={e => set('lock_time', e.target.value)} /></div>
          <div className="field"><label>Trading-day time zone</label>
            <select className="input" value={r.timezone} onChange={e => set('timezone', e.target.value)}>{TZS.map(z => <option key={z}>{z}</option>)}</select></div>
        </div>
        <div className="row"><span className="muted small">Leave a field empty to disable that rule. Counters reset at midnight in the chosen time zone.</span><span className="spacer" /><button className="btn primary" onClick={save}>Save rules</button></div>
      </div>
    </div>
  );
}

export default function LockGuard() {
  const { accounts, lockStatus, refresh } = useStore();
  const [events, setEvents] = useState([]);
  useEffect(() => { api.get('/api/lock-events').then(setEvents); }, [lockStatus]);
  const active = accounts.filter(a => !a.archived);
  return (
    <Page title="Lock Guard">
      <div className="banner warn"><Info size={18} />
        <div><b>What works today:</b> rules are evaluated live against the trades stored here (imported or entered), and the app shows a lock banner and status.
          <b> What does not exist yet:</b> nothing locks your trading platform. That needs a small desktop helper on your Windows/Mac PC that polls <code>/api/lock-status</code> and blocks the platform.
          It also needs trades to arrive in real time, while CSV import is after the fact.</div></div>
      {lockStatus.filter(s => s.rules?.enabled).map(s => (
        <div key={s.account_id} className={'banner ' + (s.locked ? 'lock' : 'ok')}>
          {s.locked ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
          <div style={{ flex: 1 }}>
            <b>{s.account_name}: {s.locked ? 'LOCKED until the next trading day' : 'within your rules'}</b>
            <div className="small">Trading day {s.day} ({s.timezone}) · {s.counts.trades} trades · {s.counts.wins}W / {s.counts.losses}L / {s.counts.breakevens}BE · net {money(s.counts.net)}</div>
            {s.locked && <div className="small">Reason: {s.reasons.join(' · ')}</div>}
          </div>
          <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.progress.filter(p => p.key !== 'lock_time').map(p => {
              const ratio = p.key.includes('daily') ? Math.min(Math.abs(Math.min(p.key === 'max_daily_loss' ? p.value : -p.value, 0)) / p.limit, 1) : Math.min(p.value / p.limit, 1);
              const shown = p.key === 'max_daily_profit' ? Math.min(Math.max(p.value, 0) / p.limit, 1) : ratio;
              return (
                <div key={p.key} className="small"><div className="row"><span>{RULE_FIELDS.find(f => f[0] === p.key)?.[1]}</span><span className="spacer" /><span>{p.key.includes('daily') ? money(p.value) : p.value} / {p.key.includes('daily') ? money(p.limit) : p.limit}</span></div>
                  <div className="progress"><div style={{ width: `${shown * 100}%`, background: p.hit ? 'var(--red)' : 'var(--primary)' }} /></div></div>
              );
            })}
          </div>
        </div>
      ))}
      {active.length === 0 && <div className="card empty">Create an account first.</div>}
      {active.map(a => <RulesForm key={a.id} account={a} onSaved={refresh} />)}
      <div className="card"><div className="card-h">Lock history</div>
        <div className="card-b">
          {events.length === 0 ? <div className="muted">No locks recorded yet.</div> : (
            <table className="table"><thead><tr><th>Day</th><th>Account</th><th>Reasons</th></tr></thead>
              <tbody>{events.map(e => <tr key={e.id}><td>{fmtDay(e.day)}</td><td>{e.account_name}</td><td>{e.reasons.join(' · ')}</td></tr>)}</tbody></table>
          )}
        </div></div>
    </Page>
  );
}
