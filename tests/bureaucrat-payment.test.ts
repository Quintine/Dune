import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  bureaucratPaymentModeSupported,
  bureaucratPaymentSignature,
  bureaucratUsed,
  quoteBureaucratPayment,
} from '../game/bureaucrat-payment';
import {
  bureaucratPaymentGame,
  bureaucratPlayer,
  bureaucratReload,
  beginBureaucratAuction,
  takeBureaucratCard,
  allowBureaucratIncome,
} from './bureaucrat-payment-fixture';

const ship: Action = {
  type: 'ship',
  territory: 'arrakeen',
  sector: 10,
  amount: 5,
};
const bribe: Action = { type: 'bribe', target: 'e', amount: 5 };
function choose(g: Game, redirect = true): Game {
  return applyAction(g, 'b', {
    type: 'decision',
    event: g.bureaucratPaymentEvent,
    redirect,
  });
}
function reject(g: Game, id: string, action: Action, pattern?: RegExp) {
  const before = JSON.stringify(g);
  if (pattern) assert.throws(() => applyAction(g, id, action), pattern);
  else assert.throws(() => applyAction(g, id, action));
  assert.equal(JSON.stringify(g), before);
}
function cards(g: Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...(g.auction?.cards.slice(
      g.auction.index + (g.currentAuctionSale?.origin === 'normal' ? 1 : 0),
    ) ?? []),
  ]
    .map((card) => card.id)
    .sort();
}
function normalSale(g: Game, amount = 5): Game {
  while (g.auction?.active !== 'p')
    g = applyAction(g, g.auction!.active, { type: 'passBid' });
  g = applyAction(g, 'p', { type: 'bid', amount });
  for (let i = 0; g.auction && !g.currentAuctionSale && i < 12; i++)
    g = applyAction(g, g.auction.active, { type: 'passBid' });
  return g;
}
function richeseSale(source: 'cache' | 'blackMarket', advanced = false) {
  let g = bureaucratPaymentGame({ choam: true, advanced });
  const saleCard =
    source === 'blackMarket'
      ? takeBureaucratCard(g, 'r', 'Baliset')
      : g.richeseCache![0];
  g = beginBureaucratAuction(g);
  if (source === 'cache')
    g = applyAction(g, 'r', {
      type: 'decision',
      event: g.richeseBidding!.event,
      position: 'first',
    });
  g = applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    card: saleCard.id,
    method: 'silent',
  });
  for (const id of g.richeseAuction!.order)
    g = applyAction(g, id, {
      type: 'richeseBid',
      event: g.richeseAuction!.event,
      amount: id === 'p' ? 5 : 0,
    });
  return { g, saleCard };
}

void test('Bureaucrat requires two other players and tracks the unique physical skill once per phase, independent of later owner', () => {
  const input = {
    owner: 'b',
    payer: 'p',
    payee: 'g',
    amount: 5,
    turn: 2,
    phase: 5,
    used: [],
  };
  assert.deepEqual(quoteBureaucratPayment(input), { redirect: 2, income: 3 });
  for (const patch of [
    { owner: null },
    { payer: 'b' },
    { payee: 'b' },
    { payer: 'g' },
    { amount: 4 },
  ])
    assert.equal(quoteBureaucratPayment({ ...input, ...patch }), null);
  const used = [
    { event: 'spent', owner: 'former', turn: 2, phase: 5, signature: '' },
  ];
  assert.equal(quoteBureaucratPayment({ ...input, owner: 'new', used }), null);
  assert.equal(bureaucratUsed(used, 2, 6), false);
  assert.ok(
    !bureaucratPaymentModeSupported({ expansions: ['choam'], homeworlds: {} }),
  );
});
for (const advanced of [false, true])
  for (const choam of [false, true])
    void test(`single-payer ${choam ? 'CHOAM' : 'base'} ${advanced ? 'Advanced' : 'Basic'} shipment diverts two after payment without replaying arrival`, () => {
      const start = bureaucratPaymentGame({ advanced, choam }),
        inventory = cards(start);
      let pending = applyAction(start, 'p', ship);
      if (pending.decision?.kind === 'guildShipment')
        pending = applyAction(pending, 'g', { type: 'decision', allow: true });
      assert.equal(bureaucratPlayer(pending, 'p').spice, 25);
      assert.equal(bureaucratPlayer(pending, 'g').spice, 30);
      assert.equal(bureaucratPlayer(pending, 'p').forces['arrakeen:10'], 5);
      assert.equal(pending.response, null);
      assert.equal(
        pending.bureaucratPayments!.pending!.resume.response!.kind,
        'guildIncome',
      );
      const original = structuredClone(bureaucratPlayer(pending, 'p'));
      const done = choose(bureaucratReload(pending));
      assert.deepEqual(bureaucratPlayer(done, 'p'), original);
      assert.equal(bureaucratPlayer(done, 'g').spice, 33);
      assert.deepEqual(cards(done), inventory);
      assert.equal(viewGame(done, 'b').bureaucrat.usedThisPhase, true);
      assert.deepEqual(normalizeAutomaticGame(bureaucratReload(done)), done);
      reject(done, 'b', {
        type: 'decision',
        event: pending.bureaucratPaymentEvent,
        redirect: true,
      });
    });
void test('bribe diversion reduces only recipient escrow and never runs again on Mentat collection', () => {
  let g = applyAction(bureaucratPaymentGame(), 'p', bribe);
  assert.equal(bureaucratPlayer(g, 'p').spice, 25);
  assert.equal(bureaucratPlayer(g, 'e').bribes, 0);
  g = choose(g);
  assert.equal(bureaucratPlayer(g, 'e').bribes, 3);
  assert.equal(bureaucratPlayer(g, 'e').spice, 30);
  const uses = structuredClone(g.bureaucratPayments!.used);
  // Conserved phase staging reaches the actual collection callback.
  Object.assign(g, { phase: 7, active: null, ready: [], phaseOpening: null });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 8);
  assert.equal(bureaucratPlayer(g, 'e').bribes, 0);
  assert.equal(bureaucratPlayer(g, 'e').spice, 33);
  assert.deepEqual(g.bureaucratPayments!.used, uses);
  assert.equal(viewGame(g, 'b').bureaucrat.pending, null);
});
void test('decline keeps the next opportunity, while a consumed card cannot gain another use after a saved controller/assignment change', () => {
  let g = applyAction(bureaucratPaymentGame(), 'p', bribe);
  g = choose(g, false);
  assert.equal(bureaucratPlayer(g, 'e').bribes, 5);
  assert.equal(viewGame(g, 'b').bureaucrat.usedThisPhase, false);
  g = applyAction(g, 'p', bribe);
  assert.equal(g.decision?.kind, 'bureaucratPayment');
  g = choose(g);
  const assignments = g.leaderSkills!.assignments,
    old = assignments.find((a) => a.owner === 'b')!,
    next = assignments.find((a) => a.owner === 'p')!;
  // A conserved saved redraw/custody state still refers to the same physical card.
  [old.skill, next.skill] = [next.skill, old.skill];
  g = applyAction(bureaucratReload(g), 'e', {
    type: 'bribe',
    target: 'g',
    amount: 5,
  });
  assert.equal(g.decision, null);
  assert.equal(g.bureaucratPayments!.used.length, 1);
  assert.equal(bureaucratPlayer(g, 'g').bribes, 5);
});
void test('native income cancellation sends the whole payment to the bank without a Bureaucrat opportunity or use', () => {
  for (const kind of ['shipment', 'auction'] as const) {
    let g = bureaucratPaymentGame();
    const karama = takeBureaucratCard(g, 'b');
    g =
      kind === 'shipment'
        ? applyAction(g, 'p', ship)
        : normalSale(beginBureaucratAuction(g));
    assert.equal(
      g.response?.kind,
      kind === 'shipment' ? 'guildIncome' : 'emperorIncome',
    );
    assert.equal(g.bureaucratPayments?.pending, undefined);
    const payer = bureaucratPlayer(g, 'p').spice;
    g = applyAction(g, 'b', { type: 'card', mode: 'cancel', card: karama.id });
    assert.equal(bureaucratPlayer(g, 'p').spice, payer);
    assert.equal(
      bureaucratPlayer(g, kind === 'shipment' ? 'g' : 'e').spice,
      30,
    );
    assert.equal(viewGame(g, 'b').bureaucrat.pending, null);
    assert.equal(g.bureaucratPayments?.used.length ?? 0, 0);
  }
});
void test('normal auction resumes Emperor credit, Harkonnen bonus and the next lot once after Bureaucrat', () => {
  const start = beginBureaucratAuction(bureaucratPaymentGame()),
    inventory = cards(start),
    card = start.auction!.cards[0].id;
  const pending = normalSale(start);
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  assert.equal(bureaucratPlayer(pending, 'p').spice, 25);
  assert.equal(bureaucratPlayer(pending, 'p').hand.length, 1);
  const done = choose(pending);
  assert.equal(bureaucratPlayer(done, 'e').spice, 33);
  assert.equal(bureaucratPlayer(done, 'p').hand.length, 2);
  assert.ok(bureaucratPlayer(done, 'p').hand.some((c) => c.id === card));
  assert.deepEqual(cards(done), inventory);
  assert.equal(done.auction!.index, 1);
  assert.equal(done.currentAuctionSale, null);
});
void test('Richese cache and concealed Black Market seller credits preserve their original physical sale and next callback', () => {
  for (const source of ['cache', 'blackMarket'] as const)
    for (const advanced of source === 'cache' ? [false, true] : [true]) {
      const { g, saleCard } = richeseSale(source, advanced),
        inventory = cards(g);
      assert.equal(g.decision?.kind, 'bureaucratPayment');
      assert.equal(bureaucratPlayer(g, 'r').spice, 30);
      assert.equal(viewGame(g, 'b').bureaucrat.pending!.kind, 'auction');
      // The native Atreides Bureaucrat has its independently earned auction peek.
      if (source === 'blackMarket')
        assert.ok(!JSON.stringify(viewGame(g, 'g')).includes(saleCard.id));
      const done = choose(bureaucratReload(g));
      assert.equal(bureaucratPlayer(done, 'r').spice, 33);
      assert.equal(bureaucratPlayer(done, 'e').spice, 30);
      assert.equal(
        bureaucratPlayer(done, 'p').hand.filter((c) => c.id === saleCard.id)
          .length,
        1,
      );
      assert.deepEqual(cards(done), inventory);
      assert.equal(done.currentAuctionSale, null);
      assert.equal(
        done.decision?.kind,
        source === 'blackMarket' ? 'richeseDeclaration' : undefined,
      );
    }
});
void test('a real simultaneous Bene Gesserit advisor choice survives the deferred Guild payment', () => {
  const pending = applyAction(
    bureaucratPaymentGame({ advisor: true }),
    'p',
    ship,
  );
  const original = structuredClone(
    pending.bureaucratPayments!.pending!.resume.decision,
  );
  assert.equal(original!.kind, 'advisor');
  const done = choose(bureaucratReload(pending));
  assert.deepEqual(done.decision, original);
  assert.equal(bureaucratPlayer(done, 'g').spice, 33);
});
void test('aggregate 3+3 and fully allied-funded qualifying payments reject before cost, force/card commitment or RNG', () => {
  for (const allyPayment of [1, 3, 6]) {
    let g = bureaucratPaymentGame();
    bureaucratPlayer(g, 'p').ally = 'e';
    bureaucratPlayer(g, 'e').ally = 'p';
    g = applyAction(g, 'e', { type: 'pledgeAid', amount: 6 });
    mock.method(globalThis.crypto, 'randomUUID', () => {
      throw new Error('Unexpected event before payment preflight');
    });
    try {
      reject(
        g,
        'p',
        { ...ship, amount: 6, allyPayment },
        /private payment-split/,
      );
    } finally {
      mock.restoreAll();
    }
    g = bureaucratPaymentGame();
    bureaucratPlayer(g, 'p').ally = 'g';
    bureaucratPlayer(g, 'g').ally = 'p';
    g = beginBureaucratAuction(g);
    g = applyAction(g, 'g', { type: 'pledgeAid', amount: 6 });
    g = applyAction(g, 'b', { type: 'passBid' });
    reject(
      g,
      'p',
      { type: 'bid', amount: 6, allyPayment },
      /private payment-split/,
    );
  }
});
void test('saved Bureaucrat receipt, source, unique decision, continuation and phase-use mutations reject immutably before reads', () => {
  const pending = applyAction(bureaucratPaymentGame(), 'p', ship),
    done = choose(pending);
  const cases: [Game, (g: Game) => void][] = [
    [
      pending,
      (g) => {
        g.decision = null;
      },
    ],
    [
      pending,
      (g) => {
        delete g.bureaucratPaymentEvent;
      },
    ],
    [
      pending,
      (g) => {
        delete g.bureaucratPayments!.pending;
      },
    ],
    [
      pending,
      (g) => {
        g.bureaucratPayments!.pending!.source.amount = 6;
      },
    ],
    [
      pending,
      (g) => {
        g.bureaucratPayments!.pending!.resume.response!.amount = 6;
      },
    ],
    [
      pending,
      (g) => {
        bureaucratPlayer(g, 'p').spice++;
      },
    ],
    [
      pending,
      (g) => {
        g.bureaucratPayments!.pending!.leader = 'wrong';
      },
    ],
    [
      pending,
      (g) => {
        g.pendingExchange = { response: null, decision: g.decision };
      },
    ],
    [
      done,
      (g) => {
        g.bureaucratPayments!.used[0].phase = 6;
      },
    ],
    [
      done,
      (g) => {
        g.bureaucratUseEvents = [];
      },
    ],
  ];
  for (const [source, mutate] of cases) {
    const g = bureaucratReload(source);
    mutate(g);
    const before = JSON.stringify(g);
    for (const operation of [
      () => viewGame(g, 'b'),
      () => normalizeAutomaticGame(g),
      () => applyAction(g, 'b', { type: 'advanceBots' }),
    ]) {
      assert.throws(operation);
      assert.equal(JSON.stringify(g), before);
    }
  }
  reject(pending, 'p', {
    type: 'decision',
    event: pending.bureaucratPaymentEvent,
    redirect: true,
  });
  reject(pending, 'b', { type: 'decision', event: 'stale', redirect: true });
});
void test('legacy unstamped income finishes unchanged; active source evidence stays out of private seat projections', () => {
  let g = bureaucratPaymentGame();
  takeBureaucratCard(g, 'b');
  g = applyAction(g, 'p', ship);
  for (const p of g.players) {
    const response = viewGame(g, p.id).response!;
    assert.equal(response.bureaucratPayment, undefined);
    assert.equal(response.bureaucratPaymentEvent, undefined);
  }
  delete g.response!.bureaucratPayment;
  delete g.response!.bureaucratPaymentEvent;
  g = allowBureaucratIncome(bureaucratReload(g));
  assert.equal(bureaucratPlayer(g, 'g').spice, 35);
  assert.equal(g.bureaucratPayments?.pending, undefined);
  assert.equal(g.bureaucratPayments?.used.length ?? 0, 0);
});

void test('independent Karama sends every allied shipment share to Bank without a Bureaucrat split guard or opportunity', () => {
  let g = bureaucratPaymentGame();
  bureaucratPlayer(g, 'p').ally = 'e';
  bureaucratPlayer(g, 'e').ally = 'p';
  g = applyAction(g, 'e', { type: 'pledgeAid', amount: 5 });
  const karama = takeBureaucratCard(g, 'b');
  g = applyAction(g, 'b', {
    type: 'card',
    mode: 'shipment',
    target: 'p',
    card: karama.id,
  });
  const before = cards(g);
  g = applyAction(g, 'p', { ...ship, amount: 12, allyPayment: 3 });
  assert.equal(bureaucratPlayer(g, 'p').spice, 27);
  assert.equal(g.aid.e.amount, 2);
  assert.equal(bureaucratPlayer(g, 'g').spice, 30);
  assert.equal(viewGame(g, 'b').bureaucrat.pending, null);
  assert.equal(bureaucratPlayer(g, 'p').forces['arrakeen:10'], 12);
  assert.deepEqual(cards(g), before);
});

void test('captured, dead and genuinely concealed native Bureaucrats cannot redirect another payment', () => {
  for (const state of ['captured', 'dead', 'hidden', 'faceUp'] as const) {
    let g = bureaucratPaymentGame();
    if (state === 'captured')
      bureaucratPlayer(g, 'b').leaders[0].capturedBy = 'p';
    else if (state === 'dead') {
      bureaucratPlayer(g, 'b').leaders[0].dead = true;
      bureaucratPlayer(g, 'b').leaders[0].deaths = 1;
      g.leaderSkills!.assignments = g.leaderSkills!.assignments.filter(
        (a) => a.owner !== 'b',
      );
      g.leaderSkills!.deck.push('bureaucrat');
    } else {
      Object.assign(g, { phase: 6, active: 'b' });
      for (const id of ['b', 'p']) {
        bureaucratPlayer(g, id).forces = { 'arrakeen:10': 3 };
        bureaucratPlayer(g, id).reserves = 17;
      }
      g = applyAction(g, 'b', {
        type: 'chooseBattle',
        territory: 'arrakeen',
        target: 'p',
      });
      while (g.decision?.kind === 'leaderSkillVisibility') {
        const decision = g.decision;
        g = applyAction(g, decision.player, {
          type: 'leaderSkillVisibility',
          event: decision.event,
          hide: decision.player === 'b' && state === 'hidden',
        });
      }
      while (g.battle?.preparation)
        g = applyAction(g, g.battle.preparation.owner, {
          type: 'declineBattlePower',
        });
    }
    g = applyAction(g, 'e', { type: 'bribe', target: 'g', amount: 5 });
    assert.equal(
      g.decision?.kind,
      state === 'faceUp' ? 'bureaucratPayment' : undefined,
    );
    assert.equal(bureaucratPlayer(g, 'g').bribes, state === 'faceUp' ? 0 : 5);
  }
});

void test('a later phase grants one new use, and duplicated source events cannot pad the independent physical-card history', () => {
  let g = choose(applyAction(bureaucratPaymentGame(), 'p', bribe));
  g.phase = 6;
  g = choose(applyAction(g, 'p', bribe));
  assert.equal(g.bureaucratPayments!.used.length, 2);
  const broken = bureaucratReload(g);
  broken.bureaucratPayments!.used[1].event =
    broken.bureaucratPayments!.used[0].event;
  broken.bureaucratPayments!.used[1].signature = bureaucratPaymentSignature(
    broken.bureaucratPayments!.used[1],
  );
  assert.throws(() => viewGame(broken, 'b'));
  assert.throws(() => normalizeAutomaticGame(broken));
});
