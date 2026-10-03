import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { leaders, treacheryDeck, type Card } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import { newRevivalRules } from '../game/revival';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  advancedNativePlayer as player, advancedNativeStep, advanceAdvancedNativeSkillsToPhase,
  assertAdvancedNativeCustody, completedAdvancedNativeSkillsGame,
  initializeAdvancedNativeSkillsSetup, openAdvancedNativeSkillBattle,
  stageAdvancedNativeSkillBattle, finishAdvancedNativeSkillAftermath,
} from './fixture-advanced-native-skills';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
const act = (game: Game, actor: string, action: Action): Game => applyAction(reload(game), actor, action);
const trainer = (game: Game, actor: string) => game.leaderSkills!.assignments.find(a => a.owner === actor)!;
const wallets = (game: Game) => Object.fromEntries(game.players.map(p => [p.id, p.spice]));

function custody(game: Game): void {
  assertAdvancedNativeCustody(game);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
  assert.deepEqual(game.players.flatMap(p => p.leaders.map(l => l.id)).sort(),
    game.players.flatMap(p => leaders(p.faction).map(l => l.id)).sort());
  const traitors = [...game.traitorReserve!, ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices]),
    ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : [])];
  assert.deepEqual(traitors.sort(), traitorDeck(game.players).sort());
  if (game.ecazAmbassadors) validateAmbassadors(game.ecazAmbassadors);
}

function take(game: Game, actor: string, matches: (card: Card) => boolean): Card {
  const index = game.deck.findIndex(matches);
  assert.ok(index >= 0, 'Controlled card staging transfers a real remaining native card.');
  const card = game.deck.splice(index, 1)[0];
  game.players.find(p => p.id === actor)!.hand.push(card);
  return card;
}

function enemyLeader(game: Game): string {
  const enemy = player(game, 'emperor');
  const selected = enemy.leaders.filter(l => !l.dead && l.id !== trainer(game, enemy.id).leader)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(selected);
  return selected.id;
}

function resolve(game: Game, actor: string, target: string): Game {
  return act(act(game, actor, { type: 'traitorCall', call: false }), target, { type: 'traitorCall', call: false });
}

function responses(state: Game): Game {
  let game = state;
  for (let i = 0; (game.response || game.pendingTreacheryDiscard) && i < 100; i++) game = advancedNativeStep(game);
  assert.equal(game.response, null);
  return game;
}

void test('native Basic and Advanced Ecaz deal original starting cards, public skills, loyalty and traitors before six-force placement', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    let game = initializeAdvancedNativeSkillsSetup({ family: 'ecaz', requestedSkill: 'warmaster', rules });
    const actor = player(game, 'ecaz').id;
    assert.equal(game.setupStage, 'leaderSkills');
    assert.deepEqual(game.players.map(p => p.hand.length), [1, 1, 1]);
    assert.deepEqual(game.players.map(p => p.traitorChoices), [[], [], []]);
    assert.equal(player(game, 'ecaz').reserves, 20);
    const skills = [...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(o => o.cards)];
    assert.deepEqual(skills.sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
    assert.deepEqual(viewGame(game, actor).leaderSkills!.eligibleLeaders.map(l => l.id).sort(),
      leaders('ecaz').map(l => l.id).sort());
    for (const seat of game.players) {
      const own = viewGame(game, seat.id).leaderSkills!;
      const offer = own.offer!;
      const skill = seat.id === actor ? 'warmaster' : offer.cards.find(c => !own.unavailableSkills?.[c])!;
      game = act(game, seat.id, { type: 'leaderSkill', event: offer.event, skill, leader: own.eligibleLeaders[0].id });
    }
    assert.equal(game.setupStage, 'traitors');
    assert.equal(trainer(game, actor).skill, 'warmaster');
    for (const seat of game.players) {
      assert.equal(seat.traitorChoices.length, 4);
      assert.equal(viewGame(game, seat.id).leaderSkills!.assignments.find(a => a.owner === actor)!.leader, trainer(game, actor).leader);
    }
    if (rules === 'advanced') {
      const loyal = game.ecazLoyalty!.card!;
      assert.ok(leaders('ecaz').some(l => l.id === loyal));
      assert.equal([...game.traitorReserve!, ...game.players.flatMap(p => p.traitorChoices)].includes(loyal), false);
      assert.equal(player(game, 'ecaz').leaders.find(l => l.id === loyal)!.dead, false);
      for (const seat of game.players) assert.deepEqual(viewGame(game, seat.id).ecazLoyalty, { player: actor, card: loyal });
    } else assert.equal(viewGame(game, actor).ecazLoyalty, null);
    custody(game);
    for (const seat of game.players) {
      const choice = viewGame(game, seat.id).players.find(p => p.id === seat.id)!.traitorChoices![0];
      assert.ok(choice);
      game = act(game, seat.id, { type: 'traitor', leader: choice });
    }
    assert.equal(game.setupStage, 'forces');
    assert.deepEqual(game.players.map(p => p.traitors.length), [1, 1, 1]);
    assert.equal(player(game, 'ecaz').reserves, 20);
    game = act(game, actor, { type: 'ecazSetup', placements: { 'imperial_basin:9': 2, 'imperial_basin:10': 4 } });
    assert.equal(game.status, 'playing');
    assert.equal(game.phase, 0);
    assert.equal(player(game, 'ecaz').reserves, 14);
    assert.deepEqual(player(game, 'ecaz').forces, { 'imperial_basin:9': 2, 'imperial_basin:10': 4 });
    custody(game);
  }
});

void test('native Ecaz normal Poison role and selected skilled role change the winner without increasing the printed death bounty', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    const setup = completedAdvancedNativeSkillsGame({ family: 'ecaz', requestedSkill: 'master-of-assassins', rules });
    const actor = player(setup, 'ecaz').id, target = player(setup, 'emperor').id;
    for (const hidden of [false, true]) {
      let game = stageAdvancedNativeSkillBattle(setup, actor, target);
      const poison = take(game, actor, c => c.kind === 'poison');
      const selected = hidden ? player(game, 'ecaz').leaders.find(l => l.id === trainer(game, actor).leader)!
        : player(game, 'ecaz').leaders.find(l => l.id !== trainer(game, actor).leader && l.strength === 4)!;
      assert.equal(selected.strength, 4);
      const enemy = player(game, 'emperor').leaders.find(l => l.id === enemyLeader(game))!;
      const funds = wallets(game), enemyReserves = player(game, 'emperor').reserves;
      const normalSuk = !hidden && trainer(game, target).skill === 'suk-graduate' ? 1 : 0;
      game = openAdvancedNativeSkillBattle(game, actor, target, hidden);
      game = act(game, actor, { type: 'battlePlan', dial: 1, support: rules === 'advanced' ? 1 : 0, leader: selected.id, weapon: poison.id });
      game = act(game, target, { type: 'battlePlan', dial: 7, support: rules === 'advanced' ? 7 : 0, leader: enemy.id });
      game = finishAdvancedNativeSkillAftermath(resolve(game, actor, target));
      assert.equal(game.lastBattleContext!.winner, hidden ? actor : target);
      assert.equal(player(game, 'ecaz').leaders.find(l => l.id === selected.id)!.dead, false);
      assert.equal(player(game, 'emperor').leaders.find(l => l.id === enemy.id)!.dead, true);
      assert.equal(player(game, 'ecaz').spice, funds[actor] - (rules === 'advanced' ? 1 : 0) + (hidden ? enemy.strength : 0));
      assert.equal(player(game, 'emperor').spice, funds[target] - (rules === 'advanced' ? 7 : 0) + (hidden ? 0 : enemy.strength));
      assert.equal(player(game, 'ecaz').tanks, hidden ? 1 : 8);
      assert.equal(player(game, 'ecaz').forces['wind_pass:14'] ?? 0, hidden ? 7 : 0);
      assert.equal(player(game, 'emperor').tanks, hidden ? 8 : 7 - normalSuk);
      assert.equal(player(game, 'emperor').reserves, enemyReserves + normalSuk);
      assert.equal(game.discard.filter(c => c.id === poison.id).length, hidden ? 0 : 1);
      assert.equal(player(game, 'ecaz').hand.some(c => c.id === poison.id), hidden);
      custody(game);
    }
  }
});

void test('native Ecaz Suk uses actual ordinary casualties: face-up one-to-reserves versus selected skilled keep-one and return-two', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    const setup = completedAdvancedNativeSkillsGame({ family: 'ecaz', requestedSkill: 'suk-graduate', rules });
    const actor = player(setup, 'ecaz').id, target = player(setup, 'emperor').id;
    for (const hidden of [false, true]) {
      let game = stageAdvancedNativeSkillBattle(setup, actor, target);
      const selected = hidden ? trainer(game, actor).leader
        : player(game, 'ecaz').leaders.find(l => l.id !== trainer(game, actor).leader && l.strength === 4)!.id;
      const enemy = enemyLeader(game), funds = wallets(game), reserves = player(game, 'ecaz').reserves;
      game = openAdvancedNativeSkillBattle(game, actor, target, hidden);
      game = act(game, actor, { type: 'battlePlan', dial: 5, support: rules === 'advanced' ? 5 : 0, leader: selected });
      game = act(game, target, { type: 'battlePlan', dial: 0, support: 0, leader: enemy });
      game = finishAdvancedNativeSkillAftermath(resolve(game, actor, target));
      assert.equal(game.lastBattleContext!.winner, actor);
      assert.equal(player(game, 'ecaz').spice, funds[actor] - (rules === 'advanced' ? 5 : 0));
      if (hidden) {
        assert.equal(game.decision?.kind, 'sukRescue');
        if (game.decision?.kind !== 'sukRescue') throw new Error('Expected native ordinary casualty rescue.');
        assert.deepEqual(game.pendingSukRescue!.losses, { normal: 5, elite: 0, paidNormal: rules === 'advanced' ? 5 : 0, paidElite: 0 });
        const pending = game;
        const choice = game.decision.options.findIndex(o => o.normal === 3 && o.elite === 0 && o.kept?.key === 'wind_pass:14');
        assert.ok(choice >= 0);
        game = finishAdvancedNativeSkillAftermath(act(game, actor, { type: 'decision', event: game.decision.event, choice }));
        assert.equal(player(game, 'ecaz').tanks, 2);
        assert.equal(player(game, 'ecaz').forces['wind_pass:14'], 4);
        assert.equal(player(game, 'ecaz').reserves, reserves + 2);
        for (const difficulty of DIFFICULTIES) {
          const own = viewGame(reload(pending), actor);
          own.players.find(p => p.id === actor)!.bot = difficulty;
          const rescued = finishAdvancedNativeSkillAftermath(act(pending, actor, botActions(own)[0]));
          assert.equal(player(rescued, 'ecaz').tanks, 2);
          assert.equal(player(rescued, 'ecaz').spice, funds[actor] - (rules === 'advanced' ? 5 : 0));
          assert.equal(player(rescued, 'ecaz').forces['wind_pass:14'], 4);
          assert.equal(player(rescued, 'ecaz').reserves, reserves + 2);
          custody(rescued);
        }
      } else {
        assert.equal(player(game, 'ecaz').tanks, 4);
        assert.equal(player(game, 'ecaz').forces['wind_pass:14'], 3);
        assert.equal(player(game, 'ecaz').reserves, reserves + 1);
      }
      assert.equal(player(game, 'emperor').tanks, 8);
      custody(game);
    }
  }
});

void test('real native Ecaz trainer death returns its skill; eligible own ordinary and physical Ghola revival offer optional replacement', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    const setup = completedAdvancedNativeSkillsGame({ family: 'ecaz', requestedSkill: 'warmaster', rules });
    const actor = player(setup, 'ecaz').id, target = player(setup, 'emperor').id;
    const assigned = structuredClone(trainer(setup, actor));
    let dead = stageAdvancedNativeSkillBattle(setup, actor, target);
    const poison = take(dead, target, c => c.kind === 'poison');
    const printed = player(dead, 'ecaz').leaders.find(l => l.id === assigned.leader)!.strength;
    const funds = wallets(dead);
    dead = openAdvancedNativeSkillBattle(dead, actor, target);
    dead = act(dead, actor, { type: 'battlePlan', dial: 0, support: 0, leader: assigned.leader });
    dead = act(dead, target, { type: 'battlePlan', dial: 0, support: 0, leader: enemyLeader(dead), weapon: poison.id });
    dead = finishAdvancedNativeSkillAftermath(resolve(dead, actor, target));
    assert.equal(dead.lastBattleContext!.winner, target);
    assert.equal(player(dead, 'ecaz').leaders.find(l => l.id === assigned.leader)!.dead, true);
    assert.equal(dead.leaderSkills!.assignments.some(a => a.owner === actor), false);
    assert.equal(dead.leaderSkills!.deck.filter(c => c === assigned.skill).length, 1);
    assert.deepEqual(wallets(dead), { ...funds, [target]: funds[target] + printed });
    assert.equal(player(dead, 'ecaz').tanks, 8);
    custody(dead);
    for (const mode of ['ordinary', 'ghola'] as const) {
      let game = reload(dead);
      // Explicit conserved Revival position, not a claimed played turn history.
      // Ordinary revival stages the other four original discs dead to open the
      // native five-disc first cohort. Ghola instead uses only the actual death.
      Object.assign(game, { phase: 4, active: null, ready: [], decision: null, response: null,
        phaseOpening: null, revivalRules: newRevivalRules() });
      for (const seat of game.players) seat.leaderRevived = false;
      if (mode === 'ordinary') for (const leader of player(game, 'ecaz').leaders) if (leader.id !== assigned.leader) {
        leader.dead = true; leader.deaths = 1;
      }
      const before = wallets(game);
      let ghola: Card | undefined;
      if (mode === 'ordinary') {
        assert.equal(viewGame(game, actor).revival.leaders.find(l => l.id === assigned.leader)!.cost, printed);
        game = act(game, actor, { type: 'reviveLeader', leader: assigned.leader });
      } else {
        ghola = take(game, actor, c => c.effect === 'ghola');
        assert.ok(viewGame(game, actor).ghola.leaders.some(l => l.id === assigned.leader));
        game = responses(act(game, actor, { type: 'card', card: ghola.id, leader: assigned.leader }));
      }
      assert.equal(game.decision?.kind, 'leaderSkillRevival');
      assert.equal(player(game, 'ecaz').leaders.find(l => l.id === assigned.leader)!.dead, false);
      assert.equal(player(game, 'ecaz').leaders.find(l => l.id === assigned.leader)!.deaths, 1);
      assert.equal(player(game, 'ecaz').leaderRevived, mode === 'ordinary');
      assert.deepEqual(wallets(game), { ...before, [actor]: before[actor] - (mode === 'ordinary' ? printed : 0) });
      if (ghola) {
        assert.equal(player(game, 'ecaz').hand.some(c => c.id === ghola!.id), false);
        assert.equal(game.discard.filter(c => c.id === ghola!.id).length, 1);
      }
      const event = viewGame(game, actor).leaderSkills!.offer!.event;
      const declined = act(game, actor, { type: 'leaderSkill', event, mode: 'decline' });
      assert.equal(declined.leaderSkills!.assignments.some(a => a.owner === actor), false);
      assert.equal(player(declined, 'ecaz').leaders.find(l => l.id === assigned.leader)!.dead, false);
      custody(declined);
      game = act(game, actor, { type: 'leaderSkill', event, mode: 'draw' });
      const own = viewGame(game, actor).leaderSkills!;
      const offered = own.offer!.cards;
      assert.equal(offered.length, 2);
      const skill = offered.find(c => !own.unavailableSkills?.[c])!;
      game = act(game, actor, { type: 'leaderSkill', event, skill, leader: assigned.leader });
      assert.deepEqual(trainer(game, actor), { owner: actor, leader: assigned.leader, skill });
      assert.equal(game.leaderSkills!.deck.includes(offered.find(c => c !== skill)!), true);
      assert.deepEqual(wallets(game), wallets(declined));
      custody(game);
    }
  }
});

void test('original Emperor Ambassador charges placement then pays five from the Bank and resumes the real entrant with Ecaz training intact', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    let game = completedAdvancedNativeSkillsGame({ family: 'ecaz', requestedSkill: 'warmaster', rules });
    const actor = player(game, 'ecaz').id, entrant = player(game, 'atreides').id;
    const assigned = structuredClone(trainer(game, actor));
    const originalTokens = game.ecazAmbassadors!.tokens.map(t => ({ id: t.id, effect: t.effect }));
    // Explicit controlled, conserved post-setup cohort and board position. This
    // is not natural Ambassador history or a second source of fixed entropy.
    // Swap custody only: retain all eleven original token identities/effects.
    const state = game.ecazAmbassadors!;
    const token = state.tokens.find(t => t.effect === 'emperor')!;
    if (!state.cohort.includes(token.id)) {
      const replaced = state.tokens.find(t => t.id === state.cohort[0])!;
      state.cohort[0] = token.id;
      replaced.zone = 'pool';
      token.zone = 'supply';
    }
    for (const seat of game.players) {
      seat.reserves += Object.values(seat.forces).reduce((sum, n) => sum + n, 0);
      seat.forces = {};
      if (seat.elites) {
        seat.elites.reserves += Object.values(seat.elites.forces).reduce((sum, n) => sum + n, 0);
        seat.elites.forces = {};
      }
    }
    custody(game);
    game = advanceAdvancedNativeSkillsToPhase(game, 4);
    const before = wallets(game);
    for (const seat of game.players) game = act(game, seat.id, { type: 'ready' });
    assert.equal(game.decision?.kind, 'ecazPlacement');
    game = responses(act(game, actor, { type: 'decision', token: token.id, territory: 'carthag' }));
    assert.equal(player(game, 'ecaz').spice, before[actor] - 1);
    assert.equal(game.ecazAmbassadors!.tokens.find(t => t.id === token.id)!.location, 'carthag');
    game = act(game, actor, { type: 'decision', decline: true });
    for (let i = 0; (game.phaseOpening || game.response || game.decision || game.active !== entrant) && i < 100; i++) game = advancedNativeStep(game);
    const entrantFunds = player(game, 'atreides').spice, entrantReserves = player(game, 'atreides').reserves;
    game = responses(act(game, entrant, { type: 'ship', territory: 'carthag', sector: 11, amount: 1 }));
    assert.equal(game.decision?.kind, 'ecazAmbassador');
    assert.equal(viewGame(game, actor).ambassadorEntry!.stage, 'offer');
    game = responses(act(game, actor, { type: 'decision', event: game.pendingAmbassador!.event, trigger: true, beneficiary: actor }));
    assert.equal(player(game, 'ecaz').spice, before[actor] - 1 + 5);
    assert.equal(player(game, 'atreides').spice, entrantFunds - 1);
    assert.equal(player(game, 'atreides').reserves, entrantReserves - 1);
    assert.equal(player(game, 'atreides').forces['carthag:11'], 1);
    assert.equal(game.ecazAmbassadors!.tokens.find(t => t.id === token.id)!.zone, 'used');
    assert.deepEqual(game.ecazAmbassadors!.tokens.map(t => ({ id: t.id, effect: t.effect })), originalTokens);
    assert.deepEqual(trainer(game, actor), assigned);
    assert.equal(game.active, entrant);
    assert.equal(player(game, 'atreides').shipped, true);
    game = act(game, entrant, { type: 'endMovement' });
    assert.notEqual(game.active, entrant);
    custody(game);
  }
});
