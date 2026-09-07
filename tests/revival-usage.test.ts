import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';

function fixture(tleilaxu = false) {
  const g = createGame('FREEUSED', newPlayer('a', 'Atreides', 'atreides'));
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  if (tleilaxu) g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.status = 'playing';
  g.phase = 4;
  g.order = g.players.map((p) => p.id);
  for (const p of g.players) {
    p.tanks = 10;
    p.reserves = 10;
    p.spice = 20;
  }
  return g;
}

function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}

void test('normal revival records actual free returns separately from paid units without changing prices', () => {
  let g = fixture();
  g = applyAction(g, 'a', { type: 'revive', amount: 2 });
  assert.equal(g.players[0].freeForcesRevived, 2);
  assert.equal(g.players[0].revived, 2);
  assert.equal(g.players[0].spice, 20);
  g = applyAction(JSON.parse(JSON.stringify(g)), 'a', {
    type: 'revive',
    amount: 1,
  });
  assert.equal(g.players[0].freeForcesRevived, 2);
  assert.equal(g.players[0].revived, 3);
  assert.equal(g.players[0].spice, 18);
  assert.equal(g.players[0].reserves, 13);
  assert.equal(g.players[0].tanks, 7);
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'a', { type: 'revive', amount: 1 }));
  assert.deepEqual(g, before);
});

void test('pending revival records usage only on settlement, and canceled oversized requests consume none', () => {
  let g = fixture(true);
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = applyAction(g, 't', { type: 'tleilaxuRevivalLimit', target: 'a' });
  g = applyAction(g, 'a', { type: 'revive', amount: 5 });
  assert.equal(g.pendingRevival?.free, 2);
  assert.equal(g.players[0].freeForcesRevived, 0);
  const accepted = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(accepted.players[0].freeForcesRevived, 2);
  assert.equal(accepted.players[0].revived, 5);
  g = applyAction(g, 'h', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.pendingRevival, null);
  assert.equal(g.players[0].freeForcesRevived, 0);
  assert.equal(g.players[0].revived, 0);
  assert.equal(g.players[0].spice, 20);
});

void test('Ghola and leader revival do not consume the normal free-force usage ledger', () => {
  let g = fixture();
  const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
  g.players[0].hand = [ghola];
  g = applyAction(g, 'a', { type: 'card', card: ghola.id, amount: 5 });
  assert.equal(g.players[0].freeForcesRevived, 0);
  assert.equal(g.players[0].revived, 0);
  g.players[0].leaders[0].dead = true;
  g.players[0].leaders[0].deaths = 1;
  g.players[0].revivalCycle = 1;
  g = applyAction(g, 'a', {
    type: 'reviveLeader',
    leader: g.players[0].leaders[0].id,
  });
  assert.equal(g.players[0].freeForcesRevived, 0);
  assert.equal(g.players[0].revived, 0);
});

void test('legacy usage stays unknown after prior returns but starts exactly when no normal revival occurred', () => {
  let old = fixture();
  delete old.players[0].freeForcesRevived;
  old.players[0].revived = 2;
  old = applyAction(old, 'a', { type: 'revive', amount: 1 });
  assert.equal(old.players[0].freeForcesRevived, undefined);
  let fresh = fixture();
  delete fresh.players[0].freeForcesRevived;
  fresh = applyAction(fresh, 'a', { type: 'revive', amount: 2 });
  assert.equal(fresh.players[0].freeForcesRevived, 2);
  for (const id of fresh.players.map((p) => p.id))
    assert.ok(
      viewGame(fresh, id).players.every((p) => !('freeForcesRevived' in p)),
    );
});

void test('a new Revival phase resets the ledger, including previously unknown legacy usage', () => {
  let g = fixture();
  g.phase = 2;
  g.players[0].revived = 3;
  g.players[0].freeForcesRevived = 2;
  delete g.players[1].freeForcesRevived;
  // Complete Charity; the empty auction advances through the ordinary lifecycle.
  for (const id of g.players.map((p) => p.id))
    g = applyAction(g, id, { type: 'ready' });
  // Empty hands are eligible, but an empty draw/discard deck skips bidding.
  assert.equal(g.phase, 4);
  assert.ok(
    g.players.every((p) => p.revived === 0 && p.freeForcesRevived === 0),
  );
});
