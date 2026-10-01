import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyAction,
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
import { NEXUS_FACTIONS } from '../game/nexus-cards';

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

void test('Semuta development profile begins only a fresh Richese lobby without changing saved seats', (t) => {
  const { db } = fixture(t);
  const game = createGame('PROTOTYP', newPlayer('r', 'Richese', 'richese'), false, ['choam']);
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  for (const p of game.players) p.ready = true;
  db.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game), game.code);
  const seats = db.prepare('SELECT * FROM seats').all();
  const other = db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00');
  const result = startPrototypeRoom(db, game.code, 7, 'semuta');
  const saved = JSON.parse(db.prepare('SELECT state FROM rooms WHERE code=?').get(game.code)!.state as string) as Game;
  assert.equal(result.status, 'setup');
  assert.equal(saved.semutaPreview, true);
  assert.ok(saved.richeseCache?.some(card => card.id === 'richese-semuta-drug'));
  const rows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.throws(() => startPrototypeRoom(db, game.code, 7, 'semuta'));
  assert.throws(() => startPrototypeRoom(db, game.code, 8, 'semuta'));
  assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), rows);
  assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  assert.deepEqual(db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00'), other);
});

void test('Kull preview starts a fresh ready CHOAM lobby once and preserves other rooms and seats', (t) => {
  const { db } = fixture(t);
  const game = createGame('PROTOTYP', newPlayer('c', 'CHOAM', 'choam'), false, ['choam', 'ix']);
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  for (const p of game.players) p.ready = true;
  db.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game), game.code);
  const seats = db.prepare('SELECT * FROM seats').all();
  const other = db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00');
  const result = startPrototypeRoom(db, game.code, 7, 'kull');
  const saved = JSON.parse(db.prepare('SELECT state FROM rooms WHERE code=?').get(game.code)!.state as string) as Game;
  assert.equal(result.status, 'setup');
  assert.equal(saved.kullPreview, true);
  const cards = [...saved.deck, ...saved.players.flatMap(p => p.hand), ...(saved.ixSetupCards ?? [])];
  assert.equal(cards.filter(card => card.id === 'ix-kull-wahad').length, 1);
  const rows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.throws(() => startPrototypeRoom(db, game.code, 7, 'kull'));
  assert.throws(() => startPrototypeRoom(db, game.code, 8, 'kull'));
  assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), rows);
  assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  assert.deepEqual(db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00'), other);
});

void test('Richese Betrayal profile initializes one fresh paired Nexus game and preserves seats and other saves', (t) => {
  const { db } = fixture(t);
  const game = createGame('PROTOTYP', newPlayer('r', 'Richese', 'richese'), false, ['choam']);
  joinGame(game, newPlayer('c', 'CHOAM', 'choam'));
  for (const p of game.players) p.ready = true;
  db.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game), game.code);
  const seats = db.prepare('SELECT * FROM seats').all();
  const other = db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00');
  const result = startPrototypeRoom(db, game.code, 7, 'richese-betrayal');
  const saved = JSON.parse(db.prepare('SELECT state FROM rooms WHERE code=?').get(game.code)!.state as string) as Game;
  assert.equal(result.status, 'setup');
  assert.equal(saved.richeseBetrayalPreview, true);
  assert.equal(saved.nexusCards!.cards!.deck.length, 12);
  assert.equal(new Set(saved.nexusCards!.cards!.deck).size, 12);
  assert.equal(saved.richeseCache?.length, 10);
  const rows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.throws(() => startPrototypeRoom(db, game.code, 7, 'richese-betrayal'));
  assert.throws(() => startPrototypeRoom(db, game.code, 8, 'richese-betrayal'));
  assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), rows);
  assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  assert.deepEqual(db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00'), other);
});

for (const advanced of [false, true]) {
  void test(`Nexus Kull ${advanced ? 'Advanced' : 'Basic'} entry preserves canonical inventories and cannot redeal a saved game`, (t) => {
    const { db } = fixture(t);
    const game = createGame('PROTOTYP', newPlayer('c', 'CHOAM', 'choam'), advanced, ['choam', 'ix']);
    joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
    for (const p of game.players) p.ready = true;
    db.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game), game.code);
    const seats = db.prepare('SELECT * FROM seats').all();
    const other = db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00');
    startPrototypeRoom(db, game.code, 7, 'nexus-kull');
    const saved = JSON.parse(db.prepare('SELECT state FROM rooms WHERE code=?').get(game.code)!.state as string) as Game;
    assert.equal(saved.status, 'setup');
    assert.equal(saved.nexusKullPreview, true);
    assert.equal(saved.kullPreview, true);
    assert.deepEqual([...saved.nexusCards!.cards!.deck].sort((a,b) => a.localeCompare(b)),
      [...NEXUS_FACTIONS].sort((a,b) => a.localeCompare(b)));
    const cards = [...saved.deck, ...saved.players.flatMap(p => p.hand), ...(saved.ixSetupCards ?? [])];
    assert.equal(cards.filter(card => card.id === 'ix-kull-wahad').length, 1);
    const rows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
    assert.throws(() => startPrototypeRoom(db, game.code, 7, 'nexus-kull'));
    assert.throws(() => startPrototypeRoom(db, game.code, 8, 'nexus-kull'));
    assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), rows);
    assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
    assert.deepEqual(db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00'), other);
  });
}

for (const advanced of [false, true]) {
  for (const homeworlds of [false, true]) {
    void test(`Guild Betrayal ${advanced ? 'Advanced' : 'Basic'} ${homeworlds ? 'Homeworld' : 'base'} entry preserves explicit modules and rejects redealing without touching other saves`, (t) => {
      const { db } = fixture(t);
      let game = createGame('PROTOTYP', newPlayer('g', 'Guild', 'guild'), advanced);
      joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
      if (homeworlds)
        game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
      for (const p of game.players) p.ready = true;
      db.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game), game.code);
      db.prepare('UPDATE seats SET player_id=? WHERE room_code=?').run('g', game.code);
      db.prepare('INSERT INTO seats VALUES(?,?,?)').run(game.code, 'e', 'unchanged-emperor-session');
      const seats = db.prepare('SELECT * FROM seats').all();
      const other = db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00');
      const result = startPrototypeRoom(db, game.code, 7, 'guild-betrayal');
      const saved = JSON.parse(db.prepare('SELECT state FROM rooms WHERE code=?').get(game.code)!.state as string) as Game;
      assert.equal(result.version, 8);
      assert.equal(saved.status, 'setup');
      assert.equal(saved.guildBetrayalPreview, true);
      assert.equal(!!saved.homeworlds, homeworlds);
      assert.deepEqual([...saved.nexusCards!.cards!.deck].sort((a,b) => a.localeCompare(b)),
        [...NEXUS_FACTIONS].sort((a,b) => a.localeCompare(b)));
      assert.deepEqual(saved.expansions, []);
      for (const p of game.players)
        assert.equal(saved.players.find(seat => seat.id === p.id)!.name, p.name);
      const rows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
      assert.throws(() => startPrototypeRoom(db, game.code, 7, 'guild-betrayal'));
      assert.throws(() => startPrototypeRoom(db, game.code, 8, 'guild-betrayal'));
      assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), rows);
      assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
      assert.deepEqual(db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00'), other);
    });
  }
}

for (const advanced of [false, true]) {
  void test(`Ixian Nexus replacement ${advanced ? 'Advanced' : 'Basic'} starts only the exact fresh classic lobby without changing seats or native options`, t => {
    const { db } = fixture(t);
    const game = createGame('PROTOTYP', newPlayer('i', 'Atreides', 'atreides'), advanced);
    joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
    for (const p of game.players) p.ready = true;
    db.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game), game.code);
    const seats = db.prepare('SELECT * FROM seats').all();
    const other = db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00');
    const lobbyRows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
    assert.throws(() => startPrototypeRoom(db, game.code, 6, 'ixian-replacement'));
    assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), lobbyRows);
    const result = startPrototypeRoom(db, game.code, 7, 'ixian-replacement');
    const saved = JSON.parse(db.prepare('SELECT state FROM rooms WHERE code=?').get(game.code)!.state as string) as Game;
    assert.equal(result.version, 8);
    assert.equal(saved.status, 'setup');
    assert.equal(saved.code, game.code);
    assert.equal(saved.host, game.host);
    assert.equal(saved.advanced, advanced);
    assert.deepEqual(saved.expansions, game.expansions);
    assert.deepEqual(saved.playerPositions, game.playerPositions);
    assert.deepEqual(saved.players.map(p => [p.id, p.name, p.faction]),
      game.players.map(p => [p.id, p.name, p.faction]));
    assert.equal(saved.nexusIxianReplacementPreview, true);
    assert.deepEqual([...saved.nexusCards!.cards!.deck].sort(), [...NEXUS_FACTIONS].sort());
    for (const p of saved.players) {
      const view = viewGame(saved, p.id);
      assert.equal(view.nexusIxianReplacementPreview, true);
      assert.equal(view.nexusCards!.card, null);
      assert.equal(Object.hasOwn(view.nexusCards!, 'deck'), false);
    }
    const startedRows = db.prepare('SELECT * FROM rooms ORDER BY code').all();
    assert.throws(() => startPrototypeRoom(db, game.code, 8, 'ixian-replacement'));
    assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), startedRows);
    assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
    assert.deepEqual(db.prepare('SELECT * FROM rooms WHERE code=?').get('KEEPME00'), other);
  });
}

void test('Ixian Nexus replacement rejects unready, expansion, native Ixian and Homeworld lobbies without reconfiguring them', t => {
  const { db } = fixture(t);
  const classic = createGame('PROTOTYP', newPlayer('i', 'Atreides', 'atreides'), true);
  joinGame(classic, newPlayer('e', 'Emperor', 'emperor'));
  for (const p of classic.players) p.ready = true;
  const unready = structuredClone(classic);
  unready.players[0].ready = false;
  const expansion = structuredClone(classic);
  expansion.expansions = ['ix'];
  const native = createGame('PROTOTYP', newPlayer('i', 'Ixians', 'ixians'), true, ['ix']);
  joinGame(native, newPlayer('e', 'Emperor', 'emperor'));
  for (const p of native.players) p.ready = true;
  const homeworld = applyAction(classic, classic.host, { type: 'homeworlds', enabled: true });
  for (const p of homeworld.players) p.ready = true;
  for (const game of [unready, expansion, native, homeworld]) {
    db.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(game), game.code);
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY code').all();
    const seats = db.prepare('SELECT * FROM seats').all();
    assert.throws(() => startPrototypeRoom(db, game.code, 7, 'ixian-replacement'));
    assert.deepEqual(db.prepare('SELECT * FROM rooms ORDER BY code').all(), rooms);
    assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  }
});

void test('Ixian replacement CLI takes a private exact-version backup before starting and cannot overwrite a started game or prior proof', t => {
  const directory = mkdtempSync(join(tmpdir(), 'dune-ixian-replacement-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const database = join(directory, 'rooms.sqlite');
  const db = new DatabaseSync(database);
  db.exec('CREATE TABLE rooms(code TEXT PRIMARY KEY,state TEXT,version INTEGER,updated_at INTEGER); CREATE TABLE seats(room_code TEXT,player_id TEXT,token_hash TEXT);');
  const game = createGame('PROTOTYP', newPlayer('a', 'Atreides', 'atreides'), true);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  for (const p of game.players) p.ready = true;
  db.prepare('INSERT INTO rooms VALUES(?,?,?,?)').run(game.code, JSON.stringify(game), 7, 100);
  const other = structuredClone(game);
  other.code = 'KEEPGAME';
  db.prepare('INSERT INTO rooms VALUES(?,?,?,?)').run(other.code, JSON.stringify(other), 9, 50);
  startPrototypeRoom(db, other.code, 9, 'ixian-replacement');
  for (const p of game.players)
    db.prepare('INSERT INTO seats VALUES(?,?,?)').run(game.code, p.id, 'isolated-test-' + p.id);
  const before = db.prepare('SELECT * FROM rooms ORDER BY code').all();
  const seats = db.prepare('SELECT * FROM seats ORDER BY player_id').all();
  db.close();
  const output = join(directory, 'private-proof');
  const invoke = (version: number, out: string) => spawnSync(process.execPath, [
    '--import', 'tsx', fileURLToPath(new URL('../tools/start-prototype.ts', import.meta.url)),
    '--profile', 'ixian-replacement', '--db', database, '--room', game.code,
    '--version', String(version), '--out', out,
  ], { encoding: 'utf8', timeout: 120000 });
  const started = invoke(7, output);
  assert.equal(started.status, 0, started.stderr);
  assert.equal(statSync(output).mode & 0o777, 0o700);
  for (const name of ['games.sqlite', 'snapshot.json', 'prototype.json'])
    assert.equal(statSync(join(output, name)).mode & 0o777, 0o600);
  const backup = new DatabaseSync(join(output, 'games.sqlite'), { readOnly: true });
  assert.deepEqual(backup.prepare('SELECT * FROM rooms ORDER BY code').all(), before);
  assert.deepEqual(backup.prepare('SELECT * FROM seats ORDER BY player_id').all(), seats);
  backup.close();
  const current = new DatabaseSync(database, { readOnly: true });
  t.after(() => current.close());
  const after = current.prepare('SELECT * FROM rooms ORDER BY code').all();
  assert.deepEqual(current.prepare('SELECT * FROM rooms WHERE code=?').get(other.code), before.find(row => row.code === other.code));
  assert.deepEqual(current.prepare('SELECT * FROM seats ORDER BY player_id').all(), seats);
  const savedRow = current.prepare('SELECT state,version FROM rooms WHERE code=?').get(game.code)!;
  assert.equal(savedRow.version, 8);
  const saved = JSON.parse(savedRow.state as string) as Game;
  assert.equal(saved.nexusIxianReplacementPreview, true);
  assert.equal(saved.status, 'setup');
  assert.equal(saved.advanced, game.advanced);
  assert.deepEqual(saved.playerPositions, game.playerPositions);
  assert.deepEqual(saved.players.map(p => [p.id,p.name,p.faction]), game.players.map(p => [p.id,p.name,p.faction]));
  assert.notEqual(invoke(8, output).status, 0, 'existing proof directory cannot be reused');
  assert.notEqual(invoke(7, join(directory, 'stale-proof')).status, 0, 'stale backup version cannot be admitted');
  assert.notEqual(invoke(8, join(directory, 'redeal-proof')).status, 0, 'current version cannot redeal a started game');
  assert.deepEqual(current.prepare('SELECT * FROM rooms ORDER BY code').all(), after);
  assert.deepEqual(current.prepare('SELECT * FROM seats ORDER BY player_id').all(), seats);
});
