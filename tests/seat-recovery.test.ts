// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import type * as Rooms from '../db/rooms';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
const secret = () => randomBytes(32).toString('hex');
async function request(
  path: string,
  body?: unknown,
  cookie?: string,
  origin?: string,
) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { error: raw };
  }
  return {
    status: response.status,
    data: data as engine.GameView & {
      view: engine.GameView;
      error?: string;
      replayed?: boolean;
      recoveryConfigured?: boolean;
    },
    cookie: response.headers.get('set-cookie'),
    cache: response.headers.get('cache-control'),
  };
}
async function create() {
  const r = await request('/api/rooms', {
    name: 'Seat recovery audit',
    faction: 'atreides',
    advanced: false,
    expansions: [],
  });
  assert.equal(r.status, 201);
  assert.ok(r.cookie);
  return {
    ...r,
    cookie: r.cookie.split(';')[0],
    path: `/api/rooms/${r.data.code}`,
  };
}
const sameGame = (a: engine.GameView, b: engine.GameView) =>
  assert.deepEqual({ ...a, version: 0 }, { ...b, version: 0 });
const claim = (playerId: string, recoverySecret: string) => ({
  type: 'recoverSeat',
  playerId,
  recoverySecret,
  operationId: randomUUID(),
  newSessionToken: secret(),
});

void test('legacy cookie can configure recovery; recovery preserves private setup and invalidates the old seat cookie', async () => {
  const a = await create();
  const b = await request(a.path, {
    type: 'join',
    name: 'Second seat',
    faction: 'harkonnen',
  });
  assert.equal(b.status, 200);
  assert.ok(b.cookie);
  let view = b.data;
  for (const cookie of [a.cookie, b.cookie]) {
    const ready = await request(
      a.path,
      { version: view.version, action: { type: 'ready' } },
      cookie,
    );
    assert.equal(ready.status, 200);
    view = ready.data;
  }
  const start = await request(
    a.path,
    { version: view.version, action: { type: 'start' } },
    a.cookie,
  );
  assert.equal(start.status, 200);
  assert.equal(start.data.status, 'setup');
  const recoverySecret = secret();
  const saved = await request(
    a.path + '/control',
    { type: 'setRecoveryKey', version: start.data.version, recoverySecret },
    a.cookie,
  );
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.recoveryConfigured, true);
  sameGame(saved.data.view, start.data);
  const body = claim(a.data.me, recoverySecret);
  const restored = await request(a.path + '/control', body);
  assert.equal(restored.status, 200, JSON.stringify(restored.data));
  assert.equal(restored.data.replayed, false);
  sameGame(restored.data.view, saved.data.view);
  assert.equal(restored.data.view.version, saved.data.view.version + 1);
  assert.equal(restored.cache, 'no-store');
  assert.ok(restored.cookie?.includes('HttpOnly'));
  assert.ok(restored.cookie?.includes('SameSite=Strict'));
  assert.ok(restored.cookie?.includes(`Path=${a.path}`));
  assert.equal((await request(a.path, undefined, a.cookie)).status, 409);
  assert.equal(
    (
      await request(
        a.path,
        { version: restored.data.view.version, action: { type: 'ready' } },
        a.cookie,
      )
    ).status,
    409,
  );
  const other = await request(a.path, undefined, b.cookie);
  assert.equal(other.status, 200);
  assert.equal(
    other.data.players.find((p) => p.id === a.data.me)!.hand,
    undefined,
  );
  assert.ok(!JSON.stringify(other.data).includes(recoverySecret));
  assert.ok(!JSON.stringify(restored.data).includes(body.newSessionToken));
});

void test('lost recovery response replays once; altered payloads and older rotation receipts cannot rotate again', async () => {
  const a = await create(),
    recoverySecret = secret();
  const saved = await request(
    a.path + '/control',
    { type: 'setRecoveryKey', version: a.data.version, recoverySecret },
    a.cookie,
  );
  assert.equal(saved.status, 200);
  const firstBody = claim(a.data.me, recoverySecret);
  const first = await request(a.path + '/control', firstBody);
  assert.equal(first.status, 200);
  const replay = await request(a.path + '/control', firstBody);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.deepEqual(replay.data.view, first.data.view);
  assert.equal(replay.cookie, first.cookie);
  const altered = await request(a.path + '/control', {
    ...firstBody,
    newSessionToken: secret(),
  });
  assert.equal(altered.status, 409);
  assert.equal(altered.data.code, 'RECOVERY_RECEIPT_INVALID');
  const second = await request(
    a.path + '/control',
    claim(a.data.me, recoverySecret),
  );
  assert.equal(second.status, 200);
  const old = await request(a.path + '/control', firstBody);
  assert.equal(old.status, 409);
  assert.equal(old.data.code, 'RECOVERY_RECEIPT_INVALID');
  assert.equal((await request(a.path, undefined, first.cookie!)).status, 409);
  const reused = await request(a.path + '/control', {
    ...claim(a.data.me, recoverySecret),
    newSessionToken: firstBody.newSessionToken,
  });
  assert.equal(reused.status, 409);
  assert.equal(reused.data.code, 'INVALID_SESSION_TOKEN');
  const final = await request(a.path, undefined, second.cookie!);
  assert.deepEqual(final.data, second.data.view);
});

void test('stale key setup is atomic; key replacement invalidates old proof and even same-key prior receipts', async () => {
  const a = await create(),
    key = secret(),
    replacement = secret();
  const saved = await request(
    a.path + '/control',
    { type: 'setRecoveryKey', version: a.data.version, recoverySecret: key },
    a.cookie,
  );
  const stale = await request(
    a.path + '/control',
    {
      type: 'setRecoveryKey',
      version: a.data.version,
      recoverySecret: replacement,
    },
    a.cookie,
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.data.code, 'STALE_VERSION');
  assert.equal(
    (await request(a.path + '/control', claim(a.data.me, replacement))).status,
    409,
  );
  const body = claim(a.data.me, key);
  const recovered = await request(a.path + '/control', body);
  assert.equal(recovered.status, 200);
  const resaved = await request(
    a.path + '/control',
    {
      type: 'setRecoveryKey',
      version: recovered.data.view.version,
      recoverySecret: key,
    },
    recovered.cookie!,
  );
  assert.equal(resaved.status, 200);
  assert.equal(
    (await request(a.path + '/control', body)).data.code,
    'RECOVERY_RECEIPT_INVALID',
  );
  const changed = await request(
    a.path + '/control',
    {
      type: 'setRecoveryKey',
      version: resaved.data.view.version,
      recoverySecret: replacement,
    },
    recovered.cookie!,
  );
  assert.equal(changed.status, 200);
  assert.equal(
    (await request(a.path + '/control', claim(a.data.me, key))).data.code,
    'INVALID_RECOVERY_PROOF',
  );
  assert.equal(
    (await request(a.path + '/control', claim(a.data.me, replacement))).status,
    200,
  );
  assert.equal(saved.data.view.version, a.data.version + 1);
});

void test('recovery rejects other-player proofs, malformed credentials and cross-origin writes without disclosure', async () => {
  const a = await create(),
    key = secret();
  const saved = await request(
    a.path + '/control',
    { type: 'setRecoveryKey', version: a.data.version, recoverySecret: key },
    a.cookie,
  );
  assert.equal(saved.status, 200);
  for (const body of [claim(randomUUID(), key), claim(a.data.me, secret())]) {
    const r = await request(a.path + '/control', body);
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'INVALID_RECOVERY_PROOF');
    assert.deepEqual(Object.keys(r.data).sort(), ['code', 'error']);
    assert.equal(r.cookie, null);
  }
  assert.equal(
    (
      await request(a.path + '/control', {
        ...claim(a.data.me, key),
        newSessionToken: 'weak',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        a.path + '/control',
        claim(a.data.me, key),
        undefined,
        'https://unrelated.invalid',
      )
    ).status,
    403,
  );
  assert.equal((await request(a.path + '/control', null)).status, 400);
  const after = await request(a.path, undefined, a.cookie);
  assert.deepEqual(after.data, saved.data.view);
});

/** Run the actual room module against SQLite to retain an auth context across rotation. */
function unitStore() {
  const hooks: {
    beforeRead?: (sql: string) => Promise<void>;
    beforeBatch?: () => Promise<void>;
  } = {};
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(
      readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
    );
  class Statement {
    values: (string | number | null)[] = [];
    constructor(readonly sql: string) {}
    bind(...values: (string | number | null)[]) {
      this.values = values;
      return this;
    }
    async first() {
      await hooks.beforeRead?.(this.sql);
      return sqlite.prepare(this.sql).get(...this.values) ?? null;
    }
    async run() {
      return {
        meta: {
          changes: Number(sqlite.prepare(this.sql).run(...this.values).changes),
        },
      };
    }
  }
  const database = {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => {
      await hooks.beforeBatch?.();
      sqlite.exec('BEGIN');
      try {
        const rows = [];
        for (const statement of statements) rows.push(await statement.run());
        sqlite.exec('COMMIT');
        return rows;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const source = readFileSync(
    new URL('../db/rooms.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    crypto: webcrypto,
    TextEncoder,
    structuredClone,
    require: (name: string) => {
      if (name === 'cloudflare:workers') return { env: { DB: database } };
      if (name === '@/game/engine') return engine;
      if (name === '@/game/bots') return bots;
      throw new Error('Unexpected module ' + name);
    },
  });
  return { rooms: exports as typeof Rooms, sqlite, hooks };
}

void test('already-authenticated old actions and reads are fenced even at the latest room version', async () => {
  const { rooms, sqlite } = unitStore();
  try {
    const created = await rooms.createRoom(
      'Fenced owner',
      'atreides',
      false,
      [],
    );
    const code = created.view.code;
    const oldAuth = await rooms.authenticate(code, created.token);
    const key = secret();
    await rooms.setRecoveryKey(code, oldAuth, created.view.version, key);
    const body = claim(created.view.me, key);
    const recovered = await rooms.recoverSeat(code, body);
    // Deliberately supply the fresh version: version protection alone must not pass this request.
    await assert.rejects(
      rooms.act(code, oldAuth, recovered.view.version, { type: 'ready' }),
      /Another action/,
    );
    await assert.rejects(rooms.readSeatView(code, oldAuth), /verified/);
    const newAuth = await rooms.authenticate(code, body.newSessionToken);
    const after = await rooms.readSeatView(code, newAuth);
    assert.deepEqual(after, recovered.view);
    const advanced = await rooms.act(code, newAuth, after.version, {
      type: 'ready',
    });
    assert.equal(advanced.players[0].ready, true);
    const stored = sqlite.prepare('SELECT * FROM seat_recovery_keys').get()!;
    assert.notEqual(stored.recovery_hash, key);
    assert.equal(typeof stored.recovery_hash, 'string');
    assert.equal(String(stored.recovery_hash).length, 64);
    assert.equal(
      sqlite.prepare('SELECT count(*) AS n FROM seats WHERE revoked = 0').get()!
        .n,
      1,
    );
  } finally {
    sqlite.close();
  }
});

void test('simultaneous identical recovery claims commit one rotation and can both recover the same receipt', async () => {
  const a = await create(),
    key = secret();
  const saved = await request(
    a.path + '/control',
    { type: 'setRecoveryKey', version: a.data.version, recoverySecret: key },
    a.cookie,
  );
  assert.equal(saved.status, 200);
  const body = claim(a.data.me, key);
  const attempts = await Promise.all([
    request(a.path + '/control', body),
    request(a.path + '/control', body),
  ]);
  assert.ok(attempts.some((r) => r.status === 200));
  assert.ok(attempts.every((r) => [200, 409].includes(r.status)));
  const receipt = await request(a.path + '/control', body);
  assert.equal(receipt.status, 200);
  assert.equal(receipt.data.replayed, true);
  assert.equal(receipt.data.view.version, saved.data.view.version + 1);
  assert.equal((await request(a.path, undefined, a.cookie)).status, 409);
});

void test('recovery retains the exact persisted sealed battle and does not reveal it to an opponent', async () => {
  const { rooms, sqlite } = unitStore();
  try {
    const created = await rooms.createRoom(
      'Battle recovery',
      'atreides',
      false,
      [],
    );
    const code = created.view.code,
      id = created.view.me;
    let g = await rooms.readRoom(code);
    engine.joinGame(g, engine.newPlayer('opponent', 'Opponent', 'emperor'));
    g.players.forEach((p) => {
      p.ready = true;
    });
    g = engine.applyAction(g, id, { type: 'start' });
    for (const p of g.players) {
      if (p.traitorChoices.length)
        g = engine.applyAction(g, p.id, {
          type: 'traitor',
          leader: p.traitorChoices[0],
        });
    }
    g.phase = 6;
    g.storm = 18;
    g.active = id;
    g.order = [id, 'opponent'];
    for (const p of g.players) {
      p.forces = { 'arrakeen:10': 5 };
      p.reserves = 15;
      p.spice = 10;
    }
    g = engine.applyAction(g, id, {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'opponent',
    });
    for (
      let step = 0;
      step < 20 && (g.response || g.battle?.preparation);
      step++
    ) {
      if (g.response)
        g = engine.applyAction(
          g,
          g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
          { type: 'passResponse' },
        );
      else
        g = engine.applyAction(g, g.battle!.preparation!.owner, {
          type: 'declineBattlePower',
        });
    }
    g = engine.applyAction(g, id, {
      type: 'battlePlan',
      dial: 2,
      leader: 'atreides-0',
    });
    assert.ok(g.battle?.plans[id]);
    assert.equal(g.battle.revealed, false);
    const state = JSON.stringify(g);
    sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(state, code);
    const oldAuth = await rooms.authenticate(code, created.token),
      key = secret();
    const saved = await rooms.setRecoveryKey(code, oldAuth, g.version, key);
    const recovered = await rooms.recoverSeat(code, claim(id, key));
    sameGame(recovered.view, saved.view);
    assert.equal(
      sqlite.prepare('SELECT state FROM rooms WHERE code = ?').get(code)!.state,
      state,
    );
    const opponent = engine.viewGame(await rooms.readRoom(code), 'opponent');
    assert.equal(opponent.battle!.plans[id], undefined);
    assert.ok(recovered.view.battle!.plans[id]);
    assert.equal(recovered.view.battle!.revealed, false);
  } finally {
    sqlite.close();
  }
});

async function recoveryUnitFixture() {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Interleaving recovery',
    'atreides',
    false,
    [],
  );
  const code = created.view.code,
    auth = await store.rooms.authenticate(code, created.token),
    key = secret();
  await store.rooms.setRecoveryKey(code, auth, created.view.version, key);
  return { ...store, created, code, auth, key };
}
function custodySnapshot(sqlite: DatabaseSync) {
  return JSON.stringify(
    ['rooms', 'seats', 'seat_recovery_keys', 'seat_recovery_receipts'].map(
      (table) =>
        sqlite.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    ),
  );
}

void test('SQLite recovery rolls back all custody changes when replacement credential insertion fails', async () => {
  const f = await recoveryUnitFixture();
  try {
    const before = custodySnapshot(f.sqlite);
    f.sqlite.exec(
      "CREATE TRIGGER reject_replacement BEFORE INSERT ON seats BEGIN SELECT RAISE(ABORT, 'injected insertion failure'); END;",
    );
    await assert.rejects(
      f.rooms.recoverSeat(f.code, claim(f.created.view.me, f.key)),
      /injected insertion failure/,
    );
    assert.equal(custodySnapshot(f.sqlite), before);
    await f.rooms.readSeatView(f.code, f.auth);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite recovery rechecks a replaced proof between preflight and its atomic write', async () => {
  const f = await recoveryUnitFixture();
  try {
    let afterReplacement = '';
    f.hooks.beforeRead = async (sql) => {
      if (!sql.startsWith('SELECT state,version FROM rooms')) return;
      f.hooks.beforeRead = undefined;
      const current = await f.rooms.readRoom(f.code);
      await f.rooms.setRecoveryKey(f.code, f.auth, current.version, secret());
      afterReplacement = custodySnapshot(f.sqlite);
    };
    await assert.rejects(
      f.rooms.recoverSeat(f.code, claim(f.created.view.me, f.key)),
      /changed/,
    );
    assert.ok(afterReplacement);
    assert.equal(custodySnapshot(f.sqlite), afterReplacement);
    await f.rooms.readSeatView(f.code, f.auth);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite recovery receipt cannot disclose state if another rotation wins after receipt preflight', async () => {
  const f = await recoveryUnitFixture();
  try {
    const original = claim(f.created.view.me, f.key);
    await f.rooms.recoverSeat(f.code, original);
    const replacement = claim(f.created.view.me, f.key);
    let afterRotation = '';
    f.hooks.beforeRead = async (sql) => {
      if (!sql.includes('JOIN seat_recovery_keys AS keys')) return;
      f.hooks.beforeRead = undefined;
      await f.rooms.recoverSeat(f.code, replacement);
      afterRotation = custodySnapshot(f.sqlite);
    };
    await assert.rejects(
      f.rooms.recoverSeat(f.code, original),
      /no longer active/,
    );
    assert.ok(afterRotation);
    assert.equal(custodySnapshot(f.sqlite), afterRotation);
    await assert.rejects(
      f.rooms.authenticate(f.code, original.newSessionToken),
      /verified/,
    );
    await f.rooms.authenticate(f.code, replacement.newSessionToken);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite recovery same-key replacement invalidates a receipt already being verified', async () => {
  const f = await recoveryUnitFixture();
  try {
    const body = claim(f.created.view.me, f.key);
    const recovered = await f.rooms.recoverSeat(f.code, body);
    const auth = await f.rooms.authenticate(f.code, body.newSessionToken);
    let afterReplacement = '';
    f.hooks.beforeRead = async (sql) => {
      if (!sql.includes('JOIN seat_recovery_keys AS keys')) return;
      f.hooks.beforeRead = undefined;
      await f.rooms.setRecoveryKey(f.code, auth, recovered.view.version, f.key);
      afterReplacement = custodySnapshot(f.sqlite);
    };
    await assert.rejects(f.rooms.recoverSeat(f.code, body), /no longer active/);
    assert.ok(afterReplacement);
    assert.equal(custodySnapshot(f.sqlite), afterReplacement);
    await f.rooms.readSeatView(f.code, auth);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite recovery stale version makes every conditional batch statement a no-op', async () => {
  const f = await recoveryUnitFixture();
  try {
    let afterAction = '';
    f.hooks.beforeBatch = async () => {
      f.hooks.beforeBatch = undefined;
      const current = await f.rooms.readRoom(f.code);
      await f.rooms.act(f.code, f.auth, current.version, { type: 'ready' });
      afterAction = custodySnapshot(f.sqlite);
    };
    await assert.rejects(
      f.rooms.recoverSeat(f.code, claim(f.created.view.me, f.key)),
      /changed/,
    );
    assert.ok(afterAction);
    assert.equal(custodySnapshot(f.sqlite), afterAction);
    const view = await f.rooms.readSeatView(f.code, f.auth);
    assert.equal(view.players[0].ready, true);
  } finally {
    f.sqlite.close();
  }
});

function barrierGate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
void test('SQLite recovery distinct concurrent claims fence the loser and never resurrect a superseded receipt', async () => {
  const f = await recoveryUnitFixture();
  const gates = [barrierGate(), barrierGate()],
    bothReady = barrierGate(),
    firstFinished = barrierGate();
  try {
    const initialVersion = (await f.rooms.readRoom(f.code)).version;
    const bodies = [
      claim(f.created.view.me, f.key),
      claim(f.created.view.me, f.key),
    ];
    let arrivals = 0;
    f.hooks.beforeBatch = async () => {
      const index = arrivals++;
      assert.ok(index < 2);
      if (arrivals === 2) bothReady.release();
      await gates[index].promise;
    };
    const attempts = bodies.map((body) =>
      f.rooms.recoverSeat(f.code, body).then(
        (value) => {
          firstFinished.release();
          return { status: 'fulfilled' as const, value };
        },
        (reason: unknown) => ({ status: 'rejected' as const, reason }),
      ),
    );
    // Both claims have read the same room version, but neither has begun its transaction.
    await bothReady.promise;
    gates[0].release();
    await firstFinished.promise;
    gates[1].release();
    const outcomes = await Promise.all(attempts);
    f.hooks.beforeBatch = undefined;
    assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter((r) => r.status === 'rejected').length, 1);
    const winner = outcomes.findIndex((r) => r.status === 'fulfilled'),
      loser = 1 - winner;
    assert.equal((await f.rooms.readRoom(f.code)).version, initialVersion + 1);
    assert.equal(
      f.sqlite
        .prepare('SELECT count(*) AS n FROM seat_recovery_receipts')
        .get()!.n,
      1,
    );
    await assert.rejects(
      f.rooms.authenticate(f.code, bodies[loser].newSessionToken),
      /verified/,
    );
    const winningAuth = await f.rooms.authenticate(
      f.code,
      bodies[winner].newSessionToken,
    );
    // The failed operation has no receipt; an explicit retry with valid owner proof may now perform a NEW rotation.
    const later = await f.rooms.recoverSeat(f.code, bodies[loser]);
    assert.equal(later.replayed, false);
    assert.equal(later.view.version, initialVersion + 2);
    const afterLater = custodySnapshot(f.sqlite);
    await assert.rejects(
      f.rooms.recoverSeat(f.code, bodies[winner]),
      /no longer active/,
    );
    await assert.rejects(
      f.rooms.act(f.code, winningAuth, later.view.version, { type: 'ready' }),
      /Another action/,
    );
    assert.equal(custodySnapshot(f.sqlite), afterLater);
    assert.equal(
      f.sqlite
        .prepare('SELECT count(*) AS n FROM seats WHERE revoked = 0')
        .get()!.n,
      1,
    );
    await f.rooms.authenticate(f.code, bodies[loser].newSessionToken);
  } finally {
    for (const gate of gates) gate.release();
    f.sqlite.close();
  }
});
