import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const checkout = fileURLToPath(new URL('../', import.meta.url));
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const bootstrap = fileURLToPath(new URL('../deploy/bootstrap-admin.mjs', import.meta.url));

void test('container bootstrap logs a usable owner key only for an empty database', () => {
  let state = mkdtempSync(join(tmpdir(), 'dune-admin-bootstrap-'));
  const d1 = (...args: string[]) => spawnSync(process.execPath, [wrangler, 'd1', ...args,
    '--local', '--config', 'tools/wrangler.local.json', '--persist-to', state],
  { cwd: checkout, encoding: 'utf8' });
  const query = (sql: string) => {
    const result = d1('execute', 'DB', '--command', sql, '--json');
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout)[0].results as Record<string, unknown>[];
  };
  const start = () => spawnSync(process.execPath, [bootstrap], {
    cwd: checkout, env: { ...process.env, DUNE_STATE_PATH: state }, encoding: 'utf8',
  });
  try {
    const migrated = d1('migrations', 'apply', 'DB');
    assert.equal(migrated.status, 0, migrated.stderr);
    const first = start();
    assert.equal(first.status, 0, first.stderr);
    const key = first.stdout.match(/dune-admin\.[0-9a-f-]{36}\.[0-9a-f]{64}/)?.[0];
    assert.ok(key, 'Initial owner key must be printed in the startup log');
    const account = query('SELECT id, role, key_hash FROM admin_accounts');
    assert.equal(account.length, 1);
    assert.equal(account[0].role, 'owner');
    assert.equal(account[0].id, key.split('.')[1]);
    assert.equal(account[0].key_hash, createHash('sha256').update(key).digest('hex'));
    assert.equal(query("SELECT id FROM admin_audit WHERE action = 'provision'").length, 1);

    const restart = start();
    assert.equal(restart.status, 0, restart.stderr);
    assert.equal(restart.stdout.includes('dune-admin.'), false);
    assert.equal(query('SELECT id FROM admin_accounts').length, 1);

    // An existing disabled account must not cause a new owner to appear.
    rmSync(state, { recursive: true, force: true });
    state = mkdtempSync(join(tmpdir(), 'dune-admin-bootstrap-'));
    const remigrated = d1('migrations', 'apply', 'DB');
    assert.equal(remigrated.status, 0, remigrated.stderr);
    query("INSERT INTO admin_accounts (id, name, role, key_hash, enabled, session_generation, created_at, updated_at) VALUES ('disabled', 'Disabled', 'viewer', 'unused-hash', 0, 0, 0, 0)");
    const noOwner = start();
    assert.equal(noOwner.status, 0, noOwner.stderr);
    assert.equal(noOwner.stdout.includes('dune-admin.'), false);
    assert.equal(query('SELECT id FROM admin_accounts').length, 1);
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});
