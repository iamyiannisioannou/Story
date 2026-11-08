import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Trash2, Star, X, CheckCircle2, Circle } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import TradeModal from '../components/TradeModal.jsx';
import Screenshots from '../components/Screenshots.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { money, fmtDate, fmtTime, duration, cls, num } from '../lib/format.js';
import { outcome, rMultiple, holdMs } from '../../shared/metrics.js';

function TagEditor({ trade, category, label, onSave }) {
  const { tags } = useStore();
  const [val, setVal] = useState('');
  const mine = trade.tags.filter(t => t.category === category);
  const options = tags.filter(t => t.category === category && !mine.some(m => m.id === t.id));
  const add = name => { if (!name.trim()) return; onSave([...trade.tags, { name: name.trim(), category }]); setVal(''); };
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {mine.map(t => (
          <span key={t.id} className={'tag' + (category === 'mistake' ? ' mistake' : '')}>{t.name}
            <button onClick={() => onSave(trade.tags.filter(x => x.id !== t.id))} aria-label="Remove"><X size={12} /></button></span>
        ))}
        {!mine.length && <span className="muted small">None</span>}
      </div>
      <div className="row">
        <input className="input" list={`tags-${category}`} value={val} onChange={e => setVal(e.target.value)} placeholder={`Add ${label.toLowerCase()}…`}
          onKeyDown={e => e.key === 'Enter' && add(val)} />
        <datalist id={`tags-${category}`}>{options.map(o => <option key={o.id} value={o.name} />)}</datalist>
        <button className="btn sm" onClick={() => add(val)}>Add</button>
      </div>
    </div>
  );
}

export default function TradeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { tz, playbooks, accounts, filtered, refresh, notify } = useStore();
  const [t, setT] = useState(null);
  const [err, setErr] = useState(null);
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(false);

  const load = () => api.get(`/api/trades/${id}`).then(x => { setT(x); setNotes(x.notes || ''); }).catch(e => setErr(e.message));
  useEffect(() => { setT(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ordered = useMemo(() => [...filtered].sort((a, b) => a.open_time.localeCompare(b.open_time)), [filtered]);
  const idx = ordered.findIndex(x => String(x.id) === String(id));
  const prev = idx > 0 ? ordered[idx - 1] : null, next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  async function patch(body, msg) {
    const x = await api.put(`/api/trades/${id}`, body);
    setT(x); setNotes(n => (body.notes !== undefined ? x.notes || '' : n));
    await refresh();
    if (msg) notify(msg);
  }
  async function del() {
    if (!confirm('Delete this trade and its screenshots?')) return;
    await api.post('/api/trades/delete', { ids: [Number(id)] });
    await refresh();
    nav('/trades');
  }

  if (err) return <Page title="Trade"><div className="card empty">{err} — <Link to="/trades">back to trades</Link></div></Page>;
  if (!t) return <Page title="Trade"><div className="card empty">Loading…</div></Page>;

  const o = outcome(t);
  const r = rMultiple(t);
  const pb = playbooks.find(p => p.id === t.playbook_id);
  const acct = accounts.find(a => a.id === t.account_id);
  const rows = [
    ['Account', acct?.name], ['Side', <span style={{ textTransform: 'capitalize' }}>{t.side}</span>], ['Instrument', t.instrument_type],
    ['Quantity', t.qty], ['Multiplier', t.multiplier ?? '—'], ['Entry price', t.entry_price ?? '—'], ['Exit price', t.exit_price ?? '—'],
    ['Open', `${fmtDate(t.open_time, tz)} ${fmtTime(t.open_time, tz)}`], ['Close', t.close_time ? `${fmtDate(t.close_time, tz)} ${fmtTime(t.close_time, tz)}` : '—'],
    ['Duration', duration(holdMs(t))], ['Gross P&L', <span className={cls(t.gross_pnl)}>{money(t.gross_pnl)}</span>], ['Fees & commissions', money(t.fees)],
    ['Planned risk', t.planned_risk ? money(t.planned_risk) : '—'], ['Realized R-multiple', r == null ? '—' : <span className={cls(r)}>{num(r)}R</span>],
    ['Stop loss', t.stop_loss ?? '—'], ['Profit target', t.profit_target ?? '—'], ['Source', t.source],
  ];

  return (
    <Page title="Trade details" actions={
      <div className="row">
        <button className="btn sm" disabled={!prev} onClick={() => nav(`/trades/${prev.id}`)}><ChevronLeft size={16} />Prev</button>
        <button className="btn sm" disabled={!next} onClick={() => nav(`/trades/${next.id}`)}>Next<ChevronRight size={16} /></button>
      </div>}>
      <div className="row">
        <button className="btn ghost sm" onClick={() => nav(-1)}><ArrowLeft size={16} />Back</button>
        <span style={{ fontSize: 22, fontWeight: 500 }}>{t.symbol}</span>
        <span className={'badge ' + (o === 'win' ? 'win' : o === 'loss' ? 'loss' : 'be')}>{o === 'breakeven' ? 'BE' : o.toUpperCase()}</span>
        <span className="muted">{fmtDate(t.open_time, tz, { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })}</span>
        <span className="spacer" />
        <button className={'btn sm' + (t.reviewed ? ' soft' : '')} onClick={() => patch({ reviewed: t.reviewed ? 0 : 1 }, t.reviewed ? 'Marked as not reviewed' : 'Marked as reviewed')}>
          {t.reviewed ? <CheckCircle2 size={15} /> : <Circle size={15} />}{t.reviewed ? 'Reviewed' : 'Mark reviewed'}</button>
        <button className="btn sm" onClick={() => setEditing(true)}><Pencil size={14} />Edit</button>
        <button className="btn sm danger" onClick={del}><Trash2 size={14} />Delete</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <div className="card-b" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="muted small">Net P&L</div>
            <div className={cls(t.net_pnl)} style={{ fontSize: 32, fontWeight: 500 }}>{money(t.net_pnl)}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="muted small">Rating</span>
              <span className="stars">{[1, 2, 3, 4, 5].map(n => (
                <button key={n} className={t.rating >= n ? 'on' : ''} onClick={() => patch({ rating: t.rating === n ? null : n })} aria-label={`${n} stars`}><Star size={18} fill="currentColor" /></button>
              ))}</span>
            </div>
          </div>
          <div className="card-b stat-list" style={{ gridTemplateColumns: '1fr' }}>
            {rows.map(([k, v]) => <div key={k}><span>{k}</span><span>{v}</span></div>)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card">
            <div className="card-h">Playbook & tags</div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field"><label>Playbook</label>
                <select className="input" value={t.playbook_id ?? ''} onChange={e => patch({ playbook_id: e.target.value ? Number(e.target.value) : null }, 'Playbook updated')}>
                  <option value="">None</option>{playbooks.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                </select></div>
              {pb && pb.rules.length > 0 && (
                <div className="field"><label>Playbook rules followed</label>
                  {pb.rules.map(rule => (
                    <label key={rule.key} className="row" style={{ cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
                      <input type="checkbox" checked={!!t.rule_checks[rule.key]} onChange={e => patch({ rule_checks: { [rule.key]: e.target.checked } })} style={{ accentColor: 'var(--primary)' }} />{rule.text}
                    </label>
                  ))}
                  <div className="muted small">{pb.rules.filter(x => t.rule_checks[x.key]).length} / {pb.rules.length} rules followed</div>
                </div>
              )}
              <div className="grid3">
                <TagEditor trade={t} category="setup" label="Setups" onSave={tags => patch({ tags })} />
                <TagEditor trade={t} category="mistake" label="Mistakes" onSave={tags => patch({ tags })} />
                <TagEditor trade={t} category="custom" label="Custom tags" onSave={tags => patch({ tags })} />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-h">Notes</div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea className="input" style={{ minHeight: 160 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why did you take it? What did you see? What would you do differently?" />
              <div className="row"><span className="spacer" /><button className="btn primary sm" disabled={notes === (t.notes || '')} onClick={() => patch({ notes }, 'Notes saved')}>Save notes</button></div>
            </div>
          </div>
          <div className="card">
            <div className="card-h">Screenshots <span className="pill">{t.attachments.length}</span></div>
            <div className="card-b"><Screenshots items={t.attachments} uploadUrl={`/api/trades/${id}/attachments`} onChange={async () => { await load(); await refresh(); }} /></div>
          </div>
        </div>
      </div>
      {editing && <TradeModal trade={t} onClose={() => setEditing(false)} onSaved={x => setT(x)} />}
    </Page>
  );
}
