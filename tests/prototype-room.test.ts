import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createGame, joinGame, newPlayer } from '../game/engine';
import { startIxPrototypeRoom } from '../tools/prototype-room';

function fixture(t: test.TestContext) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(
    'CREATE TABLE rooms(code TEXT PRIMARY KEY, state TEXT, version INTEGER, updated_at INTEGER); CREATE TABLE seats(room_code TEXT, player_id TEXT, token_hash TEXT);',
  );
  const game = createGame(
    'PROTOTYP',
    newPlayer('i', 'Ix player', 'ixians'),
    true,
  );
  game.expansions = ['ix'];
  joinGame(game, newPlayer('t', 'Tleilaxu player', 'tleilaxu'));
  game.players.forEach((player) => {
    player.ready = true;
  });
  db.prepare('INSERT INTO rooms VALUES(?,?,?,?)').run(
    game.code,
    JSON.stringify(game),
    7,
    100,
  );
  db.prepare('INSERT INTO rooms VALUES(?,?,?,?)').run(
    'KEEPME00',
    '{"unchanged":true}',
    3,
    50,
  );
  db.prepare('INSERT INTO seats VALUES(?,?,?)').run(
    game.code,
    'i',
    'unchanged-private-session',
  );
  return { db, game };
}

void test('local prototype starts the named ready lobby once, retaining every seat and other room', (t) => {
  const { db } = fixture(t);
  const seats = db.prepare('SELECT * FROM seats').all();
  const other = db
    .prepare('SELECT * FROM rooms WHERE code = ?')
    .get('KEEPME00');
  const result = startIxPrototypeRoom(db, 'PROTOTYP', 7);
  assert.equal(result.version, 8);
  assert.equal(result.status, 'setup');
  const saved = db
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .get('PROTOTYP')!;
  assert.equal(JSON.parse(saved.state as string).version, saved.version);
  assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  assert.deepEqual(
    db.prepare('SELECT * FROM rooms WHERE code = ?').get('KEEPME00'),
    other,
  );
  const rows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.throws(() => startIxPrototypeRoom(db, 'PROTOTYP', 7), /changed/);
  assert.throws(() => startIxPrototypeRoom(db, 'PROTOTYP', 8), /fresh lobby/);
  assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), rows);
});

void test('unready, wrong identity and incompatible lobbies fail without writing any room or seat', (t) => {
  const { db, game } = fixture(t);
  for (const mutate of [
    () => {
      game.players[0].ready = false;
    },
    () => {
      game.players[0].ready = true;
      game.code = 'NOTMATCH';
    },
    () => {
      game.code = 'PROTOTYP';
      game.expansions = [];
    },
  ]) {
    mutate();
    db.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(
      JSON.stringify(game),
      'PROTOTYP',
    );
    const before = db.prepare('SELECT * FROM rooms ORDER BY code').all();
    assert.throws(() => startIxPrototypeRoom(db, 'PROTOTYP', 7));
    assert.deepEqual(
      db.prepare('SELECT * FROM rooms ORDER BY code').all(),
      before,
    );
    assert.equal(
      db.prepare('SELECT count(*) AS count FROM seats').get()!.count,
      1,
    );
  }
});
