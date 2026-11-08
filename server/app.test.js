import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';

async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kj-test-'));
  const app = createApp({ dataDir: dir });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
  try { await fn(api, base, dir); } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('accounts, trades, tags, import de-dup, lock status, persistence', async () => {
  await withServer(async (api, base, dir) => {
    const acc = (await api('POST', '/api/accounts', { name: 'Tradovate 1', broker: 'Tradovate' })).body;
    assert.equal(acc.name, 'Tradovate 1');

    const bad = await api('POST', '/api/trades', { account_id: acc.id, symbol: 'MES' });
    assert.equal(bad.status, 400);

    const t = (await api('POST', '/api/trades', {
      account_id: acc.id, symbol: 'MES', side: 'long', qty: 1, open_time: '2025-06-04T14:00:00Z', close_time: '2025-06-04T14:05:00Z',
      net_pnl: -40, tags: [{ name: 'FOMO', category: 'mistake' }],
    })).body;
    assert.equal(t.tags[0].name, 'FOMO');

    const upd = (await api('PUT', `/api/trades/${t.id}`, { notes: 'chased', rating: 2, rule_checks: { r0: true } })).body;
    assert.equal(upd.notes, 'chased');
    assert.equal(upd.rule_checks.r0, true);

    const rows = [
      { symbol: 'MES', side: 'long', qty: 1, open_time: '2025-06-04T15:00:00Z', close_time: '2025-06-04T15:01:00Z', net_pnl: -30, external_id: 'a' },
      { symbol: 'MES', side: 'short', qty: 1, open_time: '2025-06-04T15:10:00Z', close_time: '2025-06-04T15:11:00Z', net_pnl: 50, external_id: 'b' },
    ];
    const i1 = (await api('POST', '/api/import', { account_id: acc.id, source: 'test', trades: rows })).body;
    assert.deepEqual([i1.imported, i1.duplicates], [2, 0]);
    const i2 = (await api('POST', '/api/import', { account_id: acc.id, source: 'test', trades: rows })).body;
    assert.deepEqual([i2.imported, i2.duplicates], [0, 2]);

    await api('PUT', `/api/lock-rules/${acc.id}`, { enabled: true, max_losses: 2 });
    const st = (await api('GET', '/api/lock-status?now=2025-06-04T16:00:00Z')).body;
    assert.equal(st[0].locked, true);
    assert.equal(st[0].counts.losses, 2);

    // Screenshot upload
    const fd = new FormData();
    fd.append('files', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'chart.png');
    const up = await fetch(`${base}/api/trades/${t.id}/attachments`, { method: 'POST', body: fd });
    const att = await up.json();
    assert.equal(up.status, 200);
    assert.ok(fs.existsSync(path.join(dir, 'uploads', att[0].filename)));
    const img = await fetch(`${base}/uploads/${att[0].filename}`);
    assert.equal(img.status, 200);

    const fd2 = new FormData();
    fd2.append('files', new Blob(['hi'], { type: 'text/plain' }), 'x.txt');
    assert.equal((await fetch(`${base}/api/trades/${t.id}/attachments`, { method: 'POST', body: fd2 })).status, 400);

    const all = (await api('GET', `/api/trades?accounts=${acc.id}`)).body;
    assert.equal(all.length, 3);
    assert.equal(all.find(x => x.id === t.id).attachment_count, 1);

    // Undo import removes its trades
    const del = (await api('DELETE', `/api/imports/${i1.import_id}`)).body;
    assert.equal(del.deleted_trades, 2);
  });
});

test('data survives a restart (file-backed SQLite)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kj-persist-'));
  const a1 = createApp({ dataDir: dir });
  a1.locals.db.prepare("INSERT INTO accounts (name) VALUES ('Persisted')").run();
  a1.locals.db.close();
  const a2 = createApp({ dataDir: dir });
  assert.equal(a2.locals.db.prepare('SELECT name FROM accounts').get().name, 'Persisted');
  a2.locals.db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('demo data is clearly marked', async () => {
  await withServer(async api => {
    const r = (await api('POST', '/api/demo')).body;
    assert.ok(r.trades > 20);
    const accs = (await api('GET', '/api/accounts')).body;
    assert.equal(accs[0].is_demo, 1);
    assert.match(accs[0].name, /Demo/);
  });
});
