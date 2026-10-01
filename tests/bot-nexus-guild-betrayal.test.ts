import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createGuildBetrayalFixture } from './fixture-nexus-guild-betrayal';

void test('all four legal bot profiles replace the original payment for every supported shipment adapter', () => {
  for (const profile of DIFFICULTIES) {
    const scenarios = [
      { source: 'reserve' },
      { source: 'guildTransport' },
      { source: 'homeworld' },
      { source: 'junction' },
      { source: 'reserve', homeworlds: true, occupiedJunction: true },
    ] as const;
    for (const options of scenarios) {
      const fixture = createGuildBetrayalFixture(options);
      const game = structuredClone(fixture.game);
      const own = viewGame(game, fixture.holder);
      own.players.find(player => player.id === fixture.holder)!.bot = profile;
      // Bots must not reconstruct eligibility or price from hidden opponents.
      for (const rival of own.players) {
        if (rival.id !== own.me) {
          delete rival.hand;
          delete rival.spice;
        }
      }
      const reaction = own.guildBetrayalReaction!;
      assert.equal(reaction.canUse, true);
      const actions = botActions(own);
      assert.deepEqual(actions, [{ type: 'guildBetrayalUse', event: fixture.event }]);
      const result = applyAction(game, fixture.holder, actions[0]);
      assert.equal(viewGame(result, fixture.holder).guildBetrayalReaction, null);
      assert.equal(result.players.find(player => player.id === fixture.holder)!.spice,
        game.players.find(player => player.id === fixture.holder)!.spice + fixture.price);
      assert.equal(result.players.find(player => player.id === fixture.shipper)!.spice,
        game.players.find(player => player.id === fixture.shipper)!.spice - fixture.price);
      assert.equal(result.nexusCards?.cards?.hands[fixture.holder], null);
      assert.ok(result.nexusCards?.cards?.discard.includes('guild'));
      assert.deepEqual(result.players.map(player => ({ id: player.id, forces: player.forces, reserves: player.reserves, elites: player.elites, shipped: player.shipped })),
        fixture.original.players.map(player => ({ id: player.id, forces: player.forces, reserves: player.reserves, elites: player.elites, shipped: player.shipped })));
      assert.deepEqual(result.homeworlds?.custody, fixture.original.homeworlds?.custody);
    }
  }
});

void test('all profiles legally take their own fully funded invoice without treating a refund as payment funding', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createGuildBetrayalFixture({ payer: 'holder' });
    const own = viewGame(fixture.game, fixture.holder);
    own.players.find(player => player.id === fixture.holder)!.bot = profile;
    const actions = botActions(own);
    assert.deepEqual(actions, [{ type: 'guildBetrayalUse', event: fixture.event }]);
    const result = applyAction(fixture.game, fixture.holder, actions[0]);
    assert.equal(result.players.find(player => player.id === fixture.holder)!.spice,
      fixture.game.players.find(player => player.id === fixture.holder)!.spice);
    assert.equal(result.players.find(player => player.id === fixture.holder)!.reserves,
      fixture.game.players.find(player => player.id === fixture.holder)!.reserves - 2);
    assert.equal(result.players.find(player => player.id === fixture.holder)!.shipped, true);
    assert.equal(result.nexusCards?.cards?.hands[fixture.holder], null);
    assert.equal(viewGame(result, fixture.holder).guildBetrayalReaction, null);
  }
});

void test('every profile acknowledges irrelevant faces until the original settlement completes, without fallthrough', () => {
  for (const profile of DIFFICULTIES) {
    for (const payer of ['holder', 'other'] as const) {
      const fixture = createGuildBetrayalFixture({ payer, nexusFace: 'choam' });
      let game = structuredClone(fixture.game);
      for (const player of game.players) {
        const own = viewGame(game, player.id);
        own.players.find(seat => seat.id === player.id)!.bot = profile;
        const reaction = own.guildBetrayalReaction;
        if (!reaction) break;
        const actions = botActions(own);
        if (!reaction.canPass || reaction.hasPassed) {
          assert.deepEqual(actions, []);
          continue;
        }
        assert.deepEqual(actions, [{ type: 'guildBetrayalPass', event: fixture.event }]);
        game = applyAction(game, player.id, actions[0]);
        const after = viewGame(game, player.id);
        after.players.find(seat => seat.id === player.id)!.bot = profile;
        if (after.guildBetrayalReaction) assert.deepEqual(botActions(after), []);
      }
      assert.equal(viewGame(game, fixture.holder).guildBetrayalReaction, null);
      assert.deepEqual(game.players.map(player => ({ id: player.id, spice: player.spice, forces: player.forces, reserves: player.reserves, shipped: player.shipped })),
        fixture.original.players.map(player => ({ id: player.id, spice: player.spice, forces: player.forces, reserves: player.reserves, shipped: player.shipped })));
      assert.equal(game.nexusCards?.cards?.hands[fixture.holder], 'choam');
    }
  }
});

void test('seat-private blocked and response ownership gates override visible held-card hints for all profiles', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createGuildBetrayalFixture();
    const own = viewGame(fixture.game, fixture.holder);
    own.players.find(player => player.id === fixture.holder)!.bot = profile;
    assert.equal(own.nexusCards?.card, 'guild');
    const reaction = own.guildBetrayalReaction!;
    reaction.blocked = 'The committed promise prevents spending this Nexus card.';
    assert.deepEqual(botActions(own), [{ type: 'guildBetrayalPass', event: fixture.event }]);
    reaction.blocked = null;
    reaction.canUse = false;
    assert.deepEqual(botActions(own), [{ type: 'guildBetrayalPass', event: fixture.event }]);
    reaction.canUse = true;
    reaction.hasPassed = true;
    assert.deepEqual(botActions(own), []);
    reaction.hasPassed = false;
    reaction.canPass = false;
    assert.deepEqual(botActions(own), []);
    reaction.canPass = true;
    own.status = 'finished';
    assert.deepEqual(botActions(own), []);
    own.status = 'playing';
    reaction.event = '';
    assert.deepEqual(botActions(own), []);
  }
});

void test('human seats require delegation while autopilot obeys the same private response offer', () => {
  const fixture = createGuildBetrayalFixture({ payer: 'holder' });
  const own = viewGame(fixture.game, fixture.holder);
  const seat = own.players.find(player => player.id === fixture.holder)!;
  delete seat.bot;
  delete seat.autopilot;
  assert.deepEqual(botActions(own), []);
  seat.autopilot = 'Easy';
  const actions = botActions(own);
  assert.deepEqual(actions, [{ type: 'guildBetrayalUse', event: fixture.event }]);
  const result = applyAction(fixture.game, fixture.holder, actions[0]);
  assert.equal(result.nexusCards?.cards?.hands[fixture.holder], null);
  assert.equal(result.players.find(player => player.id === fixture.holder)!.spice,
    fixture.game.players.find(player => player.id === fixture.holder)!.spice);
});
