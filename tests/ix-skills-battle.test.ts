import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import {
  completedIxSkillsGame,
  assertIxSkillsCustody as custody,
  ixSkillsPlayer as player,
  reloadIxSkillsGame as reload,
  rejectIxSkillsAction as reject,
} from './ix-skills-fixture';

const act = (game: Game, owner: string, action: Action) => applyAction(reload(game), owner, action);
function stable(game: Game) {
  custody(game);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
}

/** Conserved battle positions after real setup; these are not claimed played phase histories. */
function stage(skill: LeaderSkillId, location = 'wind_pass:14') {
  const game = completedIxSkillsGame({ requestedSkill: skill });
  for (const p of game.players) {
    game.deck.push(...p.hand);
    p.hand = [];
    p.forces = p.id === 't' ? {} : { [location]: 8, 'carthag:11': 1 };
    p.reserves = p.id === 't' ? 20 : 11;
    p.tanks = 0;
    p.battleLosses = 0;
    p.spice = 20;
  }
  player(game, 'i').elites = { reserves: 5, tanks: 0, forces: { [location]: 2 }, revived: 0 };
  Object.assign(game, { phase: 6, active: 'i', order: ['i', 'e', 't'], storm: 18,
    ready: [], decision: null, response: null, phaseOpening: null, spice: {} });
  return game;
}

function take(game: Game, owner: string, predicate: (card: Game['deck'][number]) => boolean) {
  const index = game.deck.findIndex(predicate);
  assert.ok(index >= 0);
  const card = game.deck.splice(index, 1)[0];
  player(game, owner).hand.push(card);
  return card;
}

function passResponses(game: Game) {
  for (let step = 0; game.response && step < 20; step++) {
    const p = game.players.find(candidate => !game.response!.passed.includes(candidate.id));
    assert.ok(p);
    game = act(game, p.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}

function open(game: Game, territory = 'wind_pass') {
  game = act(game, 'i', { type: 'chooseBattle', territory, target: 'e' });
  for (let step = 0; step < 30; step++) {
    if (game.response) game = passResponses(game);
    else if (game.decision?.kind === 'leaderSkillVisibility')
      game = act(game, game.decision.player, { type: 'leaderSkillVisibility', event: game.decision.event, hide: true });
    else if (game.battle?.preparation)
      game = act(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  assert.equal(game.decision, null);
  assert.equal(game.battle?.preparation, undefined);
  return game;
}

function resolve(game: Game, own: Partial<Action> = {}, territory = 'wind_pass') {
  game = open(game, territory);
  game = act(game, 'i', { type: 'battlePlan', dial: 6, leader: player(game, 'i').leaders[0].id, ...own });
  game = act(game, 'e', { type: 'battlePlan', dial: 0, leader: player(game, 'e').leaders[4].id });
  game = act(game, 'i', { type: 'traitorCall', call: false });
  game = act(game, 'e', { type: 'traitorCall', call: false });
  if (game.decision?.kind === 'battleLosses') {
    const choice = game.decision.options.findIndex(option => option.normal === 4 && option.elite === 2);
    assert.ok(choice >= 0);
    game = act(game, 'i', { type: 'decision', choice });
  }
  return game;
}

function finishSubstitution(game: Game, outcome: 'allow' | 'cancel' | 'decline', karama?: string) {
  assert.equal(game.decision?.kind, 'ixSubstitution');
  if (outcome === 'decline') return act(game, 'i', { type: 'decision', decline: true });
  game = act(game, 'i', { type: 'decision', sources: { 'wind_pass:14': 1 }, recover: { 'wind_pass:14': 1 } });
  assert.equal(game.response?.kind, 'ixSubstitution');
  stable(game);
  if (outcome === 'cancel') {
    assert.ok(karama);
    return passResponses(act(game, 'e', { type: 'card', card: karama, mode: 'cancel' }));
  }
  return passResponses(game);
}

void test('Ixian Rihani completes its private exchange before native cyborg substitution and optional winner cleanup', () => {
  for (const outcome of ['allow', 'cancel', 'decline'] as const) {
    let game = stage('rihani-decipherer');
    const shield = take(game, 'i', card => card.kind === 'shield');
    const karama = take(game, 'e', card => card.effect === 'karama');
    game = resolve(game, { defense: shield.id });
    assert.equal(game.decision?.kind, 'rihani');
    assert.deepEqual(game.pendingIxSubstitution?.losses, { 'wind_pass:14': 2 });
    assert.equal(game.pendingIxSubstitution?.sources, undefined);
    assert.equal(player(game, 'i').elites!.tanks, 2);
    stable(game);
    const event = game.rihaniHistory!.at(-1)!.event;
    reject(game, 'i', { type: 'decision', sources: { 'wind_pass:14': 1 }, recover: { 'wind_pass:14': 1 } });
    if (outcome === 'decline') game = act(game, 'i', { type: 'decision', event, draw: false });
    else {
      game = act(game, 'i', { type: 'decision', event, draw: true });
      const receipt = game.rihaniHistory!.at(-1)!;
      assert.equal(receipt.stage, 'return');
      assert.deepEqual(viewGame(game, 'e').rihani!.history, []);
      stable(game);
      game = act(game, 'i', { type: 'decision', event, cards: [receipt.drawn[0], receipt.eligible[0]] });
    }
    const history = structuredClone(game.rihaniHistory);
    assert.equal(game.lastBattleContext!.rihani!.completed, true);
    stable(game);
    game = finishSubstitution(game, outcome, karama.id);
    assert.equal(game.pendingIxSubstitution, null);
    assert.deepEqual(game.decision, { kind: 'battleCards', player: 'i', territory: 'wind_pass', cards: [shield.id] });
    assert.equal(player(game, 'i').elites!.tanks, outcome === 'allow' ? 1 : 2);
    assert.equal(player(game, 'i').elites!.forces['wind_pass:14'] ?? 0, outcome === 'allow' ? 1 : 0);
    assert.deepEqual(game.rihaniHistory, history);
    stable(game);
    game = act(game, 'i', { type: 'decision', discard: [] });
    assert.equal(game.rihaniHistory!.length, 1);
    assert.equal(player(game, 'i').hand.some(card => card.id === shield.id), true);
    stable(game);
  }
});

void test('a delayed Ixian substitution preserves its original losses and cannot be removed or selected during Rihani', () => {
  const game = resolve(stage('rihani-decipherer'));
  assert.equal(game.decision?.kind, 'rihani');
  const event = game.rihaniHistory!.at(-1)!.event;
  const mutations: ((saved: Game) => void)[] = [
    saved => { saved.pendingIxSubstitution!.losses = { 'wind_pass:15': 2 }; },
    saved => { saved.pendingIxSubstitution!.sources = { 'wind_pass:14': 1 }; },
    saved => { saved.pendingIxSubstitution!.recover = { 'wind_pass:14': 1 }; },
    saved => { saved.pendingIxSubstitution = null; },
    saved => { player(saved, 'i').elites!.tanks--; player(saved, 'i').elites!.reserves++; },
  ];
  for (const mutate of mutations) {
    const saved = reload(game);
    mutate(saved);
    reject(saved, 'i', { type: 'decision', event, draw: false });
  }
  const restored = act(game, 'i', { type: 'decision', event, draw: false });
  assert.equal(restored.decision?.kind, 'ixSubstitution');
  assert.deepEqual(restored.pendingIxSubstitution!.losses, { 'wind_pass:14': 2 });
  stable(restored);
});

void test('an accepted Ixian substitution freezes matching source and recovery counts through its response', () => {
  let game = stage('sandmaster');
  take(game, 'e', card => card.effect === 'karama');
  game = resolve(game);
  game = act(game, 'i', { type: 'decision', sources: { 'wind_pass:14': 1 }, recover: { 'wind_pass:14': 1 } });
  assert.equal(game.response?.kind, 'ixSubstitution');
  for (const changeBoth of [false, true]) {
    const saved = reload(game);
    saved.pendingIxSubstitution!.recover = { 'wind_pass:14': 2 };
    if (changeBoth) saved.pendingIxSubstitution!.sources = { 'wind_pass:14': 2 };
    const voter = saved.players.find(p => !saved.response!.passed.includes(p.id));
    assert.ok(voter);
    reject(saved, voter.id, { type: 'passResponse' });
  }
  stable(game);
});

void test('every Ixian substitution outcome resumes mandatory Planetologist disposal before optional winner cards', () => {
  const cases = [
    ...(['allow', 'cancel', 'decline'] as const).map(outcome => ({ outcome, card: 'treachery-24' })),
    { outcome: 'allow', card: 'ix-thumper' },
    { outcome: 'cancel', card: 'ix-harvester' },
    { outcome: 'decline', card: 'ix-amal' },
  ] as const;
  for (const { outcome, card } of cases) {
    let game = stage('planetologist');
    const special = take(game, 'i', candidate => candidate.id === card);
    const shield = take(game, 'i', card => card.kind === 'shield');
    const karama = take(game, 'e', card => card.effect === 'karama');
    game = resolve(game, { weapon: special.id, defense: shield.id });
    assert.equal(game.decision?.kind, 'ixSubstitution');
    assert.equal(game.pendingWinnerDiscards!.cards.includes(special.id), true);
    assert.equal(player(game, 'i').hand.some(card => card.id === special.id), true);
    assert.equal(game.discard.some(card => card.id === special.id), false);
    stable(game);
    game = finishSubstitution(game, outcome, karama.id);
    assert.equal(game.pendingIxSubstitution, null);
    assert.equal(game.pendingWinnerDiscards, null);
    assert.equal(game.lastBattleContext!.winnerDiscards!.completed, true);
    assert.deepEqual(game.decision, { kind: 'battleCards', player: 'i', territory: 'wind_pass', cards: [shield.id] });
    assert.equal(game.discard.filter(card => card.id === special.id).length, 1);
    reject(game, 'i', { type: 'decision', discard: [special.id] });
    stable(game);
    game = act(game, 'i', { type: 'decision', discard: [shield.id] });
    assert.equal(game.discard.filter(card => card.id === special.id).length, 1);
    assert.equal(game.discard.filter(card => card.id === shield.id).length, 1);
    stable(game);
  }
});

void test('a battle inside the HMS never uses spice in the territory beneath its pointer', () => {
  for (const skill of ['smuggler', 'sandmaster'] as const) {
    let game = stage(skill, MOBILE_LOCATION);
    game.mobileStronghold!.location = 'wind_pass:14';
    game.spice = { 'wind_pass:14': 8 };
    game = resolve(game, { dial: 0 }, MOBILE_STRONGHOLD);
    assert.equal(game.lastBattleContext!.territory, MOBILE_STRONGHOLD);
    assert.deepEqual(game.spice, { 'wind_pass:14': 8 });
    assert.equal(player(game, 'i').spice, 20);
    assert.equal(game.pendingIxSubstitution, undefined);
    stable(game);
  }
});

for (const rescue of [true, false]) {
  void test(rescue
    ? 'Ixian Suk rescues a suboid in place and cyborg to reserves before substituting only the remaining dead cyborg'
    : 'declining skilled Ixian Suk rescue leaves both original cyborg casualties available for substitution', () => {
    let game = stage('suk-graduate');
    take(game, 'e', card => card.effect === 'karama');
    game = resolve(game);
    const decision = game.decision;
    assert.equal(decision?.kind, 'sukRescue');
    if (decision?.kind !== 'sukRescue') throw new Error('Expected the original Suk rescue');
    assert.deepEqual(game.pendingSukRescue!.losses, { normal: 4, elite: 2, paidNormal: 0, paidElite: 0 });
    assert.equal(game.pendingIxSubstitution, undefined);
    assert.equal(player(game, 'i').tanks, 0);
    stable(game);
    const choice = decision.options.findIndex(option => rescue
      ? option.normal === 1 && option.elite === 1 && option.kept?.kind === 'normal' && option.kept.key === 'wind_pass:14'
      : option.normal === 0 && option.elite === 0 && option.kept === null);
    assert.ok(choice >= 0);
    game = act(game, 'i', { type: 'decision', event: decision.event, choice });
    const recover = rescue ? 1 : 2;
    assert.equal(game.pendingSukRescue, null);
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(game.decision?.kind, 'ixSubstitution');
    assert.deepEqual(game.pendingIxSubstitution!.losses, { 'wind_pass:14': recover });
    assert.equal(player(game, 'i').elites!.reserves, rescue ? 6 : 5);
    assert.equal(player(game, 'i').elites!.tanks, recover);
    assert.equal(player(game, 'i').forces['wind_pass:14'], rescue ? 3 : 2);
    assert.equal(player(game, 'i').tanks, rescue ? 4 : 6);
    stable(game);
    if (rescue) reject(game, 'i', { type: 'decision', sources: { 'wind_pass:14': 2 }, recover: { 'wind_pass:14': 2 } });
    game = act(game, 'i', { type: 'decision', sources: { 'wind_pass:14': recover }, recover: { 'wind_pass:14': recover } });
    assert.equal(game.response?.kind, 'ixSubstitution');
    stable(game);
    game = passResponses(game);
    assert.equal(game.pendingIxSubstitution, null);
    assert.equal(game.lastBattleContext!.ixSubstitution!.completed, true);
    assert.equal(player(game, 'i').elites!.reserves, rescue ? 6 : 5);
    assert.equal(player(game, 'i').elites!.tanks, 0);
    assert.equal(player(game, 'i').elites!.forces['wind_pass:14'], recover);
    assert.equal(player(game, 'i').forces['wind_pass:14'], rescue ? 3 : 2);
    assert.equal(player(game, 'i').tanks, rescue ? 4 : 6);
    stable(game);
  });
}
