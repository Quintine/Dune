import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  createHarassNoFieldFixture, finishHarassNoFieldBattle, harassNoFieldPlayer,
  revealHarassNoFieldBattle, sealHarassNoFieldPlan, type HarassNoFieldFixture,
} from './fixture-harass-no-field';

function assertCustody(fixture: HarassNoFieldFixture, game: Game) {
  const cards = (state: Game) => [
    ...state.deck, ...state.discard, ...(state.richeseCache ?? []), ...(state.richeseRemoved ?? []),
    ...state.players.flatMap(p => p.hand),
  ].map(c => c.id).sort();
  assert.deepEqual(cards(game), cards(fixture.afterSetup));
  const traitors = (state: Game) => [
    ...(state.traitorReserve ?? []), ...state.players.flatMap(p => p.traitors),
  ].sort();
  assert.deepEqual(traitors(game), traitors(fixture.afterSetup));
  for (const player of game.players) {
    const counters = [player.reserves, player.tanks, ...Object.values(player.forces)];
    assert.equal(counters.reduce((sum, n) => sum + n, 0), 20);
    assert.ok(counters.every(n => Number.isSafeInteger(n) && n >= 0));
  }
}
function assertOriginalMarkerHistory(fixture: HarassNoFieldFixture, revealed: Game, done: Game) {
  const shipped = harassNoFieldPlayer(fixture.afterShipment, fixture.owner);
  const exposed = harassNoFieldPlayer(revealed, fixture.owner);
  const finished = harassNoFieldPlayer(done, fixture.owner);
  assert.equal(shipped.noField!.deployed!.tokenId, fixture.token.id);
  assert.equal(exposed.noField!.deployed, null);
  assert.equal(finished.noField!.deployed, null);
  assert.deepEqual(exposed.noField!.tokens, shipped.noField!.tokens);
  assert.deepEqual(finished.noField!.tokens, shipped.noField!.tokens);
  assert.equal(exposed.noField!.lastShipped, fixture.token.id);
  assert.equal(finished.noField!.lastShipped, fixture.token.id);
  assert.notEqual(exposed.noFieldEvent, shipped.noFieldEvent);
  // Declaration, withdrawal, losses and cleanup cannot perform a second native reveal.
  assert.equal(finished.noFieldEvent, exposed.noFieldEvent);
  for (const actor of [fixture.owner, fixture.opponent, fixture.observer]) {
    const before = viewGame(fixture.game, actor).players.find(p => p.id === fixture.owner)!.noField!;
    const after = viewGame(done, actor).players.find(p => p.id === fixture.owner)!.noField!;
    assert.ok(before.deployed);
    assert.equal(before.lastUsed, null);
    assert.equal(after.deployed, null);
    assert.equal(after.lastUsed, fixture.token.value);
  }
  assert.equal(done.discard.filter(c => c.id === 'ecaz-harass-withdraw').length, 1);
  assert.equal(done.players.flatMap(p => p.hand).filter(c => c.id === 'ecaz-harass-withdraw').length, 0);
  assertCustody(fixture, done);
}

for (const advanced of [false, true]) {
  for (const slot of ['weapon', 'defense'] as const) {
    for (const marker of [3, 5] as const) {
      void test(`${advanced ? 'Advanced' : 'Basic'} ${marker} No-Field: Harass in ${slot} privately forecasts the native pool and returns only undialed counters`, () => {
        const fixture = createHarassNoFieldFixture({ advanced, marker, slot });
        const original = harassNoFieldPlayer(fixture.game, fixture.owner);
        const offer = viewGame(fixture.game, fixture.owner).battle!.harassWithdraw!;
        assert.equal(offer.blocked, null);
        assert.equal(offer.forces.normal, marker);
        assert.equal(offer.locations[fixture.location].normal, marker);
        assert.equal(offer.noField!.materializes, marker);
        assert.equal(offer.noField!.reservesAfterReveal, original.reserves - marker);
        const sealed = sealHarassNoFieldPlan(fixture.game, fixture.planActions[0]);
        assert.equal(sealed.battle!.revealed, false);
        assert.equal(sealed.battle!.harassAllocation, undefined);
        const hidden = harassNoFieldPlayer(sealed, fixture.owner);
        assert.deepEqual(hidden.noField, original.noField);
        assert.equal(hidden.noFieldEvent, original.noFieldEvent);
        assert.equal(hidden.reserves, original.reserves);
        assert.equal(hidden.forces[fixture.location] ?? 0, 0);
        assert.equal(viewGame(sealed, fixture.opponent).battle!.plans[fixture.owner], undefined);
        const revealed = sealHarassNoFieldPlan(sealed, fixture.planActions[1]);
        assert.equal(revealed.battle!.revealed, true);
        const exposed = harassNoFieldPlayer(revealed, fixture.owner);
        assert.equal(exposed.forces[fixture.location], offer.locations[fixture.location].normal);
        assert.equal(exposed.reserves, offer.noField!.reservesAfterReveal);
        const done = finishHarassNoFieldBattle(revealed);
        const owner = harassNoFieldPlayer(done, fixture.owner);
        assert.equal(done.lastBattleContext?.winner, fixture.opponent);
        assert.equal(owner.reserves, original.reserves - 2);
        assert.equal(owner.tanks, 2);
        assert.equal(owner.forces[fixture.location] ?? 0, 0);
        // Original paid support is charged once, not refunded with undialed counters.
        assert.equal(owner.spice, original.spice - (advanced ? 2 : 0));
        assertOriginalMarkerHistory(fixture, revealed, done);
      });
    }
    void test(`${advanced ? 'Advanced' : 'Basic'} zero marker permits leader plus ${slot} Harass and is exposed/disposed only once`, () => {
      const fixture = createHarassNoFieldFixture({ advanced, marker: 0, slot });
      const original = harassNoFieldPlayer(fixture.game, fixture.owner);
      const offer = viewGame(fixture.game, fixture.owner).battle!.harassWithdraw!;
      assert.equal(offer.blocked, null);
      assert.equal(offer.forces.normal, 0);
      assert.equal(offer.noField!.materializes, 0);
      const first = sealHarassNoFieldPlan(fixture.game, fixture.planActions[0]);
      assert.ok(harassNoFieldPlayer(first, fixture.owner).noField!.deployed);
      assert.equal(first.battle!.plans[fixture.owner].leader, fixture.planActions[0].action.leader);
      const revealed = sealHarassNoFieldPlan(first, fixture.planActions[1]);
      assert.equal(harassNoFieldPlayer(revealed, fixture.owner).reserves, original.reserves);
      assert.equal(harassNoFieldPlayer(revealed, fixture.owner).forces[fixture.location] ?? 0, 0);
      const done = finishHarassNoFieldBattle(revealed);
      const owner = harassNoFieldPlayer(done, fixture.owner);
      assert.equal(owner.reserves, 20);
      assert.equal(owner.tanks, 0);
      assert.equal(owner.leaders.find(l => l.id === fixture.planActions[0].action.leader)!.dead, false);
      assertOriginalMarkerHistory(fixture, revealed, done);
    });
  }
  void test(`${advanced ? 'Advanced' : 'Basic'} scarce reserves cap a five marker before Harass, conserving all twenty physical counters`, () => {
    const fixture = createHarassNoFieldFixture({ advanced, marker: 5, reserves: 2, dial: 1 });
    const offer = viewGame(fixture.game, fixture.owner).battle!.harassWithdraw!;
    assert.equal(offer.blocked, null);
    assert.equal(offer.forces.normal, 2);
    assert.equal(offer.locations[fixture.location].normal, 2);
    assert.equal(offer.noField!.materializes, 2);
    assert.equal(offer.noField!.reservesAfterReveal, 0);
    const revealed = revealHarassNoFieldBattle(fixture);
    assert.equal(harassNoFieldPlayer(revealed, fixture.owner).reserves, 0);
    assert.equal(harassNoFieldPlayer(revealed, fixture.owner).forces[fixture.location], 2);
    assertCustody(fixture, revealed);
    const done = finishHarassNoFieldBattle(revealed);
    const owner = harassNoFieldPlayer(done, fixture.owner);
    assert.equal(owner.reserves, 1);
    assert.equal(owner.tanks, 1);
    assert.equal(owner.forces['polar_sink:0'], 18);
    assertOriginalMarkerHistory(fixture, revealed, done);
  });
  void test(`${advanced ? 'Advanced' : 'Basic'} mixed ordinary/marker sectors choose actual undialed locations only after reveal`, () => {
    const fixture = createHarassNoFieldFixture({ advanced, marker: 3, ordinaryAtMarker: 1, ordinaryOtherSector: 2 });
    const original = harassNoFieldPlayer(fixture.game, fixture.owner);
    const offer = viewGame(fixture.game, fixture.owner).battle!.harassWithdraw!;
    assert.equal(offer.blocked, null);
    assert.equal(offer.forces.normal, 6);
    assert.equal(offer.locations[fixture.location].normal, 4);
    assert.equal(offer.locations[fixture.otherLocation].normal, 2);
    // Opponent can seal first too; no marker counters or return choice exist yet.
    const first = sealHarassNoFieldPlan(fixture.game, fixture.planActions[1]);
    assert.ok(harassNoFieldPlayer(first, fixture.owner).noField!.deployed);
    assert.equal(first.battle!.harassAllocation, undefined);
    const revealed = sealHarassNoFieldPlan(first, fixture.planActions[0]);
    assert.equal(revealed.decision!.kind, 'harassWithdraw');
    assert.equal(revealed.decision!.player, fixture.owner);
    const physical = harassNoFieldPlayer(revealed, fixture.owner);
    assert.equal(physical.forces[fixture.location], 4);
    assert.equal(physical.forces[fixture.otherLocation], 2);
    assert.equal(physical.reserves, original.reserves - 3);
    const returns = {
      [fixture.location]: { normal: 2, elite: 0 },
      [fixture.otherLocation]: { normal: 2, elite: 0 },
    };
    // A physically existing pool still cannot return the two dialed counters.
    const snapshot = JSON.stringify(revealed);
    assert.throws(() => applyAction(revealed, fixture.owner, { type: 'decision', event: revealed.battle!.harassAllocation!.event,
      returns: { [fixture.location]: { normal: 4, elite: 0 }, [fixture.otherLocation]: { normal: 2, elite: 0 } } }));
    assert.equal(JSON.stringify(revealed), snapshot);
    const chosen = applyAction(revealed, fixture.owner, { type: 'decision', event: revealed.battle!.harassAllocation!.event, returns });
    assert.equal(chosen.decision, null);
    assert.deepEqual(harassNoFieldPlayer(chosen, fixture.owner).forces, physical.forces);
    assert.equal(harassNoFieldPlayer(chosen, fixture.owner).reserves, physical.reserves);
    assert.deepEqual(viewGame(chosen, fixture.opponent).battle!.harassAllocation!.selection, returns);
    const done = finishHarassNoFieldBattle(chosen);
    const owner = harassNoFieldPlayer(done, fixture.owner);
    assert.equal(owner.reserves, 18);
    assert.equal(owner.tanks, 2);
    assert.equal(owner.forces[fixture.location] ?? 0, 0);
    assert.equal(owner.forces[fixture.otherLocation] ?? 0, 0);
    assert.equal(owner.spice, original.spice - (advanced ? 2 : 0));
    assertOriginalMarkerHistory(fixture, revealed, done);
  });
}

for (const traitor of ['owner', 'opponent', 'both'] as const) {
  void test(`${traitor} successful Traitor: native reveal remains original and only an opposing call cancels Harass`, () => {
    const fixture = createHarassNoFieldFixture({ advanced: true, marker: 5, traitor,
      ordinaryAtMarker: 1, ordinaryOtherSector: 1 });
    const revealed = revealHarassNoFieldBattle(fixture);
    const original = harassNoFieldPlayer(fixture.game, fixture.owner);
    const exposed = harassNoFieldPlayer(revealed, fixture.owner);
    assert.equal(exposed.reserves, original.reserves - 5);
    assert.equal(exposed.forces[fixture.location], 6);
    assert.equal(exposed.forces[fixture.otherLocation], 1);
    const callers = traitor === 'both' ? [fixture.owner, fixture.opponent]
      : [traitor === 'owner' ? fixture.owner : fixture.opponent];
    const done = finishHarassNoFieldBattle(revealed, { callers, returns: {
      [fixture.location]: { normal: 4, elite: 0 },
      [fixture.otherLocation]: { normal: 1, elite: 0 },
    } });
    const owner = harassNoFieldPlayer(done, fixture.owner);
    if (traitor === 'owner') {
      assert.equal(done.lastBattleContext?.winner, fixture.owner);
      assert.equal(owner.reserves, exposed.reserves + 5);
      assert.equal(owner.tanks, 0);
      assert.equal(owner.forces[fixture.location], 2);
      assert.equal(owner.forces[fixture.otherLocation] ?? 0, 0);
    } else {
      assert.equal(owner.reserves, exposed.reserves);
      assert.equal(owner.tanks, 7);
      assert.equal(owner.forces[fixture.location] ?? 0, 0);
      assert.equal(owner.forces[fixture.otherLocation] ?? 0, 0);
    }
    assertOriginalMarkerHistory(fixture, revealed, done);
  });
}
