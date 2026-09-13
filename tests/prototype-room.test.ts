import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import {
  startIxPrototypeRoom,
  startPrototypeRoom,
} from '../tools/prototype-room';

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

void test('Ecaz Treachery preview saves the complete independent inventory before genuine setup once', (t) => {
  const { db } = fixture(t);
  const beforeSeats = db.prepare('SELECT * FROM seats').all();
  const other = db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00');
  const result = startPrototypeRoom(db, 'PROTOTYP', 7, 'ecaz-treachery');
  const row = db.prepare('SELECT state FROM rooms WHERE code=?').get('PROTOTYP')!;
  const g = JSON.parse(row.state as string) as Game;
  assert.equal(result.version, 8);
  assert.equal(g.ecazTreachery, true);
  const cards = [...g.deck, ...g.players.flatMap((p) => p.hand), ...(g.ixSetupCards ?? [])];
  assert.deepEqual(cards.filter((c) => c.id.startsWith('ecaz-')).map((c) => c.id).sort(),
    ['ecaz-harass-withdraw', 'ecaz-recruits', 'ecaz-reinforcements']);
  assert.deepEqual(db.prepare('SELECT * FROM seats').all(), beforeSeats);
  assert.deepEqual(db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00'), other);
  const rows = db.prepare('SELECT * FROM rooms').all();
  assert.throws(() => startPrototypeRoom(db, 'PROTOTYP', 8, 'ecaz-treachery'), /cannot redeal/);
  assert.deepEqual(db.prepare('SELECT * FROM rooms').all(), rows);
});

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

void test('Leader Skills prototype saves the real private setup once without changing other rooms or seats', (t) => {
  const { db } = fixture(t);
  const game = createGame(
    'PROTOTYP',
    newPlayer('i', 'Atreides', 'atreides'),
    true,
  );
  joinGame(game, newPlayer('h', 'Harkonnen', 'harkonnen'));
  game.players.forEach((p) => {
    p.ready = true;
  });
  db.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(
    JSON.stringify(game),
    game.code,
  );
  const seats = db.prepare('SELECT * FROM seats').all();
  const other = db
    .prepare('SELECT * FROM rooms WHERE code = ?')
    .get('KEEPME00');
  const result = startPrototypeRoom(db, game.code, 7, 'leader-skills');
  assert.equal(result.version, 8);
  const saved = JSON.parse(
    db.prepare('SELECT state FROM rooms WHERE code = ?').get(game.code)!
      .state as string,
  );
  assert.equal(saved.version, 8);
  assert.equal(saved.setupStage, 'leaderSkills');
  assert.equal(saved.leaderSkills.offers.i.cards.length, 2);
  assert.equal(saved.leaderSkills.offers.h.cards.length, 2);
  assert.equal(saved.players[0].hand.length, 1);
  assert.equal(saved.players[1].hand.length, 2);
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.throws(
    () => startPrototypeRoom(db, game.code, 8, 'leader-skills'),
    /redeal/,
  );
  assert.deepEqual(
    db.prepare('SELECT * FROM rooms ORDER BY code').all(),
    rooms,
  );
  assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  assert.deepEqual(
    db.prepare('SELECT * FROM rooms WHERE code = ?').get('KEEPME00'),
    other,
  );
});

void test('Nexus prototype initializes all twelve hidden cards once and preserves unrelated saved state', (t) => {
  const { db } = fixture(t);
  const game = createGame(
    'PROTOTYP',
    newPlayer('i', 'Atreides', 'atreides'),
    true,
  );
  joinGame(game, newPlayer('h', 'Harkonnen', 'harkonnen'));
  game.players.forEach((player) => {
    player.ready = true;
  });
  db.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(
    JSON.stringify(game),
    game.code,
  );
  const seats = db.prepare('SELECT * FROM seats').all();
  const other = db
    .prepare('SELECT * FROM rooms WHERE code = ?')
    .get('KEEPME00');
  startPrototypeRoom(db, game.code, 7, 'nexus');
  const saved = JSON.parse(
    db.prepare('SELECT state FROM rooms WHERE code = ?').get(game.code)!
      .state as string,
  ) as Game;
  assert.equal(saved.version, 8);
  assert.equal(saved.status, 'setup');
  assert.equal(saved.nexusCards!.cards!.deck.length, 12);
  assert.equal(new Set(saved.nexusCards!.cards!.deck).size, 12);
  for (const player of saved.players) {
    const view = viewGame(saved, player.id);
    assert.equal(view.nexusCards!.card, null);
    assert.equal(view.nexusCards!.deckCount, 12);
    assert.equal('deck' in view.nexusCards!, false);
  }
  const rows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.throws(() => startPrototypeRoom(db, game.code, 7, 'nexus'), /changed/);
  assert.throws(() => startPrototypeRoom(db, game.code, 8, 'nexus'));
  assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), rows);
  assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  assert.deepEqual(
    db.prepare('SELECT * FROM rooms WHERE code = ?').get('KEEPME00'),
    other,
  );
});

void test('Moritani assassination preview starts only the fresh opted-in Advanced profile and preserves seats', (t) => {
  const {db}=fixture(t);
  const game=createGame('PROTOTYP',newPlayer('i','Moritani','moritani'),true,['ecaz']);
  joinGame(game,newPlayer('g','Guild','guild'));for(const p of game.players)p.ready=true;
  db.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game),game.code);
  const seats=db.prepare('SELECT * FROM seats').all(),other=db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00');
  startPrototypeRoom(db,game.code,7,'moritani-assassinate');
  const saved=JSON.parse(db.prepare('SELECT state FROM rooms WHERE code=?').get(game.code)!.state as string) as Game;
  assert.equal(saved.status,'setup');assert.equal(saved.version,8);assert.equal(saved.advanced,true);
  assert.equal(saved.moritaniAssassinatePreview,true);assert.equal(saved.moritaniAssassinate!.owner,'i');
  assert.deepEqual(saved.moritaniAssassinate!.opportunities,[]);assert.deepEqual(saved.moritaniAssassinateCallEvents,[]);
  for(const p of saved.players)assert.equal('moritaniAssassinatePreview' in viewGame(saved,p.id),false);
  const rows=db.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.throws(()=>startPrototypeRoom(db,game.code,7,'moritani-assassinate'));
  assert.throws(()=>startPrototypeRoom(db,game.code,8,'moritani-assassinate'));
  assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(),rows);
  assert.deepEqual(db.prepare('SELECT * FROM seats').all(),seats);assert.deepEqual(db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00'),other);
});
