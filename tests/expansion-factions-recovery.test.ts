import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import type { Action, Game, GameView } from '../game/engine';
import type * as Rooms from '../db/rooms';
import { startPrototypeRoom } from '../tools/prototype-room';
import { unitStore } from './fixture-nexus-room-store';

const clock: Rooms.RoomsClock = {
  now: () => 12_345,
  sleep: async () => {},
};

const MIXED_ROSTER: readonly FactionId[] = [
  'ixians',
  'tleilaxu',
  'choam',
  'richese',
  'ecaz',
  'moritani',
];

type Store = ReturnType<typeof unitStore>;
type RoomRow = {
  code: string;
  state: string;
  version: number;
  updated_at: number;
};

let receiptSequence = 0;
function entry() {
  receiptSequence++;
  return {
    operationId: `00000000-0000-4000-8000-${receiptSequence
      .toString(16)
      .padStart(12, '0')}`,
    sessionToken: receiptSequence.toString(16).padStart(64, '0'),
  };
}

function roomRow(db: DatabaseSync, code: string): RoomRow {
  const row = db
    .prepare('SELECT code,state,version,updated_at FROM rooms WHERE code = ?')
    .get(code) as RoomRow | undefined;
  assert.ok(row);
  return row;
}

function storageSnapshot(db: DatabaseSync) {
  return {
    rooms: db.prepare('SELECT * FROM rooms ORDER BY code').all(),
    seats: db.prepare('SELECT * FROM seats ORDER BY room_code,player_id').all(),
    receipts: db
      .prepare('SELECT * FROM room_entry_receipts ORDER BY room_code,player_id')
      .all(),
  };
}

async function readyRoom(
  store: Store,
  expansions: string[],
  factions: readonly FactionId[],
  advanced = false,
) {
  const made = await store.rooms.createRoom(
    `${factions[0]} host`,
    factions[0],
    advanced,
    expansions,
    entry(),
  );
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of factions.slice(1)) {
    const joined = await store.rooms.joinRoom(
      code,
      `${faction} seat`,
      faction,
      entry(),
    );
    assert.ok(joined.token);
    tokens.push(joined.token);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  for (const auth of auths) {
    const current = await store.rooms.readRoom(code);
    await store.rooms.act(
      code,
      auth,
      current.version,
      { type: 'ready' },
      clock,
    );
  }
  const source = await store.rooms.readRoom(code);
  const raw = roomRow(store.sqlite, code);
  assert.equal(source.version, raw.version);
  assert.equal((JSON.parse(raw.state) as Game).version, raw.version);
  assert.equal(source.status, 'lobby');
  assert.ok(source.players.every((player) => player.ready));
  return { code, tokens, auths, source };
}

function ownPlayer(view: GameView) {
  return view.players.find((player) => player.id === view.me)!;
}

async function assertPrivateSetupViews(
  rooms: Store['rooms'],
  code: string,
  auths: Rooms.SeatAuth[],
  game: Game,
) {
  const views = await Promise.all(
    auths.map((auth) => rooms.readSeatView(code, auth)),
  );
  for (const [index, view] of views.entries()) {
    const owner = game.players[index];
    assert.equal(view.me, owner.id);
    assert.deepEqual(ownPlayer(view).hand, owner.hand);
    assert.deepEqual(ownPlayer(view).traitors, owner.traitors);
    assert.deepEqual(ownPlayer(view).traitorChoices, owner.traitorChoices);
    assert.deepEqual(ownPlayer(view).faceDancers, owner.faceDancers);
    assert.equal(Object.hasOwn(view, 'deck'), false);
    for (const other of view.players.filter(
      (player) => player.id !== view.me,
    )) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
      assert.equal(other.traitorChoices, undefined);
      assert.equal(other.faceDancers, undefined);
    }
  }

  const richeseIndex = game.players.findIndex(
    (player) => player.faction === 'richese',
  );
  const richese = game.players[richeseIndex];
  if (richese.noField) {
    assert.deepEqual(
      views[richeseIndex].richeseNoField?.private,
      richese.noField,
    );
    const secretIds = richese.noField.tokens.map((token) => token.id);
    for (const [index, view] of views.entries()) {
      if (index === richeseIndex) continue;
      assert.equal(view.richeseNoField?.private, null);
      const projected = JSON.stringify(view);
      for (const id of secretIds) assert.equal(projected.includes(id), false);
    }
  }

  const moritaniIndex = game.players.findIndex(
    (player) => player.faction === 'moritani',
  );
  if (game.moritaniTerror && moritaniIndex >= 0) {
    assert.deepEqual(views[moritaniIndex].moritaniTerror, game.moritaniTerror);
    for (const [index, view] of views.entries()) {
      if (index === moritaniIndex) continue;
      assert.deepEqual(view.moritaniTerror?.tokens, []);
    }
  }

  if (game.ixSetupCards) {
    const ixianIndex = game.players.findIndex(
      (player) => player.faction === 'ixians',
    );
    assert.deepEqual(views[ixianIndex].ixTechnology?.setup, game.ixSetupCards);
    for (const [index, view] of views.entries())
      if (index !== ixianIndex) assert.equal(view.ixTechnology, null);
  }
}

function setupAction(view: GameView): Action | null {
  const copy = structuredClone(view);
  ownPlayer(copy).bot = 'Medium';
  return botActions(copy)[0] ?? null;
}

async function finishPersistedSetup(
  store: Store,
  code: string,
  auths: Rooms.SeatAuth[],
) {
  let sawPrivateIxChoice = false;
  for (let step = 0; step < 64; step++) {
    const game = await store.restart().readRoom(code);
    const raw = roomRow(store.sqlite, code);
    assert.equal(game.version, raw.version);
    assert.equal((JSON.parse(raw.state) as Game).version, raw.version);
    await assertPrivateSetupViews(store.restart(), code, auths, game);
    if (game.ixSetupCards) sawPrivateIxChoice = true;
    if (game.status === 'playing') return { game, sawPrivateIxChoice };

    let progressed = false;
    for (const auth of auths) {
      const rooms = store.restart();
      const view = await rooms.readSeatView(code, auth);
      const action = setupAction(view);
      if (!action) continue;
      await rooms.act(code, auth, view.version, action, clock);
      progressed = true;
      break;
    }
    assert.ok(
      progressed,
      `Persisted faction setup stalled at ${game.setupStage}/${game.decision?.kind ?? 'no decision'}.`,
    );
  }
  assert.fail('Persisted faction setup exceeded its bounded action count.');
}

void test('faction prototype preserves room entry state and completes a private mixed setup after reloads', async (t) => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const main = await readyRoom(
    store,
    ['ix', 'choam', 'ecaz'],
    MIXED_ROSTER,
    true,
  );
  const neighbor = await store.rooms.createRoom(
    'Unchanged neighboring room',
    'atreides',
    false,
    [],
    entry(),
  );
  const neighborRow = roomRow(store.sqlite, neighbor.view.code);
  const seatsBefore = storageSnapshot(store.sqlite).seats;
  const receiptsBefore = storageSnapshot(store.sqlite).receipts;

  const started = startPrototypeRoom(
    store.sqlite,
    main.code,
    main.source.version,
    'factions',
  );
  assert.equal(started.version, main.source.version + 1);
  assert.equal(started.status, 'setup');
  assert.equal(started.players, 6);
  const startedRow = roomRow(store.sqlite, main.code);
  assert.equal(startedRow.version, started.version);
  assert.equal((JSON.parse(startedRow.state) as Game).version, started.version);
  assert.deepEqual(storageSnapshot(store.sqlite).seats, seatsBefore);
  assert.deepEqual(storageSnapshot(store.sqlite).receipts, receiptsBefore);
  assert.deepEqual(roomRow(store.sqlite, neighbor.view.code), neighborRow);

  const { game, sawPrivateIxChoice } = await finishPersistedSetup(
    store,
    main.code,
    main.auths,
  );
  assert.equal(sawPrivateIxChoice, true);
  assert.equal(game.status, 'playing');
  assert.deepEqual(game.expansions, ['ix', 'choam', 'ecaz']);
  assert.equal(game.setupStage, undefined);
  assert.equal(game.ixSetupCards, null);
  assert.equal(game.richeseCache?.length, 10);
  assert.equal(game.richeseRemoved?.length, 0);
  assert.equal(game.ecazAmbassadors?.tokens.length, 11);
  assert.equal(game.ecazAmbassadors?.cohort.length, 5);
  assert.equal(game.moritaniTerror?.tokens.length, 6);
  assert.equal(game.dukeVidal?.leader.id, 'duke-vidal');
  assert.equal(
    game.players.find((player) => player.faction === 'tleilaxu')?.faceDancers
      ?.length,
    3,
  );
  const ecaz = game.players.find((player) => player.faction === 'ecaz')!;
  assert.equal(ecaz.reserves, 14);
  assert.equal(
    Object.entries(ecaz.forces)
      .filter(([key]) => key.startsWith('imperial_basin:'))
      .reduce((sum, [, amount]) => sum + amount, 0),
    6,
  );
  const expectedDeck = treacheryDeck(['ix', 'choam', 'ecaz']);
  const heldDeck = [
    ...game.deck,
    ...game.players.flatMap((player) => player.hand),
  ];
  assert.equal(expectedDeck.length, 47);
  assert.equal(heldDeck.length, 47);
  assert.deepEqual(
    heldDeck.map((card) => card.id).sort(),
    expectedDeck.map((card) => card.id).sort(),
  );
  assert.deepEqual(storageSnapshot(store.sqlite).seats, seatsBefore);
  assert.deepEqual(storageSnapshot(store.sqlite).receipts, receiptsBefore);
  assert.deepEqual(roomRow(store.sqlite, neighbor.view.code), neighborRow);
});

void test('faction prototype rejects stale, wrong-profile, optional-module and redeal starts without writes', async (t) => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const main = await readyRoom(store, ['choam', 'ecaz'], ['choam', 'ecaz']);

  let before = storageSnapshot(store.sqlite);
  assert.throws(
    () =>
      startPrototypeRoom(
        store.sqlite,
        main.code,
        main.source.version - 1,
        'factions',
      ),
    /missing or changed/,
  );
  assert.deepEqual(storageSnapshot(store.sqlite), before);

  assert.throws(
    () =>
      startPrototypeRoom(store.sqlite, main.code, main.source.version, 'ix'),
    /requires exactly/,
  );
  assert.deepEqual(storageSnapshot(store.sqlite), before);

  const unsupported = await readyRoom(store, ['ecaz'], ['ecaz', 'atreides']);
  const unsupportedRow = roomRow(store.sqlite, unsupported.code);
  const unsupportedState = JSON.parse(unsupportedRow.state) as Game;
  unsupportedState.discoveryEnabled = true;
  store.sqlite
    .prepare('UPDATE rooms SET state = ? WHERE code = ?')
    .run(JSON.stringify(unsupportedState), unsupported.code);
  before = storageSnapshot(store.sqlite);
  assert.throws(
    () =>
      startPrototypeRoom(
        store.sqlite,
        unsupported.code,
        unsupported.source.version,
        'factions',
      ),
    /excludes optional modules/,
  );
  assert.deepEqual(storageSnapshot(store.sqlite), before);

  const result = startPrototypeRoom(
    store.sqlite,
    main.code,
    main.source.version,
    'factions',
  );
  before = storageSnapshot(store.sqlite);
  assert.throws(
    () =>
      startPrototypeRoom(store.sqlite, main.code, result.version, 'factions'),
    /fresh lobby|overwrite|redeal/,
  );
  assert.deepEqual(storageSnapshot(store.sqlite), before);
});

void test('faction prototype start CAS preserves a concurrent fresh-lobby winner', async (t) => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const main = await readyRoom(store, ['ecaz'], ['ecaz', 'atreides']);
  const seatsBefore = storageSnapshot(store.sqlite).seats;
  const receiptsBefore = storageSnapshot(store.sqlite).receipts;
  let raced = false;
  const racing = {
    prepare(sql: string) {
      const statement = store.sqlite.prepare(sql);
      if (!sql.startsWith('UPDATE rooms SET state = ?, version = ?'))
        return statement;
      return {
        run: (...values: (string | number | null)[]) => {
          if (!raced) {
            raced = true;
            const current = roomRow(store.sqlite, main.code);
            const winner = JSON.parse(current.state) as Game;
            winner.version = current.version + 1;
            winner.log.push({
              seq: (winner.log.at(-1)?.seq ?? 0) + 1,
              text: 'Concurrent fresh-lobby edit won the version fence.',
            });
            store.sqlite
              .prepare(
                'UPDATE rooms SET state = ?, version = ?, updated_at = ? WHERE code = ?',
              )
              .run(
                JSON.stringify(winner),
                winner.version,
                current.updated_at + 1,
                main.code,
              );
          }
          return statement.run(...values);
        },
      };
    },
  } as unknown as DatabaseSync;

  assert.throws(
    () =>
      startPrototypeRoom(racing, main.code, main.source.version, 'factions'),
    /changed during setup/,
  );
  assert.equal(raced, true);
  const saved = roomRow(store.sqlite, main.code);
  const winner = JSON.parse(saved.state) as Game;
  assert.equal(saved.version, main.source.version + 1);
  assert.equal(winner.version, saved.version);
  assert.equal(winner.status, 'lobby');
  assert.equal(winner.setupStage, undefined);
  assert.match(winner.log.at(-1)!.text, /Concurrent fresh-lobby edit/);
  assert.deepEqual(storageSnapshot(store.sqlite).seats, seatsBefore);
  assert.deepEqual(storageSnapshot(store.sqlite).receipts, receiptsBefore);
});
