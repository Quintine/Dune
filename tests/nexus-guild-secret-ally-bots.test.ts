import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { botHomeworldShipmentPaymentAllowed } from '../game/homeworld-payment-options';
import { fremenReserveEntry } from '../game/bot-mobility';
import {
  nexusGuildSecretAllyFixture,
  nexusGuildSecretAllyInventory,
} from './fixture-nexus-guild-secret-ally';
import { nexusAllow } from './fixture-nexus-cards';

void test('all profiles consider Guild-priced groups before ordinary affordability and retain legal normal fallback', () => {
  for (const advanced of [false, true])
    for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const f = nexusGuildSecretAllyFixture({ advanced, spice: 2 }),
        v = viewGame(f.g, f.owner);
      v.players[0].bot = profile;
      const before = structuredClone(v);
      const actions = botActions(v),
        action = actions.find(
          (a) =>
            a.type === 'ship' &&
            a.nexus === v.nexusGuildSecretAlly!.event &&
            Number(a.amount) > 2,
        );
      assert.ok(action, profile);
      assert.ok(botHomeworldShipmentPaymentAllowed(v, action));
      const next = nexusAllow(applyAction(f.g, f.owner, action));
      assert.equal(next.players[0].spice, 0);
      assert.equal(next.players[0].shipped, true);
      assert.equal(next.players[0].moved, 0);
      nexusGuildSecretAllyInventory(next);
      assert.deepEqual(v, before);
      assert.ok(
        actions.some((a) => a.type === 'ship' && a.nexus === undefined),
      );
      assert.equal(
        botHomeworldShipmentPaymentAllowed(v, { ...action, nexus: 'stale' }),
        false,
      );
    }
});

void test('Fremen policies keep free reinforcement and only spend Guild Nexus on a paid route beyond native range', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = nexusGuildSecretAllyFixture({
        ownerFaction: 'fremen',
        advanced: true,
        spice: 20,
      }),
      v = viewGame(f.g, f.owner);
    v.players[0].bot = profile;
    const actions = botActions(v),
      free = actions.find((a) => a.type === 'ship' && a.nexus === undefined);
    assert.ok(free, profile);
    assert.ok(fremenReserveEntry(String(free.territory)));
    const paid = actions.find(
      (a) => a.type === 'ship' && a.nexus === v.nexusGuildSecretAlly!.event,
    );
    assert.ok(paid, profile);
    assert.equal(fremenReserveEntry(String(paid.territory)), false);
    assert.notEqual(paid.sector, v.storm);
    assert.ok(
      actions.every(
        (a) => !(a.type === 'guildShip' && a.from === 'reserves' && a.nexus),
      ),
    );
    const next = nexusAllow(applyAction(f.g, f.owner, paid));
    nexusGuildSecretAllyInventory(next);
    const zero = nexusGuildSecretAllyFixture({
        ownerFaction: 'fremen',
        spice: 0,
      }),
      zv = viewGame(zero.g, zero.owner);
    zv.players[0].bot = profile;
    assert.ok(botActions(zv).every((a) => a.nexus === undefined));
  }
});

void test('all profiles can select a physically typed cross-shipment with the explicit source and never borrow flexible Guild timing', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = nexusGuildSecretAllyFixture({
        ownerFaction: 'emperor',
        advanced: true,
      }),
      p = f.g.players[0];
    // Conserved pre-declaration position, independent of the Nexus receipt.
    p.forces['the_great_flat:15'] = 5;
    p.reserves -= 5;
    p.elites!.forces['the_great_flat:15'] = 2;
    p.elites!.reserves -= 2;
    const v = viewGame(f.g, f.owner);
    v.players[0].bot = profile;
    const action = botActions(v).find(
      (a) =>
        a.type === 'guildShip' && a.nexus === v.nexusGuildSecretAlly!.event,
    );
    assert.ok(action, profile);
    const next = nexusAllow(applyAction(f.g, f.owner, action));
    nexusGuildSecretAllyInventory(next);
    assert.equal(next.players[0].moved, 0);
    assert.equal(next.players[0].shipped, true);
    const other = viewGame(f.g, f.target);
    other.players.find((p) => p.id === f.target)!.bot = profile;
    assert.ok(botActions(other).every((a) => a.nexus === undefined));
  }
});
