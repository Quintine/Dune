import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import {
  validateTerminalCancellation,
  TerminalCancellationError,
  type TerminalCancellationKind,
} from '../game/terminal-cancellation';
const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(
  faction: 'guild' | 'atreides' | 'fremen' | 'choam' | 'tleilaxu' = 'atreides',
  advanced = true,
) {
  const g = createGame(
    'TERMINAL',
    newPlayer('b', 'Sisterhood', 'beneGesserit'),
    advanced,
    faction === 'choam' ? ['choam'] : faction === 'tleilaxu' ? ['ix'] : [],
  );
  g.players.push(
    newPlayer('k', 'Canceler', 'harkonnen'),
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('p', 'Power', faction),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'e',
    order: ['e', 'p', 'b', 'k'],
    movementRemaining: ['e', 'p', 'b', 'k'],
    deck: baseDeck(),
    spiceDeck: spiceDeck(),
    phaseOpening: null,
    ready: [],
  });
  for (const seat of g.players)
    Object.assign(seat, {
      hand: [],
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
      traitors: [],
      traitorChoices: [],
    });
  hold(g, 'k', 'karama');
  hold(g, 'b', 'worthless');
  return g;
}
function hold(g: Game, id: string, kind: string) {
  const at = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
  assert.ok(at >= 0);
  const c = g.deck.splice(at, 1)[0];
  p(g, id).hand.push(c);
  return c;
}
function ready(g: Game) {
  for (const seat of g.players) g = applyAction(g, seat.id, { type: 'ready' });
  return g;
}
function openPhase(g: Game) {
  g = ready(g);
  if (g.phaseOpening) g = ready(g);
  return g;
}
type Case = TerminalCancellationKind | 'gholaIncome';
function opportunity(kind: Case, advanced = true) {
  const faction =
    kind === 'guildIncome'
      ? 'guild'
      : kind === 'revivalIncome' ||
          kind === 'gholaIncome' ||
          kind === 'faceDancerReplacement'
        ? 'tleilaxu'
        : kind === 'choamCharity' || kind === 'choamInflation'
          ? 'choam'
          : kind === 'stormPeek'
            ? 'fremen'
            : 'atreides';
  let g = fixture(faction, advanced);
  if (kind === 'emperorGift' || kind === 'emperorRevival') {
    p(g, 'e').ally = 'p';
    p(g, 'p').ally = 'e';
    if (kind === 'emperorRevival') {
      g.phase = 4;
      p(g, 'p').tanks = 3;
      p(g, 'p').reserves = 17;
    }
    return applyAction(g, 'e', { type: kind, amount: 2 });
  }
  if (kind === 'guildIncome') {
    g = applyAction(g, 'e', {
      type: 'ship',
      territory: 'polar_sink',
      sector: 0,
      amount: 2,
    });
    if (g.decision?.kind === 'guildShipment')
      g = applyAction(g, 'p', { type: 'decision', allow: true });
    return g;
  }
  if (kind === 'revivalIncome' || kind === 'gholaIncome') {
    p(g, 'p').specialKaramaUsed = true;
    p(g, 'e').tanks = 3;
    p(g, 'e').reserves = 17;
    if (kind === 'revivalIncome') {
      g.phase = 4;
      return applyAction(g, 'e', { type: 'revive', amount: 2 });
    }
    const card = hold(g, 'e', 'ghola');
    return applyAction(g, 'e', { type: 'card', card: card.id, amount: 2 });
  }
  if (kind === 'bgCharity') {
    g.phase = 2;
    p(g, 'b').spice = 5;
    return applyAction(g, 'b', { type: 'charity' });
  }
  if (kind === 'choamCharity') {
    g.phase = 1;
    g.nexus = true;
    g.active = null;
    g = openPhase(g);
    if (g.decision?.kind === 'choamMarket')
      g = applyAction(g, 'p', { type: 'decision', done: true });
    return g;
  }
  if (kind === 'choamInflation') {
    g.phase = 8;
    return applyAction(g, 'p', { type: 'choamInflation', side: 'double' });
  }
  if (kind === 'stormPeek') {
    g.phase = 0;
    g.stormPending = 1;
    g.stormDialers = [];
    return openPhase(g);
  }
  if (kind === 'atreidesSpice') {
    g.phase = 4;
    return openPhase(g);
  }
  if (kind === 'atreidesAuction') {
    g.phase = 2;
    return openPhase(g);
  }
  if (kind === 'faceDancerReplacement') {
    g.phase = 8;
    p(g, 'p').faceDancers = [
      { leader: p(g, 'e').leaders[0].id, revealed: false },
    ];
    return applyAction(g, 'p', {
      type: 'replaceFaceDancer',
      leader: p(g, 'p').faceDancers![0].leader,
    });
  }
  g = applyAction(g, 'e', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.decision?.kind, 'advisor');
  return applyAction(g, 'b', { type: 'decision', accept: true });
}
const cases: Case[] = [
  'advisor',
  'emperorGift',
  'emperorRevival',
  'guildIncome',
  'revivalIncome',
  'gholaIncome',
  'bgCharity',
  'choamCharity',
  'choamInflation',
  'stormPeek',
  'atreidesSpice',
  'atreidesAuction',
  'faceDancerReplacement',
];
function quote(g: Game) {
  assert.ok(g.response);
  return validateTerminalCancellation(g, g.response);
}
function cancel(g: Game, bg = false) {
  const actor = bg ? 'b' : 'k',
    card = p(g, actor).hand.find((c) =>
      bg ? c.kind === 'worthless' : c.effect === 'karama',
    )!;
  assert.ok(card);
  let done = applyAction(g, actor, {
    type: 'card',
    card: card.id,
    mode: 'cancel',
  });
  if (bg) {
    assert.equal(done.response?.kind, 'worthlessKarama');
    while (done.response?.kind === 'worthlessKarama')
      done = applyAction(
        done,
        done.players.find((p) => !done.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
  }
  assert.equal(done.discard.filter((c) => c.id === card.id).length, 1);
  return done;
}
for (const kind of cases)
  void test(`${kind} genuine terminal cancellation quote is pure, private and does not sample denied effects`, (t) => {
    const g = opportunity(kind);
    assert.equal(
      g.response?.kind,
      kind === 'gholaIncome' ? 'revivalIncome' : kind,
    );
    const before = structuredClone(g);
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('Pure terminal quote drew randomness');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('Pure terminal quote generated UUID');
    });
    const result = quote(g);
    assert.ok(result);
    assert.deepEqual(quote(g), result);
    assert.deepEqual(g, before);
    for (const seat of g.players)
      Object.defineProperty(seat, 'hand', {
        get() {
          throw Error('Terminal quote read private hand');
        },
      });
    assert.deepEqual(quote(g), result);
    assert.equal(JSON.stringify(result).includes('card'), false);
    assert.equal(JSON.stringify(result).includes('leader'), false);
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });
for (const kind of cases)
  for (const bg of [false, true]) {
    if (bg && (kind === 'advisor' || kind === 'bgCharity')) continue;
    void test(`${bg ? 'BG' : 'printed'} ${kind} cancellation preserves committed resources and applies only terminal flags`, () => {
      const g = opportunity(kind),
        q = quote(g)!;
      const done = cancel(reload(g), bg);
      assert.deepEqual(
        done.players.map((p) => ({
          spice: p.spice,
          reserves: p.reserves,
          tanks: p.tanks,
          forces: p.forces,
          elites: p.elites,
          faceDancers: p.faceDancers,
        })),
        g.players.map((p) => ({
          spice: p.spice,
          reserves: p.reserves,
          tanks: p.tanks,
          forces: p.forces,
          elites: p.elites,
          faceDancers: p.faceDancers,
        })),
      );
      if (q.kind === 'choamCharity')
        assert.deepEqual(done.choamCharity, q.receipt);
      else if (q.kind === 'stormPeek')
        assert.equal(done.stormCardKnown, q.known);
      else if (q.kind === 'atreidesSpice')
        assert.equal(done.spicePeekKnown, q.known);
      else if (q.kind === 'atreidesAuction')
        assert.equal(done.auction!.peekKnown, q.known);
      else if (q.kind === 'choamInflation') {
        assert.equal(done.inflation, g.inflation);
        assert.equal(done.inflationAttemptTurn, g.turn);
      } else if (q.kind === 'faceDancerReplacement')
        assert.equal(p(done, 'p').faceDancerReplacedTurn, g.turn);
      assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
    });
  }
void test('Basic Emperor gifts, extra revivals, income, advisor shipment and expansion attempt variants retain their existing availability', () => {
  for (const kind of [
    'emperorGift',
    'emperorRevival',
    'guildIncome',
    'revivalIncome',
    'gholaIncome',
    'advisor',
    'choamCharity',
    'choamInflation',
    'atreidesSpice',
    'atreidesAuction',
    'faceDancerReplacement',
  ] as const) {
    const g = opportunity(kind, false);
    assert.ok(quote(g));
    assert.doesNotThrow(() => cancel(g));
  }
});
void test('denied effects do not require current payment, force placement, charity funds or a replacement candidate', () => {
  for (const kind of [
    'emperorGift',
    'emperorRevival',
    'advisor',
    'faceDancerReplacement',
    'bgCharity',
  ] as const) {
    const g = opportunity(kind);
    if (kind === 'emperorGift' || kind === 'emperorRevival') {
      p(g, 'e').spice = 0;
      p(g, 'p').tanks = 0;
      p(g, 'p').reserves = 20;
    } else if (kind === 'advisor') {
      p(g, 'b').reserves = 0;
      g.storm = 1;
    } else if (kind === 'faceDancerReplacement') p(g, 'p').faceDancers = [];
    else {
      p(g, 'b').spice = 0;
      g.players.push(newPlayer('c', 'CHOAM', 'choam'));
      g.order.push('c');
      p(g, 'c').spice = 0;
    }
    assert.ok(quote(g));
    assert.doesNotThrow(() => cancel(g));
  }
});
void test('gift and Ghola income keep valid non-Revival phase variants, and legacy omitted advisor destination remains Polar Sink', () => {
  let g = fixture();
  g.phase = 1;
  p(g, 'e').ally = 'p';
  p(g, 'p').ally = 'e';
  g = applyAction(g, 'e', { type: 'emperorGift', amount: 2 });
  assert.ok(quote(g));
  assert.doesNotThrow(() => cancel(g, true));
  const ghola = opportunity('gholaIncome');
  assert.equal(ghola.phase, 5);
  assert.ok(quote(ghola));
  const advisor = opportunity('advisor', false);
  delete advisor.response!.location;
  assert.ok(quote(advisor));
  assert.doesNotThrow(() => cancel(advisor));
});
void test('unknown families and Richese auction peeks explicitly retain their separate validation contracts', () => {
  const g = fixture();
  assert.equal(
    validateTerminalCancellation(g, { kind: 'voice', owner: 'b', passed: [] }),
    null,
  );
  g.richeseAuction = {} as NonNullable<Game['richeseAuction']>;
  assert.equal(
    validateTerminalCancellation(g, {
      kind: 'atreidesAuction',
      owner: 'p',
      passed: [],
    }),
    null,
  );
});
for (const kind of cases)
  void test(`${kind} malformed source owner and concrete receipt fields reject without mutation`, () => {
    const original = opportunity(kind);
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.response!.owner = 'missing';
      },
      (g) => {
        g.response!.owner = 'k';
      },
      (g) => {
        g.turn = 0;
      },
    ];
    if (
      kind === 'emperorGift' ||
      kind === 'emperorRevival' ||
      kind === 'guildIncome' ||
      kind === 'revivalIncome' ||
      kind === 'gholaIncome' ||
      kind === 'bgCharity'
    )
      mutations.push((g) => {
        g.response!.amount = -1;
      });
    if (
      kind === 'emperorGift' ||
      kind === 'emperorRevival' ||
      kind === 'revivalIncome' ||
      kind === 'gholaIncome'
    )
      mutations.push((g) => {
        g.response!.recipient = 'missing';
      });
    if (kind === 'emperorRevival')
      mutations.push((g) => {
        g.response!.elite = 99;
      });
    if (kind === 'stormPeek')
      mutations.push(
        (g) => {
          g.stormCard = 0;
        },
        (g) => {
          g.phase = 0;
        },
      );
    if (kind === 'atreidesSpice')
      mutations.push((g) => {
        g.spiceDeck = [];
      });
    if (kind === 'atreidesAuction')
      mutations.push((g) => {
        g.auction = null;
      });
    if (kind === 'choamInflation')
      mutations.push((g) => {
        g.response!.intent = 'unknown';
      });
    if (kind === 'choamCharity')
      mutations.push((g) => {
        g.phase = 3;
      });
    if (kind === 'faceDancerReplacement')
      mutations.push(
        (g) => {
          p(g, 'p').faceDancers = undefined;
        },
        (g) => {
          p(g, 'p').faceDancerReplacedTurn = g.turn - 1;
        },
      );
    if (kind === 'advisor')
      mutations.push((g) => {
        g.response!.location = 'polar_sink:00';
      });
    for (const mutate of mutations) {
      const g = reload(original);
      mutate(g);
      const before = structuredClone(g);
      assert.throws(() => quote(g), TerminalCancellationError);
      assert.deepEqual(g, before);
    }
  });

for (const kind of cases)
  for (const bg of [false, true]) {
    if (bg && (kind === 'advisor' || kind === 'bgCharity')) continue;
    void test(`${bg ? 'BG' : 'printed'} ${kind} rejects malformed live receipt before card cost`, (t) => {
      const original = opportunity(kind);
      const mutations: ((g: Game) => void)[] = [
        (g) => {
          g.response!.owner = 'missing';
        },
        (g) => {
          g.turn = 0;
        },
      ];
      if (
        [
          'emperorGift',
          'emperorRevival',
          'guildIncome',
          'revivalIncome',
          'gholaIncome',
          'bgCharity',
        ].includes(kind)
      )
        mutations.push((g) => {
          g.response!.amount = Number.NaN;
        });
      if (
        kind === 'emperorGift' ||
        kind === 'emperorRevival' ||
        kind === 'revivalIncome' ||
        kind === 'gholaIncome'
      )
        mutations.push((g) => {
          g.response!.recipient = 'missing';
        });
      if (kind === 'advisor')
        mutations.push((g) => {
          g.response!.location = 'polar_sink:01';
        });
      if (kind === 'emperorRevival')
        mutations.push(
          (g) => {
            g.phase = 5;
          },
          (g) => {
            g.response!.elite = 3;
          },
        );
      if (kind === 'guildIncome')
        mutations.push((g) => {
          g.phase = 4;
        });
      if (kind === 'bgCharity')
        mutations.push((g) => {
          p(g, 'b').charityTurn = g.turn - 1;
        });
      if (kind === 'choamCharity')
        mutations.push((g) => {
          g.phase = 3;
        });
      if (kind === 'choamInflation')
        mutations.push(
          (g) => {
            g.inflationAttemptTurn = g.turn - 1;
          },
          (g) => {
            g.response!.intent = 'wrong';
          },
        );
      if (kind === 'stormPeek')
        mutations.push(
          (g) => {
            g.stormCard = 9;
          },
          (g) => {
            g.phase = 0;
          },
        );
      if (kind === 'atreidesSpice')
        mutations.push((g) => {
          g.spiceDeck = [];
        });
      if (kind === 'atreidesAuction')
        mutations.push(
          (g) => {
            g.auction = null;
          },
          (g) => {
            g.auction!.index = g.auction!.cards.length;
          },
        );
      if (kind === 'faceDancerReplacement')
        mutations.push(
          (g) => {
            p(g, 'p').faceDancers = undefined;
          },
          (g) => {
            p(g, 'p').faceDancerReplacedTurn = g.turn - 1;
          },
        );
      const random = t.mock.method(crypto, 'getRandomValues', () => {
        throw Error('Rejected terminal cancellation drew randomness');
      });
      const uuid = t.mock.method(crypto, 'randomUUID', () => {
        throw Error('Rejected terminal cancellation generated event');
      });
      for (const mutate of mutations) {
        const g = reload(original);
        mutate(g);
        const before = structuredClone(g),
          actor = bg ? 'b' : 'k';
        const card = p(g, actor).hand.find((c) =>
          bg ? c.kind === 'worthless' : c.effect === 'karama',
        )!;
        assert.throws(() =>
          applyAction(g, actor, {
            type: 'card',
            card: card.id,
            mode: 'cancel',
          }),
        );
        assert.deepEqual(g, before);
        assert.ok(p(g, actor).hand.some((c) => c.id === card.id));
        assert.equal(
          g.discard.some((c) => c.id === card.id),
          false,
        );
        assert.equal(g.pendingKarama, before.pendingKarama);
      }
      assert.equal(random.mock.callCount(), 0);
      assert.equal(uuid.mock.callCount(), 0);
    });
  }
