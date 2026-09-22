import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { adminStore, pauseAdminBatch, sha256 } from './admin-access-fixture';
import {
  adminLogin,
  requireAdmin,
  adminLogoutAll,
  AdminError,
  type AdminRole,
} from '../db/admin-access';
import { createAdminRoom } from '../db/admin-room-creation';
import {
  validAdminRoomCreationInput,
  type AdminRoomCreationInput,
} from '../lib/admin-room-creation';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import * as seatAiDelegation from '../lib/seat-ai-delegation';
import type * as Rooms from '../db/rooms';

const secret = () => randomBytes(32).toString('hex');
const input = (
  patch: Partial<AdminRoomCreationInput> = {},
): AdminRoomCreationInput => ({
  operationId: randomUUID(),
  sessionToken: secret(),
  name: 'Creation QA host',
  faction: 'atreides',
  advanced: false,
  techTokens: false,
  strongholdCards: false,
  bots: [{ faction: 'harkonnen', difficulty: 'Hard' }],
  reason: 'Dedicated QA room creation',
  ...patch,
});
const status = (wanted: number) => (error: unknown) =>
  error instanceof AdminError && error.status === wanted;
const rows = (sqlite: DatabaseSync, table: string) =>
  sqlite.prepare(`SELECT * FROM ${table}`).all();
const saved = (sqlite: DatabaseSync, code: string) =>
  JSON.parse(
    String(
      sqlite.prepare('SELECT state FROM rooms WHERE code=?').get(code)!.state,
    ),
  ) as engine.Game;

function loadRooms(database: D1Database) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../db/rooms.ts', import.meta.url), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      crypto: webcrypto,
      TextEncoder,
      structuredClone,
      JSON,
      require: (name: string) => {
        if (name === 'cloudflare:workers') return { env: { DB: database } };
        if (name === '@/game/engine') return engine;
        if (name === '@/game/bots') return bots;
        if (name === '@/lib/seat-ai-delegation') return seatAiDelegation;
        throw new Error('Unexpected dependency ' + name);
      },
    },
  );
  return exports as typeof Rooms;
}
async function fixture(role: AdminRole = 'operator') {
  const store = adminStore();
  const account = store.provision(role);
  const login = await adminLogin(store.database, account.key);
  const identity = await requireAdmin(store.database, login.token);
  const rooms = loadRooms(store.database);
  const create = (request = input(), now = 10000) =>
    createAdminRoom(store.database, identity, request, now);
  return { ...store, identity, account, login, rooms, create };
}

void test('admin creation migration adds only its durable receipt table and indexes', () => {
  const store = adminStore(':memory:', false);
  try {
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((file) => file.endsWith('.sql') && file < '0010')
      .sort())
      store.sqlite.exec(
        readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
      );
    store.sqlite
      .prepare(
        'INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)',
      )
      .run('PRESERVE', '{"private":"saved game"}', 17, 123);
    store.sqlite
      .prepare(
        'INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)',
      )
      .run(sha256(secret()), 'PRESERVE', randomUUID());
    const account = store.provision('owner');
    const before = ['rooms', 'seats', 'admin_accounts', 'admin_audit'].map(
      (table) => rows(store.sqlite, table),
    );
    store.sqlite.exec(
      readFileSync(
        new URL('../drizzle/0010_admin_room_creation.sql', import.meta.url),
        'utf8',
      ),
    );
    assert.deepEqual(
      ['rooms', 'seats', 'admin_accounts', 'admin_audit'].map((table) =>
        rows(store.sqlite, table),
      ),
      before,
    );
    assert.deepEqual(rows(store.sqlite, 'admin_room_creations'), []);
    assert.throws(
      () =>
        store.sqlite
          .prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?')
          .run(account.id),
      /last|final|owner/i,
    );
  } finally {
    store.sqlite.close();
  }
});

void test('admin creates zero through five AI seats through ordinary lobby actions with one unready human host', async () => {
  const f = await fixture();
  try {
    const factions = [
      'harkonnen',
      'emperor',
      'fremen',
      'guild',
      'beneGesserit',
    ] as const;
    for (let n = 0; n <= 5; n++) {
      const request = input({
        bots: factions.slice(0, n).map((faction, index) => ({
          faction,
          difficulty: (['Easy', 'Medium', 'Hard', 'Brutal'] as const)[
            index % 4
          ],
        })),
      });
      const result = await f.create(request);
      assert.deepEqual(Object.keys(result).sort(), [
        'code',
        'hostAccess',
        'hostId',
        'operationId',
        'replayed',
      ]);
      assert.equal(result.operationId, request.operationId);
      assert.equal(result.replayed, false);
      assert.equal(result.hostAccess, true);
      assert.match(result.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      const game = saved(f.sqlite, result.code);
      assert.equal(game.status, 'lobby');
      assert.equal(game.version, 0);
      assert.equal(game.host, result.hostId);
      assert.equal(game.players.length, n + 1);
      assert.equal(game.players[0].ready, false);
      assert.equal(game.players[0].bot, undefined);
      assert.deepEqual(
        game.players.slice(1).map((player) => ({
          faction: player.faction,
          difficulty: player.bot,
        })),
        request.bots,
      );
      assert.ok(game.players.slice(1).every((player) => player.ready));
      assert.deepEqual(game.deck, []);
      assert.equal(game.botsPending ?? false, false);
      assert.equal(game.botNextActionAt, undefined);
      assert.deepEqual(game.expansions, []);
      assert.equal(game.advancedPreview, undefined);
      const seat = f.sqlite
        .prepare('SELECT * FROM seats WHERE room_code=?')
        .all(result.code);
      assert.equal(seat.length, 1);
      assert.equal(seat[0].token_hash, sha256(request.sessionToken));
      assert.equal(seat[0].player_id, result.hostId);
      const auth = await f.rooms.authenticate(
        result.code,
        request.sessionToken,
      );
      const view = await f.rooms.readSeatView(result.code, auth);
      assert.equal(view.me, result.hostId);
      assert.equal(view.host, result.hostId);
      assert.equal(JSON.stringify(view).includes(request.reason), false);
    }
    assert.equal(rows(f.sqlite, 'rooms').length, 6);
    assert.equal(rows(f.sqlite, 'seats').length, 6);
  } finally {
    f.sqlite.close();
  }
});

void test('Basic and explicit Advanced preview genuinely start, retain modules, offer human choices and legally continue AI after JSON restore', async () => {
  const f = await fixture();
  try {
    for (const advanced of [false, true]) {
      const request = input({
        advanced,
        techTokens: true,
        strongholdCards: advanced,
        bots: [
          { faction: 'harkonnen', difficulty: 'Easy' },
          { faction: 'guild', difficulty: 'Medium' },
        ],
      });
      const created = await f.create(request);
      const auth = await f.rooms.authenticate(
        created.code,
        request.sessionToken,
      );
      let now = 10000;
      const clock = {
        now: () => now,
        sleep: async (ms: number) => {
          now += ms;
        },
      };
      let view = await f.rooms.readSeatView(created.code, auth);
      assert.equal(view.status, 'lobby');
      assert.ok(view.techTokens);
      assert.equal(!!view.strongholdCards, advanced);
      await assert.rejects(
        f.rooms.act(
          created.code,
          auth,
          view.version,
          { type: 'start', ...(advanced ? { advancedPreview: true } : {}) },
          clock,
        ),
        /ready/i,
      );
      view = await f.rooms.act(
        created.code,
        auth,
        view.version,
        { type: 'ready' },
        clock,
      );
      if (advanced)
        await assert.rejects(
          f.rooms.act(
            created.code,
            auth,
            view.version,
            { type: 'start' },
            clock,
          ),
          /Advanced.*unfinished|preview/i,
        );
      view = await f.rooms.act(
        created.code,
        auth,
        view.version,
        { type: 'start', ...(advanced ? { advancedPreview: true } : {}) },
        clock,
      );
      assert.equal(view.status, 'setup');
      assert.equal(view.advancedPreview, advanced);
      const ownerChoices = view.players.find(
        (player) => player.id === view.me,
      )!.traitorChoices;
      assert.ok(ownerChoices?.length);
      await loadRooms(f.database).continueRoomBots(created.code, 4, clock);
      const restored = await loadRooms(f.database).readSeatView(
        created.code,
        auth,
      );
      assert.deepEqual(
        restored.players.find((player) => player.id === view.me)!
          .traitorChoices,
        ownerChoices,
      );
      assert.ok(restored.version > view.version);
      for (const player of restored.players.filter(
        (player) => player.id !== view.me,
      )) {
        assert.equal('hand' in player, false);
        assert.equal('traitors' in player, false);
        assert.equal('traitorChoices' in player, false);
      }
    }
  } finally {
    f.sqlite.close();
  }
});

void test('Tech Tokens remain selectable in a small lobby but ordinary start still requires three players', async () => {
  const f = await fixture();
  try {
    const request = input({ techTokens: true });
    const created = await f.create(request);
    const auth = await f.rooms.authenticate(created.code, request.sessionToken);
    const view = await f.rooms.act(created.code, auth, 0, { type: 'ready' });
    const before = rows(f.sqlite, 'rooms');
    await assert.rejects(
      f.rooms.act(created.code, auth, view.version, { type: 'start' }),
      /three players/i,
    );
    assert.deepEqual(rows(f.sqlite, 'rooms'), before);
    const added = await f.rooms.act(created.code, auth, view.version, {
      type: 'addBot',
      faction: 'guild',
      difficulty: 'Hard',
    });
    const ready = await f.rooms.act(created.code, auth, added.version, {
      type: 'ready',
    });
    assert.equal(
      (await f.rooms.act(created.code, auth, ready.version, { type: 'start' }))
        .status,
      'setup',
    );
  } finally {
    f.sqlite.close();
  }
});

void test('strict creation input rejects malformed proof, missing or unknown fields, duplicate/expansion factions and unsupported profiles before persistence', async () => {
  const f = await fixture();
  try {
    const missing = input();
    delete (missing as Partial<AdminRoomCreationInput>).reason;
    const invalid: unknown[] = [
      null,
      [],
      missing,
      ...[
        { operationId: randomUUID() + '\n' },
        { sessionToken: secret() + '\n' },
        { sessionToken: 'short' },
        { name: ' ' },
        { name: 'x'.repeat(33) },
        { name: 'line\nbreak' },
        { reason: ' ' },
        { reason: 'x'.repeat(301) },
        { reason: 'line\nbreak' },
        { advanced: 'true' },
        { strongholdCards: true },
        { faction: 'ixians' },
        { expansion: ['ix'] },
        { start: true },
        { hostId: randomUUID() },
        { bots: Array(6).fill({ faction: 'guild', difficulty: 'Hard' }) },
        { bots: [{ faction: 'atreides', difficulty: 'Hard' }] },
        {
          bots: [
            { faction: 'guild', difficulty: 'Hard' },
            { faction: 'guild', difficulty: 'Easy' },
          ],
        },
        { bots: [{ faction: 'ixians', difficulty: 'Hard' }] },
        { bots: [{ faction: 'guild', difficulty: 'Impossible' }] },
        { bots: [{ faction: 'guild', difficulty: 'Hard', ready: true }] },
      ].map((patch) => ({ ...input(), ...patch })),
    ];
    for (const request of invalid) {
      assert.equal(validAdminRoomCreationInput(request), false);
      await assert.rejects(
        f.create(request as AdminRoomCreationInput),
        status(400),
      );
    }
    assert.equal(rows(f.sqlite, 'rooms').length, 0);
    assert.equal(rows(f.sqlite, 'seats').length, 0);
    assert.equal(rows(f.sqlite, 'admin_room_creations').length, 0);
  } finally {
    f.sqlite.close();
  }
});

void test('live owner/operator roles authorize creation and viewer, unknown session and forged role cannot create or replay', async () => {
  for (const role of ['owner', 'operator', 'viewer'] as const) {
    const f = await fixture(role);
    try {
      const request = input();
      const attempt = createAdminRoom(
        f.database,
        { ...f.identity, role: 'owner' },
        request,
      );
      if (role === 'viewer') {
        await assert.rejects(attempt, status(403));
        assert.equal(rows(f.sqlite, 'rooms').length, 0);
      } else {
        await attempt;
        if (role === 'operator') {
          f.sqlite
            .prepare("UPDATE admin_accounts SET role='viewer' WHERE id=?")
            .run(f.identity.id);
          await assert.rejects(f.create(request), status(403));
        }
      }
      await assert.rejects(
        createAdminRoom(
          f.database,
          { ...f.identity, sessionHash: secret() },
          input(),
        ),
        status(401),
      );
    } finally {
      f.sqlite.close();
    }
  }
});

void test('creation and receipt reads recheck disable, logout, expiry and demotion inside the transaction', async () => {
  for (const replay of [false, true])
    for (const mode of ['disable', 'logout', 'expiry', 'demote'] as const) {
      const f = await fixture();
      try {
        const request = input();
        if (replay) await f.create(request);
        const before = ['rooms', 'seats', 'admin_room_creations'].map((table) =>
          rows(f.sqlite, table),
        );
        const gate = pauseAdminBatch(f);
        const pending = f.create(request);
        await gate.waiting;
        if (mode === 'disable')
          f.sqlite
            .prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?')
            .run(f.identity.id);
        else if (mode === 'logout')
          await adminLogoutAll(f.database, f.identity);
        else if (mode === 'expiry')
          f.sqlite
            .prepare(
              'UPDATE admin_sessions SET expires_at=1 WHERE token_hash=?',
            )
            .run(f.identity.sessionHash);
        else
          f.sqlite
            .prepare("UPDATE admin_accounts SET role='viewer' WHERE id=?")
            .run(f.identity.id);
        gate.release();
        await assert.rejects(pending, status(mode === 'demote' ? 403 : 401));
        assert.deepEqual(
          ['rooms', 'seats', 'admin_room_creations'].map((table) =>
            rows(f.sqlite, table),
          ),
          before,
        );
      } finally {
        f.sqlite.close();
      }
    }
});

void test('same-operation concurrency and normalized exact retries commit one room, seat and public audit receipt', async () => {
  const f = await fixture();
  try {
    const request = input({
      name: '  Creation QA host  ',
      reason: '  Dedicated QA room creation  ',
      bots: [
        { faction: 'guild', difficulty: 'Hard' },
        { faction: 'harkonnen', difficulty: 'Easy' },
      ],
    });
    const gate = pauseAdminBatch(f);
    const pending = f.create(request);
    await gate.waiting;
    const winner = await f.create(request);
    gate.release();
    const retry = await pending;
    assert.deepEqual(retry, { ...winner, replayed: true });
    assert.deepEqual(
      await f.create({
        ...request,
        name: request.name.trim(),
        reason: request.reason.trim(),
      }),
      retry,
    );
    const before = ['rooms', 'seats', 'admin_room_creations'].map((table) =>
      rows(f.sqlite, table),
    );
    for (const patch of [
      { name: 'Changed host' },
      { sessionToken: secret() },
      { advanced: true },
      { techTokens: true },
      { bots: [...request.bots].reverse() },
      { reason: 'Changed reason' },
    ])
      await assert.rejects(f.create({ ...request, ...patch }), status(409));
    const other = f.provision('operator');
    const login = await adminLogin(f.database, other.key);
    const identity = await requireAdmin(f.database, login.token);
    await assert.rejects(
      createAdminRoom(f.database, identity, request),
      status(409),
    );
    assert.deepEqual(
      ['rooms', 'seats', 'admin_room_creations'].map((table) =>
        rows(f.sqlite, table),
      ),
      before,
    );
    const audit = rows(f.sqlite, 'admin_room_creations')[0];
    assert.equal(audit.actor_admin_id, f.identity.id);
    assert.equal(audit.room_code, winner.code);
    assert.equal(audit.host_id, winner.hostId);
    assert.equal(audit.created_at, 10000);
    assert.equal(audit.session_hash, sha256(request.sessionToken));
    const config = JSON.parse(String(audit.configuration));
    assert.deepEqual(Object.keys(config).sort(), [
      'advanced',
      'bots',
      'faction',
      'name',
      'strongholdCards',
      'techTokens',
    ]);
    assert.deepEqual(config.bots, request.bots);
    for (const value of [
      request.sessionToken,
      f.identity.sessionHash,
      'traitorChoices',
      'deck',
    ])
      assert.equal(JSON.stringify(audit).includes(value), false);
  } finally {
    f.sqlite.close();
  }
});

void test('session hashes cannot be reused from active/revoked seats or durable creation receipts after room removal', async () => {
  const f = await fixture();
  try {
    const original = input();
    const created = await f.create(original);
    for (const revoked of [0, 1]) {
      f.sqlite
        .prepare('UPDATE seats SET revoked=? WHERE token_hash=?')
        .run(revoked, sha256(original.sessionToken));
      await assert.rejects(
        f.create(input({ sessionToken: original.sessionToken })),
        status(409),
      );
    }
    f.sqlite.prepare('DELETE FROM rooms WHERE code=?').run(created.code);
    assert.deepEqual(await f.create(original), {
      ...created,
      replayed: true,
      hostAccess: false,
    });
    await assert.rejects(
      f.create(input({ sessionToken: original.sessionToken })),
      status(409),
    );
    const ordinaryToken = secret();
    const ordinary = await f.rooms.createRoom(
      'Ordinary QA owner',
      'atreides',
      false,
      [],
      { operationId: randomUUID(), sessionToken: ordinaryToken },
    );
    await assert.rejects(
      f.create(input({ sessionToken: ordinaryToken })),
      status(409),
    );
    f.sqlite
      .prepare('UPDATE seats SET revoked=1 WHERE room_code=?')
      .run(ordinary.view.code);
    await assert.rejects(
      f.create(input({ sessionToken: ordinaryToken })),
      status(409),
    );
    assert.equal(rows(f.sqlite, 'rooms').length, 1);
    assert.equal(rows(f.sqlite, 'admin_room_creations').length, 1);
  } finally {
    f.sqlite.close();
  }
});

void test('seat/audit storage failures roll back all new room records and preserve other saved games', async () => {
  const f = await fixture();
  try {
    await f.create();
    for (const table of ['seats', 'admin_room_creations']) {
      const before = ['rooms', 'seats', 'admin_room_creations'].map((name) =>
        rows(f.sqlite, name),
      );
      f.sqlite.exec(
        `CREATE TRIGGER reject_creation BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'QA creation failure'); END;`,
      );
      await assert.rejects(f.create(), /QA creation failure/);
      assert.deepEqual(
        ['rooms', 'seats', 'admin_room_creations'].map((name) =>
          rows(f.sqlite, name),
        ),
        before,
      );
      f.sqlite.exec('DROP TRIGGER reject_creation');
    }
  } finally {
    f.sqlite.close();
  }
});

void test('room invitation collisions retry boundedly without replacing existing games or retaining partial seats', async (t) => {
  const f = await fixture();
  try {
    f.sqlite
      .prepare(
        'INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)',
      )
      .run('AAAAAAAA', '{"private":"preserve"}', 7, 42);
    const before = rows(f.sqlite, 'rooms')[0];
    let calls = 0;
    const random = t.mock.method(globalThis.crypto, 'getRandomValues', (<
      T extends ArrayBufferView | null,
    >(
      array: T,
    ): T => {
      (array as Uint8Array).fill(calls++ === 0 ? 0 : 1);
      return array;
    }) as typeof crypto.getRandomValues);
    const first = await f.create(input({ bots: [] }));
    assert.equal(first.code, 'BBBBBBBB');
    assert.equal(calls, 2);
    assert.deepEqual(rows(f.sqlite, 'rooms')[0], before);
    random.mock.restore();
    const collision = t.mock.method(globalThis.crypto, 'getRandomValues', (<
      T extends ArrayBufferView | null,
    >(
      array: T,
    ): T => {
      (array as Uint8Array).fill(0);
      return array;
    }) as typeof crypto.getRandomValues);
    const request = input({ bots: [] });
    await assert.rejects(f.create(request), status(409));
    assert.equal(collision.mock.callCount(), 5);
    assert.equal(rows(f.sqlite, 'rooms').length, 2);
    assert.equal(rows(f.sqlite, 'seats').length, 1);
    assert.equal(rows(f.sqlite, 'admin_room_creations').length, 1);
    collision.mock.restore();
    assert.equal((await f.create(request)).replayed, false);
  } finally {
    t.mock.restoreAll();
    f.sqlite.close();
  }
});

void test('durable creation receipt and hash-only host seat survive database close/reopen with exact latest-state replay', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dune-admin-create-'));
  let store = adminStore(join(dir, 'rooms.sqlite'));
  try {
    const account = store.provision('operator');
    const login = await adminLogin(store.database, account.key);
    const identity = await requireAdmin(store.database, login.token);
    const request = input();
    const created = await createAdminRoom(store.database, identity, request);
    const rooms = loadRooms(store.database);
    const auth = await rooms.authenticate(created.code, request.sessionToken);
    const ready = await rooms.act(created.code, auth, 0, { type: 'ready' });
    const before = rows(store.sqlite, 'rooms');
    store.sqlite.close();
    store = adminStore(join(dir, 'rooms.sqlite'), false);
    assert.deepEqual(await createAdminRoom(store.database, identity, request), {
      ...created,
      replayed: true,
    });
    assert.deepEqual(rows(store.sqlite, 'rooms'), before);
    const restored = await loadRooms(store.database).readSeatView(
      created.code,
      auth,
    );
    assert.deepEqual(restored, ready);
    assert.equal(rows(store.sqlite, 'admin_room_creations').length, 1);
  } finally {
    store.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

void test('exact creation retries never regrant a revoked, recovered, handed-over or removed host seat', async () => {
  for (const lost of [
    'revoked',
    'recovered',
    'handover',
    'missing-player',
    'malformed-game',
  ] as const) {
    const f = await fixture();
    try {
      const request = input();
      const created = await f.create(request);
      const auth = await f.rooms.authenticate(
        created.code,
        request.sessionToken,
      );
      if (lost === 'revoked')
        f.sqlite
          .prepare('UPDATE seats SET revoked=1 WHERE token_hash=?')
          .run(auth.tokenHash);
      else if (lost === 'recovered') {
        const recoverySecret = secret();
        await f.rooms.setRecoveryKey(created.code, auth, 0, recoverySecret);
        await f.rooms.recoverSeat(created.code, {
          playerId: auth.playerId,
          recoverySecret,
          operationId: randomUUID(),
          newSessionToken: secret(),
        });
      } else if (lost === 'handover') {
        const offer = { offerId: randomUUID(), handoverSecret: secret() };
        await f.rooms.createSeatHandover(created.code, auth, 0, offer);
        await f.rooms.claimSeatHandover(created.code, {
          playerId: auth.playerId,
          ...offer,
          operationId: randomUUID(),
          newSessionToken: secret(),
        });
      } else if (lost === 'missing-player')
        f.sqlite
          .prepare(
            "UPDATE rooms SET state=json_set(state,'$.players',json('[]')) WHERE code=?",
          )
          .run(created.code);
      else
        f.sqlite
          .prepare('UPDATE rooms SET state=? WHERE code=?')
          .run('{invalid', created.code);
      const before = ['rooms', 'seats', 'admin_room_creations'].map((table) =>
        rows(f.sqlite, table),
      );
      assert.deepEqual(await f.create(request), {
        ...created,
        replayed: true,
        hostAccess: false,
      });
      assert.deepEqual(
        ['rooms', 'seats', 'admin_room_creations'].map((table) =>
          rows(f.sqlite, table),
        ),
        before,
      );
    } finally {
      f.sqlite.close();
    }
  }
});
