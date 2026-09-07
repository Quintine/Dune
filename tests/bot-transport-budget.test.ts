import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { territory } from '../game/board';

function fixture(fremen = false) {
  const g = createGame(
    'TRANSPORT',
    newPlayer('p', 'Mover', fremen ? 'fremen' : 'guild'),
    fremen,
  );
  g.players.push(newPlayer('q', 'Ally', fremen ? 'guild' : 'emperor'));
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    active: 'p',
    order: ['p', 'q'],
    movementRemaining: ['p', 'q'],
    storm: 18,
  });
  for (const p of g.players) {
    p.forces = {};
    p.hand = [];
    p.spice = 0;
  }
  if (fremen) {
    g.players[0].ally = 'q';
    g.players[1].ally = 'p';
  } else {
    g.players[0].forces = { 'red_chasm:7': 5 };
    g.players[0].reserves = 15;
  }
  return g;
}
const transports = (g: Game) =>
  botActions(viewGame(g, 'p')).filter((a) => a.type === 'guildShip');
const price = (to: unknown, n: unknown) =>
  Math.ceil(
    (Number(n) * (territory(String(to)).type === 'stronghold' ? 1 : 2)) / 2,
  );

void test('Guild transport candidates use rounded total cost at every budget and preserve affordable target order', () => {
  for (const level of DIFFICULTIES) {
    const g = fixture();
    g.players[0].bot = level;
    g.players[0].spice = 1000;
    const rich = transports(g);
    assert.ok(rich.length);
    for (const budget of [0, 1, 2, 3, 4, 5, 8]) {
      g.players[0].spice = budget;
      const actual = transports(g);
      assert.deepEqual(
        actual,
        rich.filter((a) => price(a.territory, a.amount) <= budget),
      );
      for (const a of actual) {
        const result = applyAction(g, 'p', a);
        assert.equal(
          result.players[0].spice,
          budget - price(a.territory, a.amount),
        );
        assert.equal(result.players[0].shipped, true);
      }
    }
  }
});
void test('allied Fremen paid cross-shipping consumes the explicit shared budget and remains distinct from free reinforcements', () => {
  for (const level of DIFFICULTIES) {
    const g = fixture(true);
    g.players[0].bot = level;
    assert.deepEqual(transports(g), []);
    g.players[1].spice = 3;
    g.aid.q = { recipient: 'p', amount: 3 };
    const offered = transports(g);
    assert.ok(offered.length);
    for (const a of offered) {
      const cost = price(a.territory, a.amount);
      assert.ok(cost > 0 && cost <= 3);
      const result = applyAction(g, 'p', a);
      assert.equal(result.players[0].spice, 0);
      // The pledge is already escrowed; spend it without charging the donor twice.
      assert.equal(result.players[1].spice, 3);
      assert.equal(result.aid.q.amount, 3 - cost);
    }
    const free = botActions(viewGame(g, 'p')).filter((a) => a.type === 'ship');
    assert.ok(free.length);
    for (const a of free)
      assert.equal(applyAction(g, 'p', a).players[1].spice, 3);
    g.aid.q = { recipient: 'q', amount: 3 };
    assert.deepEqual(transports(g), []);
  }
});
void test('changing unpledged opposing resources and private cards never changes transport offers', () => {
  for (const level of DIFFICULTIES) {
    const g = fixture(true);
    g.players[0].bot = level;
    g.players[0].spice = 4;
    const before = transports(g),
      snapshot = structuredClone(g);
    g.players[1].spice = 99999;
    g.players[1].hand = [{ id: 'hidden', name: 'Hidden', kind: 'lasgun' }];
    assert.deepEqual(transports(g), before);
    assert.deepEqual(snapshot.players[0], g.players[0]);
  }
});
