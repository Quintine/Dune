import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { adminLogin, requireAdmin } from '../db/admin-access';
import { adminStore, sha256 } from './admin-access-fixture';

const checkout = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(
  new URL('../tools/admin-access.mjs', import.meta.url),
);
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

void test('operator CLI writes a unique private key outside the checkout and SQL provisions with safely escaped names', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dune-admin-cli-'));
  const output = join(directory, 'owner');
  const store = adminStore();
  try {
    assert.ok(store.sqlite instanceof DatabaseSync);
    const name = "O'Brien'); DROP TABLE rooms; --";
    const result = run('--name', name, '--role', 'owner', '--out', output);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(output).sort(), [
      'access-key.txt',
      'provision.sql',
    ]);
    assert.equal(statSync(output).mode & 0o777, 0o700);
    for (const file of ['access-key.txt', 'provision.sql'])
      assert.equal(statSync(join(output, file)).mode & 0o777, 0o600);
    const key = readFileSync(join(output, 'access-key.txt'), 'utf8').trim();
    const sql = readFileSync(join(output, 'provision.sql'), 'utf8');
    assert.match(key, /^dune-admin\.[0-9a-f-]{36}\.[0-9a-f]{64}$/);
    assert.equal(sql.includes(key), false);
    assert.equal(sql.includes(key.split('.').at(-1)!), false);
    assert.equal(sql.includes(sha256(key)), true);
    assert.equal((result.stdout + result.stderr).includes(key), false);
    assert.equal((result.stdout + result.stderr).includes(sha256(key)), false);
    store.sqlite.exec(sql);
    assert.equal(
      store.sqlite.prepare('SELECT name FROM admin_accounts').get()!.name,
      name,
    );
    assert.equal(
      store.sqlite.prepare('SELECT count(*) AS n FROM rooms').get()!.n,
      0,
    );
    assert.equal(
      store.sqlite
        .prepare(
          "SELECT count(*) AS n FROM admin_audit WHERE action = 'provision'",
        )
        .get()!.n,
      1,
    );
    const login = await adminLogin(store.database, key, 1000);
    await requireAdmin(store.database, login.token, ['owner'], 2000);
    assert.throws(() => store.sqlite.exec(sql), /UNIQUE constraint/);
    assert.equal(
      store.sqlite
        .prepare(
          "SELECT count(*) AS n FROM admin_audit WHERE action = 'provision'",
        )
        .get()!.n,
      1,
    );
  } finally {
    store.sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('operator CLI revocation needs only a safe account ID, revokes sessions and refuses the final enabled owner', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dune-admin-revoke-cli-'));
  const store = adminStore();
  try {
    const first = store.provision();
    const second = store.provision();
    const login = await adminLogin(store.database, first.key, 1000);
    const output = join(directory, 'revoke');
    const result = run('--revoke', first.id, '--out', output);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(output), ['revoke.sql']);
    const sql = readFileSync(join(output, 'revoke.sql'), 'utf8');
    assert.equal(
      (sql + result.stdout + result.stderr).includes(first.key),
      false,
    );
    assert.equal(sql.includes('key_hash'), false);
    store.sqlite.exec(sql);
    await assert.rejects(
      requireAdmin(store.database, login.token, undefined, 2000),
    );
    await assert.rejects(adminLogin(store.database, first.key, 2000));
    assert.equal(
      store.sqlite
        .prepare(
          "SELECT count(*) AS n FROM admin_audit WHERE action = 'revoke'",
        )
        .get()!.n,
      1,
    );
    store.sqlite.exec(sql);
    assert.equal(
      store.sqlite
        .prepare(
          "SELECT count(*) AS n FROM admin_audit WHERE action = 'revoke'",
        )
        .get()!.n,
      1,
    );
    const lastOutput = join(directory, 'last');
    assert.equal(run('--revoke', second.id, '--out', lastOutput).status, 0);
    assert.throws(
      () =>
        store.sqlite.exec(readFileSync(join(lastOutput, 'revoke.sql'), 'utf8')),
      /final enabled administrator owner/,
    );
    assert.equal(
      store.sqlite
        .prepare('SELECT enabled FROM admin_accounts WHERE id = ?')
        .get(second.id)!.enabled,
      1,
    );
  } finally {
    store.sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('operator CLI refuses existing paths, checkout paths and symlink aliases without overwriting files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dune-admin-paths-'));
  const inside = join(checkout, '.admin-test-output');
  try {
    assert.equal(existsSync(inside), false);
    const direct = run('--name', 'Owner', '--role', 'owner', '--out', inside);
    assert.equal(direct.status, 1);
    assert.equal(existsSync(inside), false);
    const alias = join(directory, 'checkout-alias');
    symlinkSync(checkout, alias, 'dir');
    const viaAlias = run(
      '--name',
      'Owner',
      '--role',
      'owner',
      '--out',
      join(alias, '.admin-test-output'),
    );
    assert.equal(viaAlias.status, 1);
    assert.equal(existsSync(inside), false);
    const existing = join(directory, 'existing');
    mkdirSync(existing, { mode: 0o700 });
    writeFileSync(join(existing, 'access-key.txt'), 'existing private value', {
      mode: 0o600,
    });
    const reuse = run('--name', 'Owner', '--role', 'owner', '--out', existing);
    assert.equal(reuse.status, 1);
    assert.equal(
      readFileSync(join(existing, 'access-key.txt'), 'utf8'),
      'existing private value',
    );
    assert.equal(
      (reuse.stdout + reuse.stderr).includes('existing private value'),
      false,
    );
    assert.deepEqual(readdirSync(existing), ['access-key.txt']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('operator CLI rejects malformed names, roles, IDs and incomplete commands before generating any credential', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dune-admin-input-'));
  try {
    const output = join(directory, 'new');
    for (const args of [
      [],
      ['--name', 'Owner', '--out', output],
      ['--name', 'Owner', '--role', 'superuser', '--out', output],
      ['--name', ' ', '--role', 'owner', '--out', output],
      ['--name', 'Owner\nInjected', '--role', 'owner', '--out', output],
      ['--name', 'x'.repeat(81), '--role', 'owner', '--out', output],
      [
        '--name',
        'Owner',
        '--role',
        'owner',
        '--role',
        'viewer',
        '--out',
        output,
      ],
      ['--name', 'Owner', '--role', 'owner', '--out', 'relative-output'],
      ['--revoke', "x' OR 1=1;--", '--out', output],
      [
        '--revoke',
        '10000000-0000-4000-8000-000000000001',
        '--name',
        'Owner',
        '--out',
        output,
      ],
    ]) {
      assert.equal(run(...args).status, 1);
      assert.equal(existsSync(output), false);
    }
    const help = run('--help');
    assert.equal(help.status, 0);
    assert.match(help.stdout, /No database is contacted/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
