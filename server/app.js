import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDb, tx } from './db.js';
import { evaluateLock } from '../shared/lockguard.js';
import { createDemoData } from './demo.js';

const TRADE_FIELDS = [
  'account_id', 'symbol', 'instrument_type', 'side', 'qty', 'entry_price', 'exit_price', 'open_time', 'close_time',
  'gross_pnl', 'fees', 'net_pnl', 'multiplier', 'planned_risk', 'stop_loss', 'profit_target', 'playbook_id',
  'rating', 'notes', 'reviewed', 'source', 'import_id', 'external_id',
];
const ACCOUNT_FIELDS = ['name', 'broker', 'currency', 'initial_balance', 'archived'];
const RULE_FIELDS = ['enabled', 'timezone', 'lock_time', 'max_trades', 'max_wins', 'max_losses', 'max_breakevens', 'max_consec_losses', 'max_daily_loss', 'max_daily_profit'];
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const pick = (o, keys) => Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k] === '' ? null : o[k]]));
const wrap = fn => (req, res, next) => { try { const r = fn(req, res); if (r !== undefined) res.json(r); } catch (e) { next(e); } };
const toObj = r => (r ? { ...r } : r);

export function createApp({ dataDir }) {
  const db = openDb(dataDir);
  const uploadDir = path.join(dataDir === ':memory:' ? fs.mkdtempSync('/tmp/kj-') : dataDir, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // ---------- helpers ----------
  const getTrade = id => {
    const t = toObj(db.prepare('SELECT * FROM trades WHERE id = ?').get(id));
    if (!t) throw new HttpError(404, 'Trade not found');
    t.tags = db.prepare('SELECT t.id, t.name, t.category FROM tags t JOIN trade_tags tt ON tt.tag_id = t.id WHERE tt.trade_id = ? ORDER BY t.name').all(id).map(toObj);
    t.attachments = db.prepare('SELECT * FROM attachments WHERE trade_id = ? ORDER BY id').all(id).map(toObj);
    t.rule_checks = Object.fromEntries(db.prepare('SELECT rule_key, checked FROM playbook_rule_checks WHERE trade_id = ?').all(id).map(r => [r.rule_key, !!r.checked]));
    return t;
  };
  const validateTrade = (t, partial = false) => {
    const req = ['account_id', 'symbol', 'side', 'qty', 'open_time', 'net_pnl'];
    if (!partial) for (const k of req) if (t[k] === undefined || t[k] === null || t[k] === '') throw new HttpError(400, `Missing field: ${k}`);
    if (t.side !== undefined && !['long', 'short'].includes(t.side)) throw new HttpError(400, 'side must be long or short');
    for (const k of ['qty', 'net_pnl', 'entry_price', 'exit_price', 'fees', 'gross_pnl', 'planned_risk']) {
      if (t[k] !== undefined && t[k] !== null && !Number.isFinite(Number(t[k]))) throw new HttpError(400, `${k} must be a number`);
    }
    for (const k of ['open_time', 'close_time']) {
      if (t[k] && isNaN(new Date(t[k]))) throw new HttpError(400, `${k} must be a date`);
    }
  };
  const setTags = (tradeId, tags) => {
    db.prepare('DELETE FROM trade_tags WHERE trade_id = ?').run(tradeId);
    for (const tg of tags || []) {
      let id = tg.id;
      if (!id) {
        const name = String(tg.name || '').trim();
        if (!name) continue;
        const cat = tg.category || 'custom';
        db.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)').run(name, cat);
        id = db.prepare('SELECT id FROM tags WHERE name = ? AND category = ?').get(name, cat).id;
      }
      db.prepare('INSERT OR IGNORE INTO trade_tags (trade_id, tag_id) VALUES (?, ?)').run(tradeId, id);
    }
  };
  const insertTrade = t => {
    const f = pick(t, TRADE_FIELDS);
    const keys = Object.keys(f);
    const r = db.prepare(`INSERT INTO trades (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => f[k]));
    return Number(r.lastInsertRowid);
  };

  // ---------- accounts ----------
  app.get('/api/accounts', wrap(() => db.prepare(`
    SELECT a.*, (SELECT COUNT(*) FROM trades t WHERE t.account_id = a.id) AS trade_count,
           (SELECT COALESCE(SUM(net_pnl),0) FROM trades t WHERE t.account_id = a.id) AS net_pnl
    FROM accounts a ORDER BY a.archived, a.name`).all().map(toObj)));
  app.post('/api/accounts', wrap(req => {
    const a = pick(req.body, ACCOUNT_FIELDS);
    if (!a.name) throw new HttpError(400, 'Name is required');
    const r = db.prepare('INSERT INTO accounts (name, broker, currency, initial_balance) VALUES (?, ?, ?, ?)')
      .run(a.name, a.broker ?? null, a.currency || 'USD', Number(a.initial_balance) || 0);
    return toObj(db.prepare('SELECT * FROM accounts WHERE id = ?').get(r.lastInsertRowid));
  }));
  app.put('/api/accounts/:id', wrap(req => {
    const a = pick(req.body, ACCOUNT_FIELDS);
    const keys = Object.keys(a);
    if (keys.length) db.prepare(`UPDATE accounts SET ${keys.map(k => `${k} = ?`).join(',')} WHERE id = ?`).run(...keys.map(k => a[k]), req.params.id);
    return toObj(db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id));
  }));
  app.delete('/api/accounts/:id', wrap(req => {
    const files = db.prepare('SELECT a.filename FROM attachments a JOIN trades t ON t.id = a.trade_id WHERE t.account_id = ?').all(req.params.id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    for (const f of files) fs.rmSync(path.join(uploadDir, f.filename), { force: true });
    return { ok: true };
  }));

  // ---------- trades ----------
  app.get('/api/trades', wrap(req => {
    const ids = String(req.query.accounts || '').split(',').map(Number).filter(Boolean);
    const where = ids.length ? `WHERE account_id IN (${ids.map(() => '?').join(',')})` : '';
    const trades = db.prepare(`SELECT * FROM trades ${where} ORDER BY open_time DESC`).all(...ids).map(toObj);
    const tagRows = db.prepare('SELECT tt.trade_id, t.id, t.name, t.category FROM trade_tags tt JOIN tags t ON t.id = tt.tag_id').all();
    const att = db.prepare('SELECT trade_id, COUNT(*) n FROM attachments WHERE trade_id IS NOT NULL GROUP BY trade_id').all();
    const byTrade = new Map();
    for (const r of tagRows) { if (!byTrade.has(r.trade_id)) byTrade.set(r.trade_id, []); byTrade.get(r.trade_id).push({ id: r.id, name: r.name, category: r.category }); }
    const attMap = new Map(att.map(a => [a.trade_id, a.n]));
    for (const t of trades) { t.tags = byTrade.get(t.id) || []; t.attachment_count = attMap.get(t.id) || 0; }
    return trades;
  }));
  app.get('/api/trades/:id', wrap(req => getTrade(req.params.id)));
  app.post('/api/trades', wrap(req => {
    const t = { source: 'manual', ...req.body };
    validateTrade(t);
    const id = tx(db, () => { const id = insertTrade(t); setTags(id, t.tags); return id; });
    return getTrade(id);
  }));
  app.put('/api/trades/:id', wrap(req => {
    getTrade(req.params.id);
    validateTrade(req.body, true);
    tx(db, () => {
      const f = pick(req.body, TRADE_FIELDS);
      const keys = Object.keys(f);
      if (keys.length) db.prepare(`UPDATE trades SET ${keys.map(k => `${k} = ?`).join(',')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(...keys.map(k => f[k]), req.params.id);
      if (req.body.tags) setTags(req.params.id, req.body.tags);
      if (req.body.rule_checks) {
        for (const [k, v] of Object.entries(req.body.rule_checks)) {
          db.prepare('INSERT INTO playbook_rule_checks (trade_id, rule_key, checked) VALUES (?, ?, ?) ON CONFLICT (trade_id, rule_key) DO UPDATE SET checked = excluded.checked').run(req.params.id, k, v ? 1 : 0);
        }
      }
    });
    return getTrade(req.params.id);
  }));
  app.post('/api/trades/delete', wrap(req => {
    const ids = (req.body.ids || []).map(Number).filter(Boolean);
    const files = ids.length ? db.prepare(`SELECT filename FROM attachments WHERE trade_id IN (${ids.map(() => '?').join(',')})`).all(...ids) : [];
    tx(db, () => { for (const id of ids) db.prepare('DELETE FROM trades WHERE id = ?').run(id); });
    for (const f of files) fs.rmSync(path.join(uploadDir, f.filename), { force: true });
    return { deleted: ids.length };
  }));

  // ---------- import ----------
  app.post('/api/import', wrap(req => {
    const { account_id, source, filename, trades = [], rows = trades.length, errors = 0 } = req.body;
    if (!db.prepare('SELECT id FROM accounts WHERE id = ?').get(account_id)) throw new HttpError(400, 'Choose an account');
    for (const t of trades) validateTrade({ ...t, account_id });
    return tx(db, () => {
      const imp = db.prepare('INSERT INTO imports (account_id, source, filename, rows, errors) VALUES (?, ?, ?, ?, ?)').run(account_id, source, filename ?? null, rows, errors);
      const importId = Number(imp.lastInsertRowid);
      let imported = 0, duplicates = 0;
      for (const t of trades) {
        // De-duplicate on external id, or on identical (symbol, open, close, qty, net) when no id is given.
        const dup = t.external_id
          ? db.prepare('SELECT id FROM trades WHERE account_id = ? AND external_id = ?').get(account_id, String(t.external_id))
          : db.prepare(`SELECT id FROM trades WHERE account_id = ? AND symbol = ? AND open_time = ? AND IFNULL(close_time,'') = IFNULL(?,'') AND qty = ? AND net_pnl = ?`)
            .get(account_id, t.symbol, t.open_time, t.close_time ?? null, Number(t.qty), Number(t.net_pnl));
        if (dup) { duplicates++; continue; }
        insertTrade({ ...t, account_id, source, import_id: importId, external_id: t.external_id ? String(t.external_id) : null });
        imported++;
      }
      db.prepare('UPDATE imports SET imported = ?, duplicates = ? WHERE id = ?').run(imported, duplicates, importId);
      return { import_id: importId, imported, duplicates };
    });
  }));
  app.get('/api/imports', wrap(() => db.prepare('SELECT i.*, a.name AS account_name FROM imports i LEFT JOIN accounts a ON a.id = i.account_id ORDER BY i.id DESC LIMIT 100').all().map(toObj)));
  app.delete('/api/imports/:id', wrap(req => {
    const r = db.prepare('DELETE FROM trades WHERE import_id = ?').run(req.params.id);
    db.prepare('DELETE FROM imports WHERE id = ?').run(req.params.id);
    return { deleted_trades: Number(r.changes) };
  }));

  // ---------- tags & playbooks ----------
  app.get('/api/tags', wrap(() => db.prepare('SELECT * FROM tags ORDER BY category, name').all().map(toObj)));
  app.post('/api/tags', wrap(req => {
    const name = String(req.body.name || '').trim();
    if (!name) throw new HttpError(400, 'Name is required');
    const cat = req.body.category || 'custom';
    db.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)').run(name, cat);
    return toObj(db.prepare('SELECT * FROM tags WHERE name = ? AND category = ?').get(name, cat));
  }));
  app.delete('/api/tags/:id', wrap(req => { db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id); return { ok: true }; }));

  const pbOut = p => ({ ...p, rules: JSON.parse(p.rules || '[]') });
  app.get('/api/playbooks', wrap(() => db.prepare('SELECT * FROM playbooks ORDER BY name').all().map(pbOut)));
  app.get('/api/playbooks/:id', wrap(req => {
    const p = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(req.params.id);
    if (!p) throw new HttpError(404, 'Playbook not found');
    return pbOut(p);
  }));
  const pbIn = b => ({ name: b.name, icon: b.icon ?? null, description: b.description ?? null, rules: JSON.stringify(Array.isArray(b.rules) ? b.rules : []) });
  app.post('/api/playbooks', wrap(req => {
    if (!req.body.name) throw new HttpError(400, 'Name is required');
    const p = pbIn(req.body);
    const r = db.prepare('INSERT INTO playbooks (name, icon, description, rules) VALUES (?, ?, ?, ?)').run(p.name, p.icon, p.description, p.rules);
    return pbOut(db.prepare('SELECT * FROM playbooks WHERE id = ?').get(r.lastInsertRowid));
  }));
  app.put('/api/playbooks/:id', wrap(req => {
    const p = pbIn(req.body);
    db.prepare('UPDATE playbooks SET name = ?, icon = ?, description = ?, rules = ? WHERE id = ?').run(p.name, p.icon, p.description, p.rules, req.params.id);
    return pbOut(db.prepare('SELECT * FROM playbooks WHERE id = ?').get(req.params.id));
  }));
  app.delete('/api/playbooks/:id', wrap(req => { db.prepare('DELETE FROM playbooks WHERE id = ?').run(req.params.id); return { ok: true }; }));

  // ---------- attachments (screenshots) ----------
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => cb(null, crypto.randomUUID() + (path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.png')),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(IMAGE_TYPES.has(file.mimetype) ? null : new HttpError(400, 'Only PNG, JPEG, GIF or WebP images'), IMAGE_TYPES.has(file.mimetype)),
  });
  const saveAttachments = (files, tradeId, journalDate) => files.map(f => {
    const r = db.prepare('INSERT INTO attachments (trade_id, journal_date, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?, ?)')
      .run(tradeId, journalDate, f.filename, f.originalname, f.mimetype, f.size);
    return toObj(db.prepare('SELECT * FROM attachments WHERE id = ?').get(r.lastInsertRowid));
  });
  app.post('/api/trades/:id/attachments', upload.array('files', 20), wrap(req => { getTrade(req.params.id); return saveAttachments(req.files || [], Number(req.params.id), null); }));
  app.post('/api/journal/:date/attachments', upload.array('files', 20), wrap(req => saveAttachments(req.files || [], null, req.params.date)));
  app.delete('/api/attachments/:id', wrap(req => {
    const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!a) throw new HttpError(404, 'Not found');
    db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
    fs.rmSync(path.join(uploadDir, a.filename), { force: true });
    return { ok: true };
  }));
  app.use('/uploads', express.static(uploadDir, { fallthrough: false, maxAge: '30d' }));

  // ---------- daily journal ----------
  app.get('/api/journal', wrap(() => db.prepare("SELECT date, mood, substr(content,1,200) AS preview, updated_at FROM journal_entries WHERE content <> '' ORDER BY date DESC").all().map(toObj)));
  app.get('/api/journal/:date', wrap(req => {
    const e = toObj(db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(req.params.date)) || { date: req.params.date, content: '', mood: null };
    e.attachments = db.prepare('SELECT * FROM attachments WHERE journal_date = ? ORDER BY id').all(req.params.date).map(toObj);
    return e;
  }));
  app.put('/api/journal/:date', wrap(req => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) throw new HttpError(400, 'Bad date');
    db.prepare(`INSERT INTO journal_entries (date, content, mood) VALUES (?, ?, ?)
      ON CONFLICT (date) DO UPDATE SET content = excluded.content, mood = excluded.mood, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .run(req.params.date, String(req.body.content ?? ''), req.body.mood ?? null);
    return { ok: true };
  }));

  // ---------- lock guard ----------
  const rulesFor = accountId => toObj(db.prepare('SELECT * FROM lock_rules WHERE account_id = ?').get(accountId)) || { account_id: Number(accountId), enabled: 0, timezone: 'America/New_York', lock_time: null };
  app.get('/api/lock-rules/:accountId', wrap(req => rulesFor(req.params.accountId)));
  app.put('/api/lock-rules/:accountId', wrap(req => {
    const r = { ...rulesFor(req.params.accountId), ...pick(req.body, RULE_FIELDS) };
    if (r.lock_time && !/^\d{2}:\d{2}$/.test(r.lock_time)) throw new HttpError(400, 'lock_time must be HH:MM');
    db.prepare(`INSERT INTO lock_rules (account_id, ${RULE_FIELDS.join(',')}) VALUES (?, ${RULE_FIELDS.map(() => '?').join(',')})
      ON CONFLICT (account_id) DO UPDATE SET ${RULE_FIELDS.map(k => `${k} = excluded.${k}`).join(',')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .run(req.params.accountId, ...RULE_FIELDS.map(k => (k === 'enabled' ? (r[k] ? 1 : 0) : r[k] ?? null)));
    return rulesFor(req.params.accountId);
  }));
  // Status endpoint. A future desktop helper can poll this to lock the trading platform.
  app.get('/api/lock-status', wrap(req => {
    const accounts = db.prepare('SELECT id, name FROM accounts WHERE archived = 0').all();
    return accounts.map(a => {
      const trades = db.prepare('SELECT net_pnl, open_time, close_time FROM trades WHERE account_id = ?').all(a.id).map(toObj);
      const rules = rulesFor(a.id);
      const st = evaluateLock(rules, trades, req.query.now ? new Date(req.query.now) : new Date());
      if (st.locked) db.prepare('INSERT OR IGNORE INTO lock_events (account_id, day, reasons) VALUES (?, ?, ?)').run(a.id, st.day, JSON.stringify(st.reasons));
      return { account_id: a.id, account_name: a.name, rules, ...st };
    });
  }));
  app.get('/api/lock-events', wrap(() => db.prepare('SELECT e.*, a.name AS account_name FROM lock_events e JOIN accounts a ON a.id = e.account_id ORDER BY e.day DESC LIMIT 200').all().map(r => ({ ...r, reasons: JSON.parse(r.reasons) }))));

  // ---------- settings / demo / backup ----------
  app.get('/api/settings', wrap(() => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, JSON.parse(r.value)]))));
  app.put('/api/settings', wrap(req => {
    for (const [k, v] of Object.entries(req.body || {})) db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(k, JSON.stringify(v));
    return { ok: true };
  }));
  app.post('/api/demo', wrap(() => tx(db, () => createDemoData(db, insertTrade, setTags))));
  app.get('/api/backup', wrap((req, res) => {
    const dump = {};
    for (const t of ['accounts', 'playbooks', 'trades', 'tags', 'trade_tags', 'playbook_rule_checks', 'attachments', 'imports', 'journal_entries', 'lock_rules', 'lock_events', 'settings']) {
      dump[t] = db.prepare(`SELECT * FROM ${t}`).all().map(toObj);
    }
    res.setHeader('Content-Disposition', `attachment; filename="kairos-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ version: 1, exported_at: new Date().toISOString(), data: dump });
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
  });
  app.locals.db = db;
  return app;
}
