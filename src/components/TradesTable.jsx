import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Image } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { money, fmtDate, fmtTime, duration, cls } from '../lib/format.js';
import { outcome, rMultiple, holdMs, tradeTime } from '../../shared/metrics.js';
import { RScale } from './Widgets.jsx';

const roi = t => {
  const notional = Number(t.entry_price) * Number(t.qty) * Number(t.multiplier || 1);
  return notional > 0 ? t.net_pnl / notional : null;
};

const COLS = {
  open: ['Open date', t => t.open_time],
  time: ['Open time', t => t.open_time],
  account: ['Account', t => t.account_id],
  symbol: ['Symbol', t => t.symbol],
  side: ['Side', t => t.side],
  qty: ['Qty', t => t.qty],
  entry: ['Entry', t => t.entry_price],
  exit: ['Exit', t => t.exit_price],
  net: ['Net P&L', t => t.net_pnl],
  status: ['Status', t => outcome(t)],
  roi: ['Net ROI', t => roi(t) ?? -Infinity],
  hold: ['Duration', t => holdMs(t) ?? -1],
  playbook: ['Playbook', t => t.playbook_id || 0],
  r: ['R scale', t => rMultiple(t) ?? -Infinity],
};

export default function TradesTable({ trades, columns = ['open', 'symbol', 'net', 'status', 'roi', 'playbook', 'r'], selectable, selected, onSelect, initialSort = ['open', 'desc'], limit, pageSize = 50 }) {
  const { tz, playbooks, accounts } = useStore();
  const nav = useNavigate();
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  const pb = useMemo(() => new Map(playbooks.map(p => [p.id, p])), [playbooks]);
  const ac = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const sorted = useMemo(() => {
    const get = COLS[sort[0]][1];
    const r = [...trades].sort((a, b) => {
      const x = get(a), y = get(b);
      const c = typeof x === 'string' ? String(x).localeCompare(String(y)) : (x ?? 0) - (y ?? 0);
      return sort[1] === 'asc' ? c : -c;
    });
    return limit ? r.slice(0, limit) : r;
  }, [trades, sort, limit]);
  const pages = limit ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const pg = Math.min(page, pages - 1);
  const rows = limit ? sorted : sorted.slice(pg * pageSize, (pg + 1) * pageSize);
  const head = k => (
    <th key={k} className={['net', 'qty', 'entry', 'exit', 'roi'].includes(k) ? 'num' : ''} style={{ cursor: 'pointer' }}
      onClick={() => setSort(([c, d]) => [k, c === k && d === 'desc' ? 'asc' : 'desc'])}>
      {COLS[k][0]} {sort[0] === k && (sort[1] === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />)}
    </th>
  );
  const allSel = selectable && rows.length > 0 && rows.every(t => selected.has(t.id));
  if (!trades.length) return <div className="empty">No trades match the current account, date and filter selection.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead><tr>
          {selectable && <th style={{ width: 36 }}><input type="checkbox" checked={allSel} onChange={() => onSelect(allSel ? new Set() : new Set(rows.map(t => t.id)))} /></th>}
          {columns.map(head)}
        </tr></thead>
        <tbody>
          {rows.map(t => {
            const o = outcome(t);
            const p = pb.get(t.playbook_id);
            const r = roi(t);
            return (
              <tr key={t.id} className="click" onClick={() => nav(`/trades/${t.id}`)}>
                {selectable && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(t.id)} onChange={() => { const s = new Set(selected); s.has(t.id) ? s.delete(t.id) : s.add(t.id); onSelect(s); }} /></td>}
                {columns.map(k => {
                  switch (k) {
                    case 'open': return <td key={k}>{fmtDate(tradeTime(t) && t.open_time, tz)}</td>;
                    case 'time': return <td key={k}>{fmtTime(t.open_time, tz)}</td>;
                    case 'account': return <td key={k} className="muted">{ac.get(t.account_id)?.name}</td>;
                    case 'symbol': return <td key={k} style={{ fontWeight: 500 }}>{t.symbol} {t.attachment_count ? <Image size={13} color="var(--muted)" /> : null}</td>;
                    case 'side': return <td key={k} style={{ textTransform: 'capitalize' }}>{t.side}</td>;
                    case 'qty': return <td key={k} className="num">{t.qty}</td>;
                    case 'entry': return <td key={k} className="num">{t.entry_price ?? '—'}</td>;
                    case 'exit': return <td key={k} className="num">{t.exit_price ?? '—'}</td>;
                    case 'net': return <td key={k} className={'num ' + cls(t.net_pnl)} style={{ fontWeight: 500 }}>{money(t.net_pnl)}</td>;
                    case 'status': return <td key={k}><span className={'badge ' + (o === 'win' ? 'win' : o === 'loss' ? 'loss' : 'be')}>{o === 'breakeven' ? 'BE' : o.toUpperCase()}</span></td>;
                    case 'roi': return <td key={k} className={'num ' + cls(r)}>{r == null ? '—' : (r * 100).toFixed(2) + '%'}</td>;
                    case 'hold': return <td key={k}>{duration(holdMs(t))}</td>;
                    case 'playbook': return <td key={k}>{p ? <span className="chip">{p.icon} {p.name}</span> : <span className="muted">—</span>}</td>;
                    case 'r': return <td key={k}><RScale r={rMultiple(t)} /></td>;
                    default: return <td key={k} />;
                  }
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="row" style={{ justifyContent: 'flex-end', paddingTop: 12 }}>
          <span className="muted small">{pg * pageSize + 1}–{Math.min((pg + 1) * pageSize, sorted.length)} of {sorted.length}</span>
          <button className="btn sm" disabled={pg === 0} onClick={() => setPage(pg - 1)}>Previous</button>
          <span className="small">Page {pg + 1} / {pages}</span>
          <button className="btn sm" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
