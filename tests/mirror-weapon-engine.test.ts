import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

const mirror = richeseCards().find((card) => card.effect === 'mirrorWeapon')!;
function fixture(advanced = false) {
  let g = createGame('MIRROR', newPlayer('p', 'Mirror holder', 'emperor'), advanced, ['choam']);
  g.players.push(newPlayer('q', 'Opponent', 'guild'), newPlayer('r', 'Richese', 'richese'));
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.active = 'p';
  g.order = ['p', 'q', 'r'];
  g.storm = 18;
  g.deck = treacheryDeck(['choam']);
  g.richeseCache = richeseCards().filter((card) => card.id !== mirror.id);
  for (const player of g.players) {
    player.hand = [];
    player.forces = {};
    player.reserves = 20;
    player.spice = 20;
    player.traitors = [];
  }
  for (const player of g.players.slice(0, 2)) {
    player.forces = { 'pasty_mesa:5': 5 };
    player.reserves = 15;
  }
  g.players[0].hand = [mirror];
  g = applyAction(g, 'p', { type: 'chooseBattle', territory: 'pasty_mesa', target: 'q' });
  for (const id of ['p', 'q'])
    g = applyAction(g, id, { type: 'battlePreparationReady', event: g.battle!.event });
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, { type: 'declineBattlePower' });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
function give(g: Game, kind: Card['kind'] | 'stoneBurner') {
  const card = kind === 'stoneBurner'
    ? richeseCards().find((item) => item.effect === 'stoneBurner')!
    : g.deck.find((item) => item.kind === kind)!;
  g.players[1].hand.push(card);
  g.deck = g.deck.filter((item) => item.id !== card.id);
  g.richeseCache = g.richeseCache?.filter((item) => item.id !== card.id);
  return card;
}
function reveal(g: Game, source?: Card, ownDial = 2, otherDial = 2) {
  g = applyAction(g, 'p', {
    type: 'battlePlan', dial: ownDial, support: g.advanced ? ownDial : 0,
    leader: g.players[0].leaders[0].id, weapon: mirror.id,
  });
  return applyAction(g, 'q', {
    type: 'battlePlan', dial: otherDial, support: g.advanced ? otherDial : 0,
    leader: g.players[1].leaders[0].id, weapon: source?.id,
  });
}
function finish(g: Game) {
  g = applyAction(g, 'q', { type: 'traitorCall', call: false });
  return applyAction(g, 'p', { type: 'traitorCall', call: false });
}

void test('copied Tooth chooses before its original despite reverse storm order; restored choices keep physical custody', () => {
  let g = fixture();
  const tooth = give(g, 'poisonTooth');
  g.order = ['q', 'p', 'r'];
  g = reveal(g, tooth, 4, 2);
  assert.equal(g.decision?.kind, 'poisonTooth');
  assert.equal(g.decision.player, 'p');
  const reordered = structuredClone(g);
  reordered.decision = { kind: 'poisonTooth', player: 'q', event: g.battle!.event,
    physicalId: tooth.id, copiedFrom: null };
  assert.throws(() => viewGame(reordered, 'q'));
  assert.throws(() => applyAction(reordered, 'q', {
    type: 'decision', event: g.battle!.event, activate: false,
  }));
  const preanswered = structuredClone(g);
  preanswered.battle!.poisonTooth = { q: true };
  assert.throws(() => viewGame(preanswered, 'p'));
  assert.deepEqual(reordered.battle, g.battle);
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'r', { type: 'decision', event: g.battle!.event, activate: true }));
  assert.deepEqual(g, before);
  g = JSON.parse(JSON.stringify(g));
  g = applyAction(g, 'p', { type: 'decision', event: g.battle!.event, activate: true });
  assert.equal(g.decision?.kind, 'poisonTooth');
  assert.equal(g.decision.player, 'q');
  assert.equal(g.battle!.poisonTooth?.p, true);
  const wrong = structuredClone(g);
  assert.throws(() => applyAction(g, 'q', { type: 'decision', event: 'stale', activate: true }));
  assert.deepEqual(g, wrong);
  g = JSON.parse(JSON.stringify(g));
  g = applyAction(g, 'q', { type: 'decision', event: g.battle!.event, activate: false });
  g = finish(g);
  assert.equal(g.lastBattleContext?.winner, 'p');
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.equal(g.decision?.kind, 'battleCards');
  g = applyAction(g, 'p', { type: 'decision', discard: [] });
  assert.equal(g.players[0].hand.filter((card) => card.id === mirror.id).length, 1);
  assert.equal(g.discard.filter((card) => card.id === tooth.id).length, 1);
});

void test('copied Stone has two independent modes in copy-first order and the original never becomes a second Mirror', () => {
  let g = fixture();
  const stone = give(g, 'stoneBurner');
  g = reveal(g, stone, 2, 4);
  assert.equal(g.decision?.kind, 'stoneBurner');
  assert.equal(g.decision.player, 'p');
  const reordered = structuredClone(g);
  reordered.decision = { kind: 'stoneBurner', player: 'q', event: g.battle!.event!,
    physicalId: stone.id, copiedFrom: null };
  assert.throws(() => viewGame(reordered, 'q'));
  const preanswered = structuredClone(g);
  preanswered.battle!.stoneBurner = { q: 'kill' };
  assert.throws(() => viewGame(preanswered, 'p'));
  g = applyAction(g, 'p', { type: 'decision', event: g.battle!.event, mode: 'ignore' });
  assert.equal(g.decision?.kind, 'stoneBurner');
  assert.equal(g.decision.player, 'q');
  g = JSON.parse(JSON.stringify(g));
  g = applyAction(g, 'q', { type: 'decision', event: g.battle!.event, mode: 'kill' });
  g = finish(g);
  assert.equal(g.lastBattleContext?.winner, 'p');
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].dead, true);
  g = applyAction(g, 'p', { type: 'decision', discard: [] });
  assert.equal(g.players[0].hand.filter((card) => card.id === mirror.id).length, 1);
  assert.equal(g.discard.filter((card) => card.id === stone.id).length, 1);
});

void test('all bot profiles can commit legal Mirror plans in Basic and Advanced without inspecting hidden weapons', () => {
  for (const advanced of [false, true])
    for (const difficulty of DIFFICULTIES) {
      const g = fixture(advanced);
      const view = viewGame(g, 'p');
      view.players[0].bot = difficulty;
      const before = structuredClone(view);
      const plans = botActions(view).filter((action) => action.type === 'battlePlan' && action.weapon === mirror.id);
      assert.ok(plans.length, `${difficulty}/${advanced}`);
      for (const plan of plans) assert.doesNotThrow(() => applyAction(g, 'p', plan));
      assert.deepEqual(view, before);
    }
});

void test('inspected ordinary copy is scored as its attack rather than as undialed Stone', () => {
  const g = fixture(true);
  const projectile = give(g, 'projectile');
  const view = viewGame(g, 'p');
  view.battle!.fullPlanInsight = {
    target: 'q',
    plan: { dial: 3, support: 3, leader: g.players[1].leaders[0].id,
      weapon: projectile.id, defense: null },
    cards: [projectile],
  };
  view.players[0].bot = 'Hard';
  const candidate = botActions(view).find((action) =>
    action.type === 'battlePlan' && action.weapon === mirror.id);
  assert.ok(candidate);
  assert.ok(Number(candidate.dial) >= 3,
    'the copied projectile leaves both leaders dead, so the aggressor must dial for the tie');
  assert.doesNotThrow(() => applyAction(g, 'p', candidate));
});

void test('a saved Mirror commitment rejects a changed public module configuration', () => {
  const initial = fixture();
  const sealed = applyAction(initial, 'p', {
    type: 'battlePlan', dial: 1, leader: initial.players[0].leaders[0].id,
    weapon: mirror.id,
  });
  const altered = structuredClone(sealed);
  altered.expansions = ['ix'];
  const before = structuredClone(altered);
  assert.throws(() => viewGame(altered, 'p'));
  assert.throws(() => applyAction(altered, 'q', {
    type: 'battlePlan', dial: 1, leader: altered.players[1].leaders[0].id,
  }));
  assert.deepEqual(altered, before);
});
