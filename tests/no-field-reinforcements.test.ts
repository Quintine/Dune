import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, RuleError, type Game } from '../game/engine';
import { occupyRicheseSeat } from './fixture-ecaz-occupy-richese';
import {
  noFieldReinforcementsFixture, sealNoFieldReinforcements, finishNoFieldReinforcements,
  NO_FIELD_REINFORCEMENTS, NO_FIELD_HARASS, type NoFieldReinforcementsFixture,
} from './fixture-no-field-reinforcements';

function assertConserved(fixture: NoFieldReinforcementsFixture, game: Game): void {
  const cards = (state: Game) => [...state.deck, ...state.discard,
    ...(state.richeseCache ?? []), ...(state.richeseRemoved ?? []),
    ...state.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.deepEqual(cards(game), cards(fixture.initial), 'Every original deck/cache face keeps physical custody.');
  const traitors = (state: Game) => [...(state.traitorReserve ?? []),
    ...(state.ecazLoyalty?.card ? [state.ecazLoyalty.card] : []),
    ...state.players.flatMap(player => player.traitors)].sort();
  assert.deepEqual(traitors(game), traitors(fixture.afterSetup));
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20,
      `${player.faction} retains its own original twenty counters.`);
    assert.ok([player.reserves, player.tanks, ...Object.values(player.forces)]
      .every(n => Number.isSafeInteger(n) && n >= 0));
  }
}
function assertMarkerRevealed(fixture: NoFieldReinforcementsFixture, game: Game): void {
  const richese = occupyRicheseSeat(game, fixture.richese);
  assert.equal(richese.noField!.deployed, null);
  assert.equal(richese.noField!.lastShipped, fixture.noField.lastShipped,
    'Native revelation preserves the actual most-recent-shipment identity.');
  assert.deepEqual(richese.noField!.tokens, fixture.noField.tokens);
  assert.equal(richese.reserves, fixture.reservesBefore[fixture.richese] - fixture.materializes,
    'Second seal materializes the physical marker before either utility card spends or returns counters.');
  assert.equal(richese.forces[fixture.location] ?? 0, fixture.materializes);
  assert.equal(richese.tanks, occupyRicheseSeat(fixture.game, fixture.richese).tanks);
}
function assertUtilitiesDiscarded(game: Game): void {
  for (const card of [NO_FIELD_REINFORCEMENTS, NO_FIELD_HARASS]) {
    assert.equal(game.discard.filter(face => face.id === card).length, 1);
    assert.ok(game.players.every(player => !player.hand.some(face => face.id === card)));
  }
}


for (const [reserves, marker] of [[3, 3], [7, 5]] as const)
  void test(`No-Field ${marker} with reserves ${reserves} rejects the FIRST Reinforcements seal, but the same owner can seal Harass alone`, () => {
    const fixture = noFieldReinforcementsFixture({ marker, richeseReserves: reserves });
    const game = fixture.game;
    const saved = structuredClone(game);
    const preview = viewGame(game, fixture.owner).battle!.reinforcements!;
    assert.ok(preview.blocked, 'Three current reserves do not imply three reserves after native materialization.');
    assert.equal(preview.normal + preview.elite, reserves - marker);
    assert.equal(preview.noField!.materializes, marker);
    assert.equal(preview.noField!.reservesAfterReveal, reserves - marker);
    assert.equal(viewGame(game, fixture.owner).battle!.harassWithdraw!.blocked, null);
    for (const plan of [fixture.plans.reinforcements, fixture.plans.both]) {
      assert.throws(() => applyAction(game, fixture.owner, plan), RuleError);
      assert.deepEqual(game, saved, 'Rejection cannot debit resources, reveal the marker, reserve a card or hide a sealed plan.');
      assert.equal(game.battle!.plans[fixture.owner], undefined);
      assert.deepEqual(viewGame(game, fixture.opponent).battle!.plans, {});
    }
    const privatePlan = applyAction(game, fixture.owner, fixture.plans.harass);
    assert.ok(privatePlan.battle!.plans[fixture.owner]);
    assert.equal(privatePlan.battle!.plans[fixture.owner].weapon, null);
    assert.deepEqual(occupyRicheseSeat(privatePlan, fixture.richese).noField, fixture.noField);
    assert.equal(occupyRicheseSeat(privatePlan, fixture.richese).reserves, reserves);
    const revealed = applyAction(privatePlan, fixture.opponent, fixture.plans.opponent);
    assertMarkerRevealed(fixture, revealed);
    const { game: done } = finishNoFieldReinforcements(fixture, revealed);
    assert.equal(done.battle, null);
    assert.equal(done.lastBattleContext!.winner, fixture.owner);
    assert.equal(occupyRicheseSeat(done, fixture.richese).reserves, reserves - fixture.variableDial);
    assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(game, fixture.richese).tanks,
      fixture.variableDial, 'Only the original one-counter variable commitment is lost.');
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(game, fixture.ecaz).tanks, 3);
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).forces[fixture.location], 2);
    assert.equal(done.discard.filter(card => card.id === NO_FIELD_HARASS).length, 1);
    assert.equal(done.discard.filter(card => card.id === NO_FIELD_REINFORCEMENTS).length, 0);
    assert.ok(occupyRicheseSeat(done, fixture.owner).hand.some(card => card.id === NO_FIELD_REINFORCEMENTS));
    assertConserved(fixture, done);
  });

for (const [reserves, marker] of [[6, 3], [8, 5], [3, 0]] as const)
  for (const slot of ['weapon', 'defense'] as const)
    void test(`Funded No-Field ${marker}/reserves ${reserves}, Reinforcements in ${slot}: reveal, original cost, own undialed return, original losses`, () => {
      const fixture = noFieldReinforcementsFixture({ marker, richeseReserves: reserves });
      const before = structuredClone(fixture.game);
      const preview = viewGame(before, fixture.owner).battle!.reinforcements!;
      assert.equal(preview.blocked, null);
      assert.equal(preview.normal, 3);
      assert.equal(preview.elite, 0);
      assert.equal(preview.noField!.materializes, marker);
      assert.equal(preview.noField!.reservesAfterReveal, 3);
      const plan = { ...fixture.plans.both,
        weapon: slot === 'weapon' ? NO_FIELD_REINFORCEMENTS : NO_FIELD_HARASS,
        defense: slot === 'defense' ? NO_FIELD_REINFORCEMENTS : NO_FIELD_HARASS };
      const first = applyAction(before, fixture.owner, plan);
      assert.equal(first.battle!.revealed, false);
      assert.deepEqual(occupyRicheseSeat(first, fixture.richese).noField, fixture.noField);
      assert.equal(occupyRicheseSeat(first, fixture.richese).reserves, reserves);
      assert.equal(occupyRicheseSeat(first, fixture.richese).forces[fixture.location] ?? 0, 0);
      assert.equal(occupyRicheseSeat(first, fixture.richese).tanks, occupyRicheseSeat(before, fixture.richese).tanks);
      const revealed = applyAction(first, fixture.opponent, fixture.plans.opponent);
      assert.equal(revealed.battle!.revealed, true);
      assertMarkerRevealed(fixture, revealed);
      const { afterVotes, game: done } = finishNoFieldReinforcements(fixture, revealed);
      assert.equal(occupyRicheseSeat(afterVotes, fixture.richese).reserves, reserves - 3 - fixture.variableDial,
        'The future undialed return neither funds nor changes the three-counter original reserve cost.');
      assert.equal(done.lastBattleContext!.result, 'normal');
      assert.equal(done.lastBattleContext!.winner, fixture.owner);
      assert.equal(occupyRicheseSeat(done, fixture.richese).reserves, reserves - 3 - fixture.variableDial);
      assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(before, fixture.richese).tanks,
        3 + fixture.variableDial);
      assert.equal(occupyRicheseSeat(done, fixture.richese).forces[fixture.location] ?? 0, 0);
      assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(before, fixture.ecaz).tanks, 3,
        'Harass never recomputes the original mandatory ceil(5/2) Ecaz commitment.');
      assert.equal(occupyRicheseSeat(done, fixture.ecaz).forces[fixture.location], 2);
      assert.equal(occupyRicheseSeat(done, fixture.ecaz).reserves, fixture.reservesBefore[fixture.ecaz]);
      assert.equal(occupyRicheseSeat(done, fixture.owner).spice, occupyRicheseSeat(before, fixture.owner).spice - fixture.variableDial,
        'Only original variable support is paid; the withdrawn lead receives no Carthag income.');
      assert.equal(occupyRicheseSeat(done, fixture.richese).noField!.lastShipped, fixture.noField.lastShipped);
      assertUtilitiesDiscarded(done);
      assertConserved(fixture, done);
      assert.deepEqual(fixture.game, before, 'The before-commitment runtime control stays immutable.');
    });

for (const [reserves, marker] of [[6, 3], [8, 5]] as const)
  void test(`Opposing real Traitor with No-Field ${marker} cancels only Harass, never revelation or Reinforcements cost`, () => {
    const fixture = noFieldReinforcementsFixture({ marker, richeseReserves: reserves, opposingTraitor: true });
    const revealed = sealNoFieldReinforcements(fixture);
    assertMarkerRevealed(fixture, revealed);
    const { game: done } = finishNoFieldReinforcements(fixture, revealed);
    assert.equal(done.lastBattleContext!.result, 'traitor');
    assert.equal(done.lastBattleContext!.winner, fixture.opponent);
    assert.equal(occupyRicheseSeat(done, fixture.richese).reserves, reserves - marker - 3,
      'No concealed-marker counter returns after an opposing successful Traitor.');
    assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(fixture.game, fixture.richese).tanks, marker + 3);
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(fixture.game, fixture.ecaz).tanks, 5);
    assert.equal(occupyRicheseSeat(done, fixture.richese).forces[fixture.location] ?? 0, 0);
    assert.equal(occupyRicheseSeat(done, fixture.richese).noField!.deployed, null);
    assert.equal(occupyRicheseSeat(done, fixture.richese).noField!.lastShipped, fixture.noField.lastShipped);
    assertUtilitiesDiscarded(done);
    assertConserved(fixture, done);
  });

for (const [reserves, marker] of [[3, 3], [7, 5]] as const)
  void test(`Ecaz-held same-plan utilities with Richese No-Field ${marker} use only Ecaz original reserves and fixed-undialed counters`, () => {
    const fixture = noFieldReinforcementsFixture({ marker, richeseReserves: reserves, lead: 'ecaz' });
    const preview = viewGame(fixture.game, fixture.owner).battle!.reinforcements!;
    assert.equal(preview.blocked, null, 'The ally marker cannot consume the Ecaz card user reserve pool.');
    assert.equal(preview.normal, 3);
    assert.equal(preview.noField, undefined, 'An allied marker is not an own-marker funding forecast.');
    const revealed = sealNoFieldReinforcements(fixture);
    assertMarkerRevealed(fixture, revealed);
    assert.equal(occupyRicheseSeat(revealed, fixture.ecaz).reserves, fixture.reservesBefore[fixture.ecaz]);
    const { game: done } = finishNoFieldReinforcements(fixture, revealed);
    assert.equal(done.lastBattleContext!.winner, fixture.ecaz);
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).reserves, fixture.reservesBefore[fixture.ecaz] - 3 + 2);
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(fixture.game, fixture.ecaz).tanks, 6);
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).forces[fixture.location] ?? 0, 0);
    assert.equal(occupyRicheseSeat(done, fixture.richese).reserves, reserves - marker,
      'The Richese ally neither funds Ecaz Reinforcements nor receives the Ecaz Harass return.');
    assert.equal(occupyRicheseSeat(done, fixture.richese).forces[fixture.location], marker - 1);
    assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(fixture.game, fixture.richese).tanks, 1);
    assertUtilitiesDiscarded(done);
    assertConserved(fixture, done);
  });

void test('An Ecaz card user cannot fund Reinforcements from its Richese ally after revelation or either future Harass return', () => {
  const fixture = noFieldReinforcementsFixture({ marker: 5, richeseReserves: 8, lead: 'ecaz', ecazReserves: 2 });
  const before = structuredClone(fixture.game);
  assert.ok(viewGame(before, fixture.owner).battle!.reinforcements!.blocked);
  assert.equal(viewGame(before, fixture.owner).battle!.reinforcements!.normal, 2);
  assert.throws(() => applyAction(before, fixture.owner, fixture.plans.both), RuleError);
  assert.deepEqual(before, fixture.game);
  assertConserved(fixture, before);
});

void test('Original Advanced native inventory without the selected Occupy profile still cannot use Reinforcements', () => {
  const fixture = noFieldReinforcementsFixture({ marker: 3, richeseReserves: 6, omitPreview: true });
  const before = structuredClone(fixture.game);
  assert.ok(viewGame(before, fixture.owner).battle!.reinforcements!.blocked);
  assert.throws(() => applyAction(before, fixture.owner, fixture.plans.reinforcements), RuleError);
  assert.deepEqual(before, fixture.game);
  assertConserved(fixture, before);
});
