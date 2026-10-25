import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame } from '../game/engine';
import { RicheseNoFieldControls } from '../components/richese-no-field';
import {
  createRicheseHomeworldShipmentFixture as fixture,
  actRicheseHomeworldShipment as act,
  commitRicheseHomeworldShipment as commit,
  richeseHomeworldShipmentInventory as inventory,
  richeseHomeworldShipmentPlayer as player,
} from './fixture-richese-homeworld-shipment';

for (const companions of [1, 2]) void test(`original Karama prices marker plus ${companions} paid companions as one rounded group`, () => {
  const f = fixture({ companions });
  const rated = act(f.game, f.holder, { type: 'card', card: f.karama, mode: 'shipment', target: f.owner });
  assert.equal(rated.karamaShipping?.player, f.owner);
  assert.ok(rated.discard.some(card => card.id === f.karama));
  const source = structuredClone(rated), original = player(rated);
  const result = commit(rated, f), done = player(result.game);
  const expected = companions === 1 ? 1 : 2;
  // The only opposing Karama was just spent, so native automatic passes may
  // finish the response during the declaration itself.
  assert.equal(result.requested.pendingShipment ?? null, null);
  assert.equal(original.spice - done.spice, expected);
  assert.equal(original.reserves - done.reserves, companions);
  assert.equal(done.forces[f.location], companions);
  assert.equal(done.noField?.deployed?.tokenId, f.token);
  assert.equal(result.game.karamaShipping, null);
  assert.equal(viewGame(result.game, f.holder).richeseNoField?.private, null);
  assert.deepEqual(rated, source);
  assert.deepEqual(inventory(result.game), f.originalInventory);
});

void test('controlled ally/rate projection shows the full replacement fee after native discount cancellation', () => {
  const f = fixture({ companions: 1 }), view = viewGame(f.game, f.owner);
  // Projection-only UI regression, not an earned Guild alliance/cancellation.
  const owner = view.players.find(p => p.id === f.owner)!, ally = view.players.find(p => p.id === f.holder)!;
  owner.ally = ally.id; ally.ally = owner.id; ally.faction = 'guild';
  const markup = () => renderToStaticMarkup(createElement(RicheseNoFieldControls,
    { game: view, act() {}, busy: false, destination: 'hagga_basin', sector: 8, allyPayment: '' }));
  view.guildRateCanceled = true;
  assert.match(markup(), /Ship concealed No-Field [035] · 2 spice/);
  view.guildRateCanceled = false;
  assert.match(markup(), /Ship concealed No-Field [035] · 1 spice/);
  view.guildRateCanceled = true;
  view.karamaShipping = { player: f.owner, owner: f.holder };
  assert.match(markup(), /Ship concealed No-Field [035] · 1 spice/);
});
