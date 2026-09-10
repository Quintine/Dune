import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import {
  nexusGuildCunningFixture,
  originalGuildCunningTurn,
  nexusGuildCunningRequest,
  nexusGuildCunningAllow,
  nexusGuildCunningReload,
  nexusGuildCunningInventory,
  settleGuildCunningShipment,
  holdGuildCunningCard,
  nexusGuildCunningAllianceFixture,
} from './fixture-nexus-guild-cunning';
function rejected(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function stable(g: Game) {
  nexusGuildCunningInventory(g);
  for (const p of g.players)
    assert.deepEqual(
      viewGame(nexusGuildCunningReload(g), p.id),
      viewGame(g, p.id),
    );
  assert.deepEqual(
    normalizeAutomaticGame(nexusGuildCunningReload(g)),
    nexusGuildCunningReload(g),
  );
}

void test('an actual Moritani alliance formed on the second arrival preserves the earned Guild Hajr continuation', () => {
  const f = nexusGuildCunningAllianceFixture();
  const hajr = holdGuildCunningCard(f.g, f.owner, 'hajr');
  let g = originalGuildCunningTurn(f);
  g = nexusGuildCunningAllow(
    applyAction(g, f.owner, nexusGuildCunningRequest(f, g)),
  );
  g = settleGuildCunningShipment(
    applyAction(g, f.owner, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 3,
    }),
  );
  assert.equal(g.pendingTerrorEntry?.stage, 'offer');
  g = nexusGuildCunningAllow(
    applyAction(g, f.target, { type: 'decision', alliance: true }),
  );
  stable(g);
  const before = structuredClone(g.players[0]);
  g = applyAction(nexusGuildCunningReload(g), f.owner, {
    type: 'decision',
    accept: true,
  });
  assert.equal(g.players[0].ally, f.target);
  assert.equal(g.players[1].ally, f.owner);
  assert.equal(g.players[0].spice, before.spice);
  assert.equal(g.players[0].reserves, before.reserves);
  stable(g);
  g = applyAction(g, f.owner, { type: 'card', card: hajr.id });
  g = applyAction(g, f.owner, {
    type: 'move',
    from: 'carthag:11',
    territory: 'hagga_basin',
    sector: 12,
    amount: 3,
  });
  assert.equal(g.players[0].forces['hagga_basin:12'], 8);
  assert.equal(g.players[0].spice, before.spice);
  if (g.active === f.owner)
    g = applyAction(g, f.owner, { type: 'endMovement' });
  assert.notEqual(g.active, f.owner);
  stable(g);
});

void test('Guild special Karama stops its own second shipment without payment or arrival and preserves only the unused Hajr move', () => {
  for (const homeworlds of [false, true]) {
    const f = nexusGuildCunningFixture({ advanced: true, homeworlds });
    const karama = holdGuildCunningCard(f.g, f.owner, 'karama');
    const hajr = holdGuildCunningCard(f.g, f.owner, 'hajr');
    let g = originalGuildCunningTurn(f, false);
    g = nexusGuildCunningAllow(
      applyAction(g, f.owner, nexusGuildCunningRequest(f, g)),
    );
    const before = structuredClone(g.players[0]);
    const shipment: Action = homeworlds
      ? {
          type: 'homeworldShip',
          event: viewGame(g, f.owner).homeworldShipment!.event,
          destination: 'homeworld:harkonnen',
          sources: { 'homeworld:guild': { normal: 3, elite: 0 } },
        }
      : { type: 'ship', territory: 'carthag', sector: 11, amount: 3 };
    g = applyAction(g, f.owner, shipment);
    assert.equal(
      g.decision?.kind,
      homeworlds ? 'homeworldShipmentGuild' : 'guildShipment',
    );
    stable(g);
    g = applyAction(nexusGuildCunningReload(g), f.owner, {
      type: 'card',
      mode: 'special',
      card: karama.id,
    });
    assert.equal(
      g.nexusGuildCunningHistory!.at(-1)!.shipment!.stage,
      'stopped',
    );
    assert.equal(g.players[0].spice, before.spice);
    assert.equal(g.players[0].reserves, before.reserves);
    assert.deepEqual(g.players[0].forces, before.forces);
    assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(
      g.nexusCards!.cards!.discard.filter((c) => c === 'guild').length,
      1,
    );
    if (homeworlds)
      assert.equal(
        g.homeworlds!.custody!.visitors['homeworld:harkonnen']?.[f.owner],
        undefined,
      );
    const move: Action = {
      type: 'move',
      from: 'arrakeen:10',
      territory: 'hagga_basin',
      sector: 12,
      amount: 5,
    };
    rejected(g, f.owner, move);
    rejected(g, f.owner, shipment);
    g = applyAction(nexusGuildCunningReload(g), f.owner, {
      type: 'card',
      card: hajr.id,
    });
    g = applyAction(g, f.owner, move);
    rejected(g, f.owner, {
      type: 'move',
      from: 'hagga_basin:12',
      territory: 'arsunt',
      sector: 12,
      amount: 5,
    });
    assert.equal(g.players[0].spice, before.spice);
    stable(g);
  }
});

void test('native and Cunning cross-shipments cannot manufacture a shipment within the same territory', () => {
  const f = nexusGuildCunningFixture();
  const native = nexusGuildCunningFixture();
  native.g.players[0].reserves -= 5;
  native.g.players[0].forces['arrakeen:10'] = 5;
  nexusGuildCunningInventory(native.g);
  let g = originalGuildCunningTurn(f, false);
  const same: Action = {
    type: 'guildShip',
    from: 'arrakeen:10',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  };
  rejected(native.g, native.owner, same);
  g = nexusGuildCunningAllow(
    applyAction(g, f.owner, nexusGuildCunningRequest(f, g)),
  );
  rejected(g, f.owner, same);
  stable(g);
});

void test('Guild Cunning adds a paid native reserve, cross or return shipment after the actual original movement without resetting flags', () => {
  for (const advanced of [false, true])
    for (const route of ['reserve', 'cross', 'return'] as const) {
      const f = nexusGuildCunningFixture({ advanced, karama: true });
      let g = originalGuildCunningTurn(f);
      const before = nexusGuildCunningReload(g);
      const request = nexusGuildCunningRequest(f, g);
      g = applyAction(g, f.owner, request);
      assert.equal(g.response?.kind, 'nexusGuildCunning');
      assert.equal(g.players[0].shipped, true);
      assert.equal(g.players[0].moved, 1);
      assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
      stable(g);
      g = nexusGuildCunningAllow(nexusGuildCunningReload(g));
      assert.equal(
        viewGame(g, f.owner).nexusGuildCunning!.active!.stage,
        'secondShipment',
      );
      const action: Action =
        route === 'reserve'
          ? { type: 'ship', territory: 'carthag', sector: 11, amount: 5 }
          : {
              type: 'guildShip',
              from: 'hagga_basin:12',
              territory: route === 'return' ? 'reserves' : 'carthag',
              sector: route === 'return' ? 0 : 11,
              amount: 5,
            };
      g = settleGuildCunningShipment(applyAction(g, f.owner, action));
      assert.equal(g.players[0].spice, before.players[0].spice - 3);
      assert.equal(g.players[0].moved, 1);
      assert.equal(g.players[0].shipped, true);
      assert.equal(
        g.players[0].reserves,
        route === 'reserve' ? 10 : route === 'return' ? 20 : 15,
      );
      if (route !== 'return')
        assert.equal(g.players[0].forces['carthag:11'], 5);
      rejected(g, f.owner, action);
      rejected(g, f.owner, {
        type: 'move',
        from: 'carthag:11',
        territory: 'hagga_basin',
        sector: 12,
        amount: 1,
      });
      assert.equal(
        g.nexusCards!.cards!.discard.filter((c) => c === 'guild').length,
        1,
      );
      stable(g);
    }
});

void test('canceling Guild Cunning preserves the first paid shipment and movement and does not reset the real turn queue', () => {
  for (const advanced of [false, true]) {
    const f = nexusGuildCunningFixture({ advanced, karama: true });
    let g = originalGuildCunningTurn(f);
    const before = nexusGuildCunningReload(g),
      request = nexusGuildCunningRequest(f, g);
    g = applyAction(g, f.owner, request);
    g = applyAction(nexusGuildCunningReload(g), f.target, {
      type: 'card',
      mode: 'cancel',
      card: f.karama,
    });
    assert.deepEqual(g.players[0].forces, before.players[0].forces);
    assert.equal(g.players[0].spice, before.players[0].spice);
    assert.equal(g.players[0].moved, 1);
    assert.equal(g.players[0].shipped, true);
    assert.equal(g.movementRemaining!.includes(f.owner), false);
    assert.notEqual(g.active, f.owner);
    assert.equal(g.discard.filter((c) => c.id === f.karama).length, 1);
    rejected(g, f.owner, request);
    rejected(g, f.owner, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 1,
    });
    stable(g);
  }
});

void test('declining ordinary movement does not leave a free movement after the second Guild shipment', () => {
  for (const originalShip of [false, true]) {
    const f = nexusGuildCunningFixture();
    let g = originalShip ? originalGuildCunningTurn(f, false) : f.g;
    g = nexusGuildCunningAllow(
      applyAction(g, f.owner, nexusGuildCunningRequest(f, g)),
    );
    g = settleGuildCunningShipment(
      applyAction(g, f.owner, {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 3,
      }),
    );
    assert.equal(g.players[0].moved, 0);
    rejected(g, f.owner, {
      type: 'move',
      from: 'carthag:11',
      territory: 'hagga_basin',
      sector: 12,
      amount: 3,
    });
    stable(g);
  }
});

void test('Hajr grants only its remaining extra movement before or after the second shipment and cannot create a third move', () => {
  for (const mode of ['late', 'early-unspent', 'early-used'] as const) {
    const f = nexusGuildCunningFixture();
    const hajr = holdGuildCunningCard(f.g, f.owner, 'hajr');
    let g = originalGuildCunningTurn(f);
    if (mode !== 'late')
      g = applyAction(g, f.owner, { type: 'card', card: hajr.id });
    if (mode === 'early-used')
      g = applyAction(g, f.owner, {
        type: 'move',
        from: 'hagga_basin:12',
        territory: 'arsunt',
        sector: 12,
        amount: 5,
      });
    g = nexusGuildCunningAllow(
      applyAction(g, f.owner, nexusGuildCunningRequest(f, g)),
    );
    g = settleGuildCunningShipment(
      applyAction(g, f.owner, {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 3,
      }),
    );
    if (mode === 'late')
      g = applyAction(g, f.owner, { type: 'card', card: hajr.id });
    const move: Action = {
      type: 'move',
      from: 'carthag:11',
      territory: 'hagga_basin',
      sector: 12,
      amount: 3,
    };
    if (mode === 'early-used') rejected(g, f.owner, move);
    else {
      g = applyAction(g, f.owner, move);
      assert.equal(g.players[0].moved, 2);
      rejected(g, f.owner, {
        type: 'move',
        from: 'hagga_basin:12',
        territory: 'arrakeen',
        sector: 10,
        amount: 1,
      });
    }
    assert.equal(g.discard.filter((c) => c.id === hajr.id).length, 1);
    stable(g);
  }
});

void test('declining the second shipment preserves paid first forces and permits only an unused Hajr move after declining ordinary movement', () => {
  const f = nexusGuildCunningFixture();
  const hajr = holdGuildCunningCard(f.g, f.owner, 'hajr');
  let g = originalGuildCunningTurn(f, false);
  g = nexusGuildCunningAllow(
    applyAction(g, f.owner, nexusGuildCunningRequest(f, g)),
  );
  const skip: Action = {
    type: 'nexusGuildSkipShipment',
    event: viewGame(g, f.owner).nexusGuildCunning!.active!.event,
  };
  rejected(g, f.target, skip);
  rejected(g, f.owner, { ...skip, event: 'stale' });
  g = applyAction(g, f.owner, skip);
  assert.equal(g.players[0].spice, 17);
  assert.equal(g.players[0].reserves, 15);
  assert.equal(g.players[0].shipped, true);
  assert.equal(g.players[0].moved, 0);
  stable(g);
  const move: Action = {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'hagga_basin',
    sector: 12,
    amount: 5,
  };
  rejected(g, f.owner, move);
  rejected(g, f.owner, skip);
  g = applyAction(nexusGuildCunningReload(g), f.owner, {
    type: 'card',
    card: hajr.id,
  });
  g = applyAction(g, f.owner, move);
  assert.equal(g.players[0].forces['hagga_basin:12'], 5);
  assert.equal(g.players[0].spice, 17);
  rejected(g, f.owner, {
    type: 'move',
    from: 'hagga_basin:12',
    territory: 'arsunt',
    sector: 12,
    amount: 5,
  });
  assert.equal(g.discard.filter((c) => c.id === hajr.id).length, 1);
  stable(g);
});

void test('Guild Cunning keeps declared ownership private before play and rejects stale, foreign or duplicate declarations', () => {
  const f = nexusGuildCunningFixture();
  let g = originalGuildCunningTurn(f);
  const request = nexusGuildCunningRequest(f, g);
  for (const id of [f.target, f.observer])
    assert.equal(viewGame(g, id).nexusGuildCunning, null);
  rejected(g, f.owner, { ...request, nexus: 'old' });
  rejected(g, f.target, request);
  g = nexusGuildCunningAllow(applyAction(g, f.owner, request));
  rejected(g, f.owner, request);
  for (const p of g.players)
    assert.equal(
      Object.hasOwn(viewGame(g, p.id), 'nexusGuildCunningHistory'),
      false,
    );
  stable(g);
});

void test('a second Guild shipment can return actual Arrakis counters to Junction through the typed native Homeworld route', () => {
  const f = nexusGuildCunningFixture({ homeworlds: true });
  let g = originalGuildCunningTurn(f);
  g = nexusGuildCunningAllow(
    applyAction(g, f.owner, nexusGuildCunningRequest(f, g)),
  );
  const option = viewGame(g, f.owner).guildHomeworldShipment!;
  assert.equal(option.blocked, null);
  g = applyAction(g, f.owner, {
    type: 'guildHomeworldShip',
    event: option.event,
    destination: 'homeworld:guild',
    sources: { 'hagga_basin:12': { normal: 5, elite: 0 } },
  });
  assert.equal(g.players[0].reserves, 20);
  assert.equal(g.players[0].forces['hagga_basin:12'], undefined);
  assert.equal(g.players[0].spice, 14);
  stable(g);
  const outward = nexusGuildCunningFixture({ homeworlds: true });
  let next = originalGuildCunningTurn(outward);
  next = nexusGuildCunningAllow(
    applyAction(next, outward.owner, nexusGuildCunningRequest(outward, next)),
  );
  const outwardOption = viewGame(next, outward.owner).homeworldShipment!;
  assert.equal(outwardOption.blocked, null);
  next = applyAction(next, outward.owner, {
    type: 'homeworldShip',
    event: outwardOption.event,
    destination: 'homeworld:harkonnen',
    sources: { 'homeworld:guild': { normal: 2, elite: 0 } },
  });
  assert.equal(next.players[0].reserves, 13);
  assert.equal(
    next.homeworlds!.custody!.visitors['homeworld:harkonnen'][outward.owner]
      .normal,
    2,
  );
  assert.equal(next.players[0].spice, 16);
  stable(next);
});

void test('Advanced Guild Cunning finishes within a genuinely granted out-of-order combined turn', () => {
  const f = nexusGuildCunningFixture({ advanced: true, karama: true });
  let g = f.g;
  // The first phase-five position is only fixture staging. Enter its native
  // turn queue through an actual completed Revival boundary before acting.
  Object.assign(g, {
    phase: 4,
    active: null,
    ready: [],
    order: [f.target, f.observer, f.owner],
  });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'guildTiming');
  g = applyAction(g, f.owner, { type: 'decision', take: true });
  g = nexusGuildCunningAllow(g);
  assert.equal(g.active, f.owner);
  assert.equal(g.guildTimingGranted, true);
  g = originalGuildCunningTurn(f, true, g);
  g = nexusGuildCunningAllow(
    applyAction(g, f.owner, nexusGuildCunningRequest(f, g)),
  );
  g = settleGuildCunningShipment(
    applyAction(g, f.owner, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 3,
    }),
  );
  if (g.active === f.owner)
    g = applyAction(g, f.owner, { type: 'endMovement' });
  assert.equal(g.movementRemaining!.includes(f.owner), false);
  assert.equal(g.active, f.target);
  assert.equal(new Set(g.movementRemaining).size, g.movementRemaining!.length);
  stable(g);
});
