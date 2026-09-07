import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  applyAction,
  viewGame,
  battles,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import { presenceAt } from '../game/force-presence';
import { TERRITORIES } from '../game/board';
const ids = ['opaque-a', 'opaque-b', 'opaque-c'];
function fixture(advanced = false) {
  const g = createGame(
    'NOFIELD2',
    newPlayer('r', 'Richese', 'richese'),
    advanced,
    ['choam'],
  );
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.order = ['r', 'h'];
  g.active = 'r';
  g.storm = 18;
  g.deck = baseDeck();
  g.discard = [];
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
    p.hand = [];
    p.traitorChoices = [];
    p.traitors = [];
  }
  g.players[0].noField = createRicheseNoField(ids);
  g.players[0].noFieldEvent = 'initial-event';
  return g;
}
function send(g: Game, id: string, a: Action) {
  return applyAction(g, id, a);
}
function ship(
  g: Game,
  value: 0 | 3 | 5 = 5,
  territory = 'arrakeen',
  sector = 10,
) {
  return send(g, 'r', {
    type: 'ship',
    noField: ids[[0, 3, 5].indexOf(value)],
    event: g.players[0].noFieldEvent,
    territory,
    sector,
  });
}
function reveal(g: Game) {
  return send(g, 'r', {
    type: 'revealNoField',
    event: g.players[0].noFieldEvent,
    token: g.players[0].noField!.deployed!.tokenId,
  });
}
function conserve(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
}
function marker(
  g: Game,
  value: 0 | 3 | 5 = 5,
  territory = 'arrakeen',
  sector = 10,
) {
  g.players[0].noField = deployRicheseNoField(g.players[0].noField!, {
    tokenId: ids[[0, 3, 5].indexOf(value)],
    controller: 'r',
    location: { territory, sector },
  });
  return g;
}
void test('own No-Field pays one-force price and keeps actual reserves and public denomination secret', () => {
  for (const value of [0, 3, 5] as const) {
    const before = fixture();
    const g = ship(before, value);
    conserve(g);
    assert.equal(g.players[0].spice, 9);
    assert.equal(g.players[0].reserves, 20);
    assert.deepEqual(g.players[0].forces, {});
    assert.equal(presenceAt(g.players[0], 'arrakeen'), 1);
    assert.equal(g.response, null);
    assert.equal(g.players[0].shipped, true);
    assert.equal(before.players[0].noField!.deployed, null);
    const other = viewGame(g, 'h');
    assert.equal(other.richeseNoField!.private, null);
    assert.equal(
      JSON.stringify(other).includes(ids[[0, 3, 5].indexOf(value)]),
      false,
    );
    assert.equal(other.players[0].noField!.deployed!.effectiveForces, 1);
  }
});
void test('Karama cancellation leaves price, supply and history untouched and ordinary shipment available', () => {
  const before = fixture();
  const k = before.deck.findIndex((c) => c.effect === 'karama');
  before.players[1].hand.push(...before.deck.splice(k, 1));
  let g = ship(before);
  assert.equal(g.response?.kind, 'richeseNoField');
  assert.equal(g.players[0].spice, 10);
  assert.equal(g.players[0].noField!.deployed, null);
  g = send(JSON.parse(JSON.stringify(g)), 'h', {
    type: 'card',
    mode: 'cancel',
    card: g.players[1].hand[0].id,
  });
  assert.equal(g.players[0].noField!.lastShipped, null);
  assert.equal(g.players[0].shipped, false);
  assert.equal(g.players[0].spice, 10);
  assert.throws(() => ship(g), /prevented No-Field/);
  g = send(g, 'r', {
    type: 'ship',
    amount: 2,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.players[0].forces['arrakeen:10'], 2);
  conserve(g);
});
void test('voluntary reveal materializes only remaining reserves, including zero, and preserves no-repeat history', () => {
  for (const value of [0, 3, 5] as const) {
    let g = fixture();
    g.players[0].reserves = 2;
    g.players[0].tanks = 18;
    g = ship(g, value);
    const event = g.players[0].noFieldEvent;
    g = reveal(g);
    assert.equal(g.players[0].forces['arrakeen:10'] ?? 0, Math.min(value, 2));
    assert.equal(
      g.players[0].noField!.lastShipped,
      ids[[0, 3, 5].indexOf(value)],
    );
    conserve(g);
    assert.throws(
      () =>
        send(g, 'r', {
          type: 'revealNoField',
          event,
          token: ids[[0, 3, 5].indexOf(value)],
        }),
      /No concealed/,
    );
    g.players[0].shipped = false;
    assert.throws(() => ship(g, value), /twice in a row/);
  }
});
void test('marker-only and mixed physical movement preserve physical conservation and rotate stale selection events', () => {
  let g = marker(fixture(), 5, 'imperial_basin', 10);
  g.players[0].forces = { 'imperial_basin:10': 2 };
  g.players[0].reserves = 18;
  const event = g.players[0].noFieldEvent;
  g = send(g, 'r', {
    type: 'move',
    forces: { 'imperial_basin:10': 2 },
    noField: ids[2],
    event,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.deepEqual(g.players[0].forces, { 'arrakeen:10': 2 });
  assert.equal(presenceAt(g.players[0], 'arrakeen'), 3);
  assert.equal(g.players[0].reserves, 18);
  conserve(g);
  assert.notEqual(g.players[0].noFieldEvent, event);
  let single = marker(fixture(), 0, 'imperial_basin', 10);
  single = send(single, 'r', {
    type: 'move',
    forces: {},
    noField: ids[0],
    event: single.players[0].noFieldEvent,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.deepEqual(single.players[0].forces, {});
  assert.equal(single.players[0].moved, 1);
  conserve(single);
});
void test('No-Field occupancy blocks a third stronghold faction and allied co-occupation', () => {
  let g = marker(fixture());
  g.players.push(newPlayer('e', 'Emperor', 'emperor'));
  g.players[2].forces = { 'arrakeen:10': 1 };
  g.players[2].reserves = 19;
  g.active = 'h';
  assert.throws(
    () =>
      send(g, 'h', {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 1,
      }),
    /three occupying factions/,
  );
  g.players.pop();
  g.players[0].ally = 'h';
  g.players[1].ally = 'r';
  g = normalizeAutomaticGame(g);
  assert.equal(g.decision?.kind, 'richeseAllyOpportunity');
  g = send(g, 'r', { type: 'decision', decline: true });
  assert.throws(
    () =>
      send(g, 'h', {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 1,
      }),
    /occupied by your ally/,
  );
});
void test('marker-only collection treats every secret value as one collector, without reserve transfer', () => {
  const target = TERRITORIES.find(
    (t) =>
      t.type === 'sand' &&
      t.id !== 'imperial_basin' &&
      t.sectors.some((s) => s !== 18),
  )!;
  const sector = target.sectors.find((s) => s !== 18)!;
  for (const value of [0, 3, 5] as const) {
    let g = marker(fixture(), value, target.id, sector);
    g.phase = 5;
    g.active = 'r';
    g.movementRemaining = ['r'];
    g.spice[`${target.id}:${sector}`] = 9;
    g.ready = [];
    g = send(g, 'r', { type: 'endMovement' });
    assert.equal(g.phase, 7);
    assert.equal(g.players[0].spice, 12);
    assert.equal(g.spice[`${target.id}:${sector}`], 7);
    assert.equal(g.players[0].reserves, 20);
    conserve(g);
  }
});
void test('storm exposure reveals exact marker sector and loses only actual available physical units', () => {
  const target = TERRITORIES.find(
    (t) =>
      t.type === 'sand' && t.id !== 'imperial_basin' && t.sectors.includes(1),
  )!;
  let g = marker(fixture(), 5, target.id, 1);
  g.players[0].reserves = 2;
  g.players[0].tanks = 18;
  g.phase = 0;
  g.storm = 18;
  g.stormPending = 1;
  g.ready = [];
  g = send(g, 'r', { type: 'ready' });
  g = send(g, 'h', { type: 'ready' });
  assert.equal(g.players[0].noField!.deployed, null);
  assert.equal(
    g.players[0].noField!.tokens.find(
      (t) => t.id === g.players[0].noField!.lastShipped,
    )!.value,
    5,
  );
  assert.equal(g.players[0].tanks, 20);
  assert.equal(g.players[0].reserves, 0);
  assert.deepEqual(g.players[0].forces, {});
  conserve(g);
});
void test('all hidden values can seal marker-only battles, reveal together, and retain a zero-token battle', () => {
  for (const value of [0, 3, 5] as const) {
    let g = marker(fixture(), value);
    g.players[1].forces = { 'arrakeen:10': 1 };
    g.players[1].reserves = 19;
    g.phase = 6;
    g.active = 'r';
    assert.equal(battles(g).length, 1);
    g = send(g, 'r', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'h',
    });
    for (const id of ['r', 'h'])
      g = send(g, id, {
        type: 'battlePreparationReady',
        event: g.battle!.preLeader!.event,
      });
    assert.deepEqual(g.battle!.noFieldPlayers, ['r']);
    assert.equal(viewGame(g, 'r').battle!.ownForces!.normal, value);
    assert.equal(viewGame(g, 'h').battle!.ownForces!.normal, 1);
    g = send(g, 'r', {
      type: 'battlePlan',
      dial: value,
      leader: g.players[0].leaders[0].id,
    });
    assert.ok(g.players[0].noField!.deployed);
    assert.equal(g.players[0].reserves, 20);
    g = send(g, 'h', {
      type: 'battlePlan',
      dial: 1,
      leader: g.players[1].leaders[0].id,
    });
    assert.equal(g.battle!.revealed, true);
    assert.equal(g.players[0].noField!.deployed, null);
    assert.equal(g.players[0].reserves, 20 - value);
    assert.equal(g.players[0].forces['arrakeen:10'] ?? 0, value);
    conserve(g);
    g = send(g, 'r', { type: 'traitorCall', call: false });
    g = send(g, 'h', { type: 'traitorCall', call: false });
    conserve(g);
    assert.deepEqual(
      normalizeAutomaticGame(JSON.parse(JSON.stringify(g))),
      JSON.parse(JSON.stringify(g)),
    );
  }
});

void test('Gamont reveals the selected No-Field sector and returns at most one actual force, even for zero', () => {
  for (const value of [0, 3, 5] as const)
    for (const ordinary of [0, 2]) {
      let g = marker(fixture(), value);
      const c = newPlayer('c', 'CHOAM', 'choam');
      g.players.push(c);
      g.order.push('c');
      g.phase = 8;
      g.active = null;
      const r = g.players[0];
      r.forces = ordinary ? { 'arrakeen:10': ordinary } : {};
      r.reserves = 2;
      r.tanks = 18 - ordinary;
      const i = g.deck.findIndex((c) => c.name === 'Trip to Gamont');
      c.hand.push(...g.deck.splice(i, 1));
      const card = c.hand[0].id;
      const option = viewGame(g, 'c').choamWorthless!.gamont.find(
        (o) => o.target === 'r' && o.key === 'arrakeen:10',
      )!;
      assert.equal(option.noField, true);
      g = send(g, 'c', {
        type: 'card',
        mode: 'choam',
        card,
        target: 'r',
        from: 'arrakeen:10',
        elite: 0,
      });
      const actual = ordinary + Math.min(value, 2),
        returned = actual > 0 ? 1 : 0;
      assert.equal(g.players[0].noField!.deployed, null);
      assert.equal(g.players[0].forces['arrakeen:10'] ?? 0, actual - returned);
      assert.equal(g.players[0].reserves, 2 - Math.min(value, 2) + returned);
      assert.ok(g.discard.some((c) => c.id === card));
      conserve(g);
    }
});
void test('Gamont cancellation conceals the token; stale restored marker custody aborts without using the card', () => {
  for (const cancel of [true, false]) {
    let g = marker(fixture(), 5);
    g.phase = 8;
    g.active = null;
    const c = newPlayer('c', 'CHOAM', 'choam');
    g.players.push(c);
    g.order.push('c');
    const i = g.deck.findIndex((c) => c.name === 'Trip to Gamont');
    c.hand.push(...g.deck.splice(i, 1));
    const card = c.hand[0].id;
    const k = g.deck.findIndex((c) => c.effect === 'karama');
    g.players[1].hand.push(...g.deck.splice(k, 1));
    const karama = g.players[1].hand[0].id;
    g = send(g, 'c', {
      type: 'card',
      mode: 'choam',
      card,
      target: 'r',
      from: 'arrakeen:10',
    });
    assert.equal(g.response?.kind, 'choamWorthless');
    assert.ok(g.players[0].noField!.deployed);
    assert.equal(g.players[0].reserves, 20);
    g = JSON.parse(JSON.stringify(g));
    if (cancel)
      g = send(g, 'h', { type: 'card', mode: 'cancel', card: karama });
    else {
      g.players[0].noFieldEvent = 'different-incarnation';
      g = send(g, 'h', { type: 'passResponse' });
    }
    assert.ok(g.players[0].noField!.deployed);
    assert.equal(g.players[0].reserves, 20);
    assert.ok(g.players[2].hand.some((c) => c.id === card));
    conserve(g);
  }
});
