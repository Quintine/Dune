import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import type { Card } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { newRevivalRules } from '../game/revival';
import {
  assertTleilaxuSkillsCustody as conserved,
  completedTleilaxuSkillsGame,
  reloadTleilaxuSkillsGame as reload,
  rejectTleilaxuSkillsAction as reject,
  tleilaxuSkillsPlayer as player,
} from './tleilaxu-skills-fixture';

const act = (game: Game, owner: string, action: Action): Game =>
  applyAction(reload(game), owner, action);

function take(game: Game, owner: string, predicate: (card: Card) => boolean): Card {
  const index = game.deck.findIndex(predicate);
  assert.ok(index >= 0, 'The selected physical Treachery Card must exist in the real deck.');
  const [card] = game.deck.splice(index, 1);
  player(game, owner).hand.push(card);
  return card;
}

function passWindow(state: Game): Game {
  let game = state;
  const kind = game.response!.kind;
  for (let step = 0; game.response?.kind === kind && step < 8; step++) {
    const responder = game.players.find((candidate) => !game.response!.passed.includes(candidate.id));
    assert.ok(responder);
    game = act(game, responder.id, { type: 'passResponse' });
  }
  assert.notEqual(game.response?.kind, kind);
  return game;
}

/** Stage conserved armies, then kill the original skilled leader in a real battle. */
function killedOriginalSkill(owner: 't' | 'a' = 't'): Game {
  let game = completedTleilaxuSkillsGame({ skillOwner: owner === 't' ? 'tleilaxu' : 'atreides' });
  for (const p of game.players) {
    game.deck.push(...p.hand);
    p.hand = [];
    p.forces = [owner, 'e'].includes(p.id)
      ? { 'wind_pass:14': 5, 'carthag:11': 1 }
      : { 'polar_sink:0': 1 };
    p.reserves = [owner, 'e'].includes(p.id) ? 14 : 19;
    p.tanks = 0;
    p.spice = 20;
  }
  Object.assign(game, {
    phase: 6, storm: 18, order: [owner, 'e', owner === 't' ? 'a' : 't'],
    active: owner, ready: [], decision: null, response: null, phaseOpening: null,
  });
  const poison = take(game, 'e', (card) => card.kind === 'poison');
  game = act(game, owner, { type: 'chooseBattle', territory: 'wind_pass', target: 'e' });
  for (let step = 0; step < 20; step++) {
    if (game.response) game = passWindow(game);
    else if (game.decision?.kind === 'leaderSkillVisibility') {
      const decision = game.decision;
      game = act(game, decision.player, {
        type: 'leaderSkillVisibility', event: decision.event, hide: true,
      });
    } else if (game.battle?.preparation)
      game = act(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  assert.equal(game.decision, null);
  assert.equal(game.battle?.preparation, undefined);
  const leader = player(game, owner).leaders[0].id;
  game = act(game, owner, { type: 'battlePlan', dial: 0, leader });
  game = act(game, 'e', {
    type: 'battlePlan', dial: 1, leader: 'emperor-1', weapon: poison.id,
  });
  game = act(game, owner, { type: 'traitorCall', call: false });
  game = act(game, 'e', { type: 'traitorCall', call: false });
  for (let step = 0; game.decision && step < 10; step++) {
    const decision = game.decision;
    if (decision.kind === 'battleCards')
      game = act(game, decision.player, { type: 'decision', discard: [] });
    else if (decision.kind === 'faceDance')
      game = act(game, decision.player, { type: 'decision', reveal: false });
    else assert.fail(`Unexpected postbattle choice: ${decision.kind}`);
  }
  assert.equal(player(game, owner).leaders[0].dead, true);
  assert.equal(game.leaderSkills!.assignments.some((assignment) => assignment.owner === owner), false);
  assert.equal(game.leaderSkills!.deck.filter((skill) => skill === 'warmaster').length, 1);
  assert.equal(game.leaderSkills!.offers[owner], undefined);
  conserved(game);
  return game;
}

/** A clean Revival boundary retains every card, disc and force from the battle. */
function revivalGame(owner: 't' | 'a' = 't', heldKarama = false): Game {
  const game = killedOriginalSkill(owner);
  Object.assign(game, {
    phase: 4, active: null, ready: [], decision: null, response: null,
    phaseOpening: null, revivalRules: newRevivalRules(),
  });
  for (const p of game.players) p.leaderRevived = false;
  if (heldKarama) take(game, 'e', (card) => card.effect === 'karama');
  conserved(game);
  return game;
}

function reviveOwn(game: Game): Game {
  return act(game, 't', { type: 'reviveLeader', leader: 'tleilaxu-0' });
}

function negotiatedRevival(game: Game, amount = 7): Game {
  game = act(game, 'a', { type: 'requestLeaderRevival', leader: 'atreides-0' });
  game = act(game, 't', { type: 'quoteLeaderRevival', target: 'a', amount });
  return act(game, 'a', { type: 'acceptLeaderRevival' });
}

function assertOffer(game: Game, owner: 't' | 'a'): string {
  const offer = game.leaderSkills!.offers[owner];
  assert.ok(offer);
  assert.equal(offer.leader, player(game, owner).leaders[0].id);
  assert.deepEqual(offer.cards, []);
  for (const viewer of game.players) {
    const projection = viewGame(reload(game), viewer.id);
    assert.deepEqual(projection.leaderSkills!.offer, viewer.id === owner ? offer : null);
    assert.equal('deck' in projection.leaderSkills!, false);
    assert.equal('offers' in projection.leaderSkills!, false);
  }
  conserved(game);
  return offer.event;
}

void test('genuine Basic Tleilaxu battle death returns the original physical skill exactly once', () => {
  const game = killedOriginalSkill();
  const restored = normalizeAutomaticGame(reload(game));
  assert.deepEqual(restored, game);
  assert.equal(game.log.filter((entry) => entry.text.includes('Warmaster returned')).length, 1);
  assert.equal(player(game, 't').faceDancers!.length, 3);
  assert.deepEqual(player(game, 't').traitors, []);
  conserved(restored);
});

void test('automatic Tleilaxu early permission and discount keep a private undrawn skill offer after own revival', () => {
  const before = revivalGame();
  const previousDeck = [...before.leaderSkills!.deck];
  const original = player(before, 't').leaders[0];
  const cost = Math.ceil(original.strength / 2);
  const game = reviveOwn(before);
  assert.equal(game.response, null);
  assert.equal(game.pendingRevival, null);
  assert.equal(player(game, 't').leaders[0].dead, false);
  assert.equal(player(game, 't').spice, player(before, 't').spice - cost);
  assert.equal(player(game, 'e').spice, player(before, 'e').spice);
  assert.equal(game.decision?.kind, 'leaderSkillRevival');
  assertOffer(game, 't');
  assert.deepEqual(game.leaderSkills!.deck, previousDeck, 'An optional draw must not preview or remove cards.');
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  assert.equal(before.leaderSkills!.offers.t, undefined, 'Applying revival must leave its input unchanged.');
});

void test('held Karama preserves early permission and discount as separate saved windows before the own-leader offer', () => {
  const before = revivalGame('t', true);
  let game = reviveOwn(before);
  assert.equal(game.response?.kind, 'earlyRevival');
  assert.equal(player(game, 't').leaders[0].dead, true);
  assert.equal(game.leaderSkills!.offers.t, undefined);
  assert.equal(player(game, 't').spice, player(before, 't').spice);
  reject(game, 't', { type: 'leaderSkill', event: 'not-yet-created', mode: 'draw' });
  game = passWindow(game);
  assert.equal(game.response?.kind, 'revivalDiscount');
  assert.equal(player(game, 't').leaders[0].dead, true);
  assert.equal(game.leaderSkills!.offers.t, undefined);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  game = passWindow(game);
  assert.equal(game.response, null);
  assert.equal(game.decision?.kind, 'leaderSkillRevival');
  const event = assertOffer(game, 't');
  const restored = normalizeAutomaticGame(normalizeAutomaticGame(reload(game)));
  assert.equal(restored.leaderSkills!.offers.t.event, event);
  assert.deepEqual(restored, game);
});

void test('declining the optional own-leader skill draw keeps deck order and never reopens after JSON normalization', () => {
  let game = reviveOwn(revivalGame());
  const event = assertOffer(game, 't');
  const deck = [...game.leaderSkills!.deck];
  game = act(game, 't', { type: 'leaderSkill', event, mode: 'decline' });
  assert.equal(game.decision, null);
  assert.equal(game.leaderSkills!.offers.t, undefined);
  assert.deepEqual(game.leaderSkills!.deck, deck);
  assert.equal(game.leaderSkills!.assignments.some((assignment) => assignment.owner === 't'), false);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  reject(game, 't', { type: 'leaderSkill', event, mode: 'draw' });
  conserved(game);
});

void test('saved optional draw rejects stale, alien and wrong-leader choices and binds one dealt card to the same revived disc', () => {
  let game = reviveOwn(revivalGame());
  const event = assertOffer(game, 't');
  reject(game, 'e', { type: 'leaderSkill', event, mode: 'draw' });
  reject(game, 't', { type: 'leaderSkill', event: `${event}-old`, mode: 'draw' });
  reject(game, 't', { type: 'leaderSkill', event, skill: game.leaderSkills!.deck[0], leader: 'tleilaxu-0' });
  const deck = [...game.leaderSkills!.deck];
  game = act(game, 't', { type: 'leaderSkill', event, mode: 'draw' });
  assert.deepEqual(game.leaderSkills!.offers.t.cards, deck.slice(0, 2));
  assert.deepEqual(game.leaderSkills!.deck, deck.slice(2));
  assert.equal(viewGame(reload(game), 'e').leaderSkills!.offer, null);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  const [chosen, returned] = game.leaderSkills!.offers.t.cards;
  reject(game, 't', { type: 'leaderSkill', event, mode: 'draw' });
  reject(game, 't', { type: 'leaderSkill', event, mode: 'decline' });
  reject(game, 't', { type: 'leaderSkill', event, skill: chosen, leader: 'tleilaxu-1' });
  reject(game, 't', { type: 'leaderSkill', event, skill: chosen, leader: 'emperor-0' });
  reject(game, 't', { type: 'leaderSkill', event, skill: game.leaderSkills!.deck[0], leader: 'tleilaxu-0' });
  game = act(game, 't', { type: 'leaderSkill', event, skill: chosen, leader: 'tleilaxu-0' });
  assert.equal(game.decision, null);
  assert.equal(game.leaderSkills!.offers.t, undefined);
  assert.deepEqual(game.leaderSkills!.assignments.find((assignment) => assignment.owner === 't'), {
    owner: 't', leader: 'tleilaxu-0', skill: chosen,
  });
  assert.equal(game.leaderSkills!.deck.filter((skill) => skill === returned).length, 1);
  assert.equal(game.leaderSkills!.deck.includes(chosen), false);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  reject(game, 't', { type: 'leaderSkill', event, skill: chosen, leader: 'tleilaxu-0' });
  conserved(game);
});

for (const heldKarama of [false, true])
  void test(`negotiated original-leader revival retains one offer through native Tleilaxu income ${heldKarama ? 'with held Karama' : 'automatically'}`, () => {
    const before = revivalGame('a', heldKarama);
    let game = negotiatedRevival(before);
    if (heldKarama) {
      assert.equal(game.response?.kind, 'earlyRevival');
      assert.equal(game.leaderSkills!.offers.a, undefined);
      assert.equal(player(game, 'a').leaders[0].dead, true);
      game = passWindow(game);
      assert.equal(game.response?.kind, 'revivalIncome');
      assert.equal(player(game, 't').spice, player(before, 't').spice);
      const event = assertOffer(game, 'a');
      reject(game, 'a', { type: 'leaderSkill', event, mode: 'draw' });
      game = passWindow(game);
      assert.equal(assertOffer(game, 'a'), event);
    }
    assert.equal(game.response, null);
    assert.equal(game.pendingRevival, null);
    assert.equal(game.decision?.kind, 'leaderSkillRevival');
    assert.equal(player(game, 'a').leaders[0].dead, false);
    assert.equal(player(game, 'a').spice, player(before, 'a').spice - 7);
    assert.equal(player(game, 't').spice, player(before, 't').spice + 7);
    assertOffer(game, 'a');
    assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
    conserved(game);
  });

for (const owner of ['t', 'a'] as const)
  void test(`Karama cancellation of ${owner === 't' ? 'native Tleilaxu' : 'negotiated opponent'} early permission leaves the leader dead and creates no skill offer`, () => {
    const before = revivalGame(owner, true);
    let game = owner === 't' ? reviveOwn(before) : negotiatedRevival(before);
    assert.equal(game.response?.kind, 'earlyRevival');
    const karama = player(game, 'e').hand.find((card) => card.effect === 'karama')!;
    game = act(game, 'e', { type: 'card', card: karama.id, mode: 'cancel' });
    assert.equal(game.pendingRevival, null);
    assert.equal(game.response, null);
    assert.equal(game.decision, null);
    assert.equal(player(game, owner).leaders[0].dead, true);
    assert.equal(game.leaderSkills!.offers[owner], undefined);
    assert.equal(player(game, owner).spice, player(before, owner).spice);
    assert.equal(player(game, 't').spice, player(before, 't').spice);
    assert.equal(game.discard.filter((card) => card.id === karama.id).length, 1);
    assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
    conserved(game);
  });

void test('canceling an unaffordable Tleilaxu discount aborts before revival and cannot create a skill offer', () => {
  const before = revivalGame('t', true);
  player(before, 't').spice = Math.ceil(player(before, 't').leaders[0].strength / 2);
  let game = passWindow(reviveOwn(before));
  assert.equal(game.response?.kind, 'revivalDiscount');
  const karama = player(game, 'e').hand.find((card) => card.effect === 'karama')!;
  game = act(game, 'e', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(game.pendingRevival, null);
  assert.equal(player(game, 't').leaders[0].dead, true);
  assert.equal(player(game, 't').spice, player(before, 't').spice);
  assert.equal(game.leaderSkills!.offers.t, undefined);
  assert.equal(game.decision, null);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  conserved(game);
});

void test('each AI level can complete the private original-leader draw with legal saved actions', () => {
  const revived = reviveOwn(revivalGame());
  for (const difficulty of DIFFICULTIES) {
    let game = reload(revived);
    player(game, 't').bot = difficulty;
    for (let step = 0; game.leaderSkills!.offers.t && step < 3; step++) {
      const action = botActions(viewGame(reload(game), 't'))[0];
      assert.ok(action);
      assert.equal(action.type, 'leaderSkill');
      game = act(game, 't', action);
    }
    assert.equal(game.leaderSkills!.offers.t, undefined, difficulty);
    assert.equal(game.decision, null);
    assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
    conserved(game);
  }
});
