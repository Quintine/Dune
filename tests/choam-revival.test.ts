import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  forceRevivalQuote,
  forceRevivalLimit,
  newRevivalRules,
} from '../game/revival';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture(tleilaxu = false) {
  const g = createGame('CHOAMREV', newPlayer('c', 'CHOAM', 'choam'), false, [
    'choam',
    'ix',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  if (tleilaxu) g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.status = 'playing';
  g.phase = 4;
  g.order = g.players.map((p) => p.id);
  g.deck = baseDeck();
  g.revivalRules = newRevivalRules();
  g.players.forEach((p) => {
    p.spice = 40;
    p.tanks = 10;
    p.reserves = 10;
    p.traitorChoices = [];
  });
  return g;
}
function allow(state: Game, one = false) {
  let g = state;
  const kind = g.response?.kind;
  while (g.response && (!one || g.response.kind === kind)) {
    const p = g.players.find(
      (p) =>
        !viewGame(g, p.id).responseControls?.hasPassed &&
        !!viewGame(g, p.id).responseControls?.cancelCards.length,
    )!;
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function contest(g: Game, count = 1, id = 'e') {
  for (let n = 0; n < count; n++) {
    const index = g.deck.findIndex((card) => card.effect === 'karama');
    assert.ok(index >= 0);
    g.players.find((p) => p.id === id)!.hand.push(g.deck.splice(index, 1)[0]);
  }
  return g;
}
function cancel(g: Game) {
  const card = g.players
    .find((p) => p.id === 'e')!
    .hand.find((card) => card.effect === 'karama');
  assert.ok(card, 'canceller must hold Karama before the declaration');
  return applyAction(g, 'e', { type: 'card', card: card.id, mode: 'cancel' });
}
const revive = (g: Game, amount: number) =>
  applyAction(g, 'c', { type: 'revive', amount });
function grant(state: Game, discount = false) {
  let g = state;
  if (discount) {
    g.players[0].ally = 't';
    g.players[3].ally = 'c';
    g = applyAction(g, 't', { type: 'tleilaxuAllyDiscount' });
  } else g = applyAction(g, 't', { type: 'tleilaxuRevivalLimit', target: 'c' });
  return g;
}
function conserved(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((n, x) => n + x, 0),
      20,
    );
    assert.ok(p.spice >= 0);
  }
}
void test('CHOAM has zero free revival and can revive any number of available forces at one spice each', () => {
  for (const n of [1, 3, 4, 10, 20]) {
    let g = fixture();
    g.players[0].tanks = 20;
    g.players[0].reserves = 0;
    assert.equal(forceRevivalLimit(g, g.players[0]), 20);
    assert.deepEqual(forceRevivalQuote(g, g.players[0], n), {
      free: 0,
      normalCost: 2 * n,
      cost: n,
    });
    g = revive(g, n);
    assert.equal(g.response, null); // No opponent can cancel; payment is immediate.
    g = allow(g);
    assert.equal(g.players[0].spice, 40 - n);
    assert.equal(g.players[0].reserves, n);
    assert.equal(g.players[0].revived, n);
    conserved(g);
  }
});
void test('canceling a request within the standard allowance reprices before moving forces', () => {
  const g = cancel(revive(contest(fixture()), 3));
  assert.equal(g.revivalRules?.choamBlocked, true);
  assert.equal(g.players[0].spice, 34);
  assert.equal(g.players[0].reserves, 13);
  assert.equal(g.players[0].revived, 3);
  assert.equal(g.pendingRevival, null);
  assert.throws(() => revive(g, 1), /Forces/);
  conserved(g);
});
void test('canceling an oversized request makes no partial revival or payment and allows a smaller retry', () => {
  let g = cancel(revive(contest(fixture()), 8));
  assert.equal(g.players[0].spice, 40);
  assert.equal(g.players[0].tanks, 10);
  assert.equal(g.players[0].revived, 0);
  assert.equal(g.pendingRevival, null);
  g = revive(g, 2);
  assert.equal(g.response, null);
  assert.equal(g.players[0].spice, 36);
  g = revive(g, 1);
  assert.equal(g.players[0].spice, 34);
  conserved(g);
});
void test('an unaffordable cancellation consumes no forces, spice or allowance', () => {
  let g = fixture();
  g.players[0].spice = 3;
  g = cancel(revive(contest(g), 3));
  assert.equal(g.players[0].spice, 3);
  assert.equal(g.players[0].tanks, 10);
  assert.equal(g.players[0].revived, 0);
  g = revive(g, 1);
  assert.equal(g.players[0].spice, 1);
  conserved(g);
});
void test('CHOAM cancellation preserves Tleilaxu unlimited revival and independent five-force permission', () => {
  let g = cancel(revive(contest(grant(fixture(true)), 2), 5));
  assert.equal(g.response?.kind, 'revivalLimit');
  assert.equal(g.response?.owner, 't');
  assert.equal(forceRevivalLimit(g, g.players[3]), 20);
  assert.equal(forceRevivalLimit(g, g.players[0]), 5);
  g = allow(g);
  assert.equal(g.players[0].spice, 30);
  assert.equal(g.players[3].spice, 50);
  assert.equal(g.players[0].revived, 5);
  conserved(g);
});
void test('Tleilaxu five-force permission can itself be canceled after CHOAM cancellation', () => {
  let g = cancel(revive(contest(grant(fixture(true)), 2), 5));
  g = cancel(g);
  assert.equal(g.revivalRules?.choamBlocked, true);
  assert.equal(g.revivalRules?.limitBlocked, true);
  assert.equal(forceRevivalLimit(g, g.players[0]), 3);
  assert.equal(g.players[0].revived, 0);
  assert.equal(g.players[0].spice, 40);
  conserved(g);
});
void test('canceling Tleilaxu expanded revival does not cancel CHOAM native unlimited revival', () => {
  let g = fixture(true);
  g = applyAction(g, 't', { type: 'tleilaxuRevivalLimit', target: 'b' });
  contest(g);
  g = applyAction(g, 'b', { type: 'revive', amount: 4 });
  g = applyAction(g, 'c', { type: 'decision', decline: true });
  g = cancel(g);
  assert.equal(forceRevivalLimit(g, g.players[0]), 20);
  g = allow(revive(g, 8));
  assert.equal(g.players[0].spice, 32);
  assert.equal(g.players[0].revived, 8);
  conserved(g);
});
void test('Tleilaxu allied discount is separate from CHOAM price and transfers only actual payment', () => {
  let g = contest(grant(fixture(true), true));
  assert.equal(forceRevivalQuote(g, g.players[0], 5).cost, 3);
  g = allow(revive(g, 5), true);
  assert.equal(g.response?.kind, 'revivalDiscount');
  assert.equal(g.response?.owner, 't');
  g = allow(g);
  assert.equal(g.players[0].spice, 37);
  assert.equal(g.players[3].spice, 43);
  conserved(g);
});
void test('canceling the allied discount retains CHOAM one-spice price and unlimited allowance', () => {
  let g = allow(revive(contest(grant(fixture(true), true)), 5), true);
  g = allow(cancel(g));
  assert.equal(g.players[0].spice, 35);
  assert.equal(g.players[3].spice, 45);
  assert.equal(forceRevivalLimit(g, g.players[0]), 20);
  conserved(g);
});
void test('repricing CHOAM can introduce a meaningful Tleilaxu discount response for a one-force request', () => {
  let g = cancel(revive(contest(grant(fixture(true), true), 2), 1));
  assert.equal(g.response?.kind, 'revivalDiscount');
  assert.equal(g.players[0].spice, 40);
  g = allow(g);
  assert.equal(g.players[0].spice, 39);
  assert.equal(g.players[3].spice, 41);
  conserved(g);
});
void test('Fremen free allowance is retained and a completely free standard request needs no CHOAM response', () => {
  let g = fixture();
  g.players.push(newPlayer('f', 'Fremen', 'fremen'));
  g.players[0].ally = 'f';
  g.players[3].ally = 'c';
  g = applyAction(g, 'f', { type: 'grantRevival' });
  g = revive(g, 3);
  assert.equal(g.response, null);
  assert.equal(g.players[0].spice, 40);
  g = allow(revive(g, 4));
  assert.equal(g.players[0].spice, 36);
  assert.equal(g.players[0].revived, 7);
  conserved(g);
});
void test('Emperor extra revival still uses the Emperor price and separate allowance', () => {
  let g = fixture();
  g.players[0].ally = 'e';
  g.players[1].ally = 'c';
  g = applyAction(g, 'e', { type: 'emperorRevival', amount: 3 });
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(g.players[0].spice, 40);
  assert.equal(g.players[1].spice, 34);
  assert.equal(g.players[0].revived, 0);
  assert.equal(g.emperorExtra.c, 3);
  conserved(g);
});
void test('CHOAM price cancellation resets when the next Revival phase opens', () => {
  let g = cancel(revive(contest(fixture()), 1));
  g.turn++;
  g.phase = 3;
  g.auction = null;
  g.expansions = [];
  // Enter Revival through the real empty-auction phase transition.
  g.phase = 2;
  for (const p of g.players) {
    p.hand = [];
    p.spice = 0;
  }
  g.deck = [];
  g.discard = [];
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  while (g.decision?.kind === 'choamMarket')
    g = applyAction(g, g.decision.player, { type: 'decision', done: true });
  assert.equal(g.phase, 4);
  assert.equal(g.revivalRules?.choamBlocked, undefined);
  assert.equal(forceRevivalLimit(g, g.players[0]), 20);
  assert.equal(g.players[0].revived, 0);
});
void test('all AI levels revive within their budget with native and canceled CHOAM prices', () => {
  for (const difficulty of DIFFICULTIES)
    for (const blocked of [false, true]) {
      let g = fixture();
      g.players[0].bot = difficulty;
      g.players[0].spice = 12;
      g.revivalRules!.choamBlocked = blocked;
      const v = viewGame(g, 'c');
      assert.equal(v.revival.choamBlocked, blocked);
      const action = botActions(v).find((a: Action) => a.type === 'revive');
      assert.ok(action, difficulty);
      g = allow(applyAction(g, 'c', action));
      assert.equal(
        g.players[0].spice,
        12 - Number(action.amount) * (blocked ? 2 : 1),
      );
      assert.ok(g.players[0].revived <= (blocked ? 3 : 20));
      conserved(g);
    }
});

void test('cancellation after earlier revival preserves completed forces but prevents exceeding the new total allowance', () => {
  let g = allow(revive(fixture(), 6));
  g = cancel(revive(contest(g), 2));
  assert.equal(g.players[0].reserves, 16);
  assert.equal(g.players[0].revived, 6);
  assert.equal(g.players[0].spice, 34);
  assert.throws(() => revive(g, 1), /Forces/);
  conserved(g);
});
void test('advanced Tleilaxu prevention precedes the CHOAM price response and can cancel the entire normal revival', () => {
  for (const prevent of [false, true]) {
    let g = fixture(true);
    g.advanced = true;
    const card = g.deck.find((c) => c.effect === 'karama')!;
    g.deck = g.deck.filter((c) => c.id !== card.id);
    g.players[3].hand.push(card);
    g = revive(g, 5);
    assert.equal(g.decision?.kind, 'revivalStop');
    assert.equal(g.response, null);
    if (prevent) {
      g = applyAction(g, 't', { type: 'card', mode: 'special', card: card.id });
      assert.equal(g.pendingRevival, null);
      assert.equal(g.players[0].revived, 0);
      assert.equal(g.players[0].spice, 40);
      assert.throws(() => revive(g, 1), /prevented/);
    } else {
      g = applyAction(g, 't', { type: 'decision', decline: true });
      assert.equal(g.response?.kind, 'choamRevival');
      g = allow(g);
      assert.equal(g.players[0].spice, 35);
      assert.equal(g.players[3].spice, 45);
    }
    conserved(g);
  }
});
void test('a pending CHOAM revival survives reconnect without exposing another player’s spice', () => {
  let g = revive(contest(fixture()), 7);
  g = JSON.parse(JSON.stringify(g)) as Game;
  const v = viewGame(g, 'e');
  assert.equal(v.response?.owner, 'c');
  assert.equal(v.players[0].spice, undefined);
  assert.equal(v.players[0].hand, undefined);
  g = allow(g);
  assert.equal(g.players[0].revived, 7);
  assert.equal(g.players[0].spice, 33);
  conserved(g);
});
