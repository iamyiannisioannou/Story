import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { dayKey, outcome, tradeTime, DEFAULT_TZ } from '../../shared/metrics.js';

const Ctx = createContext(null);

const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const EMPTY_FILTERS = { symbol: '', side: '', result: '', playbook: '', tag: '' };

export function StoreProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [tags, setTags] = useState([]);
  const [settings, setSettings] = useState({});
  const [lockStatus, setLockStatus] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedAccounts, setSelectedAccounts] = useState(() => load('kj.accounts', []));
  const [range, setRange] = useState(() => load('kj.range', { preset: 'all', from: '', to: '' }));
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => save('kj.accounts', selectedAccounts), [selectedAccounts]);
  useEffect(() => save('kj.range', range), [range]);

  const tz = settings.timezone || DEFAULT_TZ;

  const refresh = useCallback(async () => {
    try {
      const [a, t, p, g, s, l] = await Promise.all([
        api.get('/api/accounts'), api.get('/api/trades'), api.get('/api/playbooks'),
        api.get('/api/tags'), api.get('/api/settings'), api.get('/api/lock-status'),
      ]);
      setAccounts(a); setTrades(t); setPlaybooks(p); setTags(g); setSettings(s); setLockStatus(l);
      setSelectedAccounts(sel => sel.filter(id => a.some(x => x.id === id)));
      setError(null);
    } catch (e) { setError(e.message); }
    setLoaded(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => api.get('/api/lock-status').then(setLockStatus).catch(() => {}), 30000);
    return () => clearInterval(id);
  }, []);

  const notify = useCallback(msg => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);

  const rangeBounds = useMemo(() => {
    const today = dayKey(new Date().toISOString(), tz);
    const shift = days => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
    switch (range.preset) {
      case 'today': return [today, today];
      case '7d': return [shift(-6), today];
      case '30d': return [shift(-29), today];
      case 'mtd': return [today.slice(0, 8) + '01', today];
      case 'ytd': return [today.slice(0, 5) + '01-01', today];
      case 'custom': return [range.from || '0000-00-00', range.to || '9999-99-99'];
      default: return null;
    }
  }, [range, tz]);

  const filtered = useMemo(() => trades.filter(t => {
    if (selectedAccounts.length && !selectedAccounts.includes(t.account_id)) return false;
    if (rangeBounds) { const k = dayKey(tradeTime(t), tz); if (k < rangeBounds[0] || k > rangeBounds[1]) return false; }
    if (filters.symbol && !t.symbol.toUpperCase().includes(filters.symbol.toUpperCase())) return false;
    if (filters.side && t.side !== filters.side) return false;
    if (filters.result && outcome(t) !== filters.result) return false;
    if (filters.playbook && String(t.playbook_id) !== String(filters.playbook)) return false;
    if (filters.tag && !t.tags.some(g => String(g.id) === String(filters.tag))) return false;
    return true;
  }), [trades, selectedAccounts, rangeBounds, filters, tz]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const value = {
    accounts, trades, filtered, playbooks, tags, settings, tz, lockStatus, loaded, error, refresh, notify, toast,
    selectedAccounts, setSelectedAccounts, range, setRange, filters, setFilters, activeFilterCount,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
