import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';
import { casualtyOptions, maxCombatDial } from '../game/combat';
import {
  createNexusSardaukar,
  validateNexusSardaukar,
} from '../game/nexus-sardaukar';
import {
  nexusSardaukarFixture,
  nexusSardaukarPlayer,
  nexusSardaukarInventory,
  prepareSardaukarBattle,
  beginNexusSardaukar,
  allowNexusSardaukar,
} from './fixture-nexus-sardaukar';
import { nexusReload, nexusReject, nexusAllow } from './fixture-nexus-cards';
import { drawNexusCard } from '../game/nexus-cards';

function hold(g: Game, id: string, effect: string): string {
  const index = g.deck.findIndex(
    (card) => card.effect === effect || card.kind === effect,
  );
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
function activate(g: Game): Game {
  return allowNexusSardaukar(beginNexusSardaukar(g));
}
function request(g: Game) {
  const p = nexusSardaukarPlayer(g);
  return {
    type: 'nexusSardaukar',
    event: viewGame(g, p.id).nexusSardaukar!.offer!.event,
  };
}
function resolveOrdinary(state: Game, dial = 6, support = 3): Game {
  let g = prepareSardaukarBattle(state);
  const owner = nexusSardaukarPlayer(g),
    target = g.players.find((p) => p.id === g.battle!.defender)!;
  const leader = [...owner.leaders].sort((a, b) => b.strength - a.strength)[0];
  const opposing = [...target.leaders].sort(
    (a, b) => a.strength - b.strength,
  )[0];
  g = applyAction(g, owner.id, {
    type: 'battlePlan',
    dial,
    support,
    leader: leader.id,
  });
  g = applyAction(g, target.id, {
    type: 'battlePlan',
    dial: 0,
    leader: opposing.id,
  });
  for (const id of [owner.id, target.id])
    g = applyAction(g, id, { type: 'traitorCall', call: false });
  return g;
}

void test('Sardaukar receipt binds the original five-counter battle role without depending on later force custody', () => {
  const g = nexusSardaukarFixture();
  const receipt = createNexusSardaukar(
    g,
    'p',
    g.battle!.event!,
    'pasty_mesa',
    7,
  );
  assert.equal(receipt.elite, 0);
  assert.equal(receipt.count, 5);
  validateNexusSardaukar({ turn: g.turn + 1, players: g.players }, receipt);
  for (const patch of [
    { normal: 4 },
    { normal: 8 },
    { count: 4 },
    { elite: 1 },
    { owner: 'q' },
    { territory: 'hagga_basin' },
    { battle: 'other' },
    { version: 0 },
  ]) {
    const bad = { ...receipt, ...patch };
    assert.throws(() => validateNexusSardaukar(g, bad as typeof receipt));
  }
  assert.throws(() => createNexusSardaukar(g, 'q', 'battle', 'pasty_mesa', 7));
  assert.throws(() => createNexusSardaukar(g, 'p', 'battle', 'pasty_mesa', 4));
  const changed = g.players.map((p) => ({ id: p.id, faction: p.faction }));
  changed[1].id = 'another-seat';
  assert.throws(() =>
    validateNexusSardaukar({ turn: g.turn, players: changed }, receipt),
  );
});

void test('five temporary Sardaukar enhance an owned battle while every actual force and starred counter stays in place', () => {
  let g = nexusSardaukarFixture();
  hold(g, 'q', 'karama');
  const before = structuredClone(g.players);
  g = beginNexusSardaukar(g);
  assert.equal(g.response?.kind, 'nexusSardaukar');
  g = allowNexusSardaukar(g);
  assert.deepEqual(g.players, before);
  const forces = viewGame(g, 'p').battle!.ownForces!;
  assert.equal(forces.normal, 7);
  assert.equal(forces.elite, 0);
  assert.equal(forces.temporaryElite, 5);
  assert.equal(maxCombatDial(forces), 12);
  assert.deepEqual(
    casualtyOptions(forces, 6, 3).map((x) => [x.normal, x.elite]),
    [
      [3, 0],
      [4, 0],
      [5, 0],
    ],
  );
  for (const p of g.players)
    assert.equal(viewGame(g, p.id).nexusSardaukar!.active, true);
  nexusSardaukarInventory(g);
});

void test('temporary Sardaukar retain the ordinary Fremen exception and need support for full strength', () => {
  const g = activate(nexusSardaukarFixture({ opponentFaction: 'fremen' }));
  const forces = viewGame(g, 'p').battle!.ownForces!;
  assert.equal(forces.temporaryElite, 5);
  assert.equal(forces.eliteStrength, 1);
  assert.equal(forces.freeSupport, false);
  assert.equal(maxCombatDial(forces), 7);
  assert.deepEqual(
    casualtyOptions(forces, 5, 5).map((x) => [x.normal, x.elite]),
    [[5, 0]],
  );
  assert.deepEqual(casualtyOptions(forces, 5, 0), []);
});

void test('Karama stops the new role grant entirely and leaves all physical forces normal', () => {
  let g = nexusSardaukarFixture();
  const karama = hold(g, 'q', 'karama');
  const original = structuredClone(nexusSardaukarPlayer(g).elites);
  g = beginNexusSardaukar(g);
  g = applyAction(g, 'q', { type: 'card', card: karama, mode: 'cancel' });
  g = allowNexusSardaukar(g);
  const forces = viewGame(g, 'p').battle!.ownForces!;
  assert.equal(forces.temporaryElite ?? 0, 0);
  assert.equal(maxCombatDial(forces), 7);
  assert.deepEqual(nexusSardaukarPlayer(g).elites, original);
  assert.equal(g.discard.filter((c) => c.id === karama).length, 1);
  assert.equal(
    g.nexusCards!.cards!.discard.filter((c) => c === 'emperor').length,
    1,
  );
  nexusSardaukarInventory(g);
});

void test('every winning casualty choice removes ordinary counters and never invents Sardaukar in the Tanks', () => {
  const initial = activate(nexusSardaukarFixture());
  for (const [index, losses] of [3, 4, 5].entries()) {
    let g = resolveOrdinary(nexusReload(initial));
    assert.equal(g.decision?.kind, 'battleLosses');
    g = applyAction(g, 'p', { type: 'decision', choice: index });
    const p = nexusSardaukarPlayer(g);
    assert.equal(p.tanks, losses);
    assert.equal(p.forces['pasty_mesa:5'], 7 - losses);
    assert.equal(p.elites!.tanks, 0);
    assert.equal(p.elites!.reserves, 5);
    assert.deepEqual(p.elites!.forces, {});
    nexusSardaukarInventory(g);
  }
});

void test('the completed grant expires before a second battle in the same turn', () => {
  let g = resolveOrdinary(activate(nexusSardaukarFixture()), 0, 0);
  assert.equal(g.battle, null);
  g = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'hagga_basin',
    target: 'q',
  });
  assert.equal(viewGame(g, 'p').battle!.ownForces!.temporaryElite ?? 0, 0);
  assert.equal(viewGame(g, 'p').nexusSardaukar!.active, false);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
});

void test('Basic, short groups, actual Sardaukar, foreign actors and stale or repeated declarations reject unchanged', () => {
  for (const options of [{ advanced: false }, { normal: 4 }, { starred: 1 }]) {
    const g = nexusSardaukarFixture(options);
    assert.ok(viewGame(g, 'p').nexusSardaukar!.offer!.blocked);
    nexusReject(g, 'p', request(g), /Basic|Advanced|five|5|Sardaukar|ruling/i);
  }
  const g = nexusSardaukarFixture(),
    action = request(g);
  nexusReject(g, 'q', action, /Sardaukar|Cunning/);
  nexusReject(g, 'p', { ...action, event: 'old' }, /Sardaukar|Cunning/);
  nexusReject(g, 'p', { ...action, count: 4 }, /Sardaukar|Cunning/);
  nexusReject(activate(g), 'p', action, /Sardaukar|Cunning/);
  const ready = prepareSardaukarBattle(g);
  const sealed = applyAction(ready, 'p', {
    type: 'battlePlan',
    dial: 0,
    leader: ready.players[0].leaders[0].id,
  });
  nexusReject(sealed, 'p', action, /submitted|Sardaukar|Cunning/);
});

void test('saved declaration restores its public pending effect and only settles once', () => {
  let g = nexusSardaukarFixture({
    seatIds: ['emperor-seat', 'guild-seat', 'fremen-seat'],
  });
  hold(g, 'guild-seat', 'karama');
  const action = request(g);
  g = beginNexusSardaukar(g);
  const saved = nexusReload(g);
  for (const p of saved.players) {
    const view = viewGame(saved, p.id);
    assert.equal(view.nexusSardaukar!.pending!.owner, 'emperor-seat');
    for (const other of view.players)
      if (other.id !== p.id) assert.equal(other.hand, undefined);
  }
  assert.deepEqual(normalizeAutomaticGame(saved), saved);
  g = allowNexusSardaukar(nexusReload(saved));
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  nexusReject(g, 'emperor-seat', action, /Sardaukar|Cunning/);
  nexusSardaukarInventory(g);
});

void test('native Prescience accepts a future Cunning dial and keeps its answer binding after activation', () => {
  let g = nexusSardaukarFixture({ opponentFaction: 'atreides' });
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 10 });
  assert.equal(g.nexusCards!.cards!.hands.p, 'emperor');
  g = activate(prepareSardaukarBattle(g));
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: 10,
    support: 5,
    leader: g.players[0].leaders[0].id,
  });
  assert.equal(g.battle!.plans.p.dial, 10);
  assert.equal(g.battle!.prescience!.value, 10);
});

void test('canceling Cunning reopens an impossible native dial answer without granting a new inspection', () => {
  let g = nexusSardaukarFixture({ opponentFaction: 'atreides' });
  const karama = hold(g, 'q', 'karama');
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 10 });
  const battle = g.battle!.event;
  g = beginNexusSardaukar(prepareSardaukarBattle(g));
  g = applyAction(g, 'q', { type: 'card', card: karama, mode: 'cancel' });
  assert.equal(g.battle!.event, battle);
  assert.equal(g.battle!.prescience!.player, 'q');
  assert.equal(g.battle!.prescience!.field, 'dial');
  assert.equal(g.battle!.preparation?.kind, 'prescienceAnswer');
  g = applyAction(nexusReload(g), 'p', { type: 'prescienceAnswer', value: 5 });
  assert.equal(g.battle!.prescience!.value, 5);
  g = prepareSardaukarBattle(g);
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: 5,
    support: 5,
    leader: g.players[0].leaders[0].id,
  });
  assert.equal(g.battle!.plans.p.dial, 5);
  assert.equal(
    g.nexusCards!.cards!.discard.filter((card) => card === 'emperor').length,
    1,
  );
  assert.equal(g.discard.filter((card) => card.id === karama).length, 1);
  nexusSardaukarInventory(g);
});

void test('canceled Sardaukar reopen the affected Cunning inspection while preserving the other answered element', () => {
  for (const [nativeDial, extraLeader] of [
    [true, false],
    [false, false],
    [true, true],
  ]) {
    let g = nexusSardaukarFixture({ opponentFaction: 'atreides' });
    const leader = g.players[0].leaders[0].id;
    const unchangedField = extraLeader
      ? 'leader'
      : nativeDial
        ? 'defense'
        : 'weapon';
    const unchangedValue = extraLeader ? leader : null;
    const karama = hold(g, 'q', 'karama');
    const cards = g.nexusCards!.cards!;
    cards.deck = [
      'atreides',
      ...cards.deck.filter((card) => card !== 'atreides'),
    ];
    g.nexusCards!.cards = drawNexusCard(cards, 'q', g.players, () => 0);
    g = applyAction(g, 'q', {
      type: 'prescience',
      field: nativeDial ? 'dial' : 'weapon',
    });
    g = nexusAllow(g);
    g = applyAction(g, 'p', {
      type: 'prescienceAnswer',
      value: nativeDial ? 10 : null,
    });
    g = prepareSardaukarBattle(g);
    g = applyAction(g, 'q', {
      type: 'nexusAtreides',
      event: g.battle!.event,
      mode: 'cunning',
      field: extraLeader ? 'leader' : nativeDial ? 'defense' : 'dial',
    });
    g = nexusAllow(g);
    g = applyAction(g, 'p', {
      type: 'nexusPrescienceAnswer',
      event: g.battle!.event,
      value: nativeDial ? unchangedValue : 10,
    });
    g = beginNexusSardaukar(prepareSardaukarBattle(g));
    g = applyAction(g, 'q', { type: 'card', card: karama, mode: 'cancel' });
    assert.equal(
      g.battle!.preparation?.kind,
      nativeDial ? 'prescienceAnswer' : 'nexusPrescienceAnswer',
    );
    assert.deepEqual(viewGame(g, 'r').battle!.nexusInsights, []);
    g = applyAction(
      nexusReload(g),
      'p',
      nativeDial
        ? { type: 'prescienceAnswer', value: 5 }
        : { type: 'nexusPrescienceAnswer', event: g.battle!.event, value: 5 },
    );
    const commitments = viewGame(g, 'p').battle!.ownCommitments;
    assert.ok(commitments.some((c) => c.field === 'dial' && c.value === 5));
    assert.ok(
      commitments.some(
        (c) => c.field === unchangedField && c.value === unchangedValue,
      ),
    );
    g = prepareSardaukarBattle(g);
    if (extraLeader)
      nexusReject(
        g,
        'p',
        {
          type: 'battlePlan',
          dial: 5,
          support: 5,
          leader: g.players[0].leaders.find(
            (candidate) => candidate.id !== leader,
          )!.id,
        },
        /Every element revealed by a battle inspection must remain unchanged/,
      );
    g = applyAction(g, 'p', {
      type: 'battlePlan',
      dial: 5,
      support: 5,
      leader,
    });
    assert.equal(g.battle!.plans.p.dial, 5);
    nexusSardaukarInventory(g);
  }
});

void test('Secret Ally inspection retains private history when canceled Sardaukar require a revised dial', () => {
  let g = nexusSardaukarFixture();
  const karama = hold(g, 'q', 'karama');
  const cards = g.nexusCards!.cards!;
  cards.deck = [
    'atreides',
    ...cards.deck.filter((card) => card !== 'atreides'),
  ];
  g.nexusCards!.cards = drawNexusCard(cards, 'q', g.players, () => 0);
  g = applyAction(g, 'q', {
    type: 'nexusAtreides',
    event: g.battle!.event,
    mode: 'secretAlly',
    field: 'dial',
  });
  g = applyAction(g, 'p', {
    type: 'nexusPrescienceAnswer',
    event: g.battle!.event,
    value: 10,
  });
  g = beginNexusSardaukar(prepareSardaukarBattle(g));
  g = applyAction(g, 'q', { type: 'card', card: karama, mode: 'cancel' });
  assert.equal(g.battle!.preparation?.kind, 'nexusPrescienceAnswer');
  assert.deepEqual(viewGame(g, 'r').battle!.nexusInsights, []);
  assert.ok(
    viewGame(g, 'q').battle!.nexusInsights.some(
      (insight) => insight.value === 10 && !insight.active,
    ),
  );
  g = applyAction(nexusReload(g), 'p', {
    type: 'nexusPrescienceAnswer',
    event: g.battle!.event,
    value: 5,
  });
  const answers = viewGame(g, 'q').battle!.nexusInsights;
  assert.ok(answers.some((insight) => insight.value === 10 && !insight.active));
  assert.ok(answers.some((insight) => insight.value === 5 && insight.active));
  g = prepareSardaukarBattle(g);
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: 5,
    support: 5,
    leader: g.players[0].leaders[0].id,
  });
  nexusSardaukarInventory(g);
});
