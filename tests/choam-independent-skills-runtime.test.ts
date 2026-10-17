import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { forceRevivalLimit, forceRevivalQuote } from '../game/revival';
import type { BattleResolutionQuote } from '../game/battle-resolution-quote';
import { quoteIndependentSkillsBattle } from './fixture-independent-skills-battle';
import {
  assertChoamIndependentSkillsCustody, choamIndependentSkillsPlayer,
  createChoamIndependentSkillsFixture, createChoamIndependentSkillsHeldSupportFixture,
  finishChoamIndependentSkillsBattle, openChoamIndependentSkillsBattle,
  sealChoamIndependentSkillsBoth, type ChoamIndependentSkillsFixture,
} from './fixture-choam-independent-skills';

const owner = (fixture: ChoamIndependentSkillsFixture, game: Game) =>
  choamIndependentSkillsPlayer(game, fixture.richese);
const rival = (fixture: ChoamIndependentSkillsFixture, game: Game) =>
  choamIndependentSkillsPlayer(game, fixture.opponent);
/** The quote side belongs to whichever combatant the order-based label names. */
const side = (game: Game, actor: string) =>
  game.battle!.attacker === actor ? 'attacker' as const : 'defender' as const;
const bonusOf = (game: Game, quote: BattleResolutionQuote, actor: string) =>
  quote.leaderSkillBonuses[side(game, actor)];
const scoreOf = (game: Game, quote: BattleResolutionQuote, actor: string) => {
  assert.ok(quote.scores, 'A resolved battle carries totals');
  return quote.scores[side(game, actor)];
};
const held = (game: Game, id: string) =>
  [...game.deck, ...game.discard, ...game.players.flatMap((player) => player.hand)]
    .filter((card) => card.id === id);

for (const advanced of [false, true] as const)
  void test(`${advanced ? 'Advanced' : 'Basic'} CHOAM/Richese independent all14 funds Reinforcements after the concealed marker materializes and returns the real undialed army`, () => {
    const fixture = createChoamIndependentSkillsFixture(advanced ? { advanced: true } : {});
    // The independent three-card marker rides the selected E2 ordinary deck, and
    // Richese keeps its own separate ten-card cache alongside all fourteen skills.
    assert.equal(fixture.offered.richeseCache!.length, 10);
    // Live plan window: the preview already forecasts the capped materialization
    // and the three reserves the fee must find afterwards.
    const open = openChoamIndependentSkillsBattle(fixture);
    assert.deepEqual(open.battle!.plans, {});
    assert.equal(owner(fixture, open).reserves, advanced ? 20 : 6);
    const preview = viewGame(open, fixture.richese).battle!.reinforcements!;
    assert.equal(preview.blocked, null);
    assert.equal(preview.noField!.materializes, 3);
    assert.equal(preview.noField!.reservesAfterReveal, advanced ? 17 : 3);
    assert.equal(preview.normal, 3);
    const withdraw = viewGame(open, fixture.richese).battle!.harassWithdraw!;
    assert.equal(withdraw.blocked, null);
    assert.equal(withdraw.forces.normal, 3);
    assert.equal(withdraw.forces.elite, 0);
    assert.deepEqual(withdraw.locations, { [fixture.location]: { normal: 3, elite: 0 } });
    // The reveal materializes the capped physical counters; the fee follows them.
    const revealed = sealChoamIndependentSkillsBoth(fixture, 'both', open);
    assert.equal(revealed.battle!.revealed, true);
    const shown = owner(fixture, revealed);
    assert.equal(shown.forces[fixture.location], 3);
    assert.equal(shown.reserves, advanced ? 17 : 3);
    assert.equal(shown.tanks, 0);
    assert.equal(shown.noField!.deployed, null);
    assert.equal(shown.noField!.lastShipped, fixture.token.id);
    assert.equal(new Set(shown.noField!.tokens.map((token) => token.id)).size, 3);
    // The revealed totals: dial + Reinforcements + trained Mentat + physical leader.
    const quote = quoteIndependentSkillsBattle(revealed, { returns: fixture.returns });
    assert.deepEqual(quote.reinforcements,
      [{ player: fixture.richese, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    assert.deepEqual(quote.harassWithdraw?.map((entry) => ({ returned: entry.returned, locations: entry.locations })),
      [{ returned: { normal: advanced ? 2 : 1, elite: 0 },
        locations: { [fixture.location]: { normal: advanced ? 2 : 1, elite: 0 } } }]);
    assert.deepEqual(bonusOf(revealed, quote, fixture.richese),
      { bonus: 2, applied: [{ skill: 'mentat', amount: 2, mode: 'skilled' }] });
    assert.deepEqual(bonusOf(revealed, quote, fixture.opponent), { bonus: 0, applied: [] });
    assert.equal(scoreOf(revealed, quote, fixture.richese) - scoreOf(revealed, quote, fixture.opponent), 1);
    // The whole undialed army lies in the marker's own sector, so the native
    // return is unambiguous and needs no typed allocation.
    const spice = owner(fixture, revealed).spice;
    const done = finishChoamIndependentSkillsBattle(revealed, { return: fixture.returns });
    assert.equal(done.lastBattleContext?.winner, fixture.richese);
    assert.equal(done.lastBattleContext?.result, 'normal');
    const after = owner(fixture, done);
    assert.equal(after.reserves, advanced ? 16 : 1,
      'Revealed reserves, minus the three-reserve fee, plus the returned undialed counter');
    assert.equal(after.tanks, advanced ? 4 : 5);
    assert.deepEqual(after.forces, advanced ? {} : { 'broken_land:12': 5, 'carthag:11': 9 });
    assert.equal(after.spice, spice - Number(fixture.plans.both.action.support ?? 0));
    for (const card of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD]) {
      assert.equal(held(done, card).length, 1, card);
      assert.equal(done.discard.filter((entry) => entry.id === card).length, 1, card);
      assert.ok(done.players.every((player) => !player.hand.some((face) => face.id === card)), card);
    }
    assertChoamIndependentSkillsCustody(fixture, done);
    // The same physical dial without Reinforcements loses: its +2 score,
    // rather than another force or support payment, supplies the winning margin.
    const plain = finishChoamIndependentSkillsBattle(
      sealChoamIndependentSkillsBoth(fixture, 'plain', open), { return: fixture.returns });
    assert.equal(plain.lastBattleContext?.winner, fixture.opponent);
    assert.equal(owner(fixture, plain).reserves, advanced ? 17 : 3);
    assert.equal(owner(fixture, plain).tanks, 3);
    assert.deepEqual(owner(fixture, plain).forces, advanced ? {} : { 'broken_land:12': 5, 'carthag:11': 9 });
    assertChoamIndependentSkillsCustody(fixture, plain);
  });

void test('A reserve-capped marker five at three reserves refuses the funded plan before the reveal and still plays the real Harass fallback', () => {
  const fixture = createChoamIndependentSkillsFixture({ marker: 5, reserves: 3, stopBeforePlans: true });
  const preview = viewGame(fixture.beforePlans, fixture.richese).battle!.reinforcements!;
  assert.equal(preview.noField!.materializes, 3, 'The reveal is capped by the physical reserves');
  assert.equal(preview.noField!.reservesAfterReveal, 0);
  assert.equal(preview.normal + preview.elite, 0);
  const saved = structuredClone(fixture.beforePlans);
  for (const plan of [fixture.plans.reinforcements, fixture.plans.both]) {
    assert.throws(() => applyAction(fixture.beforePlans, fixture.richese, plan.action));
    assert.deepEqual(fixture.beforePlans, saved, 'A refused plan reserves no counter, card or window');
  }
  const revealed = sealChoamIndependentSkillsBoth(fixture, 'harass');
  assert.equal(revealed.battle!.revealed, true);
  const shown = owner(fixture, revealed);
  assert.equal(shown.forces[fixture.location], 3, 'The capped marker still materializes its three counters');
  assert.equal(shown.reserves, 0);
  assert.equal(shown.tanks, 0);
  const done = finishChoamIndependentSkillsBattle(revealed, { return: fixture.returns });
  assert.equal(done.lastBattleContext?.winner, fixture.opponent);
  const after = owner(fixture, done);
  assert.equal(after.reserves, 1, 'Only the undialed counter returned; no fee was charged');
  assert.equal(after.tanks, 2, 'The two dialed counters reached the Tanks');
  assert.deepEqual(after.forces, { 'broken_land:12': 5, 'carthag:11': 12 });
  assertChoamIndependentSkillsCustody(fixture, done);
});

void test('The independent CHOAM/Richese setup keeps the separate cache and each seat printed revival exception', () => {
  const fixture = createChoamIndependentSkillsFixture({});
  assert.equal(fixture.offered.richeseCache!.length, 10);
  assert.ok(fixture.offered.richeseCache!.every((card) => card.id.startsWith('richese-')),
    'The cache holds only Richese faces, never ordinary deck cards');
  for (const card of fixture.offered.richeseCache!)
    assert.ok(!fixture.offered.deck.some((face) => face.id === card.id),
      `${card.id} stays out of the ordinary deck`);
  const choam = choamIndependentSkillsPlayer(fixture.afterSetup, fixture.choam);
  assert.equal(forceRevivalLimit(fixture.afterSetup, choam), 20);
  assert.deepEqual(forceRevivalQuote(fixture.afterSetup, choam, 5),
    { free: 0, normalCost: 10, cost: 5 },
    'CHOAM pays one spice per returned force with no free revival and no normal limit');
  for (const actor of [fixture.richese, fixture.classic]) {
    const seat = choamIndependentSkillsPlayer(fixture.afterSetup, actor);
    assert.equal(forceRevivalLimit(fixture.afterSetup, seat), 3);
    assert.deepEqual(forceRevivalQuote(fixture.afterSetup, seat, 5),
      { free: 2, normalCost: 6, cost: 6 });
  }
  const done = finishChoamIndependentSkillsBattle(
    sealChoamIndependentSkillsBoth(fixture, 'both'), { return: fixture.returns });
  assertChoamIndependentSkillsCustody(fixture, done);
  // Every seat keeps its own counters and the printed hand limit end to end.
  for (const player of done.players) {
    const pool = player.reserves + player.tanks +
      Object.values(player.forces).reduce((sum, count) => sum + count, 0);
    assert.equal(pool, 20, player.faction);
  }
  assert.equal(rival(fixture, done).tanks, rival(fixture, fixture.beforePlans).tanks +
    (rival(fixture, fixture.beforePlans).forces[fixture.location] ?? 0),
  'The defeated garrison, not armies elsewhere, reached the Tanks');
});

void test('the first real Richese Mentat claim supports a funded second marker without paying or refunding its reserve fee', () => {
  const f = createChoamIndependentSkillsHeldSupportFixture({ tech: true, strongholds: true });
  const { first } = f;
  assert.equal(first.offered.richeseCache!.length, 10);
  assert.notEqual(first.trainers[first.choam], 'choam-auditor');
  assert.equal(f.firstAfterBattle.strongholdCards!.owners.arrakeen, null);
  assert.equal(owner(first, f.firstAfterBattle).forces[first.location], 2,
    'The first machine winner really keeps the two undialed marker counters');
  assert.equal(f.afterFirstMentat.strongholdCards!.claimedTurn, 1);
  assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, first.richese);
  assert.equal(owner(first, f.afterFirstMentat).forces[first.location], 2);
  const shipped = owner(first, f.afterMarkerShipment), beforeShipment = owner(first, f.beforeMarkerShipment);
  assert.equal(shipped.reserves, beforeShipment.reserves,
    'The different concealed token does not borrow physical counters before reveal');
  assert.notEqual(shipped.noField!.lastShipped, owner(first, first.afterShipment).noField!.lastShipped,
    'The original same-token consecutive-shipment limit remains in force');
  assert.equal(owner(first, f.beforePlans).forces[first.location], 2);
  assert.equal(rival(first, f.beforePlans).reserves, rival(first, f.beforeEnemyShipment).reserves - 4);
  assert.equal(rival(first, f.beforePlans).spice, rival(first, f.beforeEnemyShipment).spice - 4,
    'The returning enemy army paid its real four-force stronghold invoice');
  const preview = viewGame(f.beforePlans, first.richese).battle!;
  assert.equal(preview.strongholdEffects![first.richese], 'arrakeen');
  assert.equal(preview.reinforcements!.noField!.materializes, 5);
  assert.equal(preview.reinforcements!.noField!.reservesAfterReveal, 9);
  assert.equal(preview.reinforcements!.normal, 3);
  assert.equal(owner(first, f.revealed).forces[first.location], 7);
  assert.equal(owner(first, f.revealed).reserves, 9);
  const quote = quoteIndependentSkillsBattle(f.revealed, { returns: f.returns });
  const payment = quote.payments.find(entry => entry.player === first.richese)!;
  assert.equal(payment.bankSupport, 2);
  assert.equal(payment.ownPayment, 0);
  assert.equal(payment.cost, 0);
  assert.deepEqual(bonusOf(f.revealed, quote, first.richese),
    { bonus: 2, applied: [{ skill: 'mentat', amount: 2, mode: 'skilled' }] });
  assert.deepEqual(quote.reinforcements,
    [{ player: first.richese, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
  assert.equal(quote.auditor, null, 'The native Auditor never becomes an ordinary trained battle leader');
  const after = owner(first, f.afterBattle), revealed = owner(first, f.revealed);
  assert.equal(f.afterBattle.lastBattleContext!.winner, first.richese);
  assert.equal(after.spice, revealed.spice, 'Held bank support is a discount, never personal income');
  assert.equal(after.reserves, revealed.reserves - 3 + 5,
    'The three-reserve card fee is still paid before the five real undialed forces return');
  assert.equal(after.tanks, revealed.tanks + 3 + 2,
    'Free support neither funds extra reserve counters nor rescues the fee from Tanks');
  assert.equal(after.forces[first.location] ?? 0, 0);
  assert.equal(rival(first, f.afterBattle).tanks, rival(first, f.revealed).tanks + 4);
  for (const id of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD])
    assert.equal(f.afterBattle.discard.filter(card => card.id === id).length, 1);
  assertChoamIndependentSkillsCustody(first, f.afterBattle);
});
