import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeNexusGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { drawNexusCard } from '../game/nexus-cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { maxCombatDial, maxCombatSupport } from '../game/combat';
import {
  enterNexusSpice,
  orderNexusSpice,
  finishNexusSpice,
  nexusAllow,
  nexusReload,
} from './fixture-nexus-cards';
import {
  beginNexusSardaukar,
  prepareSardaukarBattle,
  nexusSardaukarInventory,
} from './fixture-nexus-sardaukar';

/** Both modules and the final roster precede the genuine setup initializer.
 * Later board positions conserve all counters; Salusa is an explicit subset
 * of existing reserves, including the low case's four stars at Kaitain. */
function fixture(salusa: 1 | 2 | 5 = 5) {
  let g = createGame('SARDHOME', newPlayer('p', 'Emperor', 'emperor'), true);
  joinGame(g, newPlayer('q', 'Guild', 'guild'));
  joinGame(g, newPlayer('r', 'Fremen', 'fremen'));
  g = applyAction(g, 'p', { type: 'homeworlds', enabled: true });
  g.nexusCards = { cards: null, phase: null };
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeNexusGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 80; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((player) => player.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(next, 'Combined setup must progress through real choices.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  g = enterNexusSpice(g);
  orderNexusSpice(g, ['land', 'land']);
  g = finishNexusSpice(g);
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 20;
    if (p.elites) {
      p.elites.forces = {};
      p.elites.reserves = p.faction === 'emperor' ? 5 : 3;
      p.elites.tanks = 0;
    }
  }
  g.players[0].forces = { 'pasty_mesa:5': 7 };
  g.players[0].reserves = 13;
  g.players[1].forces = { 'pasty_mesa:5': 2 };
  g.players[1].reserves = 18;
  g.homeworlds!.custody!.salusa = { normal: 0, elite: salusa };
  const cards = g.nexusCards!.cards!;
  cards.deck = ['emperor', ...cards.deck.filter((card) => card !== 'emperor')];
  g.nexusCards!.cards = drawNexusCard(cards, 'p', g.players, () => 0);
  Object.assign(g, {
    phase: 6,
    phaseOpening: null,
    response: null,
    decision: null,
    active: 'p',
    order: ['p', 'q', 'r'],
    ready: [],
    storm: 18,
  });
  g = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'pasty_mesa',
    target: 'q',
  });
  for (const id of ['p', 'q'])
    if (g.battle!.preLeader && !g.battle!.preLeader.closed)
      g = applyAction(g, id, {
        type: 'battlePreparationReady',
        event: g.battle!.event,
      });
  g = prepareSardaukarBattle(g);
  inventory(g);
  return g;
}
function inventory(g: Game) {
  homeworldGameIntegrity(g);
  nexusSardaukarInventory(g);
}
function activate(g: Game) {
  return nexusAllow(beginNexusSardaukar(g));
}
function plan(g: Game, support: number) {
  const leader = [...g.players[0].leaders].sort(
    (a, b) => b.strength - a.strength,
  )[0];
  return { type: 'battlePlan', dial: 12, support, leader: leader.id };
}
function resolve(g: Game, support: number) {
  g = applyAction(g, 'p', plan(g, support));
  g = applyAction(g, 'q', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: g.players[1].leaders[0].id,
  });
  for (const id of ['p', 'q'])
    g = applyAction(g, id, { type: 'traitorCall', call: false });
  if (g.decision?.kind === 'battleLosses')
    g = applyAction(g, 'p', { type: 'decision', choice: 0 });
  return g;
}

void test('real high-Salusa Cunning pays only two normal support and all seven losses remain ordinary counters', () => {
  const original = fixture();
  let g = activate(nexusReload(original));
  const forces = viewGame(g, 'p').battle!.ownForces!;
  assert.deepEqual(
    [forces.normal, forces.elite, forces.temporaryElite],
    [7, 0, 5],
  );
  assert.equal(forces.eliteFreeSupport, true);
  assert.equal(maxCombatDial(forces), 12);
  assert.equal(maxCombatSupport(forces), 2);
  assert.deepEqual(g.homeworlds!.custody!.salusa, { normal: 0, elite: 5 });
  const before = nexusReload(g);
  assert.throws(() => applyAction(g, 'p', plan(g, 3)));
  assert.deepEqual(g, before);
  for (const p of g.players)
    assert.deepEqual(viewGame(nexusReload(g), p.id), viewGame(g, p.id));
  g = resolve(g, 2);
  assert.equal(g.players[0].tanks, 7);
  assert.equal(g.players[0].spice, original.players[0].spice - 2);
  assert.equal(g.players[0].elites!.tanks, 0);
  assert.equal(g.players[0].elites!.reserves, 5);
  assert.deepEqual(g.homeworlds!.custody!.salusa, { normal: 0, elite: 5 });
  assert.equal(g.players[0].reserves, original.players[0].reserves);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  inventory(g);
});

void test('one Salusa star stays low despite five temporary Sardaukar and requires all seven support payments', () => {
  const original = fixture(1);
  let g = activate(nexusReload(original));
  const forces = viewGame(g, 'p').battle!.ownForces!;
  assert.equal(forces.temporaryElite, 5);
  assert.equal(!!forces.eliteFreeSupport, false);
  assert.equal(maxCombatDial(forces), 12);
  assert.equal(maxCombatSupport(forces), 7);
  const before = nexusReload(g);
  assert.throws(() => applyAction(g, 'p', plan(g, 2)));
  assert.deepEqual(g, before);
  g = resolve(g, 7);
  assert.equal(g.players[0].tanks, 7);
  assert.equal(g.players[0].spice, original.players[0].spice - 7);
  assert.equal(g.players[0].elites!.tanks, 0);
  assert.equal(g.players[0].elites!.reserves, 5);
  assert.deepEqual(g.homeworlds!.custody!.salusa, { normal: 0, elite: 1 });
  inventory(g);
});

void test('the actual Salusa one-to-two threshold controls the shared profile without counting stars at Kaitain', () => {
  for (const [salusa, support] of [
    [1, 7],
    [2, 2],
  ] as const) {
    const g = activate(fixture(salusa));
    assert.equal(
      maxCombatSupport(viewGame(g, 'p').battle!.ownForces!),
      support,
    );
    assert.equal(g.players[0].elites!.reserves, 5);
    assert.equal(g.homeworlds!.custody!.salusa!.elite, salusa);
    inventory(g);
  }
});
