import { Page } from '../components/Layout.jsx';

// Honest status pages for features that need external data, keys or hosting.
// Nothing here is simulated. Details and costs are in docs/INTEGRATIONS.md.
const INFO = {
  replay: {
    title: 'Trade Replay',
    what: 'Replay a trade candle by candle with your entries and exits drawn on the chart.',
    needs: [
      'Historical intraday market data (1-second or tick) for the instruments you trade. For CME futures this means a paid data vendor plus exchange licensing.',
      'A charting component and playback engine. These can be built here once a data source is chosen.',
    ],
    status: 'Not built. No market data source is connected.',
  },
  backtesting: {
    title: 'Backtesting',
    what: 'Bar-by-bar manual backtesting sessions on historical data, saved per strategy.',
    needs: ['The same historical market data as Trade Replay.', 'A session engine. It shares most of its code with Replay, so it is built after Replay.'],
    status: 'Not built. No market data source is connected.',
  },
  ai: {
    title: 'AI Analysis',
    what: 'Plain-language questions about your own trades, weekly reviews and pattern detection.',
    needs: ['An Anthropic API key (paid per use). The key stays on your server.', 'Your consent to send trade summaries to the API. Screenshots are sent only if you choose.'],
    status: 'Not built. It needs your API key and a decision on what data may be sent.',
  },
  mentor: {
    title: 'Mentor Sharing',
    what: 'Read-only links or invited accounts so a mentor can view your journal and leave comments.',
    needs: ['The app running on a server reachable from the internet (VPS or similar) with HTTPS.', 'User login and sharing permissions. These are not built yet: today the app is single-user and listens only on your own machine.'],
    status: 'Not built. It needs hosting and authentication.',
  },
};

export default function NotAvailable({ kind }) {
  const i = INFO[kind];
  return (
    <Page title={i.title}>
      <div className="card" style={{ maxWidth: 820 }}>
        <div className="card-h">{i.title}<span className="spacer" /><span className="pill r">not connected</span></div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 14, lineHeight: 1.6 }}>
          <div><b>Purpose:</b> {i.what}</div>
          <div><b>Status:</b> {i.status}</div>
          <div><b>What it needs:</b><ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>{i.needs.map(n => <li key={n}>{n}</li>)}</ul></div>
          <div className="muted small">See <code>docs/INTEGRATIONS.md</code> in the repository for providers, access requirements and costs.</div>
        </div>
      </div>
    </Page>
  );
}
