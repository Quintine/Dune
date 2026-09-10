import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  nexusGuildSecretAllyFixture,
  nexusGuildSecretAllyRequest,
  nexusGuildSecretAllyInventory,
  nexusGuildSecretAllyReload,
  holdGuildSecretAllyCard,
  nexusGuildSecretAllianceFixture,
} from './fixture-nexus-guild-secret-ally';
import { nexusAllow } from './fixture-nexus-cards';
function rejected(g: Game, owner: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, owner, action));
  assert.deepEqual(g, before);
}
function stable(g: Game) {
  nexusGuildSecretAllyInventory(g);
  for (const p of g.players)
    assert.deepEqual(
      viewGame(nexusGuildSecretAllyReload(g), p.id),
      viewGame(g, p.id),
    );
  assert.deepEqual(
    normalizeAutomaticGame(nexusGuildSecretAllyReload(g)),
    nexusGuildSecretAllyReload(g),
  );
}

void test('Guild Secret Ally charges the native tariff once without a Guild response and retains ordinary faction movement', () => {
  for (const advanced of [false, true])
    for (const desert of [false, true]) {
      const f = nexusGuildSecretAllyFixture({ advanced });
      const action = nexusGuildSecretAllyRequest(f.g, f.owner, {
        type: 'ship',
        territory: desert ? 'hagga_basin' : 'arrakeen',
        sector: desert ? 12 : 10,
        amount: 5,
      });
      let g = applyAction(f.g, f.owner, action);
      assert.equal(g.players[0].spice, desert ? 15 : 17);
      assert.equal(g.players[0].reserves, 15);
      assert.equal(g.players[0].shipped, true);
      assert.equal(g.players[0].moved, 0);
      assert.equal(g.response, null);
      assert.equal(g.decision, null);
      assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
      assert.equal(
        g.nexusCards!.cards!.discard.filter((c) => c === 'guild').length,
        1,
      );
      rejected(g, f.owner, action);
      g = applyAction(nexusGuildSecretAllyReload(g), f.owner, {
        type: 'move',
        from: desert ? 'hagga_basin:12' : 'arrakeen:10',
        territory: desert ? 'arsunt' : 'hagga_basin',
        sector: 12,
        amount: 5,
      });
      assert.equal(g.players[0].moved, 1);
      stable(g);
    }
});

void test('Guild Secret Ally cross and return preserve actual Emperor normal and Sardaukar counters', () => {
  for (const returns of [false, true]) {
    const f = nexusGuildSecretAllyFixture({
      ownerFaction: 'emperor',
      advanced: true,
    });
    const p = f.g.players[0];
    p.reserves -= 5;
    p.elites!.reserves -= 2;
    p.forces['arrakeen:10'] = 5;
    p.elites!.forces['arrakeen:10'] = 2;
    stable(f.g);
    const action = nexusGuildSecretAllyRequest(f.g, f.owner, {
      type: 'guildShip',
      from: 'arrakeen:10',
      territory: returns ? 'reserves' : 'carthag',
      sector: returns ? 0 : 11,
      amount: 5,
      elite: 2,
    });
    const g = applyAction(f.g, f.owner, action);
    assert.equal(g.players[0].spice, 17);
    assert.equal(g.players[0].reserves, returns ? 20 : 15);
    assert.equal(g.players[0].elites!.reserves, returns ? 5 : 3);
    assert.equal(g.players[0].forces['arrakeen:10'], undefined);
    if (!returns) {
      assert.equal(g.players[0].forces['carthag:11'], 5);
      assert.equal(g.players[0].elites!.forces['carthag:11'], 2);
    }
    rejected(g, f.owner, action);
    stable(g);
  }
});

void test('Fremen paid Guild reserve shipment has no free-reinforcement range or storm privilege', () => {
  const f = nexusGuildSecretAllyFixture({
    ownerFaction: 'fremen',
    advanced: true,
    homeworlds: true,
  });
  rejected(f.g, f.owner, {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 5,
  });
  const action = nexusGuildSecretAllyRequest(f.g, f.owner, {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 5,
    elite: 2,
  });
  const storm = structuredClone(f.g);
  storm.storm = 10;
  rejected(storm, f.owner, action);
  rejected(
    f.g,
    f.owner,
    nexusGuildSecretAllyRequest(f.g, f.owner, {
      type: 'guildShip',
      from: 'reserves',
      territory: 'arrakeen',
      sector: 10,
      amount: 5,
    }),
  );
  const g = applyAction(f.g, f.owner, action);
  assert.equal(g.players[0].spice, 17);
  assert.equal(g.players[0].reserves, 15);
  assert.equal(g.players[0].elites!.reserves, 1);
  assert.equal(g.players[0].elites!.forces['arrakeen:10'], 2);
  stable(g);
  const ordinary = nexusGuildSecretAllyFixture({
    ownerFaction: 'fremen',
    advanced: true,
  });
  const free = applyAction(ordinary.g, ordinary.owner, {
    type: 'ship',
    territory: 'the_great_flat',
    sector: 15,
    amount: 5,
  });
  assert.equal(free.players[0].spice, 20);
  assert.equal(free.nexusCards!.cards!.hands[ordinary.owner], 'guild');
  stable(free);
});

void test('Guild Secret Ally reserve and interplanetary shipments withdraw exact native Homeworld types', () => {
  for (const interplanetary of [false, true]) {
    const f = nexusGuildSecretAllyFixture({
      ownerFaction: 'emperor',
      advanced: true,
      homeworlds: true,
    });
    const sources = {
      'homeworld:emperor': { normal: 3, elite: 0 },
      'homeworld:emperor:salusa': { normal: 0, elite: 2 },
    };
    const action = nexusGuildSecretAllyRequest(
      f.g,
      f.owner,
      interplanetary
        ? {
            type: 'homeworldShip',
            event: viewGame(f.g, f.owner).homeworldShipment!.event,
            destination: 'homeworld:harkonnen',
            sources,
          }
        : {
            type: 'ship',
            territory: 'arrakeen',
            sector: 10,
            amount: 5,
            elite: 2,
            homeworldSources: sources,
          },
    );
    const g = applyAction(f.g, f.owner, action);
    assert.equal(g.players[0].spice, 17);
    assert.equal(g.players[0].reserves, 15);
    assert.equal(g.players[0].elites!.reserves, 3);
    if (interplanetary)
      assert.deepEqual(
        g.homeworlds!.custody!.visitors['homeworld:harkonnen'][f.owner],
        { normal: 3, elite: 2 },
      );
    else assert.equal(g.players[0].elites!.forces['arrakeen:10'], 2);
    stable(g);
  }
});

void test('Guild Secret Ally rejects foreign, stale, duplicated and concealed requests without revealing another hand', () => {
  const f = nexusGuildSecretAllyFixture();
  const request = nexusGuildSecretAllyRequest(f.g, f.owner);
  for (const id of [f.target, f.observer]) {
    assert.equal(viewGame(f.g, id).nexusGuildSecretAlly, null);
    rejected(f.g, id, request);
  }
  rejected(f.g, f.owner, { ...request, nexus: 'stale' });
  rejected(f.g, f.owner, { ...request, noField: 'hidden' });
  const g = applyAction(f.g, f.owner, request);
  for (const p of g.players)
    assert.equal(
      Object.hasOwn(viewGame(g, p.id), 'nexusGuildSecretHistory'),
      false,
    );
  stable(g);
});

void test('a binding Truthtrance answer can rely on privately held Guild pricing and then fulfill the original shipment', () => {
  const f = nexusGuildSecretAllyFixture({ spice: 3 });
  const card = holdGuildSecretAllyCard(f.g, f.target, 'truthtrance');
  let g = applyAction(f.g, f.target, { type: 'card', card: card.id });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = applyAction(g, f.target, {
    type: 'truthAsk',
    question: {
      kind: 'shipment',
      target: f.owner,
      territory: 'arrakeen',
      minimum: 5,
    },
  });
  assert.deepEqual(viewGame(g, f.owner).truthShipmentAnswers, ['yes', 'no']);
  g = applyAction(g, f.owner, { type: 'truthAnswer', answer: 'yes' });
  const witness = viewGame(g, f.owner).shipmentCompletion!;
  assert.ok(
    witness.actions.some(
      (a) =>
        a.type === 'ship' &&
        a.nexus === viewGame(g, f.owner).nexusGuildSecretAlly!.event,
    ),
  );
  for (const id of [f.target, f.observer])
    assert.equal(viewGame(g, id).shipmentCompletion, null);
  rejected(g, f.owner, { type: 'endMovement' });
  rejected(
    g,
    f.owner,
    nexusGuildSecretAllyRequest(g, f.owner, {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 4,
    }),
  );
  g = applyAction(
    nexusGuildSecretAllyReload(g),
    f.owner,
    nexusGuildSecretAllyRequest(g, f.owner),
  );
  assert.equal(g.players[0].spice, 0);
  assert.equal(g.players[0].reserves, 15);
  assert.equal(g.shipmentPromises![0].fulfilled, true);
  stable(g);
});

void test('a genuine Moritani arrival alliance preserves completed Guild Secret Ally history and subsequent native movement', () => {
  const f = nexusGuildSecretAllianceFixture();
  let g = applyAction(f.g, f.owner, nexusGuildSecretAllyRequest(f.g, f.owner));
  assert.equal(g.pendingTerrorEntry?.stage, 'offer');
  const before = structuredClone(g.players[0]),
    history = structuredClone(g.nexusGuildSecretHistory);
  g = nexusAllow(
    applyAction(g, f.target, { type: 'decision', alliance: true }),
  );
  stable(g);
  g = applyAction(nexusGuildSecretAllyReload(g), f.owner, {
    type: 'decision',
    accept: true,
  });
  assert.equal(g.players[0].ally, f.target);
  assert.equal(g.players[1].ally, f.owner);
  assert.deepEqual(g.nexusGuildSecretHistory, history);
  assert.equal(g.players[0].spice, before.spice);
  assert.equal(g.players[0].reserves, before.reserves);
  stable(g);
  g = applyAction(g, f.owner, {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'hagga_basin',
    sector: 12,
    amount: 5,
  });
  assert.equal(g.players[0].forces['hagga_basin:12'], 5);
  g = applyAction(g, f.owner, { type: 'endMovement' });
  assert.notEqual(g.active, f.owner);
  stable(g);
});
