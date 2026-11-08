import { useEffect, useState } from 'react';
import { Download, Database } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import { useStore } from '../lib/store.jsx';
import { api } from '../lib/api.js';

const TZS = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Athens', 'Asia/Nicosia', 'UTC'];

export default function Settings() {
  const { settings, refresh, notify, tags, accounts } = useStore();
  const [f, setF] = useState({ display_name: '', timezone: 'America/New_York' });
  useEffect(() => { setF({ display_name: settings.display_name || '', timezone: settings.timezone || 'America/New_York' }); }, [settings]);
  async function save() { await api.put('/api/settings', f); await refresh(); notify('Settings saved'); }
  async function demo() {
    if (!confirm('Create a separate account named "Demo — sample data" with generated trades? It is clearly marked and can be deleted from Accounts.')) return;
    const r = await api.post('/api/demo'); await refresh(); notify(`Demo account created with ${r.trades} generated trades`);
  }
  async function delTag(t) { if (!confirm(`Delete tag "${t.name}" from all trades?`)) return; await api.del(`/api/tags/${t.id}`); await refresh(); }
  const hasDemo = accounts.some(a => a.is_demo);
  return (
    <Page title="Settings">
      <div className="card"><div className="card-h">Profile & display</div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
          <div className="grid2">
            <div className="field"><label>Display name (greeting)</label><input className="input" value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} /></div>
            <div className="field"><label>Time zone for days, calendar and reports</label><select className="input" value={f.timezone} onChange={e => setF({ ...f, timezone: e.target.value })}>{TZS.map(z => <option key={z}>{z}</option>)}</select></div>
          </div>
          <div><button className="btn primary" onClick={save}>Save settings</button></div>
        </div></div>

      <div className="card"><div className="card-h">Tags</div>
        <div className="card-b row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {tags.length === 0 && <span className="muted">Tags are created from the trade page (setups, mistakes, custom).</span>}
          {tags.map(t => <span key={t.id} className={'tag' + (t.category === 'mistake' ? ' mistake' : '')}>{t.name} <span className="muted small">({t.category})</span><button onClick={() => delTag(t)}>×</button></span>)}
        </div></div>

      <div className="card"><div className="card-h">Data</div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="muted">All data lives in a single SQLite file (<code>data/journal.db</code>) plus screenshots in <code>data/uploads/</code> on the machine running the server. Back up that folder.</div>
          <div className="row">
            <a className="btn" href="/api/backup"><Download size={16} />Download JSON backup</a>
            <button className="btn" onClick={demo} disabled={hasDemo}><Database size={16} />{hasDemo ? 'Demo account exists' : 'Create demo account (sample data)'}</button>
          </div>
        </div></div>
    </Page>
  );
}
