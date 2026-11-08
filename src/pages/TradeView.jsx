import { useMemo, useState } from 'react';
import { Trash2, Plus, Download } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import TradesTable from '../components/TradesTable.jsx';
import TradeModal from '../components/TradeModal.jsx';
import { KpiRow } from '../components/Widgets.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { summarize } from '../../shared/metrics.js';

function toCsv(trades, accounts, playbooks) {
  const a = new Map(accounts.map(x => [x.id, x.name])), p = new Map(playbooks.map(x => [x.id, x.name]));
  const cols = ['id', 'account', 'symbol', 'side', 'qty', 'entry_price', 'exit_price', 'open_time', 'close_time', 'gross_pnl', 'fees', 'net_pnl', 'planned_risk', 'playbook', 'tags', 'rating', 'notes'];
  const esc = v => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = trades.map(t => [t.id, a.get(t.account_id), t.symbol, t.side, t.qty, t.entry_price, t.exit_price, t.open_time, t.close_time, t.gross_pnl, t.fees, t.net_pnl, t.planned_risk, p.get(t.playbook_id), t.tags.map(g => g.name).join('; '), t.rating, t.notes].map(esc).join(','));
  return [cols.join(','), ...rows].join('\n');
}

export default function TradeView() {
  const { filtered, refresh, notify, accounts, playbooks } = useStore();
  const [sel, setSel] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const s = useMemo(() => summarize(filtered), [filtered]);

  async function del() {
    if (!confirm(`Delete ${sel.size} trade(s)? Screenshots attached to them are deleted too.`)) return;
    await api.post('/api/trades/delete', { ids: [...sel] });
    setSel(new Set());
    await refresh();
    notify('Trades deleted');
  }
  function exportCsv() {
    const blob = new Blob([toCsv(filtered, accounts, playbooks)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'trades.csv' });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Page title="Trade View">
      <KpiRow s={s} />
      <div className="card">
        <div className="card-h">
          Trades <span className="pill">{filtered.length}</span>
          <span className="spacer" />
          {sel.size > 0 && <button className="btn sm danger" onClick={del}><Trash2 size={14} />Delete {sel.size}</button>}
          <button className="btn sm" onClick={exportCsv} disabled={!filtered.length}><Download size={14} />Export CSV</button>
          <button className="btn sm primary" onClick={() => setAdding(true)}><Plus size={14} />Add trade</button>
        </div>
        <div className="card-b">
          <TradesTable trades={filtered} selectable selected={sel} onSelect={setSel}
            columns={['open', 'time', 'account', 'symbol', 'side', 'qty', 'net', 'status', 'roi', 'hold', 'playbook', 'r']} />
        </div>
      </div>
      {adding && <TradeModal onClose={() => setAdding(false)} />}
    </Page>
  );
}
