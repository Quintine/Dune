import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BiddingEnd } from '../components/bidding-end';
import { EcazPoisonIncome } from '../components/ecaz-poison-income';
import { baseDeck, type Card } from '../game/cards';
import { botActions } from '../game/bots';
import {
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type GameView,
} from '../game/engine';
import {
  biddingEndActions,
  biddingEndDiscardChoice,
  choamMarketPolicy,
} from '../game/bidding-end-options';
import { tableActionOwner } from '../game/table-turn';

const value = (card: Card) => (card.kind === 'worthless' ? 0 : 10);

/** Projected-window fixtures exercise client privacy, policy and interaction
 * gates. Engine/recovery suites separately prove the persisted parent flow. */
function fixture(id = 'e'): GameView {
  const game = createGame(
    'BIDDINGCONTROLS',
    newPlayer('e', 'Emperor', 'emperor'),
    true,
    ['choam'],
  );
  joinGame(game, newPlayer('c', 'CHOAM', 'choam'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  game.status = 'playing';
  game.phase = 3;
  game.active = 'a';
  const cards = baseDeck();
  const hand = [
    cards.find((card) => card.kind === 'worthless')!,
    cards.find((card) => card.effect === 'karama')!,
  ];
  for (const player of game.players) {
    player.spice = 8;
    player.bot = 'Medium';
  }
  game.players[0].hand = hand;
  const view = viewGame(game, id);
  view.biddingEnd = {
    event: 'bidding-end-1',
    owners: ['e', 'c'],
    ready: [],
    canAct: id !== 'a',
    kaitain: { owner: 'e', eligible: true },
  };
  view.choamMarket = {
    owner: 'c',
    sales: id === 'c' ? [] : undefined,
    canTrade: false,
    tradeAttempted: false,
  };
  return view;
}

void test('Kaitain selection quotes physical cards and current personal affordability without mutation', () => {
  const view = fixture();
  const own = view.players[0];
  const before = structuredClone(view);
  const ids = own.hand!.map((card) => card.id);
  assert.deepEqual(biddingEndDiscardChoice(view, ids), {
    cost: 4,
    blocked: null,
    action: {
      type: 'biddingEnd',
      event: 'bidding-end-1',
      mode: 'discard',
      cards: ids,
    },
  });
  assert.deepEqual(view, before);
  for (const bad of [[], [ids[0], ids[0]], ['foreign-card']])
    assert.equal(biddingEndDiscardChoice(view, bad).action, null);
  own.spice = 3;
  assert.match(biddingEndDiscardChoice(view, ids).blocked!, /4 spice/);
  assert.ok(biddingEndDiscardChoice(view, [ids[0]]).action);
});

void test('Kaitain controls require the current owner, high population and quiet parent', () => {
  const view = fixture();
  const ids = [view.players[0].hand![0].id];
  for (const patch of [
    { decision: { kind: 'choamTradeReply', player: 'e' } },
    { response: { kind: 'choamSale', owner: 'c', passed: [] } },
    { automaticContinuationPending: true },
    { phase: 4 },
    { biddingEnd: { ...view.biddingEnd!, canAct: false } },
    {
      biddingEnd: {
        ...view.biddingEnd!,
        kaitain: { owner: 'e', eligible: false },
      },
    },
  ]) {
    const blocked = { ...view, ...patch } as GameView;
    assert.equal(biddingEndDiscardChoice(blocked, ids).action, null);
    assert.deepEqual(
      biddingEndActions(blocked, 1, value),
      blocked.biddingEnd?.kaitain?.eligible === false
        ? [
            {
              type: 'biddingEnd',
              event: blocked.biddingEnd.event,
              mode: 'ready',
            },
          ]
        : [],
    );
  }
  assert.equal(biddingEndDiscardChoice(fixture('a'), ids).action, null);
});

void test('all four Emperor policies preserve useful cards and finish optional paid discards', () => {
  for (let level = 0; level < 4; level++) {
    const view = fixture();
    const own = view.players[0];
    own.bot = (['Easy', 'Medium', 'Hard', 'Brutal'] as const)[level];
    const choices = botActions(view);
    assert.equal(choices[0]?.type, 'biddingEnd');
    assert.equal(choices[0]?.mode, 'discard');
    assert.deepEqual(choices[0].cards, [own.hand![0].id]);
    own.hand = own.hand!.slice(1);
    assert.deepEqual(botActions(view), [
      { type: 'biddingEnd', event: view.biddingEnd!.event, mode: 'ready' },
    ]);
    view.biddingEnd!.ready = ['e'];
    assert.deepEqual(botActions(view), []);
  }
});

void test('a ready Emperor may use a newly acquired card and low spice does not cause an invalid discard loop', () => {
  const view = fixture();
  view.biddingEnd!.ready = ['e'];
  assert.equal(botActions(view)[0]?.mode, 'discard');
  view.players[0].spice = 1;
  assert.deepEqual(botActions(view), []);
  assert.equal(
    biddingEndDiscardChoice(view, [view.players[0].hand![0].id]).action,
    null,
  );
  view.biddingEnd!.ready = [];
  assert.equal(botActions(view)[0]?.mode, 'ready');
});

void test('CHOAM shared policies retain duplicate-sale priority and current event over the old decision action', () => {
  const view = fixture('c');
  const card = baseDeck().find((card) => card.kind === 'worthless')!;
  view.players[1].hand = [card];
  view.choamMarket!.sales = [
    { card: card.id, price: 2, witness: undefined },
    { card: card.id, price: 3, witness: 'duplicate-witness' },
  ];
  for (let level = 0; level < 4; level++) {
    view.players[1].bot = (['Easy', 'Medium', 'Hard', 'Brutal'] as const)[
      level
    ];
    assert.deepEqual(botActions(view), [
      {
        type: 'biddingEnd',
        event: view.biddingEnd!.event,
        mode: 'sell',
        card: card.id,
        witness: 'duplicate-witness',
      },
    ]);
  }
  assert.equal(choamMarketPolicy(view, value, card.id).done, true);
  view.choamMarket!.sales = [];
  assert.equal(botActions(view)[0]?.mode, 'ready');
});

void test('CHOAM offers only current private cards and a declined trade does not repeat forever', () => {
  const view = fixture('c');
  const worthless = baseDeck().find((card) => card.kind === 'worthless')!;
  view.players[1].hand = [worthless];
  view.choamMarket!.canTrade = true;
  assert.deepEqual(biddingEndActions(view, 1, value), [
    {
      type: 'biddingEnd',
      event: view.biddingEnd!.event,
      mode: 'trade',
      card: worthless.id,
    },
  ]);
  view.choamMarket!.tradeAttempted = true;
  assert.equal(biddingEndActions(view, 1, value)[0].mode, 'ready');
  view.biddingEnd!.ready = ['c'];
  assert.deepEqual(biddingEndActions(view, 1, value), []);
});

void test('shared end-of-Bidding helpers and policies never inspect rival private hands or spice', () => {
  for (const id of ['e', 'c']) {
    const view = fixture(id);
    const expected = botActions(view);
    for (const player of view.players.filter((player) => player.id !== view.me))
      for (const key of ['hand', 'spice', 'traitors', 'faceDancers'])
        Object.defineProperty(player, key, {
          get() {
            throw new Error('Private rival data read');
          },
        });
    assert.deepEqual(botActions(view), expected);
    const own = view.players.find((player) => player.id === id)!;
    biddingEndDiscardChoice(view, own.hand?.map((card) => card.id) ?? []);
  }
});

void test('end-Bidding component labels optional readiness and privately inspectable Kaitain cards', () => {
  const view = fixture();
  const html = renderToStaticMarkup(
    createElement(BiddingEnd, { game: view, act: () => {}, busy: false }),
  );
  assert.match(html, /aria-label="End of Bidding"/);
  assert.match(html, /Emperor: Choosing/);
  assert.match(html, /CHOAM: Choosing/);
  for (const card of view.players[0].hand!) {
    assert.ok(html.includes(`Inspect card: ${card.name}`));
    assert.ok(html.includes(`Discard ${card.name} for 2 spice`));
  }
  assert.match(html, /Pay 0 spice and discard 0 cards/);
  assert.match(html, /Ready for Revival/);
  assert.doesNotMatch(html, /undefined|NaN/);
  const spectator = renderToStaticMarkup(
    createElement(BiddingEnd, {
      game: fixture('a'),
      act: () => {},
      busy: false,
    }),
  );
  assert.doesNotMatch(
    spectator,
    /Inspect card:|Discard .* for 2 spice|Ready for Revival/,
  );
});

void test('the turn banner names a sole unready owner and gives nested decisions precedence', () => {
  const view = fixture();
  assert.equal(tableActionOwner(view), null);
  view.biddingEnd!.ready = ['c'];
  assert.equal(tableActionOwner(view), 'e');
  view.decision = { kind: 'choamTradeReply', player: 'a' };
  assert.equal(tableActionOwner(view), 'a');
  view.response = { kind: 'choamSale', owner: 'c', passed: [] };
  assert.equal(tableActionOwner(view), null);
});

void test('Ecaz income receipts remain private and readable after the Bidding window closes', () => {
  const view = fixture();
  view.players[0].faction = 'ecaz';
  view.homeworlds = { worlds: [] };
  view.biddingEnd = null;
  view.phase = 4;
  view.ecazPoisonIncome = [{ turn: 2, phase: 3, count: 2, amount: 6 }];
  const render = () =>
    renderToStaticMarkup(createElement(EcazPoisonIncome, { game: view }));
  assert.match(render(), /Your Ecaz poison income/);
  assert.match(
    render(),
    /Turn 2 · Bidding: \+6 spice from 2 discarded poison weapons/,
  );
  view.me = 'c';
  assert.doesNotMatch(
    render(),
    /Your Ecaz poison income|discarded poison weapons/,
  );
  view.me = 'e';
  view.ecazPoisonIncome = [];
  assert.doesNotMatch(render(), /Your Ecaz poison income/);
});
