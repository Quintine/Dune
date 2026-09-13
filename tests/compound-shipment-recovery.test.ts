import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { RoomsClock } from "../db/rooms";
import { viewGame, type Action, type Game } from "../game/engine";
import type { ShipmentExpression } from "../game/shipment-promises";
import {
  askCompoundShipment,
  compoundShipmentCustody,
  compoundShipmentGame,
} from "./fixture-compound-shipment";
import { unitStore } from "./fixture-nexus-room-store";

const clock: RoomsClock = { now: () => 10_000, sleep: async () => {} };
const expression: ShipmentExpression = {
  op: "or",
  terms: [
    { territory: "carthag", minimum: 6 },
    { territory: "arrakeen", minimum: 4 },
  ],
};
const qualifying: Action = {
  type: "ship",
  territory: "arrakeen",
  sector: 10,
  amount: 4,
};
const contradictsYes: Action = {
  type: "ship",
  territory: "arrakeen",
  sector: 10,
  amount: 3,
};
const contradictsNo: Action = {
  type: "ship",
  territory: "carthag",
  sector: 11,
  amount: 6,
};

async function persistedQuestion(advanced: boolean) {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  const made = await store.rooms.createRoom(
    "Compound shipment SQL",
    "emperor",
    advanced,
    [],
  );
  const code = made.view.code;
  const joined = [
    await store.rooms.joinRoom(code, "Atreides asker", "atreides"),
    await store.rooms.joinRoom(code, "Harkonnen observer", "harkonnen"),
  ];
  const tokens = [made.token, ...joined.map((seat) => seat.token!)];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((auth) => auth.playerId) as [string, string, string];
  const lobby = await store.rooms.readRoom(code);
  const question = askCompoundShipment(
    compoundShipmentGame(advanced, ids),
    expression,
  );
  question.code = code;
  question.version = lobby.version;
  sqlite
    .prepare("UPDATE rooms SET state = ?, version = ? WHERE code = ?")
    .run(JSON.stringify(question), question.version, code);
  store.writes.length = 0;
  return { ...store, code, auths, ids, tokens, question };
}

async function rejectsWithoutWrite(
  fixture: Awaited<ReturnType<typeof persistedQuestion>>,
  action: Action,
  pattern: RegExp,
) {
  const before = await fixture.restart().readRoom(fixture.code);
  const writes = fixture.writes.length;
  await assert.rejects(
    fixture
      .restart()
      .act(fixture.code, fixture.auths[0], before.version, action, clock),
    pattern,
  );
  assert.deepEqual(await fixture.restart().readRoom(fixture.code), before);
  assert.equal(fixture.writes.length, writes);
}

function assertSingleCompoundPromise(g: Game, answer: boolean) {
  assert.equal(g.shipmentPromises?.length, 1);
  assert.deepEqual(g.shipmentPromises![0].claim, expression);
  assert.equal(g.shipmentPromises![0].answer, answer);
  assert.equal(Object.hasOwn(g.shipmentPromises![0], "territory"), false);
  assert.equal(Object.hasOwn(g.shipmentPromises![0], "minimum"), false);
  assert.equal(g.truthHistory?.length, 1);
  assert.deepEqual(g.truthHistory![0].question, {
    kind: "shipment",
    target: g.players[0].id,
    claim: expression,
  });
}

async function assertPrivateRestore(
  fixture: Awaited<ReturnType<typeof persistedQuestion>>,
  answers: boolean,
  completion: boolean,
) {
  const state = await fixture.restart().readRoom(fixture.code);
  for (const index of fixture.auths.keys()) {
    const rooms = fixture.restart();
    const restored = await rooms.authenticate(
      fixture.code,
      fixture.tokens[index],
    );
    const view = await rooms.readSeatView(fixture.code, restored);
    assert.deepEqual(view, viewGame(state, fixture.ids[index]));
    assert.deepEqual(
      view.truthShipmentAnswers,
      index === 0 && answers ? ["yes", "no"] : null,
    );
    assert.equal(!!view.shipmentCompletion, index === 0 && completion);
    assert.equal(
      JSON.stringify(view).includes("truthShipmentCompletion"),
      false,
    );
    for (const player of view.players)
      if (player.id !== fixture.ids[index])
        assert.equal("hand" in player, false);
  }
}

function concurrentGate() {
  let arrivals = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    wait: async () => {
      if (++arrivals === 2) release();
      await waiting;
    },
    release,
    arrivals: () => arrivals,
  };
}

for (const advanced of [false, true])
  void test(`${advanced ? "Advanced" : "Basic"} restored compound Yes honors the second OR branch and duplicate shipment commits once`, async () => {
    const f = await persistedQuestion(advanced);
    try {
      await assertPrivateRestore(f, true, false);
      const pending = await f.restart().readRoom(f.code);
      await f
        .restart()
        .act(
          f.code,
          f.auths[0],
          pending.version,
          { type: "truthAnswer", answer: "yes" },
          clock,
        );
      const accepted = await f.restart().readRoom(f.code);
      assertSingleCompoundPromise(accepted, true);
      assert.equal(accepted.shipmentPromises![0].fulfilled, undefined);
      await assertPrivateRestore(f, false, true);
      await rejectsWithoutWrite(f, contradictsYes, /Truthtrance|promise/i);

      f.writes.length = 0;
      const gate = concurrentGate();
      f.hooks.beforeWrite = gate.wait;
      const timer = setTimeout(gate.release, 2_000);
      let outcomes: PromiseSettledResult<unknown>[];
      try {
        outcomes = await Promise.allSettled(
          [qualifying, qualifying].map((action) =>
            f
              .restart()
              .act(f.code, f.auths[0], accepted.version, action, clock),
          ),
        );
      } finally {
        clearTimeout(timer);
        delete f.hooks.beforeWrite;
      }
      assert.equal(gate.arrivals(), 2);
      assert.equal(
        outcomes.filter((outcome) => outcome.status === "fulfilled").length,
        1,
      );
      assert.deepEqual(
        f.writes.map((write) => write.changes).sort((a, b) => a - b),
        [0, 1],
      );
      const done = await f.restart().readRoom(f.code);
      assert.equal(done.version, accepted.version + 1);
      assertSingleCompoundPromise(done, true);
      assert.equal(done.shipmentPromises![0].fulfilled, true);
      assert.equal(done.players[0].forces["arrakeen:10"], 4);
      assert.equal(done.players[0].reserves, 16);
      assert.equal(done.players[0].spice, 16);
      assert.equal(done.players[0].shipped, true);
      assert.equal(
        done.discard.filter((card) => card.effect === "truthtrance").length,
        1,
      );
      compoundShipmentCustody(done);
      await assertPrivateRestore(f, false, false);
    } finally {
      delete f.hooks.beforeWrite;
      f.sqlite.close();
    }
  });

for (const advanced of [false, true])
  void test(`${advanced ? "Advanced" : "Basic"} restored compound No rejects a matching shipment and permits a shipment skip`, async () => {
    const f = await persistedQuestion(advanced);
    try {
      const pending = await f.restart().readRoom(f.code);
      await f
        .restart()
        .act(
          f.code,
          f.auths[0],
          pending.version,
          { type: "truthAnswer", answer: "no" },
          clock,
        );
      const accepted = await f.restart().readRoom(f.code);
      assertSingleCompoundPromise(accepted, false);
      await assertPrivateRestore(f, false, false);
      await rejectsWithoutWrite(f, contradictsNo, /Truthtrance|promise/i);
      const beforeSkip = await f.restart().readRoom(f.code);
      await f
        .restart()
        .act(
          f.code,
          f.auths[0],
          beforeSkip.version,
          { type: "endMovement" },
          clock,
        );
      const skipped = await f.restart().readRoom(f.code);
      assertSingleCompoundPromise(skipped, false);
      assert.equal(skipped.shipmentPromises![0].fulfilled, true);
      assert.equal(skipped.players[0].shipped, false);
      assert.deepEqual(skipped.players[0].forces, beforeSkip.players[0].forces);
      assert.equal(skipped.players[0].reserves, beforeSkip.players[0].reserves);
      assert.equal(skipped.players[0].spice, beforeSkip.players[0].spice);
      compoundShipmentCustody(skipped);
      await assertPrivateRestore(f, false, false);
    } finally {
      f.sqlite.close();
    }
  });
