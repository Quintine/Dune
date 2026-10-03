import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, joinGame, newPlayer, normalizeAutomaticGame, viewGame,
  type Action, type Game,
} from '../game/engine';
import { leaders, treacheryDeck, type Card } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { newRevivalRules } from '../game/revival';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  advancedNativePlayer as player, advancedNativeStep, assertAdvancedNativeCustody,
  completedAdvancedNativeSkillsGame, createAdvancedNativeSkillBattle,
  openAdvancedNativeSkillBattle, rejectAdvancedNativeAction as reject,
  stageAdvancedNativeSkillBattle, stageAdvancedTleilaxuForeignRevival,
} from './fixture-advanced-native-skills';
import { completedTleilaxuSkillsGame } from './tleilaxu-skills-fixture';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
const act = (game: Game, actor: string, action: Action): Game => applyAction(reload(game), actor, action);
const wallets = (game: Game) => Object.fromEntries(game.players.map(p => [p.id, p.spice]));
const trainer = (game: Game, actor: string) => game.leaderSkills!.assignments.find(a => a.owner === actor)!;
const setup = () => completedAdvancedNativeSkillsGame({ family: 'tleilaxu', requestedSkill: 'warmaster' });

function custody(game: Game): void {
  assertAdvancedNativeCustody(game);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(c => c.id);
  assert.deepEqual(cards.sort(), treacheryDeck(game.expansions).map(c => c.id).sort());
  assert.deepEqual(game.players.flatMap(p => p.leaders.map(l => l.id)).sort(),
    game.players.flatMap(p => [...leaders(p.faction).map(l => l.id),
      ...(game.advanced && p.faction === 'choam' ? ['choam-auditor'] : [])]).sort());
  const traitors = [...game.traitorReserve!, ...game.players.flatMap(p => p.traitors),
    ...game.players.flatMap(p => (p.faceDancers ?? []).map(c => c.leader))];
  assert.deepEqual(traitors.sort(), traitorDeck(game.players, true).sort());
  assert.equal(new Set(traitors).size, traitors.length);
}

function take(game: Game, actor: string, matches: (card: Card) => boolean): Card {
  const index = game.deck.findIndex(matches);
  assert.ok(index >= 0, 'Transfer a physical card from the original native deck.');
  const card = game.deck.splice(index, 1)[0];
  game.players.find(p => p.id === actor)!.hand.push(card);
  return card;
}

function settleRevival(state: Game): Game {
  let game = state;
  for (let i = 0; (game.response || game.pendingRevival) && i < 100; i++)
    game = advancedNativeStep(reload(game));
  assert.equal(game.pendingRevival, null);
  assert.equal(game.response, null);
  return game;
}

function aftermath(state: Game, stopAtFaceDance = false, stopAtCapture = false): Game {
  let game = state;
  for (let i = 0; (game.response || game.decision || game.battle || game.pendingTreacheryDiscard) && i < 100; i++) {
    if (stopAtCapture && game.decision?.kind === 'captureOffer') return game;
    if (game.decision?.kind === 'faceDance') {
      if (stopAtFaceDance) return game;
      game = act(game, game.decision.player, { type: 'decision', reveal: false });
    } else if (game.decision?.kind === 'battleCards') {
      game = act(game, game.decision.player, { type: 'decision', discard: [] });
    } else game = advancedNativeStep(reload(game));
  }
  assert.equal(game.battle, null);
  assert.equal(game.decision, null);
  return game;
}

function resolve(game: Game, actor: string, target: string): Game {
  game = act(game, actor, { type: 'traitorCall', call: false });
  return act(game, target, { type: 'traitorCall', call: false });
}

/** A native weapon actually kills the original assigned trainer. No staged
 * skill return or invented earned currency is used to remove its assignment. */
function killedNativeTrainer(): { game: Game; actor: string; leader: string } {
  let game = createAdvancedNativeSkillBattle({ family: 'tleilaxu', requestedSkill: 'warmaster' });
  const actor = player(game, 'tleilaxu').id;
  const enemy = player(game, 'emperor').id;
  const leader = trainer(game, actor).leader;
  const poison = take(game, enemy, c => c.kind === 'poison');
  const defender = player(game, 'emperor').leaders.find(l => l.id !== trainer(game, enemy).leader)!;
  game = openAdvancedNativeSkillBattle(reload(game), actor, enemy);
  game = act(game, actor, { type: 'battlePlan', dial: 0, support: 0, leader });
  game = act(game, enemy, { type: 'battlePlan', dial: 0, support: 0, leader: defender.id, weapon: poison.id });
  game = aftermath(resolve(game, actor, enemy));
  assert.equal(player(game, 'tleilaxu').leaders.find(l => l.id === leader)!.dead, true);
  assert.equal(game.leaderSkills!.assignments.some(a => a.owner === actor), false);
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
  custody(game);
  return { game, actor, leader };
}

void test('native foreign revival keeps original custody, half-price payment and no skill draw even without a trainer', () => {
  for (const hasTrainer of [true, false]) {
    const original = hasTrainer ? setup() : killedNativeTrainer().game;
    const staged = stageAdvancedTleilaxuForeignRevival(original);
    assert.deepEqual(wallets(staged.game), wallets(original));
    const before = reload(staged.game);
    const skillState = structuredClone(before.leaderSkills);
    const disc = player(before, 'emperor').leaders.find(l => l.id === staged.leader)!;
    const price = Math.ceil(disc.strength / 2);
    const game = settleRevival(act(before, staged.actor, { type: 'reviveForeignGhola', leader: disc.id }));
    const returned = player(game, 'emperor').leaders.find(l => l.id === disc.id)!;
    assert.equal(returned.dead, false);
    assert.equal(returned.gholaBy, staged.actor);
    assert.equal(player(game, 'tleilaxu').leaders.some(l => l.id === disc.id), false);
    assert.equal(game.players.flatMap(p => p.leaders).filter(l => l.id === disc.id).length, 1);
    assert.deepEqual(wallets(game), { ...wallets(before), [staged.actor]: player(before, 'tleilaxu').spice - price });
    assert.equal(player(game, 'tleilaxu').leaderRevived, true);
    assert.deepEqual(game.leaderSkills, skillState);
    assert.equal(viewGame(game, staged.actor).leaderSkills!.offer, null);
    assert.equal(game.decision, null);
    assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
    reject(game, staged.actor, { type: 'reviveForeignGhola', leader: disc.id });
    assert.deepEqual(before, staged.game, 'Revival cannot mutate its caller-owned input.');
    custody(game);
  }
});

void test('a separate native Warmaster gives only its normal +1 to the selected original foreign ghola', () => {
  const staged = stageAdvancedTleilaxuForeignRevival(setup());
  const revived = settleRevival(act(staged.game, staged.actor, { type: 'reviveForeignGhola', leader: staged.leader }));
  const assignment = structuredClone(trainer(revived, staged.actor));
  const foreign = player(revived, 'emperor').leaders.find(l => l.id === staged.leader)!;
  assert.equal(foreign.strength, 2);
  for (const [visible, dial, expectedWinner] of [
    [true, 0, staged.actor], [false, 0, staged.originalOwner], [true, 1, staged.originalOwner],
  ] as const) {
    let game = stageAdvancedNativeSkillBattle(revived, staged.actor, staged.originalOwner);
    const worthless = take(game, staged.actor, c => c.kind === 'worthless');
    const defender = player(game, 'emperor').leaders.find(l => l.strength === 3 && !l.dead)!;
    const funds = wallets(game);
    game = openAdvancedNativeSkillBattle(reload(game), staged.actor, staged.originalOwner, !visible);
    game = act(game, staged.actor, { type: 'battlePlan', dial: 0, support: 0, leader: foreign.id, weapon: worthless.id });
    game = act(game, staged.originalOwner, { type: 'battlePlan', dial, support: dial, leader: defender.id });
    game = aftermath(resolve(game, staged.actor, staged.originalOwner));
    // 2+1 beats/ties 3; hiding the normal skill loses. 2+1 loses to 3+1,
    // whereas incorrectly giving the trainer's selected-disc +3 would win.
    assert.equal(game.lastBattleContext!.winner, expectedWinner);
    assert.deepEqual(trainer(game, staged.actor), assignment);
    assert.equal(player(game, 'emperor').leaders.find(l => l.id === foreign.id)!.gholaBy, staged.actor);
    assert.deepEqual(wallets(game), { ...funds, [staged.originalOwner]: funds[staged.originalOwner] - dial });
    custody(game);
  }
});

void test('foreign ghola death preserves the native trainer; negotiated original-owner buyback clears control exactly once', () => {
  const staged = stageAdvancedTleilaxuForeignRevival(setup());
  const revived = settleRevival(act(staged.game, staged.actor, { type: 'reviveForeignGhola', leader: staged.leader }));
  const skills = structuredClone(revived.leaderSkills);
  let game = stageAdvancedNativeSkillBattle(revived, staged.actor, staged.originalOwner);
  const poison = take(game, staged.originalOwner, c => c.kind === 'poison');
  const defender = player(game, 'emperor').leaders.find(l => !l.dead && l.id !== trainer(game, staged.originalOwner).leader)!;
  game = openAdvancedNativeSkillBattle(reload(game), staged.actor, staged.originalOwner, false);
  game = act(game, staged.actor, { type: 'battlePlan', dial: 0, support: 0, leader: staged.leader });
  game = act(game, staged.originalOwner, { type: 'battlePlan', dial: 0, support: 0, leader: defender.id, weapon: poison.id });
  game = aftermath(resolve(game, staged.actor, staged.originalOwner));
  const dead = player(game, 'emperor').leaders.find(l => l.id === staged.leader)!;
  assert.equal(dead.dead, true);
  assert.equal(dead.gholaBy, staged.actor);
  assert.deepEqual(game.leaderSkills, skills);
  custody(game);
  // Controlled next Revival boundary, retaining actual battle deaths, cards,
  // bounty and wallets. This is not claimed to be a played phase history.
  Object.assign(game, { phase: 4, active: null, ready: [], decision: null, response: null,
    phaseOpening: null, revivalRules: newRevivalRules() });
  for (const p of game.players) p.leaderRevived = false;
  const before = reload(game), funds = wallets(game);
  reject(game, staged.originalOwner, { type: 'reviveLeader', leader: staged.leader });
  game = act(game, staged.originalOwner, { type: 'requestLeaderRevival', leader: staged.leader });
  game = act(game, staged.actor, { type: 'quoteLeaderRevival', target: staged.originalOwner, amount: 1 });
  game = settleRevival(act(game, staged.originalOwner, { type: 'acceptLeaderRevival' }));
  const ownAgain = player(game, 'emperor').leaders.find(l => l.id === staged.leader)!;
  assert.equal(ownAgain.dead, false);
  assert.equal(ownAgain.gholaBy, undefined);
  assert.deepEqual(wallets(game), { ...funds, [staged.originalOwner]: funds[staged.originalOwner] - 1,
    [staged.actor]: funds[staged.actor] + 1 });
  assert.deepEqual(game.leaderSkills, before.leaderSkills, 'Its surviving original trainer prevents a replacement draw.');
  reject(game, staged.originalOwner, { type: 'acceptLeaderRevival' });
  custody(game);
});

void test('own native trainer revival still offers an optional physical card after a no-skill foreign revival', () => {
  const killed = killedNativeTrainer();
  const staged = stageAdvancedTleilaxuForeignRevival(killed.game);
  const foreignRevived = settleRevival(act(staged.game, staged.actor, { type: 'reviveForeignGhola', leader: staged.leader }));
  const own = player(foreignRevived, 'tleilaxu').leaders.find(l => l.id === killed.leader)!;
  const previousDeck = [...foreignRevived.leaderSkills!.deck];
  const funds = wallets(foreignRevived);
  const offered = settleRevival(act(foreignRevived, staged.actor, { type: 'reviveLeader', leader: own.id }));
  assert.equal(offered.decision?.kind, 'leaderSkillRevival');
  const offer = offered.leaderSkills!.offers[staged.actor];
  assert.equal(offer.leader, own.id);
  assert.deepEqual(offer.cards, []);
  assert.deepEqual(offered.leaderSkills!.deck, previousDeck);
  assert.deepEqual(wallets(offered), { ...funds, [staged.actor]: funds[staged.actor] - Math.ceil(own.strength / 2) });
  assert.equal(player(offered, 'emperor').leaders.find(l => l.id === staged.leader)!.gholaBy, staged.actor);
  const declined = act(offered, staged.actor, { type: 'leaderSkill', event: offer.event, mode: 'decline' });
  assert.deepEqual(declined.leaderSkills!.deck, previousDeck);
  assert.equal(declined.leaderSkills!.offers[staged.actor], undefined);
  const drawn = act(offered, staged.actor, { type: 'leaderSkill', event: offer.event, mode: 'draw' });
  const choice = drawn.leaderSkills!.offers[staged.actor];
  assert.equal(choice.cards.length, 2);
  assert.equal(drawn.leaderSkills!.deck.length, previousDeck.length - 2);
  custody(drawn);
  reject(drawn, staged.actor, { type: 'leaderSkill', event: choice.event, skill: choice.cards[0], leader: staged.leader });
  const trained = act(drawn, staged.actor, { type: 'leaderSkill', event: choice.event, skill: choice.cards[0], leader: own.id });
  assert.equal(trainer(trained, staged.actor).leader, own.id);
  assert.equal(trainer(trained, staged.actor).skill, choice.cards[0]);
  custody(declined); custody(trained);
  for (const difficulty of DIFFICULTIES) {
    let game = reload(offered);
    for (let i = 0; game.leaderSkills!.offers[staged.actor] && i < 3; i++) {
      const view = viewGame(game, staged.actor);
      view.players.find(p => p.id === staged.actor)!.bot = difficulty;
      const action = botActions(view)[0];
      assert.ok(action, difficulty);
      game = act(game, staged.actor, action);
    }
    assert.equal(game.leaderSkills!.offers[staged.actor], undefined, difficulty);
    const assigned = game.leaderSkills!.assignments.find(a => a.owner === staged.actor);
    if (assigned) assert.equal(assigned.leader, own.id, difficulty);
    assert.equal(game.leaderSkills!.assignments.some(a => a.leader === staged.leader), false, difficulty);
    assert.deepEqual(wallets(game), wallets(offered));
    custody(game);
  }
});

void test('native Face Dance after an actual Advanced battle kills and returns the original trained card', () => {
  let game = createAdvancedNativeSkillBattle({ family: 'tleilaxu', skillOwner: 'atreides', requestedSkill: 'warmaster' });
  const actor = player(game, 'atreides').id, enemy = player(game, 'emperor').id;
  const controller = player(game, 'tleilaxu').id;
  const trained = trainer(game, actor);
  const leader = trained.leader;
  const dancers = player(game, 'tleilaxu').faceDancers!;
  if (!dancers.some(c => c.leader === leader)) {
    const card = dancers[0];
    const reserve = game.traitorReserve!.indexOf(leader);
    if (reserve >= 0) game.traitorReserve![reserve] = card.leader;
    else {
      const holder = game.players.find(p => p.traitors.includes(leader))!;
      assert.ok(holder);
      holder.traitors[holder.traitors.indexOf(leader)] = card.leader;
    }
    card.leader = leader;
  } // Conserved physical identity swap, not a fabricated extra Face Dancer.
  custody(game);
  const defender = player(game, 'emperor').leaders.find(l => l.strength === 2)!;
  game = openAdvancedNativeSkillBattle(reload(game), actor, enemy);
  game = act(game, actor, { type: 'battlePlan', dial: 1, support: 1, leader });
  game = act(game, enemy, { type: 'battlePlan', dial: 0, support: 0, leader: defender.id });
  game = aftermath(resolve(game, actor, enemy), true);
  assert.equal(game.lastBattleContext!.winner, actor);
  assert.equal(game.decision?.kind, 'faceDance');
  const funds = wallets(game), reserves = player(game, 'tleilaxu').reserves;
  game = act(game, controller, { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 14 });
  assert.equal(player(game, 'atreides').leaders.find(l => l.id === leader)!.dead, true);
  assert.equal(game.leaderSkills!.assignments.some(a => a.leader === leader), false);
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
  assert.equal(player(game, 'tleilaxu').forces['wind_pass:14'], 1);
  assert.equal(player(game, 'tleilaxu').reserves, reserves - 1);
  assert.deepEqual(wallets(game), funds);
  assert.equal(player(game, 'tleilaxu').faceDancers!.find(c => c.leader === leader)!.revealed, true);
  custody(game);
});

void test('actual Harkonnen capture keeps a foreign ghola in its original roster and battle use returns Tleilaxu control', () => {
  const original = completedAdvancedNativeSkillsGame({
    family: 'tleilaxu', requestedSkill: 'warmaster', opponents: ['harkonnen', 'emperor'],
  });
  const staged = stageAdvancedTleilaxuForeignRevival(original);
  const revived = settleRevival(act(staged.game, staged.actor, { type: 'reviveForeignGhola', leader: staged.leader }));
  const captor = player(revived, 'harkonnen').id;
  const skills = structuredClone(revived.leaderSkills);
  let game = stageAdvancedNativeSkillBattle(revived, staged.actor, captor);
  // Conserved controlled eligibility: all other living Tleilaxu discs have
  // already been used elsewhere. Only the genuinely revived foreign disc is
  // eligible for this battle's random capture, without changing the card pool.
  for (const leader of player(game, 'tleilaxu').leaders)
    if (!leader.dead) leader.usedAt = 'arrakeen';
  const native = player(game, 'harkonnen').leaders.find(l => l.id !== trainer(game, captor).leader)!;
  game = openAdvancedNativeSkillBattle(reload(game), staged.actor, captor, false);
  game = act(game, staged.actor, { type: 'battlePlan', dial: 0, support: 0, leader: staged.leader });
  game = act(game, captor, { type: 'battlePlan', dial: 0, support: 0, leader: native.id });
  game = aftermath(resolve(game, staged.actor, captor), false, true);
  assert.equal(game.lastBattleContext!.winner, captor);
  assert.equal(game.decision?.kind, 'captureOffer');
  game = act(game, captor, { type: 'decision', accept: true });
  for (let i = 0; game.response && i < 100; i++) game = advancedNativeStep(reload(game));
  assert.equal(game.decision?.kind, 'capturedLeader');
  if (game.decision?.kind !== 'capturedLeader') throw new Error('Expected actual captured foreign leader.');
  assert.equal(game.decision.leader, staged.leader);
  assert.equal(game.decision.owner, staged.originalOwner);
  assert.equal(game.decision.controller, staged.actor);
  const captive = player(game, 'emperor').leaders.find(l => l.id === staged.leader)!;
  assert.equal(captive.capturedBy, captor);
  assert.equal(captive.gholaBy, staged.actor);
  assert.equal(captive.concealed!.controller, staged.actor);
  assert.deepEqual(game.leaderSkills, skills);
  custody(game);
  const choice = reload(game), funds = wallets(game);
  const executed = aftermath(act(choice, captor, { type: 'decision', mode: 'execute' }));
  const dead = player(executed, 'emperor').leaders.find(l => l.id === staged.leader)!;
  assert.equal(dead.dead, true);
  assert.equal(dead.capturedBy, undefined);
  assert.equal(dead.gholaBy, staged.actor);
  assert.equal(dead.concealed!.controller, staged.actor);
  assert.equal(dead.concealed!.dead, false, 'The original hidden living snapshot is retained after execution.');
  assert.deepEqual(wallets(executed), { ...funds, [captor]: funds[captor] + 2 });
  assert.deepEqual(executed.leaderSkills, skills);
  custody(executed);
  game = aftermath(act(choice, captor, { type: 'decision', mode: 'keep' }));
  assert.equal(player(game, 'emperor').leaders.find(l => l.id === staged.leader)!.capturedBy, captor);
  assert.deepEqual(wallets(game), funds);
  game = stageAdvancedNativeSkillBattle(game, captor, staged.originalOwner);
  const defender = player(game, 'emperor').leaders.find(l => l.strength === 3)!;
  game = openAdvancedNativeSkillBattle(reload(game), captor, staged.originalOwner, false);
  // The captured foreign disc is genuinely selectable by Harkonnen, not by
  // either its original Emperor owner or its pre-capture Tleilaxu controller.
  reject(game, staged.originalOwner, { type: 'battlePlan', dial: 0, support: 0, leader: staged.leader });
  game = act(game, captor, { type: 'battlePlan', dial: 0, support: 0, leader: staged.leader });
  game = act(game, staged.originalOwner, { type: 'battlePlan', dial: 0, support: 0, leader: defender.id });
  game = aftermath(resolve(game, captor, staged.originalOwner));
  assert.equal(game.lastBattleContext!.winner, staged.originalOwner);
  const returned = player(game, 'emperor').leaders.find(l => l.id === staged.leader)!;
  assert.equal(returned.dead, false);
  assert.equal(returned.capturedBy, undefined);
  assert.equal(returned.concealed, undefined);
  assert.equal(returned.gholaBy, staged.actor);
  assert.equal(player(game, 'tleilaxu').leaders.some(l => l.id === staged.leader), false);
  assert.deepEqual(wallets(game), funds);
  assert.deepEqual(game.leaderSkills, skills);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  custody(game);
});

void test('foreign revival retains Basic, controller, full-pool, capture, Auditor, Duke and foreign-training boundaries', () => {
  const staged = stageAdvancedTleilaxuForeignRevival(setup());
  const action: Action = { type: 'reviveForeignGhola', leader: staged.leader };
  reject(staged.game, staged.originalOwner, action);
  const full = reload(staged.game);
  player(full, 'tleilaxu').leaders.find(l => l.id === staged.ownDead)!.dead = false;
  reject(full, staged.actor, action);
  const captured = reload(staged.game);
  player(captured, 'emperor').leaders.find(l => l.id === staged.leader)!.capturedBy = staged.actor;
  reject(captured, staged.actor, action);
  reject(staged.game, staged.actor, { type: 'reviveForeignGhola', leader: DUKE_VIDAL_ID });
  const basic = completedTleilaxuSkillsGame();
  Object.assign(basic, { phase: 4, phaseOpening: null, response: null, decision: null });
  player(basic, 'emperor').leaders[1].dead = true;
  reject(basic, player(basic, 'tleilaxu').id, { type: 'reviveForeignGhola', leader: player(basic, 'emperor').leaders[1].id });
  const advanced = settleRevival(act(staged.game, staged.actor, action));
  const assignment = reload(advanced);
  const native = trainer(assignment, staged.actor);
  native.leader = staged.leader;
  reject(assignment, staged.actor, { type: 'ready' });
  const wrongController = reload(advanced);
  player(wrongController, 'emperor').leaders.find(l => l.id === staged.leader)!.gholaBy = staged.originalOwner;
  reject(wrongController, staged.actor, { type: 'ready' });
  const capturedGhola = reload(advanced);
  player(capturedGhola, 'emperor').leaders.find(l => l.id === staged.leader)!.capturedBy = staged.actor;
  reject(capturedGhola, staged.actor, { type: 'ready' });
  const basicGhola = reload(advanced);
  basicGhola.advanced = false;
  reject(basicGhola, staged.actor, { type: 'ready' });
  const lobby = createGame('ADVTLEIAUD', newPlayer('human-t', 'Tleilaxu', 'tleilaxu'), true, ['ix', 'choam']);
  joinGame(lobby, newPlayer('human-c', 'CHOAM', 'choam'));
  joinGame(lobby, newPlayer('human-e', 'Emperor', 'emperor'));
  const admitted = completedAdvancedNativeSkillsGame({ family: 'tleilaxu', requestedSkill: 'warmaster', initial: lobby });
  assert.deepEqual(admitted.players.map(p => p.id), ['human-t', 'human-c', 'human-e']);
  const audit = stageAdvancedTleilaxuForeignRevival(admitted);
  const auditor = player(audit.game, 'choam').leaders.find(l => l.id === 'choam-auditor')!;
  auditor.dead = true; auditor.deaths = 1;
  reject(audit.game, audit.actor, { type: 'reviveForeignGhola', leader: auditor.id });
  custody(audit.game);
});
