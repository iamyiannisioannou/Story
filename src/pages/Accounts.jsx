import { useState } from 'react';
import { Plus, Pencil, Trash2, Archive } from 'lucide-react';
import { Page, Modal } from '../components/Layout.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { money, cls } from '../lib/format.js';

const BROKERS = ['Tradovate', 'TradeSea', 'NinjaTrader', 'Interactive Brokers', 'TopStep', 'Apex', 'MetaTrader 5', 'Other'];

function AccountModal({ account, onClose }) {
  const { refresh, notify } = useStore();
  const [f, setF] = useState({ name: account?.name || '', broker: account?.broker || 'Tradovate', currency: account?.currency || 'USD', initial_balance: account?.initial_balance ?? 0 });
  const [err, setErr] = useState(null);
  async function save() {
    if (!f.name.trim()) return setErr('Name is required');
    const body = { ...f, initial_balance: Number(f.initial_balance) || 0 };
    try { if (account) await api.put(`/api/accounts/${account.id}`, body); else await api.post('/api/accounts', body); await refresh(); notify('Account saved'); onClose(); } catch (e) { setErr(e.message); }
  }
  return (
    <Modal title={account ? 'Edit account' : 'Add account'} onClose={onClose} width={520}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      {err && <div className="banner lock">{err}</div>}
      <div className="field"><label>Account name</label><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Tradovate 50K eval" /></div>
      <div className="grid2">
        <div className="field"><label>Broker / platform</label><select className="input" value={f.broker} onChange={e => setF({ ...f, broker: e.target.value })}>{BROKERS.map(b => <option key={b}>{b}</option>)}</select></div>
        <div className="field"><label>Currency</label><select className="input" value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{['USD', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="field"><label>Starting balance</label><input className="input" type="number" step="any" value={f.initial_balance} onChange={e => setF({ ...f, initial_balance: e.target.value })} /></div>
      <div className="muted small">Accounts are manual. Connection type: <b>File upload / manual entry</b>. No broker connection is made.</div>
    </Modal>
  );
}

export default function Accounts() {
  const { accounts, refresh, notify } = useStore();
  const [modal, setModal] = useState(null);
  async function del(a) {
    if (!confirm(`Delete "${a.name}" and ALL its ${a.trade_count} trades and screenshots? This cannot be undone.`)) return;
    await api.del(`/api/accounts/${a.id}`); await refresh(); notify('Account deleted');
  }
  async function archive(a) { await api.put(`/api/accounts/${a.id}`, { archived: a.archived ? 0 : 1 }); await refresh(); }
  return (
    <Page title="Accounts">
      <div className="row"><span className="muted">Track several accounts and combine or separate them with the account selector at the top.</span><span className="spacer" />
        <button className="btn primary" onClick={() => setModal({})}><Plus size={16} />Add account</button></div>
      <div className="card card-b">
        {accounts.length === 0 ? <div className="empty">No accounts yet.</div> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Broker</th><th>Connection</th><th className="num">Trades</th><th className="num">Starting balance</th><th className="num">Net P&L</th><th className="num">Balance</th><th /></tr></thead>
            <tbody>{accounts.map(a => (
              <tr key={a.id} style={a.archived ? { opacity: 0.55 } : null}>
                <td style={{ fontWeight: 500 }}>{a.name} {a.is_demo ? <span className="pill">demo data</span> : null} {a.archived ? <span className="pill">archived</span> : null}</td>
                <td>{a.broker}</td><td className="muted">File upload / manual</td>
                <td className="num">{a.trade_count}</td><td className="num">{money(a.initial_balance)}</td>
                <td className={'num ' + cls(a.net_pnl)}>{money(a.net_pnl)}</td><td className="num">{money(a.initial_balance + a.net_pnl)}</td>
                <td className="row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn sm" onClick={() => setModal(a)}><Pencil size={14} /></button>
                  <button className="btn sm" onClick={() => archive(a)} title={a.archived ? 'Unarchive' : 'Archive'}><Archive size={14} /></button>
                  <button className="btn sm danger" onClick={() => del(a)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {modal && <AccountModal account={modal.id ? modal : null} onClose={() => setModal(null)} />}
    </Page>
  );
}
