import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, leaders, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { BattleResolutionQuoteError, quoteBattleResolution, type BattleResolutionInput } from '../game/battle-resolution-quote';
import { isReinforcements, quoteReinforcements, ReinforcementsError, REINFORCEMENTS_CARD } from '../game/reinforcements';

const physicalCards = [...baseDeck(), ...richeseCards(), ...ecazTreacheryCards()];
const reinforcement = ecazTreacheryCards().find(c => c.id === REINFORCEMENTS_CARD)!;

function fixture(slot: 'weapon' | 'defense' = 'weapon'): BattleResolutionInput {
  const attackerLeader = leaders('emperor')[0];
  const defenderLeader = leaders('guild')[0];
  return {
    advanced: true, turn: 2, territory: 'arrakeen',
    attacker: {
      id: 'a', faction: 'emperor', hand: [reinforcement], spice: 10,
      leader: attackerLeader,
      plan: { dial: 2, support: 2, leader: attackerLeader.id, weapon: null, defense: null, [slot]: reinforcement.id },
      forces: { normal: 5, elite: 0, eliteStrength: 2, freeSupport: false },
      reinforcementsReserves: { normal: 1, elite: 2 },
    },
    defender: {
      id: 'd', faction: 'guild', hand: [], spice: 10,
      leader: defenderLeader,
      plan: { dial: 2, support: 2, leader: defenderLeader.id, weapon: null, defense: null },
      forces: { normal: 5, elite: 0, eliteStrength: 2, freeSupport: false },
    },
    voters: [
      { id: 'a', beneficiary: 'a', called: false, traitors: [] },
      { id: 'd', beneficiary: 'd', called: false, traitors: [] },
    ],
    participants: [{ id: 'a', faction: 'emperor' }, { id: 'd', faction: 'guild' }],
    physicalCards, pendingAuditorPresent: false, pendingRetentionPresent: false,
  };
}
function putCard(g: BattleResolutionInput, side: 'attacker' | 'defender', slot: 'weapon' | 'defense', kind: Card['kind'] | 'stoneBurner') {
  const card = physicalCards.find(c => (c.kind === kind || c.effect === kind) && !g.attacker.hand.some(h => h.id === c.id) && !g.defender.hand.some(h => h.id === c.id))!;
  assert.ok(card);
  g[side].hand = [...g[side].hand, card];
  g[side].plan[slot] = card.id;
}

void test('canonical identity and reserve cost boundaries preserve the physical counter types', () => {
  assert.equal(isReinforcements(reinforcement), true);
  assert.equal(isReinforcements({ ...reinforcement, name: 'Reinforcement' }), false);
  assert.equal(isReinforcements({ ...reinforcement, effect: 'recruits' }), false);
  assert.equal(isReinforcements({ ...reinforcement, extra: true } as Card), false);
  assert.deepEqual(quoteReinforcements(3, 0), { normal: 3, elite: 0, bonus: 2 });
  assert.deepEqual(quoteReinforcements(1, 2), { normal: 1, elite: 2, bonus: 2 });
  assert.deepEqual(quoteReinforcements(0, 3), { normal: 0, elite: 3, bonus: 2 });
  assert.deepEqual(quoteReinforcements(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), { normal: 3, elite: 0, bonus: 2 });
  for (const reserves of [[2, 0], [1, 1], [-1, 4], [1.5, 3], [NaN, 3], [Infinity, 3], [Number.MAX_SAFE_INTEGER + 1, 0]])
    assert.throws(() => quoteReinforcements(reserves[0], reserves[1]), ReinforcementsError);
});

void test('either slot adds two score but not dial, support, payment or casualties; card always discards', () => {
  for (const slot of ['weapon', 'defense'] as const) {
    const g = fixture(slot);
    const before = structuredClone(g);
    const q = quoteBattleResolution(g);
    assert.deepEqual(q.reinforcements, [{ player: 'a', card: REINFORCEMENTS_CARD, normal: 1, elite: 2 }]);
    assert.equal(q.result, 'normal');
    assert.equal(q.winner, 'a');
    assert.equal(q.scores!.attacker, 2 + g.attacker.leader!.strength + 2);
    assert.equal(q.scores!.defender, 2 + g.defender.leader!.strength);
    assert.equal(q.casualties!.dial, 2);
    assert.equal(q.casualties!.support, 2);
    assert.deepEqual(q.casualties!.forces, g.attacker.forces);
    assert.deepEqual(q.casualties!.options, [{ normal: 2, elite: 0, paidNormal: 2, paidElite: 0 }]);
    assert.equal(q.payments.find(p => p.player === 'a')!.cost, 2);
    assert.deepEqual(q.discarded, [{ player: 'a', card: REINFORCEMENTS_CARD }]);
    assert.deepEqual(q.winnerCards, []);
    assert.deepEqual(g, before);
  }
  const ordinary = fixture();
  ordinary.attacker.hand = [];
  ordinary.attacker.plan.weapon = null;
  delete ordinary.attacker.reinforcementsReserves;
  assert.equal(quoteBattleResolution(ordinary).reinforcements, undefined);
});

void test('traitor, mutual traitors and explosion all pay the reserve cost and discard independently of winner', () => {
  for (const outcome of ['ownTraitor', 'opponentTraitor', 'mutualTraitors', 'explosion'] as const) {
    const g = fixture();
    if (outcome === 'explosion') {
      putCard(g, 'attacker', 'defense', 'shield');
      putCard(g, 'defender', 'weapon', 'lasgun');
    } else {
      if (outcome !== 'opponentTraitor') {
        g.voters[0].called = true;
        g.voters[0].traitors = [g.defender.plan.leader!];
      }
      if (outcome !== 'ownTraitor') {
        g.voters[1].called = true;
        g.voters[1].traitors = [g.attacker.plan.leader!];
      }
    }
    const q = quoteBattleResolution(g);
    assert.equal(q.result, outcome === 'ownTraitor' || outcome === 'opponentTraitor' ? 'traitor' : outcome);
    assert.deepEqual(q.reinforcements, [{ player: 'a', card: REINFORCEMENTS_CARD, normal: 1, elite: 2 }]);
    assert.equal(q.discarded.filter(c => c.card === REINFORCEMENTS_CARD).length, 1);
    assert.equal(q.winnerCards.includes(REINFORCEMENTS_CARD), false);
    assert.equal(q.scores, null);
    assert.equal(q.casualties, null);
  }
});

void test('the losing card cannot enter a Moritani Nexus retention window', () => {
  const g = fixture();
  g.nexusMoritani = true;
  g.attacker.plan.dial = 0;
  g.attacker.plan.support = 0;
  g.defender.plan.dial = 4;
  g.defender.plan.support = 4;
  const q = quoteBattleResolution(g);
  assert.equal(q.winner, 'd');
  assert.deepEqual(q.reinforcements, [{ player: 'a', card: REINFORCEMENTS_CARD, normal: 1, elite: 2 }]);
  assert.equal(q.retention, null);
  assert.deepEqual(q.discarded, [{ player: 'a', card: REINFORCEMENTS_CARD }]);
});

void test('selected card requires own funded typed reserves and rejects malformed cards, pairs and unsupported combinations', () => {
  const missing = fixture();
  delete missing.attacker.reinforcementsReserves;
  assert.throws(() => quoteBattleResolution(missing), BattleResolutionQuoteError);
  for (const reserves of [{ normal: 2, elite: 0 }, { normal: -1, elite: 4 }, { normal: 1.5, elite: 2 }, { normal: 0, elite: NaN }]) {
    const g = fixture();
    g.attacker.reinforcementsReserves = reserves;
    assert.throws(() => quoteBattleResolution(g), BattleResolutionQuoteError);
  }
  const surplus = fixture();
  surplus.defender.reinforcementsReserves = { normal: 3, elite: 0 };
  assert.throws(() => quoteBattleResolution(surplus), BattleResolutionQuoteError);
  const fake = fixture();
  fake.attacker.hand = [{ ...reinforcement, name: 'Other' }];
  assert.throws(() => quoteBattleResolution(fake), BattleResolutionQuoteError);
  const duplicate = fixture();
  duplicate.attacker.plan.defense = reinforcement.id;
  assert.throws(() => quoteBattleResolution(duplicate), BattleResolutionQuoteError);
  const stone = fixture();
  putCard(stone, 'defender', 'weapon', 'stoneBurner');
  assert.throws(() => quoteBattleResolution(stone), BattleResolutionQuoteError);
});
