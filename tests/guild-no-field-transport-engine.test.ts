import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { guildTransportQuote } from '../game/transport-quote';
import { actGuildNoFieldTransport as act, advanceGuildNoFieldTransport as advance,
  createGuildNoFieldTransportFixture as fixture, guildNoFieldTransportClean as clean,
  guildNoFieldTransportInventory as inventory, guildNoFieldTransportPlayer as p,
  guildNoFieldTransportReload as reload, passGuildNoFieldPermission as passPermission,
  settleGuildNoFieldTransport as settle } from './fixture-guild-no-field-transport';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function body(game: Game, actor: string) {
  const own = p(game, actor); return { reserves: own.reserves, tanks: own.tanks, forces: structuredClone(own.forces) };
}

void test('native alliance and Secret closing draw sources retain original paid markers and actual arrays', () => {
  for (const source of ['native', 'secret'] as const) {
    const f = fixture({ source });
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.equal(f.sourceCounts.setup, f.setupActions.length); assert.equal(f.sourceCounts.source, f.sourceActions.length);
    assert.equal(f.sourceCounts.markerShipment, f.markerShipment.steps.length);
    assert.ok(f.markerShipment.steps.some(step => step.action.type === 'ship' && step.action.noField === f.token));
    assert.equal(p(f.markerShipment.before, f.owner).spice - p(f.markerShipment.after, f.owner).spice, 2);
    assert.equal(p(f.markerShipment.before, f.owner).reserves, p(f.game, f.owner).reserves);
    assert.equal(f.game.turn, 2); assert.equal(f.game.active, f.owner); assert.equal(p(f.game, f.owner).shipped, false);
    if (source === 'native') {
      assert.ok(f.alliance); assert.equal(f.sourceCounts.alliance, f.alliance.steps.length);
      assert.deepEqual(f.alliance.steps.map(step => step.action.type), ['alliance', 'alliance']);
      assert.ok(f.sourceActions.some(step => step.action.type === 'decision' && step.action.take === false));
    } else {
      assert.ok(f.draw && f.nexusSelection && f.alliance); assert.equal(f.sourceCounts.draw, f.draw.steps.length);
      assert.deepEqual(f.alliance.steps.map(step => [step.actor, step.action.type, step.action.target]),
        [['atreides', 'alliance', 'emperor'], ['emperor', 'alliance', 'atreides']]);
      assert.equal(p(f.draw.before, f.owner).ally, null);
      assert.deepEqual(f.draw.before.nexusCards!.phase!.eligible, [f.owner]);
      assert.equal(f.draw.before.nexusCards!.cards!.hands[f.owner], null);
      assert.equal(f.draw.after.nexusCards!.cards!.hands[f.owner], 'guild');
      assert.ok(f.sourceActions.some(step => step.action.type === 'moduleOption' && step.action.module === 'nexusCards'));
    }
    assert.deepEqual(inventory(f.game), f.original);
  }
});

void test('native allied CROSS accepts concealed zero three and five through real permission and rate without materializing', () => {
  for (const value of [0, 3, 5] as const) {
    const f = fixture({ value }), before = body(f.game, f.owner), spice = p(f.game, f.owner).spice, guildSpice = p(f.game, f.guild!).spice;
    const quote = guildTransportQuote(viewGame(f.game, f.owner), f.action);
    assert.deepEqual(quote.unavailableReasons, []); assert.equal(quote.quote?.cost, 1);
    let game = act(reload(f.game), f.owner, f.action);
    assert.equal(game.response?.kind, 'guildTransportPermission'); assert.deepEqual(body(game, f.owner), before);
    assert.deepEqual(p(game, f.owner).noField, f.marker); assert.equal(p(game, f.owner).noFieldEvent, f.event);
    game = passPermission(game); assert.equal(game.response?.kind, 'guildRate');
    game = settle(game);
    assert.deepEqual(body(game, f.owner), before); assert.equal(p(game, f.owner).spice, spice - 1);
    assert.equal(p(game, f.guild!).spice, guildSpice + 1);
    assert.deepEqual(p(game, f.owner).noField!.deployed!.location, { territory: 'polar_sink', sector: 0 });
    assert.notEqual(p(game, f.owner).noFieldEvent, f.event);
    assert.equal(p(game, f.owner).noField!.lastShipped, f.token); assert.deepEqual(p(game, f.owner).noField!.tokens, f.marker!.tokens);
    assert.equal(p(game, f.owner).shipped, true); assert.equal(p(game, f.owner).moved, 0);
    reject(game, f.owner, f.action); assert.deepEqual(inventory(game), f.original);
  }
});

void test('actual native permission cancellation spends only original Karama and retains concealed custody and unused shipment', () => {
  const f = fixture({ value: 5 }), before = body(f.game, f.owner), spice = p(f.game, f.owner).spice;
  let game = act(reload(f.game), f.owner, f.action);
  assert.equal(game.response?.kind, 'guildTransportPermission');
  game = settle(act(game, f.canceler, { type: 'card', mode: 'cancel', card: f.karama }));
  assert.deepEqual(body(game, f.owner), before); assert.equal(p(game, f.owner).spice, spice);
  assert.deepEqual(p(game, f.owner).noField, f.marker); assert.equal(p(game, f.owner).noFieldEvent, f.event);
  assert.equal(p(game, f.owner).shipped, false); assert.equal(viewGame(game, f.owner).guildTransportCanceled, true);
  assert.equal(viewGame(game, f.owner).guildRateCanceled, false);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(inventory(game), f.original);
});

void test('actual rate cancellation pays full price once or withdraws an unfunded marker quote after a real bribe', () => {
  for (const unfunded of [false, true]) {
    const f = fixture({ value: 3 }); let game = reload(f.game);
    if (unfunded) game = act(game, f.owner, { type: 'bribe', target: f.canceler, amount: p(game, f.owner).spice - 1 });
    const before = body(game, f.owner), spice = p(game, f.owner).spice, guildSpice = p(game, f.guild!).spice;
    game = passPermission(act(game, f.owner, f.action)); assert.equal(game.response?.kind, 'guildRate');
    game = settle(act(game, f.canceler, { type: 'card', mode: 'cancel', card: f.karama }));
    assert.deepEqual(body(game, f.owner), before); assert.equal(viewGame(game, f.owner).guildRateCanceled, unfunded);
    if (unfunded) {
      assert.equal(p(game, f.owner).spice, spice); assert.equal(p(game, f.guild!).spice, guildSpice);
      assert.deepEqual(p(game, f.owner).noField, f.marker); assert.equal(p(game, f.owner).noFieldEvent, f.event);
      assert.equal(p(game, f.owner).shipped, false);
    } else {
      assert.equal(p(game, f.owner).spice, spice - 2); assert.equal(p(game, f.guild!).spice, guildSpice + 2);
      assert.equal(p(game, f.owner).shipped, true);
      assert.deepEqual(p(game, f.owner).noField!.deployed!.location, { territory: 'polar_sink', sector: 0 });
    }
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1); assert.deepEqual(inventory(game), f.original);
  }
});

void test('stale foreign invalid physical and ordinary ally RETURN selections reject before transport costs', () => {
  const f = fixture();
  reject(f.game, f.owner, { ...f.action, event: 'old-owned-marker-event' });
  reject(f.game, f.owner, { ...f.action, noField: 'foreign-token' }); reject(f.game, f.canceler, f.action);
  reject(f.game, f.owner, { ...f.action, forces: { 'imperial_basin:9': 1 } });
  reject(f.game, f.owner, f.returnAction);
  assert.deepEqual(p(f.game, f.owner).noField, f.marker); assert.deepEqual(inventory(f.game), f.original);
});

void test('actual absent-Guild Secret CROSS and RETURN handle concealed zero three and five and spend one original Nexus', () => {
  for (const value of [0, 3, 5] as const) for (const returns of [false, true]) {
    const f = fixture({ source: 'secret', value }), before = body(f.game, f.owner), spice = p(f.game, f.owner).spice;
    const proposed = returns ? f.returnAction : f.action;
    const quote = guildTransportQuote(viewGame(f.game, f.owner), proposed);
    assert.deepEqual(quote.unavailableReasons, []); assert.equal(quote.quote?.cost, 1);
    const game = settle(act(reload(f.game), f.owner, proposed));
    assert.deepEqual(body(game, f.owner), before); assert.equal(p(game, f.owner).spice, spice - 1);
    assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'guild').length, 1);
    assert.equal(p(game, f.owner).noField!.lastShipped, f.token); assert.notEqual(p(game, f.owner).noFieldEvent, f.event);
    assert.deepEqual(p(game, f.owner).noField!.tokens, f.marker!.tokens);
    if (returns) { assert.equal(p(game, f.owner).noField!.deployed, null); assert.equal(p(game, f.owner).noField!.hiddenReturn, true); }
    else assert.deepEqual(p(game, f.owner).noField!.deployed!.location, { territory: 'polar_sink', sector: 0 });
    assert.equal(p(game, f.owner).shipped, true); reject(game, f.owner, proposed);
    assert.deepEqual(inventory(game), f.original);
  }
});

void test('a genuine earlier physical companion returns separately from its later concealed five marker', () => {
  const f = fixture({ source: 'secret', value: 5, companions: true }); assert.ok(f.physicalShipment);
  assert.equal(f.physicalShipment.before.turn, 1); assert.equal(f.markerShipment.before.turn, 2); assert.equal(f.game.turn, 3);
  assert.equal(p(f.game, f.owner).forces['imperial_basin:9'], 1);
  assert.deepEqual(f.returnAction.forces, { 'imperial_basin:9': 1 });
  const before = p(f.game, f.owner), quote = guildTransportQuote(viewGame(f.game, f.owner), f.returnAction);
  assert.deepEqual(quote.unavailableReasons, []); assert.equal(quote.quote?.cost, 1);
  const game = settle(act(reload(f.game), f.owner, f.returnAction)), after = p(game, f.owner);
  assert.equal(after.reserves, before.reserves + 1); assert.equal(after.tanks, before.tanks);
  assert.deepEqual(after.forces, {}); assert.equal(after.noField!.deployed, null); assert.equal(after.noField!.hiddenReturn, true);
  assert.equal(after.noField!.lastShipped, f.token); assert.deepEqual(after.noField!.tokens, f.marker!.tokens);
  assert.equal(after.spice, before.spice - 1); assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'guild').length, 1);
  assert.deepEqual(inventory(game), f.original);
});

void test('Secret hidden return preserves the same-token next-shipment ban at an actual later unused opportunity', () => {
  const f = fixture({ source: 'secret', value: 0 });
  let game = settle(act(reload(f.game), f.owner, f.returnAction));
  const turn = game.turn;
  // The remaining original unopened land faces are selected before their real draws.
  game = advance(game, state => state.turn === turn + 1 && state.phase === 0 && clean(state));
  for (const position of [0, 1]) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery && card.territory !== 'imperial_basin');
    assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
  }
  game = advance(game, state => state.phase === 5 && state.active === f.owner && clean(state));
  assert.equal(p(game, f.owner).shipped, false); assert.equal(p(game, f.owner).noField!.lastShipped, f.token);
  reject(game, f.owner, { type: 'ship', noField: f.token, event: p(game, f.owner).noFieldEvent, territory: 'polar_sink', sector: 0 });
  const other = p(game, f.owner).noField!.tokens.find(token => token.id !== f.token)!;
  game = settle(act(game, f.owner, { type: 'ship', noField: other.id, event: p(game, f.owner).noFieldEvent, territory: 'polar_sink', sector: 0 }));
  assert.equal(p(game, f.owner).noField!.deployed!.tokenId, other.id); assert.equal(p(game, f.owner).reserves, 20);
  assert.deepEqual(inventory(game), f.original);
});

void test('all four minimal profiles propose a legal owned native or Secret marker transport without reading its value', () => {
  for (const source of ['native', 'secret'] as const) {
    const f = fixture({ source, value: 0 });
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
      const view = viewGame(f.game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
      const proposed = botActions(view).find(action => action.type === 'guildShip' && action.noField === f.token);
      assert.ok(proposed, `${source}/${difficulty} supplies the actual owned marker transport`);
      const game = settle(act(reload(f.game), f.owner, proposed));
      assert.equal(p(game, f.owner).shipped, true); assert.equal(p(game, f.owner).reserves, p(f.game, f.owner).reserves);
      assert.equal(p(game, f.owner).tanks, 0); assert.deepEqual(inventory(game), f.original);
    }
  }
});
