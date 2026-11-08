import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Link } from 'react-router-dom';
import { Upload, Trash2, Info } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { tradovatePerformance, parseGeneric, GENERIC_FIELDS } from '../../shared/importers.js';
import { money, fmtDate, fmtTime, cls } from '../lib/format.js';

const FORMATS = [
  ['tradovate-performance', 'Tradovate — Performance report (CSV)'],
  ['generic', 'Any CSV — map the columns yourself'],
];
const TZS = ['America/New_York', 'America/Chicago', 'Europe/London', 'Europe/Athens', 'UTC'];

function guessMapping(headers) {
  const find = (...pats) => headers.find(h => pats.some(p => p.test(h))) || '';
  return {
    symbol: find(/^symbol$/i, /symbol|ticker|instrument|contract/i),
    side: find(/^side$/i, /side|direction|action|b\/s/i),
    qty: find(/^(qty|quantity|size|shares|contracts)$/i, /qty|quantity|size/i),
    entry_price: find(/entry.?price|open.?price|avg.?entry|price.?in/i),
    exit_price: find(/exit.?price|close.?price|avg.?exit|price.?out/i),
    open_time: find(/open.?(time|date)|entry.?(time|date)|^date$|^time$/i),
    close_time: find(/close.?(time|date)|exit.?(time|date)/i),
    net_pnl: find(/net.?p.?l|net.?profit|realized/i),
    gross_pnl: find(/gross/i, /^p.?l$|^pnl$|profit/i),
    fees: find(/fee|commission/i),
    external_id: find(/trade.?id|^id$|order.?id/i),
  };
}

export default function Import() {
  const { accounts, tz: appTz, refresh, notify } = useStore();
  const [accountId, setAccountId] = useState('');
  const [format, setFormat] = useState('tradovate-performance');
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [tz, setTz] = useState(appTz);
  const [commission, setCommission] = useState('');
  const [mapping, setMapping] = useState({});
  const [instrumentType, setInstrumentType] = useState('stock');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const loadHistory = () => api.get('/api/imports').then(setHistory);
  useEffect(() => { loadHistory(); }, []);
  useEffect(() => { if (!accountId && accounts.length) setAccountId(String(accounts.find(a => !a.is_demo)?.id ?? accounts[0].id)); }, [accounts, accountId]);

  function onFile(f) {
    setFile(f); setResult(null);
    Papa.parse(f, {
      header: true, skipEmptyLines: true,
      complete: res => {
        const headers = res.meta.fields || [];
        setParsed({ headers, rows: res.data });
        if (tradovatePerformance.detect(headers)) setFormat('tradovate-performance');
        else { setFormat('generic'); setMapping(guessMapping(headers)); }
      },
    });
  }

  const preview = useMemo(() => {
    if (!parsed) return null;
    if (format === 'tradovate-performance') {
      if (!tradovatePerformance.detect(parsed.headers)) return { trades: [], errors: [{ row: '-', message: 'This file does not have the Tradovate Performance columns (buyPrice, sellPrice, boughtTimestamp, soldTimestamp).' }] };
      return tradovatePerformance.parse(parsed.rows, { tz, commissionPerContract: Number(commission) || 0 });
    }
    return parseGeneric(parsed.rows, mapping, { tz, instrumentType });
  }, [parsed, format, tz, commission, mapping, instrumentType]);

  async function doImport() {
    setBusy(true);
    try {
      const r = await api.post('/api/import', { account_id: Number(accountId), source: `csv:${format}`, filename: file?.name, rows: parsed.rows.length, errors: preview.errors.length, trades: preview.trades });
      setResult(r); await refresh(); await loadHistory();
      notify(`Imported ${r.imported} trades (${r.duplicates} duplicates skipped)`);
    } catch (e) { setResult({ error: e.message }); }
    setBusy(false);
  }
  async function undo(id) {
    if (!confirm('Delete this import and all trades it created?')) return;
    const r = await api.del(`/api/imports/${id}`);
    notify(`Removed ${r.deleted_trades} trades`); await refresh(); await loadHistory();
  }

  return (
    <Page title="Import Trades">
      <div className="banner info"><Info size={18} /><div>
        <b>File upload only.</b> Nothing here connects to a broker. You export a CSV from your platform and upload it here.
        Broker auto-sync needs official API access per broker; see <code>docs/INTEGRATIONS.md</code>.
      </div></div>
      {accounts.length === 0 ? <div className="card empty">Create an account first on the <Link to="/accounts">Accounts</Link> page.</div> : (
        <div className="card">
          <div className="card-h">1. Choose account, format and file</div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid3">
              <div className="field"><label>Account</label><select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div className="field"><label>Format</label><select className="input" value={format} onChange={e => setFormat(e.target.value)}>{FORMATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div className="field"><label>Time zone of the times in the file</label><select className="input" value={tz} onChange={e => setTz(e.target.value)}>{TZS.map(z => <option key={z}>{z}</option>)}</select></div>
            </div>
            {format === 'tradovate-performance' && (
              <div className="grid3">
                <div className="field"><label>Commission per contract per side (optional)</label><input className="input" type="number" step="any" value={commission} onChange={e => setCommission(e.target.value)} placeholder="e.g. 0.62" /></div>
                <div className="muted small" style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
                  The Tradovate Performance report <code>pnl</code> column is treated as gross P&L. This was written from the known column layout but <b>has not yet been checked against a real export</b>. Please send one so it can be verified.
                </div>
              </div>
            )}
            <label className="dropzone" style={{ display: 'block' }}>
              <Upload size={22} /><div>{file ? file.name : 'Choose a CSV file'}</div>
              <input type="file" accept=".csv,text/csv" hidden onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
            </label>
          </div>
        </div>
      )}

      {parsed && format === 'generic' && (
        <div className="card">
          <div className="card-h">2. Map columns</div>
          <div className="card-b grid3">
            {GENERIC_FIELDS.map(([k, label, req]) => (
              <div key={k} className="field"><label>{label}{req ? ' *' : ''}</label>
                <select className="input" value={mapping[k] || ''} onChange={e => setMapping(m => ({ ...m, [k]: e.target.value }))}>
                  <option value="">— not in file —</option>{parsed.headers.map(h => <option key={h}>{h}</option>)}
                </select></div>
            ))}
            <div className="field"><label>Instrument type</label>
              <select className="input" value={instrumentType} onChange={e => setInstrumentType(e.target.value)}><option value="stock">Stock</option><option value="future">Future (multiplier from symbol)</option><option value="forex">Forex</option><option value="crypto">Crypto</option><option value="option">Option</option></select></div>
          </div>
        </div>
      )}

      {preview && (
        <div className="card">
          <div className="card-h">{parsed && format === 'generic' ? '3' : '2'}. Preview <span className="pill g">{preview.trades.length} ready</span>{preview.errors.length > 0 && <span className="pill r">{preview.errors.length} skipped</span>}
            <span className="spacer" /><button className="btn primary" disabled={!preview.trades.length || busy || !accountId} onClick={doImport}>Import {preview.trades.length} trades</button></div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {result && (result.error ? <div className="banner lock">{result.error}</div> : <div className="banner ok">Imported {result.imported} trades · {result.duplicates} duplicates skipped. <Link to="/trades">Open Trade View →</Link></div>)}
            {preview.errors.slice(0, 5).map((e, i) => <div key={i} className="small neg">Row {e.row}: {e.message}</div>)}
            <div style={{ overflowX: 'auto' }}>
              <table className="table"><thead><tr><th>Open</th><th>Symbol</th><th>Side</th><th className="num">Qty</th><th className="num">Entry</th><th className="num">Exit</th><th className="num">Gross</th><th className="num">Fees</th><th className="num">Net</th></tr></thead>
                <tbody>{preview.trades.slice(0, 50).map((t, i) => (
                  <tr key={i}><td>{fmtDate(t.open_time, tz)} {fmtTime(t.open_time, tz)}</td><td>{t.symbol}</td><td>{t.side}</td><td className="num">{t.qty}</td><td className="num">{t.entry_price ?? '—'}</td><td className="num">{t.exit_price ?? '—'}</td>
                    <td className="num">{money(t.gross_pnl)}</td><td className="num">{money(t.fees)}</td><td className={'num ' + cls(t.net_pnl)}>{money(t.net_pnl)}</td></tr>
                ))}</tbody></table>
              {preview.trades.length > 50 && <div className="muted small">Showing first 50 of {preview.trades.length}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="card"><div className="card-h">Import history</div>
        <div className="card-b">
          {history.length === 0 ? <div className="muted">No imports yet.</div> : (
            <table className="table"><thead><tr><th>Date</th><th>Account</th><th>Source</th><th>File</th><th className="num">Rows</th><th className="num">Imported</th><th className="num">Duplicates</th><th className="num">Skipped</th><th /></tr></thead>
              <tbody>{history.map(h => (
                <tr key={h.id}><td>{fmtDate(h.created_at, appTz)} {fmtTime(h.created_at, appTz)}</td><td>{h.account_name}</td><td>{h.source}</td><td>{h.filename}</td><td className="num">{h.rows}</td><td className="num">{h.imported}</td><td className="num">{h.duplicates}</td><td className="num">{h.errors}</td>
                  <td><button className="btn sm danger" onClick={() => undo(h.id)}><Trash2 size={14} />Undo</button></td></tr>
              ))}</tbody></table>
          )}
        </div></div>
    </Page>
  );
}
