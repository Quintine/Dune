import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';

const own = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(third: 'atreides' | 'richese' | 'ecaz' = 'atreides') {
  let g = createGame(
    'PAYMENTINCOME',
    newPlayer('e', 'Emperor', 'emperor'),
    true,
    [],
  );
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  // Final audit roster is fixed before any setup or occupation history exists.
  if (third !== 'atreides') g.players[2] = newPlayer('a', third, third);
  g = applyAction(g, 'e', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 40; n++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
      const command = botActions(view)[0];
      if (command) {
        next = applyAction(g, p.id, command);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) {
    g.deck.push(...p.hand.splice(0));
    p.spice = 20;
  }
  Object.assign(g, {
    phase: 2,
    turn: 2,
    phaseOpening: null,
    response: null,
    decision: null,
    active: null,
    order: ['a', 'g', 'e'],
    ready: [],
    storm: 18,
  });
  inventory(g);
  return g;
}
function population(g: Game, id: string, count: number) {
  const p = own(g, id);
  // Every original special counter stays on Salusa; count is Kaitain's native pool.
  p.reserves = count + (p.elites?.reserves ?? 0);
  p.tanks = 0;
  p.forces = { 'imperial_basin:10': 20 - p.reserves };
  homeworldGameIntegrity(g);
}
function hold(g: Game, id: string, effect: string) {
  const at = g.deck.findIndex((c) => c.effect === effect || c.kind === effect);
  assert.ok(at >= 0);
  const [card] = g.deck.splice(at, 1);
  own(g, id).hand.push(card);
  return card.id;
}
function inventory(g: Game) {
  homeworldGameIntegrity(g);
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        5,
      );
    const view = viewGame(reload(g), p.id);
    for (const other of view.players.filter((other) => other.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    // A committed normal lot remains in the auction until its income responses
    // finish, but its physical card is already in the winner's hand.
    ...(g.auction?.cards.slice(
      g.auction.index + (g.currentAuctionSale?.origin === 'normal' ? 1 : 0),
    ) ?? []),
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
  ];
  const expected = [...baseDeck(), ...(g.richeseCache ? richeseCards() : [])]
    .map((c) => c.id)
    .sort();
  assert.deepEqual(cards.map((c) => c.id).sort(), expected);
}
function auction(g: Game, buyer: string, amount: number) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.ok(g.auction);
  // Atreides' real auction foresight precedes the first bid.
  for (let n = 0; g.response && n < 10; n++) {
    const responder = g.players.find((p) => {
      const controls = viewGame(g, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length;
    });
    assert.ok(responder);
    g = applyAction(g, responder.id, { type: 'passResponse' });
  }
  for (let n = 0; g.auction!.active !== buyer && n < 10; n++)
    g = applyAction(g, g.auction!.active, { type: 'passBid' });
  const card = g.auction!.cards[g.auction!.index].id;
  g = applyAction(g, buyer, { type: 'bid', amount });
  for (
    let n = 0;
    !g.response &&
    !g.decision &&
    !own(g, buyer).hand.some((c) => c.id === card) &&
    n < 20;
    n++
  )
    g = applyAction(g, g.auction!.active, { type: 'passBid' });
  if (g.decision?.kind === 'auctionPayment')
    g = applyAction(g, buyer, { type: 'decision', karama: false });
  assert.ok(own(g, buyer).hand.some((c) => c.id === card));
  return { g, card };
}
function movement(g: Game, actor: string) {
  Object.assign(g, {
    phase: 5,
    active: actor,
    movementRemaining: [
      actor,
      ...g.players.filter((p) => p.id !== actor).map((p) => p.id),
    ],
  });
  for (const p of g.players) {
    p.shipped = false;
    p.moved = 0;
  }
  return g;
}
function allowShipment(g: Game) {
  assert.equal(g.decision?.kind, 'guildShipment');
  return applyAction(reload(g), 'g', { type: 'decision', allow: true });
}
function settle(g: Game, responder: string, karama: string, cancel: boolean) {
  const original = reload(g);
  let done = applyAction(
    reload(g),
    responder,
    cancel
      ? { type: 'card', mode: 'cancel', card: karama }
      : { type: 'passResponse' },
  );
  assert.deepEqual(g, original);
  inventory(done);
  for (
    let n = 0;
    !cancel &&
    done.response?.kind === original.response?.kind &&
    n < done.players.length;
    n++
  ) {
    const remaining = done.players.find((player) => {
      const controls = viewGame(done, player.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(
      remaining,
      'An unsettled income window must retain an eligible responder.',
    );
    done = applyAction(reload(done), remaining.id, { type: 'passResponse' });
    inventory(done);
  }
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
  const before = reload(done);
  if (!done.response)
    assert.throws(() => applyAction(done, responder, { type: 'passResponse' }));
  else assert.notEqual(done.response.kind, original.response?.kind);
  assert.deepEqual(done, before);
  return done;
}
function preview(
  g: Game,
  owner: string,
  gross: number,
  income: number,
  low: boolean,
) {
  assert.deepEqual(viewGame(reload(g), owner).paymentIncome, {
    owner,
    kind: owner === 'g' ? 'shipment' : 'treachery',
    gross,
    income,
    bank: gross - income,
    low,
  });
}

void test('genuine auction pays full odd/even bid while current low Kaitain receives rounded-up half only after allowance', () => {
  for (const native of [4, 5])
    for (const bid of [3, 4]) {
      let g = fixture();
      population(g, 'e', native);
      const karama = hold(g, 'g', 'karama');
      // Put the other physical Karama first: its buyer becomes a second legal
      // income responder after acquiring it, making the former random case fixed.
      const next = g.deck.findIndex((card) => card.effect === 'karama');
      assert.ok(next >= 0);
      g.deck.unshift(g.deck.splice(next, 1)[0]);
      const purchased = auction(g, 'a', bid);
      g = purchased.g;
      assert.equal(g.response?.kind, 'emperorIncome');
      assert.equal(own(g, 'a').spice, 20 - bid);
      assert.equal(own(g, 'e').spice, 20);
      const income = native === 4 ? Math.ceil(bid / 2) : bid;
      preview(g, 'e', bid, income, native === 4);
      const waiting = applyAction(reload(g), 'g', { type: 'passResponse' });
      assert.equal(waiting.response?.kind, 'emperorIncome');
      assert.equal(
        own(waiting, 'e').spice,
        20,
        'The newly acquired Karama still gives its buyer an income response.',
      );
      assert.ok(
        viewGame(waiting, 'a').responseControls!.cancelCards.some(
          (card) => card === purchased.card,
        ),
      );
      inventory(waiting);
      const done = settle(g, 'g', karama, false);
      assert.equal(own(done, 'e').spice, 20 + income);
      assert.equal(own(done, 'a').spice, 20 - bid);
      assert.ok(own(done, 'a').hand.some((c) => c.id === purchased.card));
    }
});

void test('Karama cancels all low-Kaitain auction income while preserving the full price and purchased card', () => {
  let g = fixture();
  population(g, 'e', 4);
  const karama = hold(g, 'g', 'karama');
  const purchased = auction(g, 'a', 3);
  g = purchased.g;
  preview(g, 'e', 3, 2, true);
  const done = settle(g, 'g', karama, true);
  assert.equal(own(done, 'e').spice, 20);
  assert.equal(own(done, 'a').spice, 17);
  assert.equal(done.discard.filter((c) => c.id === karama).length, 1);
  assert.ok(own(done, 'a').hand.some((c) => c.id === purchased.card));
});

void test('Emperor self-purchase goes entirely to the bank at both Kaitain populations', () => {
  for (const native of [4, 5]) {
    let g = fixture();
    population(g, 'e', native);
    const purchased = auction(g, 'e', 3);
    g = purchased.g;
    assert.notEqual(g.response?.kind, 'emperorIncome');
    assert.equal(viewGame(g, 'e').paymentIncome, null);
    assert.equal(own(g, 'e').spice, 17);
    assert.ok(own(g, 'e').hand.some((c) => c.id === purchased.card));
    inventory(g);
  }
});

void test('ordinary shipments preserve odd/even tariffs and Karama cancellation at high and low Junction', () => {
  for (const native of [4, 5])
    for (const amount of [3, 4])
      for (const cancel of [false, true]) {
        let g = movement(fixture(), 'a');
        population(g, 'g', native);
        const karama = hold(g, 'e', 'karama');
        const reserves = own(g, 'a').reserves;
        g = applyAction(g, 'a', {
          type: 'ship',
          amount,
          territory: 'carthag',
          sector: 11,
        });
        g = allowShipment(g);
        assert.equal(g.response?.kind, 'guildIncome');
        assert.equal(own(g, 'a').spice, 20 - amount);
        assert.equal(own(g, 'a').reserves, reserves - amount);
        assert.equal(own(g, 'a').forces['carthag:11'], amount);
        const income = native === 4 ? Math.ceil(amount / 2) : amount;
        preview(g, 'g', amount, income, native === 4);
        const done = settle(g, 'e', karama, cancel);
        assert.equal(own(done, 'g').spice, 20 + (cancel ? 0 : income));
        assert.equal(own(done, 'a').spice, 20 - amount);
        assert.equal(own(done, 'a').shipped, true);
      }
});

void test('low Junction routes even non-Guild contributions and excludes its own pledged contribution', () => {
  for (const donor of ['e', 'g']) {
    let g = movement(fixture(), 'a');
    population(g, 'g', 4);
    own(g, 'a').ally = donor;
    own(g, donor).ally = 'a';
    const karama = hold(g, donor === 'e' ? 'a' : 'e', 'karama');
    const pledge = donor === 'g' ? 1 : 2;
    g = applyAction(g, donor, { type: 'pledgeAid', amount: pledge });
    // Non-Guild contributions are 2 + 2, agreeing under both unresolved rounding readings.
    // Guild alliance halves five counters to three spice and its own pledged spice goes to bank.
    const amount = donor === 'g' ? 5 : 4;
    g = applyAction(g, 'a', {
      type: 'ship',
      amount,
      territory: 'carthag',
      sector: 11,
      allyPayment: pledge,
    });
    g = allowShipment(g);
    const gross = donor === 'g' ? 2 : 4;
    preview(g, 'g', gross, Math.ceil(gross / 2), true);
    assert.equal(own(g, 'a').spice, 18);
    assert.equal(own(g, donor).spice, 20 - pledge);
    assert.equal(g.aid[donor].amount, 0);
    const done = settle(g, donor === 'e' ? 'a' : 'e', karama, false);
    assert.equal(
      own(done, 'g').spice,
      (donor === 'g' ? 19 : 20) + Math.ceil(gross / 2),
    );
    assert.equal(own(done, 'a').spice, 18);
  }
});

void test('native Guild shipment crosses from five to low before collecting its ally-funded payment', () => {
  let g = movement(fixture(), 'g');
  population(g, 'g', 5);
  own(g, 'g').ally = 'e';
  own(g, 'e').ally = 'g';
  const karama = hold(g, 'a', 'karama');
  g = applyAction(g, 'e', { type: 'pledgeAid', amount: 3 });
  g = applyAction(g, 'g', {
    type: 'ship',
    amount: 5,
    territory: 'carthag',
    sector: 11,
    allyPayment: 3,
  });
  g = allowShipment(g);
  assert.equal(own(g, 'g').reserves, 0);
  assert.equal(own(g, 'g').spice, 20);
  assert.equal(own(g, 'e').spice, 17);
  preview(g, 'g', 3, 2, true);
  const done = settle(g, 'a', karama, false);
  assert.equal(own(done, 'g').spice, 22);
  assert.equal(own(done, 'e').spice, 17);
});

void test('Richese special cache purchase keeps its three-spice cost while low Kaitain income allows or cancels after reload', () => {
  for (const cancel of [false, true]) {
    // Genuine final Richese roster also initializes its physical cache.
    let g = fixture('richese');
    population(g, 'e', 4);
    const payment = hold(g, 'a', 'karama');
    const cancellation = hold(g, 'g', 'karama');
    g = applyAction(g, 'a', {
      type: 'card',
      card: payment,
      mode: 'special',
      acquire: 'richese-ornithopter',
    });
    assert.equal(g.response?.kind, 'richesePurchaseIncome');
    assert.equal(own(g, 'a').spice, 17);
    preview(g, 'e', 3, 2, true);
    const done = settle(g, 'g', cancellation, cancel);
    assert.equal(own(done, 'e').spice, cancel ? 20 : 22);
    assert.equal(own(done, 'a').spice, 17);
    assert.equal(own(done, 'a').specialKaramaUsed, true);
    assert.ok(own(done, 'a').hand.some((c) => c.id === 'richese-ornithopter'));
    assert.equal(done.discard.filter((c) => c.id === payment).length, 1);
  }
});

void test('real Richese Ambassador purchase applies low Kaitain income after reload and rejects corrupted owner or gross before mutation', () => {
  for (const cancel of [false, true]) {
    let g = movement(fixture('ecaz'), 'g');
    population(g, 'e', 4);
    // Genuine final Ecaz roster; only this known Ambassador layout is staged.
    // Arrival, trigger, paid draw and income still use production actions.
    const karama = hold(g, 'a', 'karama');
    let ambassadors = createAmbassadors(() => 0.2);
    const token = ambassadors.tokens.find((t) => t.effect === 'richese')!;
    ambassadors.cohort = [
      token.id,
      ...ambassadors.tokens
        .filter((t) => t.effect !== 'ecaz' && t.id !== token.id)
        .slice(0, 4)
        .map((t) => t.id),
    ];
    for (const t of ambassadors.tokens) {
      t.zone =
        t.effect === 'ecaz' || ambassadors.cohort.includes(t.id)
          ? 'supply'
          : 'pool';
      t.location = null;
    }
    ambassadors = placeAmbassador(ambassadors, token.id, {
      turn: 1,
      availableSpice: 20,
      destination: {
        id: 'arrakeen',
        stronghold: true,
        inStorm: false,
        allowed: true,
      },
    }).state;
    g.ecazAmbassadors = ambassadors;
    g = applyAction(g, 'g', {
      type: 'ship',
      amount: 1,
      territory: 'arrakeen',
      sector: 10,
    });
    g = allowShipment(g);
    assert.ok(g.pendingAmbassador);
    const card = g.deck[0].id;
    g = applyAction(reload(g), 'a', {
      type: 'decision',
      event: g.pendingAmbassador.event,
      trigger: true,
      beneficiary: 'a',
    });
    assert.equal(g.response?.kind, 'emperorIncome');
    assert.equal(g.response?.source, 'ambassador');
    assert.equal(g.pendingAmbassador?.purchaseReceipt?.card, card);
    assert.equal(own(g, 'a').spice, 17);
    assert.equal(own(g, 'g').spice, 19);
    preview(g, 'e', 3, 2, true);
    for (const mutate of [
      (state: Game) => {
        state.response!.owner = 'g';
      },
      (state: Game) => {
        state.response!.amount = 4;
      },
      (state: Game) => {
        state.response!.amount = -1;
      },
    ]) {
      const corrupt = reload(g);
      mutate(corrupt);
      const before = reload(corrupt);
      assert.throws(() => viewGame(corrupt, 'e'));
      assert.throws(() =>
        applyAction(corrupt, 'a', {
          type: 'card',
          mode: 'cancel',
          card: karama,
        }),
      );
      assert.deepEqual(corrupt, before);
    }
    const done = settle(g, 'a', karama, cancel);
    assert.equal(own(done, 'e').spice, cancel ? 20 : 22);
    assert.equal(own(done, 'a').spice, 17);
    assert.ok(own(done, 'a').hand.some((c) => c.id === card));
    assert.equal(done.pendingAmbassador, null);
    assert.equal(
      done.ecazAmbassadors!.tokens.find((t) => t.id === token.id)!.zone,
      'used',
    );
    assert.equal(own(done, 'g').spice, 19);
    assert.equal(own(done, 'g').forces['arrakeen:10'], 1);
  }
});

void test('low Junction rejects ambiguous one-plus-one funding before interception and accepts a single two-spice contribution', () => {
  let g = movement(fixture(), 'a');
  population(g, 'g', 4);
  own(g, 'a').ally = 'e';
  own(g, 'e').ally = 'a';
  const karama = hold(g, 'e', 'karama');
  g = applyAction(g, 'e', { type: 'pledgeAid', amount: 2 });
  const before = reload(g);
  assert.throws(
    () =>
      applyAction(g, 'a', {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 2,
        allyPayment: 1,
      }),
    /rounding.*ruling/,
  );
  assert.deepEqual(g, before);
  assert.equal(g.pendingShipment ?? null, null);
  assert.equal(g.decision, null);
  assert.equal(g.aid.e.amount, 2);
  g = applyAction(g, 'a', {
    type: 'ship',
    territory: 'carthag',
    sector: 11,
    amount: 2,
    allyPayment: 2,
  });
  assert.equal(g.decision?.kind, 'guildShipment');
  assert.equal(own(g, 'a').spice, 20);
  assert.equal(g.aid.e.amount, 2);
  g = allowShipment(g);
  preview(g, 'g', 2, 1, true);
  assert.deepEqual(g.response?.guildContributions, [2]);
  assert.equal(own(g, 'a').spice, 20);
  assert.equal(own(g, 'e').spice, 18);
  assert.equal(g.aid.e.amount, 0);
  const done = settle(g, 'e', karama, false);
  assert.equal(own(done, 'g').spice, 21);
});

void test('all AI profiles omit shipment candidates with unresolved low-Junction allied rounding', () => {
  let g = movement(fixture(), 'a');
  population(g, 'g', 4);
  own(g, 'a').ally = 'e';
  own(g, 'e').ally = 'a';
  own(g, 'a').spice = 1;
  g = applyAction(g, 'e', { type: 'pledgeAid', amount: 1 });
  const blocked: { level: string; action: unknown }[] = [];
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(reload(g), 'a');
    view.players.find((p) => p.id === 'a')!.bot = level;
    const actions = botActions(view);
    assert.ok(actions.length > 0, `${level} must retain a legal fallback.`);
    for (const action of actions.filter((a) => a.type === 'ship')) {
      try {
        applyAction(reload(g), 'a', action);
      } catch (error) {
        if (/rounding.*ruling/.test(String(error)))
          blocked.push({ level, action });
      }
    }
  }
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(blocked.map((entry) => entry.level))].map((level) => [
        level,
        blocked.filter((entry) => entry.level === level).length,
      ]),
    ),
    {},
    'Every profile must omit the unresolved funding split.',
  );
});

void test('Guild payment contributor receipts reject partial deletion or changed gross and remain absent from private projections', () => {
  let g = movement(fixture(), 'a');
  population(g, 'g', 4);
  const karama = hold(g, 'e', 'karama');
  g = applyAction(g, 'a', {
    type: 'ship',
    amount: 2,
    territory: 'carthag',
    sector: 11,
  });
  g = allowShipment(g);
  assert.equal(g.response?.kind, 'guildIncome');
  assert.deepEqual(g.response.guildContributions, [2]);
  assert.equal(typeof g.response.guildPaymentProof, 'string');
  for (const p of g.players) {
    const view = viewGame(reload(g), p.id);
    assert.equal(view.response?.guildContributions, undefined);
    assert.equal(view.response?.guildPaymentProof, undefined);
    assert.ok(!JSON.stringify(view.response).includes('guildContributions'));
    assert.ok(!JSON.stringify(view.response).includes('guildPaymentProof'));
  }
  for (const mutate of [
    (state: Game) => {
      state.response!.guildContributions = null as unknown as number[];
    },
    (state: Game) => {
      delete state.response!.guildContributions;
    },
    (state: Game) => {
      delete state.response!.guildPaymentProof;
    },
    (state: Game) => {
      state.response!.amount = 3;
    },
  ]) {
    const corrupt = reload(g);
    mutate(corrupt);
    const before = reload(corrupt);
    assert.throws(() => viewGame(corrupt, 'g'));
    assert.throws(() => normalizeAutomaticGame(corrupt));
    assert.throws(() =>
      applyAction(corrupt, 'e', { type: 'card', mode: 'cancel', card: karama }),
    );
    assert.deepEqual(corrupt, before);
  }
  const done = settle(g, 'e', karama, false);
  assert.equal(own(done, 'g').spice, 21);
});
