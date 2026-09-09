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
  type Action,
} from '../game/engine';
import { baseDeck, spiceDeck, type Card } from '../game/cards';
import { createHomeworldCustody } from '../game/homeworld-custody';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import { botActions } from '../game/bots';
import { richeseCards } from '../game/richese-cards';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const own = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function hold(g: Game, id: string, match: (card: Card) => boolean) {
  const at = g.deck.findIndex(match);
  assert.ok(at >= 0);
  const card = g.deck.splice(at, 1)[0];
  own(g, id).hand.push(card);
  return card;
}
/** Emperor-only cases use the genuine audited setup pipeline. CHOAM's complete
 * expansion deck remains gated, so its shared-window cases use an explicit
 * faction seam with real base-deck IDs and conserved Homeworld counters. */
function fixture(choam = false, advanced = true) {
  let g = createGame(
    'BIDDINGEND',
    newPlayer('e', 'Emperor', 'emperor'),
    advanced,
    choam ? ['choam'] : [],
  );
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  if (choam) {
    joinGame(g, newPlayer('c', 'CHOAM', 'choam'));
    Object.assign(g, {
      status: 'playing',
      deck: baseDeck(),
      spiceDeck: spiceDeck(),
    });
    own(g, 'e').elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
    g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  } else {
    g = applyAction(g, 'e', { type: 'homeworlds', enabled: true });
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
    g = initializeHomeworldGameForAudit(g);
    for (let n = 0; g.status === 'setup' && n < 40; n++) {
      let next: Game | undefined;
      for (const p of g.players) {
        const view = viewGame(g, p.id);
        view.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
        const action = botActions(view)[0];
        if (action) {
          next = applyAction(g, p.id, action);
          break;
        }
      }
      assert.ok(next, 'Genuine setup must expose an owned legal choice.');
      g = next;
    }
    assert.equal(g.status, 'playing');
    for (const p of g.players) g.deck.push(...p.hand.splice(0));
  }
  Object.assign(g, {
    phase: 2,
    turn: 2,
    storm: 18,
    active: null,
    order: g.players.map((p) => p.id),
    ready: [],
    phaseOpening: null,
    decision: null,
    response: null,
    choamCharity: { turn: 2, canceled: false },
  });
  for (const p of g.players) p.spice = 20;
  inventory(g);
  return g;
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
  }
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ]
    .map((card) => card.id)
    .sort();
  assert.deepEqual(
    ids,
    baseDeck()
      .map((card) => card.id)
      .sort(),
  );
}
function endBidding(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  if (g.decision?.kind === 'choamMarket')
    g = applyAction(g, 'c', { type: 'decision', done: true });
  assert.equal(g.phase, 3);
  assert.ok(
    g.auction,
    'The normal auction opens through real phase transition.',
  );
  for (let n = 0; g.auction && n < 40; n++)
    g = g.response
      ? allow(g)
      : applyAction(g, g.auction.active, { type: 'passBid' });
  assert.equal(g.auction, null);
  assert.equal(g.phase, 3);
  assert.ok(g.biddingEnd);
  return g;
}
function act(g: Game, id: string, action: Omit<Action, 'type'>) {
  return applyAction(g, id, {
    type: 'biddingEnd',
    event: g.biddingEnd!.event,
    ...action,
  });
}
function reject(g: Game, id: string, action: Action) {
  const before = reload(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function allow(g: Game) {
  for (let n = 0; g.response && n < 20; n++) {
    const responder = g.players.find((p) => {
      const controls = viewGame(g, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length;
    });
    assert.ok(responder);
    g = applyAction(g, responder.id, { type: 'passResponse' });
  }
  return g;
}
function trade(g: Game, offered: string, returned: string) {
  g = act(g, 'c', { mode: 'trade', card: offered });
  assert.equal(g.decision?.kind, 'choamTradeReply');
  assert.equal(viewGame(g, 'e').biddingEnd?.canAct, false);
  g = applyAction(reload(g), 'e', { type: 'decision', card: returned });
  g = applyAction(reload(g), 'c', { type: 'decision', accept: true });
  return g;
}

void test('actual final normal auction opens Kaitain once and paid multi-card disposal never restarts bidding', () => {
  let g = fixture();
  const first = hold(g, 'e', (card) => card.kind === 'worthless');
  const second = hold(g, 'e', (card) => card.kind === 'shield');
  g = endBidding(g);
  assert.deepEqual(g.biddingEnd!.owners, ['e']);
  const event = g.biddingEnd!.event;
  const deck = reload(g).deck;
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  g = act(reload(g), 'e', { mode: 'discard', cards: [second.id, first.id] });
  assert.equal(own(g, 'e').spice, 16);
  assert.equal(
    g.discard.filter((card) => [first.id, second.id].includes(card.id)).length,
    2,
  );
  assert.deepEqual(g.deck, deck);
  assert.equal(g.auction, null);
  if (g.biddingEnd) {
    assert.equal(g.biddingEnd.event, event);
    g = act(g, 'e', { mode: 'ready' });
  }
  assert.equal(g.phase, 4);
  assert.equal(g.biddingEnd, null);
  inventory(g);
});

void test('Kaitain rejects empty, repeated, foreign, stale and unaffordable selections without mutation', () => {
  let g = fixture();
  const card = hold(g, 'e', (card) => card.kind === 'worthless');
  const foreign = hold(g, 'a', (card) => card.kind === 'shield');
  g = endBidding(g);
  for (const cards of [[], [card.id, card.id], [foreign.id], ['missing']])
    reject(g, 'e', {
      type: 'biddingEnd',
      event: g.biddingEnd!.event,
      mode: 'discard',
      cards,
    });
  reject(g, 'e', {
    type: 'biddingEnd',
    event: 'stale',
    mode: 'discard',
    cards: [card.id],
  });
  reject(g, 'a', {
    type: 'biddingEnd',
    event: g.biddingEnd!.event,
    mode: 'discard',
    cards: [foreign.id],
  });
  own(g, 'e').spice = 1;
  reject(g, 'e', {
    type: 'biddingEnd',
    event: g.biddingEnd!.event,
    mode: 'discard',
    cards: [card.id],
  });
  inventory(g);
});

void test('Kaitain payment spends already held spice and does not activate discarded Karama or consume special Karama', () => {
  let g = fixture();
  const karama = hold(g, 'e', (card) => card.effect === 'karama');
  hold(g, 'e', (card) => card.kind === 'shield');
  hold(g, 'a', (card) => card.effect === 'karama');
  g = endBidding(g);
  const oldUsed = own(g, 'e').specialKaramaUsed;
  g = act(reload(g), 'e', { mode: 'discard', cards: [karama.id] });
  assert.equal(own(g, 'e').spice, 18);
  assert.equal(own(g, 'e').specialKaramaUsed, oldUsed);
  assert.equal(g.response, null);
  assert.equal(g.discard.filter((card) => card.id === karama.id).length, 1);
  inventory(g);
});

void test('shared owners can choose trade before or after an Emperor discard without faction priority', () => {
  for (const tradeFirst of [false, true]) {
    let g = fixture(true);
    own(g, 'e').ally = 'c';
    own(g, 'c').ally = 'e';
    const dispose = hold(g, 'e', (card) => card.kind === 'worthless');
    const returned = hold(g, 'e', (card) => card.name === 'Shield');
    const incoming = hold(g, 'c', (card) => card.name === 'Snooper');
    g = endBidding(g);
    assert.deepEqual(g.biddingEnd!.owners, ['e', 'c']);
    assert.equal(viewGame(g, 'e').biddingEnd?.canAct, true);
    assert.equal(viewGame(g, 'c').biddingEnd?.canAct, true);
    if (tradeFirst) g = trade(g, incoming.id, returned.id);
    g = act(g, 'e', { mode: 'discard', cards: [dispose.id] });
    if (!tradeFirst) g = trade(g, incoming.id, returned.id);
    assert.equal(own(g, 'e').spice, 18);
    assert.ok(own(g, 'e').hand.some((card) => card.id === incoming.id));
    assert.ok(own(g, 'c').hand.some((card) => card.id === returned.id));
    assert.equal(g.auction, null);
    assert.equal(g.phase, 3);
    inventory(g);
  }
});

void test('incoming traded cards reopen readiness and an already-ready Emperor can discard them', () => {
  let g = fixture(true);
  own(g, 'e').ally = 'c';
  own(g, 'c').ally = 'e';
  const returned = hold(g, 'e', (card) => card.name === 'Shield');
  const incoming = hold(g, 'c', (card) => card.kind === 'worthless');
  g = endBidding(g);
  g = act(g, 'e', { mode: 'ready' });
  assert.ok(g.biddingEnd!.ready.includes('e'));
  assert.equal(viewGame(g, 'e').biddingEnd?.canAct, true);
  g = trade(g, incoming.id, returned.id);
  assert.equal(g.biddingEnd!.ready.length, 0);
  g = act(reload(g), 'e', { mode: 'discard', cards: [incoming.id] });
  assert.equal(own(g, 'e').spice, 18);
  assert.equal(g.discard.filter((card) => card.id === incoming.id).length, 1);
  assert.equal(g.phase, 3);
  if (!g.biddingEnd!.ready.includes('e')) g = act(g, 'e', { mode: 'ready' });
  g = act(g, 'c', { mode: 'ready' });
  assert.equal(g.phase, 4);
  inventory(g);
});

void test('observers see shared timing but never private Emperor card choices or held spice', () => {
  let g = fixture(true);
  const card = hold(g, 'e', (card) => card.kind === 'worthless');
  hold(g, 'c', (card) => card.name === 'Shield');
  g = endBidding(g);
  const observer = viewGame(g, 'a');
  assert.equal(observer.biddingEnd?.canAct, false);
  assert.equal(observer.players.find((p) => p.id === 'e')!.hand, undefined);
  assert.equal(observer.players.find((p) => p.id === 'e')!.spice, undefined);
  assert.ok(!JSON.stringify(observer.biddingEnd).includes(card.id));
  assert.ok(
    viewGame(g, 'e')
      .players.find((p) => p.id === 'e')!
      .hand!.some((c) => c.id === card.id),
  );
  reject(g, 'a', {
    type: 'biddingEnd',
    event: g.biddingEnd!.event,
    mode: 'ready',
  });
});

void test('current Kaitain population excludes Salusa and a real Ghola revival can reopen its eligibility', () => {
  let g = fixture(true);
  const e = own(g, 'e');
  e.reserves = 9;
  e.tanks = 1;
  e.forces = { 'polar_sink:0': 10 };
  e.elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  g.homeworlds!.custody!.salusa = { normal: 0, elite: 5 };
  const card = hold(g, 'e', (card) => card.kind === 'worthless');
  const ghola = hold(g, 'e', (card) => card.effect === 'ghola');
  hold(g, 'c', (card) => card.name === 'Shield');
  g = endBidding(g);
  assert.equal(viewGame(g, 'e').biddingEnd?.kaitain.eligible, false);
  reject(g, 'e', {
    type: 'biddingEnd',
    event: g.biddingEnd!.event,
    mode: 'discard',
    cards: [card.id],
  });
  g = act(g, 'c', { mode: 'ready' });
  g = applyAction(reload(g), 'e', {
    type: 'card',
    card: ghola.id,
    amount: 1,
    elite: 0,
  });
  assert.equal(own(g, 'e').reserves, 10);
  assert.equal(viewGame(g, 'e').biddingEnd?.kaitain.eligible, true);
  assert.equal(g.biddingEnd!.ready.length, 0);
  g = act(g, 'e', { mode: 'discard', cards: [card.id] });
  assert.equal(own(g, 'e').spice, 18);
  inventory(g);
});

void test('CHOAM can settle an actual duplicate sale inside the shared window without forcing Emperor readiness', () => {
  let g = fixture(true);
  hold(g, 'e', (card) => card.kind === 'worthless');
  const card = hold(g, 'c', (card) => card.name === 'Snooper');
  const witness = hold(g, 'c', (card) => card.name === 'Snooper');
  hold(g, 'a', (card) => card.effect === 'karama');
  g = endBidding(g);
  const event = g.biddingEnd!.event;
  g = act(g, 'c', { mode: 'sell', card: card.id, witness: witness.id });
  assert.equal(g.response?.kind, 'choamSale');
  assert.equal(viewGame(g, 'e').biddingEnd?.canAct, false);
  g = allow(reload(g));
  assert.equal(g.biddingEnd!.event, event);
  assert.equal(own(g, 'c').spice, 23);
  assert.equal(g.phase, 3);
  assert.equal(g.auction, null);
  assert.equal(g.decision, null);
  assert.equal(viewGame(g, 'e').biddingEnd?.canAct, true);
  inventory(g);
});

void test('Kaitain threshold is five native counters in both modes, with typed Salusa excluded in Advanced', () => {
  for (const advanced of [false, true])
    for (const native of [4, 5]) {
      let g = fixture(true, advanced);
      const e = own(g, 'e');
      e.reserves = native + (advanced ? 5 : 0);
      e.forces = { 'polar_sink:0': 20 - e.reserves };
      e.elites = {
        reserves: advanced ? 5 : 0,
        tanks: 0,
        forces: advanced ? {} : { 'polar_sink:0': 5 },
        revived: 0,
      };
      g.homeworlds!.custody!.salusa = advanced ? { normal: 0, elite: 5 } : null;
      const card = hold(g, 'e', (card) => card.kind === 'worthless');
      hold(g, 'c', (card) => card.name === 'Shield');
      g = endBidding(g);
      assert.equal(viewGame(g, 'e').biddingEnd?.kaitain.eligible, native === 5);
      if (native === 5) {
        g = act(g, 'e', { mode: 'discard', cards: [card.id] });
        assert.equal(own(g, 'e').spice, 18);
      } else
        reject(g, 'e', {
          type: 'biddingEnd',
          event: g.biddingEnd!.event,
          mode: 'discard',
          cards: [card.id],
        });
      inventory(g);
    }
});

void test('closing both owners returns auction aid once and advances to Revival only after both are ready', () => {
  let g = fixture(true);
  hold(g, 'e', (card) => card.kind === 'worthless');
  hold(g, 'c', (card) => card.name === 'Shield');
  g = endBidding(g);
  g.aid = { a: { recipient: 'e', amount: 3 } };
  own(g, 'a').spice = 17;
  const event = g.biddingEnd!.event;
  g = act(reload(g), 'c', { mode: 'ready' });
  assert.equal(g.phase, 3);
  assert.equal(own(g, 'a').spice, 17);
  assert.equal(g.biddingEnd!.event, event);
  g = act(reload(g), 'e', { mode: 'ready' });
  assert.equal(g.phase, 4);
  assert.equal(own(g, 'a').spice, 20);
  assert.deepEqual(g.aid, {});
  assert.equal(g.biddingEnd, null);
  const settled = reload(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), settled);
  reject(g, 'e', { type: 'biddingEnd', event, mode: 'ready' });
  inventory(g);
});

void test('ordinary CHOAM market retains its existing end-of-Bidding decision when Homeworlds are disabled', () => {
  let g = fixture(true);
  g.homeworlds = null;
  hold(g, 'e', (card) => card.kind === 'worthless');
  hold(g, 'c', (card) => card.name === 'Shield');
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamMarket');
  g = applyAction(g, 'c', { type: 'decision', done: true });
  for (let n = 0; g.auction && n < 40; n++)
    g = g.response
      ? allow(g)
      : applyAction(g, g.auction.active, { type: 'passBid' });
  assert.equal(g.phase, 3);
  assert.equal(g.biddingEnd ?? null, null);
  assert.equal(g.decision?.kind, 'choamMarket');
  g = applyAction(g, 'c', { type: 'decision', done: true });
  assert.equal(g.phase, 4);
  inventory(g);
});

void test('a scheduled post-normal Richese cache auction completes before the shared Kaitain window opens', () => {
  let g = fixture(false, false);
  // Add the explicitly staged Richese faction and complete physical cache to
  // the audited core game; the full Richese expansion setup remains gated.
  const r = newPlayer('r', 'Richese', 'richese');
  r.spice = 20;
  g.players.push(r);
  g.order = ['e', 'a', 'r'];
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  g.richeseCache = richeseCards();
  g.richeseRemoved = [];
  const disposal = hold(g, 'e', (card) => card.kind === 'worthless');
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'richeseDeclaration');
  g = applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    position: 'last',
  });
  for (let n = 0; g.auction && n < 40; n++)
    g = applyAction(g, g.auction.active, { type: 'passBid' });
  assert.equal(g.decision?.kind, 'richeseCache');
  assert.equal(g.biddingEnd ?? null, null);
  const cacheCard = g.richeseCache![0].id;
  g = applyAction(reload(g), 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    card: cacheCard,
    method: 'silent',
  });
  for (const p of g.players)
    g = applyAction(g, p.id, {
      type: 'richeseBid',
      event: g.richeseAuction!.event,
      amount: 0,
    });
  assert.equal(g.decision?.kind, 'richeseUnbid');
  assert.equal(g.biddingEnd ?? null, null);
  g = applyAction(reload(g), 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    keep: false,
  });
  assert.equal(g.richeseBidding!.stage, 'complete');
  assert.equal(g.richeseAuction, null);
  assert.equal(g.phase, 3);
  assert.deepEqual(g.biddingEnd!.owners, ['e']);
  assert.equal(
    g.richeseRemoved!.filter((card) => card.id === cacheCard).length,
    1,
  );
  g = act(reload(g), 'e', { mode: 'discard', cards: [disposal.id] });
  assert.equal(own(g, 'e').spice, 18);
  assert.equal(g.phase, 4);
  inventory(g);
  const cacheIds = [...g.richeseCache!, ...g.richeseRemoved!]
    .map((card) => card.id)
    .sort();
  assert.deepEqual(
    cacheIds,
    richeseCards()
      .map((card) => card.id)
      .sort(),
  );
});
