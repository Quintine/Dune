import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as contract from '../lib/table-talk';
import type * as Talk from '../db/table-talk';
import { unitStore } from './fixture-nexus-room-store';

async function fixture() {
  const store = unitStore();
  assert.ok(store.sqlite instanceof DatabaseSync);
  const a = await store.rooms.createRoom(
    'Atreides speaker',
    'atreides',
    false,
    [],
  );
  const b = await store.rooms.joinRoom(
    a.view.code,
    'Emperor listener',
    'emperor',
  );
  const c = await store.rooms.joinRoom(a.view.code, 'Guild observer', 'guild');
  const auth = await Promise.all(
    [a, b, c].map((seat) => store.rooms.authenticate(a.view.code, seat.token!)),
  );
  function load() {
    const exports = {};
    runInNewContext(
      ts.transpileModule(
        readFileSync(new URL('../db/table-talk.ts', import.meta.url), 'utf8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText,
      {
        exports,
        JSON,
        require: (name: string) => {
          if (name === 'cloudflare:workers')
            return { env: { DB: store.database } };
          if (name === '../lib/table-talk') return contract;
          throw new Error(`Unexpected module: ${name}`);
        },
      },
    );
    const loaded = exports as typeof Talk;
    return {
      sendTableTalk: async (...args: Parameters<typeof loaded.sendTableTalk>) =>
        structuredClone(await loaded.sendTableTalk(...args)),
      readTableTalk: async (...args: Parameters<typeof loaded.readTableTalk>) =>
        structuredClone(await loaded.readTableTalk(...args)),
    };
  }
  return { ...store, code: a.view.code, auth, talk: load(), load };
}
const draft = (text: string, recipientId: string | null = null) => ({
  id: crypto.randomUUID(),
  text,
  recipientId,
});
const gameRows = (f: Awaited<ReturnType<typeof fixture>>) =>
  f.sqlite.prepare('SELECT * FROM rooms').all();

void test('public and private discussion preserves game rows and hides direct activity from third seats', async () => {
  const f = await fixture();
  try {
    const before = gameRows(f);
    const publicText = draft('Can we discuss an alliance?');
    const privateText = draft(
      'PRIVATE OFFER: Arrakeen for Sietch Tabr.',
      f.auth[1].playerId,
    );
    await f.talk.sendTableTalk(f.code, f.auth[0], publicText, 1000);
    await f.talk.sendTableTalk(f.code, f.auth[0], privateText, 2000);
    const publicPage = await f.talk.readTableTalk(f.code, f.auth[2], null);
    assert.deepEqual(
      publicPage.messages.map((m) => m.text),
      [publicText.text],
    );
    assert.equal(publicPage.before, null);
    assert.equal(JSON.stringify(publicPage).includes('PRIVATE'), false);
    assert.deepEqual(
      await f.talk.readTableTalk(f.code, f.auth[2], f.auth[0].playerId),
      { messages: [], before: null, muted: false },
    );
    for (const [viewer, peer] of [
      [0, 1],
      [1, 0],
    ]) {
      const page = await f.talk.readTableTalk(
        f.code,
        f.auth[viewer],
        f.auth[peer].playerId,
      );
      assert.equal(page.messages[0].text, privateText.text);
      for (const key of [
        'sequence',
        'senderSessionHash',
        'sender_session_hash',
        'tokenHash',
      ])
        assert.equal(JSON.stringify(page).includes(key), false);
    }
    assert.deepEqual(
      await f.load().readTableTalk(f.code, f.auth[1], f.auth[0].playerId),
      await f.talk.readTableTalk(f.code, f.auth[1], f.auth[0].playerId),
    );
    assert.deepEqual(gameRows(f), before);
  } finally {
    f.sqlite.close();
  }
});

void test('exact message retries are idempotent under races, and altered or foreign receipts cannot disclose or mutate', async () => {
  const f = await fixture();
  try {
    const input = draft('One sealed offer.', f.auth[1].playerId);
    const results = await Promise.all([
      f.talk.sendTableTalk(f.code, f.auth[0], input, 5000),
      f.talk.sendTableTalk(f.code, f.auth[0], input, 5000),
    ]);
    assert.deepEqual(
      results.map((r) => r.replayed).sort((a, b) => Number(a) - Number(b)),
      [false, true],
    );
    for (const [auth, changed] of [
      [f.auth[0], { ...input, text: 'Altered' }],
      [f.auth[0], { ...input, recipientId: null }],
      [f.auth[2], input],
      [f.auth[0], { ...input, senderId: f.auth[1].playerId }],
    ] as const)
      await assert.rejects(f.talk.sendTableTalk(f.code, auth, changed, 6000));
    assert.equal(
      f.sqlite.prepare('SELECT count(*) AS n FROM room_messages').get()!.n,
      1,
    );
    assert.equal(
      (await f.talk.sendTableTalk(f.code, f.auth[0], input, 5000)).replayed,
      true,
    );
    await assert.rejects(
      f.talk.sendTableTalk(f.code, f.auth[0], draft('Too fast'), 5500),
    );
    await f.talk.sendTableTalk(
      f.code,
      f.auth[0],
      draft('After interval'),
      6000,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('SQL fences stale sender credentials and recipients at commit; new seat owner inherits history without reviving old sends', async () => {
  const f = await fixture();
  try {
    const old = draft('Before recovery', f.auth[1].playerId);
    await f.talk.sendTableTalk(f.code, f.auth[0], old, 1000);
    f.hooks.beforeStatement = async (sql) => {
      if (!sql.startsWith('INSERT INTO room_messages')) return;
      delete f.hooks.beforeStatement;
      f.sqlite
        .prepare('UPDATE seats SET revoked = 1 WHERE token_hash = ?')
        .run(f.auth[0].tokenHash);
    };
    await assert.rejects(
      f.talk.sendTableTalk(f.code, f.auth[0], draft('Stale controller'), 2000),
    );
    await assert.rejects(f.talk.readTableTalk(f.code, f.auth[0], null));
    const fresh = { ...f.auth[0], tokenHash: 'new-test-session' };
    f.sqlite
      .prepare(
        'INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)',
      )
      .run(fresh.tokenHash, f.code, fresh.playerId);
    assert.equal(
      (await f.talk.readTableTalk(f.code, fresh, f.auth[1].playerId))
        .messages[0].text,
      old.text,
    );
    await assert.rejects(f.talk.sendTableTalk(f.code, fresh, old, 3000));
    f.hooks.beforeStatement = async (sql) => {
      if (!sql.startsWith('INSERT INTO room_messages')) return;
      delete f.hooks.beforeStatement;
      const game = await f.rooms.readRoom(f.code);
      game.players = game.players.filter((p) => p.id !== f.auth[1].playerId);
      f.sqlite
        .prepare('UPDATE rooms SET state = ? WHERE code = ?')
        .run(JSON.stringify(game), f.code);
    };
    await assert.rejects(
      f.talk.sendTableTalk(
        f.code,
        fresh,
        draft('Recipient removed', f.auth[1].playerId),
        4000,
      ),
    );
    await assert.rejects(f.talk.readTableTalk(f.code, f.auth[1], null));
    assert.equal(
      f.sqlite.prepare('SELECT count(*) AS n FROM room_messages').get()!.n,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('pagination filters before limiting and never accepts a hidden message as a cursor', async () => {
  const f = await fixture();
  try {
    const ids: string[] = [];
    let privateId = '';
    for (let index = 0; index < 54; index++) {
      const message = draft(`Public ${index}`);
      ids.push(message.id);
      await f.talk.sendTableTalk(f.code, f.auth[0], message, index * 2000);
      const secret = draft(`Private ${index}`, f.auth[1].playerId);
      privateId = secret.id;
      await f.talk.sendTableTalk(
        f.code,
        f.auth[0],
        secret,
        index * 2000 + 1000,
      );
    }
    const first = await f.talk.readTableTalk(f.code, f.auth[2], null);
    assert.equal(first.messages.length, 50);
    assert.deepEqual(
      first.messages.map((m) => m.id),
      ids.slice(4),
    );
    assert.equal(first.before, ids[4]);
    const older = await f.talk.readTableTalk(
      f.code,
      f.auth[2],
      null,
      first.before,
    );
    assert.deepEqual(
      older.messages.map((m) => m.id),
      ids.slice(0, 4),
    );
    assert.equal(older.before, null);
    assert.deepEqual(
      await f.talk.readTableTalk(f.code, f.auth[2], null, privateId),
      { messages: [], before: null, muted: false },
    );
    assert.deepEqual(
      await f.talk.readTableTalk(f.code, f.auth[2], null, crypto.randomUUID()),
      { messages: [], before: null, muted: false },
    );
  } finally {
    f.sqlite.close();
  }
});

void test('discussion remains independent of sealed decisions, AI ownership and game completion', async () => {
  const f = await fixture();
  try {
    for (const auth of f.auth)
      await f.rooms.act(
        f.code,
        auth,
        (await f.rooms.readRoom(f.code)).version,
        { type: 'ready' },
      );
    await f.rooms.act(
      f.code,
      f.auth[0],
      (await f.rooms.readRoom(f.code)).version,
      { type: 'start' },
    );
    const game = await f.rooms.readRoom(f.code);
    game.players[0].autopilot = 'Hard';
    game.players[2].bot = 'Easy';
    f.sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(game), f.code);
    const before = gameRows(f);
    await f.talk.sendTableTalk(
      f.code,
      f.auth[0],
      draft('Human owner can still talk.'),
      1000,
    );
    await assert.rejects(
      f.talk.sendTableTalk(
        f.code,
        f.auth[0],
        draft('Bot recipient', f.auth[2].playerId),
        2000,
      ),
    );
    await assert.rejects(
      f.talk.sendTableTalk(f.code, f.auth[2], draft('Bot sender'), 2000),
    );
    await assert.rejects(f.talk.readTableTalk(f.code, f.auth[2], null));
    assert.deepEqual(gameRows(f), before);
    game.status = 'finished';
    f.sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(game), f.code);
    await f.talk.sendTableTalk(
      f.code,
      f.auth[0],
      draft('Postgame discussion.'),
      3000,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('a credential rotation after a committed insert still returns that exact successful receipt', async () => {
  const f = await fixture();
  try {
    const input = draft('Committed before rotation.');
    f.hooks.afterStatement = async (sql) => {
      if (!sql.startsWith('INSERT INTO room_messages')) return;
      delete f.hooks.afterStatement;
      f.sqlite
        .prepare('UPDATE seats SET revoked = 1 WHERE token_hash = ?')
        .run(f.auth[0].tokenHash);
    };
    assert.deepEqual(
      await f.talk.sendTableTalk(f.code, f.auth[0], input, 1000),
      { id: input.id, replayed: false },
    );
    assert.equal(
      (await f.talk.readTableTalk(f.code, f.auth[1], null)).messages[0].id,
      input.id,
    );
    await assert.rejects(f.talk.sendTableTalk(f.code, f.auth[0], input, 2000));
    assert.equal(
      f.sqlite.prepare('SELECT count(*) AS n FROM room_messages').get()!.n,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('mute prevents new public/private sends, preserves incoming history and exact committed retries, and follows seat rotation', async () => {
  const f = await fixture();
  try {
    const before = gameRows(f), prior = draft('Private history before mute', f.auth[1].playerId);
    await f.talk.sendTableTalk(f.code, f.auth[0], prior, 1000);
    f.sqlite.prepare('INSERT INTO seat_discussion_controls(room_code,player_id,muted,revision,updated_at) VALUES(?,?,1,1,1)').run(f.code, f.auth[0].playerId);
    for (const recipient of [null, f.auth[1].playerId])
      await assert.rejects(f.talk.sendTableTalk(f.code, f.auth[0], draft('Blocked', recipient), 2000), (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === 'SEAT_DISCUSSION_MUTED');
    assert.equal((await f.talk.sendTableTalk(f.code, f.auth[0], prior, 3000)).replayed, true);
    await assert.rejects(f.talk.sendTableTalk(f.code, f.auth[0], { ...prior, text: 'Altered' }, 3000));
    await f.talk.sendTableTalk(f.code, f.auth[1], draft('Incoming remains available', f.auth[0].playerId), 4000);
    const own = await f.talk.readTableTalk(f.code, f.auth[0], f.auth[1].playerId);
    assert.equal(own.muted, true); assert.equal(own.messages.length, 2);
    const observer = await f.talk.readTableTalk(f.code, f.auth[2], null);
    assert.deepEqual(observer, { messages: [], before: null, muted: false });
    f.sqlite.prepare('UPDATE seats SET revoked=1 WHERE token_hash=?').run(f.auth[0].tokenHash);
    const fresh = { ...f.auth[0], tokenHash: 'new-muted-controller' };
    f.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)').run(fresh.tokenHash, f.code, fresh.playerId);
    await assert.rejects(f.talk.readTableTalk(f.code, f.auth[0], null));
    assert.deepEqual(await f.load().readTableTalk(f.code, fresh, f.auth[1].playerId), own);
    await assert.rejects(f.talk.sendTableTalk(f.code, fresh, prior, 5000));
    await assert.rejects(f.talk.sendTableTalk(f.code, fresh, draft('Still muted'), 5000));
    f.sqlite.prepare('UPDATE seat_discussion_controls SET muted=0,revision=2').run();
    await f.talk.sendTableTalk(f.code, fresh, draft('Unmuted'), 6000);
    assert.equal((await f.talk.readTableTalk(f.code, fresh, null)).muted, false);
    assert.deepEqual(gameRows(f), before);
  } finally { f.sqlite.close(); }
});
for (const when of ['before', 'after'] as const) void test(`mute ${when} message insert respects commit order`, async () => {
  const f = await fixture();
  try {
    const input = draft('Racing mute');
    const hook = when === 'before' ? 'beforeStatement' : 'afterStatement';
    f.hooks[hook] = async sql => {
      if (!sql.startsWith('INSERT INTO room_messages')) return;
      delete f.hooks[hook];
      f.sqlite.prepare('INSERT INTO seat_discussion_controls(room_code,player_id,muted,revision,updated_at) VALUES(?,?,1,1,1)').run(f.code, f.auth[0].playerId);
    };
    if (when === 'before') await assert.rejects(f.talk.sendTableTalk(f.code, f.auth[0], input, 1000));
    else {
      assert.deepEqual(await f.talk.sendTableTalk(f.code, f.auth[0], input, 1000), { id: input.id, replayed: false });
      assert.equal((await f.talk.sendTableTalk(f.code, f.auth[0], input, 2000)).replayed, true);
    }
    assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM room_messages').get()!.n, when === 'before' ? 0 : 1);
  } finally { f.sqlite.close(); }
});
