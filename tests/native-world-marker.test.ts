import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, RuleError, viewGame, type Game } from '../game/engine';
import {
  createNativeWorldMarkerFixture, nativeWorldMarkerInventory, nativeWorldMarkerPlan,
  type NativeWorldMarkerFixture,
} from './fixture-native-world-marker';
import {
  finishRicheseReinforcementsBattle, prepareRicheseReinforcementsPlan,
  RICHESE_HARASS, RICHESE_REINFORCEMENTS, richeseReinforcementsPlayer,
  sealRicheseReinforcementsPlan,
} from './fixture-richese-reinforcements';

function physicalCards(game: Game) {
  return [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
}

function primaryPool(game: Game, fixture: NativeWorldMarkerFixture) {
  const home = viewGame(game, fixture.richese).homeworlds?.worlds
    ?.find(world => world.id === fixture.source.homeworld);
  assert.ok(home);
  return home.forces[fixture.richese];
}

function assertConserved(fixture: NativeWorldMarkerFixture, game: Game) {
  assert.deepEqual(physicalCards(game), physicalCards(fixture.initial),
    'Every original selected-deck/cache face retains one physical identity.');
  for (const player of game.players) {
    const before = nativeWorldMarkerInventory(fixture.afterSetup, player.id);
    const after = nativeWorldMarkerInventory(game, player.id);
    assert.deepEqual([after.total, after.normal, after.elite], [before.total, before.normal, before.elite],
      `${player.faction}'s native reserves count once; special counters remain their own physical type.`);
    assert.equal(after.total, 20);
    if (player.faction === 'ixians') assert.equal(after.elite, 7);
    assert.ok(player.hand.length <= (player.faction === 'harkonnen' ? 8 : 4));
  }
  const original = richeseReinforcementsPlayer(fixture.afterSetup, fixture.richese).noField!;
  const current = richeseReinforcementsPlayer(game, fixture.richese).noField!;
  assert.deepEqual(current.tokens, original.tokens, 'No token is minted, replaced or relabeled.');
  assert.equal(current.lastShipped, fixture.token.id, 'Reveal preserves the last real shipment identity.');
}

function assertSpent(game: Game, card: string) {
  assert.equal(game.discard.filter(face => face.id === card).length, 1);
  assert.ok(game.players.every(player => player.hand.every(face => face.id !== card)));
  assert.ok(game.deck.every(face => face.id !== card));
}

/** Preview and the first seal must not perform the eventual native reveal. */
function assertStillConcealed(fixture: NativeWorldMarkerFixture, game: Game) {
  const owner = richeseReinforcementsPlayer(game, fixture.richese);
  const before = richeseReinforcementsPlayer(fixture.game, fixture.richese);
  assert.equal(game.battle!.revealed, false);
  assert.deepEqual(owner.noField, before.noField);
  assert.equal(owner.noFieldEvent, before.noFieldEvent);
  assert.equal(owner.reserves, fixture.source.reservesBeforeReveal);
  assert.deepEqual(primaryPool(game, fixture), { normal: owner.reserves, elite: 0 });
  assert.equal(owner.forces[fixture.location] ?? 0, 0, 'A concealed marker is not a physical counter.');
  assert.equal(owner.tanks, before.tanks);
}

for (const family of ['choam', 'ix+choam'] as const) {
  // Opposite representative slots cover both paths without a Cartesian matrix.
  const slots = [family === 'choam' ? 'weapon' : 'defense'] as const;
  for (const slot of slots)
    void test(`${family} World marker three funds R in the ${slot} slot only after its real primary reserve debit`, () => {
      const fixture = createNativeWorldMarkerFixture({ family, marker: 3, reserves: 6 });
      const original = structuredClone(fixture.game);
      const preview = viewGame(fixture.game, fixture.richese).battle!.reinforcements!;
      assert.deepEqual(fixture.game, original, 'The owner forecast does not materialize forces or update history.');
      assert.equal(preview.blocked, null);
      assert.deepEqual(preview.noField, { materializes: 3, reservesAfterReveal: 3 });
      assertStillConcealed(fixture, fixture.game);

      const first = prepareRicheseReinforcementsPlan(fixture.game, nativeWorldMarkerPlan(fixture, 'reinforcements', slot));
      assertStillConcealed(fixture, first);
      const revealed = sealRicheseReinforcementsPlan(first, fixture.plans.opponent);
      const owner = richeseReinforcementsPlayer(revealed, fixture.richese);
      assert.equal(revealed.battle!.revealed, true);
      assert.deepEqual(primaryPool(revealed, fixture), { normal: 3, elite: 0 });
      assert.equal(owner.reserves, 3, 'Materialization spends the same native primary counters once.');
      assert.equal(owner.forces[fixture.location], 3);
      assert.equal(owner.tanks, 0, 'The provisional fee settles at the actual result, not at first seal.');
      assert.equal(owner.noField!.deployed, null);
      assertConserved(fixture, revealed);

      const done = finishRicheseReinforcementsBattle(revealed);
      const after = richeseReinforcementsPlayer(done, fixture.richese);
      assert.equal(done.lastBattleContext!.result, 'normal');
      assert.equal(done.lastBattleContext!.winner, fixture.opponent);
      assert.deepEqual(primaryPool(done, fixture), { normal: 0, elite: 0 });
      assert.equal(after.reserves, 0);
      assert.equal(after.tanks, 6, 'Three materialized casualties plus the three-reserve fee, not nine counters.');
      assert.equal(after.battleLosses, 6);
      assert.equal(after.forces[fixture.location] ?? 0, 0);
      assertSpent(done, RICHESE_REINFORCEMENTS);
      assertConserved(fixture, done);
    });

  for (const [marker, reserves, materializes] of [[0, 6, 0], [5, 8, 5]] as const)
    void test(`${family} World funded marker ${marker} keeps its physical token and pays from the remaining native reserves`, () => {
      const fixture = createNativeWorldMarkerFixture({ family, marker, reserves });
      const preview = viewGame(fixture.game, fixture.richese).battle!.reinforcements!;
      assert.equal(preview.blocked, null);
      assert.deepEqual(preview.noField, { materializes, reservesAfterReveal: reserves - materializes });
      const first = prepareRicheseReinforcementsPlan(fixture.game, nativeWorldMarkerPlan(fixture));
      assertStillConcealed(fixture, first);
      const revealed = sealRicheseReinforcementsPlan(first, fixture.plans.opponent);
      assert.deepEqual(primaryPool(revealed, fixture), { normal: reserves - materializes, elite: 0 });
      assert.equal(richeseReinforcementsPlayer(revealed, fixture.richese).forces[fixture.location] ?? 0, materializes);
      const done = finishRicheseReinforcementsBattle(revealed);
      const after = richeseReinforcementsPlayer(done, fixture.richese);
      assert.equal(after.reserves, reserves - materializes - 3);
      assert.deepEqual(primaryPool(done, fixture), { normal: after.reserves, elite: 0 });
      assert.equal(after.tanks, materializes + 3);
      assertSpent(done, RICHESE_REINFORCEMENTS);
      assertConserved(fixture, done);
    });

  for (const [marker, reserves, materializes] of [[3, 5, 3], [5, 3, 3]] as const)
    for (const slot of slots)
      void test(`${family} World marker ${marker}/${reserves} refuses short R in ${slot} unchanged, without borrowing a future H return`, () => {
        const fixture = createNativeWorldMarkerFixture({ family, marker, reserves });
        const before = structuredClone(fixture.game);
        const preview = viewGame(fixture.game, fixture.richese).battle!.reinforcements!;
        assert.ok(preview.blocked);
        assert.deepEqual(preview.noField, { materializes, reservesAfterReveal: reserves - materializes });
        assert.equal(preview.normal + preview.elite, reserves - materializes);
        assert.equal(viewGame(fixture.game, fixture.richese).battle!.harassWithdraw!.blocked, null);
        assert.deepEqual(fixture.game, before);
        // This exact original marker-three/reserves-five native position used
        // to accept the raw first seal even though its owner preview refused it.
        const rawR = nativeWorldMarkerPlan(fixture, 'reinforcements', slot);
        delete rawR.action.reinforcementsSources;
        for (const plan of [rawR, nativeWorldMarkerPlan(fixture, 'both', slot)]) {
          assert.throws(() => applyAction(fixture.game, plan.actor, plan.action), RuleError);
          assert.deepEqual(fixture.game, before, 'Rejection changes no wallet, cards, token, history, counters or windows.');
          assert.deepEqual(fixture.game.battle!.plans, {});
        }
        assertStillConcealed(fixture, fixture.game);
        const first = prepareRicheseReinforcementsPlan(fixture.game, nativeWorldMarkerPlan(fixture, 'harass', slot));
        assertStillConcealed(fixture, first);
        const revealed = sealRicheseReinforcementsPlan(first, fixture.plans.opponent);
        assert.deepEqual(primaryPool(revealed, fixture), { normal: reserves - materializes, elite: 0 });
        assert.equal(richeseReinforcementsPlayer(revealed, fixture.richese).forces[fixture.location], materializes,
          'A five marker capped at three reserves reveals three, not five.');
        const done = finishRicheseReinforcementsBattle(revealed);
        const after = richeseReinforcementsPlayer(done, fixture.richese);
        assert.equal(after.reserves, reserves - materializes + 1);
        assert.deepEqual(primaryPool(done, fixture), { normal: after.reserves, elite: 0 },
          'The real undialed counter deposits in the native primary World, not a foreign visitor pool.');
        assert.equal(after.tanks, 2, 'Only the dialed counters die under H-only fallback.');
        assertSpent(done, RICHESE_HARASS);
        assert.ok(after.hand.some(card => card.id === RICHESE_REINFORCEMENTS), 'The rejected R remains unspent.');
        assertConserved(fixture, done);
      });

  for (const slot of slots)
    void test(`${family} World R+H in ${slot} charges native reserves before depositing the real undialed survivor`, () => {
      const fixture = createNativeWorldMarkerFixture({ family, marker: 3, reserves: 6 });
      const first = prepareRicheseReinforcementsPlan(fixture.game, nativeWorldMarkerPlan(fixture, 'both', slot));
      assertStillConcealed(fixture, first);
      const revealed = sealRicheseReinforcementsPlan(first, fixture.plans.opponent);
      assert.deepEqual(primaryPool(revealed, fixture), { normal: 3, elite: 0 });
      const done = finishRicheseReinforcementsBattle(revealed);
      const after = richeseReinforcementsPlayer(done, fixture.richese);
      assert.deepEqual(primaryPool(done, fixture), { normal: 1, elite: 0 });
      assert.equal(after.reserves, 1, 'Three pay first; the one real undialed survivor returns afterwards.');
      assert.equal(after.tanks, 5);
      assert.equal(after.battleLosses, 5);
      assertSpent(done, RICHESE_REINFORCEMENTS);
      assertSpent(done, RICHESE_HARASS);
      assertConserved(fixture, done);
    });

  for (const marker of [0, 3, 5] as const)
    for (const slot of slots)
      void test(`${family} Advanced World marker ${marker} pays R from its funded turn-one primary World in ${slot}`, () => {
        const fixture = createNativeWorldMarkerFixture({ family, advanced: true, marker });
        const before = richeseReinforcementsPlayer(fixture.game, fixture.richese);
        const preview = viewGame(fixture.game, fixture.richese).battle!.reinforcements!;
        assert.equal(preview.blocked, null);
        assert.deepEqual(preview.noField, { materializes: marker, reservesAfterReveal: 20 - marker });
        const first = prepareRicheseReinforcementsPlan(fixture.game, nativeWorldMarkerPlan(fixture, 'reinforcements', slot));
        assertStillConcealed(fixture, first);
        const revealed = sealRicheseReinforcementsPlan(first, fixture.plans.opponent);
        assert.equal(richeseReinforcementsPlayer(revealed, fixture.richese).forces[fixture.location] ?? 0, marker);
        assert.deepEqual(primaryPool(revealed, fixture), { normal: 20 - marker, elite: 0 });
        const done = finishRicheseReinforcementsBattle(revealed);
        const after = richeseReinforcementsPlayer(done, fixture.richese);
        assert.equal(after.reserves, 17 - marker);
        assert.deepEqual(primaryPool(done, fixture), { normal: 17 - marker, elite: 0 });
        assert.equal(after.tanks, marker + 3);
        assert.equal(after.spice, before.spice - Number(fixture.plans.reinforcements.action.support),
          'The original physical Advanced support is still paid, not increased by two score strength.');
        assertSpent(done, RICHESE_REINFORCEMENTS);
        assertConserved(fixture, done);
      });

  void test(`${family} Advanced World marker five settles R then deposits four H survivors with original support`, () => {
    const fixture = createNativeWorldMarkerFixture({ family, advanced: true, marker: 5 });
    const before = richeseReinforcementsPlayer(fixture.game, fixture.richese);
    const first = prepareRicheseReinforcementsPlan(fixture.game, nativeWorldMarkerPlan(fixture, 'both'));
    const revealed = sealRicheseReinforcementsPlan(first, fixture.plans.opponent);
    assert.deepEqual(primaryPool(revealed, fixture), { normal: 15, elite: 0 });
    const done = finishRicheseReinforcementsBattle(revealed);
    const after = richeseReinforcementsPlayer(done, fixture.richese);
    assert.equal(after.reserves, 16, 'Fifteen minus the fee plus four actual undialed survivors.');
    assert.deepEqual(primaryPool(done, fixture), { normal: 16, elite: 0 });
    assert.equal(after.tanks, 4);
    assert.equal(after.spice, before.spice - 1);
    assertSpent(done, RICHESE_REINFORCEMENTS);
    assertSpent(done, RICHESE_HARASS);
    assertConserved(fixture, done);
  });

}
