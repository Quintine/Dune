import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixBattleCards, leaders, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { type CombatForces } from '../game/combat';
import { HARASS_WITHDRAW_CARD, type HarassWithdrawContext } from '../game/harass-withdraw';
import { stoneBurnerComparison, type StoneBurnerSide } from '../game/stone-burner';
import {
  quoteBattleResolution,
  BattleResolutionQuoteError,
  type BattleResolutionInput,
  type ResolutionCombatant,
} from '../game/battle-resolution-quote';

const catalog = (): Card[] => [...baseDeck(), ...ixBattleCards(), ...richeseCards(), ...ecazTreacheryCards()];
const opposite = (side: StoneBurnerSide): StoneBurnerSide => side === 'attacker' ? 'defender' : 'attacker';
function withdrawal(forces: CombatForces): HarassWithdrawContext {
  return {
    blocked: null, forces,
    locations: { 'carthag:10': { normal: forces.normal, elite: forces.elite } },
  };
}
function fixture(harassSide: StoneBurnerSide = 'attacker', samePlan = true, advanced = true): BattleResolutionInput {
  const side = (id: string, faction: 'emperor' | 'guild', normal: number): ResolutionCombatant => {
    const leader = { ...leaders(faction)[0], strength: 0 };
    return {
      id, faction, spice: 10, hand: [], leader,
      forces: { normal, elite: 0, eliteStrength: 1, freeSupport: !advanced },
      plan: { dial: 1, support: advanced ? 1 : 0, leader: leader.id, weapon: null, defense: null },
    };
  };
  const attacker = side('a', 'emperor', harassSide === 'attacker' ? 5 : 3);
  const defender = side('d', 'guild', harassSide === 'defender' ? 5 : 3);
  const input: BattleResolutionInput = {
    advanced, turn: 2, territory: 'carthag', attacker, defender,
    voters: [attacker, defender].map(s => ({ id: s.id, beneficiary: s.id, called: false, traitors: [] })),
    participants: [attacker, defender].map(s => ({ id: s.id, faction: s.faction })),
    physicalCards: catalog(), pendingAuditorPresent: false, pendingRetentionPresent: false,
  };
  const harass = input.physicalCards.find(c => c.id === HARASS_WITHDRAW_CARD)! as Card;
  const stone = input.physicalCards.find(c => (c as Card).effect === 'stoneBurner')! as Card;
  input[harassSide].hand = [harass];
  input[harassSide].plan.defense = harass.id;
  input[harassSide].harassWithdraw = withdrawal(input[harassSide].forces);
  const stoneSide = samePlan ? harassSide : opposite(harassSide);
  input[stoneSide].hand = [...input[stoneSide].hand, stone];
  input[stoneSide].plan.weapon = stone.id;
  input[stoneSide].stoneMode = 'ignore';
  return input;
}

void test('same-plan and opposing Stone compare only counters left after Harass, reversing the original winner in either slot and rules mode', () => {
  for (const advanced of [false, true])
    for (const harassSide of ['attacker', 'defender'] as const)
      for (const samePlan of [false, true]) {
        const input = fixture(harassSide, samePlan, advanced);
        const otherSide = opposite(harassSide);
        const original = stoneBurnerComparison(input.attacker.forces, 1, advanced ? 1 : 0,
          input.defender.forces, 1, advanced ? 1 : 0);
        assert.equal(original.winner, harassSide);
        const before = structuredClone(input);
        const quote = quoteBattleResolution(input);
        assert.equal(quote.result, 'normal');
        assert.equal(quote.winner, input[otherSide].id);
        assert.deepEqual(quote.stone?.[harassSide], [0]);
        assert.deepEqual(quote.stone?.[otherSide], [2]);
        assert.deepEqual(quote.scores, { attacker: 1, defender: 1 });
        assert.deepEqual(quote.leaderDeaths, { attacker: false, defender: false });
        assert.deepEqual(quote.harassWithdraw?.[0].returned, { normal: 4, elite: 0 });
        assert.deepEqual(quote.destroyedArmies, [input[harassSide].id]);
        assert.deepEqual(quote.payments.map(p => p.ownPayment), advanced ? [1, 1] : []);
        assert.ok(quote.discarded.some(c => c.player === input[harassSide].id && c.card === HARASS_WITHDRAW_CARD));
        const stoneSide = samePlan ? harassSide : otherSide;
        assert.equal(quote.winnerCards.includes(input[stoneSide].plan.weapon!), !samePlan);
        if (advanced)
          assert.deepEqual(quote.casualties?.options, [{ normal: 1, elite: 0, paidNormal: 1, paidElite: 0 }]);
        else assert.equal(quote.basicWinnerLosses, 1);
        assert.deepEqual(input, before);
      }
});

void test('post-withdrawal zero ties honor the actual aggressor and a Harass winner keeps only Stone with its original commitment', () => {
  for (const harassSide of ['attacker', 'defender'] as const)
    for (const aggressor of ['attacker', 'defender'] as const) {
      const input = fixture(harassSide);
      input[opposite(harassSide)].forces.normal = 1;
      input.aggressor = input[aggressor].id;
      const quote = quoteBattleResolution(input);
      assert.equal(quote.winner, input[aggressor].id);
      assert.deepEqual(quote.stone, { winner: aggressor, attacker: [0], defender: [0] });
      if (aggressor === harassSide) {
        assert.deepEqual(quote.winnerCards, [input[harassSide].plan.weapon]);
        assert.equal(quote.casualties?.fullyCommitted, true);
        assert.equal(quote.casualties?.forces.normal, 1);
        assert.deepEqual(quote.casualties?.options, [{ normal: 1, elite: 0, paidNormal: 1, paidElite: 0 }]);
      }
    }
});

function typedFixture(): BattleResolutionInput {
  const input = fixture('attacker', false);
  input.attacker.forces = { normal: 5, elite: 1, eliteStrength: 2, freeSupport: false };
  input.attacker.plan.dial = 3;
  input.attacker.harassWithdraw = withdrawal(input.attacker.forces);
  // Original legal commitments leave one, two or three counters. This return
  // selects three normal and one elite fighter; all undialed counters leave.
  input.attacker.harassSelection = { 'carthag:10': { normal: 2, elite: 0 } };
  return input;
}

void test('a selected typed Harass commitment resolves the previously ambiguous Stone winner, not the original dial strength', () => {
  const input = typedFixture();
  assert.equal(stoneBurnerComparison(input.attacker.forces, 3, 1, input.defender.forces, 1, 1).winner, null);
  const quote = quoteBattleResolution(input);
  assert.deepEqual(quote.stone, { winner: 'defender', attacker: [0], defender: [2] });
  assert.deepEqual(quote.harassWithdraw?.[0].remaining, { ...input.attacker.forces, normal: 3, elite: 1 });
  assert.deepEqual(quote.scores, { attacker: 3, defender: 1 });
  assert.equal(quote.winner, 'd');
  for (const [dial, support] of [[9, 1], [3, 7]]) {
    const invalid = structuredClone(input);
    invalid.attacker.plan.dial = dial;
    invalid.attacker.plan.support = support;
    assert.throws(() => quoteBattleResolution(invalid), BattleResolutionQuoteError);
  }
});

void test('validated opposing and mutual traitors cancel Harass before Stone counts while traitor outcomes bypass allocation ambiguity', () => {
  for (const mutual of [false, true]) {
    const input = typedFixture();
    input.voters[1].called = true;
    input.voters[1].traitors = [input.attacker.plan.leader!];
    if (mutual) {
      input.voters[0].called = true;
      input.voters[0].traitors = [input.defender.plan.leader!];
    }
    const before = structuredClone(input);
    const quote = quoteBattleResolution(input);
    assert.equal(quote.harassWithdraw, undefined);
    assert.deepEqual(quote.stone, { winner: null, attacker: [1, 2, 3], defender: [2] });
    assert.equal(quote.result, mutual ? 'mutualTraitors' : 'traitor');
    assert.equal(quote.winner, mutual ? null : 'd');
    assert.equal(quote.casualties, null);
    assert.deepEqual(input, before);
  }
  const ownCall = typedFixture();
  ownCall.voters[0].called = true;
  ownCall.voters[0].traitors = [ownCall.defender.plan.leader!];
  const quote = quoteBattleResolution(ownCall);
  assert.equal(quote.result, 'traitor');
  assert.equal(quote.winner, 'a');
  assert.deepEqual(quote.stone?.attacker, [0]);
  assert.equal(quote.harassWithdraw?.length, 1);
  assert.equal(quote.payments[0].freeByTraitor, true);
});

void test('Mirror-copied Stone uses resolved weapons after Harass and retains original mode, leader death and bounty rules', () => {
  const input = fixture();
  const mirror = catalog().find(c => c.effect === 'mirrorWeapon')!;
  input.defender.hand = [mirror];
  input.defender.plan.weapon = mirror.id;
  input.defender.stoneMode = 'kill';
  input.attacker.leader!.strength = 3;
  input.defender.leader!.strength = 2;
  const quote = quoteBattleResolution(input);
  assert.equal(quote.winner, 'd');
  assert.deepEqual(quote.stone, { winner: 'defender', attacker: [0], defender: [2] });
  assert.deepEqual(quote.leaderDeaths, { attacker: true, defender: true });
  assert.deepEqual(quote.scores, { attacker: 1, defender: 1 });
  assert.deepEqual(quote.bounty, { player: 'd', amount: 5 });
  assert.deepEqual(quote.winnerCards, [mirror.id]);
  assert.deepEqual(quote.discarded, [
    { player: 'a', card: input.attacker.plan.weapon },
    { player: 'a', card: HARASS_WITHDRAW_CARD },
  ]);
  delete input.defender.stoneMode;
  assert.throws(() => quoteBattleResolution(input), BattleResolutionQuoteError);
  const invalidVoter = fixture();
  invalidVoter.voters[1].called = true;
  assert.throws(() => quoteBattleResolution(invalidVoter), BattleResolutionQuoteError);
});
