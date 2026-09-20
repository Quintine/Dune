import test from 'node:test';
import assert from 'node:assert/strict';
import { INTRODUCTION_STEPS, newIntroduction, restoreIntroduction } from '../game/introduction';
import { introductionCharity, introductionRevival } from '../game/introduction-resources';

void test('all nine v4 lessons retain their identity and prior commitments when resource practice is inserted', () => {
  const titles = ['Your place at the table', 'Choose an ally at the Nexus', 'Bid for a hidden card',
    'Ship within your budget', 'Move across the board', 'Seal a battle plan', 'Reveal a Traitor', 'Collect the spice', 'Join a table'];
  for (const [step, title] of titles.entries()) {
    const old = { ...newIntroduction(), version: 4, step, shipped: true, moved: true,
      moveCity: true, revealed: true, collected: true, traitorStage: 'resolved', traitorCall: true,
      auctionActions: [null, 4], auctionBid: 4, allianceActions: ['offer'], allianceClosed: true,
      allianceChecked: true, charitySpice: 'ignore', charityClaimed: true, revivalActions: ['ignore'],
      token: 'discarded' };
    const restored = restoreIntroduction(JSON.stringify(old))!;
    assert.equal(restored.version, 5);
    assert.equal(INTRODUCTION_STEPS[restored.step].title, title);
    assert.ok(restored.shipped && restored.moved && restored.revealed && restored.collected && restored.traitorCall);
    assert.deepEqual(restored.auctionActions, [null, 4]);
    assert.deepEqual(restored.allianceActions, ['offer']);
    assert.equal(restored.allianceChecked, true);
    assert.equal(restored.charityClaimed, false);
    assert.equal(restored.charitySpice, 0);
    assert.deepEqual(restored.revivalActions, []);
    assert.equal(Object.hasOwn(restored, 'token'), false);
    assert.deepEqual(restoreIntroduction(JSON.stringify(restored)), restored);
  }
  assert.equal(restoreIntroduction(JSON.stringify({ ...newIntroduction(), version: 4, step: 9 })), null);
});

void test('resource choices and paid outcomes restore exactly without retaining unrelated fields', () => {
  const state = { ...newIntroduction(), step: 4, charityClaimed: true,
    revivalActions: [{ kind: 'forces' as const, amount: 1 }, { kind: 'forces' as const, amount: 1 },
      { kind: 'forces' as const, amount: 1 }, { kind: 'leader' as const, leader: 4 }] };
  const restored = restoreIntroduction(JSON.stringify({ ...state, serverGame: { private: 'excluded' } }));
  assert.deepEqual(restored, state);
  assert.deepEqual(introductionRevival(restored!), introductionRevival(state));
  assert.deepEqual(introductionCharity(restored!), introductionCharity(state));
  assert.equal(introductionRevival(restored!).spice, 3);
  for (const patch of [
    { charitySpice: 2, charityClaimed: true }, { charitySpice: -1 }, { charityClaimed: 'yes' },
    { revivalFaction: 'tleilaxu' }, { revivalRoster: 'invented' }, { revivalSpice: 99 },
    { revivalAmount: 0 }, { revivalLeader: 5 }, { revivalActions: [{ kind: 'forces', amount: 4 }] },
    { revivalActions: [{ kind: 'leader', leader: 0, token: 'extra' }] },
    { revivalActions: [{ kind: 'forces', amount: 1 }, { kind: 'forces', amount: 3 }] },
  ]) assert.equal(restoreIntroduction(JSON.stringify({ ...newIntroduction(), ...patch })), null);
});
