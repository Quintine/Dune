import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  RuleError,
  type Game,
} from '../game/engine';
import { baseDeck, treacheryDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture() {
  const g = createGame('CASHIN22', newPlayer('c', 'CHOAM', 'choam'), true, [
    'choam',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 4;
  g.order = ['c', 'e', 'b'];
  g.deck = baseDeck();
  g.players.forEach((p) => {
    p.spice = 0;
    p.traitorChoices = [];
  });
  hold(g, 'c', 'Karama');
  hold(g, 'c', 'Baliset');
  hold(g, 'c', 'Snooper');
  return g;
}
function hold(g: Game, id: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const c = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(c);
  return c.id;
}
const activation = (g: Game) =>
  g.players[0].hand.find((c) => c.effect === 'karama')!.id;
const named = (g: Game, name: string) =>
  g.players[0].hand.find((c) => c.name === name)!.id;
const cash = (
  g: Game,
  cards = g.players[0].hand
    .filter((c) => c.effect !== 'karama')
    .map((c) => c.id),
) =>
  applyAction(g, 'c', {
    type: 'card',
    mode: 'special',
    card: activation(g),
    cards,
  });
const live = (g: Game) =>
  [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
function contest(g: Game, id = 'e') {
  hold(g, id, 'Karama');
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find(
        (p) =>
          !viewGame(g, p.id).responseControls?.hasPassed &&
          !!viewGame(g, p.id).responseControls?.cancelCards.length,
      )!.id,
      { type: 'passResponse' },
    );
  return g;
}
void test('CHOAM special Karama works in all nine phases, paying three per selected card and spending activation separately', () => {
  for (let phase = 0; phase < 9; phase++) {
    const initial = fixture();
    initial.phase = phase;
    const g = cash(initial);
    assert.equal(g.players[0].spice, 6);
    assert.equal(g.players[0].hand.length, 0);
    assert.equal(g.discard.length, 3);
    assert.equal(g.players[0].specialKaramaUsed, true);
    assert.deepEqual(live(g), live(initial));
    assert.equal(initial.players[0].spice, 0);
  }
});
void test('cash-in can discard a second Karama as an ordinary card', () => {
  const initial = fixture();
  const second = hold(initial, 'c', 'Karama');
  const g = cash(initial, [second]);
  assert.equal(g.players[0].spice, 3);
  assert.equal(g.players[0].hand.length, 2);
  assert.equal(g.discard.length, 2);
});
void test('invalid selections fail atomically: activation, duplicates, foreign IDs and an empty selection', () => {
  const g = fixture();
  const card = named(g, 'Baliset');
  const before = structuredClone(g);
  for (const cards of [[activation(g)], [card, card], ['missing'], []])
    assert.throws(() => cash(g, cards), RuleError);
  assert.deepEqual(g, before);
});
void test('the power requires advanced CHOAM, an actual Karama and an unused once-per-game ability', () => {
  let g = fixture();
  g.advanced = false;
  assert.throws(() => cash(g), /advanced/);
  g.advanced = true;
  g.status = 'setup';
  assert.throws(() => cash(g), /advanced/);
  g.status = 'playing';
  assert.throws(
    () =>
      applyAction(g, 'c', {
        type: 'card',
        mode: 'special',
        card: named(g, 'Baliset'),
        cards: [named(g, 'Snooper')],
      }),
    /Karama/,
  );
  const second = hold(g, 'c', 'Karama');
  g = cash(g, [named(g, 'Baliset')]);
  assert.ok(g.players[0].hand.some((c) => c.id === second));
  assert.throws(() => cash(g, [named(g, 'Snooper')]), /already been used/);
});
void test('an ongoing power response and its passed players survive immediate cash-in', () => {
  const g = fixture();
  hold(g, 'c', 'Karama'); // One activation remains available after cash-in.
  g.response = { kind: 'emperorIncome', owner: 'e', passed: ['b'], amount: 4 };
  const after = cash(g);
  assert.deepEqual(after.response, g.response);
  assert.equal(after.players[0].spice, 6);
});
void test('cash-in preserves phase-opening confirmations and its proceeds are then subject to Amal', () => {
  let g = fixture();
  g.expansions.push('ix');
  g.phaseOpening = { passed: ['e'], initialize: true };
  g = cash(g);
  assert.deepEqual(g.phaseOpening?.passed, ['e']);
  assert.equal(g.players[0].spice, 6);
  const amal = treacheryDeck(['ix']).find((c) => c.effect === 'amal')!;
  g.players[2].hand.push(amal);
  g = applyAction(g, 'b', { type: 'card', card: amal.id });
  assert.equal(g.players[0].spice, 3);
});
void test('cash-in can fund a declared revival without losing its pending response', () => {
  let g = fixture();
  contest(g);
  g.players[0].spice = 1;
  g.players[0].tanks = 1;
  g.players[0].reserves = 19;
  g = applyAction(g, 'c', { type: 'revive', amount: 1 });
  const pending = structuredClone(g.pendingRevival);
  g = cash(g);
  assert.deepEqual(g.pendingRevival, pending);
  assert.equal(g.response?.kind, 'choamRevival');
  g = allow(g);
  assert.equal(g.players[0].spice, 6);
  assert.equal(g.players[0].reserves, 20);
});
void test('selling a pending market card with special Karama prevents a second payout when that sale resumes', () => {
  let g = fixture();
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamMarket');
  contest(g);
  const worthless = named(g, 'Baliset');
  g = applyAction(g, 'c', { type: 'decision', mode: 'sell', card: worthless });
  g = cash(g, [worthless]);
  assert.equal(g.players[0].spice, 3);
  g = allow(g);
  assert.equal(g.players[0].spice, 3);
  assert.equal(g.decision?.kind, 'choamMarket');
});
void test('a pending allied exchange remains private and aborts if cash-in consumes the offer', () => {
  let g = fixture();
  g.players[0].ally = 'e';
  g.players[1].ally = 'c';
  const returned = hold(g, 'e', 'Shield');
  const offered = named(g, 'Snooper');
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = applyAction(g, 'c', { type: 'decision', mode: 'trade', card: offered });
  g = applyAction(g, 'e', { type: 'decision', card: returned });
  g = cash(g, [offered]);
  assert.equal(g.decision?.kind, 'choamTradeConfirm');
  g = applyAction(g, 'c', { type: 'decision', accept: true });
  assert.equal(g.choamTradeTurn, undefined);
  assert.equal(g.players[1].hand[0].id, returned);
  assert.equal(g.players[0].spice, 3);
});
void test('cash-in cannot strand a winning auction bid and counts only the committed allied payment', () => {
  let g = fixture();
  g.phase = 3;
  g.auction = {
    cards: [g.deck.shift()!],
    index: 0,
    bid: 10,
    bidder: 'c',
    active: 'e',
    passed: [],
    opener: 0,
    allyPayment: 1,
  };
  g.players[0].ally = 'e';
  g.players[1].ally = 'c';
  g.aid = { e: { recipient: 'c', amount: 9 } };
  assert.throws(() => cash(g), /honor your current/);
  g.auction.bid = 7;
  g = cash(g);
  assert.equal(g.players[0].spice, 6);
  assert.equal(g.auction?.bid, 7);
});
void test('sealed and prescience-committed cards cannot be cashed in or used as activation', () => {
  const g = fixture();
  const shield = named(g, 'Snooper');
  g.battle = {
    territory: 'arrakeen',
    attacker: 'c',
    defender: 'e',
    prepared: true,
    plans: {
      c: { dial: 0, support: 0, leader: null, weapon: null, defense: shield },
    },
    revealed: false,
    traitorCalls: {},
  };
  assert.throws(() => cash(g, [shield]), /uncommitted/);
  assert.ok(!viewGame(g, 'c').choamCashIn?.cards.some((c) => c.id === shield));
  g.battle.plans = {};
  g.battle.prescience = { player: 'e', field: 'defense', value: shield };
  assert.throws(() => cash(g, [shield]), /uncommitted/);
  g.battle.prescience.value = activation(g);
  assert.throws(() => cash(g, [named(g, 'Baliset')]), /uncommitted/);
});
void test('only CHOAM sees its cash-in choices; used status and state survive persistence', () => {
  let g = fixture();
  assert.ok(viewGame(g, 'c').choamCashIn?.karamas.length);
  assert.equal(viewGame(g, 'e').choamCashIn, null);
  assert.equal(viewGame(g, 'e').players[0].hand, undefined);
  g = JSON.parse(JSON.stringify(cash(g))) as Game;
  assert.equal(viewGame(g, 'c').choamCashIn, null);
  assert.equal(viewGame(g, 'e').players[0].specialKaramaUsed, true);
});
void test('all AI levels can turn unused Worthless cards into spendable spice once', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    g.players[0].bot = difficulty;
    const action = botActions(viewGame(g, 'c'))[0];
    assert.equal(action.mode, 'special');
    g = applyAction(g, 'c', action);
    assert.equal(g.players[0].spice, 3);
    assert.equal(g.players[0].hand[0].name, 'Snooper');
    assert.equal(g.players[0].specialKaramaUsed, true);
  }
});
void test('binding battle answers can depend on future CHOAM cash-in while retaining the promised defense', () => {
  let g = fixture();
  g.phase = 6;
  g.active = 'c';
  g.storm = 18;
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 6 };
    p.reserves = 14;
  }
  g.battle = {
    territory: 'arrakeen',
    attacker: 'c',
    defender: 'e',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  hold(g, 'c', 'Cheap Hero');
  const truth = hold(g, 'e', 'Truthtrance');
  g = applyAction(g, 'e', { type: 'card', card: truth });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = applyAction(g, 'e', {
    type: 'truthAsk',
    question: {
      kind: 'battlePlan',
      target: 'c',
      claim: {
        kind: 'and',
        terms: [
          { kind: 'support', compare: 'gte', value: 3 },
          { kind: 'defense', name: 'Snooper' },
        ],
      },
    },
  });
  assert.ok(viewGame(g, 'c').truthBattleAnswers?.includes('yes'));
  g = applyAction(g, 'c', { type: 'truthAnswer', answer: 'yes' });
  const v = viewGame(g, 'c');
  const preparation = v.battle!.compliantPreparation!.actions[0];
  assert.equal(preparation.mode, 'special');
  assert.deepEqual(preparation.cards, [named(g, 'Baliset')]);
  assert.equal(viewGame(g, 'e').battle!.compliantPreparation, null);
  for (const difficulty of DIFFICULTIES) {
    let trial = structuredClone(g);
    trial.players[0].bot = difficulty;
    const action = botActions(viewGame(trial, 'c'))[0];
    assert.equal(action.mode, 'special');
    trial = applyAction(trial, 'c', action);
    trial = applyAction(trial, 'c', botActions(viewGame(trial, 'c'))[0]);
    assert.ok(trial.battle!.plans.c.support >= 3);
  }
  g = applyAction(g, 'c', preparation);
  const plan = viewGame(g, 'c').battle!.compliantPlan!;
  assert.ok(plan.support >= 3);
  g = applyAction(g, 'c', { type: 'battlePlan', ...plan });
  assert.ok(g.battle!.plans.c);
});
