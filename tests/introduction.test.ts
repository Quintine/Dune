import assert from 'node:assert/strict';
import test from 'node:test';
import { INTRODUCTION_STEPS, introductionBattle, introductionCollection, introductionShipment, newIntroduction, restoreIntroduction } from '../game/introduction';
import { RULE_TOPICS } from '../game/reference';

void test('shipping practice applies ordinary per-force prices and exposes an unaffordable choice', () => {
  assert.deepEqual(introductionShipment({ shipment: 4, destination: 'sand' }), { cost: 8, remaining: 0, affordable: true });
  assert.deepEqual(introductionShipment({ shipment: 6, destination: 'sand' }), { cost: 12, remaining: -4, affordable: false });
  assert.deepEqual(introductionShipment({ shipment: 6, destination: 'stronghold' }), { cost: 6, remaining: 2, affordable: true });
});
void test('battle practice resolves protected ties, losing dials and the wrong defense through actual combat', () => {
  const tie = introductionBattle({ dial: 3, defense: 'shield' });
  assert.equal(tie.winner, 'you');
  assert.deepEqual(tie.scores, { attacker: 8, defender: 8 });
  assert.deepEqual(tie.leaderDeaths, { attacker: false, defender: false });
  assert.equal(tie.basicWinnerLosses, 3);
  assert.deepEqual(tie.destroyedArmies, ['opponent']);
  const loss = introductionBattle({ dial: 2, defense: 'shield' });
  assert.equal(loss.winner, 'opponent');
  assert.deepEqual(loss.destroyedArmies, ['you']);
  assert.equal(loss.basicWinnerLosses, 3);
  const killed = introductionBattle({ dial: 6, defense: 'snooper' });
  assert.equal(killed.winner, 'opponent');
  assert.equal(killed.leaderDeaths.attacker, true);
  assert.deepEqual(killed.scores, { attacker: 6, defender: 8 });
  assert.deepEqual(killed.bounty, { player: 'opponent', amount: 5 });
  assert.equal(killed.discarded.some(entry => entry.player === 'you'), true);
});
void test('every offered battle plan stays legal and normal with no support payment in Basic', () => {
  for (let dial = 0; dial <= 6; dial++) for (const defense of ['shield', 'snooper'] as const) {
    const result = introductionBattle({ dial, defense });
    assert.equal(result.result, 'normal');
    assert.ok(result.payments.every(payment => payment.cost === 0));
    assert.equal(result.leaderDeaths.defender, false);
  }
});
void test('collection practice caps actual income at the pile and applies the city rate', () => {
  assert.deepEqual(introductionCollection({ collectors: 0, city: true }), { amount: 0, remaining: 8 });
  assert.deepEqual(introductionCollection({ collectors: 3, city: false }), { amount: 6, remaining: 2 });
  assert.deepEqual(introductionCollection({ collectors: 3, city: true }), { amount: 8, remaining: 0 });
  assert.deepEqual(introductionCollection({ collectors: 6, city: false }), { amount: 8, remaining: 0 });
});
void test('saved practice restores sealed choices, rejects corrupt versions and strips unrelated data', () => {
  const saved = { ...newIntroduction(), step: 3, dial: 3, revealed: true, shipped: true };
  assert.deepEqual(restoreIntroduction(JSON.stringify(saved)), saved);
  assert.deepEqual(restoreIntroduction(JSON.stringify({ ...saved, token: 'not-a-real-token', hand: ['private'] })), saved);
  for (const raw of [null, '', '{', 'null', '[]', JSON.stringify({ ...saved, version: 7 }),
    JSON.stringify({ ...saved, step: -1 }), JSON.stringify({ ...saved, step: 13 }),
    JSON.stringify({ ...saved, defense: 'lasgun' }), JSON.stringify({ ...saved, dial: 2.5 }),
    JSON.stringify({ ...saved, collectors: 99 }), JSON.stringify({ ...saved, revealed: 'true' }),
    JSON.stringify({ ...saved, shipment: 6, destination: 'sand', shipped: true })]) {
    assert.equal(restoreIntroduction(raw), null);
  }
  assert.deepEqual(introductionBattle(restoreIntroduction(JSON.stringify(saved))!), introductionBattle(saved));
});
void test('each introduction lesson links to an existing internal rule topic', () => {
  for (const step of INTRODUCTION_STEPS) assert.ok(RULE_TOPICS.some(topic => topic.id === step.topic), step.topic);
});
