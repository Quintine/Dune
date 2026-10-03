import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, type Game } from '../game/engine';
import {
  advancedNativePlayer,
  advancedNativeStep,
  assertAdvancedNativeCustody,
  completedAdvancedNativeSkillsGame,
  finishAdvancedNativeSkillAftermath,
  rejectAdvancedNativeAction,
  stageAdvancedNativeSkillBattle,
} from './fixture-advanced-native-skills';

/** Original fresh all14 setup and original cache auction. Only the selected lot
 * and the other seats' passes are controlled; no cache card is injected. */
function acquireGreen(card: string, rules: 'basic' | 'advanced', voice = false): Game {
  let game = completedAdvancedNativeSkillsGame({
    family: 'richese', requestedSkill: 'planetologist', rules,
    opponents: voice ? ['beneGesserit', 'emperor'] : ['atreides', 'emperor'],
  });
  const owner = advancedNativePlayer(game, 'richese').id;
  for (let i = 0; !advancedNativePlayer(game, 'richese').hand.some(c => c.id === card) && i < 500; i++) {
    if (game.response || game.phaseOpening) game = advancedNativeStep(game);
    else if (game.decision?.kind === 'richeseBlackMarket') {
      game = applyAction(game, owner, { type: 'decision', event: game.richeseBidding!.event, decline: true });
    } else if (game.decision?.kind === 'richeseDeclaration') {
      game = applyAction(game, owner, { type: 'decision', event: game.richeseBidding!.event, position: 'first' });
    } else if (game.decision?.kind === 'richeseCache') {
      game = applyAction(game, owner, {
        type: 'decision', event: game.richeseBidding!.event, card,
        method: 'onceAround', direction: 'counterclockwise',
      });
    } else if (game.decision?.kind === 'richeseUnbid') {
      game = applyAction(game, owner, { type: 'decision', event: game.richeseBidding!.event, keep: true });
    } else if (game.richeseAuction && !game.richeseAuction.outcome) {
      game = applyAction(game, game.richeseAuction.active!, {
        type: 'richeseBid', event: game.richeseAuction.event, amount: null,
      });
    } else game = advancedNativeStep(game);
  }
  assert.ok(advancedNativePlayer(game, 'richese').hand.some(c => c.id === card));
  assert.equal(game.richeseCache!.some(c => c.id === card), false);
  for (let i = 0; (game.phase !== 4 || game.response || game.decision || game.phaseOpening) && i < 500; i++)
    game = advancedNativeStep(game);
  assert.equal(game.phase, 4);
  assert.ok(!game.response && !game.decision && !game.phaseOpening);
  return game;
}

/** The shared controlled battle position returns hands to the deck. Restore
 * their actual held physical cards, including the acquired cache lot, rather
 * than treating that staging operation as a new acquisition. */
function heldCardBattle(state: Game, target: string): Game {
  const owner = advancedNativePlayer(state, 'richese').id;
  const game = stageAdvancedNativeSkillBattle(state, owner, target);
  for (const original of state.players) {
    const player = game.players.find(p => p.id === original.id)!;
    for (const card of original.hand) {
      const index = game.deck.findIndex(c => c.id === card.id);
      assert.ok(index >= 0);
      player.hand.push(...game.deck.splice(index, 1));
    }
  }
  return game;
}

/** Explicit acknowledgments prevent fixture bots from executing the green
 * component's independent preleader effect before it is used as a substitute. */
function openBattle(state: Game, target: string, voice?: boolean): Game {
  const owner = advancedNativePlayer(state, 'richese').id;
  let game = applyAction(state, owner, { type: 'chooseBattle', territory: 'wind_pass', target });
  for (let i = 0; i < 100; i++) {
    if (game.response || game.phaseOpening) game = advancedNativeStep(game);
    else if (game.decision?.kind === 'leaderSkillVisibility') {
      game = applyAction(game, game.decision.player, {
        type: 'leaderSkillVisibility', event: game.decision.event, hide: true,
      });
    } else if (game.battle?.preLeader && !game.battle.preLeader.closed) {
      const actor = [owner, target].find(id => !game.battle!.preLeader!.ready.includes(id));
      assert.ok(actor);
      game = applyAction(game, actor, { type: 'battlePreparationReady', event: game.battle.preLeader.event });
    } else if (game.battle?.preparation) {
      const preparation = game.battle.preparation;
      game = applyAction(game, preparation.owner,
        preparation.kind === 'voice' && voice !== undefined
          ? { type: 'voice', kind: 'poison', must: voice }
          : { type: 'declineBattlePower' });
    } else if (game.decision) game = advancedNativeStep(game);
    else return game;
  }
  assert.fail('Original native pre-plan windows did not close.');
}

function resolveGreen(state: Game, target: string, card: string): Game {
  const owner = advancedNativePlayer(state, 'richese');
  const trainer = state.leaderSkills!.assignments.find(a => a.owner === owner.id && a.skill === 'planetologist')!.leader;
  const disc = owner.leaders.find(l => l.id === trainer)!;
  const enemy = state.players.find(p => p.id === target)!;
  const enemyTrainer = state.leaderSkills!.assignments.find(a => a.owner === target)!.leader;
  const opposing = enemy.leaders.find(l => !l.dead && l.id !== enemyTrainer && l.strength <= disc.strength + 1 && l.strength >= disc.strength - 3)!;
  assert.ok(opposing);
  // The opponent scores one above the unmodified trainer. Only the surviving
  // green substitution can cross this score boundary; no paid support is used.
  const dial = (disc.strength + 1 - opposing.strength) * (state.advanced ? 2 : 1);
  let game = applyAction(state, owner.id, { type: 'battlePlan', dial: 0, support: 0, leader: trainer, weapon: card });
  game = applyAction(game, target, { type: 'battlePlan', dial, support: 0, leader: opposing.id });
  game = applyAction(game, owner.id, { type: 'traitorCall', call: false });
  game = applyAction(game, target, { type: 'traitorCall', call: false });
  assert.equal(game.lastBattleContext?.winner, owner.id);
  return finishAdvancedNativeSkillAftermath(game);
}

void test('Basic native Richese uses an acquired Nullentropy Box for winning strength without paying or searching', () => {
  const card = 'richese-nullentropy-box';
  let game = acquireGreen(card, 'basic');
  const target = advancedNativePlayer(game, 'emperor').id;
  game = heldCardBattle(game, target);
  const index = game.deck.findIndex(c => c.kind === 'worthless');
  assert.ok(index >= 0);
  const recoverable = game.deck.splice(index, 1)[0];
  game.discard.push(recoverable); // Conserved card gives the native Box a real search target.
  game = openBattle(game, target);
  const wallet = advancedNativePlayer(game, 'richese').spice;
  game = resolveGreen(game, target, card);
  const owner = advancedNativePlayer(game, 'richese');
  assert.equal(owner.spice, wallet, 'No two-spice native Box payment.');
  assert.equal(owner.hand.some(c => c.id === recoverable.id), false);
  assert.ok(game.discard.some(c => c.id === recoverable.id), 'No native discard search or recovery.');
  assert.equal(game.discard.filter(c => c.id === card).length, 1);
  assert.equal(owner.hand.some(c => c.id === card), false);
  assertAdvancedNativeCustody(game);
});

void test('Advanced marker-only Richese keeps Residual Poison inert, obeys actual-Weapon Voice, and discards its winning substitute', () => {
  const card = 'richese-residual-poison';
  let game = acquireGreen(card, 'advanced', true);
  const target = advancedNativePlayer(game, 'beneGesserit').id;
  game = heldCardBattle(game, target);
  const owner = advancedNativePlayer(game, 'richese');
  owner.reserves += owner.forces['wind_pass:14'];
  owner.forces = {};
  const opponent = advancedNativePlayer(game, 'beneGesserit');
  opponent.reserves += Object.values(opponent.forces).reduce((sum, n) => sum + n, 0);
  opponent.forces = {};
  const poisonIndex = game.deck.findIndex(c => c.kind === 'poison');
  assert.ok(poisonIndex >= 0);
  owner.hand.push(...game.deck.splice(poisonIndex, 1)); // Gives mandatory Voice an actual Weapon alternative.
  Object.assign(game, { phase: 5, active: owner.id, movementRemaining: [...game.order] });
  owner.shipped = false;
  const token = owner.noField!.tokens.find(t => t.value === 0)!;
  game = applyAction(game, owner.id, {
    type: 'ship', noField: token.id, event: owner.noFieldEvent, territory: 'wind_pass', sector: 14,
  });
  for (let i = 0; (game.response || game.decision || game.phaseOpening) && i < 100; i++) game = advancedNativeStep(game);
  assert.equal(advancedNativePlayer(game, 'richese').forces['wind_pass:14'] ?? 0, 0);
  assert.ok(advancedNativePlayer(game, 'richese').noField!.deployed);
  const fighters = advancedNativePlayer(game, 'beneGesserit');
  fighters.reserves += Object.values(fighters.forces).reduce((sum, n) => sum + n, 0);
  fighters.forces = {};
  fighters.reserves -= 8;
  fighters.forces['wind_pass:14'] = 8;
  delete fighters.advisors?.wind_pass;
  // Conserved opposing fighter position after original shipment/arrival decisions.
  Object.assign(game, { phase: 6, active: owner.id, ready: [], movementRemaining: [] });
  const required = openBattle(game, target, true);
  const trainer = required.leaderSkills!.assignments.find(a => a.owner === owner.id)!.leader;
  rejectAdvancedNativeAction(required, owner.id,
    { type: 'battlePlan', dial: 0, support: 0, leader: trainer, weapon: card }, /comply with the Voice/);
  game = openBattle(game, target, false);
  assert.deepEqual(game.battle!.noFieldPlayers, [owner.id]);
  const untrained = advancedNativePlayer(game, 'richese').leaders.find(l => l.id !== trainer)!;
  rejectAdvancedNativeAction(game, owner.id,
    { type: 'battlePlan', dial: 0, support: 0, leader: untrained.id, weapon: card }, /eligible Planetologist Special/);
  const before = advancedNativePlayer(game, 'beneGesserit').leaders.map(l => ({ id: l.id, dead: l.dead, deaths: l.deaths }));
  game = resolveGreen(game, target, card);
  assert.deepEqual(advancedNativePlayer(game, 'beneGesserit').leaders.map(l => ({ id: l.id, dead: l.dead, deaths: l.deaths })), before,
    'Residual Poison did not send any randomly selected enemy leader to the Tanks.');
  assert.equal(advancedNativePlayer(game, 'richese').noField!.deployed, null);
  assert.equal(advancedNativePlayer(game, 'richese').hand.some(c => c.id === card), false);
  assert.equal(game.discard.filter(c => c.id === card).length, 1);
  assertAdvancedNativeCustody(game);
});
