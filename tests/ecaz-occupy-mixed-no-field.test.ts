import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, RuleError, type Game } from '../game/engine';
import { occupyRicheseSeat } from './fixture-ecaz-occupy-richese';
import { NO_FIELD_HARASS, NO_FIELD_REINFORCEMENTS } from './fixture-no-field-reinforcements';
import {
  ecazOccupyMixedNoFieldFixture, sealEcazOccupyMixedNoField, finishEcazOccupyMixedNoField,
  type EcazOccupyMixedNoFieldFixture,
} from './fixture-ecaz-occupy-mixed-no-field';

function assertCustody(fixture: EcazOccupyMixedNoFieldFixture, game: Game): void {
  const cards = (state: Game) => [...state.deck, ...state.discard,
    ...(state.richeseCache ?? []), ...(state.richeseRemoved ?? []),
    ...state.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.deepEqual(cards(game), cards(fixture.initial), 'Every original physical card retains custody.');
  const traitors = (state: Game) => [...(state.traitorReserve ?? []),
    ...(state.ecazLoyalty?.card ? [state.ecazLoyalty.card] : []),
    ...state.players.flatMap(player => player.traitors)].sort();
  assert.deepEqual(traitors(game), traitors(fixture.afterSetup));
  for (const player of game.players) {
    const counters = [player.reserves, player.tanks, ...Object.values(player.forces)];
    assert.equal(counters.reduce((sum, count) => sum + count, 0), 20,
      `${player.faction} keeps its own twenty physical counters.`);
    assert.ok(counters.every(count => Number.isSafeInteger(count) && count >= 0));
    assert.ok(player.hand.length <= 4, 'Conserved staging must not leave a native hand over its limit.');
  }
}
function assertFirstSeal(fixture: EcazOccupyMixedNoFieldFixture, first: Game): void {
  const before = occupyRicheseSeat(fixture.preplan, fixture.richese);
  const sealed = occupyRicheseSeat(first, fixture.richese);
  assert.equal(first.battle!.revealed, false);
  assert.deepEqual(sealed.noField, fixture.noField);
  assert.equal(sealed.noFieldEvent, before.noFieldEvent);
  assert.equal(sealed.reserves, before.reserves);
  assert.equal(sealed.forces[fixture.location], fixture.ordinary);
  assert.equal(sealed.tanks, before.tanks);
  assert.equal(viewGame(first, fixture.opponent).battle!.plans[fixture.owner], undefined);
  assertCustody(fixture, first);
}
function assertReveal(fixture: EcazOccupyMixedNoFieldFixture, revealed: Game): void {
  const richese = occupyRicheseSeat(revealed, fixture.richese);
  const original = occupyRicheseSeat(fixture.preplan, fixture.richese);
  assert.equal(revealed.battle!.revealed, true);
  assert.equal(richese.noField!.deployed, null);
  assert.equal(richese.noField!.lastShipped, fixture.noField.deployed!.tokenId);
  assert.deepEqual(richese.noField!.tokens, fixture.noField.tokens);
  assert.notEqual(richese.noFieldEvent, original.noFieldEvent);
  assert.equal(richese.forces[fixture.location], fixture.ordinary + fixture.materializes,
    'Both actual seals add native marker counters to, rather than replace, ordinary counters.');
  assert.equal(richese.reserves, original.reserves - fixture.materializes);
  assert.equal(richese.tanks, original.tanks);
  assertCustody(fixture, revealed);
}
function assertHistory(fixture: EcazOccupyMixedNoFieldFixture, revealed: Game, done: Game): void {
  const richese = occupyRicheseSeat(done, fixture.richese);
  assert.equal(richese.noField!.deployed, null);
  assert.deepEqual(richese.noField!.tokens, fixture.noField.tokens);
  assert.equal(richese.noField!.lastShipped, fixture.noField.lastShipped);
  assert.equal(richese.noFieldEvent, occupyRicheseSeat(revealed, fixture.richese).noFieldEvent,
    'Withdrawal, losses and aftermath must not perform a second marker revelation.');
  for (const actor of [fixture.ecaz, fixture.richese, fixture.opponent]) {
    const history = viewGame(done, actor).players.find(player => player.id === fixture.richese)!.noField!;
    assert.equal(history.deployed, null);
    assert.equal(history.lastUsed, fixture.marker, 'The actual shipped denomination becomes native public history.');
  }
  assert.equal(done.battle, null);
  assert.equal(done.decision, null);
  assertCustody(fixture, done);
}
function assertUtilities(game: Game, used: readonly string[]): void {
  for (const id of [NO_FIELD_HARASS, NO_FIELD_REINFORCEMENTS]) {
    assert.equal(game.discard.filter(card => card.id === id).length, used.includes(id) ? 1 : 0);
    assert.equal(game.players.flatMap(player => player.hand).filter(card => card.id === id).length,
      used.includes(id) ? 0 : 1);
  }
}

// Three denominations, one reserve-capped positive marker, and both selected
// plan actors. Every case retains positive ordinary Richese physical presence.
for (const lead of ['ecaz', 'ally'] as const)
  for (const [marker, reserves] of [[0, 0], [3, 6], [5, 2]] as const)
    void test(`Mixed Richese variable ally: marker ${marker}, reserves ${reserves}, ${lead} lead seals and resolves native counters`, () => {
      const fixture = ecazOccupyMixedNoFieldFixture({ lead, marker, richeseReserves: reserves });
      const actorView = viewGame(fixture.preplan, fixture.owner).battle!;
      const profile = actorView.ecazOccupy!.profile!;
      assert.equal(profile.forceOwner, fixture.richese);
      assert.equal(profile.payer, fixture.owner);
      assert.equal(profile.fixedEcazDial, 3);
      assert.equal(profile.maxDial, 3 + fixture.ordinary + fixture.materializes);
      assert.equal(actorView.ownForces!.normal, fixture.ordinary + fixture.materializes);
      assert.equal(actorView.mixedNoField, true,
        'The selected Ecaz plan also uses its physical Richese variable owner, not the Ecaz counter pool.');
      const rivalView = viewGame(fixture.preplan, fixture.opponent).battle!;
      assert.equal(rivalView.opponentForces, null);
      assert.equal(rivalView.ecazOccupy!.profile, null,
        'Ordinary presence must not disclose the prospective concealed increment.');
      assert.equal(rivalView.mixedNoField, undefined);
      const first = applyAction(fixture.preplan, fixture.owner, fixture.plans.plain);
      assertFirstSeal(fixture, first);
      const revealed = applyAction(first, fixture.opponent, fixture.plans.opponent);
      assertReveal(fixture, revealed);
      const { game: done } = finishEcazOccupyMixedNoField(fixture, revealed);
      assert.equal(done.lastBattleContext!.result, 'normal');
      assert.equal(done.lastBattleContext!.winner, fixture.owner);
      const richese = occupyRicheseSeat(done, fixture.richese);
      assert.equal(richese.forces[fixture.location] ?? 0, fixture.ordinary + fixture.materializes - fixture.variableDial);
      assert.equal(richese.tanks - occupyRicheseSeat(fixture.preplan, fixture.richese).tanks, fixture.variableDial);
      assert.equal(richese.reserves, reserves - fixture.materializes);
      assert.equal(occupyRicheseSeat(done, fixture.ecaz).forces[fixture.location], 2);
      assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(fixture.preplan, fixture.ecaz).tanks, 3);
      assert.equal(occupyRicheseSeat(done, fixture.opponent).tanks - occupyRicheseSeat(fixture.preplan, fixture.opponent).tanks, 8);
      for (const actor of [fixture.ecaz, fixture.richese])
        assert.equal(occupyRicheseSeat(done, actor).spice,
          occupyRicheseSeat(fixture.preplan, actor).spice - (actor === fixture.owner ? fixture.support : 0) +
          ((occupyRicheseSeat(done, actor).forces[fixture.location] ?? 0) > 0 ? 2 : 0));
      assertUtilities(done, []);
      assertHistory(fixture, revealed, done);
    });

void test('Mixed capped ally uses actual unsupported physical losses, while the original Ecaz fixed commitment stays free', () => {
  const fixture = ecazOccupyMixedNoFieldFixture({ lead: 'ecaz', marker: 5, richeseReserves: 2,
    variableDial: 2, support: 0 });
  const revealed = sealEcazOccupyMixedNoField(fixture);
  assertReveal(fixture, revealed);
  const { game: done } = finishEcazOccupyMixedNoField(fixture, revealed);
  assert.equal(done.lastBattleContext!.winner, fixture.ecaz);
  assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(fixture.preplan, fixture.richese).tanks, 4,
    'Two unsupported strength consumes all four real ordinary-plus-revealed counters.');
  assert.equal(occupyRicheseSeat(done, fixture.richese).forces[fixture.location] ?? 0, 0);
  assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(fixture.preplan, fixture.ecaz).tanks, 3);
  assert.equal(occupyRicheseSeat(done, fixture.ecaz).spice,
    occupyRicheseSeat(fixture.preplan, fixture.ecaz).spice + 2);
  assertHistory(fixture, revealed, done);
});

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Mixed positive marker with ${lead}-held H/R returns only that card user's actual undialed army`, () => {
    const fixture = ecazOccupyMixedNoFieldFixture({ lead });
    const before = fixture.preplan;
    const offer = viewGame(before, fixture.owner).battle!;
    assert.equal(offer.harassWithdraw!.blocked, null);
    assert.equal(offer.reinforcements!.blocked, null);
    assert.equal(offer.reinforcements!.normal, 3);
    if (lead === 'ally') {
      assert.equal(offer.harassWithdraw!.forces.normal, fixture.ordinary + fixture.materializes);
      assert.equal(offer.harassWithdraw!.locations[fixture.location].normal, fixture.ordinary + fixture.materializes);
      assert.equal(offer.reinforcements!.noField!.reservesAfterReveal, 3);
    } else assert.equal(offer.reinforcements!.noField, undefined);
    const first = applyAction(before, fixture.owner, fixture.plans.both);
    assertFirstSeal(fixture, first);
    const revealed = applyAction(first, fixture.opponent, fixture.plans.opponent);
    assertReveal(fixture, revealed);
    const { game: done } = finishEcazOccupyMixedNoField(fixture, revealed);
    assert.equal(done.lastBattleContext!.result, 'normal');
    assert.equal(done.lastBattleContext!.winner, fixture.owner);
    const ecaz = occupyRicheseSeat(done, fixture.ecaz);
    const richese = occupyRicheseSeat(done, fixture.richese);
    const returned = lead === 'ecaz' ? 2 : fixture.ordinary + fixture.materializes - fixture.variableDial;
    assert.ok(returned > 0);
    assert.equal(occupyRicheseSeat(done, fixture.owner).reserves,
      occupyRicheseSeat(before, fixture.owner).reserves - (lead === 'ally' ? fixture.materializes : 0) - 3 + returned,
      'Three original reserves are spent before, and cannot be funded by, the future H return.');
    assert.equal(ecaz.tanks - occupyRicheseSeat(before, fixture.ecaz).tanks, 3 + (lead === 'ecaz' ? 3 : 0),
      'Returning Ecaz undialed counters never reduces or recalculates ceil(original five / two).');
    assert.equal(richese.tanks - occupyRicheseSeat(before, fixture.richese).tanks,
      fixture.variableDial + (lead === 'ally' ? 3 : 0));
    assert.equal(ecaz.forces[fixture.location] ?? 0, lead === 'ecaz' ? 0 : 2);
    assert.equal(richese.forces[fixture.location] ?? 0, lead === 'ally' ? 0 : fixture.ordinary + fixture.materializes - fixture.variableDial);
    const other = lead === 'ecaz' ? fixture.richese : fixture.ecaz;
    assert.equal(occupyRicheseSeat(done, other).reserves,
      occupyRicheseSeat(before, other).reserves - (other === fixture.richese ? fixture.materializes : 0));
    assert.equal(occupyRicheseSeat(done, fixture.owner).spice,
      occupyRicheseSeat(before, fixture.owner).spice - fixture.support);
    assertUtilities(done, [NO_FIELD_HARASS, NO_FIELD_REINFORCEMENTS]);
    assertHistory(fixture, revealed, done);
  });

void test('Mixed Richese Reinforcements alone spends post-reveal reserves without returning undialed board counters', () => {
  const fixture = ecazOccupyMixedNoFieldFixture();
  const revealed = sealEcazOccupyMixedNoField(fixture, 'reinforcements');
  assertReveal(fixture, revealed);
  const { game: done } = finishEcazOccupyMixedNoField(fixture, revealed);
  assert.equal(done.lastBattleContext!.winner, fixture.richese);
  assert.equal(occupyRicheseSeat(done, fixture.richese).reserves, 0);
  assert.equal(occupyRicheseSeat(done, fixture.richese).forces[fixture.location], 2);
  assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(fixture.preplan, fixture.richese).tanks, 6);
  assertUtilities(done, [NO_FIELD_REINFORCEMENTS]);
  assertHistory(fixture, revealed, done);
});

void test('Mixed Richese unfunded FIRST R and H/R plans reject immutably; a real H-only fallback remains legal', () => {
  const fixture = ecazOccupyMixedNoFieldFixture({ marker: 5, richeseReserves: 7 });
  const before = fixture.preplan;
  const saved = structuredClone(before);
  const offer = viewGame(before, fixture.owner).battle!;
  assert.equal(offer.reinforcements!.normal, 2);
  assert.equal(offer.reinforcements!.noField!.reservesAfterReveal, 2);
  assert.ok(offer.reinforcements!.blocked);
  assert.equal(offer.harassWithdraw!.blocked, null);
  for (const plan of [fixture.plans.reinforcements, fixture.plans.both]) {
    assert.throws(() => applyAction(before, fixture.owner, plan), RuleError);
    assert.deepEqual(before, saved, 'No first seal, card custody, reserve debit or marker reveal survives rejection.');
    assert.equal(before.battle!.plans[fixture.owner], undefined);
  }
  const first = applyAction(before, fixture.owner, fixture.plans.harass);
  assertFirstSeal(fixture, first);
  const revealed = applyAction(first, fixture.opponent, fixture.plans.opponent);
  assertReveal(fixture, revealed);
  const { game: done } = finishEcazOccupyMixedNoField(fixture, revealed);
  assert.equal(done.lastBattleContext!.winner, fixture.richese);
  assert.equal(occupyRicheseSeat(done, fixture.richese).reserves, 7 + fixture.ordinary - fixture.variableDial);
  assert.equal(occupyRicheseSeat(done, fixture.richese).forces[fixture.location] ?? 0, 0);
  assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(before, fixture.richese).tanks, fixture.variableDial);
  assert.equal(occupyRicheseSeat(done, fixture.ecaz).forces[fixture.location], 2);
  assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(before, fixture.ecaz).tanks, 3);
  assertUtilities(done, [NO_FIELD_HARASS]);
  assertHistory(fixture, revealed, done);
});

void test('Ecaz-held mixed H/R cannot spend its ally reserves or its own future Harass return', () => {
  const fixture = ecazOccupyMixedNoFieldFixture({ lead: 'ecaz', richeseReserves: 8, ecazReserves: 2 });
  const before = fixture.preplan;
  const saved = structuredClone(before);
  const offer = viewGame(before, fixture.ecaz).battle!.reinforcements!;
  assert.equal(offer.normal, 2);
  assert.equal(offer.noField, undefined);
  assert.ok(offer.blocked);
  assert.throws(() => applyAction(before, fixture.ecaz, fixture.plans.both), RuleError);
  assert.deepEqual(before, saved);
  const revealed = sealEcazOccupyMixedNoField(fixture, 'harass');
  assertReveal(fixture, revealed);
  const { game: done } = finishEcazOccupyMixedNoField(fixture, revealed);
  assert.equal(done.lastBattleContext!.winner, fixture.ecaz);
  assert.equal(occupyRicheseSeat(done, fixture.ecaz).reserves, 4);
  assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(before, fixture.ecaz).tanks, 3);
  assert.equal(occupyRicheseSeat(done, fixture.richese).reserves, 5);
  assertUtilities(done, [NO_FIELD_HARASS]);
  assertHistory(fixture, revealed, done);
});

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Real opposing Traitor cancels ${lead}-held mixed Harass, but preserves native reveal and the original R cost`, () => {
    const fixture = ecazOccupyMixedNoFieldFixture({ lead, opposingTraitor: true });
    const before = fixture.preplan;
    const leader = fixture.plans.both.leader;
    assert.ok(typeof leader === 'string');
    assert.ok(occupyRicheseSeat(before, fixture.opponent).traitors.includes(leader));
    const revealed = sealEcazOccupyMixedNoField(fixture, 'both');
    assertReveal(fixture, revealed);
    const { game: done } = finishEcazOccupyMixedNoField(fixture, revealed);
    assert.equal(done.lastBattleContext!.result, 'traitor');
    assert.equal(done.lastBattleContext!.winner, fixture.opponent);
    assert.equal(occupyRicheseSeat(done, fixture.owner).leaders.find(face => face.id === leader)!.dead, true);
    for (const actor of [fixture.ecaz, fixture.richese]) {
      const original = occupyRicheseSeat(before, actor);
      const player = occupyRicheseSeat(done, actor);
      const materialized = actor === fixture.richese ? fixture.materializes : 0;
      const reserveCost = actor === fixture.owner ? 3 : 0;
      const destroyed = actor === fixture.ecaz ? 5 : fixture.ordinary + materialized;
      assert.equal(player.forces[fixture.location] ?? 0, 0);
      assert.equal(player.reserves, original.reserves - materialized - reserveCost,
        'An opposing real Traitor prevents every promised H return, including ordinary counters.');
      assert.equal(player.tanks - original.tanks, destroyed + reserveCost);
    }
    assertUtilities(done, [NO_FIELD_HARASS, NO_FIELD_REINFORCEMENTS]);
    assertHistory(fixture, revealed, done);
  });
