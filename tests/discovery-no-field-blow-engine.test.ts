import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { DISCOVERY_SPICE_CARDS, DISCOVERY_TOKENS } from '../game/discoveries';
import { actDiscoveryNoFieldBlow as act, createDiscoveryNoFieldBlowFixture as fixture,
  discoveryNoFieldBlowInventory as inventory, discoveryNoFieldBlowPlayer as p,
  discoveryNoFieldBlowReload as reload, finishDiscoveryNoFieldBlowPhase as finish } from './fixture-discovery-no-field-blow';

function assertBlow(f: ReturnType<typeof fixture>, game: ReturnType<typeof reload>) {
  const before = p(f.game, f.owner), after = p(game, f.owner), amount = Math.min(f.value, before.reserves);
  assert.equal(game.phase, 1);
  assert.equal(game.spiceWindow?.territory, f.target); assert.equal(game.spiceWindow?.amount, f.printed.amount);
  assert.equal(after.noField!.deployed, null); assert.notEqual(after.noFieldEvent, f.event);
  assert.deepEqual(after.noField!.tokens, f.marker!.tokens); assert.equal(after.noField!.lastShipped, f.token);
  assert.equal(after.reserves, before.reserves - amount);
  assert.equal(after.tanks, before.tanks + amount + Number(f.companions));
  assert.equal(Object.entries(after.forces).some(([key, count]) => count > 0 && key.startsWith(`${f.target}:`)), false);
  assert.equal(game.spice[f.location], f.printed.amount);
  const placed = game.discoveries!.tokens.filter(token => token.status === 'placed'); assert.equal(placed.length, 1);
  assert.equal(placed[0].type, f.placement.type); assert.equal(placed[0].territory, f.placement.territory);
  assert.equal(placed[0].sector, f.placement.sector); assert.equal(placed[0].revealedTurn, null);
  assert.equal(p(game, f.other).forces['polar_sink:0'], 1); assert.equal(p(game, f.other).tanks, 0);
  assert.deepEqual(p(game, f.observer).forces, p(f.game, f.observer).forces);
  assert.deepEqual(inventory(game), f.original);
}

void test('public Basic and Advanced Discovery sources earn paid marker custody before the original later draw', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced });
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    const optIn = f.sourceActions.findIndex(step => step.action.type === 'moduleOption' && step.action.module === 'discoveries');
    const firstReady = f.sourceActions.findIndex(step => step.action.type === 'ready');
    const start = f.sourceActions.findIndex(step => step.action.type === 'start');
    assert.ok(optIn >= 0 && optIn < firstReady && firstReady < start);
    assert.equal(f.setup.discoveries!.tokens.length, DISCOVERY_TOKENS.length);
    assert.deepEqual(f.setup.spiceDeck.flatMap(card => 'territory' in card && card.discovery ? [card.discovery] : []).sort(),
      DISCOVERY_SPICE_CARDS.map(card => card.discovery).sort());
    assert.equal(f.sourceCounts.setup, f.setupActions.length); assert.equal(f.sourceCounts.source, f.sourceActions.length);
    assert.equal(f.sourceCounts.markerShipment, f.markerShipment.steps.length); assert.equal(f.sourceCounts.readyPrefix, f.readyPrefix.length);
    assert.equal(p(f.markerShipment.before, f.owner).spice - p(f.markerShipment.after, f.owner).spice, 2);
    assert.equal(p(f.markerShipment.before, f.owner).reserves, p(f.game, f.owner).reserves);
    assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 1); assert.equal(f.game.spiceWindow ?? null, null);
    assert.equal(f.drawStep.actor, f.drawer); assert.deepEqual(f.drawStep.action, { type: 'ready' });
    assert.equal(f.game.ready.includes(f.drawer), false); assert.equal(p(f.game, f.owner).noFieldEvent, f.event);
    assert.deepEqual(inventory(f.game), f.original);
  }
});

void test('Basic actual Discovery blow reveals concealed zero without adding counters before new spice and token placement', () => {
  const f = fixture({ advanced: false, value: 0 }), game = act(reload(f.game), f.drawer, f.drawAction);
  assertBlow(f, game); assert.equal(p(game, f.owner).tanks, 0);
  assert.equal(p(game, f.owner).reserves, p(f.game, f.owner).reserves);
  assert.ok(game.log.some(entry => entry.text.includes('Discovery spice blow; provisional destructive reveal')));
});

void test('Advanced original Discovery blow materializes concealed three and five then destroys all returned counters once', () => {
  for (const value of [3, 5] as const) {
    const f = fixture({ value }); let game = act(reload(f.game), f.drawer, f.drawAction); assertBlow(f, game);
    const event = p(game, f.owner).noFieldEvent;
    game = finish(game); assert.equal(game.phase, 2); assert.equal(p(game, f.owner).tanks, value);
    assert.equal(p(game, f.owner).noFieldEvent, event); assert.equal(p(game, f.owner).noField!.deployed, null);
    assert.equal(game.discoveries!.tokens.filter(token => token.status === 'placed').length, 1);
    assert.deepEqual(inventory(game), f.original);
  }
});

void test('the genuine earlier physical companion dies with its later five marker while the separate Polar force survives', () => {
  const f = fixture({ value: 5, companions: true }); assert.ok(f.physicalShipment);
  assert.equal(f.physicalShipment.before.turn, 1); assert.equal(f.markerShipment.before.turn, 2); assert.equal(f.game.turn, 3);
  assert.equal(p(f.physicalShipment.before, f.owner).spice - p(f.physicalShipment.after, f.owner).spice, 2);
  assert.equal(p(f.game, f.owner).forces[f.location], 1); assert.equal(p(f.game, f.other).forces['polar_sink:0'], 1);
  const game = act(reload(f.game), f.drawer, f.drawAction); assertBlow(f, game);
  assert.equal(p(game, f.owner).tanks, 6); assert.equal(p(game, f.owner).reserves, p(f.game, f.owner).reserves - 5);
  assert.equal(game.spice[f.location], 6); assert.equal(p(game, f.other).forces['polar_sink:0'], 1);
});

void test('an actual voluntary reveal before the same draw leaves ordinary counters for the blow without another reveal', () => {
  const f = fixture({ value: 3 });
  let game = act(reload(f.game), f.owner, { type: 'revealNoField', event: f.event, token: f.token });
  const event = p(game, f.owner).noFieldEvent;
  assert.notEqual(event, f.event); assert.equal(p(game, f.owner).forces[f.location], 3);
  assert.equal(p(game, f.owner).tanks, 0); assert.equal(game.spiceWindow ?? null, null);
  game = act(game, f.drawer, f.drawAction);
  assert.equal(p(game, f.owner).noFieldEvent, event); assert.equal(p(game, f.owner).tanks, 3);
  assert.equal(p(game, f.owner).forces[f.location] ?? 0, 0); assert.equal(game.spice[f.location], 6);
  assert.equal(game.discoveries!.tokens.filter(token => token.status === 'placed').length, 1);
  assert.deepEqual(inventory(game), f.original);
});

void test('all four minimal policies execute the actual pending first-reveal Ready and continue the same blow legally', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced, value: advanced ? 3 : 0 });
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
      const view = viewGame(f.game, f.drawer); view.players.find(player => player.id === f.drawer)!.bot = difficulty;
      const ready = botActions(view).find(action => action.type === 'ready'); assert.ok(ready);
      let game = act(reload(f.game), f.drawer, ready); assertBlow(f, game);
      game = finish(game); assert.equal(game.phase, 2); assert.equal(p(game, f.owner).tanks, f.value);
      assert.equal(p(game, f.owner).noField!.deployed, null); assert.equal(p(game, f.other).forces['polar_sink:0'], 1);
      assert.deepEqual(inventory(game), f.original);
    }
  }
});
