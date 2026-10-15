import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, type Game } from '../game/engine';
import { createGuildBetrayalFixture, settleGuildBetrayalFixture } from './fixture-nexus-guild-betrayal';
import { passNativeGuildTransportPermission } from './fixture-guild-ambassador-income-arrival';
const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;

for (const source of ['reserve', 'guildTransport', 'homeworld'] as const) {
  for (const use of [false, true]) {
    void test(`native ${source} full-price cancellation survives deferred Guild Betrayal ${use ? 'Use' : 'Pass'} until physical settlement`, () => {
      const f = createGuildBetrayalFixture({ source, payer: 'guild', homeworlds: source === 'homeworld' });
      const before = structuredClone(f.before);
      // Explicit controlled extension of the existing native source fixture:
      // conserve a real undealt Karama into the future invoice holder's hand.
      const index = before.deck.findIndex(card => card.effect === 'karama');
      assert.ok(index >= 0);
      const card = before.deck.splice(index, 1)[0];
      player(before, f.holder).hand.push(card);
      let g = applyAction(structuredClone(before), f.guild, f.declaration);
      if (g.decision?.kind === 'guildShipment' || g.decision?.kind === 'homeworldShipmentGuild')
        g = applyAction(g, f.guild, { type: 'decision', allow: true,
          ...(g.decision.kind === 'homeworldShipmentGuild' ? { event: g.decision.event } : {}) });
      g = passNativeGuildTransportPermission(g).game;
      assert.equal(g.response?.kind, 'guildRate');
      const amount = g.pendingShipment?.amount ?? g.pendingGuildTransport?.amount ?? g.pendingHomeworldShipment!.amount;
      assert.ok(amount > 1);
      assert.ok(player(before, f.guild).spice >= amount);
      assert.equal(player(g, f.guild).spice, player(before, f.guild).spice);
      g = applyAction(g, f.holder, { type: 'card', mode: 'cancel', card: card.id });
      const frame = g.pendingGuildBetrayal!;
      assert.ok(frame);
      assert.equal(frame.invoice.price, amount);
      assert.equal(player(g, f.guild).spice, player(before, f.guild).spice);
      assert.deepEqual(player(g, f.guild).forces, player(before, f.guild).forces);
      assert.equal(player(g, f.guild).reserves, player(before, f.guild).reserves);
      assert.equal(player(g, f.guild).shipped, false);
      assert.deepEqual(g.homeworlds, before.homeworlds);
      if (use) g = applyAction(g, f.holder, { type: 'guildBetrayalUse', event: frame.invoice.event });
      g = settleGuildBetrayalFixture(g);
      assert.equal(player(g, f.guild).spice, player(before, f.guild).spice - amount);
      assert.equal(player(g, f.holder).spice, player(before, f.holder).spice + (use ? amount : 0));
      assert.equal(player(g, f.guild).shipped, true);
      assert.deepEqual(player(g, f.guild).forces, player(f.original, f.guild).forces);
      assert.equal(player(g, f.guild).reserves, player(f.original, f.guild).reserves);
      assert.deepEqual(g.homeworlds, f.original.homeworlds);
      assert.equal(g.guildBetrayal?.status, 'completed');
      assert.ok(!g.pendingGuildBetrayal);
      assert.equal(g.discard.filter(c => c.id === card.id).length, 1);
      assert.throws(() => applyAction(structuredClone(g), f.holder,
        { type: 'guildBetrayalUse', event: frame.invoice.event }));
    });
  }
}
