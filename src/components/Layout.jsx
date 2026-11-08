import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutGrid, CalendarDays, ListOrdered, NotebookPen, BarChart3, BookOpen, Lock, PlayCircle, FlaskConical, Sparkles,
  Users, Upload, Wallet, Settings, ChevronRight, ChevronLeft, Plus, Filter, CalendarRange, ChevronDown, ShieldCheck, ShieldAlert, X,
} from 'lucide-react';
import { useStore, EMPTY_FILTERS } from '../lib/store.jsx';
import TradeModal from './TradeModal.jsx';

export const APP_NAME = 'Kairos Journal';

const NAV = [
  ['/', 'Dashboard', LayoutGrid],
  ['/day-view', 'Day View', CalendarDays],
  ['/trades', 'Trade View', ListOrdered],
  ['/notebook', 'Notebook', NotebookPen],
  ['/reports', 'Reports', BarChart3],
  ['/playbooks', 'Playbooks', BookOpen],
  ['/lock-guard', 'Lock Guard', Lock],
  ['sep'],
  ['/replay', 'Trade Replay', PlayCircle, 'needs data'],
  ['/backtesting', 'Backtesting', FlaskConical, 'needs data'],
  ['/ai', 'AI Analysis', Sparkles, 'needs key'],
  ['/mentor', 'Mentor Sharing', Users, 'needs host'],
  ['sep'],
  ['/import', 'Import Trades', Upload],
  ['/accounts', 'Accounts', Wallet],
  ['/settings', 'Settings', Settings],
];

export function Sidebar() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('kj.sb') === '1'; } catch { return false; } });
  const [adding, setAdding] = useState(false);
  useEffect(() => { try { localStorage.setItem('kj.sb', open ? '1' : '0'); } catch { /* ignore */ } }, [open]);
  return (
    <aside className={'sidebar' + (open ? ' open' : '')}>
      <div className="sb-top">
        <div className="sb-logo">K</div>
        <div className="sb-name">{APP_NAME}</div>
        <button className="sb-toggle" onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}>
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <button className="sb-add" onClick={() => setAdding(true)} title="Add trade"><Plus size={18} /><span>Add Trade</span></button>
      <nav className="sb-nav">
        {NAV.map(([to, label, Icon, badge], i) => to === 'sep'
          ? <div key={i} className="sb-sep" />
          : (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')} title={label}>
              <Icon size={20} /><span className="sb-label">{label}</span>{badge && <span className="sb-badge">{badge}</span>}
            </NavLink>
          ))}
      </nav>
      {adding && <TradeModal onClose={() => setAdding(false)} />}
    </aside>
  );
}

function useOutside(ref, onOut) {
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

function Dropdown({ icon: Icon, label, children, width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div className="dd" ref={ref}>
      <button className="btn dd-btn" onClick={() => setOpen(o => !o)}>
        <span className="row" style={{ gap: 8 }}><Icon size={16} color="var(--primary)" />{label}</span><ChevronDown size={16} />
      </button>
      {open && <div className="dd-menu" style={width ? { minWidth: width } : null}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</div>}
    </div>
  );
}

function FiltersMenu() {
  const { filters, setFilters, playbooks, tags, activeFilterCount } = useStore();
  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  return (
    <Dropdown icon={Filter} label={activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'} width={300}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 8 }}>
        <div className="field"><label>Symbol</label><input className="input" value={filters.symbol} onChange={e => set('symbol', e.target.value)} placeholder="e.g. MES" /></div>
        <div className="field"><label>Side</label>
          <select className="input" value={filters.side} onChange={e => set('side', e.target.value)}><option value="">All</option><option value="long">Long</option><option value="short">Short</option></select></div>
        <div className="field"><label>Result</label>
          <select className="input" value={filters.result} onChange={e => set('result', e.target.value)}><option value="">All</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Break even</option></select></div>
        <div className="field"><label>Playbook</label>
          <select className="input" value={filters.playbook} onChange={e => set('playbook', e.target.value)}><option value="">All</option>{playbooks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="field"><label>Tag / mistake</label>
          <select className="input" value={filters.tag} onChange={e => set('tag', e.target.value)}><option value="">All</option>{tags.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}</select></div>
        <button className="btn sm" onClick={() => setFilters(EMPTY_FILTERS)}>Reset filters</button>
      </div>
    </Dropdown>
  );
}

const PRESETS = [['all', 'All time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['mtd', 'This month'], ['ytd', 'This year'], ['custom', 'Custom range']];
function DateRangeMenu() {
  const { range, setRange } = useStore();
  const label = range.preset === 'all' ? 'Date range' : range.preset === 'custom' ? `${range.from || '…'} → ${range.to || '…'}` : PRESETS.find(p => p[0] === range.preset)[1];
  return (
    <Dropdown icon={CalendarRange} label={label} width={260}>
      {close => (
        <>
          {PRESETS.map(([k, l]) => (
            <div key={k} className="dd-item" onClick={() => { setRange(r => ({ ...r, preset: k })); if (k !== 'custom') close(); }}>
              <input type="radio" readOnly checked={range.preset === k} />{l}
            </div>
          ))}
          {range.preset === 'custom' && (
            <div className="grid2" style={{ padding: 8 }}>
              <div className="field"><label>From</label><input type="date" className="input" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /></div>
              <div className="field"><label>To</label><input type="date" className="input" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></div>
            </div>
          )}
        </>
      )}
    </Dropdown>
  );
}

function AccountsMenu() {
  const { accounts, selectedAccounts, setSelectedAccounts } = useStore();
  const all = selectedAccounts.length === 0;
  const label = all ? 'All Accounts' : selectedAccounts.length === 1 ? accounts.find(a => a.id === selectedAccounts[0])?.name : `${selectedAccounts.length} accounts`;
  const toggle = id => setSelectedAccounts(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  return (
    <Dropdown icon={Wallet} label={label} width={280}>
      <div className="dd-item" onClick={() => setSelectedAccounts([])}><input type="checkbox" readOnly checked={all} />All Accounts</div>
      <div className="dd-section">My accounts</div>
      {accounts.length === 0 && <div className="muted small" style={{ padding: 8 }}>No accounts yet — add one under Accounts.</div>}
      {accounts.map(a => (
        <div key={a.id} className="dd-item" onClick={() => toggle(a.id)}>
          <input type="checkbox" readOnly checked={selectedAccounts.includes(a.id)} />
          <span>{a.name}</span>{a.is_demo ? <span className="pill">demo</span> : null}
        </div>
      ))}
    </Dropdown>
  );
}

export function LockPill() {
  const { lockStatus, selectedAccounts } = useStore();
  const relevant = lockStatus.filter(s => s.rules?.enabled && (!selectedAccounts.length || selectedAccounts.includes(s.account_id)));
  if (!relevant.length) return null;
  const locked = relevant.filter(s => s.locked);
  return (
    <NavLink to="/lock-guard" className={'lock-pill ' + (locked.length ? 'on' : 'off')} title={locked.map(s => `${s.account_name}: ${s.reasons.join(', ')}`).join('\n')}>
      {locked.length ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
      {locked.length ? `Locked (${locked.length})` : 'Within rules'}
    </NavLink>
  );
}

export function Topbar({ title, children }) {
  return (
    <header className="topbar">
      <h1>{title}</h1>
      {children}
      <LockPill />
      <FiltersMenu />
      <DateRangeMenu />
      <AccountsMenu />
    </header>
  );
}

export function Page({ title, actions, children }) {
  const loc = useLocation();
  useEffect(() => { document.title = `${title} · ${APP_NAME}`; }, [title, loc.pathname]);
  return (
    <>
      <Topbar title={title}>{actions}</Topbar>
      <div className="content">{children}</div>
    </>
  );
}

export function Modal({ title, onClose, children, footer, width }) {
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width: `min(${width}px, 100%)` } : null}>
        <div className="modal-h">{title}<span className="spacer" /><button className="btn ghost sm" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
