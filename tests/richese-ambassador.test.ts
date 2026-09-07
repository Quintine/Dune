import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  normalizeAutomaticGame,
  handLimit,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import { FACTIONS, type FactionId } from '../game/catalog';
import {
  createAmbassadors,
  placeAmbassador,
  validateAmbassadors,
} from '../game/ecaz-ambassadors';

const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(copy = false, fifth = false) {
  const g = createGame('RAMBTEST', newPlayer('ec', 'Ecaz', 'ecaz'), true, [
    'ecaz',
  ]);
  g.players.push(
    newPlayer('in', 'Entrant', 'guild'),
    newPlayer('h', 'Buyer', 'harkonnen'),
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'in',
    order: ['in', 'ec', 'h', 'e', 'b'],
    movementRemaining: ['in', 'ec', 'h', 'e', 'b'],
    deck: baseDeck(),
    discard: [],
  });
  for (const player of g.players)
    Object.assign(player, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  // No available BG reserves: competing shipment accompaniment remains gated.
  p(g, 'b').reserves = 0;
  p(g, 'b').tanks = 20;
  p(g, 'ec').ally = 'h';
  p(g, 'h').ally = 'ec';
  const hold = (id: string, match: (c: Card) => boolean) => {
    const at = g.deck.findIndex(match);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    p(g, id).hand.push(card);
    return card;
  };
  const printed = hold('ec', (c) => c.effect === 'karama');
  const second = hold('in', (c) => c.effect === 'karama');
  const worthless = hold('b', (c) => c.kind === 'worthless');
  for (let n = 0; n < 6; n++) hold('h', (c) => c.kind !== 'worthless');
  let state = createAmbassadors(() => 0.2);
  const effect = copy ? 'beneGesserit' : 'richese';
  const token = state.tokens.find((t) => t.effect === effect)!;
  state.cohort = [
    token.id,
    ...state.tokens
      .filter(
        (t) =>
          t.effect !== 'ecaz' &&
          t.id !== token.id &&
          (!copy || t.effect !== 'richese'),
      )
      .slice(0, 4)
      .map((t) => t.id),
  ];
  for (const t of state.tokens) {
    t.zone =
      t.effect === 'ecaz' || state.cohort.includes(t.id) ? 'supply' : 'pool';
    if (fifth && t.id !== token.id && state.cohort.includes(t.id))
      t.zone = 'used';
    t.location = null;
  }
  state = placeAmbassador(state, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  g.ecazAmbassadors = state;
  return {
    g,
    token: token.id,
    printed: printed.id,
    second: second.id,
    worthless: worthless.id,
  };
}
function enter(g: Game) {
  let entered = applyAction(g, 'in', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
  if (entered.decision?.kind === 'guildShipment')
    entered = applyAction(entered, 'in', { type: 'decision', allow: true });
  assert.ok(
    entered.pendingAmbassador,
    JSON.stringify({
      response: entered.response,
      decision: entered.decision,
      pendingShipment: entered.pendingShipment,
    }),
  );
  return entered;
}
function trigger(g: Game, buyer = 'h') {
  return applyAction(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: buyer,
  });
}
function allowWindow(g: Game) {
  const kind = g.response?.kind;
  for (let n = 0; g.response?.kind === kind && g.response && n < 30; n++) {
    const actor = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(actor);
    g = applyAction(g, actor.id, { type: 'passResponse' });
  }
  return g;
}
function allResponses(g: Game) {
  for (let n = 0; g.response && n < 10; n++) g = allowWindow(g);
  assert.equal(g.response, null);
  return g;
}
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function inventory(g: Game) {
  validateAmbassadors(g.ecazAmbassadors!);
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, baseDeck().length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  for (const player of g.players)
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((a, b) => a + b, 0),
      20,
    );
}
function arrival(g: Game) {
  return {
    turn: g.turn,
    phase: g.phase,
    active: g.active,
    queue: g.movementRemaining,
    forces: g.players.map((p) => ({
      id: p.id,
      forces: p.forces,
      reserves: p.reserves,
      shipped: p.shipped,
      moved: p.moved,
    })),
  };
}
function privatePurchase(g: Game, buyer: string, card: string) {
  const before = structuredClone(g);
  for (const viewer of g.players) {
    const view = viewGame(g, viewer.id);
    assert.equal('pendingAmbassador' in view, false);
    assert.equal('purchaseReceipt' in (view.ambassadorEntry ?? {}), false);
    if (viewer.id === buyer)
      assert.ok(
        view.players
          .find((p) => p.id === buyer)!
          .hand!.some((c) => c.id === card),
      );
    else
      assert.equal(view.players.find((p) => p.id === buyer)!.hand, undefined);
    assert.ok(!JSON.stringify(view.ambassadorEntry).includes(card));
  }
  assert.deepEqual(g, before);
}

void test('direct Richese Ambassador purchase is mandatory, private and resumes its paid shipment after Emperor income', () => {
  const f = fixture();
  const entry = enter(f.g),
    card = entry.deck[0];
  const g = trigger(entry, 'ec');
  assert.equal(p(g, 'ec').spice, p(entry, 'ec').spice - 3);
  assert.equal(p(g, 'ec').hand.length, p(entry, 'ec').hand.length + 1);
  assert.ok(p(g, 'ec').hand.some((c) => c.id === card.id));
  assert.equal(g.response?.kind, 'emperorIncome');
  assert.equal(g.response?.source, 'ambassador');
  assert.equal(g.pendingAmbassador?.stage, 'income');
  assert.equal(g.pendingAmbassador?.purchaseReceipt?.card, card.id);
  assert.equal(g.auction, null);
  assert.equal(g.currentAuctionSale ?? null, null);
  privatePurchase(g, 'ec', card.id);
  reject(g, 'ec', {
    type: 'decision',
    event: entry.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'ec',
  });
  const done = allResponses(reload(g));
  assert.equal(p(done, 'e').spice, p(entry, 'e').spice + 3);
  assert.equal(done.pendingAmbassador, null);
  assert.equal(
    done.ecazAmbassadors!.tokens.find((t) => t.id === f.token)!.zone,
    'used',
  );
  assert.deepEqual(arrival(done), arrival(entry));
  assert.deepEqual(normalizeAutomaticGame(reload(done)), reload(done));
  inventory(done);
});

void test('Harkonnen allied buyer pays once, Emperor receives three, then one private bonus fills the eighth slot', () => {
  const f = fixture(),
    entry = enter(f.g),
    primary = entry.deck[0],
    bonus = entry.deck[1];
  let g = trigger(entry);
  assert.equal(p(g, 'h').spice, 17);
  assert.equal(p(g, 'h').hand.length, 7);
  assert.equal(g.response?.kind, 'emperorIncome');
  privatePurchase(g, 'h', primary.id);
  g = allowWindow(reload(g));
  assert.equal(p(g, 'e').spice, 23);
  assert.equal(g.response?.kind, 'harkonnenBonus');
  assert.equal(g.response?.source, 'ambassador');
  assert.equal(g.pendingAmbassador?.stage, 'bonus');
  assert.equal(p(g, 'h').hand.length, 7);
  g = allResponses(reload(g));
  assert.equal(p(g, 'h').hand.length, 8);
  assert.ok(p(g, 'h').hand.some((c) => c.id === bonus.id));
  assert.equal(p(g, 'h').spice, 17);
  assert.equal(p(g, 'e').spice, 23);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.auction, null);
  assert.deepEqual(arrival(g), arrival(entry));
  privatePurchase(g, 'h', bonus.id);
  inventory(g);
});

void test('printed and BG cancellations preserve the paid primary card while suppressing the appropriate child benefit', () => {
  for (const bg of [false, true]) {
    const f = fixture(),
      entry = enter(f.g),
      primary = entry.deck[0];
    let g = trigger(entry);
    g = applyAction(g, bg ? 'b' : 'ec', {
      type: 'card',
      card: bg ? f.worthless : f.printed,
      mode: 'cancel',
    });
    if (bg) {
      assert.equal(g.response?.kind, 'worthlessKarama');
      g = allowWindow(reload(g));
    }
    assert.equal(p(g, 'e').spice, 20);
    assert.equal(p(g, 'h').spice, 17);
    assert.equal(g.response?.kind, 'harkonnenBonus');
    g = applyAction(reload(g), 'in', {
      type: 'card',
      card: f.second,
      mode: 'cancel',
    });
    assert.equal(g.response, null);
    assert.equal(g.pendingAmbassador, null);
    assert.equal(p(g, 'h').hand.length, 7);
    assert.ok(p(g, 'h').hand.some((c) => c.id === primary.id));
    assert.equal(
      g.discard.filter((c) => c.id === (bg ? f.worthless : f.printed)).length,
      1,
    );
    assert.equal(g.discard.filter((c) => c.id === f.second).length, 1);
    assert.deepEqual(arrival(g), arrival(entry));
    inventory(g);
  }
});

void test('Richese copy through the fifth BG marker delays cohort replacement and restores a real worm ride once', () => {
  const f = fixture(true, true);
  f.g.players[f.g.players.findIndex((p) => p.id === 'in')] = newPlayer(
    'in',
    'Fremen',
    'fremen',
  );
  // Preserve the physical Karama moved to the former entrant's hand.
  p(f.g, 'in').hand = [baseDeck().find((c) => c.id === f.second)!];
  p(f.g, 'in').spice = 20;
  Object.assign(f.g, {
    phase: 1,
    active: null,
    nexus: false,
    wormRides: ['hagga_basin'],
    decision: { kind: 'wormRide', player: 'in', territory: 'imperial_basin' },
  });
  p(f.g, 'in').forces = { 'imperial_basin:10': 3, 'hagga_basin:11': 1 };
  p(f.g, 'in').reserves = 16;
  let g = applyAction(f.g, 'in', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { 'imperial_basin:10': 2 },
  });
  const entry = reload(g),
    cohort = [...g.ecazAmbassadors!.cohort];
  g = trigger(g);
  assert.equal(g.pendingAmbassador?.stage, 'copy');
  assert.ok(g.pendingAmbassador!.copyChoices.includes('richese'));
  const card = g.deck[0];
  g = applyAction(g, 'h', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    effect: 'richese',
  });
  assert.equal(g.response?.kind, 'emperorIncome');
  assert.deepEqual(g.ecazAmbassadors!.cohort, cohort);
  assert.equal(
    g.ecazAmbassadors!.tokens.find((t) => t.id === f.token)!.zone,
    'removed',
  );
  assert.equal(g.pendingAmbassador?.resume, 'wormRide');
  privatePurchase(g, 'h', card.id);
  const done = allResponses(reload(g));
  assert.equal(done.pendingAmbassador, null);
  assert.deepEqual(done.decision, {
    kind: 'wormRide',
    player: 'in',
    territory: 'hagga_basin',
  });
  assert.deepEqual(done.wormRides, []);
  assert.equal(
    done.log.filter((l) => l.text.includes('drew a new supply')).length,
    1,
  );
  assert.equal(
    done.ecazAmbassadors!.tokens.find((t) => t.id === f.token)!.zone,
    'removed',
  );
  assert.deepEqual(
    done.players.map((p) => p.forces),
    entry.players.map((p) => p.forces),
  );
  reject(done, 'h', {
    type: 'decision',
    event: entry.pendingAmbassador!.event,
    effect: 'richese',
  });
  inventory(done);
});

void test('an Ixian ally never creates a Bidding-only replacement for this actual movement purchase', () => {
  const f = fixture();
  f.g.players[f.g.players.findIndex((p) => p.id === 'h')].faction = 'ixians';
  const entry = enter(f.g),
    card = entry.deck[0];
  const done = allResponses(trigger(entry, 'ec'));
  assert.ok(p(done, 'ec').hand.some((c) => c.id === card.id));
  assert.equal(done.pendingIxAlly ?? null, null);
  assert.equal(done.pendingAmbassador, null);
  assert.equal(done.decision, null);
  assert.equal(done.discard.length, entry.discard.length);
  assert.equal(done.deck.length, entry.deck.length - 1);
  inventory(done);
});

void test('recycling a depleted deck persists the paid card across the pending income response', () => {
  const f = fixture();
  f.g.discard = f.g.deck;
  f.g.deck = [];
  const entry = enter(f.g),
    possible = new Set(entry.discard.map((c) => c.id));
  const g = trigger(entry, 'ec'),
    bought = g.pendingAmbassador!.purchaseReceipt!.card;
  assert.ok(possible.has(bought));
  assert.equal(g.discard.length, 0);
  assert.equal(g.deck.length, possible.size - 1);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  for (let n = 0; n < 3; n++) privatePurchase(reload(g), 'ec', bought);
  const done = allResponses(reload(g));
  assert.ok(p(done, 'ec').hand.some((c) => c.id === bought));
  assert.deepEqual(done.deck, g.deck);
  inventory(done);
});

void test('forged paid Ambassador receipts reject before cancellation cost and never change the input', () => {
  const f = fixture(),
    source = trigger(enter(f.g));
  for (const change of [
    (g: Game) => {
      g.pendingAmbassador!.purchaseReceipt!.amount = 99 as 3;
    },
    (g: Game) => {
      g.pendingAmbassador!.purchaseReceipt!.buyer = 'missing';
    },
    (g: Game) => {
      g.pendingAmbassador!.purchaseReceipt!.stage = 'bonus';
    },
    (g: Game) => {
      g.pendingAmbassador!.phase = 3;
    },
    (g: Game) => {
      g.response!.owner = 'h';
    },
    (g: Game) => {
      delete g.pendingAmbassador!.purchaseReceipt;
    },
  ]) {
    const bad = reload(source);
    change(bad);
    reject(bad, 'b', { type: 'card', card: f.worthless, mode: 'cancel' });
    reject(bad, 'ec', { type: 'card', card: f.printed, mode: 'cancel' });
  }
});

void test('private allied incapacity still commits the optional trigger with the same generic public result', () => {
  const base = fixture();
  const funded = enter(base.g);
  const expectedOffer = viewGame(funded, 'ec').ambassadorEntry;
  const failedLogs: string[][] = [];
  for (const reason of ['spice', 'capacity'] as const) {
    const initial = reload(base.g);
    if (reason === 'spice') p(initial, 'h').spice = 2;
    else
      p(initial, 'h').hand.push(initial.deck.shift()!, initial.deck.shift()!);
    const entry = enter(initial);
    assert.deepEqual(viewGame(entry, 'ec').ambassadorEntry, expectedOffer);
    const done = trigger(entry);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.response, null);
    assert.equal(done.decision, null);
    assert.deepEqual(done.players, entry.players);
    assert.deepEqual(done.deck, entry.deck);
    assert.deepEqual(done.discard, entry.discard);
    assert.equal(
      done.ecazAmbassadors!.tokens.find((t) => t.id === base.token)!.zone,
      'used',
    );
    failedLogs.push(done.log.slice(entry.log.length).map((l) => l.text));
    assert.deepEqual(arrival(done), arrival(entry));
    inventory(done);
  }
  assert.deepEqual(failedLogs[0], failedLogs[1]);
  assert.ok(
    !failedLogs[0].some((text) =>
      /insufficient|full hand|cannot afford/i.test(text),
    ),
  );
});

void test('a Harkonnen buyer at seven cards purchases the eighth without an extra bonus or Ix choice', () => {
  const f = fixture();
  p(f.g, 'h').hand.push(f.g.deck.shift()!);
  const entry = enter(f.g),
    primary = entry.deck[0];
  let g = trigger(entry);
  assert.equal(p(g, 'h').hand.length, 8);
  assert.equal(g.response?.kind, 'emperorIncome');
  g = allResponses(g);
  assert.equal(p(g, 'h').hand.length, 8);
  assert.ok(p(g, 'h').hand.some((c) => c.id === primary.id));
  assert.equal(g.deck.length, entry.deck.length - 1);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.pendingIxAlly ?? null, null);
  inventory(g);
});

function beneficiaryFixture(buyerFaction: FactionId, emperorPresent = true) {
  const g = createGame('RAMBMATR', newPlayer('ec', 'Ecaz', 'ecaz'), true, [
    'ecaz',
  ]);
  const buyer = buyerFaction === 'ecaz' ? 'ec' : 'buyer';
  if (buyer !== 'ec') {
    g.players.push(newPlayer(buyer, 'Beneficiary', buyerFaction));
    p(g, 'ec').ally = buyer;
    p(g, buyer).ally = 'ec';
  }
  const entrant: FactionId =
    emperorPresent && buyerFaction !== 'emperor' ? 'emperor' : 'guild';
  g.players.push(newPlayer('in', 'Entrant', entrant));
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'in',
    order: g.players.map((p) => p.id),
    movementRemaining: [
      'in',
      ...g.players.filter((p) => p.id !== 'in').map((p) => p.id),
    ],
    deck: baseDeck(),
    discard: [],
  });
  for (const player of g.players)
    Object.assign(player, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  p(g, 'in').forces = { 'imperial_basin:10': 2 };
  p(g, 'in').reserves = 18;
  for (let n = 0; n < handLimit(p(g, buyer)) - 1; n++)
    p(g, buyer).hand.push(g.deck.shift()!);
  const ambassadors = createAmbassadors(() => 0.2);
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
  g.ecazAmbassadors = placeAmbassador(ambassadors, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  const entry = applyAction(g, 'in', {
    type: 'move',
    from: 'imperial_basin:10',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
  assert.equal(entry.pendingAmbassador?.stage, 'offer');
  return { g, entry, buyer, token: token.id };
}

void test('all twelve distinct factions can receive the mandatory Richese effect at their actual hand limit', () => {
  assert.equal(FACTIONS.length, 12);
  for (const faction of FACTIONS) {
    const f = beneficiaryFixture(faction.id);
    assert.equal(
      new Set(f.entry.players.map((p) => p.faction)).size,
      f.entry.players.length,
    );
    const card = f.entry.deck[0],
      beforeBuyer = p(f.entry, f.buyer);
    assert.equal(beforeBuyer.hand.length, handLimit(beforeBuyer) - 1);
    const done = allResponses(trigger(f.entry, f.buyer));
    assert.equal(p(done, f.buyer).spice, 17, faction.id);
    assert.equal(
      p(done, f.buyer).hand.length,
      handLimit(beforeBuyer),
      faction.id,
    );
    assert.ok(
      p(done, f.buyer).hand.some((c) => c.id === card.id),
      faction.id,
    );
    const emperor = done.players.find((p) => p.faction === 'emperor');
    assert.ok(emperor);
    assert.equal(emperor.spice, emperor.id === f.buyer ? 17 : 23, faction.id);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.pendingIxAlly ?? null, null);
    assert.equal(
      done.ecazAmbassadors!.tokens.find((t) => t.id === f.token)!.zone,
      'used',
    );
    assert.deepEqual(arrival(done), arrival(f.entry));
    privatePurchase(done, f.buyer, card.id);
    inventory(done);
  }
});

void test('without Emperor the paid acquisition completes directly and no auction income is invented', () => {
  const f = beneficiaryFixture('atreides', false),
    card = f.entry.deck[0];
  assert.ok(!f.entry.players.some((p) => p.faction === 'emperor'));
  const done = trigger(f.entry, f.buyer);
  assert.equal(p(done, f.buyer).spice, 17);
  assert.ok(p(done, f.buyer).hand.some((c) => c.id === card.id));
  assert.equal(done.response, null);
  assert.equal(done.pendingAmbassador, null);
  assert.equal(done.auction, null);
  assert.deepEqual(arrival(done), arrival(f.entry));
  inventory(done);
});

const stagedCards = (g: Game) =>
  [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();

void test('a genuinely triggered empty-pile effect uses its token with no payment, card, or private failure detail', () => {
  const f = fixture();
  // Bounded exhausted-pile component fixture: no fake pending purchase is made.
  // Conservation below covers the cards present in this explicitly reduced inventory.
  f.g.deck = [];
  f.g.discard = [];
  const before = stagedCards(f.g),
    entry = enter(f.g);
  const done = trigger(entry);
  assert.deepEqual(done.players, entry.players);
  assert.equal(done.pendingAmbassador, null);
  assert.equal(done.response, null);
  assert.equal(
    done.ecazAmbassadors!.tokens.find((t) => t.id === f.token)!.zone,
    'used',
  );
  assert.deepEqual(stagedCards(done), before);
  assert.ok(done.log.at(-1)!.text.includes('received no card'));
  assert.ok(!/empty|funds|full|capacity/i.test(done.log.at(-1)!.text));
  validateAmbassadors(done.ecazAmbassadors!);
});

void test('a Hark bonus can recycle the actual income-canceling card, or complete with no bonus from an empty pool', () => {
  for (const cancelIncome of [false, true]) {
    const f = fixture();
    // One physical purchase card remains in this bounded inventory. All payment,
    // response, cost disposal and recycling below are genuine dispatcher actions.
    f.g.deck = [f.g.deck[0]];
    f.g.discard = [];
    const before = stagedCards(f.g),
      entry = enter(f.g),
      primary = entry.deck[0];
    let g = trigger(entry);
    assert.equal(g.deck.length, 0);
    assert.equal(g.discard.length, 0);
    if (cancelIncome) {
      g = applyAction(g, 'ec', {
        type: 'card',
        card: f.printed,
        mode: 'cancel',
      });
      assert.equal(g.discard.length, 1);
      assert.equal(g.discard[0].id, f.printed);
      assert.equal(p(g, 'e').spice, 20);
    } else {
      g = allowWindow(g);
      assert.equal(p(g, 'e').spice, 23);
    }
    assert.equal(g.response?.kind, 'harkonnenBonus');
    assert.equal(g.response?.source, 'ambassador');
    g = allResponses(reload(g));
    assert.equal(g.pendingAmbassador, null);
    assert.equal(p(g, 'h').spice, 17);
    assert.ok(p(g, 'h').hand.some((c) => c.id === primary.id));
    assert.equal(p(g, 'h').hand.length, cancelIncome ? 8 : 7);
    assert.equal(
      p(g, 'h').hand.some((c) => c.id === f.printed),
      cancelIncome,
    );
    assert.equal(g.discard.length, 0);
    assert.deepEqual(stagedCards(g), before);
    assert.deepEqual(arrival(g), arrival(entry));
    validateAmbassadors(g.ecazAmbassadors!);
  }
});
