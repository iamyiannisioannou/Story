import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, RefreshCw } from 'lucide-react';
import { Page } from '../components/Layout.jsx';
import { KpiRow, InfoTip } from '../components/Widgets.jsx';
import { CumulativeChart, DailyBars, ScoreRadar } from '../components/Charts.jsx';
import Calendar from '../components/Calendar.jsx';
import TradesTable from '../components/TradesTable.jsx';
import { useStore } from '../lib/store.jsx';
import { summarize, dailyStats, cumulative, kairosScore } from '../../shared/metrics.js';
import { fmtDate } from '../lib/format.js';

function greeting(name, tz) {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${g} ${name}!` : `${g}!`;
}

export default function Dashboard() {
  const { filtered, tz, settings, accounts, trades, refresh, loaded } = useStore();
  const [tab, setTab] = useState('recent');
  const s = useMemo(() => summarize(filtered), [filtered]);
  const daily = useMemo(() => cumulative(dailyStats(filtered, tz)), [filtered, tz]);
  const score = useMemo(() => kairosScore(s), [s]);
  const lastImport = trades.reduce((a, t) => (t.source !== 'manual' && t.created_at > a ? t.created_at : a), '');

  return (
    <Page title="Dashboard">
      <div className="row">
        <span style={{ fontSize: 18, fontWeight: 500 }}>{greeting(settings.display_name, tz)}</span>
        <span className="spacer" />
        <span className="muted row small" style={{ gap: 6 }}><RefreshCw size={14} />{lastImport ? `Last imported ${fmtDate(lastImport, tz)}` : 'No imports yet'}</span>
        <Link to="/import" className="btn primary"><Upload size={16} />Import Trades</Link>
      </div>

      {loaded && accounts.length === 0 && (
        <div className="banner info">
          Welcome. Start by creating an account under <Link to="/accounts">Accounts</Link>, then <Link to="/import">import a CSV</Link> or add trades by hand.
          You can also load a clearly-labelled demo account from <Link to="/settings">Settings</Link> to explore the screens.
        </div>
      )}

      <KpiRow s={s} />

      <div className="dash-row">
        <div className="card">
          <div className="card-h">Kairos Score <InfoTip text="Our own formula (not TradeZella's): average of win % ÷ 60%, profit factor ÷ 2.5 and avg win/loss ÷ 2, each capped at 100." /></div>
          <div className="card-b">
            <ScoreRadar parts={score.parts} height={250} />
            <div style={{ textAlign: 'center' }}>Your Kairos Score: <b className="pos" style={{ fontSize: 22 }}>{score.score.toFixed(0)}</b></div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">Daily net cumulative P&L <InfoTip text="Running total of daily net P&L" /></div>
          <div className="card-b"><CumulativeChart data={daily} height={290} /></div>
        </div>
        <div className="card">
          <div className="card-h">Net daily P&L <InfoTip text="Net P&L per trading day" /></div>
          <div className="card-b"><DailyBars data={daily} height={290} /></div>
        </div>
      </div>

      <div className="dash-row2">
        <div className="card">
          <div className="tabs">
            <button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Recent trades</button>
            <button className={tab === 'best' ? 'on' : ''} onClick={() => setTab('best')}>Best / worst</button>
          </div>
          <div className="card-b">
            {tab === 'recent'
              ? <TradesTable trades={filtered} columns={['open', 'symbol', 'net']} limit={10} />
              : <TradesTable trades={filtered} columns={['open', 'symbol', 'net']} limit={10} initialSort={['net', 'desc']} key="best" />}
          </div>
        </div>
        <Calendar daily={daily} tz={tz} />
      </div>
      <div className="muted small" style={{ textAlign: 'right' }}>
        <button className="btn ghost sm" onClick={refresh}><RefreshCw size={13} />Refresh data</button>
      </div>
    </Page>
  );
}
