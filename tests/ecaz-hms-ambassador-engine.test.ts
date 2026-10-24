import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { GRAPH, MOBILE_LOCATION, MOBILE_STRONGHOLD, splitLocation, territory } from '../game/board';
import {
  actEcazHmsAmbassador as act, advanceEcazHmsAmbassador as advance,
  createEcazHmsAmbassadorFixture, ecazHmsAmbassadorClean as clean,
  ecazHmsAmbassadorInventory as inventory, ecazHmsAmbassadorPlayer as player,
  enterEcazHmsAmbassador, passEcazHmsAmbassadorResponses as passResponses, placeEcazHmsAmbassador,
  type EcazHmsAmbassadorStep,
} from './fixture-ecaz-hms-ambassador';

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode}: native public HMS setup permits paid end-Revival Ambassador placement`, () => {
    const fixture = createEcazHmsAmbassadorFixture({ advanced });
    const before = fixture.game, actions: EcazHmsAmbassadorStep[] = [];
    assert.equal(fixture.setup.status, 'setup');
    assert.deepEqual(fixture.setup.players.map(player => player.faction), ['ecaz', 'ixians', 'guild']);
    assert.equal(fixture.privateChoice.before.decision?.kind, 'ixSetup');
    assert.equal(fixture.hmsPlacement.before.decision?.kind, 'mobileStronghold');
    assert.equal(fixture.hmsPlacement.before.stormResolution, null);
    assert.equal(fixture.hmsPlacement.after.mobileStronghold?.location, fixture.point);
    assert.equal(before.phase, 4); assert.equal(before.turn, 1);
    assert.equal(before.decision?.kind, 'ecazPlacement');
    assert.equal(player(before, fixture.ix).forces[MOBILE_LOCATION], 6);
    assert.equal(player(before, fixture.ix).elites?.forces[MOBILE_LOCATION], 3);
    assert.ok(viewGame(before, fixture.ecaz).ambassadors!.destinations.some(destination =>
      destination.id === MOBILE_STRONGHOLD && destination.sheltered));
    const game = placeEcazHmsAmbassador(fixture, actions);
    assert.equal(player(game, fixture.ecaz).spice, player(before, fixture.ecaz).spice - 1);
    assert.deepEqual(game.ecazAmbassadors!.placement, { turn: 1, count: 1, blocked: false });
    assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)?.location, MOBILE_STRONGHOLD);
    assert.equal(game.mobileStronghold?.location, fixture.point);
    assert.deepEqual(inventory(game), fixture.originalInventory);
    const snapshot = structuredClone(game);
    assert.throws(() => act(game, fixture.ecaz, fixture.placement));
    assert.deepEqual(game, snapshot, 'Replaying the placement cannot charge or move a token again');
    assert.ok(!viewGame(game, fixture.ecaz).ambassadors!.destinations.some(destination => destination.id === MOBILE_STRONGHOLD));
  });

  void test(`${mode}: a legitimately storm-pointed HMS shelters a placed Ambassador`, () => {
    const fixture = createEcazHmsAmbassadorFixture({ advanced, inStorm: true });
    assert.equal(splitLocation(fixture.point).sector, fixture.game.storm);
    const game = placeEcazHmsAmbassador(fixture);
    assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)?.location, MOBILE_STRONGHOLD);
    assert.equal(player(game, fixture.ix).forces[MOBILE_LOCATION], 6);
    assert.equal(player(game, fixture.ix).elites?.forces[MOBILE_LOCATION], 3);
    assert.equal(player(game, fixture.ecaz).spice, player(fixture.game, fixture.ecaz).spice - 1);
  });

  void test(`${mode}: actual paid Guild entry may decline or trigger the HMS Emperor Ambassador once`, () => {
    const fixture = createEcazHmsAmbassadorFixture({ advanced });
    const placed = placeEcazHmsAmbassador(fixture);
    const continuation: EcazHmsAmbassadorStep[] = [];
    const arrival = enterEcazHmsAmbassador(placed, fixture, continuation), before = arrival.game;
    assert.equal(player(arrival.shipment.after, fixture.guild).spice,
      player(arrival.shipment.before, fixture.guild).spice - 1);
    assert.equal(player(arrival.shipment.after, fixture.guild).shipped, true);
    assert.equal(player(before, fixture.guild).moved, 1);
    assert.equal(before.active, fixture.guild);
    assert.equal(before.pendingAmbassador?.token, fixture.token);
    assert.equal(viewGame(before, fixture.ecaz).decision?.kind, 'ecazAmbassador');
    assert.equal(viewGame(before, fixture.guild).decision?.player, fixture.ecaz);
    const originalArmy = structuredClone(player(before, fixture.guild));
    for (const trigger of [false, true]) {
      let game = act(before, fixture.ecaz, trigger
        ? { type: 'decision', event: arrival.event, trigger: true, beneficiary: fixture.ecaz }
        : { type: 'decision', event: arrival.event, decline: true });
      game = advance(game, clean);
      assert.equal(game.pendingAmbassador, null);
      assert.equal(player(game, fixture.ecaz).spice, player(before, fixture.ecaz).spice + (trigger ? 5 : 0));
      const marker = game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)!;
      assert.equal(marker.zone, trigger ? 'used' : 'placed');
      assert.equal(marker.location, trigger ? null : MOBILE_STRONGHOLD);
      assert.deepEqual(player(game, fixture.guild), originalArmy, 'The original shipment, payment and movement do not replay');
      const snapshot = structuredClone(game);
      assert.throws(() => act(game, fixture.ecaz,
        { type: 'decision', event: arrival.event, trigger: true, beneficiary: fixture.ecaz }));
      assert.deepEqual(game, snapshot);
      game = act(game, fixture.guild, fixture.endMovement);
      assert.ok(!game.movementRemaining?.includes(fixture.guild));
      assert.equal(player(game, fixture.guild).forces[MOBILE_LOCATION], 1);
      assert.deepEqual(inventory(game), fixture.originalInventory);
    }
  });

  void test(`${mode}: an untriggered Ambassador stays on the HMS through its real next-Storm relocation`, () => {
    const fixture = createEcazHmsAmbassadorFixture({ advanced });
    const actions: EcazHmsAmbassadorStep[] = [];
    let game = placeEcazHmsAmbassador(fixture, actions);
    game = act(game, fixture.ecaz, fixture.finishPlacement, actions);
    game = advance(game, state => state.turn === 2 && !state.response && !state.phaseOpening &&
      state.decision?.kind === 'mobileStronghold' && !state.decision.placement, actions);
    assert.equal(game.mobileStronghold?.location, fixture.point);
    const destination = GRAPH[fixture.point].find(key => splitLocation(key).sector !== game.storm &&
      territory(splitLocation(key).territory).type !== 'stronghold');
    assert.ok(destination);
    const before = structuredClone(game), route = [fixture.point, destination];
    game = act(game, fixture.ix, { type: 'decision', route, collect: false }, actions);
    game = passResponses(game, actions);
    assert.equal(game.mobileStronghold?.location, destination);
    assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)?.location, MOBILE_STRONGHOLD);
    assert.ok(!game.ecazAmbassadors!.tokens.some(token => token.location === fixture.point));
    assert.deepEqual(player(game, fixture.ix).forces, player(before, fixture.ix).forces);
    assert.deepEqual(player(game, fixture.ix).elites, player(before, fixture.ix).elites);
    assert.deepEqual(inventory(game), fixture.originalInventory);
  });
}

void test('original held Karama cancels the first HMS placement without paying or moving its token', () => {
  const fixture = createEcazHmsAmbassadorFixture({ karama: true });
  assert.ok(fixture.karama);
  assert.ok(player(fixture.privateChoice.after, fixture.ix).hand.some(card => card.id === fixture.karama));
  const declared = act(fixture.game, fixture.ecaz, fixture.placement);
  assert.equal(declared.response?.kind, 'ecazPlacement');
  assert.deepEqual(declared.pendingEcazPlacement, {
    token: fixture.token, territory: MOBILE_STRONGHOLD, turn: 1, cost: 1,
  });
  assert.equal(player(declared, fixture.ecaz).spice, player(fixture.game, fixture.ecaz).spice);
  let game = act(declared, fixture.ix, { type: 'card', card: fixture.karama, mode: 'cancel' });
  game = advance(game, state => state.phase === 5 && clean(state));
  assert.equal(player(game, fixture.ecaz).spice, player(fixture.game, fixture.ecaz).spice);
  const marker = game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)!;
  assert.equal(marker.zone, 'supply'); assert.equal(marker.location, null);
  assert.deepEqual(game.ecazAmbassadors!.placement, { turn: 1, count: 0, blocked: true });
  assert.equal(game.ecazPlacementTurn, 1);
  assert.ok(game.discard.some(card => card.id === fixture.karama));
  assert.equal(game.mobileStronghold?.location, fixture.point);
  assert.deepEqual(inventory(game), fixture.originalInventory);
});

void test('a real HMS placement response retains the original fee and commits after its actual passes', () => {
  const fixture = createEcazHmsAmbassadorFixture({ karama: true });
  let game = act(fixture.game, fixture.ecaz, fixture.placement);
  const beforeSpice = player(game, fixture.ecaz).spice;
  assert.equal(game.response?.kind, 'ecazPlacement');
  game = act(game, fixture.ecaz, { type: 'passResponse' });
  assert.equal(player(game, fixture.ecaz).spice, beforeSpice);
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)?.zone, 'supply');
  game = passResponses(game);
  assert.equal(player(game, fixture.ecaz).spice, beforeSpice - 1);
  assert.equal(game.ecazAmbassadors!.placement?.count, 1);
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)?.location, MOBILE_STRONGHOLD);
});

for (const effect of ['choam', 'ixians'] as const) {
  void test(`actual HMS ${effect} Ambassador discard finishes its own card effect and original entrant`, () => {
    const fixture = createEcazHmsAmbassadorFixture({ effect });
    const arrival = enterEcazHmsAmbassador(placeEcazHmsAmbassador(fixture), fixture);
    let game = act(arrival.game, fixture.ecaz, {
      type: 'decision', event: arrival.event, trigger: true, beneficiary: fixture.ecaz,
    });
    assert.equal(game.pendingAmbassador?.stage, 'cards');
    assert.equal(game.pendingAmbassador.effect, effect);
    const before = structuredClone(game), card = player(game, fixture.ecaz).hand[0]; assert.ok(card);
    game = act(game, fixture.ecaz, { type: 'decision', event: arrival.event, cards: [card.id] });
    game = advance(game, clean);
    assert.equal(game.pendingAmbassador, null);
    assert.ok(game.discard.some(discarded => discarded.id === card.id));
    assert.equal(player(game, fixture.ecaz).spice,
      player(before, fixture.ecaz).spice + (effect === 'choam' ? 3 : 0));
    assert.equal(player(game, fixture.ecaz).hand.length,
      player(before, fixture.ecaz).hand.length - (effect === 'choam' ? 1 : 0));
    assert.equal(game.deck.length, before.deck.length - (effect === 'ixians' ? 1 : 0));
    assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)?.zone, 'used');
    assert.deepEqual(player(game, fixture.guild), player(before, fixture.guild));
    assert.deepEqual(inventory(game), fixture.originalInventory);
    game = act(game, fixture.guild, fixture.endMovement);
    assert.ok(!game.movementRemaining?.includes(fixture.guild));
    assert.equal(player(game, fixture.guild).forces[MOBILE_LOCATION], 1);
  });
}
