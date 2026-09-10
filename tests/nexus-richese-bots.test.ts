import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { botHomeworldShipmentPaymentAllowed } from '../game/homeworld-payment-options';
import {
  nexusRicheseFixture,
  nexusRicheseAllow,
  nexusRicheseInventory,
} from './fixture-nexus-richese';

void test('all profiles generate an affordable five-force Richese shipment when ordinary five-force shipping is unaffordable', () => {
  for (const advanced of [false, true])
    for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const f = nexusRicheseFixture({ advanced, spice: 1 });
      const v = viewGame(f.g, f.owner);
      v.players.find((p) => p.id === f.owner)!.bot = profile;
      const before = structuredClone(v);
      const action = botActions(v).find(
        (a) =>
          a.type === 'ship' &&
          a.nexus === v.nexusRichese!.event &&
          a.amount === 5,
      );
      assert.ok(action, profile);
      assert.ok(botHomeworldShipmentPaymentAllowed(v, action));
      const next = nexusRicheseAllow(applyAction(f.g, f.owner, action));
      const me = next.players.find((p) => p.id === f.owner)!;
      assert.equal(me.reserves, 15);
      assert.equal(me.spice, 0);
      assert.equal(me.shipped, true);
      nexusRicheseInventory(next);
      assert.deepEqual(v, before);
    }
});

void test('Homeworld payment filter quotes the Nexus source and bots preserve ordinary fallback without wasting Fremen free shipping', () => {
  const f = nexusRicheseFixture({
    advanced: true,
    homeworlds: true,
    guild: true,
    spice: 1,
  });
  const v = viewGame(f.g, f.owner);
  v.players[0].bot = 'Hard';
  // Projection-only low-Junction seam exercises the payment consumer; engine custody stays untouched.
  const junction = v.homeworlds!.worlds!.find((w) => w.card === 'junction')!;
  junction.side = 'low';
  const action = {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 5,
    nexus: v.nexusRichese!.event,
  };
  assert.equal(botHomeworldShipmentPaymentAllowed(v, action), true);
  assert.equal(
    botHomeworldShipmentPaymentAllowed(v, { ...action, nexus: 'stale' }),
    false,
  );
  assert.equal(
    botHomeworldShipmentPaymentAllowed(v, { ...action, amount: 6 }),
    false,
  );
  v.nexusRichese!.blocked = 'Unavailable';
  assert.ok(botActions(v).every((a) => a.nexus === undefined));
  const fremen = nexusRicheseFixture({ ownerFaction: 'fremen', spice: 0 });
  const fv = viewGame(fremen.g, fremen.owner);
  fv.players[0].bot = 'Hard';
  const ordinary = botActions(fv).find((a) => a.type === 'ship');
  assert.ok(ordinary);
  assert.equal(ordinary.nexus, undefined);
  nexusRicheseInventory(
    nexusRicheseAllow(applyAction(fremen.g, fremen.owner, ordinary)),
  );
});
