import { placeFixtureHand } from './fixture-hand';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { TERRITORIES, distance, location, splitLocation } from '../game/board';
import { eliteRevivalRemaining, forceRevivalQuote } from '../game/revival';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture(advanced = false) {
  let g = createGame('IXECON22', newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('i', 'Ixians', 'guild'));
  g.players.forEach((p) => {
    p.ready = true;
  });
  g = applyAction(g, 'e', { type: 'start' });
  for (const p of g.players)
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  g.players[1].faction = 'ixians';
  g.players[1].leaders = leaders('ixians');
  g.players[1].elites = { reserves: 7, tanks: 0, forces: {}, revived: 0 };
  g.players.forEach((p) => {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 20;
  });
  g.phase = 5;
  g.active = 'i';
  g.order = ['i', 'e'];
  g.movementRemaining = ['i', 'e'];
  g.advanced = advanced;
  g.storm = 18;
  return g;
}
const sand = TERRITORIES.filter((t) => t.type === 'sand').flatMap((t) =>
  t.sectors.filter((s) => s !== 18).map((s) => location(t.id, s)),
);
const blocked = (key: string) => splitLocation(key).sector === 18;
const origin = sand.find((key) =>
  [1, 2, 3].every((d) => sand.some((to) => distance(key, to, blocked) === d)),
)!;
const target = (d: number) =>
  sand.find((to) => distance(origin, to, blocked) === d)!;
function field(g: Game, count = 4, cyborgs = 1) {
  const p = g.players[1];
  p.forces = { [origin]: count };
  p.reserves = 20 - count;
  p.elites!.forces = { [origin]: cyborgs };
  p.elites!.reserves = 7 - cyborgs;
  return g;
}
function tanks(g: Game, count = 6, cyborgs = 4) {
  const p = g.players[1];
  p.tanks = count;
  p.reserves = 20 - count;
  p.elites!.tanks = cyborgs;
  p.elites!.reserves = 7 - cyborgs;
  g.phase = 4;
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response || g.decision?.kind === 'revivalStop')
    if (g.decision?.kind === 'revivalStop')
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
    else
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
  return g;
}
function move(g: Game, d = 2, amount = 4, elite = 1, from = origin) {
  const to = splitLocation(target(d));
  return applyAction(g, 'i', {
    type: 'move',
    from,
    amount,
    elite,
    territory: to.territory,
    sector: to.sector,
  });
}
function conserved(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    assert.ok(p.spice >= 0);
  }
  const e = g.players[1].elites!;
  assert.equal(
    e.reserves + e.tanks + Object.values(e.forces).reduce((a, b) => a + b, 0),
    7,
  );
}
void test('a cyborg carries accompanying suboids two territories through a serialized Karama response', () => {
  const initial = field(fixture());
  initial.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  let g = move(initial);
  assert.equal(g.response?.kind, 'ixMovement');
  assert.equal(g.players[1].forces[origin], 4);
  assert.equal(g.players[1].moved, 0);
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[1].forces[target(2)], 4);
  assert.equal(g.players[1].elites!.forces[target(2)], 1);
  assert.equal(g.players[1].moved, 1);
  assert.equal(g.pendingIxMove, null);
  conserved(g);
});
void test('a cyborg left behind cannot give a suboid-only group two-territory movement', () => {
  const g = field(fixture());
  const snapshot = structuredClone(g);
  assert.throws(() => move(g, 2, 3, 0), /more than 1/);
  assert.deepEqual(g, snapshot);
  const moved = move(g, 1, 3, 0);
  assert.equal(moved.response, null);
  assert.equal(moved.players[1].elites!.forces[origin], 1);
  conserved(moved);
});
void test('movement cancellation leaves the army in place, prevents retrying that advantage and preserves a shorter move', () => {
  const before = field(fixture());
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  before.players[0].hand = [karama];
  let g = move(before);
  g = applyAction(g, 'e', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.players[1].moved, 0);
  assert.equal(g.players[1].forces[origin], 4);
  assert.equal(viewGame(g, 'i').players[1].ixMovementBlocked, true);
  assert.throws(() => move(g), /more than 1/);
  g = move(g, 1);
  assert.equal(g.players[1].moved, 1);
  conserved(g);
});
void test('ornithopters give suboids three territories without a cyborg-power response', () => {
  const before = field(fixture());
  before.players[1].forces['arrakeen:10'] = 1;
  before.players[1].reserves--;
  const g = move(before, 3, 3, 0);
  assert.equal(g.response, null);
  assert.equal(g.players[1].forces[target(3)], 3);
  conserved(g);
});
void test('multisector movement needs a cyborg in the selected group and preserves the selected type counts', () => {
  const before = field(fixture());
  const terr = TERRITORIES.find(
    (t) => t.type === 'sand' && t.sectors.filter((s) => s !== 18).length >= 2,
  )!;
  const keys = terr.sectors
    .filter((s) => s !== 18)
    .slice(0, 2)
    .map((s) => location(terr.id, s));
  const dest = sand.find(
    (key) =>
      keys.every((src) => distance(src, key, blocked) <= 2) &&
      keys.some((src) => distance(src, key, blocked) === 2),
  )!;
  assert.ok(dest);
  const to = splitLocation(dest);
  before.players[1].forces = { [keys[0]]: 2, [keys[1]]: 2 };
  before.players[1].elites!.forces = { [keys[1]]: 1 };
  const g = allow(
    applyAction(before, 'i', {
      type: 'move',
      forces: { [keys[0]]: 2, [keys[1]]: 2 },
      eliteForces: { [keys[1]]: 1 },
      territory: to.territory,
      sector: to.sector,
    }),
  );
  assert.equal(g.players[1].forces[dest], 4);
  assert.equal(g.players[1].elites!.forces[dest], 1);
  conserved(g);
});
void test('cyborgs collect three spice each and suboids two without ornithopters', () => {
  const before = field(fixture(), 4, 2);
  before.spice[origin] = 20;
  before.movementRemaining = ['i'];
  const g = applyAction(before, 'i', { type: 'endMovement' });
  assert.equal(g.phase, 7);
  assert.equal(g.players[1].spice, 30);
  assert.equal(g.spice[origin], 10);
  conserved(g);
});
void test('ornithopters increase suboid collection without raising cyborg capacity above three', () => {
  const before = field(fixture(), 4, 2);
  before.players[1].forces['arrakeen:10'] = 1;
  before.players[1].reserves--;
  before.spice[origin] = 20;
  before.movementRemaining = ['i'];
  const g = applyAction(before, 'i', { type: 'endMovement' });
  assert.equal(g.players[1].spice, 32);
  assert.equal(g.spice[origin], 8);
  conserved(g);
});
void test('mixed revival uses the selected free type and charges three per paid cyborg and two per suboid', () => {
  const before = tanks(fixture());
  assert.equal(forceRevivalQuote(before, before.players[1], 3, 2).cost, 5);
  const cyborgFree = allow(
    applyAction(before, 'i', { type: 'revive', amount: 3, elite: 2 }),
  );
  assert.equal(cyborgFree.players[1].spice, 15);
  assert.equal(cyborgFree.players[1].elites!.tanks, 2);
  const suboidFree = allow(
    applyAction(before, 'i', {
      type: 'revive',
      amount: 3,
      elite: 2,
      freeElite: 0,
    }),
  );
  assert.equal(suboidFree.players[1].spice, 14);
  conserved(cyborgFree);
  conserved(suboidFree);
  assert.throws(
    () =>
      applyAction(before, 'i', {
        type: 'revive',
        amount: 2,
        elite: 2,
        freeElite: 0,
      }),
    /integer/,
  );
});
void test('cyborg revival is not capped at one and Ghola may return several while preserving the normal allowance', () => {
  const before = tanks(fixture(true), 7, 7);
  const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
  let g = allow(
    applyAction(before, 'i', { type: 'revive', amount: 3, elite: 3 }),
  );
  assert.equal(g.players[1].spice, 14);
  assert.equal(g.players[1].revived, 3);
  placeFixtureHand(g, 1, [ghola]);
  g = allow(
    applyAction(g, 'i', { type: 'card', card: ghola.id, amount: 4, elite: 4 }),
  );
  assert.equal(g.players[1].elites!.reserves, 7);
  assert.equal(g.players[1].revived, 3);
  conserved(g);
  const emperor = newPlayer('e', 'Emperor', 'emperor');
  emperor.elites = { tanks: 3, reserves: 2, forces: {}, revived: 1 };
  assert.equal(eliteRevivalRemaining(emperor), 0);
});
void test('Tleilaxu ally discount applies to the mixed paid total and cancellation restores the full type-based cost', () => {
  const before = tanks(fixture());
  const t = newPlayer('t', 'Tleilaxu', 'tleilaxu');
  t.spice = 5;
  before.players.push(t);
  before.order.push('t');
  before.players[1].ally = 't';
  t.ally = 'i';
  const g = applyAction(before, 't', { type: 'tleilaxuAllyDiscount' });
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].hand = [karama];
  const declared = applyAction(g, 'i', { type: 'revive', amount: 3, elite: 2 });
  assert.equal(declared.response?.kind, 'revivalDiscount');
  const discounted = allow(declared);
  assert.equal(discounted.players[1].spice, 17);
  assert.equal(discounted.players[2].spice, 9);
  const canceled = allow(
    applyAction(declared, 'e', {
      type: 'card',
      card: karama.id,
      mode: 'cancel',
    }),
  );
  assert.equal(canceled.players[1].spice, 15);
  assert.equal(canceled.players[2].spice, 11);
  conserved(canceled);
});
void test('Emperor-funded extra cyborgs use their actual paid cost with no free-revival discount', () => {
  const before = tanks(fixture(), 6, 4);
  before.players[0].ally = 'i';
  before.players[1].ally = 'e';
  const g = allow(
    applyAction(before, 'e', { type: 'emperorRevival', amount: 3, elite: 3 }),
  );
  assert.equal(g.players[0].spice, 11);
  assert.equal(g.players[1].spice, 20);
  assert.equal(g.players[1].revived, 0);
  assert.equal(g.emperorExtra.i, 3);
  conserved(g);
  before.players[0].spice = 8;
  const snapshot = structuredClone(before);
  assert.throws(
    () =>
      applyAction(before, 'e', { type: 'emperorRevival', amount: 3, elite: 3 }),
    /Not enough spice/,
  );
  assert.deepEqual(before, snapshot);
});
void test('ordinary shipment uses physical counts and keeps cyborg inventory intact', () => {
  const before = fixture();
  const to = splitLocation(origin);
  const g = allow(
    applyAction(before, 'i', {
      type: 'ship',
      amount: 3,
      elite: 2,
      territory: to.territory,
      sector: to.sector,
    }),
  );
  assert.equal(g.players[1].spice, 14);
  assert.equal(g.players[1].forces[origin], 3);
  assert.equal(g.players[1].elites!.forces[origin], 2);
  conserved(g);
});
void test('all AI levels select affordable typed revivals and handle two-territory movement responses', () => {
  for (const difficulty of DIFFICULTIES) {
    const before = tanks(fixture(true), 7, 7);
    before.players[1].bot = difficulty;
    before.players[1].spice = 3;
    const actions = botActions(viewGame(before, 'i'));
    const revival = actions.find((a) => a.type === 'revive');
    assert.ok(revival);
    const g = allow(applyAction(before, 'i', revival));
    assert.ok(g.players[1].spice >= 0);
    assert.ok(g.players[1].revived >= 1);
    conserved(g);
    const moving = field(fixture());
    moving.players.forEach((p) => {
      p.bot = difficulty;
    });
    const declared = move(moving);
    const progressed = runBots(declared, 2);
    assert.equal(progressed.players[1].moved, 1);
    assert.equal(progressed.pendingIxMove, null);
    conserved(progressed);
  }
});
