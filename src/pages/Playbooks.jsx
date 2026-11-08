import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, MoreHorizontal, LayoutGrid, List, ArrowLeft, Trash2, Pencil } from 'lucide-react';
import { Page, Modal } from '../components/Layout.jsx';
import { Donut, KpiRow } from '../components/Widgets.jsx';
import TradesTable from '../components/TradesTable.jsx';
import { CumulativeChart } from '../components/Charts.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { summarize, dailyStats, cumulative } from '../../shared/metrics.js';
import { money, pct, num, cls } from '../lib/format.js';

const ICONS = ['🚀', '🎯', '🔄', '📈', '📉', '⚡', '🧲', '🪤', '🧱', '🌅', '🔥', '❌'];

function PlaybookModal({ pb, onClose }) {
  const { refresh, notify } = useStore();
  const [f, setF] = useState({ name: pb?.name || '', icon: pb?.icon || '🚀', description: pb?.description || '', rules: pb?.rules?.length ? pb.rules : [{ key: 'r0', text: '' }] });
  const [err, setErr] = useState(null);
  const setRule = (i, text) => setF(x => ({ ...x, rules: x.rules.map((r, j) => (j === i ? { ...r, text } : r)) }));
  async function save() {
    if (!f.name.trim()) return setErr('Name is required');
    const body = { ...f, rules: f.rules.filter(r => r.text.trim()) };
    try {
      if (pb) await api.put(`/api/playbooks/${pb.id}`, body); else await api.post('/api/playbooks', body);
      await refresh(); notify('Playbook saved'); onClose();
    } catch (e) { setErr(e.message); }
  }
  return (
    <Modal title={pb ? 'Edit playbook' : 'Create playbook'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save playbook</button></>}>
      {err && <div className="banner lock">{err}</div>}
      <div className="field"><label>Icon</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>{ICONS.map(i => <button key={i} className={'pb-ico' + (f.icon === i ? ' soft' : '')} style={{ background: f.icon === i ? 'var(--primary-50)' : '#fff', borderColor: f.icon === i ? 'var(--primary)' : undefined }} onClick={() => setF(x => ({ ...x, icon: i }))}>{i}</button>)}</div></div>
      <div className="field"><label>Name</label><input className="input" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></div>
      <div className="field"><label>Description</label><textarea className="input" style={{ minHeight: 80 }} value={f.description} onChange={e => setF(x => ({ ...x, description: e.target.value }))} /></div>
      <div className="field"><label>Rules (checked per trade on the trade page)</label>
        {f.rules.map((r, i) => (
          <div key={r.key} className="row">
            <input className="input" value={r.text} onChange={e => setRule(i, e.target.value)} placeholder={`Rule ${i + 1}`} />
            <button className="btn sm ghost" onClick={() => setF(x => ({ ...x, rules: x.rules.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF(x => ({ ...x, rules: [...x.rules, { key: `r${Date.now()}`, text: '' }] }))}><Plus size={14} />Add rule</button>
      </div>
    </Modal>
  );
}

export function Playbooks() {
  const { playbooks, filtered } = useStore();
  const nav = useNavigate();
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('name');
  const [modal, setModal] = useState(null);
  const stats = useMemo(() => new Map(playbooks.map(p => [p.id, summarize(filtered.filter(t => t.playbook_id === p.id))])), [playbooks, filtered]);
  const list = [...playbooks].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'pnl' ? stats.get(b.id).netPnl - stats.get(a.id).netPnl : stats.get(b.id).count - stats.get(a.id).count));
  return (
    <Page title="Playbooks">
      <div className="row">
        <div className="seg"><button className="on">My playbooks</button></div>
        <span className="spacer" />
        <div className="seg"><button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List size={16} /></button><button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}><LayoutGrid size={16} /></button></div>
        <span className="muted small">Sort by</span>
        <select className="input" style={{ width: 160 }} value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name A–Z</option><option value="pnl">Net P&L</option><option value="count">Trades</option></select>
        <button className="btn primary" onClick={() => setModal({})}><Plus size={16} />Create playbook</button>
      </div>
      {list.length === 0 && <div className="card empty">No playbooks yet. Create one to describe a setup and the rules you follow, then assign trades to it.</div>}
      {view === 'grid' ? (
        <div className="pb-grid">
          {list.map(p => {
            const s = stats.get(p.id);
            return (
              <div key={p.id} className="card pb-card" onClick={() => nav(`/playbooks/${p.id}`)}>
                <div className="row"><div className="pb-ico">{p.icon || '📘'}</div><span style={{ fontSize: 18, fontWeight: 500 }}>{p.name}</span><span className="spacer" />
                  <button className="btn ghost sm" onClick={e => { e.stopPropagation(); setModal(p); }} title="Edit"><MoreHorizontal size={18} /></button></div>
                <div className="row"><a>{s.count} trades</a></div>
                <div className="row" style={{ gap: 14 }}>
                  <Donut wins={s.wins} losses={s.losses} be={s.breakevens} size={44} />
                  <div style={{ flex: 1 }}><div className="muted small">Win rate</div><div style={{ fontSize: 18, fontWeight: 500 }}>{pct(s.winRate)}</div></div>
                  <div style={{ flex: 1 }}><div className="muted small">Net P&L</div><div style={{ fontSize: 18, fontWeight: 500 }} className={cls(s.netPnl)}>{money(s.netPnl)}</div></div>
                </div>
                {p.description && <div className="muted">{p.description}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card card-b">
          <table className="table"><thead><tr><th>Playbook</th><th className="num">Trades</th><th className="num">Win %</th><th className="num">Net P&L</th><th className="num">Profit factor</th><th className="num">Expectancy</th></tr></thead>
            <tbody>{list.map(p => { const s = stats.get(p.id); return (
              <tr key={p.id} className="click" onClick={() => nav(`/playbooks/${p.id}`)}><td>{p.icon} {p.name}</td><td className="num">{s.count}</td><td className="num">{pct(s.winRate)}</td><td className={'num ' + cls(s.netPnl)}>{money(s.netPnl)}</td><td className="num">{num(s.profitFactor)}</td><td className="num">{money(s.expectancy)}</td></tr>
            ); })}</tbody></table>
        </div>
      )}
      {modal && <PlaybookModal pb={modal.id ? modal : null} onClose={() => setModal(null)} />}
    </Page>
  );
}

export function PlaybookDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { playbooks, filtered, tz, refresh } = useStore();
  const [edit, setEdit] = useState(false);
  const p = playbooks.find(x => String(x.id) === id);
  const trades = useMemo(() => filtered.filter(t => String(t.playbook_id) === id), [filtered, id]);
  const s = useMemo(() => summarize(trades), [trades]);
  const daily = useMemo(() => cumulative(dailyStats(trades, tz)), [trades, tz]);
  if (!p) return <Page title="Playbook"><div className="card empty">Playbook not found.</div></Page>;
  async function del() {
    if (!confirm('Delete this playbook? Trades keep existing but lose the playbook link.')) return;
    await api.del(`/api/playbooks/${p.id}`); await refresh(); nav('/playbooks');
  }
  return (
    <Page title="Playbook">
      <div className="row">
        <button className="btn ghost sm" onClick={() => nav('/playbooks')}><ArrowLeft size={16} />Playbooks</button>
        <div className="pb-ico">{p.icon}</div><span style={{ fontSize: 22, fontWeight: 500 }}>{p.name}</span>
        <span className="spacer" />
        <button className="btn sm" onClick={() => setEdit(true)}><Pencil size={14} />Edit</button>
        <button className="btn sm danger" onClick={del}><Trash2 size={14} />Delete</button>
      </div>
      <KpiRow s={s} />
      <div className="dash-row2">
        <div className="card"><div className="card-h">Description & rules</div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>{p.description || <span className="muted">No description</span>}</div>
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>{p.rules.map(r => <li key={r.key}>{r.text}</li>)}</ol>
          </div></div>
        <div className="card"><div className="card-h">Cumulative P&L</div><div className="card-b"><CumulativeChart data={daily} height={240} /></div></div>
      </div>
      <div className="card"><div className="card-h">Trades <span className="pill">{trades.length}</span></div>
        <div className="card-b"><TradesTable trades={trades} columns={['open', 'symbol', 'side', 'net', 'status', 'hold', 'r']} /></div></div>
      {edit && <PlaybookModal pb={p} onClose={() => setEdit(false)} />}
    </Page>
  );
}
