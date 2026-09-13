import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { viewGame, type Action, type Game } from "../game/engine";
import type { RoomsClock } from "../db/rooms";
import { unitStore } from "./fixture-nexus-room-store";
import { harassCustody, harassWithdrawGame } from "./fixture-harass-withdraw";

const clock: RoomsClock = { now: () => 83000, sleep: async () => {} };
const rows = (sqlite: DatabaseSync) => ({
  rooms: sqlite.prepare("SELECT * FROM rooms ORDER BY code").all(),
  seats: sqlite.prepare("SELECT * FROM seats ORDER BY player_id").all(),
});

async function fixture(t: test.TestContext, advanced: boolean) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom(
    "Ecaz battle recovery",
    "emperor",
    advanced,
    ["ix"],
  );
  const code = made.view.code;
  const tokens = [
    made.token,
    (await store.rooms.joinRoom(code, "Atreides", "atreides")).token!,
    (await store.rooms.joinRoom(code, "Tleilaxu", "tleilaxu")).token!,
  ];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((auth) => auth.playerId) as [string, string, string];
  const game = harassWithdrawGame({
    advanced,
    ids,
    factions: ["emperor", "atreides", "tleilaxu"],
    prepare: false,
  });
  game.code = code;
  game.version = (await store.rooms.readRoom(code)).version;
  harassCustody(game);
  store.sqlite
    .prepare("UPDATE rooms SET state=?, version=? WHERE code=?")
    .run(JSON.stringify(game), game.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function act(f: Fixture, player: string, action: Action) {
  const rooms = f.restart();
  const index = f.ids.indexOf(player);
  assert.ok(index >= 0);
  const auth = await rooms.authenticate(f.code, f.tokens[index]);
  const before = await rooms.readRoom(f.code);
  await rooms.act(f.code, auth, before.version, action, clock);
  const after = await rooms.readRoom(f.code);
  harassCustody(after);
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
      for (const field of ["hand", "traitors", "spice", "faceDancers"])
        assert.equal(field in rival, false);
  }
  assert.deepEqual(rows(f.sqlite), before);
  harassCustody(game);
  return game;
}

async function declineFullPlanOffer(f: Fixture) {
  const game = await f.restart().readRoom(f.code);
  if (game.decision?.kind === "fullPlanOffer")
    await act(f, game.decision.player, { type: "decision", decline: true });
}

void test("sealed Harass plan and category-null Prescience survive authenticated private restoration", async (t) => {
  for (const advanced of [false, true]) {
    const f = await fixture(t, advanced);
    await act(f, f.ids[1], { type: "prescience", field: "weapon" });
    await act(f, f.ids[0], { type: "prescienceAnswer", value: null });
    await declineFullPlanOffer(f);
    const sealed = await act(f, f.ids[0], {
      type: "battlePlan",
      dial: 1,
      support: 0,
      leader: "emperor-0",
      weapon: "ecaz-harass-withdraw",
      defense: null,
    });
    assert.equal(sealed.battle?.plans[f.ids[0]].weapon, "ecaz-harass-withdraw");
    assert.equal(sealed.battle?.prescience?.value, null);

    const restoredGame = await restored(f);
    const atreides = viewGame(restoredGame, f.ids[1]).battle!;
    assert.deepEqual(atreides.insight, {
      field: "weapon",
      value: null,
      label: "None",
    });
    assert.deepEqual(atreides.plans, {});
    const observer = viewGame(restoredGame, f.ids[2]).battle!;
    assert.equal(observer.insight, null);
    assert.deepEqual(observer.plans, {});
    assert.deepEqual(observer.cards, []);
    assert.equal(
      JSON.stringify(observer).includes("ecaz-harass-withdraw"),
      false,
    );
  }
});

void test("competing final traitor declines resolve one withdrawal and one discard after restart", async (t) => {
  for (const advanced of [false, true]) {
    const f = await fixture(t, advanced);
    const seatRows = rows(f.sqlite).seats;
    await act(f, f.ids[1], { type: "prescience", field: "weapon" });
    await act(f, f.ids[0], { type: "prescienceAnswer", value: null });
    await declineFullPlanOffer(f);
    await act(f, f.ids[0], {
      type: "battlePlan",
      dial: 1,
      support: advanced ? 1 : 0,
      leader: "emperor-0",
      weapon: "ecaz-harass-withdraw",
      defense: null,
    });
    await act(f, f.ids[1], {
      type: "battlePlan",
      dial: 1,
      support: advanced ? 1 : 0,
      leader: "atreides-0",
      weapon: null,
      defense: null,
    });
    await act(f, f.ids[0], { type: "traitorCall", call: false });

    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, f.tokens[1]);
    const before = await rooms.readRoom(f.code);
    const writeStart = f.writes.length;
    let entered = 0;
    let release!: () => void;
    const both = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.hooks.beforeWrite = async () => {
      if (++entered === 2) release();
      await both;
    };
    const attempts = await Promise.allSettled(
      [0, 1].map(() =>
        rooms.act(
          f.code,
          auth,
          before.version,
          { type: "traitorCall", call: false },
          clock,
        ),
      ),
    );
    f.hooks.beforeWrite = undefined;
    assert.equal(
      attempts.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.deepEqual(
      f.writes
        .slice(writeStart)
        .map((write) => write.changes)
        .sort((a, b) => a - b),
      [0, 1],
    );

    const resolved = await restored(f);
    assert.equal(resolved.version, before.version + 1);
    assert.equal(resolved.battle, null);
    assert.equal(resolved.decision?.kind, "faceDance");
    assert.equal(resolved.players[0].reserves, 19);
    assert.equal(resolved.players[0].tanks, 1);
    assert.deepEqual(resolved.players[0].forces, {});
    assert.equal(
      resolved.discard.filter((card) => card.id === "ecaz-harass-withdraw")
        .length,
      1,
    );
    assert.equal(
      resolved.log.filter((entry) =>
        entry.text.includes("used Harass & Withdraw to return 4"),
      ).length,
      1,
    );

    await act(f, f.ids[2], { type: "decision", reveal: false });
    const terminal = await restored(f);
    assert.equal(terminal.battle, null);
    assert.equal(terminal.decision, null);
    assert.equal(terminal.response, null);
    assert.equal(terminal.pendingTreacheryDiscard, null);
    assert.equal(terminal.phase, 7);
    assert.equal(
      terminal.discard.filter((card) => card.id === "ecaz-harass-withdraw")
        .length,
      1,
    );
    assert.deepEqual(rows(f.sqlite).seats, seatRows);
  }
});
