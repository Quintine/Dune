import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import {
  quoteRicheseSettlement,
  requireRicheseDeclarationCache,
  RicheseSettlementError,
  type RicheseSettlementInput,
} from '../game/richese-settlement';
import {
  createRicheseAuction,
  submitRicheseBid,
  type RicheseAuctionSource,
} from '../game/richese-auction';
import { richeseCards } from '../game/richese-cards';
import { baseDeck } from '../game/cards';
import { createGame, newPlayer, handLimit, type Game } from '../game/engine';

function input(source: RicheseAuctionSource = 'cache'): RicheseSettlementInput {
  const card = richeseCards()[0];
  let lot = createRicheseAuction({
    event: 'richese-lot-2',
    cardId: card.id,
    owner: 'r',
    source,
    method: 'silent',
    eligible: ['r', 'w', 'a'],
    order: ['r', 'w', 'a'],
    tieOrder: ['r', 'w', 'a'],
  });
  for (const [actor, amount] of [
    ['r', 0],
    ['w', 6],
    ['a', 0],
  ] as const)
    lot = submitRicheseBid(lot, { event: lot.event, actor, amount }, 10);
  return {
    lot,
    owner: { id: 'r', handCount: 1, handLimit: 4 },
    winner: { id: 'w', handCount: 2, handLimit: 4, spice: 4 },
    card,
    funding: { amount: 6, allyPayment: 2, donor: 'a' },
    allyCredit: { amount: 2 },
  };
}
function unbid(source: RicheseAuctionSource): RicheseSettlementInput {
  const value = input(source);
  value.lot = { ...value.lot, outcome: { kind: 'unbid' } };
  value.card = null;
  value.winner = null;
  value.funding = null;
  value.allyCredit = null;
  return value;
}
function reject(value: RicheseSettlementInput, pattern?: RegExp) {
  const before = structuredClone(value);
  assert.throws(
    () => quoteRicheseSettlement(value),
    pattern ?? RicheseSettlementError,
  );
  assert.deepEqual(value, before);
}

void test('sold cache and Black Market quotes retain exact declared payer splits and detached physical cards', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    const value = input(source),
      before = structuredClone(value);
    const quote = quoteRicheseSettlement(value);
    assert.deepEqual(quote, {
      kind: 'sold',
      card: value.card,
      winner: 'w',
      amount: 6,
      ownPayment: 4,
      allyPayment: 2,
    });
    assert.deepEqual(value, before);
    assert.equal(quote.kind, 'sold');
    if (quote.kind !== 'sold') throw Error('Missing sold quote');
    quote.card.name = 'Detached test copy';
    assert.deepEqual(value, before);
  }
});

void test('every affordable exact split is accepted without silently substituting available ally funds', () => {
  for (let amount = 0; amount <= 8; amount++)
    for (let allyPayment = 0; allyPayment <= amount; allyPayment++)
      for (const extra of [0, 4]) {
        const value = input();
        value.lot = {
          ...value.lot,
          outcome: { kind: 'sold', winner: 'w', amount },
        };
        value.winner = {
          ...value.winner!,
          spice: amount - allyPayment + extra,
        };
        value.funding = {
          amount,
          allyPayment,
          donor: allyPayment ? 'a' : null,
        };
        value.allyCredit = allyPayment ? { amount: allyPayment + extra } : null;
        const result = quoteRicheseSettlement(value);
        assert.equal(result.kind, 'sold');
        if (result.kind !== 'sold') throw Error('Missing quote');
        assert.equal(result.ownPayment, amount - allyPayment);
        assert.equal(result.allyPayment, allyPayment);
        // Even enough total funds do not authorize moving a declared share.
        if (allyPayment > 0) {
          value.allyCredit = { amount: allyPayment - 1 };
          reject(value, /no longer funded/);
        }
      }
});

void test('source-specific unbid branches preserve retain, future choice and automatic removal', () => {
  const blackMarket = unbid('blackMarket');
  blackMarket.owner = { id: 'r', handCount: 8, handLimit: 4 };
  assert.deepEqual(quoteRicheseSettlement(blackMarket), {
    kind: 'retainBlackMarket',
  });
  const cache = unbid('cache');
  assert.deepEqual(quoteRicheseSettlement(cache), { kind: 'chooseUnbidCache' });
  cache.owner = { ...cache.owner, handCount: 4 };
  reject(cache, /reserved auction card/);
  cache.card = richeseCards()[0];
  const result = quoteRicheseSettlement(cache);
  assert.deepEqual(result, { kind: 'removeCache', card: cache.card });
  if (result.kind !== 'removeCache') throw Error('Missing removal quote');
  result.card.id = 'detached';
  assert.equal(cache.card.id, cache.lot.cardId);
});

void test('an open lot performs no settlement or future availability checks', () => {
  const value = unbid('cache');
  value.lot = { ...value.lot, outcome: null };
  const before = structuredClone(value);
  assert.deepEqual(quoteRicheseSettlement(value), { kind: 'open' });
  assert.deepEqual(value, before);
});

void test('sold validation retains reserved-card, hand-capacity, self-purchase and exact-funding precedence', () => {
  const value = input('blackMarket');
  value.winner = { id: 'r', handCount: 4, handLimit: 4, spice: 0 };
  value.lot = {
    ...value.lot,
    outcome: { kind: 'sold', winner: 'r', amount: 6 },
  };
  value.card = null;
  value.funding = null;
  reject(value, /reserved auction card/);
  value.card = richeseCards()[0];
  reject(value, /winning hand has no room/);
  value.winner = { ...value.winner, handCount: 3 };
  reject(value, /Black Market self-purchase/);
  value.lot = { ...value.lot, source: 'cache' };
  reject(value, /exact funding commitment/);
  value.funding = { amount: 6, allyPayment: 2, donor: 'a' };
  reject(value, /no longer funded/);
  value.winner = { ...value.winner, spice: 4 };
  assert.equal(
    quoteRicheseSettlement(value).kind,
    'sold',
    'cache owner purchase remains accepted',
  );
});

void test('server-supplied faction hand limits preserve last-slot purchases and reject full winners', () => {
  for (const limit of [4, 5, 8]) {
    const value = input();
    value.winner = { ...value.winner!, handLimit: limit, handCount: limit - 1 };
    assert.equal(quoteRicheseSettlement(value).kind, 'sold');
    value.winner = { ...value.winner!, handCount: limit };
    reject(value, /winning hand has no room/);
  }
});

void test('missing source card, seated identities and exact funding reject without mutation', () => {
  const mutations: ((value: RicheseSettlementInput) => void)[] = [
    (v) => {
      v.owner = { ...v.owner, id: 'missing' };
    },
    (v) => {
      v.winner = null;
    },
    (v) => {
      v.winner = { ...v.winner!, id: 'r' };
    },
    (v) => {
      v.card = null;
    },
    (v) => {
      v.card = { ...v.card!, id: 'different-physical-id' };
    },
    (v) => {
      v.funding = null;
    },
    (v) => {
      v.funding = { ...v.funding!, amount: 5 };
    },
    (v) => {
      v.allyCredit = null;
    },
    (v) => {
      v.allyCredit = { amount: 1 };
    },
    (v) => {
      v.winner = { ...v.winner!, spice: 3 };
    },
  ];
  for (const mutate of mutations) {
    const value = input();
    mutate(value);
    reject(value);
  }
});

void test('malformed saved counts and payment numbers fail with the module error class', () => {
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const field of ['handCount', 'handLimit', 'spice'] as const) {
      const value = input();
      value.winner = { ...value.winner!, [field]: invalid };
      reject(value);
    }
    for (const field of ['amount', 'allyPayment'] as const) {
      const value = input();
      value.funding = { ...value.funding!, [field]: invalid };
      if (field === 'amount')
        value.lot = {
          ...value.lot,
          outcome: { kind: 'sold', winner: 'w', amount: invalid },
        };
      reject(value);
    }
    const value = input();
    value.allyCredit = { amount: invalid };
    reject(value);
  }
  const over = input();
  over.funding = { amount: 6, allyPayment: 7, donor: 'a' };
  reject(over);
  const emptyLimit = input();
  emptyLimit.winner = { ...emptyLimit.winner!, handLimit: 0 };
  reject(emptyLimit);
});

void test('Black Market declaration exhaustion is a separate pure immediate-continuation guard', () => {
  const value = unbid('blackMarket'),
    before = structuredClone(value);
  assert.deepEqual(quoteRicheseSettlement(value), {
    kind: 'retainBlackMarket',
  });
  for (const count of [undefined, 0, -1, 0.5, Infinity, NaN])
    assert.throws(
      () => requireRicheseDeclarationCache(count),
      RicheseSettlementError,
    );
  for (const count of [1, 2, 10])
    assert.doesNotThrow(() => requireRicheseDeclarationCache(count));
  assert.deepEqual(value, before);
  // A sold lot can first suspend for replacement/bonus; quote is not phase advancement.
  assert.equal(quoteRicheseSettlement(input('blackMarket')).kind, 'sold');
});

void test('repeated pure preflight needs no RNG or UUID and returns only bounded settlement data', (t) => {
  const value = input(),
    before = structuredClone(value);
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('No random draws');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('No new events');
  });
  const one = quoteRicheseSettlement(value);
  assert.deepEqual(quoteRicheseSettlement(structuredClone(value)), one);
  requireRicheseDeclarationCache(1);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
  assert.deepEqual(value, before);
  assert.deepEqual(Object.keys(one).sort(), [
    'allyPayment',
    'amount',
    'card',
    'kind',
    'ownPayment',
    'winner',
  ]);
});

/** Observe the existing production settlement for a behavioral comparison; no
 * runtime export or gate is changed and no private helper is invoked as a quote. */
const observed: { settleRicheseLot?: (g: Game) => void } = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { settleRicheseLot };\n',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function engineFixture(source: RicheseAuctionSource) {
  const g = createGame(
    'SETTLEQUOTE',
    newPlayer('r', 'Richese', 'richese'),
    true,
  );
  g.players.push(
    newPlayer('w', 'Winner', 'harkonnen'),
    newPlayer('a', 'Ally', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 3,
    turn: 2,
    order: ['w', 'a', 'r'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.spice = 10;
    p.hand = [];
    p.traitorChoices = [];
    p.traitors = [];
  }
  const value = input(source);
  g.richeseAuction = structuredClone(value.lot);
  if (source === 'blackMarket')
    g.players[0].hand.push(g.richeseCache!.splice(0, 1)[0]);
  g.players[1].ally = 'a';
  g.players[2].ally = 'w';
  g.aid.a = { recipient: 'w', amount: 2 };
  g.richeseFunding = { w: { amount: 6, allyPayment: 2, donor: 'a' } };
  g.richeseBidding = {
    owner: 'r',
    event: 'round2',
    turn: 2,
    stage: 'lot',
    position: source === 'cache' ? 'first' : null,
    normalCount: source === 'cache' ? 1 : null,
    blackMarketSold: false,
    cacheCanceled: false,
  };
  return g;
}
function engineInput(g: Game): RicheseSettlementInput {
  const lot = g.richeseAuction!,
    owner = g.players.find((p) => p.id === lot.owner)!,
    winner =
      lot.outcome?.kind === 'sold'
        ? g.players.find(
            (p) => p.id === (lot.outcome as { winner: string }).winner,
          )
        : undefined;
  return {
    lot,
    owner: {
      id: owner.id,
      handCount: owner.hand.length,
      handLimit: handLimit(owner),
    },
    winner: winner
      ? {
          id: winner.id,
          handCount: winner.hand.length,
          handLimit: handLimit(winner),
          spice: winner.spice,
        }
      : null,
    card: (lot.source === 'cache' ? g.richeseCache : owner.hand)?.find(
      (c) => c.id === lot.cardId,
    ),
    funding: winner ? g.richeseFunding?.[winner.id] : null,
    allyCredit:
      winner?.ally && g.aid[winner.ally]?.recipient === winner.id
        ? g.aid[winner.ally]
        : null,
  };
}
void test('quotes agree with real sold settlement debits, transfer and deferred Harkonnen bonus', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    const g = engineFixture(source),
      before = structuredClone(g),
      quote = quoteRicheseSettlement(engineInput(g));
    assert.equal(quote.kind, 'sold');
    if (quote.kind !== 'sold') throw Error('Missing sale quote');
    assert.deepEqual(g, before);
    observed.settleRicheseLot!(g);
    assert.equal(
      g.players[1].spice,
      before.players[1].spice - quote.ownPayment,
    );
    assert.equal(g.aid.a.amount, before.aid.a.amount - quote.allyPayment);
    assert.equal(
      g.players[1].hand.filter((c) => c.id === quote.card.id).length,
      1,
    );
    assert.equal(g.players[0].spice, before.players[0].spice + quote.amount);
    assert.equal(g.response?.kind, 'harkonnenBonus');
    assert.equal(g.currentAuctionSale?.free, false);
    assert.equal(g.currentAuctionSale?.origin, source);
  }
});
void test('a canceled unbid Black Market has the same exhausted-cache boundary as live continuation', () => {
  for (const exhausted of [false, true]) {
    const g = engineFixture('blackMarket');
    g.richeseAuction!.outcome = { kind: 'unbid' };
    if (exhausted) g.richeseCache = [];
    const before = structuredClone(g);
    assert.equal(
      quoteRicheseSettlement(engineInput(g)).kind,
      'retainBlackMarket',
    );
    if (exhausted) {
      assert.throws(
        () => requireRicheseDeclarationCache(g.richeseCache?.length),
        /exhausted Richese cache/,
      );
      assert.throws(
        () => observed.settleRicheseLot!(structuredClone(g)),
        /exhausted Richese cache/,
      );
      assert.deepEqual(g, before);
    } else {
      requireRicheseDeclarationCache(g.richeseCache?.length);
      observed.settleRicheseLot!(g);
      assert.equal(g.decision?.kind, 'richeseDeclaration');
      assert.equal(g.richeseBidding!.blackMarketSold, false);
      assert.deepEqual(g.players, before.players);
    }
  }
});
