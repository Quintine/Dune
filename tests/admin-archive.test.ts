import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adminStore, pauseAdminBatch, sha256 } from './admin-access-fixture';
import {
  AdminError,
  adminLogin,
  requireAdmin,
  type AdminRole,
} from '../db/admin-access';
import { applyAdminArchive, readAdminArchive } from '../db/admin-archive';
import {
  validAdminArchiveInput,
  type AdminArchiveInput,
} from '../lib/admin-archive';
import { applyAdminRemoval, readAdminRemoval } from '../db/admin-removal';
import { applyAdminClosure, readAdminClosure } from '../db/admin-closure';
import { createGame, newPlayer } from '../game/engine';

const now = 10000;
const secret = () => randomBytes(32).toString('hex');
const status = (value: number) => (error: unknown) =>
  error instanceof AdminError && error.status === value;
type Store = ReturnType<typeof adminStore>;
const rows = (store: Store, table: string) =>
  store.sqlite.prepare(`SELECT * FROM ${table}`).all();
const secureTables = [
  'room_closures',
  'seats',
  'seat_recovery_keys',
  'seat_recovery_receipts',
  'seat_handover_offers',
  'seat_handover_claim_receipts',
  'seat_ai_delegations',
  'room_entry_receipts',
  'room_messages',
];
const secureRows = (store: Store) =>
  secureTables.map((table) => rows(store, table));
const change = (
  expectedVersion = 0,
  expectedRevision = 0,
  archived = true,
): AdminArchiveInput => ({
  operationId: randomUUID(),
  expectedVersion,
  expectedRevision,
  archived,
  reason: 'Dedicated QA room archive',
});
function seed(store: Store, code = 'ARCHIVES') {
  const host = newPlayer(randomUUID(), 'Private player name', 'atreides');
  const game = createGame(code, host, false);
  const token = secret(),
    tokenHash = sha256(token),
    revokedHash = sha256(secret());
  store.sqlite
    .prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)')
    .run(code, JSON.stringify(game), 0, 1000);
  store.sqlite
    .prepare(
      'INSERT INTO seats(token_hash,room_code,player_id,revoked) VALUES(?,?,?,?)',
    )
    .run(tokenHash, code, host.id, 0);
  store.sqlite
    .prepare(
      'INSERT INTO seats(token_hash,room_code,player_id,revoked) VALUES(?,?,?,?)',
    )
    .run(revokedHash, code, host.id, 1);
  store.sqlite.prepare('INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES (?,1,1,100,100)').run(code);
  return { host, game, token, tokenHash, revokedHash, code };
}
function seedDependents(store: Store, room: ReturnType<typeof seed>) {
  const { code, host, tokenHash } = room;
  store.sqlite
    .prepare(
      'INSERT INTO room_entry_receipts(operation_hash,request_hash,session_hash,room_code,player_id) VALUES(?,?,?,?,?)',
    )
    .run(sha256(secret()), sha256(secret()), tokenHash, code, host.id);
  store.sqlite
    .prepare(
      'INSERT INTO seat_recovery_keys(room_code,player_id,recovery_hash,current_operation_hash) VALUES(?,?,?,?)',
    )
    .run(code, host.id, sha256(secret()), sha256(secret()));
  store.sqlite
    .prepare(
      'INSERT INTO seat_recovery_receipts(room_code,player_id,operation_hash,session_hash,recovery_hash) VALUES(?,?,?,?,?)',
    )
    .run(code, host.id, sha256(secret()), tokenHash, sha256(secret()));
  store.sqlite
    .prepare(
      'INSERT INTO seat_handover_offers(room_code,player_id,offer_hash,secret_hash,issuer_session_hash,expires_at) VALUES(?,?,?,?,?,?)',
    )
    .run(code, host.id, sha256(secret()), sha256(secret()), tokenHash, now + 1);
  store.sqlite
    .prepare(
      'INSERT INTO seat_handover_claim_receipts(room_code,player_id,operation_hash,offer_hash,secret_hash,session_hash,claim_fence,claimed_at) VALUES(?,?,?,?,?,?,?,?)',
    )
    .run(
      code,
      host.id,
      sha256(secret()),
      sha256(secret()),
      sha256(secret()),
      tokenHash,
      sha256(secret()),
      now,
    );
  store.sqlite
    .prepare(
      'INSERT INTO seat_ai_delegations(room_code,owner_id,grant_id,delegate_id,difficulty,owner_session_hash,delegate_session_hash,expires_at,revoked_at) VALUES(?,?,?,?,?,?,?,?,?)',
    )
    .run(
      code,
      host.id,
      randomUUID(),
      randomUUID(),
      'Hard',
      tokenHash,
      sha256(secret()),
      now + 1,
      now,
    );
  store.sqlite
    .prepare(
      'INSERT INTO room_messages(room_code,id,sender_id,sender_session_hash,sender_name,sender_faction,recipient_id,recipient_name,body,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      code,
      randomUUID(),
      host.id,
      tokenHash,
      host.name,
      host.faction,
      randomUUID(),
      'Private recipient',
      'Private saved discussion',
      now,
    );
}
async function fixture(role: AdminRole = 'operator') {
  const store = adminStore();
  const account = store.provision(role, 'Private administrator');
  const login = await adminLogin(store.database, account.key, now);
  const identity = await requireAdmin(
    store.database,
    login.token,
    undefined,
    now,
  );
  const room = seed(store);
  const row = () =>
    store.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(room.code)!;
  const version = () => Number(row().version);
  const read = () => readAdminArchive(store.database, identity, room.code, now);
  const apply = (input = change(version()), at = now) =>
    applyAdminArchive(store.database, identity, room.code, input, at);
  return {
    ...store,
    ...room,
    account,
    login,
    identity,
    row,
    version,
    read,
    apply,
  };
}
function gateBatch(store: Store, number = 1) {
  let enter!: () => void, release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  store.hooks.beforeBatch = async () => {
    if (--number) return;
    delete store.hooks.beforeBatch;
    enter();
    await gate;
  };
  return { waiting, release };
}

void test('archive migration is additive and preserves all existing rooms, credentials and audit records', () => {
  const store = adminStore(':memory:', false);
  try {
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((file) => file.endsWith('.sql') && file < '0014')
      .sort())
      store.sqlite.exec(
        readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
      );
    const room = seed(store);
    seedDependents(store, room);
    store.provision();
    const tables = [
      'rooms',
      ...secureTables,
      'room_controls',
      'admin_accounts',
      'admin_sessions',
      'admin_audit',
      'admin_room_audit',
      'admin_room_creations',
      'admin_lobby_operations',
    ];
    const before = tables.map((table) => rows(store, table));
    store.sqlite.exec(
      readFileSync(
        new URL('../drizzle/0014_admin_room_archive.sql', import.meta.url),
        'utf8',
      ),
    );
    assert.deepEqual(
      tables.map((table) => rows(store, table)),
      before,
    );
    assert.deepEqual(rows(store, 'room_archives'), []);
    assert.deepEqual(rows(store, 'admin_room_archives'), []);
    assert.throws(
      () =>
        store.sqlite
          .prepare(
            'INSERT INTO room_archives(room_code,archived,revision,updated_at) VALUES(?,1,0,?)',
          )
          .run(room.code, now),
      /CHECK/,
    );
  } finally {
    store.sqlite.close();
  }
});

void test('archive inputs require exact bounded fields and both safe version counters', () => {
  const valid = change();
  assert.equal(validAdminArchiveInput(valid), true);
  for (const invalid of [
    null,
    [],
    {},
    { ...valid, extra: true },
    { ...valid, archived: 1 },
    ...['', ' ', 'x'.repeat(301), 'line\n', 'a\u007f'].map((reason) => ({
      ...valid,
      reason,
    })),
    ...['', valid.operationId + '\n', valid.operationId.toUpperCase()].map(
      (operationId) => ({ ...valid, operationId }),
    ),
    ...[-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER, '0'].flatMap(
      (value) => [
        { ...valid, expectedVersion: value },
        { ...valid, expectedRevision: value },
      ],
    ),
    Object.assign(Object.create({ archived: true }), {
      operationId: valid.operationId,
      expectedVersion: 0,
      expectedRevision: 0,
      reason: 'Reason',
      other: true,
    }),
  ])
    assert.equal(validAdminArchiveInput(invalid), false);
});

void test('live roles can read only operational defaults without backfilling or disclosing room and seat contents', async () => {
  for (const role of ['owner', 'operator', 'viewer'] as const) {
    const f = await fixture(role);
    try {
      const before = f.row();
      assert.deepEqual(await f.read(), {
        code: f.code,
        version: 0,
        archived: false,
        closed: true,
        removed: false,
        revision: 0,
        archivedAt: null,
        updatedAt: null,
        paused: false,
        joinLocked: false,
      });
      assert.deepEqual(f.row(), before);
      assert.deepEqual(rows(f, 'room_archives'), []);
      if (role === 'viewer') await assert.rejects(f.apply(), status(403));
      else assert.equal((await f.apply()).room.archived, true);
      await assert.rejects(
        readAdminArchive(f.database, f.identity, f.code + '\n', now),
        status(400),
      );
      await assert.rejects(
        readAdminArchive(f.database, f.identity, 'ABSENTAA', now),
        status(404),
      );
      await assert.rejects(
        readAdminArchive(
          f.database,
          { ...f.identity, sessionHash: f.tokenHash },
          f.code,
          now,
        ),
        status(401),
      );
    } finally {
      f.sqlite.close();
    }
  }
});

void test('archive and unarchive preserve saved JSON, every dependent record, revoked access and unrelated rooms', async () => {
  const f = await fixture();
  try {
    seedDependents(f, f);
    const other = seed(f, 'KEEPSAFE');
    const old = f.row(),
      secure = secureRows(f);
    const untouched = f.sqlite
      .prepare('SELECT * FROM rooms WHERE code=?')
      .get(other.code);
    const result = await f.apply();
    assert.equal(result.replayed, false);
    assert.equal(result.appliedVersion, 1);
    assert.equal(result.appliedRevision, 1);
    assert.deepEqual(result.room, {
      code: f.code,
      version: 1,
      archived: true,
      closed: true,
      removed: false,
      revision: 1,
      archivedAt: now,
      updatedAt: now,
      paused: false,
      joinLocked: false,
    });
    assert.equal(f.row().state, old.state);
    assert.equal(f.row().updated_at, old.updated_at);
    const reopend = await f.apply(change(1, 1, false), now + 5000);
    assert.deepEqual(reopend.room, {
      ...result.room,
      version: 2,
      archived: false,
      revision: 2,
      archivedAt: null,
      updatedAt: now + 5000,
    });
    assert.equal(f.row().state, old.state);
    assert.equal(f.row().updated_at, old.updated_at);
    assert.deepEqual(secureRows(f), secure);
    assert.deepEqual(
      f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(other.code),
      untouched,
    );
    assert.equal(rows(f, 'room_archives').length, 1);
    const audit = rows(f, 'admin_room_archives');
    assert.equal(audit.length, 2);
    for (const row of audit) {
      const metadata = JSON.stringify([
        JSON.parse(String(row.before_metadata)),
        JSON.parse(String(row.after_metadata)),
      ]);
      for (const privateValue of [
        f.host.id,
        f.host.name,
        f.token,
        f.tokenHash,
        'Private saved discussion',
        'spice',
        'deck',
        f.account.name,
      ])
        assert.equal(metadata.includes(privateValue), false);
      assert.equal(row.actor_admin_id, f.identity.id);
      assert.equal(row.reason, change().reason);
    }
  } finally {
    f.sqlite.close();
  }
});

void test('archiving and unarchiving tolerate unreadable saves without parsing diagnostics or repairing JSON', async () => {
  for (const state of [
    '{invalid private save',
    'null',
    '[]',
    '{"status":"playing","players":[null,7,"private"]}',
  ]) {
    const f = await fixture();
    try {
      f.sqlite
        .prepare('UPDATE rooms SET state=? WHERE code=?')
        .run(state, f.code);
      await f.apply();
      assert.equal((await f.read()).archived, true);
      await f.apply(change(1, 1, false));
      assert.equal(f.row().state, state);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('exact receipts bind actor, room and normalized intent and report current state after later transitions', async () => {
  const f = await fixture();
  try {
    const input = { ...change(), reason: '  Exact QA reason  ' };
    const first = await f.apply(input);
    const reopen = await f.apply(change(1, 1, false), now + 1);
    const replay = await f.apply(
      { ...input, reason: 'Exact QA reason' },
      now + 2,
    );
    assert.deepEqual(replay, { ...first, replayed: true, room: reopen.room });
    const before = f.row();
    for (const mismatch of [
      { ...input, expectedVersion: 1 },
      { ...input, expectedRevision: 1 },
      { ...input, archived: false },
      { ...input, reason: 'Other reason' },
    ])
      await assert.rejects(f.apply(mismatch), status(409));
    const account = f.provision('operator');
    const login = await adminLogin(f.database, account.key, now);
    const identity = await requireAdmin(
      f.database,
      login.token,
      undefined,
      now,
    );
    await assert.rejects(
      applyAdminArchive(f.database, identity, f.code, input, now),
      status(409),
    );
    seed(f, 'KEEPSAFE');
    await assert.rejects(
      applyAdminArchive(f.database, f.identity, 'KEEPSAFE', input, now),
      status(409),
    );
    assert.deepEqual(f.row(), before);
    assert.equal(rows(f, 'admin_room_archives').length, 2);
  } finally {
    f.sqlite.close();
  }
});

void test('new no-op and stale requests reject without writes; both room version and archive revision fence races', async () => {
  const f = await fixture();
  try {
    const before = f.row();
    for (const input of [change(0, 0, false), change(1), change(0, 1)])
      await assert.rejects(f.apply(input), status(409));
    assert.deepEqual(f.row(), before);
    assert.deepEqual(rows(f, 'admin_room_archives'), []);
    const pending = change();
    const gate = pauseAdminBatch(f);
    const result = f.apply(pending).then(
      () => null,
      (error: unknown) => error,
    );
    await gate.waiting;
    f.sqlite
      .prepare('UPDATE rooms SET version=version+1 WHERE code=?')
      .run(f.code);
    gate.release();
    assert.ok(status(409)(await result));
    await f.apply(change(1));
    await assert.rejects(f.apply(change(2, 1, true)), status(409));
    await assert.rejects(f.apply(change(2, 0, false)), status(409));
    assert.equal(rows(f, 'admin_room_archives').length, 1);
  } finally {
    f.sqlite.close();
  }
});

void test('live session, account, role, expiry and generation authority fences reads, writes and exact replay', async () => {
  for (const operation of ['read', 'write', 'replay'] as const)
    for (const revoke of [
      'disabled',
      'role',
      'session',
      'generation',
      'expiry',
    ] as const) {
      const f = await fixture();
      try {
        const input = change();
        if (operation === 'replay') await f.apply(input);
        const before = f.row(),
          audit = rows(f, 'admin_room_archives');
        const gate = pauseAdminBatch(f);
        const pending = (operation === 'read' ? f.read() : f.apply(input)).then(
          () => null,
          (error: unknown) => error,
        );
        await gate.waiting;
        if (revoke === 'disabled')
          f.sqlite
            .prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?')
            .run(f.identity.id);
        if (revoke === 'role')
          f.sqlite
            .prepare("UPDATE admin_accounts SET role='viewer' WHERE id=?")
            .run(f.identity.id);
        if (revoke === 'session')
          f.sqlite
            .prepare(
              'UPDATE admin_sessions SET revoked_at=? WHERE token_hash=?',
            )
            .run(now, f.identity.sessionHash);
        if (revoke === 'generation')
          f.sqlite
            .prepare(
              'UPDATE admin_accounts SET session_generation=session_generation+1 WHERE id=?',
            )
            .run(f.identity.id);
        if (revoke === 'expiry')
          f.sqlite
            .prepare(
              'UPDATE admin_sessions SET expires_at=? WHERE token_hash=?',
            )
            .run(now, f.identity.sessionHash);
        gate.release();
        const result = await pending;
        if (revoke === 'role' && operation === 'read')
          assert.equal(result, null);
        else assert.ok(status(revoke === 'role' ? 403 : 401)(result));
        assert.deepEqual(f.row(), before);
        assert.deepEqual(rows(f, 'admin_room_archives'), audit);
      } finally {
        f.sqlite.close();
      }
    }
});

void test('queued identical requests commit once while competing operations cannot reuse the old version', async () => {
  for (const same of [true, false]) {
    const f = await fixture();
    try {
      const input = change(),
        gate = pauseAdminBatch(f);
      const pending = f.apply(input).then(
        (value) => value,
        (error: unknown) => error,
      );
      await gate.waiting;
      const first = await f.apply(same ? input : change());
      gate.release();
      const second = await pending;
      if (same) assert.deepEqual(second, { ...first, replayed: true });
      else assert.ok(status(409)(second));
      assert.equal(f.version(), 1);
      assert.equal(rows(f, 'admin_room_archives').length, 1);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('audit, game fence and archive metadata roll back together at every failed persistence stage', async () => {
  for (const table of ['admin_room_archives', 'rooms', 'room_archives']) {
    const f = await fixture();
    try {
      const before = f.row(),
        secure = secureRows(f);
      f.sqlite.exec(
        `CREATE TRIGGER qa_failure BEFORE ${table === 'rooms' ? 'UPDATE' : 'INSERT'} ON ${table} BEGIN SELECT RAISE(ABORT,'QA archive failure'); END;`,
      );
      await assert.rejects(f.apply(), /QA archive failure/);
      assert.deepEqual(f.row(), before);
      assert.deepEqual(secureRows(f), secure);
      assert.deepEqual(rows(f, 'admin_room_archives'), []);
      assert.deepEqual(rows(f, 'room_archives'), []);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('archived games and exact receipts survive database reopen without restoring historical credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dune-admin-archive-'));
  let store = adminStore(join(dir, 'rooms.sqlite'));
  try {
    const account = store.provision('operator'),
      login = await adminLogin(store.database, account.key, now);
    const identity = await requireAdmin(
        store.database,
        login.token,
        undefined,
        now,
      ),
      room = seed(store);
    seedDependents(store, room);
    const secure = secureRows(store),
      state = rows(store, 'rooms')[0].state;
    const input = change();
    const archived = await applyAdminArchive(
      store.database,
      identity,
      room.code,
      input,
      now,
    );
    store.sqlite.close();
    store = adminStore(join(dir, 'rooms.sqlite'), false);
    assert.deepEqual(
      await applyAdminArchive(store.database, identity, room.code, input, now),
      { ...archived, replayed: true },
    );
    await applyAdminArchive(
      store.database,
      identity,
      room.code,
      change(1, 1, false),
      now + 10000,
    );
    assert.equal(rows(store, 'rooms')[0].state, state);
    assert.deepEqual(secureRows(store), secure);
    const audit = rows(store, 'admin_room_archives');
    store.sqlite.prepare('DELETE FROM rooms WHERE code=?').run(room.code);
    assert.deepEqual(rows(store, 'admin_room_archives'), audit);
  } finally {
    store.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

void test('archive requires closure; unarchive leaves closure and reopening requires unarchive first', async () => {
  const f = await fixture();
  try {
    const native = await readAdminClosure(f.database, f.identity, f.code, now);
    const reopen = { operationId: randomUUID(), expectedVersion: f.version(), expectedRevision: native.revision, closed: false, reason: 'QA reopening' };
    const oldState = f.row().state;
    await applyAdminClosure(f.database, f.identity, f.code, reopen, now);
    const open = f.row();
    await assert.rejects(f.apply(change(f.version())), /Close this room/);
    assert.deepEqual(f.row(), open);
    const close = { ...reopen, operationId: randomUUID(), expectedVersion: f.version(), expectedRevision: 2, closed: true };
    await applyAdminClosure(f.database, f.identity, f.code, close, now);
    const input = change(f.version());
    await f.apply(input);
    const archived = f.row();
    assert.equal((await readAdminClosure(f.database, f.identity, f.code, now)).archived, true);
    await assert.rejects(applyAdminClosure(f.database, f.identity, f.code, { ...reopen, operationId: randomUUID(), expectedVersion: f.version(), expectedRevision: 3 }, now), /Unarchive/);
    assert.deepEqual(f.row(), archived);
    const oldClosureReceipt = await applyAdminClosure(f.database, f.identity, f.code, close, now);
    assert.equal(oldClosureReceipt.replayed, true);
    assert.equal(oldClosureReceipt.room.archived, true);
    const unarchive = change(f.version(), 1, false);
    await f.apply(unarchive);
    assert.equal((await f.read()).closed, true);
    assert.equal((await readAdminClosure(f.database, f.identity, f.code, now)).archived, undefined);
    await applyAdminClosure(f.database, f.identity, f.code, { ...reopen, operationId: randomUUID(), expectedVersion: f.version(), expectedRevision: 3 }, now);
    assert.equal((await f.read()).closed, false);
    assert.equal(f.row().state, oldState);
    const after = f.row();
    const receipt = await f.apply(input);
    assert.equal(receipt.replayed, true); assert.equal(receipt.room.closed, false); assert.equal(receipt.room.archived, false);
    assert.deepEqual(f.row(), after);
  } finally { f.sqlite.close(); }
});

void test('removal and restoration preserve archived closure and every saved AI deadline and credential', async () => {
  for (const paused of [false, true]) for (const controller of ['bot', 'autopilot', 'human'] as const) {
    const f = await fixture();
    try {
      const game = structuredClone(f.game);
      game.status = 'playing';
      if (controller !== 'human') game.players[0][controller] = 'Hard';
      game.botsPending = controller !== 'human'; game.botNextActionAt = 5;
      f.sqlite.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game), f.code);
      f.sqlite.prepare('INSERT INTO room_controls(room_code,paused,join_locked,revision,updated_at) VALUES (?,?,1,1,100)').run(f.code, Number(paused));
      seedDependents(f, f);
      const original = f.row(), secure = secureRows(f), controls = rows(f, 'room_controls');
      const input = change();
      await f.apply(input);
      const remove = { operationId: randomUUID(), expectedVersion: f.version(), expectedRevision: 0, removed: true, reason: 'QA removal' };
      await applyAdminRemoval(f.database, f.identity, f.code, remove, now);
      assert.equal((await readAdminRemoval(f.database, f.identity, f.code, now)).archived, true);
      const removed = f.row();
      const receipt = await f.apply(input); assert.equal(receipt.replayed, true); assert.equal(receipt.room.removed, true);
      await assert.rejects(f.apply(change(f.version(), 1, false)), /Restore/);
      assert.deepEqual(f.row(), removed);
      await applyAdminRemoval(f.database, f.identity, f.code, { ...remove, operationId: randomUUID(), expectedVersion: f.version(), expectedRevision: 1, removed: false }, now + 10000);
      assert.equal((await f.read()).archived, true); assert.equal((await f.read()).closed, true);
      const beforeUnarchive = f.row();
      await f.apply(change(f.version(), 1, false), now + 20000);
      assert.equal(f.row().state, original.state);
      assert.equal(f.row().updated_at, beforeUnarchive.updated_at);
      assert.deepEqual(secureRows(f), secure); assert.deepEqual(rows(f, 'room_controls'), controls);
      assert.equal((await f.read()).closed, true);
    } finally { f.sqlite.close(); }
  }
});

void test('reopening and archiving cannot both win a transaction race, in either order', async () => {
  for (const archiveFirst of [false, true]) {
    const f = await fixture();
    try {
      const before = f.row().state;
      const archive = () => f.apply(change());
      const reopen = () => applyAdminClosure(f.database, f.identity, f.code, { operationId: randomUUID(), expectedVersion: 0, expectedRevision: 1, closed: false, reason: 'QA reopen race' }, now);
      const gate = gateBatch(f);
      const pending = (archiveFirst ? reopen() : archive()).then(() => null, (error: unknown) => error);
      await gate.waiting;
      await (archiveFirst ? archive() : reopen()); gate.release();
      assert.ok(status(409)(await pending));
      const current = await f.read(); assert.equal(current.archived, archiveFirst); assert.equal(current.closed, archiveFirst);
      assert.equal(f.row().state, before); assert.equal(f.version(), 1);
      assert.equal(rows(f, 'admin_room_archives').length + rows(f, 'admin_room_closures').length, 1);
    } finally { f.sqlite.close(); }
  }
});

void test('removal fences a queued archive or unarchive without erasing a prior exact receipt', async () => {
  for (const unarchive of [false, true]) {
    const f = await fixture();
    try {
      const original = change();
      if (unarchive) await f.apply(original);
      const gate = gateBatch(f);
      const pending = f.apply(change(f.version(), unarchive ? 1 : 0, !unarchive)).then(() => null, (error: unknown) => error);
      await gate.waiting;
      await applyAdminRemoval(f.database, f.identity, f.code, { operationId: randomUUID(), expectedVersion: f.version(), expectedRevision: 0, removed: true, reason: 'QA remove race' }, now);
      const removed = f.row(); gate.release();
      assert.ok(status(409)(await pending)); assert.deepEqual(f.row(), removed);
      assert.equal((await f.read()).archived, unarchive);
      if (unarchive) assert.equal((await f.apply(original)).replayed, true);
    } finally { f.sqlite.close(); }
  }
});
