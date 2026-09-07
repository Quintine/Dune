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
import { ixSpecialCards, baseDeck } from '../game/cards';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTechTokens } from '../game/tech-tokens';
const amal = ixSpecialCards().find((c) => c.effect === 'amal')!;
function fixture(fremen = false) {
  let g = createGame('AMALTEST2', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  if (fremen) joinGame(g, newPlayer('f', 'Fremen', 'fremen'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  for (const p of g.players)
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  if (fremen)
    g = applyAction(g, 'f', {
      type: 'fremenSetup',
      placements: { sietch_tabr: 10 },
    });
  g.expansions = ['ix'];
  g.phase = 7;
  g.turn = 2;
  g.storm = 18;
  for (const p of g.players) {
    p.hand = [];
    p.spice = 9;
    p.forces = {};
    p.reserves = 20;
  }
  g.players[0].hand = [amal];
  return g;
}
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
const play = (g: Game, id = 'a', card = amal.id) =>
  applyAction(g, id, { type: 'card', card });
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
void test('Amal halves available spice with upward losses before Mentat bribes are collected', () => {
  const before = fixture();
  before.players[0].spice = 5;
  before.players[1].spice = 8;
  before.players[0].bribes = 7;
  let g = ready(before);
  assert.equal(g.phase, 8);
  assert.ok(g.phaseOpening);
  assert.equal(g.players[0].spice, 5);
  assert.equal(g.players[0].bribes, 7);
  const snapshot = structuredClone(g);
  g = play(g);
  assert.deepEqual(snapshot.players[0].hand, [amal]);
  assert.equal(g.players[0].spice, 2);
  assert.equal(g.players[1].spice, 4);
  assert.equal(g.players[0].bribes, 7);
  assert.equal(g.discard.filter((c) => c.id === amal.id).length, 1);
  g = ready(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[0].spice, 9);
  assert.equal(g.players[0].bribes, 0);
  assert.equal(g.phaseOpening, null);
  assert.throws(() => play(g));
});
void test('collection and even an empty battle phase wait for their own opening passes', () => {
  const before = fixture();
  before.phase = 5;
  before.active = 'a';
  before.order = ['a', 'e'];
  before.movementRemaining = ['a'];
  before.players[0].shipped = true;
  before.players[0].moved = 1;
  before.players[0].forces = { 'hagga_basin:12': 2 };
  before.players[0].reserves = 18;
  before.spice = { 'hagga_basin:12': 6 };
  let g = applyAction(before, 'a', { type: 'endMovement' });
  assert.equal(g.phase, 6);
  assert.ok(g.phaseOpening);
  assert.equal(g.players[0].spice, 9);
  g = ready(g);
  assert.equal(g.phase, 7);
  assert.ok(g.phaseOpening);
  assert.equal(g.spice['hagga_basin:12'], 6);
  g = play(g);
  assert.equal(g.players[0].spice, 4);
  g = ready(g);
  assert.equal(g.players[0].spice, 8);
  assert.equal(g.spice['hagga_basin:12'], 2);
});
void test('bidding opening precedes deck draws and income reactions', () => {
  const before = fixture();
  before.phase = 2;
  let g = ready(before);
  assert.equal(g.phase, 3);
  assert.equal(g.auction, null);
  assert.deepEqual(g.deck, before.deck);
  assert.equal(g.response, null);
  assert.throws(
    () => applyAction(g, 'a', { type: 'bid', amount: 1 }),
    /phase opening/,
  );
  g = ready(play(g));
  assert.ok(g.auction);
  assert.equal(g.deck.length, before.deck.length - 2);
});
void test('shipping opening blocks free-revival cards and precedes Atreides foresight', () => {
  const before = fixture();
  before.phase = 4;
  let g = ready(before);
  assert.equal(g.phase, 5);
  assert.equal(g.response, null);
  assert.equal(g.movementRemaining, null);
  assert.throws(
    () =>
      applyAction(g, 'a', {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 1,
      }),
    /phase opening/,
  );
  g = ready(play(g));
  assert.equal(g.response, null);
  assert.ok(viewGame(g, 'a').spicePeek);
  assert.equal(viewGame(g, 'e').spicePeek, null);
  assert.deepEqual(g.movementRemaining, ['a', 'e']);
});
void test('previous-phase tech income is paid before Amal affects the new phase', () => {
  const before = fixture();
  before.phase = 4;
  before.techTokens = createTechTokens();
  before.techTokens.axlotl = { owner: 'a', spice: 2 };
  let g = ready(before);
  assert.equal(g.players[0].spice, 11);
  assert.equal(g.techTokens?.axlotl.spice, 0);
  g = play(g);
  assert.equal(g.players[0].spice, 5);
});
void test('unused shipment aid returns to its donor before phase-opening Amal', () => {
  const before = fixture();
  before.phase = 5;
  before.active = 'a';
  before.movementRemaining = ['a'];
  before.players[0].shipped = true;
  before.players[0].moved = 1;
  before.aid = { a: { recipient: 'e', amount: 4 } };
  let g = applyAction(before, 'a', { type: 'endMovement' });
  assert.equal(g.players[0].spice, 13);
  assert.deepEqual(g.aid, {});
  g = play(g);
  assert.equal(g.players[0].spice, 6);
});
void test('zero/one spice become zero and charity remains available after the opening', () => {
  const before = fixture();
  before.phase = 2;
  before.phaseOpening = { passed: [], initialize: true };
  before.players[0].spice = 0;
  before.players[1].spice = 1;
  let g = ready(play(before));
  assert.deepEqual(
    g.players.map((p) => p.spice),
    [0, 0],
  );
  g = applyAction(g, 'a', { type: 'charity' });
  assert.equal(g.players[0].spice, 2);
});
void test('first-storm opening is created by setup and Spice Blow receives a separate opening', () => {
  let g = fixture();
  g.status = 'setup';
  g.turn = 1;
  g.phase = 0;
  g.players[0].traitorChoices = ['emperor-0'];
  g = applyAction(g, 'a', { type: 'traitor', leader: 'emperor-0' });
  assert.ok(g.phaseOpening);
  assert.equal(g.stormPending, null);
  assert.throws(
    () => applyAction(g, 'a', { type: 'stormDial', amount: 0 }),
    /phase opening/,
  );
  g = ready(g);
  for (const p of g.players)
    g = applyAction(g, p.id, { type: 'stormDial', amount: 0 });
  g = ready(g);
  assert.equal(g.phase, 1);
  assert.ok(g.phaseOpening);
  const deck = structuredClone(g.spiceDeck);
  g = ready(g);
  assert.deepEqual(g.spiceDeck, deck);
});
void test('new-turn opening precedes storm-card reveal and per-turn leader reset', () => {
  const before = fixture();
  before.phase = 8;
  before.players[0].leaders[0].usedAt = 'arrakeen';
  let g = ready(before);
  assert.equal(g.turn, 3);
  assert.equal(g.phase, 0);
  assert.ok(g.phaseOpening);
  assert.equal(g.players[0].leaders[0].usedAt, 'arrakeen');
  g = ready(g);
  assert.equal(g.players[0].leaders[0].usedAt, undefined);
});
void test('opening is public without hinting at Amal holdings; plays reset passes without exposing spice', () => {
  let g = ready(fixture());
  const noCard = structuredClone(g);
  noCard.players[0].hand = [];
  assert.deepEqual(viewGame(g, 'e'), viewGame(noCard, 'e'));
  g = applyAction(g, 'e', { type: 'ready' });
  assert.throws(() => applyAction(g, 'e', { type: 'ready' }), /already passed/);
  g = play(g);
  assert.deepEqual(g.phaseOpening?.passed, []);
  assert.equal(viewGame(g, 'a').players[1].spice, undefined);
  assert.doesNotMatch(g.log.at(-1)!.text, /\b(?:9|4)\b/);
});
void test('Amal rejects wrong holders, late play and invalid modes without modifying state', () => {
  const g = ready(fixture());
  const snapshot = structuredClone(g);
  assert.throws(() => play(g, 'e'), /phase opening/);
  assert.throws(
    () => applyAction(g, 'a', { type: 'card', card: amal.id, mode: 'special' }),
    /phase opening/,
  );
  assert.deepEqual(g, snapshot);
  assert.throws(() => play(ready(g)), /timing/);
  const passed = applyAction(g, 'a', { type: 'ready' });
  assert.throws(() => play(passed), /already passed/);
});
void test('all four AI levels pass openings legally using only their own spice', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = ready(fixture());
    g.players[0].bot = difficulty;
    g.players[0].spice = 0;
    const view = viewGame(g, 'a');
    const choices = botActions(view);
    assert.ok(choices.length > 0);
    assert.doesNotThrow(() => applyAction(g, 'a', choices[0]));
    const privateChanged = structuredClone(g);
    privateChanged.players[1].spice = 500;
    assert.deepEqual(botActions(viewGame(privateChanged, 'a')), choices);
    g.players[0].hand = [];
    assert.deepEqual(botActions(viewGame(g, 'a')), [{ type: 'ready' }]);
  }
});
void test('Hard and Brutal finish games with all nine phase openings and conserved Amal inventory', () => {
  for (const difficulty of ['Hard', 'Brutal'] as const) {
    let g = fixture();
    g.phase = 0;
    g.turn = 1;
    g.phaseOpening = { passed: [], initialize: false };
    g.players[0].forces = { 'arrakeen:10': 10 };
    g.players[0].reserves = 10;
    g.players.forEach((p) => (p.bot = difficulty));
    for (let i = 0; i < 120 && g.status !== 'finished'; i++) {
      g = runBots(g);
      assert.ok(
        g.botsPending || g.status === 'finished',
        JSON.stringify({
          phase: g.phase,
          opening: g.phaseOpening,
          response: g.response,
          decision: g.decision,
        }),
      );
      assert.equal(
        [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)].filter(
          (c) => c.id === amal.id,
        ).length,
        1,
      );
      for (const p of g.players) {
        assert.equal(
          p.reserves +
            p.tanks +
            Object.values(p.forces).reduce((a, b) => a + b, 0),
          20,
        );
        assert.ok(p.spice >= 0);
      }
    }
    assert.equal(g.status, 'finished', difficulty);
  }
});

void test('Amal preserves the pending Fremen forecast response; Thumper follows the opening before a draw', () => {
  const before = fixture(true);
  before.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  before.advanced = true;
  before.phase = 0;
  before.stormPending = 0;
  const thumper = ixSpecialCards().find((c) => c.effect === 'thumper')!;
  before.players[0].hand.push(thumper);
  let g = ready(before);
  assert.equal(g.phase, 1);
  assert.ok(g.phaseOpening);
  assert.equal(g.response?.kind, 'stormPeek');
  const forecast = g.stormCard;
  const deck = structuredClone(g.spiceDeck);
  g = play(JSON.parse(JSON.stringify(g)));
  g = ready(g);
  assert.equal(g.stormCard, forecast);
  assert.equal(g.response?.kind, 'stormPeek');
  assert.deepEqual(g.spiceDeck, deck);
  g = allow(g);
  assert.equal(g.stormCardKnown, true);
  assert.doesNotThrow(() => play(g, 'a', thumper.id));
});
