import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import {
  quoteRicheseCancellation,
  RicheseCancellationError,
} from '../game/richese-cancellation';

function fixture(advanced = true, phase = 5, giftId = 'richese-ornithopter') {
  const g = createGame(
    'RICHRESTORE',
    newPlayer('r', 'Richese', 'richese'),
    advanced,
    ['choam'],
  );
  g.players.push(
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    newPlayer('g', 'Guild', 'guild'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase,
    active: 'h',
    order: ['r', 'b', 'e', 'h', 'g'],
    storm: 18,
    deck: baseDeck(),
    discard: [],
    richeseCache: richeseCards(),
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
  }
  const player = (id: string) => g.players.find((p) => p.id === id)!;
  player('r').ally = 'h';
  player('h').ally = 'r';
  player('e').ally = 'g';
  player('g').ally = 'e';
  const take = (
    id: string,
    from: 'deck' | 'richeseCache',
    match: (c: Game['deck'][number]) => boolean,
  ) => {
    const pile = g[from]!,
      index = pile.findIndex(match);
    assert.ok(index >= 0);
    const card = pile.splice(index, 1)[0];
    player(id).hand.push(card);
    return card;
  };
  const gift = take('r', 'richeseCache', (c) => c.id === giftId),
    special = take('r', 'deck', (c) => c.effect === 'karama'),
    printed = take('g', 'deck', (c) => c.effect === 'karama'),
    bg = take('b', 'deck', (c) => c.kind === 'worthless'),
    bg2 = take('b', 'deck', (c) => c.kind === 'worthless');
  if (giftId !== 'richese-karama')
    take('h', 'richeseCache', (c) => c.id === 'richese-karama');
  return { g, gift, special, printed, bg, bg2 };
}
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function passOne(state: Game) {
  let g = state;
  const original = g.response!.kind;
  const originalUse = JSON.stringify(g.pendingKarama?.use);
  for (
    let i = 0;
    g.response?.kind === original &&
    (original !== 'worthlessKarama' ||
      JSON.stringify(g.pendingKarama?.use) === originalUse) &&
    i < 20;
    i++
  ) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function parent(f = fixture()) {
  let g = applyAction(f.g, 'e', { type: 'emperorGift', amount: 2 });
  g = applyAction(g, 'b', { type: 'card', card: f.bg.id, mode: 'cancel' });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.ok(g.pendingKarama?.opportunity);
  return { ...f, g };
}
function gift(f = parent()) {
  return {
    ...f,
    g: applyAction(f.g, 'r', { type: 'richeseGift', card: f.gift.id }),
  };
}
function income(f = parent()) {
  const acquire = f.g.richeseCache!.find((c) => c.id !== 'richese-karama')!.id;
  const g = applyAction(f.g, 'r', {
    type: 'card',
    card: f.special.id,
    mode: 'special',
    acquire,
  });
  assert.equal(g.response?.kind, 'richesePurchaseIncome');
  return { ...f, g, acquire };
}
function quote(g: Game) {
  const q = quoteRicheseCancellation(g, g.response!);
  assert.ok(q);
  return q;
}
const observed = {} as {
  currentRicheseCancellationQuote: (
    g: Game,
    r: NonNullable<Game['response']>,
  ) => unknown;
};
const engineURL = new URL('../game/engine.ts', import.meta.url);
runInNewContext(
  ts.transpileModule(
    readFileSync(engineURL, 'utf8') +
      '\nexport { currentRicheseCancellationQuote };',
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

void test('all ten canonical gifts have exact canceled receipts in Basic and Advanced across all nine phases', () => {
  let count = 0;
  for (const advanced of [false, true])
    for (let phase = 0; phase < 9; phase++)
      for (const card of richeseCards()) {
        const f = fixture(advanced, phase, card.id),
          g = applyAction(f.g, 'r', { type: 'richeseGift', card: card.id }),
          before = structuredClone(g),
          q = quote(g);
        assert.equal(q.kind, 'richeseGift');
        if (q.kind === 'richeseGift')
          assert.deepEqual(q.blocked, { turn: 2, phase, cards: [card.id] });
        assert.deepEqual(q.resume, g.pendingRicheseGift!.resume);
        assert.deepEqual(g, before);
        count++;
      }
  assert.equal(count, 180);
});
for (const form of ['printed', 'bg'] as const)
  void test(`a genuine ${form} canceled gift restores its older BG conversion without transferring or revealing the gift`, () => {
    const f = gift(),
      before = structuredClone(f.g),
      q = quote(f.g),
      card = form === 'printed' ? f.printed : f.bg2,
      actor = form === 'printed' ? 'g' : 'b';
    let g = applyAction(f.g, actor, {
      type: 'card',
      card: card.id,
      mode: 'cancel',
    });
    assert.deepEqual(f.g, before);
    if (form === 'bg') {
      assert.equal(g.pendingKarama?.use.kind, 'cancel');
      g = passOne(JSON.parse(JSON.stringify(g)) as Game);
    }
    assert.equal(g.pendingRicheseGift, null);
    assert.deepEqual(
      g.richeseGiftBlocked,
      q.kind === 'richeseGift' ? q.blocked : null,
    );
    assert.equal(g.response?.kind, 'worthlessKarama');
    assert.deepEqual(g.pendingKarama, q.resume.pendingKarama);
    assert.ok(player(g, 'r').hand.some((c) => c.id === f.gift.id));
    assert.ok(!player(g, 'h').hand.some((c) => c.id === f.gift.id));
    assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
    assert.equal(JSON.stringify(viewGame(g, 'e')).includes(f.gift.id), false);
    g = passOne(g);
    assert.equal(g.response, null);
    assert.equal(player(g, 'e').spice, 20);
    assert.equal(player(g, 'g').spice, 20);
  });
for (const form of ['printed', 'bg'] as const)
  void test(`a genuine ${form} purchase-income cancellation keeps the paid purchase and restores the earlier conversion once`, () => {
    const f = income(),
      before = structuredClone(f.g),
      q = quote(f.g),
      card = form === 'printed' ? f.printed : f.bg2,
      actor = form === 'printed' ? 'g' : 'b';
    assert.equal(q.kind, 'richesePurchaseIncome');
    let g = applyAction(f.g, actor, {
      type: 'card',
      card: card.id,
      mode: 'cancel',
    });
    if (form === 'bg') g = passOne(JSON.parse(JSON.stringify(g)) as Game);
    assert.deepEqual(f.g, before);
    assert.equal(g.pendingRichesePurchaseIncome, null);
    assert.equal(player(g, 'r').spice, 17);
    assert.equal(player(g, 'e').spice, 20);
    assert.equal(
      player(g, 'r').hand.filter((c) => c.id === f.acquire).length,
      1,
    );
    assert.equal(g.discard.filter((c) => c.id === f.special.id).length, 1);
    assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
    assert.equal(g.response?.kind, 'worthlessKarama');
    assert.deepEqual(g.pendingKarama, q.resume.pendingKarama);
    assert.equal(JSON.stringify(viewGame(g, 'g')).includes(f.acquire), false);
    g = passOne(g);
    assert.equal(g.response, null);
    assert.equal(player(g, 'r').spice, 17);
    assert.equal(player(g, 'e').spice, 20);
  });
void test('a gift restores a real Harkonnen hand exchange with its inherited BG declaration and saved response', () => {
  const f = parent(fixture(true, 3));
  const hark = player(f.g, 'h').hand.find((c) => c.effect === 'karama')!;
  let g = applyAction(f.g, 'h', {
    type: 'card',
    card: hark.id,
    mode: 'special',
    target: 'b',
    amount: 1,
  });
  assert.equal(g.decision?.kind, 'handExchange');
  assert.equal(g.response, null);
  const decision = structuredClone(g.decision),
    priorResponse = structuredClone(g.pendingExchange!.response);
  const gifted = applyAction(g, 'r', { type: 'richeseGift', card: f.gift.id });
  assert.doesNotThrow(() => quote(gifted));
  g = applyAction(gifted, 'g', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.deepEqual(g.decision, decision);
  assert.deepEqual(g.pendingExchange!.response, priorResponse);
  assert.equal(g.response, null);
  g = applyAction(g, 'h', { type: 'decision', returnCards: [f.bg2.id] });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.ok(player(g, 'b').hand.some((c) => c.id === f.bg2.id));
});
void test('denied gift cancellation does not demand present custody, spare recipient capacity, alliance or transfer funds', () => {
  const f = gift(),
    g = structuredClone(f.g);
  const at = player(g, 'r').hand.findIndex((c) => c.id === f.gift.id);
  g.discard.push(...player(g, 'r').hand.splice(at, 1));
  player(g, 'r').ally = null;
  player(g, 'h').ally = null;
  player(g, 'h').hand.push(...g.deck.splice(0, 8));
  player(g, 'r').spice = 0;
  assert.equal(quote(g).kind, 'richeseGift');
  const next = applyAction(g, 'g', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.equal(next.pendingRicheseGift, null);
  assert.equal(next.discard.filter((c) => c.id === f.gift.id).length, 1);
  assert.equal(player(next, 'h').hand.length, 9);
});
void test('current blocked gifts append once while a prior-phase blocked list is replaced', () => {
  const f = gift();
  f.g.richeseGiftBlocked = {
    turn: 2,
    phase: 5,
    cards: ['richese-semuta-drug'],
  };
  assert.deepEqual(
    quote(f.g).kind === 'richeseGift' &&
      (quote(f.g) as { blocked: unknown }).blocked,
    { turn: 2, phase: 5, cards: ['richese-semuta-drug', f.gift.id] },
  );
  f.g.richeseGiftBlocked.phase = 4;
  const q = quote(f.g);
  assert.ok(q.kind === 'richeseGift');
  assert.deepEqual(q.blocked.cards, [f.gift.id]);
});
void test('canceled receipts and suspended control corruptions reject before card cost, mutation or RNG', (t) => {
  const source = gift();
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.pendingRicheseGift!.turn++;
    },
    (g) => {
      g.pendingRicheseGift!.phase = 3;
    },
    (g) => {
      g.pendingRicheseGift!.event = '';
    },
    (g) => {
      g.pendingRicheseGift!.intent.owner = 'e';
    },
    (g) => {
      g.response!.recipient = 'b';
    },
    (g) => {
      g.pendingRicheseGift!.intent.cardId = 'fake';
    },
    (g) => {
      g.pendingRicheseGift!.resume.response!.kind = 'unknown' as never;
    },
    (g) => {
      g.pendingRicheseGift!.resume.response!.passed = ['g', 'g'];
    },
    (g) => {
      g.pendingRicheseGift!.resume.decision = {
        kind: 'unknown',
        player: 'r',
      } as never;
    },
    (g) => {
      g.pendingRicheseGift!.resume.decision = {
        kind: 'advisor',
        player: 'missing',
        shipment: 'x',
      };
    },
    (g) => {
      g.pendingRicheseGift!.resume.pendingKarama!.owner = 'missing';
    },
    (g) => {
      g.pendingRicheseGift!.resume.pendingKarama!.opportunity!.signature =
        'stale';
    },
    (g) => {
      g.pendingRicheseGift!.resume.response = {
        kind: 'richeseGift',
        owner: 'r',
        recipient: 'h',
        passed: [],
      };
    },
    (g) => {
      g.pendingRicheseGift!.resume.phaseOpening = {
        initialize: true,
        passed: ['missing'],
      };
    },
    (g) => {
      g.richeseGiftBlocked = { turn: 2, phase: 5, cards: [source.gift.id] };
    },
  ];
  const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('No random draw');
    }),
    uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('No event');
    });
  for (const mutate of mutations) {
    const bad = structuredClone(source.g);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(() =>
      observed.currentRicheseCancellationQuote(bad, bad.response!),
    );
    assert.throws(() =>
      applyAction(bad, 'g', {
        type: 'card',
        card: source.printed.id,
        mode: 'cancel',
      }),
    );
    assert.deepEqual(bad, before);
    assert.ok(player(bad, 'g').hand.some((c) => c.id === source.printed.id));
  }
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
void test('purchase income rejects stale owner, amount and malformed resumed controls without inventing a purchased-card receipt', () => {
  const f = income();
  for (const mutate of [
    (g: Game) => {
      g.pendingRichesePurchaseIncome!.owner = 'r';
    },
    (g: Game) => {
      g.response!.amount = 2;
    },
    (g: Game) => {
      g.pendingRichesePurchaseIncome!.turn++;
    },
    (g: Game) => {
      g.pendingRichesePurchaseIncome!.resume.response = {
        kind: 'richesePurchaseIncome',
        owner: 'e',
        amount: 3,
        passed: [],
      };
    },
    (g: Game) => {
      g.pendingRichesePurchaseIncome!.resume.decision = {
        kind: 'handExchange',
        player: 'h',
        target: 'b',
        count: 1,
      };
    },
  ]) {
    const g = structuredClone(f.g);
    mutate(g);
    const before = structuredClone(g);
    assert.throws(() =>
      applyAction(g, 'g', { type: 'card', card: f.printed.id, mode: 'cancel' }),
    );
    assert.deepEqual(g, before);
  }
  const noMoney = structuredClone(f.g);
  player(noMoney, 'r').spice = 0;
  assert.equal(quote(noMoney).kind, 'richesePurchaseIncome');
});
void test('cross-receipt and object-reference cycles reject, while detached resumes preserve legacy optional fields', () => {
  const f = gift();
  const self = structuredClone(f.g);
  self.pendingRicheseGift!.resume.pendingKarama!.use = {
    kind: 'cancel',
    response: { kind: 'richeseGift', owner: 'r', recipient: 'h', passed: [] },
  };
  assert.throws(() => quote(self), RicheseCancellationError);
  const cycle = structuredClone(f.g);
  cycle.pendingRicheseGift!.resume.response = {
    kind: 'richesePurchaseIncome',
    owner: 'e',
    amount: 3,
    passed: [],
  };
  cycle.pendingRichesePurchaseIncome = {
    owner: 'e',
    turn: 2,
    phase: 5,
    resume: {
      response: { kind: 'richeseGift', owner: 'r', recipient: 'h', passed: [] },
      decision: null,
      pendingKarama: null,
    },
  };
  assert.throws(() => quote(cycle), /recursive/);
  const legacy = structuredClone(f.g);
  delete legacy.pendingRicheseGift!.resume.pendingKarama!.opportunity;
  const q = quote(legacy),
    before = structuredClone(legacy);
  q.resume.pendingKarama!.owner = 'detached';
  assert.deepEqual(legacy, before);
});
void test('an actually suspended Emperor gift rejects malformed restored source semantics before the first cancellation cost', () => {
  const initial = fixture();
  const declared = applyAction(initial.g, 'e', {
    type: 'emperorGift',
    amount: 2,
  });
  const gifted = applyAction(declared, 'r', {
    type: 'richeseGift',
    card: initial.gift.id,
  });
  for (const mutate of [
    (g: Game) => {
      g.pendingRicheseGift!.resume.response!.owner = 'r';
    },
    (g: Game) => {
      g.pendingRicheseGift!.resume.response!.recipient = undefined;
    },
    (g: Game) => {
      g.pendingRicheseGift!.resume.response!.amount = -1;
    },
  ]) {
    const bad = structuredClone(gifted);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(() =>
      observed.currentRicheseCancellationQuote(bad, bad.response!),
    );
    assert.throws(() =>
      applyAction(bad, 'g', {
        type: 'card',
        card: initial.printed.id,
        mode: 'cancel',
      }),
    );
    assert.deepEqual(bad, before);
  }
});
void test('a gift can restore actual purchase income but rejects a corrupted receipt in that live parent chain', () => {
  const f = income(),
    gifted = applyAction(f.g, 'r', { type: 'richeseGift', card: f.gift.id });
  assert.equal(
    gifted.pendingRicheseGift!.resume.response?.kind,
    'richesePurchaseIncome',
  );
  assert.equal(quote(gifted).kind, 'richeseGift');
  for (const mutate of [
    (g: Game) => {
      g.pendingRichesePurchaseIncome!.owner = 'r';
    },
    (g: Game) => {
      g.pendingRichesePurchaseIncome!.turn++;
    },
    (g: Game) => {
      g.pendingRicheseGift!.resume.response!.amount = 4;
    },
  ]) {
    const bad = structuredClone(gifted);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(() => quote(bad), RicheseCancellationError);
    assert.throws(() =>
      applyAction(bad, 'g', {
        type: 'card',
        card: f.printed.id,
        mode: 'cancel',
      }),
    );
    assert.deepEqual(bad, before);
  }
  const continued = applyAction(gifted, 'g', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.equal(continued.pendingRicheseGift, null);
  assert.equal(continued.response?.kind, 'richesePurchaseIncome');
  assert.ok(continued.pendingRichesePurchaseIncome);
  assert.equal(player(continued, 'r').spice, 17);
  assert.equal(player(continued, 'e').spice, 20);
});
