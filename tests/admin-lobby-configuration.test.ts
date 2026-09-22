import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { adminStore } from './admin-access-fixture';
import {
  adminLogin,
  requireAdmin,
  adminLogoutAll,
  AdminError,
  type AdminRole,
} from '../db/admin-access';
import {
  readAdminLobby,
  configureAdminLobby,
} from '../db/admin-lobby-configuration';
import { applyAdminRoomControl } from '../db/admin-lifecycle';
import {
  validAdminLobbyInput,
  type AdminLobbyInput,
  type AdminLobbyAction,
} from '../lib/admin-lobby-configuration';
import {
  freshAdminLobby,
  applyAdminLobbyAction,
} from '../game/admin-lobby-configuration';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import * as seatAiDelegation from '../lib/seat-ai-delegation';
import type * as Rooms from '../db/rooms';

const secret = () => randomBytes(32).toString('hex');
const status = (wanted: number) => (error: unknown) =>
  error instanceof AdminError && error.status === wanted;
const operation = (
  expectedVersion: number,
  action: AdminLobbyAction = { type: 'rules', advanced: true },
): AdminLobbyInput => ({
  operationId: randomUUID(),
  expectedVersion,
  action,
  reason: 'Private operational reason',
});
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
  assert.ok(store.sqlite instanceof DatabaseSync);
  const account = store.provision(role, 'Private administrator name');
  const login = await adminLogin(store.database, account.key);
  const identity = await requireAdmin(store.database, login.token);
  const rooms = loadRooms(store.database);
  const owner = await rooms.createRoom('Lobby owner', 'atreides', false, []);
  const code = owner.view.code;
  const auth = await rooms.authenticate(code, owner.token);
  const guest = await rooms.joinRoom(code, 'Lobby guest', 'emperor');
  const guestAuth = await rooms.authenticate(code, guest.token!);
  const row = () =>
    store.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(code)!;
  const version = () => Number(row().version);
  const read = () => readAdminLobby(store.database, identity, code);
  const configure = (input = operation(version())) =>
    configureAdminLobby(store.database, identity, code, input);
  const secureRows = () =>
    [
      'seats',
      'seat_recovery_keys',
      'seat_recovery_receipts',
      'seat_handover_offers',
      'seat_handover_claim_receipts',
      'seat_ai_delegations',
      'room_entry_receipts',
      'room_messages',
    ].map((table) => store.sqlite.prepare(`SELECT * FROM ${table}`).all());
  return {
    ...store,
    account,
    login,
    identity,
    rooms,
    owner,
    guest,
    code,
    auth,
    guestAuth,
    row,
    version,
    read,
    configure,
    secureRows,
  };
}
function pauseBatch(f: Awaited<ReturnType<typeof fixture>>, nth = 2) {
  let enter!: () => void,
    release!: () => void,
    count = 0;
  const waiting = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeBatch = async () => {
    if (++count !== nth) return;
    delete f.hooks.beforeBatch;
    enter();
    await gate;
  };
  return { waiting, release };
}
const audits = (f: Awaited<ReturnType<typeof fixture>>) =>
  f.sqlite.prepare('SELECT * FROM admin_lobby_operations').all();

void test('lobby migration is additive and preserves existing game/seat/admin/creation records', () => {
  const store = adminStore(':memory:', false);
  try {
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((file) => file.endsWith('.sql') && file < '0011')
      .sort())
      store.sqlite.exec(
        readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
      );
    store.sqlite
      .prepare(
        'INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)',
      )
      .run('PRESERVE', 'private saved bytes', 5, 42);
    store.sqlite
      .prepare(
        'INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)',
      )
      .run('private hash', 'PRESERVE', 'owner');
    store.provision('owner');
    const rows = () =>
      [
        'rooms',
        'seats',
        'admin_accounts',
        'admin_audit',
        'admin_room_creations',
      ].map((table) => store.sqlite.prepare(`SELECT * FROM ${table}`).all());
    const before = rows();
    store.sqlite.exec(
      readFileSync(
        new URL(
          '../drizzle/0011_admin_lobby_configuration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    assert.deepEqual(rows(), before);
    assert.deepEqual(
      store.sqlite.prepare('SELECT * FROM admin_lobby_operations').all(),
      [],
    );
  } finally {
    store.sqlite.close();
  }
});

void test('admin lobby input permits only seven exact bounded commands with valid base factions and public parameters', () => {
  const valid: AdminLobbyAction[] = [
    { type: 'rules', advanced: true },
    { type: 'techTokens', enabled: true },
    { type: 'strongholdCards', enabled: false },
    { type: 'addBot', faction: 'guild', difficulty: 'Hard' },
    { type: 'removeBot', target: 'bot' },
    {
      type: 'configureBot',
      target: 'bot',
      faction: 'guild',
      difficulty: 'Easy',
      position: 6,
    },
    { type: 'assignHost', target: 'guest' },
  ];
  for (const action of valid)
    assert.equal(validAdminLobbyInput(operation(3, action)), true);
  const malformed = [
    { type: 'start' },
    { type: 'ready' },
    { type: 'homeworlds', enabled: true },
    { type: 'setAutopilot', difficulty: 'Hard' },
    { type: 'addBot', faction: 'ixians', difficulty: 'Hard' },
    { type: 'addBot', faction: 'guild', difficulty: 'Impossible' },
    { type: 'rules', advanced: 'true' },
    { type: 'assignHost', target: '' },
    { type: 'assignHost', target: 'guest', token: secret() },
    {
      type: 'configureBot',
      target: 'bot',
      faction: 'guild',
      difficulty: 'Easy',
      position: 7,
    },
  ];
  for (const action of malformed)
    assert.equal(validAdminLobbyInput({ ...operation(3), action }), false);
  for (const patch of [
    { operationId: randomUUID() + '\n' },
    { expectedVersion: -1 },
    { expectedVersion: Number.MAX_SAFE_INTEGER },
    { reason: ' ' },
    { reason: 'x'.repeat(301) },
    { reason: 'line\nbreak' },
    { sessionToken: secret() },
  ])
    assert.equal(validAdminLobbyInput({ ...operation(3), ...patch }), false);
});

void test('viewer receives only public lobby configuration and active-human host eligibility without mutation', async () => {
  const f = await fixture('viewer');
  try {
    const before = f.row(),
      secure = f.secureRows();
    const view = await f.read();
    assert.equal(view.editable, true);
    assert.equal(view.blockedReason, null);
    assert.equal(view.status, 'lobby');
    assert.equal(view.host, f.auth.playerId);
    assert.ok(view.players.every((player) => player.hostEligible));
    assert.deepEqual(
      view.players.map((player) => player.position),
      [1, 2],
    );
    assert.deepEqual(Object.keys(view).sort(), [
      'advanced',
      'blockedReason',
      'code',
      'control',
      'editable',
      'host',
      'players',
      'status',
      'strongholdCards',
      'techTokens',
      'version',
    ]);
    assert.deepEqual(Object.keys(view.players[0]).sort(), [
      'bot',
      'faction',
      'hostEligible',
      'id',
      'name',
      'position',
      'ready',
    ]);
    for (const value of [
      f.owner.token,
      f.guest.token!,
      f.identity.id,
      f.identity.sessionHash,
      'traitor',
      'spice',
      'prediction',
      'deck',
    ])
      assert.equal(JSON.stringify(view).includes(value), false);
    assert.deepEqual(f.row(), before);
    assert.deepEqual(f.secureRows(), secure);
    await assert.rejects(f.configure(), status(403));
    assert.deepEqual(audits(f), []);
  } finally {
    f.sqlite.close();
  }
});

void test('neutral admin changes reuse ordinary rule/AI actions, preserve host sessions and clear human readiness', async () => {
  const f = await fixture();
  try {
    for (const auth of [f.auth, f.guestAuth])
      await f.rooms.act(f.code, auth, f.version(), { type: 'ready' });
    const secure = f.secureRows();
    await f.configure(
      operation(f.version(), { type: 'rules', advanced: true }),
    );
    await f.configure(
      operation(f.version(), { type: 'techTokens', enabled: true }),
    );
    await f.configure(
      operation(f.version(), { type: 'strongholdCards', enabled: true }),
    );
    const added = await f.configure(
      operation(f.version(), {
        type: 'addBot',
        faction: 'guild',
        difficulty: 'Easy',
      }),
    );
    const bot = added.lobby.players.find((player) => player.bot)!;
    assert.equal(bot.hostEligible, false);
    assert.equal(bot.ready, true);
    const configured = await f.configure(
      operation(f.version(), {
        type: 'configureBot',
        target: bot.id,
        faction: 'harkonnen',
        difficulty: 'Brutal',
        position: 6,
      }),
    );
    assert.deepEqual(
      configured.lobby.players.find((player) => player.id === bot.id),
      {
        id: bot.id,
        name: 'Harkonnen AI',
        faction: 'harkonnen',
        bot: 'Brutal',
        position: 6,
        ready: true,
        hostEligible: false,
      },
    );
    assert.ok(
      configured.lobby.players
        .filter((player) => !player.bot)
        .every((player) => !player.ready),
    );
    const changed = await f.configure(
      operation(f.version(), { type: 'rules', advanced: false }),
    );
    assert.equal(changed.lobby.strongholdCards, false);
    assert.equal(changed.lobby.techTokens, true);
    await f.configure(
      operation(f.version(), { type: 'removeBot', target: bot.id }),
    );
    const g = await f.rooms.readRoom(f.code);
    assert.equal(g.players.length, 2);
    assert.equal(g.host, f.auth.playerId);
    assert.ok(
      g.players.every(
        (player) =>
          player.reserves === 20 &&
          player.spice === 0 &&
          player.hand.length === 0,
      ),
    );
    assert.deepEqual(f.secureRows(), secure);
    assert.ok(
      g.log
        .slice(2)
        .every((entry) => entry.text.startsWith('An administrator')),
    );
    assert.equal(JSON.stringify(g.log).includes(f.identity.name), false);
    assert.equal(
      JSON.stringify(g.log).includes('Private operational reason'),
      false,
    );
    for (const auth of [f.auth, f.guestAuth])
      assert.equal(
        (await f.rooms.readSeatView(f.code, auth)).me,
        auth.playerId,
      );
  } finally {
    f.sqlite.close();
  }
});

void test('fresh supported guard accepts legacy player circles and disabled modules but rejects used pieces, unknown runtime and unsupported profiles generically', async () => {
  const f = await fixture();
  try {
    const original = await f.rooms.readRoom(f.code);
    const legacy = structuredClone(original);
    delete legacy.playerPositions;
    legacy.homeworlds = null;
    legacy.nexusCards = null;
    delete legacy.leaderSkills;
    legacy.discoveryEnabled = false;
    assert.equal(freshAdminLobby(legacy), true);
    const corruptions: ((game: engine.Game) => void)[] = [
      (g) => {
        g.players[0].spice = 1;
      },
      (g) => {
        g.players[0].reserves = 19;
      },
      (g) => {
        g.players[0].leaders[0].dead = true;
      },
      (g) => {
        g.expansions = ['ix'];
      },
      (g) => {
        g.homeworlds = { custody: null };
      },
      (g) => {
        g.techTokens = { axlotl: { owner: g.host, spice: 0 } } as NonNullable<
          engine.Game['techTokens']
        >;
      },
      (g) => {
        (g as unknown as Record<string, unknown>).futurePrivateField =
          'PRIVATE_SENTINEL';
      },
      (g) => {
        g.playerPositions![g.players[1].id] = 1;
      },
      (g) => {
        g.deck = [{ id: 'PRIVATE_CARD' }] as engine.Game['deck'];
      },
    ];
    for (const corrupt of corruptions) {
      const game = structuredClone(original);
      corrupt(game);
      f.sqlite
        .prepare('UPDATE rooms SET state=? WHERE code=?')
        .run(JSON.stringify(game), f.code);
      const before = f.row();
      const view = await f.read();
      assert.equal(view.editable, false);
      assert.equal(JSON.stringify(view).includes('PRIVATE'), false);
      await assert.rejects(
        f.configure(),
        (error) => status(409)(error) && !String(error).includes('PRIVATE'),
      );
      assert.deepEqual(f.row(), before);
      assert.deepEqual(audits(f), []);
    }
    f.sqlite
      .prepare('UPDATE rooms SET state=? WHERE code=?')
      .run('{bad private save', f.code);
    assert.equal((await f.read()).status, 'unreadable');
    await assert.rejects(f.configure(), status(409));
  } finally {
    f.sqlite.close();
  }
});

void test('host reassignment changes authority only, clears human readiness and preserves both original saved seats and pieces', async () => {
  const f = await fixture();
  try {
    for (const auth of [f.auth, f.guestAuth])
      await f.rooms.act(f.code, auth, f.version(), { type: 'ready' });
    const before = await f.rooms.readRoom(f.code),
      secure = f.secureRows();
    const result = await f.configure(
      operation(f.version(), {
        type: 'assignHost',
        target: f.guestAuth.playerId,
      }),
    );
    assert.equal(result.lobby.host, f.guestAuth.playerId);
    const next = await f.rooms.readRoom(f.code);
    assert.deepEqual(
      next.players.map((player) => ({ ...player, ready: false })),
      before.players.map((player) => ({ ...player, ready: false })),
    );
    assert.ok(next.players.every((player) => !player.ready));
    assert.deepEqual(next.playerPositions, before.playerPositions);
    assert.deepEqual(f.secureRows(), secure);
    await assert.rejects(
      f.rooms.act(f.code, f.auth, f.version(), {
        type: 'addBot',
        faction: 'guild',
        difficulty: 'Hard',
      }),
      /host/i,
    );
    await f.rooms.act(f.code, f.guestAuth, f.version(), {
      type: 'addBot',
      faction: 'guild',
      difficulty: 'Hard',
    });
    const bot = (await f.read()).players.find((player) => player.bot)!;
    await assert.rejects(
      f.configure(
        operation(f.version(), { type: 'assignHost', target: bot.id }),
      ),
      status(409),
    );
    await assert.rejects(
      f.configure(
        operation(f.version(), { type: 'removeBot', target: f.auth.playerId }),
      ),
      status(409),
    );
    for (const auth of [f.auth, f.guestAuth])
      assert.equal(
        (await f.rooms.readSeatView(f.code, auth)).me,
        auth.playerId,
      );
  } finally {
    f.sqlite.close();
  }
});

void test('mismatched saved room codes reject edits without repair while completed receipts remain confirmable', async () => {
  const f = await fixture();
  try {
    const input = operation(f.version());
    const applied = await f.configure(input);
    f.sqlite
      .prepare(
        "UPDATE rooms SET state=json_set(state,'$.code','MISMATCH') WHERE code=?",
      )
      .run(f.code);
    const before = f.row();
    const view = await f.read();
    assert.equal(view.code, f.code);
    assert.equal(view.editable, false);
    assert.equal(
      view.blockedReason,
      'This saved lobby needs inspection before configuration.',
    );
    await assert.rejects(
      f.configure(
        operation(f.version(), { type: 'techTokens', enabled: true }),
      ),
      status(409),
    );
    const replay = await f.configure(input);
    assert.equal(replay.replayed, true);
    assert.equal(replay.appliedVersion, applied.appliedVersion);
    assert.deepEqual(replay.lobby, view);
    assert.deepEqual(f.row(), before);
    assert.equal(audits(f).length, 1);
  } finally {
    f.sqlite.close();
  }
});

void test('freshness checks require own fields and reject prototype-named corrupt player or root data', async () => {
  for (const target of ['player', 'root'] as const) {
    const f = await fixture();
    try {
      const game = await f.rooms.readRoom(f.code);
      const malformed = (target === 'player'
        ? game.players[0]
        : game) as unknown as Record<string, unknown>;
      if (target === 'player') delete malformed.spice;
      Object.defineProperty(malformed, '__proto__', {
        value: {},
        enumerable: true,
      });
      f.sqlite
        .prepare('UPDATE rooms SET state=? WHERE code=?')
        .run(JSON.stringify(game), f.code);
      assert.equal(freshAdminLobby(JSON.parse(String(f.row().state))), false);
      const before = f.row(),
        secure = f.secureRows();
      const view = await f.read();
      assert.equal(view.editable, false);
      assert.equal(
        view.blockedReason,
        'This saved lobby needs inspection before configuration.',
      );
      await assert.rejects(
        f.configure(
          operation(f.version(), {
            type: 'assignHost',
            target: f.guestAuth.playerId,
          }),
        ),
        status(409),
      );
      assert.deepEqual(f.row(), before);
      assert.deepEqual(f.secureRows(), secure);
      assert.deepEqual(audits(f), []);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('neutral configuration retains genuine Basic/Advanced setup, module prerequisites and human readiness', async () => {
  for (const advanced of [false, true]) {
    const f = await fixture();
    try {
      if (advanced)
        await f.configure(
          operation(f.version(), { type: 'rules', advanced: true }),
        );
      await f.configure(
        operation(f.version(), { type: 'techTokens', enabled: true }),
      );
      if (advanced)
        await f.configure(
          operation(f.version(), { type: 'strongholdCards', enabled: true }),
        );
      else
        await assert.rejects(
          f.configure(
            operation(f.version(), { type: 'strongholdCards', enabled: true }),
          ),
          status(409),
        );
      for (const auth of [f.auth, f.guestAuth])
        await f.rooms.act(f.code, auth, f.version(), { type: 'ready' });
      const start = {
        type: 'start',
        ...(advanced ? { advancedPreview: true } : {}),
      } as engine.Action;
      await assert.rejects(
        f.rooms.act(f.code, f.auth, f.version(), start),
        /three players/i,
      );
      await f.configure(
        operation(f.version(), {
          type: 'addBot',
          faction: 'guild',
          difficulty: 'Hard',
        }),
      );
      await assert.rejects(
        f.rooms.act(f.code, f.auth, f.version(), start),
        /ready/i,
      );
      for (const auth of [f.auth, f.guestAuth])
        await f.rooms.act(f.code, auth, f.version(), { type: 'ready' });
      if (advanced)
        await assert.rejects(
          f.rooms.act(f.code, f.auth, f.version(), { type: 'start' }),
          /preview|unfinished/i,
        );
      const view = await f.rooms.act(f.code, f.auth, f.version(), start);
      assert.equal(view.status, 'setup');
      assert.equal(view.advancedPreview, advanced);
      assert.ok(
        view.players.find((player) => player.id === f.auth.playerId)!
          .traitorChoices?.length,
      );
      const adminView = await f.read();
      assert.equal(adminView.editable, false);
      assert.equal(adminView.status, 'setup');
      assert.equal(JSON.stringify(adminView).includes('traitor'), false);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('exact lobby receipt replays after start with current public metadata and never repeats its change', async () => {
  const f = await fixture();
  try {
    const input = operation(f.version(), {
      type: 'addBot',
      faction: 'guild',
      difficulty: 'Hard',
    });
    const applied = await f.configure(input);
    const same = {
      ...input,
      action: { difficulty: 'Hard', faction: 'guild', type: 'addBot' } as const,
      reason: '  ' + input.reason + '  ',
    };
    assert.deepEqual(await f.configure(same), { ...applied, replayed: true });
    for (const auth of [f.auth, f.guestAuth])
      await f.rooms.act(f.code, auth, f.version(), { type: 'ready' });
    await f.rooms.act(f.code, f.auth, f.version(), { type: 'start' });
    const before = f.row();
    const replay = await f.configure(input);
    assert.equal(replay.replayed, true);
    assert.equal(replay.appliedVersion, applied.appliedVersion);
    assert.equal(replay.lobby.status, 'setup');
    assert.equal(replay.lobby.version, f.version());
    assert.deepEqual(f.row(), before);
    assert.equal(audits(f).length, 1);
    for (const patch of [
      { reason: 'Changed reason' },
      { expectedVersion: f.version() },
      { action: { ...input.action, difficulty: 'Easy' } },
    ])
      await assert.rejects(
        f.configure({ ...input, ...patch } as AdminLobbyInput),
        status(409),
      );
    const other = f.provision('operator');
    const login = await adminLogin(f.database, other.key);
    const identity = await requireAdmin(f.database, login.token);
    await assert.rejects(
      configureAdminLobby(f.database, identity, f.code, input),
      status(409),
    );
    const text = JSON.stringify(audits(f));
    for (const privateValue of [
      f.identity.sessionHash,
      f.owner.token,
      f.guest.token!,
      'traitorChoices',
      'deck',
    ])
      assert.equal(text.includes(privateValue), false);
    assert.equal(audits(f)[0].actor_admin_id, f.identity.id);
    assert.equal(audits(f)[0].reason, input.reason);
  } finally {
    f.sqlite.close();
  }
});

void test('paused lobbies reject configuration while joining locks permit it, without changing operational flags', async () => {
  const f = await fixture();
  try {
    const pause = (revision: number, paused: boolean, joinLocked: boolean) =>
      applyAdminRoomControl(f.database, f.identity, f.code, {
        operationId: randomUUID(),
        expectedRevision: revision,
        paused,
        joinLocked,
        reason: 'QA control',
      });
    await pause(0, true, false);
    const before = f.row();
    assert.equal((await f.read()).editable, false);
    await assert.rejects(f.configure(), status(409));
    assert.deepEqual(f.row(), before);
    await pause(1, false, true);
    const result = await f.configure();
    assert.equal(result.lobby.advanced, true);
    assert.equal(result.lobby.control.joinLocked, true);
    assert.equal(result.lobby.control.revision, 2);
  } finally {
    f.sqlite.close();
  }
});

void test('administrator session/role changes are fenced at snapshot reads, writes and exact receipt replay', async () => {
  for (const phase of ['read', 'write', 'replay'] as const)
    for (const mode of ['logout', 'disable', 'expire', 'demote'] as const) {
      const f = await fixture();
      try {
        const input = operation(f.version());
        if (phase === 'replay') await f.configure(input);
        const before = f.row(),
          beforeAudit = audits(f);
        const gate = pauseBatch(f, phase === 'write' ? 2 : 1);
        const pending = phase === 'read' ? f.read() : f.configure(input);
        await gate.waiting;
        if (mode === 'logout') await adminLogoutAll(f.database, f.identity);
        else if (mode === 'disable')
          f.sqlite
            .prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?')
            .run(f.identity.id);
        else if (mode === 'expire')
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
        if (phase === 'read' && mode === 'demote') {
          const result = await pending;
          assert.ok('code' in result);
          assert.equal(result.code, f.code);
        } else
          await assert.rejects(pending, status(mode === 'demote' ? 403 : 401));
        assert.deepEqual(f.row(), before);
        assert.deepEqual(audits(f), beforeAudit);
      } finally {
        f.sqlite.close();
      }
    }
});

void test('prepared lobby writes lose to start, join, human action, pause and target-seat revocation without overwriting the winner', async () => {
  for (const winner of [
    'start',
    'join',
    'action',
    'pause',
    'target',
  ] as const) {
    const f = await fixture();
    try {
      if (winner === 'start')
        for (const auth of [f.auth, f.guestAuth])
          await f.rooms.act(f.code, auth, f.version(), { type: 'ready' });
      const input = operation(
        f.version(),
        winner === 'target'
          ? { type: 'assignHost', target: f.guestAuth.playerId }
          : { type: 'rules', advanced: true },
      );
      const gate = pauseBatch(f);
      const pending = f.configure(input);
      await gate.waiting;
      if (winner === 'start')
        await f.rooms.act(f.code, f.auth, f.version(), { type: 'start' });
      else if (winner === 'join')
        await f.rooms.joinRoom(f.code, 'Joining human', 'guild');
      else if (winner === 'action')
        await f.rooms.act(f.code, f.auth, f.version(), { type: 'ready' });
      else if (winner === 'pause')
        await applyAdminRoomControl(f.database, f.identity, f.code, {
          operationId: randomUUID(),
          expectedRevision: 0,
          paused: true,
          joinLocked: false,
          reason: 'QA race',
        });
      else
        f.sqlite
          .prepare('UPDATE seats SET revoked=1 WHERE token_hash=?')
          .run(f.guestAuth.tokenHash);
      const before = f.row(),
        secure = f.secureRows();
      gate.release();
      await assert.rejects(pending, status(409));
      assert.deepEqual(f.row(), before);
      assert.deepEqual(f.secureRows(), secure);
      assert.equal(audits(f).length, 0);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('concurrent same operation commits one receipt and conflicting operations commit only one version', async () => {
  for (const same of [true, false]) {
    const f = await fixture();
    try {
      const input = operation(f.version());
      const gate = pauseBatch(f);
      const pending = f.configure(input);
      await gate.waiting;
      const won = await f.configure(
        same
          ? input
          : operation(f.version(), {
              type: 'addBot',
              faction: 'guild',
              difficulty: 'Hard',
            }),
      );
      const before = f.row();
      gate.release();
      if (same) assert.deepEqual(await pending, { ...won, replayed: true });
      else await assert.rejects(pending, status(409));
      assert.deepEqual(f.row(), before);
      assert.equal(audits(f).length, 1);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('audit failure rolls back room configuration/version and rejected pure actions leave input untouched', async () => {
  const f = await fixture();
  try {
    const game = await f.rooms.readRoom(f.code),
      copy = structuredClone(game);
    assert.throws(() =>
      applyAdminLobbyAction(
        game,
        { type: 'addBot', faction: 'atreides', difficulty: 'Hard' },
        new Set([f.auth.playerId, f.guestAuth.playerId]),
      ),
    );
    assert.deepEqual(game, copy);
    const before = f.row(),
      secure = f.secureRows();
    f.sqlite.exec(
      "CREATE TRIGGER fail_lobby_audit BEFORE INSERT ON admin_lobby_operations BEGIN SELECT RAISE(ABORT,'QA audit failure'); END;",
    );
    await assert.rejects(f.configure(), /QA audit failure/);
    assert.deepEqual(f.row(), before);
    assert.deepEqual(f.secureRows(), secure);
    assert.equal(audits(f).length, 0);
  } finally {
    f.sqlite.close();
  }
});

void test('neutral lobby operation and host assignment survive database reopen without changing any saved-seat authority', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dune-admin-lobby-'));
  let store = adminStore(join(dir, 'rooms.sqlite'));
  try {
    const account = store.provision('owner');
    const login = await adminLogin(store.database, account.key);
    const identity = await requireAdmin(store.database, login.token);
    const rooms = loadRooms(store.database);
    const owner = await rooms.createRoom('Owner', 'atreides', false, []);
    const code = owner.view.code;
    const guest = await rooms.joinRoom(code, 'Guest', 'guild');
    const auth = await rooms.authenticate(code, guest.token!);
    const input = operation(guest.view.version, {
      type: 'assignHost',
      target: auth.playerId,
    });
    const applied = await configureAdminLobby(
      store.database,
      identity,
      code,
      input,
    );
    const seatRows = store.sqlite.prepare('SELECT * FROM seats').all();
    store.sqlite.close();
    store = adminStore(join(dir, 'rooms.sqlite'), false);
    assert.deepEqual(
      await configureAdminLobby(store.database, identity, code, input),
      { ...applied, replayed: true },
    );
    assert.deepEqual(
      store.sqlite.prepare('SELECT * FROM seats').all(),
      seatRows,
    );
    const restored = await loadRooms(store.database).readSeatView(code, auth);
    assert.equal(restored.host, auth.playerId);
    assert.equal(restored.me, auth.playerId);
  } finally {
    store.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
