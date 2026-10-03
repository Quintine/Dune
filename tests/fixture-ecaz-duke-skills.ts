import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { leaders, treacheryDeck, type Card } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import {
  advancedNativePlayer as player, advancedNativeStep, assertAdvancedNativeCustody,
  advanceAdvancedNativeSkillsToPhase, completedAdvancedNativeSkillsGame,
  stageAdvancedNativeSkillBattle,
} from './fixture-advanced-native-skills';

export const reloadEcazDukeSkills = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const ecazDukeSkillsAction = (game: Game, actor: string, action: Action): Game =>
  applyAction(reloadEcazDukeSkills(game), actor, action);
export const ecazDukeSkillsTrainer = (game: Game) => {
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === player(game, 'ecaz').id)!;
  assert.equal(assignment.skill, 'warmaster');
  return assignment;
};

export function assertEcazDukeSkillsCustody(game: Game): void {
  assertAdvancedNativeCustody(game);
  const physical = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(c => c.id);
  assert.deepEqual(physical.sort(), treacheryDeck(game.expansions).map(c => c.id).sort());
  for (const seat of game.players)
    assert.deepEqual(seat.leaders.map(l => l.id).sort(), leaders(seat.faction).map(l => l.id).sort());
  assert.equal(player(game, 'ecaz').leaders.length, 5);
  assert.equal(game.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.equal(game.dukeVidal!.leader.strength, 6);
  assert.equal(game.dukeVidal!.leader.faction, 'ecaz');
  assert.equal(game.players.some(p => p.leaders.some(l => l.id === DUKE_VIDAL_ID)), false);
  assert.equal(game.leaderSkills!.assignments.some(a => a.leader === DUKE_VIDAL_ID), false);
  const traits = [...game.traitorReserve!, ...game.players.flatMap(p => p.traitors),
    ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : [])];
  assert.deepEqual(traits.sort(), traitorDeck(game.players, game.expansions.includes('ix')).sort());
  assert.equal(traits.includes(DUKE_VIDAL_ID), false);
  validateAmbassadors(game.ecazAmbassadors!);
}

function responses(state: Game): Game {
  let game = state;
  for (let i = 0; game.response && i < 100; i++)
    game = advancedNativeStep(reloadEcazDukeSkills(game));
  assert.equal(game.response, null);
  return game;
}

/** Original Ecaz setup, original end-of-Revival paid token placement, actual
 * entrant shipment and owner acquisition. The only controlled board position
 * returns deployed forces to their own reserves and puts the storm at sector18
 * after genuine setup/phase progression. Cards, wallets, discs, traitors and
 * the original random Ambassador cohort are never replaced or cherry-picked. */
export function acquireNativeEcazSkillDuke(rules: 'basic' | 'advanced' = 'advanced'): Game {
  let game = completedAdvancedNativeSkillsGame({
    family: 'ecaz', requestedSkill: 'warmaster', opponents: ['emperor'], rules,
  });
  const actor = player(game, 'ecaz').id, entrant = player(game, 'emperor').id;
  const assignment = structuredClone(ecazDukeSkillsTrainer(game));
  assert.equal(game.dukeVidal!.controller, null);
  assertEcazDukeSkillsCustody(game);
  game = advanceAdvancedNativeSkillsToPhase(game, 4);
  // Explicit conserved position, not a claim of played movement history.
  for (const seat of game.players) {
    seat.reserves += Object.values(seat.forces).reduce((sum, n) => sum + n, 0);
    seat.forces = {};
    if (seat.elites) {
      seat.elites.reserves += Object.values(seat.elites.forces).reduce((sum, n) => sum + n, 0);
      seat.elites.forces = {};
    }
  }
  game.storm = 18;
  for (let i = 0; game.decision?.kind !== 'ecazPlacement' && i < 100; i++)
    game = advancedNativeStep(reloadEcazDukeSkills(game));
  assert.equal(game.decision?.kind, 'ecazPlacement');
  const token = game.ecazAmbassadors!.tokens.find(t => t.effect === 'ecaz')!;
  const cohort = structuredClone(game.ecazAmbassadors!.cohort);
  const wallet = player(game, 'ecaz').spice;
  game = ecazDukeSkillsAction(game, actor, { type: 'decision', token: token.id, territory: 'arrakeen' });
  game = responses(game);
  assert.equal(player(game, 'ecaz').spice, wallet - 1);
  assert.equal(game.ecazAmbassadors!.tokens.find(t => t.id === token.id)!.zone, 'placed');
  game = ecazDukeSkillsAction(game, actor, { type: 'decision', decline: true });
  game = responses(game);
  assert.equal(game.phase, 5);
  for (let i = 0; game.active !== entrant && i < 10; i++) {
    assert.ok(game.active);
    game = responses(ecazDukeSkillsAction(game, game.active, { type: 'endMovement' }));
  }
  assert.equal(game.active, entrant);
  const before = reloadEcazDukeSkills(game);
  game = ecazDukeSkillsAction(game, entrant, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1 });
  game = responses(game);
  assert.equal(game.pendingAmbassador!.owner, actor);
  assert.equal(game.pendingAmbassador!.entrant, entrant);
  assert.equal(viewGame(game, actor).ambassadorEntry!.dukeAcquisition!.blocked, null);
  assert.equal(player(game, 'emperor').reserves, player(before, 'emperor').reserves - 1);
  assert.equal(player(game, 'emperor').forces['arrakeen:10'], 1);
  assert.equal(player(game, 'emperor').spice, player(before, 'emperor').spice - 1);
  const disc = structuredClone(game.dukeVidal!.leader);
  const shippedPlayers = structuredClone(game.players);
  game = ecazDukeSkillsAction(game, actor, {
    type: 'decision', event: game.pendingAmbassador!.event,
    trigger: true, beneficiary: actor, choice: 'duke',
  });
  assert.deepEqual(game.players, shippedPlayers);
  assert.deepEqual(game.dukeVidal!.leader, disc);
  assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn],
    [actor, 'ecaz', game.turn]);
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.ecazAmbassadors!.tokens.find(t => t.id === token.id)!.zone, 'supply');
  assert.deepEqual(game.ecazAmbassadors!.cohort, cohort);
  assert.deepEqual(ecazDukeSkillsTrainer(game), assignment);
  assertEcazDukeSkillsCustody(game);
  return game;
}

/** Controlled subsequent native battle position after real token acquisition.
 * Transfer original deck cards, not fabricated cards; original Duke custody and
 * its separate normal-disc trainer survive the conserved board relocation. */
export function stageNativeEcazDukeSkillBattle(state: Game, poison = false): {
  game: Game; actor: string; enemy: string; worthless: Card; weapon?: Card; defender: string;
} {
  const actor = player(state, 'ecaz').id, enemy = player(state, 'emperor').id;
  let game = stageAdvancedNativeSkillBattle(state, actor, enemy);
  // Retain the original interrupted movement suffix; only the conserved board
  // position is staged. Both armies now have a real pending native battle.
  Object.assign(game, { phase: state.phase, active: state.active, order: [...state.order], ready: [...state.ready] });
  for (let i = 0; game.phase === 5 && i < 20; i++) {
    assert.ok(game.active);
    game = responses(ecazDukeSkillsAction(game, game.active, { type: 'endMovement' }));
  }
  assert.equal(game.phase, 6);
  assert.equal(game.dukeVidal!.controller, actor);
  // Explicit controlled chooser order at the genuine Battle boundary gives
  // Ecaz the attacker's printed tie-break; neither army or battle is removed.
  game.order = [actor, enemy];
  game.active = actor;
  const take = (owner: string, kind: Card['kind']): Card => {
    const index = game.deck.findIndex(c => c.kind === kind);
    assert.ok(index >= 0, 'Transfer an original physical native-deck card.');
    const card = game.deck.splice(index, 1)[0];
    game.players.find(p => p.id === owner)!.hand.push(card);
    return card;
  };
  const worthless = take(actor, 'worthless');
  const weapon = poison ? take(enemy, 'poison') : undefined;
  // The real setup attaches the Emperor's card to first-disc Fenring6,
  // leaving this printed5 disc available while the native trainers stay face up.
  const defender = player(game, 'emperor').leaders.find(l => l.strength === 5)!;
  assert.notEqual(game.leaderSkills!.assignments.find(a => a.owner === enemy)!.leader, defender.id);
  assertEcazDukeSkillsCustody(game);
  return { game, actor, enemy, worthless, weapon, defender: defender.id };
}

