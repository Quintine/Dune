import assert from 'node:assert/strict';
import test from 'node:test';
import { INTRODUCTION_STEPS, introductionTraitor, newIntroduction, restoreIntroduction } from '../game/introduction';
import { INTRODUCTION_MOVE_DESTINATIONS, introductionMovement } from '../game/introduction-movement';
import { applyAction, createGame, newPlayer } from '../game/engine';
import { splitLocation } from '../game/board';

void test('movement practice agrees with authoritative moves across every destination, range and storm choice', () => {
  for (const moveDestination of INTRODUCTION_MOVE_DESTINATIONS) for (const moveCity of [false, true])
    for (const moveStorm of [false, true]) for (const moveForces of [1, 3, 5]) {
      const choice = { moveDestination, moveCity, moveStorm, moveForces };
      const quote = introductionMovement(choice), target = splitLocation(moveDestination);
      const g = createGame('PRACTICE', newPlayer('you', 'You', 'atreides'));
      g.players.push(newPlayer('guild', 'Guild', 'guild'), newPlayer('emperor', 'Emperor', 'emperor'));
      Object.assign(g, { status: 'playing', phase: 5, turn: 2, active: 'you', order: ['you', 'guild', 'emperor'],
        movementRemaining: ['you', 'guild', 'emperor'], storm: moveStorm ? target.sector : 18, phaseOpening: null });
      g.players[0].forces = { 'red_chasm:7': 5, ...(moveCity ? { 'arrakeen:10': 1 } : {}) };
      g.players[0].reserves = moveCity ? 14 : 15; g.players[0].shipped = true;
      g.players[0].spice = 8;
      for (const p of g.players.slice(1)) { p.forces = { 'tueks_sietch:5': 1 }; p.reserves = 19; }
      const action = { type: 'move', forces: { 'red_chasm:7': moveForces }, territory: target.territory, sector: target.sector };
      const before = structuredClone(g);
      if (quote.allowed) {
        const done = applyAction(g, 'you', action), own = done.players[0];
        assert.equal(own.forces[moveDestination], quote.arrived);
        assert.equal(own.forces['red_chasm:7'] ?? 0, quote.sourceRemaining);
        assert.equal(own.forces['arrakeen:10'] ?? 0, moveCity ? 1 : 0);
        assert.equal(own.spice, 8); assert.equal(own.moved, 1);
        assert.equal(own.reserves + Object.values(own.forces).reduce((s, n) => s + n, 0), 20);
      } else assert.throws(() => applyAction(g, 'you', action));
      assert.deepEqual(g, before);
    }
});
void test('movement practice distinguishes range, destination storm and full stronghold restrictions', () => {
  const s = newIntroduction();
  assert.equal(introductionMovement(s).steps, 1);
  assert.equal(introductionMovement(s).allowed, true);
  assert.match(introductionMovement({ ...s, moveDestination: 'imperial_basin:9' }).blocked!, /range/);
  assert.equal(introductionMovement({ ...s, moveDestination: 'imperial_basin:9', moveCity: true }).allowed, true);
  assert.match(introductionMovement({ ...s, moveCity: true, moveStorm: true }).blocked!, /storm/);
  assert.match(introductionMovement({ ...s, moveDestination: 'tueks_sietch:5', moveCity: true }).blocked!, /three occupying factions/);
  for (const moveForces of [0, 6, 1.5, NaN]) assert.equal(introductionMovement({ ...s, moveForces }).allowed, false);
});
void test('declined, sole and mutual Traitor calls quote the actual casualty, leader and card consequences', () => {
  const decline = introductionTraitor({ traitorCall: false, opponentTraitor: false });
  assert.equal(decline.result, 'normal'); assert.equal(decline.winner, 'opponent');
  assert.deepEqual(decline.scores, { attacker: 2, defender: 8 });
  assert.equal(decline.basicWinnerLosses, 3);
  for (const you of [true, false]) {
    const outcome = introductionTraitor({ traitorCall: you, opponentTraitor: !you });
    assert.equal(outcome.result, 'traitor'); assert.equal(outcome.winner, you ? 'you' : 'opponent');
    assert.equal(outcome.scores, null); assert.equal(outcome.basicWinnerLosses, null);
    assert.deepEqual(outcome.destroyedArmies, [you ? 'opponent' : 'you']);
    assert.deepEqual(outcome.leaderDeaths, { attacker: !you, defender: you });
    assert.deepEqual(outcome.bounty, { player: you ? 'you' : 'opponent', amount: 5 });
    assert.equal(outcome.discarded.length, 1); assert.equal(outcome.winnerCards.length, 1);
    assert.equal(outcome.discarded[0].player, you ? 'opponent' : 'you');
  }
  const both = introductionTraitor({ traitorCall: true, opponentTraitor: true });
  assert.equal(both.result, 'mutualTraitors'); assert.equal(both.winner, null); assert.equal(both.bounty, null);
  assert.deepEqual(both.leaderDeaths, { attacker: true, defender: true });
  assert.deepEqual(both.destroyedArmies, ['you', 'opponent']);
  assert.equal(both.discarded.length, 2); assert.deepEqual(both.winnerCards, []);
});
void test('all five v1 lessons migrate by identity and retain prior committed choices', () => {
  const old = { version: 1, step: 0, shipment: 4, destination: 'sand', shipped: true,
    dial: 3, defense: 'shield', revealed: true, collectors: 2, city: true, collected: true };
  const titles = ['Your place at the table', 'Ship within your budget', 'Seal a battle plan', 'Collect the spice', 'Join a table'];
  for (const [step, title] of titles.entries()) {
    const result = restoreIntroduction(JSON.stringify({ ...old, step, token: 'excluded', moved: true, traitorCall: true }))!;
    assert.equal(INTRODUCTION_STEPS[result.step].title, title);
    assert.equal(result.version, 5); assert.equal(result.shipped, true); assert.equal(result.revealed, true);
    assert.equal(result.dial, 3); assert.equal(result.collected, true); assert.equal(result.collectors, 2);
    assert.equal(result.moved, false); assert.equal(result.traitorCall, false); assert.equal('token' in result, false);
    assert.deepEqual(restoreIntroduction(JSON.stringify(result)), result);
  }
  assert.equal(restoreIntroduction(JSON.stringify({ ...old, step: 5 })), null);
  assert.equal(restoreIntroduction(JSON.stringify({ ...old, shipment: 6 })), null);
});
void test('new practice choices survive all stages and reject impossible saved commitments', () => {
  for (const traitorStage of ['plans', 'revealed', 'resolved'] as const) for (const opponentTraitor of [false, true]) {
    const s = { ...newIntroduction(), step: 4, traitorStage, opponentTraitor,
      traitorCall: traitorStage === 'resolved', moveCity: true, moved: true };
    const restored = restoreIntroduction(JSON.stringify(s)); assert.deepEqual(restored, s);
    if (traitorStage === 'resolved') assert.deepEqual(introductionTraitor(restored!), introductionTraitor(s));
  }
  for (const patch of [{ moveDestination: 'invented:7' }, { moveForces: 0 }, { moveCity: 'yes' },
    { moved: true, moveStorm: true }, { moved: true, moveDestination: 'imperial_basin:9' },
    { traitorStage: 'later' }, { traitorCall: true }, { opponentTraitor: 1 }, { version: 6 }]) {
    assert.equal(restoreIntroduction(JSON.stringify({ ...newIntroduction(), ...patch })), null);
  }
});
