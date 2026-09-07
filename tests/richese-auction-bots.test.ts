import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import type { RicheseAuctionMethod } from '../game/richese-auction';

type Difficulty = (typeof DIFFICULTIES)[number];
function fixture(advanced = false) {
  const g = createGame('RICHESEBOTS', newPlayer('r', 'Richese', 'richese'));
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('f', 'Fremen', 'fremen'),
  );
  g.status = 'playing';
  g.phase = 2;
  g.turn = 2;
  g.advanced = advanced;
  g.order = ['e', 'f', 'r'];
  g.active = null;
  g.ready = [];
  g.deck = baseDeck();
  g.richeseCache = richeseCards();
  for (const p of g.players) {
    p.hand = [];
    p.spice = 12;
    p.bot = undefined;
    p.forces = {};
    p.traitors = [];
  }
  return g;
}
function begin(g: Game) {
  for (const id of g.order) g = applyAction(g, id, { type: 'ready' });
  assert.equal(g.phase, 3);
  return g;
}
function projected(g: Game, id: string, difficulty: Difficulty) {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = difficulty;
  return view;
}
function drive(
  g: Game,
  difficulty: Difficulty,
  until: (g: Game) => boolean,
  limit = 100,
) {
  for (let i = 0; !until(g) && i < limit; i++) {
    let moved = false;
    for (const p of g.players) {
      const before = structuredClone(g);
      const actions = botActions(projected(g, p.id, difficulty));
      assert.deepEqual(g, before, 'policy is read-only');
      if (!actions.length) continue;
      g = applyAction(g, p.id, actions[0]);
      moved = true;
      break;
    }
    assert.ok(
      moved,
      `${difficulty}: no legal continuation at ${g.decision?.kind ?? g.richeseAuction?.method ?? g.phase}`,
    );
    g = JSON.parse(JSON.stringify(g)) as Game;
  }
  assert.ok(until(g), `${difficulty}: finite completion`);
  return g;
}
function offer(
  method: RicheseAuctionMethod,
  source: 'cache' | 'blackMarket',
  advanced = false,
) {
  let g = fixture(advanced);
  if (source === 'blackMarket')
    g.players[0].hand.push(
      g.deck.splice(
        g.deck.findIndex((c) => c.kind === 'shield'),
        1,
      )[0],
    );
  g = begin(g);
  if (source === 'cache') {
    if (g.decision?.kind === 'richeseBlackMarket')
      g = applyAction(g, 'r', {
        type: 'decision',
        event: g.richeseBidding!.event,
        decline: true,
      });
    g = applyAction(g, 'r', {
      type: 'decision',
      event: g.richeseBidding!.event,
      position: 'first',
    });
  }
  g = applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    card: source === 'cache' ? g.richeseCache![0].id : g.players[0].hand[0].id,
    method,
    direction: 'clockwise',
    claim: 'A useful card',
  });
  assert.ok(g.richeseAuction);
  return g;
}

void test('all four profiles complete first/last cache auctions and ordinary lots through the real phase transition', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = begin(fixture());
    const other = botActions(projected(initial, 'e', difficulty));
    assert.deepEqual(other, [], 'nonowner cannot decide cache position');
    const done = drive(initial, difficulty, (g) => g.phase === 4);
    assert.equal(done.richeseBidding!.stage, 'complete');
    assert.equal(done.richeseCache!.length, 9);
    assert.equal(done.richeseAuction, null);
    const identities = [
      ...done.deck,
      ...done.discard,
      ...done.players.flatMap((p) => p.hand),
      ...done.richeseCache!,
      ...(done.richeseRemoved ?? []),
    ];
    assert.equal(identities.length, 43);
    assert.equal(new Set(identities.map((c) => c.id)).size, 43);
  }
});

void test('all profiles skip optional Black Market and legally complete its normal, Once Around and Silent lots when already offered', () => {
  for (const difficulty of DIFFICULTIES) {
    let optional = fixture(true);
    optional.players[0].hand.push(optional.deck.shift()!);
    optional = begin(optional);
    const skip = botActions(projected(optional, 'r', difficulty))[0];
    assert.deepEqual(skip, {
      type: 'decision',
      event: optional.richeseBidding!.event,
      decline: true,
    });
    assert.equal(
      applyAction(optional, 'r', skip).decision?.kind,
      'richeseDeclaration',
    );
    for (const method of ['normal', 'onceAround', 'silent'] as const) {
      const g = offer(method, 'blackMarket', true);
      const event = g.richeseAuction!.event;
      const done = drive(
        g,
        difficulty,
        (current) => current.richeseAuction?.event !== event,
      );
      assert.equal(done.decision?.kind, 'richeseDeclaration');
    }
  }
});

void test('seller policies never emit the unsupported positive Black Market self-bid', () => {
  for (const difficulty of DIFFICULTIES)
    for (const method of ['normal', 'onceAround', 'silent'] as const) {
      const g = offer(method, 'blackMarket', true);
      if (method !== 'silent') g.richeseAuction!.active = 'r';
      const action = botActions(projected(g, 'r', difficulty))[0];
      assert.deepEqual(action, {
        type: 'richeseBid',
        event: g.richeseAuction!.event,
        amount: method === 'silent' ? 0 : null,
        allyPayment: 0,
      });
      assert.doesNotThrow(() => applyAction(g, 'r', action));
    }
});

void test('unfunded bidders pass, sealed bidders act once, and hidden opponent state cannot affect the bid', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = offer('silent', 'cache');
    g.players.find((p) => p.id === 'e')!.spice = 0;
    const zero = botActions(projected(g, 'e', difficulty))[0];
    assert.deepEqual(zero, {
      type: 'richeseBid',
      event: g.richeseAuction!.event,
      amount: 0,
      allyPayment: 0,
    });
    g = applyAction(g, 'e', zero);
    assert.deepEqual(botActions(projected(g, 'e', difficulty)), []);
    const view = projected(g, 'f', difficulty);
    assert.equal(view.richeseAuction!.ownBid, null);
    assert.equal(view.richeseAuction!.revealedBids, null);
    assert.equal('sealed' in view.richeseAuction!, false);
    const changed = structuredClone(view) as GameView;
    for (const p of changed.players.filter((p) => p.id !== changed.me)) {
      p.spice = 999;
      p.hand = [{ id: 'unentitled', name: 'Secret', kind: 'lasgun' }];
    }
    assert.deepEqual(botActions(changed), botActions(view));
  }
});

void test('projected funding produces exact affordable splits without inspecting ally balances', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = offer('silent', 'cache');
    const view = projected(g, 'e', difficulty);
    view.richeseAuction!.ownAvailable = 0;
    view.richeseAuction!.allyAvailable = 3;
    const action = botActions(view)[0];
    assert.equal(action.type, 'richeseBid');
    assert.ok(
      typeof action.amount === 'number' &&
        action.amount > 0 &&
        action.amount <= 3,
    );
    assert.equal(action.allyPayment, action.amount);
    view.richeseAuction!.allyAvailable = 0;
    assert.equal(botActions(view)[0].amount, 0);
  }
});

void test('ally-funded bot bids are accepted by authoritative escrow validation', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = offer('silent', 'cache');
    const bidder = g.players.find((p) => p.id === 'e')!;
    const donor = g.players.find((p) => p.id === 'f')!;
    bidder.ally = donor.id;
    donor.ally = bidder.id;
    bidder.spice = 0;
    donor.spice -= 3;
    g.aid[donor.id] = { recipient: bidder.id, amount: 3 };
    const action = botActions(projected(g, bidder.id, difficulty))[0];
    assert.equal(action.allyPayment, action.amount);
    assert.ok(
      typeof action.amount === 'number' &&
        action.amount > 0 &&
        action.amount <= 3,
    );
    const next = applyAction(g, bidder.id, action);
    assert.equal(next.richeseFunding![bidder.id].allyPayment, action.amount);
    assert.equal(next.richeseFunding![bidder.id].donor, donor.id);
    assert.equal(next.players.find((p) => p.id === bidder.id)!.spice, 0);
  }
});

void test('a pending cancellation window takes priority over Richese auction controls for every profile', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    const other = g.players.find((p) => p.id === 'e')!;
    other.hand.push(
      g.deck.splice(
        g.deck.findIndex((card) => card.effect === 'karama'),
        1,
      )[0],
    );
    g = begin(g);
    g = applyAction(g, 'r', {
      type: 'decision',
      event: g.richeseBidding!.event,
      position: 'first',
    });
    assert.equal(g.response?.kind, 'richeseAuction');
    const actions = botActions(projected(g, 'e', difficulty));
    assert.ok(actions.length > 0);
    assert.ok(
      actions.every(
        (action) => action.type !== 'richeseBid' && action.type !== 'decision',
      ),
    );
    assert.doesNotThrow(() => applyAction(g, 'e', actions[0]));
    assert.deepEqual(botActions(projected(g, 'r', difficulty)), []);
  }
});

void test('unbid cache decisions keep a free card only when there is room', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = offer('silent', 'cache');
    for (const id of g.richeseAuction!.eligible)
      g = applyAction(g, id, {
        type: 'richeseBid',
        event: g.richeseAuction!.event,
        amount: 0,
        allyPayment: 0,
      });
    assert.equal(g.decision?.kind, 'richeseUnbid');
    let action = botActions(projected(g, 'r', difficulty))[0];
    assert.equal(action.keep, true);
    assert.doesNotThrow(() => applyAction(g, 'r', action));
    g.players[0].hand = g.deck.splice(0, 4);
    action = botActions(projected(g, 'r', difficulty))[0];
    assert.equal(action.keep, false);
    const done = applyAction(g, 'r', action);
    assert.equal(done.richeseRemoved!.length, 1);
  }
});
