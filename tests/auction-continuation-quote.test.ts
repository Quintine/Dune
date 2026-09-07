import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { baseDeck } from '../game/cards';
import {
  createRicheseAuction,
  submitRicheseBid,
} from '../game/richese-auction';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import {
  quoteAuctionContinuation,
  AuctionContinuationError,
  type AuctionContinuationInput,
  type AuctionContinuationOperation,
} from '../game/auction-continuation-quote';

function fixture(): AuctionContinuationInput {
  const cards = baseDeck().slice(0, 4);
  return {
    status: 'playing',
    phase: 3,
    turn: 2,
    advanced: true,
    physicalCards: cards,
    order: ['h', 'e', 'b', 'g'],
    players: [
      {
        id: 'h',
        faction: 'harkonnen',
        spice: 16,
        hand: [cards[0]],
        handLimit: 8,
      },
      { id: 'e', faction: 'emperor', spice: 20, hand: [], handLimit: 4 },
      { id: 'b', faction: 'beneGesserit', spice: 20, hand: [], handLimit: 4 },
      { id: 'g', faction: 'guild', spice: 20, hand: [], handLimit: 4 },
    ],
    auction: {
      cards,
      index: 0,
      bid: 4,
      bidder: 'h',
      active: 'h',
      passed: ['e', 'b', 'g'],
      opener: 0,
    },
    sale: {
      winner: 'h',
      amount: 4,
      free: false,
      origin: 'normal',
      seller: null,
    },
  };
}
const cancel = (
  kind: 'emperorIncome' | 'harkonnenBonus' | 'ixAllyCard',
  owner: string,
  recipient?: string,
): AuctionContinuationOperation => ({
  kind: 'cancel',
  response: { kind, owner, passed: [], ...(recipient ? { recipient } : {}) },
});
void test('the paid normal sale stops at Emperor then Harkonnen responses without replaying buyer payment', () => {
  const g = fixture(),
    before = structuredClone(g);
  assert.deepEqual(
    quoteAuctionContinuation(g, { kind: 'sale', free: false }).next,
    {
      kind: 'response',
      response: { kind: 'emperorIncome', owner: 'e', passed: [] },
    },
  );
  assert.deepEqual(quoteAuctionContinuation(g, { kind: 'bonus' }).next, {
    kind: 'response',
    response: { kind: 'harkonnenBonus', owner: 'h', passed: [] },
  });
  assert.deepEqual(
    quoteAuctionContinuation(g, cancel('emperorIncome', 'e')).steps,
    [],
  );
  assert.deepEqual(g, before);
});
void test('a free purchase bypasses Emperor income but still offers Harkonnen bonus, including the explicit legacy sale fallback', () => {
  const g = fixture();
  g.sale!.free = true;
  assert.equal(
    (
      quoteAuctionContinuation(g, { kind: 'sale', free: true }).next as {
        response: { kind: string };
      }
    ).response.kind,
    'harkonnenBonus',
  );
  assert.throws(
    () => quoteAuctionContinuation(g, cancel('emperorIncome', 'e')),
    /not payable/,
  );
  delete g.sale;
  const q = quoteAuctionContinuation(g, { kind: 'sale', free: true });
  assert.equal(q.sale.legacy, true);
  assert.equal(q.sale.free, true);
  assert.equal(q.next.kind, 'response');
  assert.equal(
    quoteAuctionContinuation(g, cancel('harkonnenBonus', 'h')).next.kind,
    'normalLot',
  );
});
void test('the next normal lot resets exactly once and rotates the opener past full hands', () => {
  const g = fixture();
  g.players[1].hand = baseDeck().slice(10, 14);
  const before = structuredClone(g),
    q = quoteAuctionContinuation(g, { kind: 'next' });
  assert.ok(q.next.kind === 'normalLot');
  assert.equal(q.next.active, 'b');
  assert.equal(q.next.auction.opener, 2);
  assert.equal(q.next.auction.index, 1);
  assert.equal(q.next.auction.bid, 0);
  assert.equal(q.next.auction.allyPayment, 0);
  assert.equal(q.next.auction.bidder, null);
  assert.deepEqual(q.next.auction.passed, []);
  assert.equal(q.next.auction.peekKnown, false);
  q.next.auction.cards.reverse();
  assert.deepEqual(g, before);
});
void test('a final lot or all-full table returns only the unauctioned suffix at an explicit phase boundary', () => {
  const g = fixture();
  for (const p of g.players)
    p.hand = Array.from({ length: p.handLimit }, (_, i) => ({
      id: `${p.id}-${i}`,
    }));
  const q = quoteAuctionContinuation(g, { kind: 'next' });
  assert.ok(q.next.kind === 'normalEnd');
  assert.deepEqual(q.next.returned, g.auction!.cards.slice(1));
  assert.equal(q.next.after, 'phase');
  g.auction!.index = 3;
  g.sale!.amount = g.auction!.bid = 4;
  const last = quoteAuctionContinuation(g, { kind: 'next' });
  assert.ok(last.next.kind === 'normalEnd');
  assert.deepEqual(last.next.returned, []);
});
void test('spending a last-slot card is projected before bonus and next-lot eligibility, without altering source hands', () => {
  const g = fixture();
  for (const p of g.players)
    p.hand = Array.from({ length: p.handLimit }, (_, i) => ({
      id: `${p.id}-${i}`,
    }));
  const before = structuredClone(g);
  assert.equal(
    quoteAuctionContinuation(g, cancel('emperorIncome', 'e')).next.kind,
    'normalEnd',
  );
  const bonus = quoteAuctionContinuation(g, cancel('emperorIncome', 'e'), {
    player: 'h',
    card: 'h-0',
  });
  assert.deepEqual(bonus.next, {
    kind: 'response',
    response: { kind: 'harkonnenBonus', owner: 'h', passed: [] },
  });
  const lot = quoteAuctionContinuation(g, cancel('harkonnenBonus', 'h'), {
    player: 'g',
    card: 'g-0',
  });
  assert.ok(lot.next.kind === 'normalLot');
  assert.equal(lot.next.active, 'g');
  assert.deepEqual(g, before);
  assert.throws(
    () =>
      quoteAuctionContinuation(
        g,
        { kind: 'next' },
        { player: 'g', card: 'missing' },
      ),
    /custody/,
  );
});
void test('post-cost Ix hand eligibility chooses Technology or the next Atreides peek without inspecting card identities', () => {
  const g = fixture();
  g.players = [
    ...g.players,
    {
      id: 'i',
      faction: 'ixians',
      spice: 20,
      hand: [{ id: 'last-ix-card' }],
      handLimit: 4,
    },
    { id: 'a', faction: 'atreides', spice: 20, hand: [], handLimit: 4 },
  ];
  g.order = [...g.order, 'i', 'a'];
  const before = quoteAuctionContinuation(g, { kind: 'next' });
  assert.ok(before.next.kind === 'normalLot');
  assert.deepEqual(before.next.offer, { kind: 'ixTechnology', player: 'i' });
  const after = quoteAuctionContinuation(g, cancel('harkonnenBonus', 'h'), {
    player: 'i',
    card: 'last-ix-card',
  });
  assert.ok(after.next.kind === 'normalLot');
  assert.deepEqual(after.next.offer, {
    kind: 'atreidesAuction',
    owner: 'a',
    passed: [],
  });
  g.ixTechnologyTurn = 2;
  const used = quoteAuctionContinuation(g, { kind: 'next' });
  assert.ok(used.next.kind === 'normalLot');
  assert.equal(used.next.offer?.kind, 'atreidesAuction');
});
void test('historical sold prefix aliases are valid, while duplicate unsold physical cards reject', () => {
  const g = fixture();
  g.auction!.index = 1;
  g.auction!.cards[0] = g.auction!.cards[1];
  assert.equal(
    quoteAuctionContinuation(g, { kind: 'next' }).next.kind,
    'normalLot',
  );
  g.auction!.cards[2] = g.auction!.cards[1];
  assert.throws(
    () => quoteAuctionContinuation(g, { kind: 'next' }),
    /physical/,
  );
});
void test('bad source index, opener, bidder, receipt and declared family reject atomically without requiring funds or future draw supply', () => {
  const mutations: ((g: AuctionContinuationInput) => void)[] = [
    (g) => {
      g.phase = 5;
    },
    (g) => {
      g.order = [];
    },
    (g) => {
      g.order = ['h', 'h'];
    },
    (g) => {
      g.auction!.index = 99;
    },
    (g) => {
      g.auction!.opener = -1;
    },
    (g) => {
      g.auction!.active = 'unknown';
    },
    (g) => {
      g.auction!.bid = -1;
    },
    (g) => {
      g.sale!.amount = 3;
    },
    (g) => {
      g.sale!.winner = 'e';
    },
    (g) => {
      g.sale!.seller = 'e';
    },
    (g) => {
      g.auction!.passed = ['e', 'e'];
    },
  ];
  for (const mutate of mutations) {
    const g = fixture();
    mutate(g);
    const before = structuredClone(g);
    assert.throws(
      () => quoteAuctionContinuation(g, { kind: 'next' }),
      AuctionContinuationError,
    );
    assert.deepEqual(g, before);
  }
  const g = fixture();
  g.players[0].spice = 0;
  assert.equal(
    quoteAuctionContinuation(g, cancel('emperorIncome', 'e')).next.kind,
    'response',
  );
  assert.throws(
    () => quoteAuctionContinuation(g, cancel('emperorIncome', 'g')),
    /not payable/,
  );
  assert.throws(
    () => quoteAuctionContinuation(g, cancel('harkonnenBonus', 'e')),
    /wrong winner/,
  );
});
function richese(
  source: 'cache' | 'blackMarket' = 'blackMarket',
  winner = 'h',
) {
  const g = fixture();
  g.players = [
    ...g.players,
    { id: 'r', faction: 'richese', spice: 20, hand: [], handLimit: 4 },
  ];
  g.order = [...g.order, 'r'];
  let lot = createRicheseAuction({
    event: 'lot-2',
    cardId: 'richese-distrans',
    source,
    owner: 'r',
    method: 'silent',
    eligible: g.order,
    order: g.order,
    tieOrder: g.order,
  });
  for (const actor of g.order)
    lot = submitRicheseBid(
      lot,
      { event: lot.event, actor, amount: actor === winner ? 4 : 0 },
      20,
    );
  g.auction = null;
  g.richeseAuction = lot;
  g.richeseBidding = {
    owner: 'r',
    event: 'declaration-2',
    turn: 2,
    stage: 'lot',
    position: source === 'cache' ? 'first' : null,
    normalCount: source === 'cache' ? 3 : null,
    blackMarketSold: false,
    cacheCanceled: false,
  };
  g.richeseCacheCount = 8;
  g.sale = { winner, amount: 4, free: false, origin: source, seller: 'r' };
  return g;
}
void test('sold Richese lots credit their seller exactly once before bonus, retaining separate declaration/pool/phase boundaries', () => {
  for (const source of ['blackMarket', 'cache'] as const) {
    const g = richese(source),
      q = quoteAuctionContinuation(g, { kind: 'sale', free: false });
    assert.deepEqual(q.steps, [
      { kind: 'sellerCredit', player: 'r', amount: 4, balance: 24 },
    ]);
    assert.equal(q.next.kind, 'response');
    assert.deepEqual(quoteAuctionContinuation(g, { kind: 'bonus' }).steps, []);
    const end = quoteAuctionContinuation(g, { kind: 'next' });
    assert.ok(end.next.kind === 'richeseEnd');
    assert.equal(
      end.next.after,
      source === 'cache' ? 'normalPool' : 'declaration',
    );
  }
  const g = richese('cache', 'r');
  assert.deepEqual(
    quoteAuctionContinuation(g, { kind: 'sale', free: false }).next,
    {
      kind: 'response',
      response: { kind: 'emperorIncome', owner: 'e', passed: [] },
    },
  );
  g.richeseBidding!.position = 'last';
  assert.equal(
    (quoteAuctionContinuation(g, { kind: 'next' }).next as { after: string })
      .after,
    'phase',
  );
});
void test('Black Market cache exhaustion is checked only when reaching that declaration boundary; seller balance overflow rejects before credit', () => {
  const g = richese();
  g.richeseCacheCount = 0;
  assert.equal(
    quoteAuctionContinuation(g, { kind: 'sale', free: false }).next.kind,
    'response',
  );
  assert.throws(
    () => quoteAuctionContinuation(g, { kind: 'next' }),
    /exhausted/,
  );
  g.richeseCacheCount = 8;
  g.players.find((p) => p.id === 'r')!.spice = Number.MAX_SAFE_INTEGER;
  assert.throws(
    () => quoteAuctionContinuation(g, { kind: 'sale', free: false }),
    /overflow/,
  );
});
void test('Ix denial binds acquired-card reference and free paid receipt without demanding current card custody or repeating its purchase', () => {
  const g = fixture();
  g.players = [
    ...g.players,
    { id: 'i', faction: 'ixians', spice: 0, hand: [], handLimit: 4 },
  ];
  g.order = [...g.order, 'i'];
  g.pendingIxAlly = { player: 'h', card: g.auction!.cards[0].id, free: false };
  g.players[0].hand = [];
  g.players[0].spice = 0;
  const q = quoteAuctionContinuation(g, cancel('ixAllyCard', 'i', 'h'));
  assert.deepEqual(q.steps, [{ kind: 'clearIxAlly' }]);
  assert.equal(q.next.kind, 'response');
  g.pendingIxAlly.free = true;
  assert.throws(
    () => quoteAuctionContinuation(g, cancel('ixAllyCard', 'i', 'h')),
    /completed purchase/,
  );
  g.pendingIxAlly.free = false;
  delete g.sale;
  assert.throws(
    () => quoteAuctionContinuation(g, cancel('ixAllyCard', 'i', 'h')),
    /completed purchase/,
  );
});

function live(harkCount = 1, keepBgCounter = true) {
  let g = createGame(
    'SALEQUOTE',
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    true,
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('g', 'Guild', 'guild'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase: 2,
    ready: [],
    order: ['h', 'e', 'b', 'g'],
    deck: baseDeck(),
    discard: [],
    phaseOpening: null,
    response: null,
    decision: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
  }
  const hold = (id: string, match: (c: Game['deck'][number]) => boolean) => {
    const i = g.deck.findIndex(match);
    assert.ok(i >= 0);
    const card = g.deck.splice(i, 1)[0];
    g.players.find((p) => p.id === id)!.hand.push(card);
    return card;
  };
  const own = hold('h', (c) => c.effect === 'karama'),
    printed = hold('g', (c) => c.effect === 'karama'),
    bg = hold('b', (c) => c.kind === 'worthless');
  if (!keepBgCounter) {
    g.players[2].hand = [];
    g.deck.push(bg);
  }
  while (g.players[0].hand.length < harkCount) hold('h', () => true);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 3);
  assert.ok(g.auction);
  g = applyAction(g, 'h', { type: 'bid', amount: 4 });
  for (let i = 0; !g.decision && !g.response && i < 20; i++)
    g = applyAction(g, g.auction!.active, { type: 'passBid' });
  assert.equal(g.decision?.kind, 'auctionPayment');
  return { g, own, printed, bg };
}
function paid(harkCount = 1, free = false, keepBgCounter = true) {
  const f = live(harkCount, keepBgCounter);
  return {
    ...f,
    g: applyAction(f.g, 'h', {
      type: 'decision',
      karama: free,
      ...(free ? { card: f.own.id } : {}),
    }),
  };
}
function passOne(state: Game) {
  let g = state;
  const kind = g.response!.kind,
    use = JSON.stringify(g.pendingKarama?.use);
  for (
    let i = 0;
    g.response?.kind === kind &&
    JSON.stringify(g.pendingKarama?.use) === use &&
    i < 20;
    i++
  ) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function normalized(g: Game): AuctionContinuationInput {
  return {
    status: g.status,
    phase: g.phase,
    turn: g.turn,
    advanced: g.advanced,
    physicalCards: [
      ...g.players.flatMap((p) => p.hand),
      ...g.deck,
      ...g.discard,
      ...(g.auction?.cards.slice(g.auction.index + 1) ?? []),
    ],
    order: g.order,
    players: g.players.map((p) => ({
      id: p.id,
      faction: p.faction,
      ally: p.ally,
      spice: p.spice,
      hand: p.hand,
      handLimit: p.faction === 'harkonnen' ? 8 : 4,
    })),
    auction: g.auction,
    sale: g.currentAuctionSale,
    pendingIxAlly: g.pendingIxAlly,
    richeseAuction: g.richeseAuction,
    richeseBidding: g.richeseBidding,
    richeseCacheCount: g.richeseCache?.length,
    ixTechnologyTurn: g.ixTechnologyTurn,
  };
}
const observed = {} as {
  currentAuctionContinuationQuote: (
    g: Game,
    o: AuctionContinuationOperation,
    s?: { player: string; card: string },
  ) => unknown;
};
const engineURL = new URL('../game/engine.ts', import.meta.url);
runInNewContext(
  ts.transpileModule(
    readFileSync(engineURL, 'utf8') +
      '\nexport {currentAuctionContinuationQuote};',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(engineURL),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
for (const form of ['printed', 'bg'] as const)
  void test(`a real ${form} income cancellation preserves the paid card and opens then denies the bonus before the next lot`, () => {
    const f = paid(),
      before = structuredClone(f.g),
      actor = form === 'printed' ? 'g' : 'b',
      card = f[form];
    assert.equal(f.g.response?.kind, 'emperorIncome');
    assert.equal(f.g.players[0].spice, 16);
    let g = applyAction(f.g, actor, {
      type: 'card',
      card: card.id,
      mode: 'cancel',
    });
    if (form === 'bg') g = passOne(JSON.parse(JSON.stringify(g)) as Game);
    assert.deepEqual(f.g, before);
    assert.equal(g.response?.kind, 'harkonnenBonus');
    assert.equal(g.players[1].spice, 20);
    const expected = quoteAuctionContinuation(
      normalized(g),
      cancel('harkonnenBonus', 'h'),
      form === 'printed'
        ? { player: 'b', card: f.bg.id }
        : { player: 'g', card: f.printed.id },
    );
    if (form === 'printed') {
      g = applyAction(g, 'b', { type: 'card', card: f.bg.id, mode: 'cancel' });
      g = passOne(g);
    } else
      g = applyAction(g, 'g', {
        type: 'card',
        card: f.printed.id,
        mode: 'cancel',
      });
    assert.equal(g.auction!.index, 1);
    assert.equal(g.currentAuctionSale, null);
    assert.equal(g.players[0].spice, 16);
    assert.equal(g.players[0].hand.length, 2);
    assert.ok(expected.next.kind === 'normalLot');
    assert.equal(g.auction!.active, expected.next.active);
    assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
    assert.equal(viewGame(g, 'e').players[0].hand, undefined);
  });
void test('a real full Harkonnen hand may spend its own last-slot Karama to cancel Emperor income and create bonus eligibility', () => {
  const f = paid(7);
  assert.equal(f.g.players[0].hand.length, 8);
  assert.equal(f.g.response?.kind, 'emperorIncome');
  const preview = quoteAuctionContinuation(
    normalized(f.g),
    cancel('emperorIncome', 'e'),
    { player: 'h', card: f.own.id },
  );
  assert.equal(preview.next.kind, 'response');
  const g = applyAction(f.g, 'h', {
    type: 'card',
    card: f.own.id,
    mode: 'cancel',
  });
  assert.equal(g.response?.kind, 'harkonnenBonus');
  assert.equal(g.players[0].hand.length, 7);
  assert.equal(g.players[1].spice, 20);
});
void test('actual allowed income and bonus credit/draw once and use the shared next-lot reset', () => {
  const f = paid();
  let g = passOne(f.g);
  assert.equal(g.players[1].spice, 24);
  assert.equal(g.response?.kind, 'harkonnenBonus');
  const before = g.players[0].hand.length;
  g = passOne(g);
  assert.equal(g.players[0].hand.length, before + 1);
  assert.equal(g.players[0].spice, 16);
  assert.equal(g.players[1].spice, 24);
  assert.equal(g.auction!.index, 1);
  assert.equal(g.auction!.bid, 0);
  const free = paid(1, true);
  assert.equal(free.g.players[0].spice, 20);
  assert.equal(free.g.response?.kind, 'harkonnenBonus');
  assert.equal(free.g.players[1].spice, 20);
});
void test('genuine paid declarations reject malformed next opener and current receipt before printed or BG cost without RNG', (t) => {
  const f = paid();
  const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('No random draw');
    }),
    uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('No event');
    });
  for (const form of ['printed', 'bg'] as const)
    for (const mutate of [
      (g: Game) => {
        g.auction!.opener = -1;
      },
      (g: Game) => {
        g.currentAuctionSale!.winner = 'e';
      },
      (g: Game) => {
        g.currentAuctionSale!.amount = 99;
      },
    ]) {
      const bad = structuredClone(f.g);
      mutate(bad);
      const before = structuredClone(bad),
        actor = form === 'printed' ? 'g' : 'b',
        card = f[form];
      assert.throws(() =>
        observed.currentAuctionContinuationQuote(
          bad,
          cancel('emperorIncome', 'e'),
          { player: actor, card: card.id },
        ),
      );
      assert.throws(() =>
        applyAction(bad, actor, {
          type: 'card',
          card: card.id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(bad, before);
    }
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
void test('spending the last opposing Karama permits the actual automatic Harkonnen bonus draw and advances exactly one lot', () => {
  const f = paid(1, false, false);
  assert.equal(f.g.response?.kind, 'emperorIncome');
  assert.equal(f.g.players[2].hand.length, 0);
  const ownedBefore = f.g.players[0].hand.length,
    deckBefore = f.g.deck.length;
  const g = applyAction(f.g, 'g', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.equal(g.response, null);
  assert.equal(g.auction!.index, 1);
  assert.equal(g.players[0].hand.length, ownedBefore + 1);
  assert.equal(g.deck.length, deckBefore - 1);
  assert.equal(g.players[0].spice, 16);
  assert.equal(g.players[1].spice, 20);
  assert.equal(g.discard.filter((c) => c.id === f.printed.id).length, 1);
  assert.equal(
    g.log.filter((e) => e.text.includes('drew one bonus treachery card'))
      .length,
    1,
  );
});
