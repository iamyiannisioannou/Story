import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Layout.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { pnlFromPrices, guessMultiplier } from '../../shared/metrics.js';
import { zonedToUtc } from '../../shared/importers.js';

// Datetime-local value (wall clock in tz) <-> ISO UTC
function toLocalInput(iso, tz) {
  if (!iso) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
function fromLocalInput(v, tz) {
  if (!v) return null;
  const [d, t] = v.split('T');
  const [Y, M, D] = d.split('-').map(Number);
  const [h, mi, s = 0] = t.split(':').map(Number);
  return zonedToUtc(Y, M, D, h, mi, s, tz);
}

export default function TradeModal({ trade, onClose, onSaved }) {
  const { accounts, playbooks, tz, refresh, notify, selectedAccounts } = useStore();
  const nav = useNavigate();
  const editing = !!trade;
  const [f, setF] = useState(() => ({
    account_id: trade?.account_id ?? selectedAccounts[0] ?? accounts[0]?.id ?? '',
    symbol: trade?.symbol ?? '', instrument_type: trade?.instrument_type ?? 'future', side: trade?.side ?? 'long',
    qty: trade?.qty ?? 1, entry_price: trade?.entry_price ?? '', exit_price: trade?.exit_price ?? '',
    open_time: toLocalInput(trade?.open_time, tz), close_time: toLocalInput(trade?.close_time, tz),
    multiplier: trade?.multiplier ?? '', fees: trade?.fees ?? 0, net_pnl: trade?.net_pnl ?? '',
    planned_risk: trade?.planned_risk ?? '', stop_loss: trade?.stop_loss ?? '', profit_target: trade?.profit_target ?? '',
    playbook_id: trade?.playbook_id ?? '', pnlMode: trade ? 'manual' : 'auto',
  }));
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const mult = f.multiplier !== '' ? Number(f.multiplier) : (f.instrument_type === 'future' ? guessMultiplier(f.symbol) : 1);
  const canAuto = f.entry_price !== '' && f.exit_price !== '' && f.qty && mult;
  const autoGross = canAuto ? pnlFromPrices({ side: f.side, qty: f.qty, entry_price: f.entry_price, exit_price: f.exit_price, multiplier: mult }) : null;
  const autoNet = autoGross != null ? autoGross - (Number(f.fees) || 0) : null;

  async function submit() {
    setErr(null);
    const net = f.pnlMode === 'auto' ? autoNet : Number(f.net_pnl);
    if (!f.account_id) return setErr('Create an account first (Accounts page).');
    if (!f.symbol.trim()) return setErr('Symbol is required.');
    if (!f.open_time) return setErr('Open time is required.');
    if (net == null || !Number.isFinite(net)) return setErr(f.pnlMode === 'auto' ? 'Enter entry, exit and quantity (and multiplier for futures) or switch to manual P&L.' : 'Enter the net P&L.');
    const body = {
      account_id: Number(f.account_id), symbol: f.symbol.trim().toUpperCase(), instrument_type: f.instrument_type, side: f.side,
      qty: Number(f.qty), entry_price: f.entry_price === '' ? null : Number(f.entry_price), exit_price: f.exit_price === '' ? null : Number(f.exit_price),
      open_time: fromLocalInput(f.open_time, tz), close_time: fromLocalInput(f.close_time, tz), multiplier: mult || null,
      fees: Number(f.fees) || 0, gross_pnl: f.pnlMode === 'auto' ? +autoGross.toFixed(2) : +(net + (Number(f.fees) || 0)).toFixed(2),
      net_pnl: +net.toFixed(2), planned_risk: f.planned_risk === '' ? null : Number(f.planned_risk),
      stop_loss: f.stop_loss === '' ? null : Number(f.stop_loss), profit_target: f.profit_target === '' ? null : Number(f.profit_target),
      playbook_id: f.playbook_id === '' ? null : Number(f.playbook_id),
    };
    setBusy(true);
    try {
      const saved = editing ? await api.put(`/api/trades/${trade.id}`, body) : await api.post('/api/trades', body);
      await refresh();
      notify(editing ? 'Trade updated' : 'Trade added');
      onSaved?.(saved);
      onClose();
      if (!editing) nav(`/trades/${saved.id}`);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <Modal title={editing ? 'Edit trade' : 'Add trade'} onClose={onClose} width={760}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={submit}>{editing ? 'Save changes' : 'Add trade'}</button></>}>
      {err && <div className="banner lock">{err}</div>}
      <div className="grid3">
        <div className="field"><label>Account</label>
          <select className="input" value={f.account_id} onChange={e => set('account_id', e.target.value)}>
            {accounts.length === 0 && <option value="">No accounts</option>}
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
        <div className="field"><label>Symbol</label><input className="input" value={f.symbol} onChange={e => set('symbol', e.target.value)} placeholder="MESZ5, AAPL…" /></div>
        <div className="field"><label>Instrument</label>
          <select className="input" value={f.instrument_type} onChange={e => set('instrument_type', e.target.value)}>
            <option value="future">Future</option><option value="stock">Stock</option><option value="option">Option</option><option value="forex">Forex</option><option value="crypto">Crypto</option>
          </select></div>
        <div className="field"><label>Side</label>
          <div className="seg"><button className={f.side === 'long' ? 'on' : ''} onClick={() => set('side', 'long')}>Long</button><button className={f.side === 'short' ? 'on' : ''} onClick={() => set('side', 'short')}>Short</button></div></div>
        <div className="field"><label>Quantity</label><input className="input" type="number" value={f.qty} onChange={e => set('qty', e.target.value)} /></div>
        <div className="field"><label>Multiplier {f.instrument_type === 'future' && mult ? <span className="muted">(auto: {mult})</span> : null}</label>
          <input className="input" type="number" value={f.multiplier} onChange={e => set('multiplier', e.target.value)} placeholder={f.instrument_type === 'future' ? String(guessMultiplier(f.symbol) ?? 'point value') : '1'} /></div>
        <div className="field"><label>Entry price</label><input className="input" type="number" step="any" value={f.entry_price} onChange={e => set('entry_price', e.target.value)} /></div>
        <div className="field"><label>Exit price</label><input className="input" type="number" step="any" value={f.exit_price} onChange={e => set('exit_price', e.target.value)} /></div>
        <div className="field"><label>Fees & commissions</label><input className="input" type="number" step="any" value={f.fees} onChange={e => set('fees', e.target.value)} /></div>
        <div className="field"><label>Open time ({tz})</label><input className="input" type="datetime-local" step="1" value={f.open_time} onChange={e => set('open_time', e.target.value)} /></div>
        <div className="field"><label>Close time ({tz})</label><input className="input" type="datetime-local" step="1" value={f.close_time} onChange={e => set('close_time', e.target.value)} /></div>
        <div className="field"><label>Playbook</label>
          <select className="input" value={f.playbook_id} onChange={e => set('playbook_id', e.target.value)}><option value="">None</option>{playbooks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="field"><label>Planned risk ($, for R-multiple)</label><input className="input" type="number" step="any" value={f.planned_risk} onChange={e => set('planned_risk', e.target.value)} /></div>
        <div className="field"><label>Stop loss</label><input className="input" type="number" step="any" value={f.stop_loss} onChange={e => set('stop_loss', e.target.value)} /></div>
        <div className="field"><label>Profit target</label><input className="input" type="number" step="any" value={f.profit_target} onChange={e => set('profit_target', e.target.value)} /></div>
      </div>
      <div className="card card-b row" style={{ background: '#fafafe' }}>
        <div className="seg"><button className={f.pnlMode === 'auto' ? 'on' : ''} onClick={() => set('pnlMode', 'auto')}>Calculate P&L</button><button className={f.pnlMode === 'manual' ? 'on' : ''} onClick={() => set('pnlMode', 'manual')}>Enter P&L</button></div>
        <span className="spacer" />
        {f.pnlMode === 'auto'
          ? <span>Net P&L: <b className={autoNet > 0 ? 'pos' : autoNet < 0 ? 'neg' : ''}>{autoNet == null ? '—' : autoNet.toFixed(2)}</b> <span className="muted small">= (exit − entry) × qty × {mult || '?'} {f.side === 'short' ? '× −1 ' : ''}− fees</span></span>
          : <div className="field" style={{ width: 200 }}><input className="input" type="number" step="any" placeholder="Net P&L" value={f.net_pnl} onChange={e => set('net_pnl', e.target.value)} /></div>}
      </div>
    </Modal>
  );
}
