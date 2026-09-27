import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { nexusSardaukarFixture, nexusSardaukarInventory } from './fixture-nexus-sardaukar';
import { maxCombatDial } from '../game/combat';
import { nexusReload } from './fixture-nexus-cards';

function battle(holder: 'r' | null = 'r') {
  const g = nexusSardaukarFixture({ starred: 2, normal: 3, ...(holder ? { emperorCardHolder: holder } : {}) });
  nexusSardaukarInventory(g);
  assert.equal(g.response?.kind, 'eliteStrength');
  assert.equal(g.response.owner, 'p');
  return g;
}

function rejected(g: Game, id: string, action: Action) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, id, action));
  assert.equal(JSON.stringify(g), before);
}

void test('Emperor battle response is a universal opportunity without identifying the hidden Nexus holder', () => {
  const g = battle();
  assert.equal(viewGame(g, 'p').nexusEmperorBetrayal, null);
  assert.equal(viewGame(g, 'q').nexusEmperorBetrayal, null);
  assert.equal(viewGame(g, 'r').nexusEmperorBetrayal?.event, g.battle!.event);
  for (const id of ['p', 'q', 'r']) {
    const publicView = viewGame(g, id);
    assert.equal(publicView.response?.kind, 'eliteStrength');
    assert.equal('nexusEmperorBetrayalHistory' in publicView, false);
  }
  let noHolder = battle(null);
  for (const id of ['p', 'q']) noHolder = applyAction(noHolder, id, { type: 'passResponse' });
  assert.equal(noHolder.response?.kind, 'eliteStrength');
  noHolder = applyAction(noHolder, 'r', { type: 'passResponse' });
  assert.notEqual(noHolder.response?.kind, 'eliteStrength');
  const passed = applyAction(battle(), 'r', { type: 'passResponse' });
  assert.equal(passed.response?.kind, 'eliteStrength');
  assert.equal(viewGame(passed, 'r').nexusEmperorBetrayal, null);
  rejected(passed, 'r', { type: 'nexusEmperorBetrayal', event: passed.battle!.event });
});

void test('Truthtrance priority suspends the battle reaction until the question resolves', () => {
  const initial = battle();
  const card = initial.deck.find((candidate) => candidate.effect === 'truthtrance')!;
  initial.deck = initial.deck.filter((candidate) => candidate.id !== card.id);
  initial.players[1].hand.push(card);
  let g = applyAction(initial, 'q', { type: 'card', card: card.id });
  assert.equal(g.truthtrance?.stage, 'priority');
  assert.equal(viewGame(g, 'r').nexusEmperorBetrayal, null);
  rejected(g, 'r', { type: 'nexusEmperorBetrayal', event: g.battle!.event });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(g, g.players.find((player) => !g.truthtrance!.passed.includes(player.id))!.id,
      { type: 'truthPass' });
  g = applyAction(g, 'q', { type: 'truthAsk', question: {
    kind: 'battlePlan', target: 'p', claim: { kind: 'dial', compare: 'gte', value: 6 },
  } });
  assert.equal(viewGame(g, 'r').nexusEmperorBetrayal, null);
  rejected(g, 'r', { type: 'nexusEmperorBetrayal', event: g.battle!.event });
  g = applyAction(g, 'p', { type: 'truthAnswer', answer: 'no' });
  assert.equal(g.truthtrance, null);
  assert.equal(viewGame(g, 'r').nexusEmperorBetrayal?.event, g.battle!.event);
  assert.ok(applyAction(g, 'r', { type: 'nexusEmperorBetrayal', event: g.battle!.event })
    .battle!.eliteBlocked?.includes('p'));
});

void test('one spent Emperor Betrayal suppresses actual Sardaukar strength but retains physical counters after restore', () => {
  const original = battle();
  const action = { type: 'nexusEmperorBetrayal', event: original.battle!.event };
  rejected(original, 'q', action);
  rejected(original, 'p', action);
  rejected(original, 'r', { ...action, event: 'stale' });
  rejected(original, 'r', { ...action, invented: true });
  const before = original.players[0].elites;
  const g = applyAction(nexusReload(original), 'r', action);
  assert.equal(g.nexusCards!.cards!.hands.r, null);
  assert.ok(g.nexusCards!.cards!.discard.includes('emperor'));
  assert.ok(g.battle!.eliteBlocked?.includes('p'));
  assert.deepEqual(g.players[0].elites, before);
  assert.equal(g.nexusEmperorBetrayalHistory?.length, 1);
  nexusSardaukarInventory(g);
  rejected(g, 'r', action);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  const after = viewGame(g, 'q');
  assert.equal(after.nexusEmperorBetrayal, null);
  assert.equal('nexusEmperorBetrayalHistory' in after, false);
});

void test('Betrayal changes supported dial legality, not actual Sardaukar custody', () => {
  const initial = battle();
  assert.equal(maxCombatDial(viewGame(initial, 'p').battle!.ownForces!), 7);
  let g = applyAction(initial, 'r', {
    type: 'nexusEmperorBetrayal', event: initial.battle!.event,
  });
  assert.equal(maxCombatDial(viewGame(g, 'p').battle!.ownForces!), 5);
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, { type: 'declineBattlePower' });
  rejected(g, 'p', { type: 'battlePlan', leader: 'emperor-0', dial: 6, support: 5 });
  const legal = applyAction(g, 'p', { type: 'battlePlan', leader: 'emperor-0', dial: 5, support: 5 });
  assert.equal(legal.battle!.plans.p.dial, 5);
  assert.equal(legal.players[0].elites!.forces['pasty_mesa:5'], 2);
});

void test('all bot tiers either play their private Betrayal or legally pass the shared response', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const g = battle();
    g.players[2].bot = difficulty;
    const action = botActions(viewGame(g, 'r'))[0];
    assert.equal(action?.type, 'nexusEmperorBetrayal');
    const absent = battle(null);
    absent.players[2].bot = difficulty;
    const pass = botActions(viewGame(absent, 'r'))[0];
    assert.equal(pass?.type, 'passResponse');
  }
});
