import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  handLimit,
  type Game,
} from '../game/engine';
import { baseDeck, treacheryDeck } from '../game/cards';
import { createTechTokens } from '../game/tech-tokens';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function fixture(advanced = false, ix = false) {
  const g = createGame(
    'CHOAM222',
    newPlayer('c', 'CHOAM', 'choam'),
    advanced,
    ix ? ['choam', 'ix'] : ['choam'],
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 1;
  g.nexus = true;
  g.order = ['c', 'e', 'b'];
  g.deck = ix ? treacheryDeck(['ix']) : baseDeck();
  g.players.forEach((p) => {
    p.spice = 0;
    p.traitors = p.leaders.length ? [p.leaders[0].id] : [];
    p.traitorChoices = [];
  });
  return g;
}
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  while (g.decision?.kind === 'choamMarket')
    g = applyAction(g, g.decision.player, { type: 'decision', done: true });
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response) {
    const p = g.players.find(
      (p) =>
        !viewGame(g, p.id).responseControls?.hasPassed &&
        !!viewGame(g, p.id).responseControls?.cancelCards.length,
    )!;
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function hold(g: Game, id: string, effect: string) {
  const i = g.deck.findIndex((c) => c.effect === effect);
  assert.ok(i >= 0);
  const card = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card;
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
void test('CHOAM receives two spice per faction, including itself, only after its opening response', () => {
  const initial = contest(fixture());
  let g = ready(initial);
  assert.equal(g.phase, 2);
  assert.equal(g.response?.kind, 'choamCharity');
  assert.equal(g.players[0].spice, 0);
  assert.throws(
    () => applyAction(g, 'e', { type: 'charity' }),
    /response|power/i,
  );
  assert.throws(
    () => applyAction(g, 'e', { type: 'ready' }),
    /response|power/i,
  );
  g = allow(g);
  assert.equal(g.players[0].spice, 6);
  assert.deepEqual(g.choamCharity, { turn: 1, canceled: false });
  assert.equal(initial.players[0].spice, 0);
});
void test('CHOAM pays ordinary charity by actual need and advanced Bene Gesserit a full two spice', () => {
  for (const advanced of [false, true])
    for (const starting of [0, 1]) {
      let g = allow(ready(fixture(advanced)));
      g.players[1].spice = starting;
      g.players[2].spice = starting;
      g = applyAction(g, 'e', { type: 'charity' });
      assert.equal(g.players[1].spice, 2);
      assert.equal(g.players[0].spice, 6 - (2 - starting));
      g = applyAction(g, 'b', { type: 'charity' });
      assert.equal(g.players[2].spice, advanced ? starting + 2 : 2);
      assert.equal(
        g.players.reduce((n, p) => n + p.spice, 0),
        6 + 2 * starting,
      );
      assert.throws(
        () => applyAction(g, 'b', { type: 'charity' }),
        /once per turn|fewer than/,
      );
    }
});
void test('wealthy Bene Gesserit payment waits for its response; cancellation never charges CHOAM', () => {
  for (const canceled of [false, true]) {
    let g = allow(ready(fixture(true)));
    contest(g);
    g.players[2].spice = 12;
    g = applyAction(g, 'b', { type: 'charity' });
    assert.equal(g.response?.kind, 'bgCharity');
    assert.equal(g.players[0].spice, 6);
    g = canceled ? cancel(g) : allow(g);
    assert.equal(g.players[0].spice, canceled ? 6 : 4);
    assert.equal(g.players[2].spice, canceled ? 12 : 14);
    assert.equal(viewGame(g, 'b').players[2].charityClaimed, true);
  }
});
void test('Karama cancels CHOAM income, restores bank payments and permits CHOAM ordinary charity', () => {
  let g = cancel(ready(contest(fixture(true))));
  assert.equal(g.players[0].spice, 0);
  assert.deepEqual(g.choamCharity, { turn: 1, canceled: true });
  for (const id of ['c', 'e', 'b']) g = applyAction(g, id, { type: 'charity' });
  assert.deepEqual(
    g.players.map((p) => p.spice),
    [2, 2, 2],
  );
  assert.equal(viewGame(g, 'e').charity.payer, null);
  assert.equal(viewGame(g, 'c').charity.incomeCanceled, true);
});
void test('income cancellation expires on the next turn and the next opening pays exactly once', () => {
  let g = cancel(ready(contest(fixture())));
  g.turn++;
  g.phase = 1;
  g.nexus = true;
  g = allow(ready(g));
  assert.equal(g.players[0].spice, 6);
  assert.equal(g.choamCharity?.canceled, false);
  g = ready(g);
  assert.equal(g.phase, 3);
  assert.equal(g.players[0].spice, 6);
});
void test('Ix phase opening resolves before CHOAM income and survives JSON persistence', () => {
  let g = ready(contest(fixture(false, true)));
  assert.equal(g.phaseOpening?.initialize, true);
  assert.equal(g.response, null);
  const amal = hold(g, 'c', 'amal');
  g.players[0].spice = 9;
  g = applyAction(g, 'c', { type: 'card', card: amal.id });
  assert.equal(g.players[0].spice, 4);
  g = JSON.parse(JSON.stringify(g)) as Game;
  g = ready(g);
  assert.equal(g.response?.kind, 'choamCharity');
  g = allow(g);
  assert.equal(g.players[0].spice, 10);
});
void test('a canceled Bene Gesserit Worthless conversion restores the pending CHOAM income response', () => {
  let g = contest(fixture(true), 2);
  const worthless = g.deck.find((c) => c.kind === 'worthless')!;
  g.deck = g.deck.filter((c) => c.id !== worthless.id);
  g.players[2].hand.push(worthless);
  g.players[2].hand.push(
    g.deck.splice(
      g.deck.findIndex((card) => card.kind === 'worthless'),
      1,
    )[0],
  );
  g = ready(g);
  g = applyAction(g, 'e', { type: 'passResponse' });
  g = applyAction(g, 'b', { type: 'card', card: worthless.id, mode: 'cancel' });
  assert.equal(g.response?.kind, 'worthlessKarama');
  g = cancel(g);
  assert.equal(g.response?.kind, 'choamCharity');
  assert.deepEqual(g.response?.passed, ['e']);
  assert.deepEqual(viewGame(g, 'c').response?.passed, []);
  assert.deepEqual(viewGame(g, 'b').response?.passed, []);
  assert.deepEqual(viewGame(g, 'e').response?.passed, ['e']);
  assert.deepEqual(viewGame(g, 'c').responseControls?.cancelCards, []);
  assert.deepEqual(
    viewGame(g, 'b').responseControls?.cancelCards,
    g.players[2].hand.map((card) => card.id),
  );
  g = allow(g);
  assert.equal(g.players[0].spice, 6);
});
void test('charity projections expose the payer and own entitlement without leaking opponent wealth', () => {
  const g = allow(ready(fixture()));
  const v = viewGame(g, 'e');
  assert.deepEqual(v.charity, {
    ordinary: 2,
    homeworld: 0,
    total: 2,
    multiplier: 1,
    amount: 2,
    payer: 'c',
    incomePending: false,
    incomeCanceled: false,
  });
  assert.equal(v.players[0].spice, undefined);
  assert.equal(v.players[0].handLimit, 5);
  assert.equal(v.players[0].charityClaimed, undefined);
});
void test('ordinary funded claims still accrue and settle Spice Production once', () => {
  let g = fixture(true);
  g.techTokens = createTechTokens();
  g.techTokens.production.owner = 'e';
  g = allow(ready(g));
  g = applyAction(g, 'b', { type: 'charity' });
  assert.equal(g.techTokens!.production.spice, 0);
  g = applyAction(g, 'e', { type: 'charity' });
  assert.equal(g.techTokens!.production.spice, 1);
  g = ready(g);
  assert.equal(g.players[1].spice, 3);
  assert.equal(g.techTokens!.production.spice, 0);
});
void test('unresolved insolvency fails atomically without minted spice or negative balances', () => {
  let g = allow(ready(fixture()));
  g = applyAction(g, 'c', { type: 'bribe', target: 'e', amount: 6 });
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'b', { type: 'charity' }), /cannot fund/);
  assert.deepEqual(g, before);
});
void test('CHOAM can buy its fifth card, but a full five-card hand cannot take an auction with Karama', () => {
  let g = allow(ready(fixture()));
  const karama = hold(g, 'c', 'karama');
  g.players[0].hand.push(...g.deck.splice(0, 3));
  assert.equal(handLimit(g.players[0]), 5);
  g = ready(g);
  assert.ok(g.auction);
  g = applyAction(g, 'c', { type: 'bid', amount: 1 });
  g = applyAction(g, 'e', { type: 'passBid' });
  g = applyAction(g, 'b', { type: 'passBid' });
  assert.equal(g.decision?.kind, 'auctionPayment');
  g = allow(applyAction(g, 'c', { type: 'decision', karama: false }));
  assert.equal(g.players[0].hand.length, 5);
  assert.equal(g.players[0].spice, 5);
  assert.notEqual(g.auction!.active, 'c');
  assert.throws(
    () =>
      applyAction(g, 'c', { type: 'card', card: karama.id, mode: 'purchase' }),
    /hand|bid|full|available/i,
  );
  assert.equal(handLimit(newPlayer('h', 'Harkonnen', 'harkonnen')), 8);
  assert.equal(handLimit(newPlayer('e2', 'Emperor', 'emperor')), 4);
});
void test('all AI levels proceed after automatic CHOAM income and claim funded charity through private projections', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = ready(fixture(true));
    g.players.forEach((p) => {
      p.bot = difficulty;
    });
    while (g.response) {
      const p = g.players.find(
        (p) =>
          !viewGame(g, p.id).responseControls?.hasPassed &&
          !!viewGame(g, p.id).responseControls?.cancelCards.length,
      )!;
      const actions = botActions(viewGame(g, p.id));
      assert.ok(actions.length);
      g = applyAction(g, p.id, actions[0]);
    }
    for (const id of ['e', 'b']) {
      const actions = botActions(viewGame(g, id));
      assert.equal(actions[0].type, 'charity');
      g = applyAction(g, id, actions[0]);
    }
    assert.deepEqual(
      g.players.map((p) => p.spice),
      [2, 2, 2],
    );
  }
});
void test('Brutal AI can cancel enemy CHOAM income but preserves an ally’s income', () => {
  for (const allied of [false, true]) {
    const g = ready(contest(fixture()));
    if (allied) {
      g.players[1].ally = 'c';
      g.players[0].ally = 'e';
    }
    g.players[1].bot = 'Brutal';
    const action = botActions(viewGame(g, 'e'))[0];
    assert.equal(action.type, allied ? 'passResponse' : 'card');
    const result = applyAction(g, 'e', action);
    if (!allied) assert.equal(result.choamCharity?.canceled, true);
  }
});

void test('six-player CHOAM income pays twelve and can fund every other ordinary charity claim', () => {
  let g = fixture();
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    newPlayer('g', 'Guild', 'guild'),
  );
  g.players.forEach((p) => {
    p.spice = 0;
  });
  g.order = g.players.map((p) => p.id);
  g = allow(ready(g));
  assert.equal(g.players[0].spice, 12);
  for (const p of g.players.slice(1))
    g = applyAction(g, p.id, { type: 'charity' });
  assert.deepEqual(
    g.players.map((p) => p.spice),
    [2, 2, 2, 2, 2, 2],
  );
});
void test('expansion starts remain gated despite the new economy support', () => {
  const g = fixture();
  g.status = 'lobby';
  g.players.forEach((p) => {
    p.ready = true;
  });
  assert.throws(
    () => applyAction(g, 'c', { type: 'start' }),
    /expansion|implemented|ready|faction|validated/i,
  );
});
