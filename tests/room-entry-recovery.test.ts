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
const entry = () => ({ operationId: randomUUID(), sessionToken: secret() });
const createBody = () => ({
  name: 'Entry audit owner',
  faction: 'atreides',
  advanced: false,
  expansions: [] as string[],
  entry: entry(),
});
type WireView = engine.GameView & {
  entryReceipt?: { operationId: string; replayed: boolean };
  alreadySeated?: boolean;
  error?: string;
  view?: engine.GameView;
};
async function request(path: string, body?: unknown, cookie?: string) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: (await response.json()) as WireView,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    cache: response.headers.get('cache-control'),
  };
}
const withoutReceipt = (g: WireView) => {
  const copy = { ...g };
  delete copy.entryReceipt;
  delete copy.alreadySeated;
  return copy;
};
async function host() {
  const body = createBody(),
    result = await request('/api/rooms', body);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.ok(result.cookie);
  return {
    ...result,
    cookie: result.cookie,
    body,
    path: `/api/rooms/${result.data.code}`,
  };
}
function rejectsReceipt(result: Awaited<ReturnType<typeof request>>) {
  assert.equal(result.status, 409);
  assert.equal(result.data.code, 'ENTRY_RECEIPT_INVALID');
  assert.equal(result.cookie, undefined);
  assert.deepEqual(Object.keys(result.data).sort(), ['code', 'error']);
}

void test('entry create replay recovers the same cookie and current room without replaying later state', async () => {
  const h = await host();
  assert.deepEqual(h.data.entryReceipt, {
    operationId: h.body.entry.operationId,
    replayed: false,
  });
  assert.equal(h.cache, 'no-store');
  const ready = await request(
    h.path,
    { version: h.data.version, action: { type: 'ready' } },
    h.cookie,
  );
  assert.equal(ready.status, 200);
  const replay = await request('/api/rooms', h.body);
  assert.equal(replay.status, 201);
  assert.equal(replay.cookie, h.cookie);
  assert.deepEqual(replay.data.entryReceipt, {
    operationId: h.body.entry.operationId,
    replayed: true,
  });
  assert.deepEqual(withoutReceipt(replay.data), ready.data);
  assert.ok(!JSON.stringify(replay.data).includes(h.body.entry.sessionToken));
});

void test('concurrent identical creates converge on one room, seat, token and receipt', async () => {
  const body = createBody();
  const results = await Promise.all([
    request('/api/rooms', body),
    request('/api/rooms', body),
  ]);
  assert.ok(
    results.every((r) => r.status === 201),
    JSON.stringify(results.map((r) => r.data)),
  );
  assert.equal(results[0].data.code, results[1].data.code);
  assert.equal(results[0].data.me, results[1].data.me);
  assert.equal(results[0].cookie, results[1].cookie);
  assert.equal(results[0].data.players.length, 1);
  assert.deepEqual(
    results
      .map((r) => r.data.entryReceipt!.replayed)
      .sort((a, b) => Number(a) - Number(b)),
    [false, true],
  );
});

void test('entry identity accepts normalized validated fields and rejects changed or unsupported rules', async () => {
  const body = {
    ...createBody(),
    name: '  Normalized owner  ',
    expansions: ['ix', 'choam', 'ix'],
  };
  const first = await request('/api/rooms', body);
  assert.equal(first.status, 201);
  const normalized = await request('/api/rooms', {
    ...body,
    name: 'Normalized owner',
    expansions: ['choam', 'ix'],
  });
  assert.equal(normalized.status, 201);
  assert.equal(normalized.data.me, first.data.me);
  for (const change of [
    { name: 'Different owner' },
    { faction: 'emperor' },
    { advanced: true },
    { expansions: ['ix'] },
    { entry: { ...body.entry, sessionToken: secret() } },
  ])
    rejectsReceipt(await request('/api/rooms', { ...body, ...change }));
  const invalid = await request('/api/rooms', {
    ...body,
    expansions: ['ix', 'choam', 'unsupported'],
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.cookie, undefined);
});

void test('concurrent identical joins add one seat and receipt retry takes precedence over an unrelated seat cookie', async () => {
  const h = await host(),
    body = {
      type: 'join',
      name: 'Entry joiner',
      faction: 'harkonnen',
      entry: entry(),
    };
  const results = await Promise.all([
    request(h.path, body),
    request(h.path, body),
  ]);
  assert.ok(
    results.every((r) => r.status === 200),
    JSON.stringify(results.map((r) => r.data)),
  );
  assert.equal(results[0].data.me, results[1].data.me);
  assert.equal(results[0].cookie, results[1].cookie);
  assert.equal(results[0].data.players.length, 2);
  assert.equal(results[0].data.version, h.data.version + 1);
  const replay = await request(h.path, body, h.cookie);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.me, results[0].data.me);
  assert.notEqual(replay.data.me, h.data.me);
  assert.equal(replay.cookie, results[0].cookie);
  assert.equal(replay.data.entryReceipt?.operationId, body.entry.operationId);
  assert.equal(replay.data.entryReceipt?.replayed, true);
});

void test('new entry join with an existing authenticated seat acknowledges it without creating credentials', async () => {
  const h = await host();
  const result = await request(
    h.path,
    {
      type: 'join',
      name: 'Unused second name',
      faction: 'harkonnen',
      entry: entry(),
    },
    h.cookie,
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.alreadySeated, true);
  assert.equal(result.data.entryReceipt, undefined);
  assert.equal(result.cookie, undefined);
  assert.deepEqual(withoutReceipt(result.data), withoutReceipt(h.data));
  const malformed = await request(
    h.path,
    {
      type: 'join',
      name: 'Unused',
      faction: 'harkonnen',
      entry: { operationId: 'bad', sessionToken: 'weak' },
    },
    h.cookie,
  );
  assert.equal(malformed.status, 400);
});

void test('global entry operation cannot be reused for another room or operation kind', async () => {
  const h = await host();
  rejectsReceipt(
    await request(
      h.path,
      {
        type: 'join',
        name: h.body.name,
        faction: h.body.faction,
        entry: h.body.entry,
      },
      h.cookie,
    ),
  );
  const firstJoin = {
    type: 'join',
    name: 'Bound room',
    faction: 'harkonnen',
    entry: entry(),
  };
  const joined = await request(h.path, firstJoin);
  assert.equal(joined.status, 200);
  const other = await host();
  rejectsReceipt(await request(other.path, firstJoin, other.cookie));
  rejectsReceipt(
    await request('/api/rooms', {
      ...createBody(),
      name: firstJoin.name,
      faction: firstJoin.faction,
      entry: firstJoin.entry,
    }),
  );
});

void test('entry replay remains available after game start without revealing another seat hand', async () => {
  const h = await host(),
    body = {
      type: 'join',
      name: 'Restored Harkonnen',
      faction: 'harkonnen',
      entry: entry(),
    };
  const joined = await request(h.path, body);
  assert.equal(joined.status, 200);
  let view = joined.data;
  for (const cookie of [h.cookie, joined.cookie!]) {
    const ready = await request(
      h.path,
      { version: view.version, action: { type: 'ready' } },
      cookie,
    );
    assert.equal(ready.status, 200);
    view = ready.data;
  }
  const start = await request(
    h.path,
    { version: view.version, action: { type: 'start' } },
    h.cookie,
  );
  assert.equal(start.status, 200);
  const replay = await request(h.path, body);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.status, 'setup');
  assert.equal(
    replay.data.players.find((p) => p.id === replay.data.me)!.hand!.length,
    0,
  );
  assert.equal(
    replay.data.players.find((p) => p.id === h.data.me)!.hand,
    undefined,
  );
  assert.equal(replay.data.version, start.data.version);
  assert.equal(replay.data.setupStage, 'traitors');
  const completed = await request(
    h.path,
    {
      version: replay.data.version,
      action: {
        type: 'traitor',
        leader: start.data.players.find((p) => p.id === h.data.me)!
          .traitorChoices![0],
      },
    },
    h.cookie,
  );
  assert.equal(completed.status, 200);
  assert.equal(completed.data.status, 'playing');
  const dealt = await request(h.path, undefined, joined.cookie);
  assert.equal(dealt.status, 200);
  assert.equal(
    dealt.data.players.find((p) => p.id === dealt.data.me)!.hand!.length,
    2,
  );
  const replayDealt = await request(h.path, body);
  assert.equal(replayDealt.status, 200);
  assert.equal(replayDealt.cookie, joined.cookie);
  assert.equal(replayDealt.data.entryReceipt?.replayed, true);
  assert.deepEqual(withoutReceipt(replayDealt.data), dealt.data);
  for (const p of replayDealt.data.players.filter(
    (p) => p.id !== replayDealt.data.me,
  )) {
    assert.equal(p.hand, undefined);
    assert.equal(p.traitors, undefined);
    assert.equal(p.traitorChoices, undefined);
    assert.equal(p.spice, undefined);
  }
  const hostRefreshed = await request(h.path, undefined, h.cookie);
  assert.equal(hostRefreshed.status, 200);
  assert.equal(
    hostRefreshed.data.players.find((p) => p.id === h.data.me)!.hand!.length,
    1,
  );
  assert.deepEqual(hostRefreshed.data, completed.data);
});

void test('revoked entry receipts cannot resurrect the session or disclose private room state', async () => {
  const h = await host(),
    recoverySecret = secret();
  const saved = await request(
    h.path + '/control',
    { type: 'setRecoveryKey', version: h.data.version, recoverySecret },
    h.cookie,
  );
  assert.equal(saved.status, 200);
  const recovered = await request(h.path + '/control', {
    type: 'recoverSeat',
    playerId: h.data.me,
    recoverySecret,
    operationId: randomUUID(),
    newSessionToken: secret(),
  });
  assert.equal(recovered.status, 200);
  rejectsReceipt(await request('/api/rooms', h.body));
  const active = await request(h.path, undefined, recovered.cookie!);
  assert.equal(active.status, 200);
  assert.deepEqual(active.data, recovered.data.view);
});

void test('distinct same-faction claims create only one seat and cannot use the winning receipt', async () => {
  const h = await host();
  const bodies = [0, 1].map((i) => ({
    type: 'join',
    name: 'Claimant ' + i,
    faction: 'harkonnen',
    entry: entry(),
  }));
  const results = await Promise.all(
    bodies.map((body) => request(h.path, body)),
  );
  assert.deepEqual(
    results.map((r) => r.status).sort((a, b) => a - b),
    [200, 409],
  );
  const winner = results.findIndex((r) => r.status === 200),
    loser = 1 - winner;
  const changedProof = {
    ...bodies[winner],
    entry: {
      ...bodies[winner].entry,
      sessionToken: bodies[loser].entry.sessionToken,
    },
  };
  rejectsReceipt(await request(h.path, changedProof));
  assert.equal(results[loser].cookie, undefined);
  const view = await request(h.path, undefined, h.cookie);
  assert.equal(view.data.players.length, 2);
  assert.equal(view.data.version, h.data.version + 1);
});

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

function snapshot(sqlite: DatabaseSync) {
  return JSON.stringify(
    ['rooms', 'seats', 'room_entry_receipts'].map((table) =>
      sqlite.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    ),
  );
}
void test('SQLite entry receipt insert failures roll back whole create and join transactions', async () => {
  const { rooms, sqlite } = unitStore();
  try {
    const h = await rooms.createRoom('Legacy host', 'atreides', false, []);
    const before = snapshot(sqlite);
    sqlite.exec(
      "CREATE TRIGGER reject_entry BEFORE INSERT ON room_entry_receipts BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END;",
    );
    await assert.rejects(
      rooms.createRoom('Failed create', 'emperor', false, [], entry()),
      /injected receipt failure/,
    );
    assert.equal(snapshot(sqlite), before);
    await assert.rejects(
      rooms.joinRoom(h.view.code, 'Failed join', 'harkonnen', entry()),
      /injected receipt failure/,
    );
    assert.equal(snapshot(sqlite), before);
  } finally {
    sqlite.close();
  }
});

void test('SQLite exact create retry after a failed receipt insert produces one complete room', async () => {
  const { rooms, sqlite } = unitStore();
  try {
    const proof = entry();
    sqlite.exec(
      "CREATE TRIGGER reject_entry BEFORE INSERT ON room_entry_receipts BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END;",
    );
    await assert.rejects(
      rooms.createRoom('Retry create', 'atreides', false, [], proof),
    );
    sqlite.exec('DROP TRIGGER reject_entry');
    const created = await rooms.createRoom(
      'Retry create',
      'atreides',
      false,
      [],
      proof,
    );
    const replay = await rooms.createRoom(
      'Retry create',
      'atreides',
      false,
      [],
      proof,
    );
    assert.equal(replay.view.code, created.view.code);
    assert.equal(replay.entryReceipt?.replayed, true);
    for (const table of ['rooms', 'seats', 'room_entry_receipts'])
      assert.equal(
        sqlite.prepare('SELECT count(*) AS n FROM ' + table).get()!.n,
        1,
      );
    const stored = sqlite.prepare('SELECT * FROM room_entry_receipts').get()!;
    assert.notEqual(stored.operation_hash, proof.operationId);
    assert.notEqual(stored.session_hash, proof.sessionToken);
  } finally {
    sqlite.close();
  }
});

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { release, promise };
}
for (const collision of ['operation', 'token'] as const)
  void test(`SQLite concurrent ${collision} collisions roll back and report a precise conflict`, async () => {
    const { rooms, sqlite, hooks } = unitStore();
    const gates = [gate(), gate()],
      ready = gate(),
      finished = gate();
    try {
      const operationId = randomUUID(),
        sessionToken = secret();
      const proofs = [0, 1].map(() => ({
        operationId: collision === 'operation' ? operationId : randomUUID(),
        sessionToken: collision === 'token' ? sessionToken : secret(),
      }));
      let arrivals = 0;
      hooks.beforeBatch = async () => {
        const index = arrivals++;
        assert.ok(index < 2);
        if (arrivals === 2) ready.release();
        await gates[index].promise;
      };
      const attempts = proofs.map((proof, i) =>
        rooms.createRoom('Creator ' + i, 'atreides', false, [], proof).then(
          (value) => {
            finished.release();
            return { status: 'fulfilled' as const, value };
          },
          (reason: unknown) => ({ status: 'rejected' as const, reason }),
        ),
      );
      await ready.promise;
      gates[0].release();
      await finished.promise;
      gates[1].release();
      const outcomes = await Promise.all(attempts);
      assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter((r) => r.status === 'rejected').length, 1);
      const rejected = outcomes.find((r) => r.status === 'rejected')!;
      if (rejected.status === 'rejected')
        assert.equal(
          (rejected.reason as { code: string }).code,
          collision === 'operation'
            ? 'ENTRY_RECEIPT_INVALID'
            : 'ENTRY_TOKEN_USED',
        );
      for (const table of ['rooms', 'seats', 'room_entry_receipts'])
        assert.equal(
          sqlite.prepare('SELECT count(*) AS n FROM ' + table).get()!.n,
          1,
        );
    } finally {
      for (const item of gates) item.release();
      sqlite.close();
    }
  });
