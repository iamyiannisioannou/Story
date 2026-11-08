import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './styles.css';
import { StoreProvider, useStore } from './lib/store.jsx';
import { Sidebar } from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DayView from './pages/DayView.jsx';
import TradeView from './pages/TradeView.jsx';
import TradeDetail from './pages/TradeDetail.jsx';
import Notebook from './pages/Notebook.jsx';
import Reports from './pages/Reports.jsx';
import { Playbooks, PlaybookDetail } from './pages/Playbooks.jsx';
import LockGuard from './pages/LockGuard.jsx';
import Import from './pages/Import.jsx';
import Accounts from './pages/Accounts.jsx';
import Settings from './pages/Settings.jsx';
import NotAvailable from './pages/NotAvailable.jsx';

function Shell() {
  const { toast, error } = useStore();
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        {error && <div className="banner lock" style={{ margin: 16 }}>Cannot reach the server: {error}</div>}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/day-view" element={<DayView />} />
          <Route path="/trades" element={<TradeView />} />
          <Route path="/trades/:id" element={<TradeDetail />} />
          <Route path="/notebook" element={<Notebook />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/playbooks" element={<Playbooks />} />
          <Route path="/playbooks/:id" element={<PlaybookDetail />} />
          <Route path="/lock-guard" element={<LockGuard />} />
          <Route path="/import" element={<Import />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/replay" element={<NotAvailable kind="replay" />} />
          <Route path="/backtesting" element={<NotAvailable kind="backtesting" />} />
          <Route path="/ai" element={<NotAvailable kind="ai" />} />
          <Route path="/mentor" element={<NotAvailable kind="mentor" />} />
          <Route path="*" element={<NotAvailable kind="replay" />} />
        </Routes>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider><Shell /></StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
