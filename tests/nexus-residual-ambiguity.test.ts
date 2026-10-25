import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { nexusInspectionFixture, inspectionNative, inspectionInventory, inspectionResidual } from './fixture-nexus-inspection';
import { nexusAllow, nexusPlayer } from './fixture-nexus-cards';
import {
  createResidualCunningPriorityFixture as fixture, actResidualCunningPriority as act,
  answerResidualCunningPriority as answer, prepareResidualCunningPriority as prepare,
  finishResidualCunningPriority as finish, residualCunningPriorityPlayer as player,
  residualCunningPriorityInventory as inventory,
  type ResidualCunningPriorityFixture as Fixture, type ResidualCunningPriorityStep as Step,
} from './fixture-residual-cunning-priority';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function source(f: Fixture) {
  assert.equal(f.lobby.advanced, true); assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true);
  assert.deepEqual(f.setup.expansions, ['choam']); assert.ok(f.setup.nexusCards?.cards);
  assert.equal(f.beforeControlled.phase, 2); assert.equal(f.beforeControlled.advanced, true);
  assert.deepEqual(f.game.players.map(p => ({ player: p.id, ids: p.leaders.map(l => l.id).sort() })), f.originalLeaders);
  assert.equal(player(f.game).spice, 0); assert.equal(player(f.game).forces['pasty_mesa:5'], 4);
  assert.equal(player(f.game).reserves, 16); assert.equal(player(f.game).tanks, 0);
  assert.ok(!player(f.game).specialKaramaUsed); assert.equal(player(f.game).ally, null);
  assert.deepEqual(player(f.game).leaders.filter(l => !l.dead).map(l => l.id), [f.victim]);
  assert.equal(player(f.game).hand.length, f.kind === 'nativeImpossible' ? 1 : 3);
  assert.equal(player(f.game).hand.filter(card => card.effect === 'karama').length, f.karama ? 1 : 0);
  assert.equal(player(f.game).hand.some(card => card.kind === 'hero' || card.kind === 'worthless'), false);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.deepEqual(f.game.battle!.plans, {}); assert.equal(f.game.battle!.prescience!.value, f.nativeValue);
  assert.equal(f.game.battle!.nexusInspection!.field, f.extraField);
  assert.deepEqual(f.game.battle!.nexusInspection!.answers, [f.extraValue]);
  assert.equal(f.game.nexusCards!.cards!.discard.filter(card => card === 'atreides').length, 1);
  assert.match(f.staging[0], /CONTROLLED|controlled/); assert.equal(f.sourceActionCount, f.actions.length);
}
function poison(f: Fixture, actions: Step[] = []) {
  source(f); assert.equal(viewGame(f.game, f.asker).residualPoison!.blocked, null);
  const before = structuredClone(f.game), game = act(f.game, f.asker, f.action, actions);
  const old = player(before).leaders.find(l => l.id === f.victim)!, dead = player(game).leaders.find(l => l.id === f.victim)!;
  assert.equal(old.dead, false); assert.equal(dead.dead, true); assert.equal(dead.deaths, old.deaths + 1);
  assert.deepEqual(player(game).leaders.filter(l => l.id !== f.victim), player(before).leaders.filter(l => l.id !== f.victim));
  const physical = (g: Game) => g.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks, spice: p.spice }));
  assert.deepEqual(physical(game), physical(before));
  assert.equal(game.discard.filter(card => card.id === f.residual).length, 1);
  assert.equal(game.battle!.event, f.event); assert.equal(game.battle!.revealed, false); assert.deepEqual(game.battle!.plans, {});
  assert.deepEqual(game.nexusCards, before.nexusCards); assert.deepEqual(inventory(game), f.originalInventory);
  reject(game, f.asker, f.action); return game;
}

void test('controlled Advanced Residual preserves native dial and reopens the resource-exclusive Cunning weapon before actual cash-in and battle', () => {
  const f = fixture({ kind: 'nativeDial' }), actions: Step[] = [];
  let game = poison(f, actions); const record = game.battle!.nexusInspection!;
  assert.equal(game.battle!.prescience!.field, 'dial'); assert.equal(game.battle!.prescience!.value, 3);
  assert.deepEqual(record.first, { player: f.asker, field: 'dial', value: 3 }); assert.deepEqual(record.firstCurrent, { value: 3 });
  assert.equal(record.stage, 'answer'); assert.equal(record.field, 'weapon'); assert.deepEqual(record.answers, [f.projectile]);
  assert.equal(game.battle!.preparation?.kind, 'nexusPrescienceAnswer');
  // One activation Karama cannot also be sold. Keeping the projectile leaves
  // only Ghola to fund support3; spending that card removes the sole revival.
  reject(game, f.target, { type: 'nexusPrescienceAnswer', event: f.event, value: f.projectile });
  game = answer(game, f, actions);
  assert.equal(game.battle!.prescience!.value, 3); assert.deepEqual(game.battle!.nexusInspection!.answers, [f.projectile, null]);
  const nexus = structuredClone(game.nexusCards), deaths = player(game).leaders.map(l => [l.id, l.deaths]);
  game = prepare(game, f, actions);
  assert.equal(player(game).spice, 3); assert.equal(player(game).specialKaramaUsed, true);
  assert.equal(game.discard.filter(card => card.id === f.ghola).length, 1);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(player(game).leaders.map(l => [l.id, l.deaths]), deaths);
  assert.equal(player(game).leaders.every(l => l.dead), true); assert.deepEqual(game.nexusCards, nexus);
  assert.ok(player(game).hand.some(card => card.id === f.projectile));
  reject(game, f.target, { ...f.targetPlan, weapon: f.projectile });
  game = finish(game, f, actions);
  assert.equal(game.phase, 7); assert.equal(game.lastBattleContext?.winner, f.target);
  assert.equal(player(game).forces['pasty_mesa:5'], 1); assert.equal(player(game).tanks, 3); assert.equal(player(game).spice, 0);
  assert.equal(actions.filter(step => step.action.mode === 'special').length, 1);
  assert.deepEqual(game.nexusCards, nexus); assert.deepEqual(inventory(game), f.originalInventory);
});

void test('controlled Advanced Residual preserves native weapon and reanswers the later dial before actual Ghola revival and battle', () => {
  const f = fixture({ kind: 'nativeWeapon' }), actions: Step[] = [];
  let game = poison(f, actions);
  assert.equal(game.battle!.prescience!.value, f.projectile);
  assert.deepEqual(game.battle!.nexusInspection!.firstCurrent, { value: f.projectile });
  assert.equal(game.battle!.nexusInspection!.stage, 'answer'); assert.deepEqual(game.battle!.nexusInspection!.answers, [3]);
  reject(game, f.target, { type: 'nexusPrescienceAnswer', event: f.event, value: 3 });
  game = answer(game, f, actions);
  assert.deepEqual(game.battle!.nexusInspection!.answers, [3, 0]); assert.equal(game.battle!.prescience!.value, f.projectile);
  game = finish(game, f, actions);
  assert.equal(game.phase, 7); assert.equal(game.lastBattleContext?.winner, f.target);
  const returned = player(game).leaders.find(l => l.id === f.victim)!;
  assert.equal(returned.dead, false); assert.equal(returned.deaths, 1);
  assert.equal(game.discard.filter(card => card.id === f.ghola).length, 1);
  assert.equal(game.discard.some(card => card.id === f.karama), false); assert.ok(!player(game).specialKaramaUsed);
  assert.equal(player(game).forces['pasty_mesa:5'], 4);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'atreides').length, 1);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('controlled impossible native weapon reopens native then the original Cunning field without another Nexus use', () => {
  const f = fixture({ kind: 'nativeImpossible' }), actions: Step[] = [];
  let game = poison(f, actions); const old = structuredClone(game.battle!.nexusInspection!);
  assert.equal(Object.hasOwn(game.battle!.prescience!, 'value'), false);
  assert.equal(old.firstCurrent, undefined); assert.equal(old.stage, 'answer'); assert.deepEqual(old.answers, [0]);
  assert.equal(old.first!.value, f.projectile); assert.equal(game.battle!.preparation?.kind, 'prescienceAnswer');
  reject(game, f.target, { type: 'nexusPrescienceAnswer', event: f.event, value: 0 });
  reject(game, f.target, { type: 'prescienceAnswer', value: f.projectile });
  game = act(game, f.target, { type: 'prescienceAnswer', value: null }, actions);
  assert.equal(game.battle!.preparation?.kind, 'nexusPrescienceAnswer');
  assert.equal(game.battle!.nexusInspection!.first!.value, f.projectile);
  assert.deepEqual(game.battle!.nexusInspection!.firstCurrent, { value: null });
  assert.deepEqual(game.battle!.nexusInspection!.answers, [0]);
  game = act(game, f.target, { type: 'nexusPrescienceAnswer', event: f.event, value: 0 }, actions);
  assert.deepEqual(game.battle!.nexusInspection!.answers, [0, 0]); assert.equal(game.battle!.nexusInspection!.field, 'dial');
  game = finish(game, f, actions); assert.equal(game.phase, 7); assert.equal(game.lastBattleContext?.winner, f.asker);
  assert.equal(player(game).leaders.every(l => l.dead), true); assert.equal(player(game).spice, 0);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'atreides').length, 1);
  assert.equal(actions.filter(step => step.action.type === 'nexusAtreides').length, 0);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('answered Basic Cunning remains binding when an actual Residual death leaves both original disclosures feasible', () => {
  let game = inspectionNative(nexusInspectionFixture(false, 'a', { richese: true }), 'dial', 0);
  const residual = inspectionResidual(game), event = game.battle!.event!;
  game = nexusAllow(applyAction(game, 'a', { type: 'nexusAtreides', event, mode: 'cunning', field: 'weapon' }));
  game = applyAction(game, 'h', { type: 'nexusPrescienceAnswer', event, value: null });
  const before = structuredClone(game), old = structuredClone(game.battle!.nexusInspection);
  assert.equal(viewGame(game, 'a').residualPoison!.blocked, null);
  game = applyAction(game, 'a', { type: 'card', card: residual, target: 'h', event });
  assert.equal(nexusPlayer(game, 'h').leaders.filter(l => l.dead).length, 1);
  assert.equal(nexusPlayer(before, 'h').leaders.filter(l => l.dead).length, 0);
  assert.equal(game.battle!.prescience!.value, 0); assert.deepEqual(game.battle!.nexusInspection, old);
  assert.equal(game.battle!.nexusInspection!.stage, 'answered'); assert.deepEqual(game.battle!.plans, {});
  const leader = nexusPlayer(game, 'h').leaders.find(l => !l.dead && !l.usedAt)!;
  game = applyAction(game, 'h', { type: 'battlePlan', dial: 0, leader: leader.id, weapon: null, defense: null });
  assert.equal(game.battle!.plans.h.leader, leader.id); assert.equal(game.battle!.plans.h.weapon, null);
  assert.equal(game.discard.filter(card => card.id === residual).length, 1); inspectionInventory(game);
});
