import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { maxCombatDial } from '../game/combat';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import {
  createClassicIndependentNexusBattleFixture,
  revealIndependentNexusBattle, finishIndependentNexusBattle,
  independentNexusBattlePlayer as player,
} from './fixture-classic-independent-nexus-battle';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected native plan or stale Nexus use cannot change physical custody');
}

void test('native Advanced Emperor Cunning changes five shipped ordinary counters, while independent reserve fees and enemy withdrawal retain their physical sources', () => {
  const f = createClassicIndependentNexusBattleFixture();
  const before = player(f.game, f.owner), enemy = player(f.game, f.opponent);
  assert.equal(player(f.afterShipment, f.owner).reserves, player(f.beforeShipment, f.owner).reserves - 5);
  assert.equal(player(f.afterShipment, f.owner).spice, player(f.beforeShipment, f.owner).spice - 5);
  assert.equal(f.afterDraw.nexusCards!.cards!.hands[f.owner], 'emperor');
  const revealed = revealIndependentNexusBattle(f, { cunning: true });
  assert.equal(revealed.nexusCards!.cards!.hands[f.owner], null);
  rejected(revealed, f.owner, { type: 'nexusSardaukar', event: revealed.nexusSardaukarLast!.event });
  const forces = viewGame(revealed, f.owner).battle!.ownForces!;
  assert.equal(forces.normal, 5);
  assert.equal(forces.elite, 0);
  assert.equal(forces.temporaryElite, 5);
  assert.equal(forces.eliteStrength, 2);
  assert.equal(forces.freeSupport, false);
  assert.equal(maxCombatDial(forces), 10);
  assert.equal(revealed.battle!.plans[f.owner].support, 2);
  assert.deepEqual(player(revealed, f.owner).elites, before.elites,
    'Cunning never replaces the native elite reserve stock or creates elite counters');
  const cleanup = finishIndependentNexusBattle(revealed);
  const own = player(cleanup, f.owner), other = player(cleanup, f.opponent);
  assert.equal(cleanup.lastBattleContext!.winner, f.owner);
  assert.equal(own.reserves, before.reserves - 3, 'Reinforcements consumes exactly three ordinary reserve counters');
  assert.equal(own.tanks, before.tanks + 5, 'Three reserve fees and two committed temporary-Sardaukar counters are distinct ordinary losses');
  assert.equal(own.forces[f.key], 3);
  assert.equal(own.spice, before.spice - 2 + 2, 'Support2 is paid before native Carthag Collection2');
  assert.deepEqual(own.elites, before.elites);
  assert.equal(other.reserves, enemy.reserves + 9, 'Harass returns the nine actual undialed enemy board counters');
  assert.equal(other.tanks, enemy.tanks + 1);
  assert.equal(other.forces[f.key] ?? 0, 0);
  assert.equal(other.spice, enemy.spice - 1);
  assert.equal(cleanup.nexusSardaukarHistory!.length, 1);
  assert.equal(cleanup.nexusSardaukarHistory![0].casualties!.outcome, 'complete');
  assert.equal(cleanup.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
  assert.equal(cleanup.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, 1);
  assert.equal(cleanup.discard.filter(card => card.id === HARASS_WITHDRAW_CARD).length, 1);
  for (const seat of cleanup.players)
    assert.equal(seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, count) => sum + count, 0), 20);
  assert.equal(cleanup.turn, 2);
  assert.equal(cleanup.phase, 7);
  assert.equal(viewGame(cleanup, f.owner).nexusSardaukar!.active, false);
});

void test('a genuinely dealt opposing Karama spends Cunning without converting physical fighters, and invalid over-dial plans remain immutable', () => {
  const f = createClassicIndependentNexusBattleFixture();
  const before = player(f.game, f.owner);
  rejected(f.game, f.owner, { type: 'battlePlan', leader: f.ownerLeader,
    dial: 11, support: 0, weapon: REINFORCEMENTS_CARD, defense: null });
  const revealed = revealIndependentNexusBattle(f, { cunning: true, canceled: true });
  const forces = viewGame(revealed, f.owner).battle!.ownForces!;
  assert.equal(forces.temporaryElite ?? 0, 0);
  assert.equal(maxCombatDial(forces), 5);
  assert.equal(revealed.battle!.plans[f.owner].support, 4);
  assert.equal(revealed.nexusSardaukarLast!.stage, 'canceled');
  const cleanup = finishIndependentNexusBattle(revealed);
  const own = player(cleanup, f.owner);
  assert.equal(cleanup.lastBattleContext!.winner, f.owner);
  assert.equal(own.forces[f.key], 1, 'The same dial now loses four ordinary board counters, not two temporary Sardaukar');
  assert.equal(own.tanks, before.tanks + 7);
  assert.equal(own.reserves, before.reserves - 3, 'Cancellation cannot refund or duplicate the separate Reinforcements cost');
  assert.equal(own.spice, before.spice - 4 + 2, 'Canceled conversion pays support4 before native Carthag Collection2');
  assert.deepEqual(own.elites, before.elites);
  assert.equal(player(cleanup, f.opponent).reserves, player(f.game, f.opponent).reserves + 9);
  assert.equal(cleanup.discard.filter(card => card.id === f.counter).length, 1);
  assert.equal(cleanup.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
  assert.equal(cleanup.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(cleanup.phase, 7);
});

void test('Basic independent battle preserves ordinary dial losses and free support rather than borrowing the Advanced Cunning advantage', () => {
  const f = createClassicIndependentNexusBattleFixture(false);
  const before = player(f.game, f.owner);
  const offer = viewGame(f.game, f.owner).nexusSardaukar!.offer!;
  rejected(f.game, f.owner, { type: 'nexusSardaukar', event: offer.event });
  const cleanup = finishIndependentNexusBattle(revealIndependentNexusBattle(f));
  const own = player(cleanup, f.owner);
  assert.equal(cleanup.lastBattleContext!.winner, f.owner);
  assert.equal(own.spice, before.spice);
  assert.equal(own.tanks, before.tanks + 7);
  assert.equal(own.forces[f.key], 1);
  assert.equal(own.reserves, before.reserves - 3);
  assert.equal(player(cleanup, f.opponent).reserves, player(f.game, f.opponent).reserves + 9);
  assert.equal(player(cleanup, f.opponent).tanks, player(f.game, f.opponent).tanks + 1);
  assert.equal(cleanup.nexusCards!.cards!.hands[f.owner], 'emperor', 'The blocked Advanced ability cannot spend a genuinely drawn Basic Nexus card');
  assert.equal(cleanup.phase, 7);
});
