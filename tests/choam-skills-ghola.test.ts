import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  assertChoamSkillsCustody as custody,
  choamSkillsPlayer as player,
  reloadChoamSkillsGame as reload,
  rejectChoamSkillsAction as reject,
} from './choam-skills-fixture';
import { actChoamGhola as act, passChoamGholaResponses, stagedMarketGhola } from './choam-skills-ghola-fixture';

function stable(game: Game) {
  custody(game);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
}

void test('market Ghola waits for the own revived leader skill offer before restoring its declared sale', () => {
  const staged = stagedMarketGhola();
  const { owner, opponent, leader, ghola, sale } = staged;
  let game = staged.game;
  stable(game);
  const originalResponse = structuredClone(game.response);
  const originalMarket = structuredClone(game.choamMarket);
  const spice = player(game, owner).spice;
  game = act(game, owner, { type: 'card', card: ghola, leader });
  assert.equal(player(game, owner).leaders.find(candidate => candidate.id === leader)!.dead, false);
  assert.equal(player(game, owner).leaders.find(candidate => candidate.id === leader)!.usedAt, undefined);
  assert.equal(player(game, owner).spice, spice, 'Ghola is free.');
  assert.equal(game.discard.filter(card => card.id === ghola).length, 1);
  assert.equal(game.response, null, 'The sale waits while the replacement offer is undecided.');
  assert.equal(game.decision?.kind, 'leaderSkillRevival');
  assert.deepEqual(game.pendingChoamMarketGhola?.response, originalResponse);
  assert.deepEqual(game.choamMarket, originalMarket);
  assert.equal(game.pendingChoamMarketGhola?.stage, 'complete');
  const offer = game.leaderSkills!.offers[owner];
  assert.deepEqual(offer.cards, []);
  assert.equal(offer.leader, leader);
  assert.deepEqual(viewGame(game, owner).leaderSkills!.offer, offer);
  assert.equal(viewGame(game, opponent).leaderSkills!.offer, null);
  stable(game);
  reject(game, opponent, { type: 'leaderSkill', event: offer.event, mode: 'draw' });
  game = act(game, owner, { type: 'leaderSkill', event: offer.event, mode: 'draw' });
  assert.equal(game.response, null);
  const drawn = game.leaderSkills!.offers[owner].cards;
  assert.equal(drawn.length, 2);
  assert.equal(viewGame(game, opponent).leaderSkills!.offer, null);
  reject(game, owner, { type: 'leaderSkill', event: offer.event, mode: 'decline' });
  reject(game, owner, { type: 'leaderSkill', event: offer.event, skill: drawn[0], leader: player(game, owner).leaders.find(candidate => candidate.id !== leader)!.id });
  stable(game);
  game = act(game, owner, { type: 'leaderSkill', event: offer.event, skill: drawn[0], leader });
  assert.deepEqual(game.response, originalResponse);
  assert.equal(game.pendingChoamMarketGhola, null);
  assert.equal(game.leaderSkills!.offers[owner], undefined);
  assert.equal(game.leaderSkills!.assignments.find(assignment => assignment.owner === owner)!.leader, leader);
  stable(game);
  reject(game, owner, { type: 'leaderSkill', event: offer.event, mode: 'draw' });
  game = passChoamGholaResponses(game);
  assert.equal(game.decision?.kind, 'choamMarket');
  assert.equal(player(game, owner).spice, spice + 2);
  assert.equal(game.discard.filter(card => card.id === sale).length, 1);
  assert.equal(game.discard.filter(card => card.id === ghola).length, 1);
  stable(game);
});

void test('declining the Ghola replacement and canceling its restored sale preserve the sunk Ghola and living unskilled leader', () => {
  const staged = stagedMarketGhola();
  const { owner, opponent, leader, ghola, sale, karama, lostSkill } = staged;
  let game = staged.game;
  // A response pass predating the interruption must not be forgotten on restore.
  game = act(game, owner, { type: 'passResponse' });
  const originalResponse = structuredClone(game.response);
  const spice = Object.fromEntries(game.players.map(candidate => [candidate.id, candidate.spice]));
  const forces = Object.fromEntries(game.players.map(candidate => [candidate.id, {
    forces: candidate.forces, reserves: candidate.reserves, tanks: candidate.tanks,
  }]));
  game = act(game, owner, { type: 'card', card: ghola, leader });
  assert.equal(game.decision?.kind, 'leaderSkillRevival');
  const event = game.leaderSkills!.offers[owner].event;
  stable(game);
  game = act(game, owner, { type: 'leaderSkill', event, mode: 'decline' });
  assert.deepEqual(game.response, originalResponse);
  assert.equal(game.pendingChoamMarketGhola, null);
  assert.equal(game.leaderSkills!.offers[owner], undefined);
  assert.equal(game.leaderSkills!.assignments.some(assignment => assignment.owner === owner), false);
  assert.equal(game.leaderSkills!.deck.filter(skill => skill === lostSkill).length, 1);
  stable(game);
  game = act(game, opponent, { type: 'card', card: karama, mode: 'cancel' });
  game = passChoamGholaResponses(game);
  assert.equal(game.decision?.kind, 'choamMarket');
  assert.equal(player(game, owner).leaders.find(candidate => candidate.id === leader)!.dead, false);
  assert.equal(game.discard.filter(card => card.id === ghola).length, 1);
  assert.equal(game.discard.filter(card => card.id === karama).length, 1);
  assert.equal(game.discard.some(card => card.id === sale), false);
  assert.equal(player(game, owner).hand.some(card => card.id === sale), true);
  assert.deepEqual(Object.fromEntries(game.players.map(candidate => [candidate.id, candidate.spice])), spice);
  assert.deepEqual(Object.fromEntries(game.players.map(candidate => [candidate.id, {
    forces: candidate.forces, reserves: candidate.reserves, tanks: candidate.tanks,
  }])), forces);
  assert.equal(game.log.filter(entry => entry.automatic?.name === 'Leader Skill lost').length, 1);
  stable(game);
  reject(game, owner, { type: 'leaderSkill', event, mode: 'decline' });
  reject(game, owner, { type: 'decision', mode: 'sell', card: sale });
  game = act(game, owner, { type: 'decision', done: true });
  assert.equal(game.phase, 7);
  assert.equal(game.choamMarket, null);
  assert.equal(game.pendingChoamMarketGhola, null);
  assert.equal(game.leaderSkills!.offers[owner], undefined);
  stable(game);
});

void test('invalid Ghola leader targets cannot consume the card, create a replacement offer or alter the pending sale', () => {
  const { game, owner, opponent, leader, ghola } = stagedMarketGhola();
  const targets = ['missing-leader', player(game, owner).leaders.find(candidate => !candidate.dead)!.id,
    player(game, opponent).leaders[0].id];
  for (const target of targets)
    reject(game, owner, { type: 'card', card: ghola, leader: target }, /dead leader|eligible leader/i);
  reject(game, opponent, { type: 'card', card: ghola, leader }, /Karama|card|response/i);
  const captured = reload(game);
  player(captured, owner).leaders.find(candidate => candidate.id === leader)!.capturedBy = opponent;
  // A malformed saved captured target is rejected before any physical disposal.
  reject(captured, owner, { type: 'card', card: ghola, leader });
  assert.equal(game.leaderSkills!.offers[owner], undefined);
  assert.equal(game.pendingChoamMarketGhola, undefined);
  assert.equal(player(game, owner).hand.some(card => card.id === ghola), true);
  stable(game);
});

void test('the interrupted sale receipt stays bound to its actor and physical Ghola through the private skill choice', () => {
  const staged = stagedMarketGhola();
  const { owner, opponent, leader, ghola, sale } = staged;
  const game = act(staged.game, owner, { type: 'card', card: ghola, leader });
  assert.equal(game.decision?.kind, 'leaderSkillRevival');
  const event = game.leaderSkills!.offers[owner].event;
  const mutations: ((saved: Game) => void)[] = [
    saved => { saved.pendingChoamMarketGhola!.player = opponent; },
    saved => { saved.pendingChoamMarketGhola!.card = sale; },
    saved => { saved.pendingChoamMarketGhola!.discardSequence = 0; },
    saved => { saved.pendingChoamMarketGhola!.market.sale!.price++; },
  ];
  for (const mutate of mutations) {
    const saved = reload(game);
    mutate(saved);
    const before = structuredClone(saved);
    reject(saved, owner, { type: 'leaderSkill', event, mode: 'decline' });
    assert.throws(() => viewGame(saved, owner));
    assert.throws(() => normalizeAutomaticGame(saved));
    assert.deepEqual(saved, before);
  }
  stable(game);
});

void test('all four bot profiles can finish both private replacement stages without duplicating market settlement', () => {
  const staged = stagedMarketGhola();
  const { owner, leader, ghola, sale } = staged;
  const interrupted = act(staged.game, owner, { type: 'card', card: ghola, leader });
  for (const difficulty of DIFFICULTIES) {
    let game = reload(interrupted);
    for (let stage = 0; stage < 2; stage++) {
      assert.equal(game.decision?.kind, 'leaderSkillRevival');
      const view = viewGame(game, owner);
      view.players.find(candidate => candidate.id === owner)!.bot = difficulty;
      const action = botActions(view).find(candidate => candidate.type === 'leaderSkill');
      assert.ok(action, `${difficulty} has a legal replacement action at stage ${stage}.`);
      for (const other of game.players.filter(candidate => candidate.id !== owner)) {
        const otherView = viewGame(game, other.id);
        otherView.players.find(candidate => candidate.id === other.id)!.bot = difficulty;
        assert.equal(otherView.leaderSkills!.offer, null);
        assert.equal(botActions(otherView).some(candidate => candidate.type === 'leaderSkill'), false);
      }
      game = act(game, owner, action);
      stable(game);
    }
    assert.equal(game.response?.kind, 'choamSale');
    assert.equal(game.pendingChoamMarketGhola, null);
    game = passChoamGholaResponses(game);
    assert.equal(game.discard.filter(card => card.id === ghola).length, 1);
    assert.equal(game.discard.filter(card => card.id === sale).length, 1);
    assert.equal(player(game, owner).spice, player(interrupted, owner).spice + 2);
    stable(game);
  }
});

void test('the market Ghola cannot change its revived leader, replace its skill event or omit the pending choice', () => {
  const staged = stagedMarketGhola();
  const { owner, leader, ghola } = staged;
  const game = act(staged.game, owner, { type: 'card', card: ghola, leader });
  const event = game.leaderSkills!.offers[owner].event;
  assert.equal(game.pendingChoamMarketGhola!.leaderSkill!.leader, leader);
  assert.equal(game.pendingChoamMarketGhola!.leaderSkill!.offer, event);
  assert.equal(game.pendingChoamMarketGhola!.leaderSkill!.completed, false);
  const wrongLeader = player(game, owner).leaders.find(candidate => candidate.id !== leader)!.id;
  const mutations: ((saved: Game) => void)[] = [
    saved => { saved.leaderSkills!.offers[owner].leader = wrongLeader; },
    saved => {
      saved.leaderSkills!.offers[owner].event = 'changed-skill-event';
      if (saved.decision?.kind === 'leaderSkillRevival') saved.decision.event = 'changed-skill-event';
    },
    saved => { saved.decision = null; },
    saved => { delete saved.leaderSkills!.offers[owner]; },
    saved => { delete saved.leaderSkills!.offers[owner]; saved.decision = null; },
    saved => { delete saved.pendingChoamMarketGhola!.leaderSkill; },
    saved => { saved.pendingChoamMarketGhola = null; },
    saved => { saved.pendingChoamMarketGhola!.leaderSkill!.leader = wrongLeader; },
    saved => { saved.pendingChoamMarketGhola!.leaderSkill!.offer = 'changed-skill-event'; },
    saved => { saved.pendingChoamMarketGhola!.leaderSkill!.completed = true; },
  ];
  for (const mutate of mutations) {
    const saved = reload(game);
    mutate(saved);
    const before = structuredClone(saved);
    reject(saved, owner, { type: 'leaderSkill', event, mode: 'draw' });
    assert.throws(() => viewGame(saved, owner));
    assert.throws(() => normalizeAutomaticGame(saved));
    assert.deepEqual(saved, before);
  }
  const drawn = act(game, owner, { type: 'leaderSkill', event, mode: 'draw' });
  const missing = reload(drawn);
  // Preserve all fourteen physical cards while trying to erase the required choice.
  missing.leaderSkills!.deck.push(...missing.leaderSkills!.offers[owner].cards);
  delete missing.leaderSkills!.offers[owner];
  missing.decision = null;
  custody(missing);
  reject(missing, owner, { type: 'passResponse' });
  assert.throws(() => normalizeAutomaticGame(missing));
  stable(drawn);
});

void test('market Ghola reviving an unskilled own leader preserves the existing assignment and creates no replacement offer', () => {
  const staged = stagedMarketGhola(undefined, true);
  const { owner, leader, ghola, sale } = staged;
  const skills = structuredClone(staged.game.leaderSkills);
  const response = structuredClone(staged.game.response);
  let game = act(staged.game, owner, { type: 'card', card: ghola, leader });
  assert.deepEqual(game.leaderSkills, skills);
  assert.equal(player(game, owner).leaders.find(candidate => candidate.id === leader)!.dead, false);
  assert.equal(game.pendingChoamMarketGhola, null);
  assert.deepEqual(game.response, response);
  assert.equal(game.decision, null);
  stable(game);
  game = passChoamGholaResponses(game);
  assert.equal(game.discard.filter(card => card.id === ghola).length, 1);
  assert.equal(game.discard.filter(card => card.id === sale).length, 1);
  assert.deepEqual(game.leaderSkills, skills);
  stable(game);
});

void test('market Ghola force revival creates no Leader Skill offer and resumes the exact sale', () => {
  const staged = stagedMarketGhola();
  const { owner, ghola, leader } = staged;
  const before = player(staged.game, owner);
  const skills = structuredClone(staged.game.leaderSkills);
  const game = act(staged.game, owner, { type: 'card', card: ghola, amount: 2, elite: 0 });
  assert.equal(player(game, owner).tanks, before.tanks - 2);
  assert.equal(player(game, owner).reserves, before.reserves + 2);
  assert.equal(player(game, owner).leaders.find(candidate => candidate.id === leader)!.dead, true);
  assert.deepEqual(game.leaderSkills, skills);
  assert.deepEqual(game.response, staged.game.response);
  assert.equal(game.pendingChoamMarketGhola, null);
  stable(game);
});

void test('a saved Truthtrance disposal restores its held Ghola skill choice before the original sale', () => {
  const staged = stagedMarketGhola();
  const { owner, opponent, leader, ghola, sale } = staged;
  let game = staged.game;
  const index = game.deck.findIndex(card => card.effect === 'truthtrance');
  assert.ok(index >= 0);
  const truth = game.deck.splice(index, 1)[0];
  player(game, opponent).hand.push(truth);
  const saleName = player(game, owner).hand.find(card => card.id === sale)!.name;
  const originalResponse = structuredClone(game.response);
  game = act(game, owner, { type: 'card', card: ghola, leader });
  const event = game.leaderSkills!.offers[owner].event;
  game = act(game, opponent, { type: 'card', card: truth.id });
  while (game.truthtrance?.stage === 'priority') {
    const voter = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id))!;
    game = act(game, voter.id, { type: 'truthPass' });
  }
  game = act(game, opponent, { type: 'truthAsk', question: {
    kind: 'fact', target: owner, fact: { kind: 'hand', name: saleName },
  } });
  stable(game);
  // Observe the unchanged production dispatcher before its wrapper retires the
  // mandatory physical discard; this is a real continuation, not invented history.
  const observed: { applyActionInner?: (state: Game, id: string, action: Action) => Game } = {};
  runInNewContext(ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') + '\nexport { applyActionInner };\n',
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText, { exports: observed, require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto, structuredClone, TextEncoder, JSON });
  const saved = reload(observed.applyActionInner!(game, owner, { type: 'truthAnswer', answer: 'yes' }));
  assert.equal(saved.decision, null);
  assert.equal(saved.pendingTreacheryDiscard!.continuation.kind, 'truthtranceDiscard');
  assert.equal(saved.pendingChoamMarketGhola!.stage, 'complete');
  assert.equal(viewGame(saved, owner).leaderSkills!.offer!.event, event);
  const missing = reload(saved);
  const continuation = missing.pendingTreacheryDiscard!.continuation;
  assert.equal(continuation.kind, 'truthtranceDiscard');
  if (continuation.kind === 'truthtranceDiscard') continuation.resume.decision = null;
  assert.throws(() => normalizeAutomaticGame(missing));
  game = reload(normalizeAutomaticGame(saved));
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.equal(game.truthtrance, null);
  assert.deepEqual(game.decision, { kind: 'leaderSkillRevival', player: owner, event });
  assert.equal(game.response, null);
  assert.equal(game.discard.filter(card => card.id === truth.id).length, 1);
  assert.equal(game.discard.filter(card => card.id === ghola).length, 1);
  stable(game);
  game = act(game, owner, { type: 'leaderSkill', event, mode: 'decline' });
  assert.deepEqual(game.response, originalResponse);
  game = passChoamGholaResponses(game);
  assert.equal(player(game, owner).spice, player(saved, owner).spice + 2);
  assert.equal(game.discard.filter(card => card.id === sale).length, 1);
  stable(game);
});
