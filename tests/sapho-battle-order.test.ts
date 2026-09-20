import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  battleChooserEvent,
  quoteBattleChoosers,
  reorderBattleChoosers,
} from '../game/battle-chooser-order';
import {
  saphoFaceDanceGame,
  saphoFaceDanceCustody,
} from './fixture-sapho-face-dance';
import {
  chooseSaphoBattleAction,
  nextSaphoBattleAction,
  resolveSaphoBattle,
  saphoBattleCustody,
  saphoBattleOrderAction,
  saphoBattleOrderGame,
  takeSaphoBattleCard,
  SAPHO_BATTLE_CARD,
} from './fixture-sapho-battle-order';

function reject(
  g: Game,
  player: string,
  action: Action,
  reason = /Sapho|battle|chooser|opportunity|scope|scheduling/i,
) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, player, action), reason);
  assert.equal(JSON.stringify(g), before);
}
function restore(g: Game) {
  const reloaded: Game = JSON.parse(JSON.stringify(g));
  for (const p of g.players)
    assert.deepEqual(viewGame(reloaded, p.id), viewGame(g, p.id));
  saphoBattleCustody(reloaded);
  return reloaded;
}
function choose(g: Game) {
  const next = chooseSaphoBattleAction(g);
  return applyAction(g, next.player, next.action);
}
const pairs = (g: Game) =>
  viewGame(g, 'a')
    .battleChoices.map(({ territory, attacker, defender }) =>
      JSON.stringify([territory, attacker, defender]),
    )
    .sort();

void test('first and last reorder Basic/Advanced remaining choosers without changing public battle geometry or physical circles', () => {
  for (const advanced of [false, true])
    for (const [owner, mode] of [
      ['c', 'first'],
      ['a', 'last'],
    ] as const) {
      const g = saphoBattleOrderGame({ advanced, holder: owner });
      const before = structuredClone(g),
        geometry = pairs(g);
      const next = applyAction(
        g,
        owner,
        saphoBattleOrderAction(g, owner, mode),
      );
      assert.deepEqual(g, before);
      assert.deepEqual(next.order, g.order);
      assert.deepEqual(next.playerPositions, g.playerPositions);
      assert.deepEqual(pairs(next), geometry);
      assert.equal(next.active, mode === 'first' ? 'c' : 'b');
      for (const p of next.players) {
        const old = g.players.find((other) => other.id === p.id)!;
        assert.deepEqual({ ...p, hand: [] }, { ...old, hand: [] });
        assert.deepEqual(
          p.hand,
          old.hand.filter((c) => c.id !== SAPHO_BATTLE_CARD),
        );
      }
      assert.equal(
        next.discard.filter((c) => c.id === SAPHO_BATTLE_CARD).length,
        1,
      );
      assert.equal(next.battleOrder!.uses.length, 1);
      assert.deepEqual(
        viewGame(next, 'r').battleOrder!.remaining,
        mode === 'first' ? ['c', 'a', 'b'] : ['b', 'c', 'a'],
      );
      restore(next);
    }
});

void test('a later physical defender chooses its opponent while original combat roles, powers and tie owner stay fixed', () => {
  for (const advanced of [false, true]) {
    let g = saphoBattleOrderGame({ advanced });
    g = applyAction(g, 'c', saphoBattleOrderAction(g, 'c', 'first'));
    const request = chooseSaphoBattleAction(g);
    assert.equal(request.player, 'c');
    assert.equal(request.action.target, 'a');
    g = applyAction(g, request.player, request.action);
    assert.equal(g.battle!.chooser, 'c');
    assert.equal(g.battle!.attacker, 'a');
    assert.equal(g.battle!.defender, 'c');
    assert.equal(viewGame(g, 'c').battle!.tieWinner, 'a');
    assert.ok(g.log.at(-1)!.text.includes('chose the battle between'));
    assert.ok(g.log.at(-1)!.text.includes('Emperor remains the aggressor'));
    assert.deepEqual(viewGame(g, 'c').saphoOptions, []);
    assert.ok(g.battle!.preLeader && !g.battle!.preLeader.closed);
    // The original Atreides benefit still belongs to the actual Atreides seat.
    for (
      let step = 0;
      g.battle?.preLeader && !g.battle.preLeader.closed && step < 10;
      step++
    ) {
      const next = nextSaphoBattleAction(g)!;
      g = applyAction(g, next.player, next.action);
    }
    assert.equal(g.battle?.preparation?.owner, 'c');
    assert.equal(g.battle?.preparation?.kind, 'prescience');
    g = resolveSaphoBattle(restore(g));
    const completed = JSON.stringify([
      g.lastBattleContext!.territory,
      ...g.lastBattleContext!.combatants,
    ]);
    assert.ok(!pairs(g).includes(completed));
    assert.equal(g.active, viewGame(g, 'a').battleOrder!.current);
    restore(g);
  }
});

void test('accepted phase priority survives every remaining battle and expires only on leaving Battle', () => {
  for (const advanced of [false, true]) {
    let g = saphoBattleOrderGame({ advanced, holder: 'a' });
    g = applyAction(g, 'a', saphoBattleOrderAction(g, 'a', 'last'));
    const phaseOrder = [...g.battleOrder!.priority],
      events: string[] = [],
      completed = new Set<string>();
    for (let count = 0; g.phase === 6 && count < 12; count++) {
      const before = viewGame(g, 'a').battleOrder!;
      assert.deepEqual(g.battleOrder!.priority, phaseOrder);
      assert.equal(g.active, before.current);
      assert.equal(
        before.remaining.includes('a') ? before.remaining.at(-1) : 'a',
        'a',
      );
      events.push(before.event);
      g = choose(g);
      const identity = JSON.stringify([
        g.battle!.territory,
        g.battle!.attacker,
        g.battle!.defender,
      ]);
      assert.ok(
        !completed.has(identity),
        'A completed pair cannot be reopened.',
      );
      completed.add(identity);
      g = resolveSaphoBattle(restore(g));
      restore(g);
    }
    assert.equal(g.phase, 7);
    assert.ok(completed.size >= 3);
    assert.equal(new Set(events).size, events.length);
    assert.equal(g.battleOrder, undefined);
    assert.equal(g.battleOrderUseEvents, undefined);
    assert.equal(viewGame(g, 'a').battleOrder, null);
    assert.deepEqual(g.order, ['a', 'b', 'c', 'r']);
  }
});

void test('Nullentropy can recover the physical Sapho for a fresh opportunity without replaying the consumed event', () => {
  let g = saphoBattleOrderGame();
  const box = g.richeseCache!.find((c) => c.effect === 'nullentropyBox')!;
  takeSaphoBattleCard(g, 'c', box.id);
  // A second conserved, staged discard makes the Box selection a real choice.
  g.discard.push(g.deck.pop()!);
  const old = saphoBattleOrderAction(g, 'c', 'first');
  g = applyAction(g, 'c', old);
  const savedOrder = structuredClone(g.battleOrder);
  g = applyAction(g, 'c', { type: 'card', card: box.id });
  assert.ok(g.pendingNullentropy);
  assert.deepEqual(viewGame(g, 'c').saphoOptions, []);
  g = applyAction(restore(g), 'c', {
    type: 'decision',
    event: g.pendingNullentropy.event,
    card: SAPHO_BATTLE_CARD,
  });
  assert.deepEqual(g.battleOrder, savedOrder);
  assert.ok(g.players[2].hand.some((c) => c.id === SAPHO_BATTLE_CARD));
  reject(g, 'c', old);
  const fresh = saphoBattleOrderAction(g, 'c', 'last');
  assert.notEqual(fresh.event, old.event);
  g = applyAction(g, 'c', fresh);
  assert.equal(g.battleOrder!.uses.length, 2);
  assert.equal(g.battleOrder!.priority.at(-1), 'c');
  assert.equal(g.players[2].spice, 28);
  assert.equal(g.discard.filter((c) => c.id === SAPHO_BATTLE_CARD).length, 1);
  restore(g);
});

void test('a clean later boundary accepts remaining battles without reopening the already completed pair', () => {
  let g = saphoBattleOrderGame({ holder: 'b' });
  const expired = saphoBattleOrderAction(g, 'b', 'first');
  g = choose(g);
  const current = structuredClone(g.battle);
  reject(g, 'b', expired);
  assert.deepEqual(g.battle, current);
  // This human saves Sapho for the next boundary instead of taking the new AI aggressor option.
  g = applyAction(g, 'b', {type:'battlePreparationReady', event:g.battle!.event});
  g = resolveSaphoBattle(g);
  assert.ok(g.players[1].hand.some((c) => c.id === SAPHO_BATTLE_CARD));
  reject(g, 'b', expired);
  const completed = structuredClone(g.lastBattleContext);
  const mode = viewGame(g, 'b').saphoOptions.find(
    (o) => o.scope === 'battleOrder',
  )!.mode;
  assert.ok(mode === 'first' || mode === 'last');
  g = applyAction(g, 'b', saphoBattleOrderAction(g, 'b', mode));
  assert.deepEqual(g.lastBattleContext, completed);
  restore(g);
});

void test('only a currently involved owner sees available order actions; private rival cards cannot affect eligibility', () => {
  const g = saphoBattleOrderGame();
  const changed = structuredClone(g);
  takeSaphoBattleCard(changed, 'b', changed.deck[0].id);
  for (const id of ['a', 'b', 'c', 'r']) {
    assert.deepEqual(
      viewGame(g, id).saphoOptions,
      viewGame(changed, id).saphoOptions,
    );
    assert.deepEqual(
      viewGame(g, id).battleOrder,
      viewGame(changed, id).battleOrder,
    );
    assert.deepEqual(
      viewGame(g, id).battleChoices,
      viewGame(changed, id).battleChoices,
    );
  }
  const ownerless = saphoBattleOrderGame({ holder: 'r' });
  assert.deepEqual(viewGame(ownerless, 'r').saphoOptions, []);
  reject(ownerless, 'r', {
    type: 'card',
    card: SAPHO_BATTLE_CARD,
    scope: 'battleOrder',
    mode: 'first',
    event: viewGame(ownerless, 'r').battleOrder!.event,
  });
  const action = saphoBattleOrderAction(g, 'c', 'first');
  reject(g, 'a', action, /card|hand|Sapho|opportunity/i);
  reject(g, 'c', { ...action, extra: true });
  reject(g, 'c', { ...action, mode: 'aggressor' });
});

void test('malformed order, markers, physical custody and selected chooser reject every read and continuation immutably', () => {
  let g = saphoBattleOrderGame();
  g = applyAction(g, 'c', saphoBattleOrderAction(g, 'c', 'first'));
  const bad: Game[] = [];
  const mutate = (change: (state: Game) => void) => {
    const state = structuredClone(g);
    change(state);
    bad.push(state);
  };
  mutate((s) => {
    s.battleOrder!.priority.reverse();
  });
  mutate((s) => {
    delete s.battleOrder;
  });
  mutate((s) => {
    delete s.battleOrderUseEvents;
  });
  mutate((s) => {
    s.battleOrder!.uses[0].eligible.push('foreign');
  });
  mutate((s) => {
    s.battleOrder!.uses[0].event = 'expired';
  });
  mutate((s) => {
    s.turn++;
  });
  mutate((s) => {
    s.phase = 7;
  });
  mutate((s) => {
    s.active = 'b';
  });
  mutate((s) => {
    s.discard.push({ ...s.discard.find((c) => c.id === SAPHO_BATTLE_CARD)! });
  });
  g = choose(g);
  mutate((s) => {
    delete s.battle!.chooser;
  });
  mutate((s) => {
    s.battle!.chooser = 'a';
  });
  mutate((s) => {
    s.battle!.chooserEvent = 'expired';
  });
  for (const state of bad) {
    const before = JSON.stringify(state);
    for (const p of state.players) assert.throws(() => viewGame(state, p.id));
    assert.throws(() => normalizeAutomaticGame(state));
    reject(
      state,
      'c',
      { type: 'setAutopilot', difficulty: 'Easy' },
      /Sapho|battle|chooser|opportunity|scheduling|physical/i,
    );
    reject(
      state,
      'c',
      { type: 'advanceBots' },
      /Sapho|battle|chooser|opportunity|scheduling|physical/i,
    );
    assert.equal(JSON.stringify(state), before);
  }
});

void test('full phase priority keeps a last holder behind a newly battle-relevant Face Dancer seat', () => {
  const physicalOrder = ['a', 'b', 't'];
  const state = reorderBattleChoosers({
    physicalOrder,
    turn: 2,
    afterBattle: null,
    pairs: [{ territory: 'arrakeen', attacker: 'a', defender: 'b' }],
    event: battleChooserEvent(2, null, 0),
    player: 'a',
    mode: 'last',
  });
  assert.deepEqual(state.priority, ['b', 't', 'a']);
  const afterFaceDance = quoteBattleChoosers(
    [{ territory: 'arrakeen', attacker: 'a', defender: 't' }],
    physicalOrder,
    state.priority,
  );
  assert.equal(afterFaceDance.current, 't');
  assert.deepEqual(afterFaceDance.choices[0], {
    territory: 'arrakeen',
    attacker: 'a',
    defender: 't',
    chooser: 't',
  });
  assert.deepEqual(quoteBattleChoosers([], physicalOrder, state.priority), {
    choices: [],
    remaining: [],
    current: null,
  });
});

void test('actual Basic/Advanced Face Dance brings a new chooser ahead of the surviving Sapho-last bystander', () => {
  for (const advanced of [false, true]) {
    const fixture = saphoFaceDanceGame(advanced);
    let g = fixture.game;
    g = applyAction(g, 'a', saphoBattleOrderAction(g, 'a', 'last'));
    assert.equal(g.active, 'b');
    assert.ok(!viewGame(g, 'a').battleOrder!.remaining.includes('t'));
    g = applyAction(g, 'b', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'c',
    });
    for (let step = 0; g.decision?.kind !== 'faceDance' && step < 60; step++) {
      const b = g.battle;
      if (
        b &&
        !g.response &&
        !g.decision &&
        !b.preparation &&
        (!b.preLeader || b.preLeader.closed)
      ) {
        const unsealed = [b.attacker, b.defender].find((id) => !b.plans[id]);
        if (unsealed) {
          g = applyAction(g, unsealed, {
            type: 'battlePlan',
            dial: 0,
            support: 0,
            leader:
              unsealed === 'b' ? fixture.winnerLeader : fixture.loserLeader,
          });
          continue;
        }
        const voter = [b.attacker, b.defender].find(
          (id) => b.traitorCalls[id] === undefined,
        );
        if (voter) {
          g = applyAction(g, voter, { type: 'traitorCall', call: false });
          continue;
        }
      }
      const next = nextSaphoBattleAction(g);
      assert.ok(next);
      g = applyAction(g, next.player, next.action);
    }
    assert.equal(g.decision?.kind, 'faceDance');
    assert.equal(g.lastBattleContext!.winner, 'b');
    assert.equal(viewGame(g, 'a').battleOrder!.current, null);
    assert.deepEqual(viewGame(g, 'a').saphoOptions, []);
    const event = g.lastBattleContext!.event,
      priority = [...g.battleOrder!.priority];
    for (const p of g.players)
      assert.deepEqual(
        viewGame(JSON.parse(JSON.stringify(g)), p.id),
        viewGame(g, p.id),
      );
    g = applyAction(JSON.parse(JSON.stringify(g)), 't', {
      type: 'decision',
      reveal: true,
      sources: { reserves: 1 },
      sector: 10,
    });
    assert.equal(g.players[0].forces['arrakeen:10'], 3);
    assert.equal(g.players[1].reserves, 20);
    assert.equal(g.players[4].forces['arrakeen:10'], 1);
    assert.equal(g.players[4].reserves, 19);
    assert.equal(g.active, 't');
    assert.deepEqual(g.battleOrder!.priority, priority);
    assert.equal(g.lastBattleContext!.event, event);
    assert.deepEqual(viewGame(g, 'a').battleOrder!.remaining, ['t', 'a']);
    const next = viewGame(g, 't').battleChoices.find(
      (choice) => choice.chooser === 't',
    )!;
    assert.deepEqual(next, {
      territory: 'arrakeen',
      attacker: 'a',
      defender: 't',
      chooser: 't',
    });
    saphoFaceDanceCustody(g);
    for (const p of g.players)
      assert.deepEqual(
        viewGame(JSON.parse(JSON.stringify(g)), p.id),
        viewGame(g, p.id),
      );
    g = applyAction(g, 't', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'a',
    });
    assert.equal(g.battle!.chooser, 't');
    assert.equal(g.battle!.attacker, 'a');
    assert.equal(g.battle!.defender, 't');
  }
});
