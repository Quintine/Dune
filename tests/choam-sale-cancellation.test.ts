import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  createGame,
  newPlayer,
  applyAction,
  viewGame,
  type Game,
  type ResponseWindow,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  quoteChoamSaleCancellation,
  ChoamSaleCancellationError,
} from '../game/choam-sale-cancellation';
function fixture(duplicate = false) {
  let g = createGame('SALEQUOTE', newPlayer('c', 'CHOAM', 'choam'), true, [
    'choam',
  ]);
  g.players.push(
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 2,
    turn: 2,
    storm: 18,
    order: ['c', 'b', 'e'],
    deck: baseDeck(),
    phaseOpening: null,
    choamCharity: { turn: 2, canceled: false },
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 20,
      forces: {},
      reserves: 20,
      traitors: [],
      traitorChoices: [],
    });
  const hold = (who: number, kind: string) => {
    const at = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[who].hand.push(card);
    return card;
  };
  const card = hold(0, duplicate ? 'snooper' : 'worthless'),
    witness = duplicate ? hold(0, 'snooper') : null,
    cost = hold(1, 'worthless'),
    printed = hold(2, 'karama');
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamMarket');
  g = applyAction(g, 'c', {
    type: 'decision',
    mode: 'sell',
    card: card.id,
    ...(witness ? { witness: witness.id } : {}),
  });
  assert.equal(g.response?.kind, 'choamSale');
  return { g, card, witness, cost, printed };
}
function cancel(g: Game, bg: boolean, card: string) {
  let done = applyAction(g, bg ? 'b' : 'e', {
    type: 'card',
    card,
    mode: 'cancel',
  });
  for (let tries = 0; done.response?.kind === 'worthlessKarama'; tries++) {
    assert.ok(tries < 10);
    done = applyAction(
      done,
      done.players.find((p) => !done.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  }
  return done;
}
for (const duplicate of [false, true])
  for (const bg of [false, true])
    void test(`${bg ? 'BG' : 'printed'} cancellation preserves ${duplicate ? 'duplicate' : 'Worthless'} sale, price and exact next market`, () => {
      const f = fixture(duplicate),
        before = structuredClone(f.g),
        q = quoteChoamSaleCancellation(f.g, f.g.response!)!;
      assert.deepEqual(f.g, before);
      const spent = bg ? f.cost : f.printed,
        done = cancel(JSON.parse(JSON.stringify(f.g)), bg, spent.id);
      assert.deepEqual(done.choamMarket, q.market);
      assert.deepEqual(done.decision, q.decision);
      assert.equal(done.players[0].spice, 20);
      assert.ok(done.players[0].hand.some((c) => c.id === f.card.id));
      assert.equal(done.discard.filter((c) => c.id === spent.id).length, 1);
      assert.equal(
        done.discard.some((c) => c.id === f.card.id),
        false,
      );
      assert.deepEqual(viewGame(done, 'e').choamMarket, { owner: 'c' });
      assert.throws(() =>
        applyAction(done, 'c', {
          type: 'decision',
          mode: 'sell',
          card: f.card.id,
          witness: f.witness?.id,
        }),
      );
    });
void test('denied sale does not require its selected card, duplicate witness or current funds to remain available', () => {
  const f = fixture(true);
  f.g.discard.push(...f.g.players[0].hand);
  f.g.players[0].hand = [];
  f.g.players[0].spice = 0;
  const q = quoteChoamSaleCancellation(f.g, f.g.response!)!;
  const done = cancel(f.g, true, f.cost.id);
  assert.deepEqual(done.choamMarket, q.market);
  assert.equal(done.decision?.kind, 'choamMarket');
  assert.equal(done.players[0].spice, 0);
});
void test('a canceled BG conversion restores the exact sale instead of denying it', () => {
  const f = fixture();
  let g = applyAction(f.g, 'b', {
    type: 'card',
    card: f.cost.id,
    mode: 'cancel',
  });
  assert.equal(g.response?.kind, 'worthlessKarama');
  g = applyAction(g, 'e', { type: 'card', card: f.printed.id, mode: 'cancel' });
  assert.equal(g.choamMarket?.blocked.length, 0);
  // No blocking cards remain, so the original sale is automatically allowed.
  assert.equal(g.players[0].spice, 22);
  assert.equal(g.discard.filter((c) => c.id === f.card.id).length, 1);
  assert.equal(g.discard.filter((c) => c.id === f.cost.id).length, 1);
  assert.equal(g.discard.filter((c) => c.id === f.printed.id).length, 1);
});
void test('malformed market owner, resume, blocked list and sale shape reject before both costs without mutation', () => {
  const f = fixture();
  const corrupt: ((g: Game) => void)[] = [
    (g) => {
      g.choamMarket = null;
    },
    (g) => {
      g.choamMarket!.owner = 'e';
    },
    (g) => {
      g.phase = 1;
      g.choamMarket!.resume = 'storm';
    },
    (g) => {
      g.choamMarket!.blocked = ['same', 'same'];
    },
    (g) => {
      g.choamMarket!.blocked = [f.card.id];
    },
    (g) => {
      g.choamMarket!.sale!.price = 99;
    },
    (g) => {
      g.choamMarket!.sale!.witness = f.card.id;
    },
    (g) => {
      delete g.choamMarket!.sale;
    },
    (g) => {
      g.choamMarket!.trade = { ally: 'e', offered: f.card.id };
    },
  ];
  for (const change of corrupt)
    for (const bg of [false, true]) {
      const g = structuredClone(f.g);
      change(g);
      const before = structuredClone(g);
      assert.throws(
        () => quoteChoamSaleCancellation(g, g.response!),
        ChoamSaleCancellationError,
      );
      assert.throws(() =>
        applyAction(g, bg ? 'b' : 'e', {
          type: 'card',
          card: (bg ? f.cost : f.printed).id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(g, before);
    }
});
void test('pure sale cancellation reads no private hand and neither samples nor allocates events', (t) => {
  const f = fixture(true),
    q = quoteChoamSaleCancellation(f.g, f.g.response!),
    before = structuredClone(f.g);
  const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('RNG');
    }),
    uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('UUID');
    });
  for (const p of f.g.players)
    for (const field of ['hand', 'spice', 'leaders', 'traitors'])
      Object.defineProperty(p, field, {
        get() {
          throw Error('Private ' + field);
        },
      });
  for (let i = 0; i < 10; i++)
    assert.deepEqual(quoteChoamSaleCancellation(f.g, f.g.response!), q);
  assert.deepEqual(q?.market.blocked, [f.card.id]);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
  assert.deepEqual(before.choamMarket?.blocked, []);
});
void test('storm market resume remains a decision and unrelated response families remain outside this quote', () => {
  const f = fixture();
  f.g.phase = 0;
  f.g.choamMarket!.resume = 'storm';
  assert.equal(
    quoteChoamSaleCancellation(f.g, f.g.response!)?.market.resume,
    'storm',
  );
  assert.equal(
    quoteChoamSaleCancellation(f.g, {
      kind: 'guildIncome',
      owner: 'e',
      passed: [],
    }),
    null,
  );
});
const observed: {} & { finishResponse?: (g: Game, canceled: boolean) => void } =
  {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport {finishResponse};',
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
    crypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
void test('an unknown saved response cannot fall through to free advisor shipment in either direction', () => {
  for (const canceled of [false, true]) {
    const g = createGame('UNKNOWN', newPlayer('b', 'BG', 'beneGesserit'));
    g.status = 'playing';
    g.phase = 5;
    g.response = {
      kind: 'unknownPower',
      owner: 'b',
      passed: [],
    } as unknown as ResponseWindow;
    const p = structuredClone(g.players[0]),
      logs = structuredClone(g.log);
    assert.throws(
      () => observed.finishResponse!(g, canceled),
      /Unknown faction response/,
    );
    assert.deepEqual(g.players[0], p);
    assert.deepEqual(g.log, logs);
  }
});
