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
import { applyAdminRemoval, readAdminRemoval } from '../db/admin-removal';
import {
  validAdminRemovalInput,
  type AdminRemovalInput,
} from '../lib/admin-removal';
import {
  applyAdminRoomControl,
  readAdminRoomControl,
} from '../db/admin-lifecycle';
import {
  configureAdminLobby,
  readAdminLobby,
} from '../db/admin-lobby-configuration';
import { createAdminRoom } from '../db/admin-room-creation';
import { createGame, newPlayer } from '../game/engine';

const now = 10000;
const secret = () => randomBytes(32).toString('hex');
const status = (value: number) => (error: unknown) =>
  error instanceof AdminError && error.status === value;
type Store = ReturnType<typeof adminStore>;
const rows = (store: Store, table: string) =>
  store.sqlite.prepare(`SELECT * FROM ${table}`).all();
const secureTables = [
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
  removed = true,
): AdminRemovalInput => ({
  operationId: randomUUID(),
  expectedVersion,
  expectedRevision,
  removed,
  reason: 'Dedicated QA room removal',
});
function seed(store: Store, code = 'REMOVALS') {
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
  const read = () => readAdminRemoval(store.database, identity, room.code, now);
  const apply = (input = change(version()), at = now) =>
    applyAdminRemoval(store.database, identity, room.code, input, at);
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

void test('removal migration is additive and preserves all existing rooms, credentials and audit records', () => {
  const store = adminStore(':memory:', false);
  try {
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((file) => file.endsWith('.sql') && file < '0012')
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
        new URL('../drizzle/0012_admin_room_removal.sql', import.meta.url),
        'utf8',
      ),
    );
    assert.deepEqual(
      tables.map((table) => rows(store, table)),
      before,
    );
    assert.deepEqual(rows(store, 'room_removals'), []);
    assert.deepEqual(rows(store, 'admin_room_removals'), []);
    assert.throws(
      () =>
        store.sqlite
          .prepare(
            'INSERT INTO room_removals(room_code,removed,revision,updated_at) VALUES(?,1,0,?)',
          )
          .run(room.code, now),
      /CHECK/,
    );
  } finally {
    store.sqlite.close();
  }
});

void test('removal inputs require exact bounded fields and both safe version counters', () => {
  const valid = change();
  assert.equal(validAdminRemovalInput(valid), true);
  for (const invalid of [
    null,
    [],
    {},
    { ...valid, extra: true },
    { ...valid, removed: 1 },
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
    Object.assign(Object.create({ removed: true }), {
      operationId: valid.operationId,
      expectedVersion: 0,
      expectedRevision: 0,
      reason: 'Reason',
      other: true,
    }),
  ])
    assert.equal(validAdminRemovalInput(invalid), false);
});

void test('live roles can read only operational defaults without backfilling or disclosing room and seat contents', async () => {
  for (const role of ['owner', 'operator', 'viewer'] as const) {
    const f = await fixture(role);
    try {
      const before = f.row();
      assert.deepEqual(await f.read(), {
        code: f.code,
        version: 0,
        removed: false,
        revision: 0,
        removedAt: null,
        updatedAt: null,
        paused: false,
        joinLocked: false,
      });
      assert.deepEqual(f.row(), before);
      assert.deepEqual(rows(f, 'room_removals'), []);
      if (role === 'viewer') await assert.rejects(f.apply(), status(403));
      else assert.equal((await f.apply()).room.removed, true);
      await assert.rejects(
        readAdminRemoval(f.database, f.identity, f.code + '\n', now),
        status(400),
      );
      await assert.rejects(
        readAdminRemoval(f.database, f.identity, 'ABSENTAA', now),
        status(404),
      );
      await assert.rejects(
        readAdminRemoval(
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

void test('remove and restore preserve saved JSON, every dependent record, revoked access and unrelated rooms', async () => {
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
      removed: true,
      revision: 1,
      removedAt: now,
      updatedAt: now,
      paused: false,
      joinLocked: false,
    });
    assert.equal(f.row().state, old.state);
    const restored = await f.apply(change(1, 1, false), now + 5000);
    assert.deepEqual(restored.room, {
      ...result.room,
      version: 2,
      removed: false,
      revision: 2,
      removedAt: null,
      updatedAt: now + 5000,
    });
    assert.equal(f.row().state, old.state);
    assert.deepEqual(secureRows(f), secure);
    assert.deepEqual(
      f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(other.code),
      untouched,
    );
    assert.equal(rows(f, 'room_removals').length, 1);
    const audit = rows(f, 'admin_room_removals');
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

void test('removal and restoration tolerate unreadable saves without parsing diagnostics or repairing JSON', async () => {
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
      assert.equal((await f.read()).removed, true);
      await f.apply(change(1, 1, false));
      assert.equal(f.row().state, state);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('restoration refreshes existing AI pacing only when unpaused and preserves pause and joining flags', async () => {
  for (const paused of [false, true])
    for (const controller of ['bot', 'autopilot', 'human'] as const) {
      const f = await fixture();
      try {
        const game = structuredClone(f.game);
        game.status = 'playing';
        if (controller !== 'human') game.players[0][controller] = 'Hard';
        game.botsPending = controller !== 'human';
        game.botNextActionAt = 5;
        f.sqlite
          .prepare('UPDATE rooms SET state=? WHERE code=?')
          .run(JSON.stringify(game), f.code);
        const controls = {
          operationId: randomUUID(),
          expectedRevision: 0,
          paused,
          joinLocked: true,
          reason: 'QA controls',
        };
        await applyAdminRoomControl(
          f.database,
          f.identity,
          f.code,
          controls,
          now,
        );
        const state = String(f.row().state),
          beforeControls = rows(f, 'room_controls');
        await f.apply(change(f.version()));
        assert.equal(f.row().state, state);
        const restored = await f.apply(
          change(f.version(), 1, false),
          now + 3000,
        );
        assert.equal(restored.room.paused, paused);
        assert.equal(restored.room.joinLocked, true);
        const expected = JSON.parse(state);
        if (!paused && controller !== 'human') {
          expected.botsPending = true;
          expected.botNextActionAt = now + 4500;
        } else assert.equal(f.row().state, state);
        assert.deepEqual(JSON.parse(String(f.row().state)), expected);
        assert.deepEqual(rows(f, 'room_controls'), beforeControls);
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
    const restore = await f.apply(change(1, 1, false), now + 1);
    const replay = await f.apply(
      { ...input, reason: 'Exact QA reason' },
      now + 2,
    );
    assert.deepEqual(replay, { ...first, replayed: true, room: restore.room });
    const before = f.row();
    for (const mismatch of [
      { ...input, expectedVersion: 1 },
      { ...input, expectedRevision: 1 },
      { ...input, removed: false },
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
      applyAdminRemoval(f.database, identity, f.code, input, now),
      status(409),
    );
    seed(f, 'KEEPSAFE');
    await assert.rejects(
      applyAdminRemoval(f.database, f.identity, 'KEEPSAFE', input, now),
      status(409),
    );
    assert.deepEqual(f.row(), before);
    assert.equal(rows(f, 'admin_room_removals').length, 2);
  } finally {
    f.sqlite.close();
  }
});

void test('new no-op and stale requests reject without writes; both room version and removal revision fence races', async () => {
  const f = await fixture();
  try {
    const before = f.row();
    for (const input of [change(0, 0, false), change(1), change(0, 1)])
      await assert.rejects(f.apply(input), status(409));
    assert.deepEqual(f.row(), before);
    assert.deepEqual(rows(f, 'admin_room_removals'), []);
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
    assert.equal(rows(f, 'admin_room_removals').length, 1);
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
          audit = rows(f, 'admin_room_removals');
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
        assert.deepEqual(rows(f, 'admin_room_removals'), audit);
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
      assert.equal(rows(f, 'admin_room_removals').length, 1);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('audit, game fence and removal metadata roll back together at every failed persistence stage', async () => {
  for (const table of ['admin_room_removals', 'rooms', 'room_removals']) {
    const f = await fixture();
    try {
      const before = f.row(),
        secure = secureRows(f);
      f.sqlite.exec(
        `CREATE TRIGGER qa_failure BEFORE ${table === 'rooms' ? 'UPDATE' : 'INSERT'} ON ${table} BEGIN SELECT RAISE(ABORT,'QA removal failure'); END;`,
      );
      await assert.rejects(f.apply(), /QA removal failure/);
      assert.deepEqual(f.row(), before);
      assert.deepEqual(secureRows(f), secure);
      assert.deepEqual(rows(f, 'admin_room_removals'), []);
      assert.deepEqual(rows(f, 'room_removals'), []);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('removed rooms keep public admin reads and old receipts while new lobby and pause mutations reject', async () => {
  const f = await fixture();
  try {
    const lobbyInput = {
      operationId: randomUUID(),
      expectedVersion: 0,
      action: { type: 'rules' as const, advanced: true },
      reason: 'QA rules',
    };
    const lobby = await configureAdminLobby(
      f.database,
      f.identity,
      f.code,
      lobbyInput,
      now,
    );
    const controls = {
      operationId: randomUUID(),
      expectedRevision: 0,
      paused: false,
      joinLocked: true,
      reason: 'QA controls',
    };
    await applyAdminRoomControl(f.database, f.identity, f.code, controls, now);
    await f.apply(change(f.version()));
    const before = f.row();
    assert.equal(
      (await readAdminLobby(f.database, f.identity, f.code, now)).editable,
      false,
    );
    assert.equal(
      (await readAdminRoomControl(f.database, f.identity, f.code, now))
        .joinLocked,
      true,
    );
    const receipt = await configureAdminLobby(
      f.database,
      f.identity,
      f.code,
      lobbyInput,
      now,
    );
    assert.equal(receipt.replayed, true);
    assert.equal(receipt.appliedVersion, lobby.appliedVersion);
    assert.equal(receipt.lobby.editable, false);
    assert.equal(
      (
        await applyAdminRoomControl(
          f.database,
          f.identity,
          f.code,
          controls,
          now,
        )
      ).replayed,
      true,
    );
    await assert.rejects(
      configureAdminLobby(
        f.database,
        f.identity,
        f.code,
        {
          ...lobbyInput,
          operationId: randomUUID(),
          expectedVersion: f.version(),
        },
        now,
      ),
      status(409),
    );
    await assert.rejects(
      applyAdminRoomControl(
        f.database,
        f.identity,
        f.code,
        {
          ...controls,
          operationId: randomUUID(),
          expectedRevision: 1,
          paused: true,
        },
        now,
      ),
      status(409),
    );
    assert.deepEqual(f.row(), before);
  } finally {
    f.sqlite.close();
  }
});

void test('prepared admin lobby and pause writes lose their transaction race to removal', async () => {
  for (const operation of ['lobby', 'pause'] as const) {
    const f = await fixture();
    try {
      const gate = gateBatch(f, operation === 'lobby' ? 2 : 1);
      const pending = (
        operation === 'lobby'
          ? configureAdminLobby(
              f.database,
              f.identity,
              f.code,
              {
                operationId: randomUUID(),
                expectedVersion: 0,
                action: { type: 'rules', advanced: true },
                reason: 'QA rules',
              },
              now,
            )
          : applyAdminRoomControl(
              f.database,
              f.identity,
              f.code,
              {
                operationId: randomUUID(),
                expectedRevision: 0,
                paused: true,
                joinLocked: true,
                reason: 'QA pause',
              },
              now,
            )
      ).then(
        () => null,
        (error: unknown) => error,
      );
      await gate.waiting;
      await f.apply();
      const before = f.row();
      gate.release();
      assert.ok(status(409)(await pending));
      assert.deepEqual(f.row(), before);
      assert.deepEqual(rows(f, 'admin_lobby_operations'), []);
      assert.deepEqual(rows(f, 'admin_room_audit'), []);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('creation receipts report temporary removal without granting access and recover only still-active original seats', async () => {
  const f = await fixture();
  try {
    const input = {
      operationId: randomUUID(),
      sessionToken: secret(),
      name: 'New host',
      faction: 'atreides' as const,
      advanced: false,
      techTokens: false,
      strongholdCards: false,
      bots: [],
      reason: 'QA creation',
    };
    const created = await createAdminRoom(f.database, f.identity, input, now);
    await applyAdminRemoval(
      f.database,
      f.identity,
      created.code,
      change(),
      now,
    );
    assert.deepEqual(
      await createAdminRoom(f.database, f.identity, input, now),
      { ...created, replayed: true, hostAccess: false, roomRemoved: true },
    );
    await applyAdminRemoval(
      f.database,
      f.identity,
      created.code,
      change(1, 1, false),
      now,
    );
    assert.deepEqual(
      await createAdminRoom(f.database, f.identity, input, now),
      { ...created, replayed: true },
    );
    await applyAdminRemoval(
      f.database,
      f.identity,
      created.code,
      change(2, 2),
      now,
    );
    f.sqlite
      .prepare('UPDATE seats SET revoked=1 WHERE room_code=?')
      .run(created.code);
    await applyAdminRemoval(
      f.database,
      f.identity,
      created.code,
      change(3, 3, false),
      now,
    );
    assert.deepEqual(
      await createAdminRoom(f.database, f.identity, input, now),
      { ...created, replayed: true, hostAccess: false },
    );
    assert.equal(rows(f, 'admin_room_creations').length, 1);
  } finally {
    f.sqlite.close();
  }
});

void test('removed games and exact receipts survive database reopen without restoring historical credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dune-admin-removal-'));
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
    const removed = await applyAdminRemoval(
      store.database,
      identity,
      room.code,
      input,
      now,
    );
    store.sqlite.close();
    store = adminStore(join(dir, 'rooms.sqlite'), false);
    assert.deepEqual(
      await applyAdminRemoval(store.database, identity, room.code, input, now),
      { ...removed, replayed: true },
    );
    await applyAdminRemoval(
      store.database,
      identity,
      room.code,
      change(1, 1, false),
      now + 10000,
    );
    assert.equal(rows(store, 'rooms')[0].state, state);
    assert.deepEqual(secureRows(store), secure);
    const audit = rows(store, 'admin_room_removals');
    store.sqlite.prepare('DELETE FROM rooms WHERE code=?').run(room.code);
    assert.deepEqual(rows(store, 'admin_room_removals'), audit);
  } finally {
    store.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
