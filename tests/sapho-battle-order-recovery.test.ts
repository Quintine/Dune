import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { viewGame, type Action, type Game } from "../game/engine";
import type { RoomsClock } from "../db/rooms";
import { unitStore } from "./fixture-nexus-room-store";
import {
  chooseSaphoBattleAction,
  nextSaphoBattleAction,
  SAPHO_BATTLE_CARD,
  saphoBattleCustody,
  saphoBattleOrderAction,
  saphoBattleOrderGame,
} from "./fixture-sapho-battle-order";

const clock: RoomsClock = { now: () => 87000, sleep: async () => {} };
const rows = (sqlite: DatabaseSync) => ({
  rooms: sqlite.prepare("SELECT * FROM rooms ORDER BY code").all(),
  seats: sqlite.prepare("SELECT * FROM seats ORDER BY player_id").all(),
});
function barrier() {
  let release!: () => void;
  const both = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = 0;
  return async () => {
    if (++entered === 2) release();
    await both;
  };
}
function unchangedPlayerState(game: Game) {
  return game.players.map(({ hand: _hand, ...player }) => player);
}

async function fixture(
  t: test.TestContext,
  advanced: boolean,
  holderIndex: 0 | 2,
) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom(
    "Sapho battle order recovery",
    "emperor",
    advanced,
    ["choam"],
  );
  const code = made.view.code;
  const tokens = [
    made.token,
    (await store.rooms.joinRoom(code, "Guild", "guild")).token!,
    (await store.rooms.joinRoom(code, "Atreides", "atreides")).token!,
    (await store.rooms.joinRoom(code, "Richese", "richese")).token!,
  ];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((auth) => auth.playerId) as [
    string,
    string,
    string,
    string,
  ];
  const game = saphoBattleOrderGame({
    advanced,
    holder: ids[holderIndex],
    seatIds: ids,
    geometry: "shared",
  });
  game.code = code;
  game.version = (await store.rooms.readRoom(code)).version;
  saphoBattleCustody(game);
  store.sqlite
    .prepare("UPDATE rooms SET state=?, version=? WHERE code=?")
    .run(JSON.stringify(game), game.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, holder: ids[holderIndex] };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function act(f: Fixture, player: string, action: Action) {
  const index = f.ids.indexOf(player);
  assert.ok(index >= 0);
  const rooms = f.restart();
  const auth = await rooms.authenticate(f.code, f.tokens[index]);
  const before = await rooms.readRoom(f.code);
  await rooms.act(f.code, auth, before.version, action, clock);
  const after = await rooms.readRoom(f.code);
  saphoBattleCustody(after);
  return after;
}

async function restored(f: Fixture) {
  const game = await f.restart().readRoom(f.code);
  const before = rows(f.sqlite);
  for (const [index, token] of f.tokens.entries()) {
    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(game, f.ids[index]));
    assert.deepEqual(
      view,
      viewGame(JSON.parse(JSON.stringify(game)) as Game, f.ids[index]),
    );
    for (const rival of view.players.filter((p) => p.id !== auth.playerId))
      for (const field of ["hand", "traitors", "spice", "prediction"])
        assert.equal(field in rival, false);
    if (auth.playerId !== f.holder)
      assert.equal(JSON.stringify(view).includes(SAPHO_BATTLE_CARD), false);
  }
  assert.deepEqual(rows(f.sqlite), before);
  saphoBattleCustody(game);
  return game;
}

async function finishSelectedBattle(f: Fixture) {
  for (let step = 0; step < 120; step++) {
    const game = await f.restart().readRoom(f.code);
    if (
      !game.battle &&
      (game.phase !== 6 || viewGame(game, f.ids[0]).battleOrder?.current)
    )
      return game;
    const next = nextSaphoBattleAction(game);
    assert.ok(next, "The saved battle must retain an owned continuation.");
    await act(f, next.player, next.action);
  }
  assert.fail("The saved battle continuation did not finish.");
}

void test("authenticated first and last claims survive CAS, a defender-owned battle, and the next boundary", async (t) => {
  const cases = [
    { advanced: false, holderIndex: 2 as const, mode: "first" as const },
    { advanced: true, holderIndex: 0 as const, mode: "last" as const },
  ];
  for (const scenario of cases) {
    const f = await fixture(t, scenario.advanced, scenario.holderIndex);
    const before = await restored(f);
    const seatRows = rows(f.sqlite).seats;
    const stable = {
      storm: before.storm,
      order: structuredClone(before.order),
      players: unchangedPlayerState(before),
      deck: structuredClone(before.deck),
      cache: structuredClone(before.richeseCache),
      forces: structuredClone(before.players.map((p) => p.forces)),
    };
    const request = saphoBattleOrderAction(before, f.holder, scenario.mode);
    const writeStart = f.writes.length;
    f.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      f.rooms.act(
        f.code,
        f.auths[scenario.holderIndex],
        before.version,
        request,
        clock,
      ),
      f
        .restart()
        .act(
          f.code,
          f.auths[scenario.holderIndex],
          before.version,
          request,
          clock,
        ),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(
      attempts.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      attempts.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.deepEqual(
      f.writes
        .slice(writeStart)
        .map((write) => write.changes)
        .sort((a, b) => a - b),
      [0, 1],
    );

    const ordered = await restored(f);
    assert.equal(ordered.version, before.version + 1);
    assert.equal(ordered.storm, stable.storm);
    assert.deepEqual(ordered.order, stable.order);
    assert.deepEqual(unchangedPlayerState(ordered), stable.players);
    assert.deepEqual(ordered.deck, stable.deck);
    assert.deepEqual(ordered.richeseCache, stable.cache);
    assert.deepEqual(
      ordered.players.map((p) => p.forces),
      stable.forces,
    );
    assert.equal(
      ordered.discard.filter((card) => card.id === SAPHO_BATTLE_CARD).length,
      1,
    );
    assert.equal(
      ordered.players
        .flatMap((p) => p.hand)
        .filter((card) => card.id === SAPHO_BATTLE_CARD).length,
      0,
    );
    assert.deepEqual(
      ordered.battleOrder?.uses.map((use) => use.mode),
      [scenario.mode],
    );
    assert.equal(
      viewGame(ordered, f.holder).battleOrder?.current,
      ordered.active,
    );

    const choice = chooseSaphoBattleAction(ordered);
    assert.equal(choice.player, ordered.active);
    const selected = viewGame(ordered, choice.player).battleChoices.find(
      (candidate) =>
        candidate.territory === choice.action.territory &&
        [candidate.attacker, candidate.defender].includes(
          String(choice.action.target),
        ),
    );
    assert.ok(selected);
    assert.equal(selected.chooser, choice.player);
    assert.notEqual(selected.attacker, choice.player);
    assert.notEqual(choice.action.target, choice.player);
    assert.equal(choice.action.target, selected.attacker);
    assert.ok(
      [selected.attacker, selected.defender].includes(
        String(choice.action.target),
      ),
    );
    await act(f, choice.player, choice.action);
    const inBattle = await restored(f);
    assert.equal(inBattle.battle?.chooser, choice.player);
    assert.notEqual(inBattle.battle?.attacker, choice.player);
    const battleEvent = inBattle.battle?.event;
    assert.ok(battleEvent);

    const nextBoundary = await finishSelectedBattle(f);
    assert.equal(nextBoundary.phase, 6);
    assert.equal(nextBoundary.battle, null);
    assert.equal(nextBoundary.battleOrder?.uses.length, 1);
    assert.equal(nextBoundary.battleOrder?.uses[0].mode, scenario.mode);
    assert.equal(
      viewGame(nextBoundary, f.holder).battleOrder?.current,
      nextBoundary.active,
    );
    assert.ok(
      viewGame(nextBoundary, f.holder).battleOrder!.remaining.length > 0,
    );
    assert.notEqual(
      viewGame(nextBoundary, f.holder).battleOrder?.event,
      request.event,
    );
    assert.equal(nextBoundary.lastBattleContext?.event, battleEvent);

    const beforeReplay = rows(f.sqlite);
    const replayWrites = f.writes.length;
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.auths[scenario.holderIndex],
          nextBoundary.version,
          request,
          clock,
        ),
    );
    assert.deepEqual(rows(f.sqlite), beforeReplay);
    assert.equal(f.writes.length, replayWrites);
    assert.equal(
      (await f.restart().readRoom(f.code)).discard.filter(
        (card) => card.id === SAPHO_BATTLE_CARD,
      ).length,
      1,
    );
    assert.deepEqual(rows(f.sqlite).seats, seatRows);
  }
});
