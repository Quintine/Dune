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
import { baseDeck } from '../game/cards';
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
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
function fixture() {
  let g = createGame('GUILDTE2', newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(g, newPlayer('f', 'Fremen', 'fremen'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'e', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g = applyAction(g, 'f', {
    type: 'fremenSetup',
    placements: { sietch_tabr: 10 },
  });
  g.advanced = true;
  g.players.forEach((p) => (p.hand = []));
  g.phase = 4;
  g.order = ['e', 'g', 'h', 'f'];
  return ready(g);
}
function choose(g: Game, take: boolean) {
  return applyAction(g, 'g', { type: 'decision', take });
}
function end(g: Game) {
  return applyAction(g, g.active!, { type: 'endMovement' });
}
function cancel(g: Game) {
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[2].hand = [karama];
  return applyAction(g, 'h', { type: 'card', card: karama.id, mode: 'cancel' });
}
void test('Guild can act first while the other factions retain their storm order and each gets one turn', () => {
  let g = fixture();
  assert.equal(g.active, null);
  assert.equal(g.decision?.kind, 'guildTiming');
  assert.equal(viewGame(g, 'g').decision?.player, 'g');
  assert.throws(
    () => applyAction(g, 'e', { type: 'endMovement' }),
    /pending decision/,
  );
  g = choose(g, true);
  assert.equal(g.response, null);
  g = allow(g);
  const acted = [];
  while (g.phase === 5) {
    acted.push(g.active);
    g = end(g);
  }
  assert.deepEqual(acted, ['g', 'e', 'h', 'f']);
  assert.deepEqual(g.order, ['e', 'g', 'h', 'f']);
  assert.deepEqual(g.movementRemaining, []);
  assert.throws(() => applyAction(g, 'g', { type: 'endMovement' }), /Wait/);
});
void test('Guild can wait beyond its normal slot and then act between later players without revealing future intent', () => {
  let g = choose(fixture(), false);
  assert.equal(g.response, null);
  assert.equal(g.active, 'e');
  assert.equal(viewGame(g, 'h').decision, null);
  g = end(g);
  assert.equal(g.decision?.kind, 'guildTiming');
  assert.equal(g.decision?.kind === 'guildTiming' && g.decision.next, 'g');
  g = choose(g, false);
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(g.active, 'h');
  g = end(g);
  assert.equal(g.decision?.kind, 'guildTiming');
  g = choose(g, true);
  assert.equal(g.active, 'g');
  assert.equal(g.response, null);
  g = end(g);
  assert.equal(g.active, 'f');
  assert.deepEqual(g.movementRemaining, ['f']);
});
void test('Guild waiting until last is activated automatically and cannot interrupt another faction mid-turn', () => {
  let g = choose(fixture(), false);
  assert.throws(() => choose(g, true), /not available/);
  g = end(g);
  g = allow(choose(g, false));
  assert.equal(g.active, 'h');
  g = end(g);
  g = choose(g, false);
  assert.equal(g.active, 'f');
  g = end(g);
  assert.equal(g.active, 'g');
  assert.equal(g.decision, null);
  g = applyAction(g, 'g', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.active, 'g');
  assert.deepEqual(g.movementRemaining, ['g']);
  g = applyAction(g, 'g', { type: 'decision', allow: true });
  g = end(g);
  assert.notEqual(g.phase, 5);
});
void test('Karama cancels an early Guild turn and restores its normal position for this phase only', () => {
  const initial = fixture();
  initial.players[2].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  let g = cancel(choose(initial, true));
  assert.equal(g.active, 'e');
  assert.equal(g.guildTimingLocked, true);
  assert.equal(viewGame(g, 'g').guildTimingLocked, true);
  g = end(g);
  assert.equal(g.active, 'g');
  assert.equal(g.decision, null);
  g = end(g);
  assert.equal(g.active, 'h');
  g = end(end(g));
  assert.notEqual(g.phase, 5);
  g.phase = 4;
  g.ready = [];
  g = ready(g);
  assert.equal(g.guildTimingLocked, false);
  assert.equal(g.guildTimingGranted, false);
  assert.equal(g.decision?.kind, 'guildTiming');
});
void test('Karama can stop Guild delaying its normal turn, but taking that normal turn needs no power response', () => {
  let g = end(choose(fixture(), false));
  const normal = choose(g, true);
  assert.equal(normal.active, 'g');
  assert.equal(normal.response, null);
  g.players[2].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  g = cancel(choose(g, false));
  assert.equal(g.active, 'g');
  assert.deepEqual(g.movementRemaining, ['g', 'h', 'f']);
  assert.equal(g.guildTimingLocked, true);
});
void test('allied co-occupation after Nexus uses actual completed movement turns when Guild changes order', () => {
  let g = fixture();
  g.players[0].ally = 'g';
  g.players[1].ally = 'e';
  g.players[0].forces = { 'arrakeen:10': 1 };
  g.players[0].reserves = 19;
  g.players[1].forces = { 'arrakeen:10': 5 };
  g = allow(choose(g, true));
  g = end(g);
  assert.equal(g.players[1].forces['arrakeen:10'], 5);
  assert.equal(g.active, 'e');
  g = end(g);
  assert.equal(g.players[0].forces['arrakeen:10'], undefined);
  assert.equal(g.players[0].tanks, 1);
});
