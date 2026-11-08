// SQLite persistence using Node's built-in node:sqlite (no native build step).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(dataDir === ':memory:' ? ':memory:' : path.join(dataDir, 'journal.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

const MIGRATIONS = [
  `
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    broker TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    initial_balance REAL NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE playbooks (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    rules TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE trades (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    instrument_type TEXT NOT NULL DEFAULT 'stock',
    side TEXT NOT NULL CHECK (side IN ('long','short')),
    qty REAL NOT NULL,
    entry_price REAL,
    exit_price REAL,
    open_time TEXT NOT NULL,
    close_time TEXT,
    gross_pnl REAL,
    fees REAL NOT NULL DEFAULT 0,
    net_pnl REAL NOT NULL,
    multiplier REAL,
    planned_risk REAL,
    stop_loss REAL,
    profit_target REAL,
    playbook_id INTEGER REFERENCES playbooks(id) ON DELETE SET NULL,
    rating INTEGER,
    notes TEXT,
    reviewed INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',
    import_id INTEGER REFERENCES imports(id) ON DELETE SET NULL,
    external_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (account_id, external_id)
  );
  CREATE INDEX trades_account_time ON trades(account_id, open_time);
  CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'custom',
    UNIQUE (name, category)
  );
  CREATE TABLE trade_tags (
    trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
  );
  CREATE TABLE playbook_rule_checks (
    trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    rule_key TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (trade_id, rule_key)
  );
  CREATE TABLE attachments (
    id INTEGER PRIMARY KEY,
    trade_id INTEGER REFERENCES trades(id) ON DELETE CASCADE,
    journal_date TEXT,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime TEXT,
    size INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE imports (
    id INTEGER PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    filename TEXT,
    rows INTEGER, imported INTEGER, duplicates INTEGER, errors INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE journal_entries (
    date TEXT PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    mood INTEGER,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE lock_rules (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 0,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    lock_time TEXT,
    max_trades INTEGER, max_wins INTEGER, max_losses INTEGER, max_breakevens INTEGER,
    max_consec_losses INTEGER, max_daily_loss REAL, max_daily_profit REAL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE lock_events (
    id INTEGER PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    reasons TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (account_id, day)
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
  `,
];

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  const row = db.prepare('SELECT v FROM schema_version').get();
  let v = row ? row.v : 0;
  if (!row) db.prepare('INSERT INTO schema_version (v) VALUES (0)').run();
  for (; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.prepare('UPDATE schema_version SET v = ?').run(v + 1);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
