import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { RoomsClock } from '../db/rooms';
import * as engine from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';
import {
  diplomatDefenseGame,
  revealDiplomatPlans,
} from './diplomat-defense-fixture';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

async function fixture(hide = true) {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  const created = await store.rooms.createRoom(
    'Diplomat owner',
    'emperor',
    false,
    [],
  );
  const joined = await store.rooms.joinRoom(
    created.view.code,
    'Diplomat opponent',
    'guild',
  );
  const code = created.view.code;
  const tokens = [created.token!, joined.token!];
  const original = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  for (const [index, seat] of original.entries())
    sqlite
      .prepare('UPDATE seats SET player_id=? WHERE room_code=? AND player_id=?')
      .run(index ? 'd' : 'a', code, seat.playerId);
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const state = diplomatDefenseGame(hide);
  state.code = code;
  state.version = (await store.rooms.readRoom(code)).version;
  const save = (game: engine.Game) =>
    sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(game), game.version, code);
  save(state);
  store.writes.length = 0;
  const worthless = state.players[0].hand.find(
    (card) => card.kind === 'worthless',
  )!;
  const poison = state.players[1].hand.find((card) => card.kind === 'poison')!;
  const snooper = state.players[1].hand.find(
    (card) => card.kind === 'snooper',
  )!;
  assert.ok(worthless && poison && snooper);
  return {
    ...store,
    sqlite,
    code,
    seats,
    state,
    save,
    worthless,
    poison,
    snooper,
  };
}

function ownerPlan(f: Awaited<ReturnType<typeof fixture>>): engine.Action {
  return {
    type: 'battlePlan',
    dial: 0,
    leader: f.state.battle!.leaderSkillHidden?.a ? 'emperor-0' : 'emperor-1',
    defense: f.worthless.id,
  };
}

function opponentPlan(f: Awaited<ReturnType<typeof fixture>>): engine.Action {
  return {
    type: 'battlePlan',
    dial: 0,
    leader: 'guild-1',
    weapon: f.poison.id,
    defense: f.snooper.id,
  };
}

function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await ready;
  };
}

function committedOnce(
  results: PromiseSettledResult<unknown>[],
  writes: { changes: number }[],
) {
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === 'rejected').length,
    1,
  );
  assert.deepEqual(
    writes.map((write) => write.changes).sort((a, b) => a - b),
    [0, 1],
  );
}

void test('restart conceals the sealed Worthless, publishes the revealed Diplomat offer, and concurrent copies save the selected trainer once', async () => {
  const f = await fixture(true);
  try {
    await f.rooms.act(f.code, f.seats[0], f.state.version, ownerPlan(f), clock);
    const sealed = await f.restart().readRoom(f.code);
    const owner = await f.restart().readSeatView(f.code, f.seats[0]);
    const observer = await f.restart().readSeatView(f.code, f.seats[1]);
    assert.equal(owner.battle!.plans.a.defense, f.worthless.id);
    assert.equal(observer.battle!.plans.a, undefined);
    assert.equal(
      JSON.stringify(observer.battle).includes(f.worthless.id),
      false,
    );

    await f
      .restart()
      .act(f.code, f.seats[1], sealed.version, opponentPlan(f), clock);
    const offered = await f.restart().readRoom(f.code);
    assert.equal(offered.decision?.kind, 'diplomatDefense');
    assert.equal(offered.battle!.diplomatDefense?.stage, 'offered');
    assert.deepEqual(offered.battle!.diplomatDefense?.cards, [f.worthless.id]);
    for (const seat of f.seats) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.deepEqual(view.decision, offered.decision);
      assert.equal(view.battle!.diplomatDefense?.stage, 'offered');
      const publicReceipt = JSON.stringify(view.battle!.diplomatDefense);
      assert.equal(publicReceipt.includes('signature'), false);
      assert.equal(publicReceipt.includes('frame'), false);
    }

    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const choice: engine.Action = {
      type: 'decision',
      event: offered.decision!.event,
      card: f.worthless.id,
    };
    const choices = await Promise.allSettled([
      f.rooms.act(f.code, f.seats[0], offered.version, choice, clock),
      f.restart().act(f.code, f.seats[0], offered.version, choice, clock),
    ]);
    delete f.hooks.beforeWrite;
    committedOnce(choices, f.writes);
    let selected = await f.restart().readRoom(f.code);
    assert.equal(selected.battle!.diplomatDefense?.stage, 'copied');
    assert.equal(selected.battle!.diplomatDefense?.card, f.worthless.id);
    assert.equal(
      selected.players[0].hand.filter((card) => card.id === f.worthless.id)
        .length,
      1,
    );
    assert.equal(
      selected.discard.some((card) => card.id === f.worthless.id),
      false,
    );

    await f
      .restart()
      .act(
        f.code,
        f.seats[0],
        selected.version,
        { type: 'traitorCall', call: false },
        clock,
      );
    selected = await f.restart().readRoom(f.code);
    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        selected.version,
        { type: 'traitorCall', call: false },
        clock,
      );
    const resolved = await f.restart().readRoom(f.code);
    assert.equal(
      resolved.players[0].leaders.find((leader) => leader.id === 'emperor-0')!
        .dead,
      false,
    );
    assert.equal(
      resolved.discard.filter((card) => card.id === f.worthless.id).length,
      1,
    );
    assert.equal(
      resolved.players.some((player) =>
        player.hand.some((card) => card.id === f.worthless.id),
      ),
      false,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent restored copy and decline commit one public choice without moving the Worthless early', async () => {
  const f = await fixture(false);
  try {
    const offered = revealDiplomatPlans(f.state, 'weapon');
    f.save(offered);
    assert.equal(offered.decision?.kind, 'diplomatDefense');
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const event = offered.decision.event;
    const results = await Promise.allSettled([
      f.rooms.act(
        f.code,
        f.seats[0],
        offered.version,
        { type: 'decision', event, card: f.worthless.id },
        clock,
      ),
      f
        .restart()
        .act(
          f.code,
          f.seats[0],
          offered.version,
          { type: 'decision', event, card: null },
          clock,
        ),
    ]);
    delete f.hooks.beforeWrite;
    committedOnce(results, f.writes);
    const current = await f.restart().readRoom(f.code);
    const copied = results[0].status === 'fulfilled';
    assert.equal(
      current.battle!.diplomatDefense?.stage,
      copied ? 'copied' : 'declined',
    );
    assert.equal(
      current.battle!.diplomatDefense?.card,
      copied ? f.worthless.id : null,
    );
    assert.equal(
      current.players[0].hand.filter((card) => card.id === f.worthless.id)
        .length,
      1,
    );
    assert.equal(
      current.discard.some((card) => card.id === f.worthless.id),
      false,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('a restored activated copy still discards its exact Worthless after a successful Traitor call', async () => {
  const f = await fixture(true);
  try {
    const owner = f.state.players[0];
    const old = owner.traitors[0];
    const identity = 'guild-1';
    if (old !== identity) {
      const holder = f.state.players.find((player) =>
        player.traitors.includes(identity),
      );
      if (holder) holder.traitors[holder.traitors.indexOf(identity)] = old;
      else {
        const reserve = f.state.traitorReserve!.indexOf(identity);
        assert.ok(reserve >= 0);
        f.state.traitorReserve![reserve] = old;
      }
      owner.traitors[0] = identity;
    }
    const offered = revealDiplomatPlans(f.state);
    assert.equal(offered.decision?.kind, 'diplomatDefense');
    const copied = engine.applyAction(offered, 'a', {
      type: 'decision',
      event: offered.decision.event,
      card: f.worthless.id,
    });
    f.save(copied);
    await f
      .restart()
      .act(
        f.code,
        f.seats[0],
        copied.version,
        { type: 'traitorCall', call: true },
        clock,
      );
    const called = await f.restart().readRoom(f.code);
    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        called.version,
        { type: 'traitorCall', call: false },
        clock,
      );
    const resolved = await f.restart().readRoom(f.code);
    assert.equal(resolved.lastBattleContext?.result, 'traitor');
    assert.equal(resolved.lastBattleContext?.winner, 'a');
    assert.equal(
      resolved.discard.filter((card) => card.id === f.worthless.id).length,
      1,
    );
    assert.equal(
      resolved.players.some((player) =>
        player.hand.some((card) => card.id === f.worthless.id),
      ),
      false,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('corrupted restored receipt, decision, or independent battle marker rejects views and actions without mutation', async () => {
  const f = await fixture();
  try {
    const original = revealDiplomatPlans(f.state);
    assert.equal(original.decision?.kind, 'diplomatDefense');
    const action: engine.Action = {
      type: 'decision',
      event: original.decision.event,
      card: f.worthless.id,
    };
    const corruptions: ((game: engine.Game) => void)[] = [
      (game) => {
        game.battle!.diplomatDefense!.frame += '-changed';
      },
      (game) => {
        if (game.decision?.kind === 'diplomatDefense')
          game.decision.source = 'wrong-defense';
      },
      (game) => {
        delete game.battle!.diplomatDefenseVersion;
      },
      (game) => {
        delete game.battle!.diplomatDefenseEvent;
      },
    ];
    for (const corrupt of corruptions) {
      const bad = structuredClone(original);
      corrupt(bad);
      f.save(bad);
      f.writes.length = 0;
      for (const seat of f.seats)
        await assert.rejects(f.restart().readSeatView(f.code, seat));
      await assert.rejects(
        f.restart().act(f.code, f.seats[0], bad.version, action, clock),
      );
      const snapshot = structuredClone(bad);
      assert.throws(() => engine.normalizeAutomaticGame(bad));
      assert.deepEqual(bad, snapshot);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.rooms.readRoom(f.code), snapshot);
    }
  } finally {
    f.sqlite.close();
  }
});

void test('a restored legacy revealed battle without a Diplomat marker keeps its existing traitor continuation', async () => {
  const f = await fixture();
  try {
    const legacy = revealDiplomatPlans(f.state);
    delete legacy.battle!.diplomatDefenseVersion;
    delete legacy.battle!.diplomatDefenseEvent;
    delete legacy.battle!.diplomatDefense;
    legacy.decision = null;
    f.save(legacy);
    const view = await f.restart().readSeatView(f.code, f.seats[0]);
    assert.equal(view.decision, null);
    await f
      .restart()
      .act(
        f.code,
        f.seats[0],
        legacy.version,
        { type: 'traitorCall', call: false },
        clock,
      );
    const continued = await f.restart().readRoom(f.code);
    assert.equal(continued.battle!.traitorCalls.a, false);
    assert.equal(continued.battle!.diplomatDefense, undefined);
  } finally {
    f.sqlite.close();
  }
});
