import test from 'node:test';
import assert from 'node:assert/strict';
import { introductionAlliance } from '../game/introduction-alliance';
import { INTRODUCTION_STEPS, newIntroduction, restoreIntroduction } from '../game/introduction';
import { applyAction, createGame, newPlayer } from '../game/engine';
import { quoteVictory } from '../game/victory-quote';

void test('alliance practice requires agreement, preserves separate ownership and checks victory only later', () => {
  const state = newIntroduction();
  const invited = introductionAlliance(state);
  assert.equal(invited.incoming, true);
  assert.equal(invited.allied, false);
  assert.equal(invited.progress.target, 3);
  const offered = introductionAlliance({ ...state, allianceScenario: 'waits', allianceActions: ['offer'] });
  assert.equal(offered.outgoing, true);
  assert.equal(offered.allied, false);
  assert.equal(offered.progress.strongholds.length, 2);
  const accepted = introductionAlliance({ ...state, allianceActions: ['offer'] });
  assert.equal(accepted.allied, true);
  assert.equal(accepted.progress.strongholds.length, 4);
  assert.equal(accepted.progress.target, 4);
  assert.equal(accepted.progress.qualifies, true);
  assert.deepEqual(accepted.winner, []);
  assert.deepEqual(accepted.players.map(p => p.forces), invited.players.map(p => p.forces));
  const finished = { ...state, allianceActions: ['offer' as const], allianceClosed: true, allianceChecked: true };
  assert.deepEqual(introductionAlliance(finished).winner, ['you', 'emperor']);
  const short = introductionAlliance({ ...finished, allianceHoldings: 1 });
  assert.equal(short.progress.strongholds.length, 3);
  assert.deepEqual(short.winner, []);
  const broken = introductionAlliance({ ...finished, allianceActions: ['offer', 'leave'] });
  assert.equal(broken.allied, false);
  assert.equal(broken.progress.target, 3);
  assert.deepEqual(broken.winner, []);
});

void test('every offered alliance sequence matches engine pairing and keeps formation, withdrawal and break saved', () => {
  let samples = 0;
  for (const allianceScenario of ['invited', 'accepts', 'waits'] as const)
    for (const allianceHoldings of [1, 2] as const)
      for (const allianceActions of [[], ['offer'], ['leave'], ['offer', 'leave']] as Array<Array<'offer' | 'leave'>>) {
        const state = { ...newIntroduction(), allianceScenario, allianceHoldings, allianceActions };
        const expected = introductionAlliance(state);
        const initial = introductionAlliance({ ...state, allianceScenario: 'waits', allianceActions: [] });
        let game = createGame('LEARNALLY', newPlayer('you', 'You', 'atreides'));
        game.players = initial.players.map(seat => ({ ...newPlayer(seat.id, seat.id, seat.faction),
          forces: seat.forces, reserves: 20 - Object.values(seat.forces).reduce((a, b) => a + b, 0) }));
        Object.assign(game, { status: 'playing', phase: 1, turn: 2, nexus: true,
          order: game.players.map(p => p.id), phaseOpening: null, storm: 18 });
        for (const action of expected.actions) {
          const before = structuredClone(game);
          const next = applyAction(game, action.actor,
            { type: 'alliance', ...(action.target ? { target: action.target } : {}) });
          assert.deepEqual(game, before);
          game = JSON.parse(JSON.stringify(next));
          assert.equal(game.status, 'playing');
          assert.deepEqual(game.winner, []);
        }
        assert.deepEqual(game.players.map(p => ({ id: p.id, ally: p.ally })), expected.players.map(p => ({ id: p.id, ally: p.ally })));
        assert.deepEqual(game.allianceOffers, expected.offers);
        assert.deepEqual(game.players.map(p => p.forces), initial.players.map(p => p.forces));
        const closed = { ...state, allianceClosed: true };
        assert.equal(introductionAlliance(closed).canOffer, false);
        assert.equal(introductionAlliance(closed).canLeave, false);
        const checked = { ...closed, allianceChecked: true };
        const restored = restoreIntroduction(JSON.stringify(checked));
        assert.deepEqual(restored, checked);
        assert.deepEqual(introductionAlliance(restored!).winner, quoteVictory({ ...game, phase: 8 }).winner);
        game.nexus = false;
        const before = structuredClone(game);
        assert.throws(() => applyAction(game, 'you', { type: 'alliance' }), /Nexus/);
        assert.deepEqual(game, before);
        samples++;
      }
  assert.equal(samples, 24);
});

void test('v3 migration preserves all eight lesson identities, completed auction and old decisions', () => {
  const titles = ['Your place at the table', 'Bid for a hidden card', 'Ship within your budget',
    'Move across the board', 'Seal a battle plan', 'Reveal a Traitor', 'Collect the spice', 'Join a table'];
  for (const [step, title] of titles.entries()) {
    const old = { ...newIntroduction(), version: 3, step, auctionActions: [null, 4], auctionBid: 4,
      shipped: true, moved: true, moveCity: true, revealed: true, collected: true,
      traitorStage: 'resolved', traitorCall: true, allianceActions: ['invalid'], allianceChecked: true, token: 'discarded' };
    const restored = restoreIntroduction(JSON.stringify(old))!;
    assert.equal(restored.version, 4);
    assert.equal(INTRODUCTION_STEPS[restored.step].title, title);
    assert.deepEqual(restored.auctionActions, [null, 4]);
    assert.ok(restored.shipped && restored.moved && restored.revealed && restored.collected && restored.traitorCall);
    assert.deepEqual(restored.allianceActions, []);
    assert.equal(restored.allianceChecked, false);
    assert.equal(Object.hasOwn(restored, 'token'), false);
  }
  assert.equal(restoreIntroduction(JSON.stringify({ ...newIntroduction(), version: 3, step: 8 })), null);
});

void test('alliance saves reject invented stages and impossible action sequences', () => {
  for (const patch of [
    { allianceScenario: 'secret' }, { allianceHoldings: 3 }, { allianceHoldings: '2' },
    { allianceActions: null }, { allianceActions: ['leave', 'offer'] },
    { allianceActions: ['offer', 'offer'] }, { allianceActions: ['leave', 'leave'] },
    { allianceActions: ['offer', 'leave', 'offer'] }, { allianceActions: ['attack'] },
    { allianceClosed: 1 }, { allianceChecked: 'yes' }, { allianceChecked: true },
  ]) assert.equal(restoreIntroduction(JSON.stringify({ ...newIntroduction(), ...patch })), null);
});
