import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import { location, territory } from '../game/board';
import { richeseCards } from '../game/richese-cards';
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture() {
  const g = createGame(
    'BGCANCELCTX',
    newPlayer('b', 'BG', 'beneGesserit'),
    true,
    ['choam'],
  );
  g.players.push(
    newPlayer('r', 'Richese', 'richese'),
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 2,
    storm: 18,
    active: 'b',
    order: ['b', 'r', 'e', 'h'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
  }
  player(g, 'b').ally = 'r';
  player(g, 'r').ally = 'b';
  player(g, 'e').ally = 'h';
  player(g, 'h').ally = 'e';
  function hold(
    id: string,
    predicate: (c: Game['deck'][number]) => boolean,
    cache = false,
  ) {
    const pile = cache ? g.richeseCache! : g.deck,
      at = pile.findIndex(predicate);
    assert.ok(at >= 0);
    const card = pile.splice(at, 1)[0];
    player(g, id).hand.push(card);
    return card.id;
  }
  const worthless = hold('b', (c) => c.kind === 'worthless'),
    truth = hold('b', (c) => c.effect === 'truthtrance');
  hold('b', (c) => c.name === 'Shield');
  const printed = hold('e', (c) => c.effect === 'karama'),
    special = hold('h', (c) => c.effect === 'karama');
  hold('h', (c) => c.name === 'Maula Pistol');
  const box = hold('r', (c) => c.effect === 'nullentropyBox', true),
    distrans = hold('r', (c) => c.effect === 'distrans', true),
    gift = hold('r', (c) => c.effect === 'ornithopter', true),
    given = hold('r', (c) => c.name === 'Snooper');
  const at = g.deck.findIndex((c) => c.name === 'Lasgun');
  assert.ok(at >= 0);
  g.discard.push(...g.deck.splice(at, 1));
  return { g, worthless, truth, printed, special, box, distrans, gift, given };
}
type Fixture = ReturnType<typeof fixture>;
function action(g: Game, id: string, a: Action) {
  const before = structuredClone(g),
    next = applyAction(g, id, a);
  assert.deepEqual(g, before);
  return next;
}
function passKind(initial: Game, kind: NonNullable<Game['response']>['kind']) {
  let g = reload(initial);
  for (let tries = 0; g.response?.kind === kind; tries++) {
    assert.ok(tries < 12);
    const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
    g = action(g, id, { type: 'passResponse' });
  }
  return g;
}
function beginCancel(g: Game, f: Fixture) {
  const next = action(g, 'b', {
    type: 'card',
    card: f.worthless,
    mode: 'cancel',
  });
  assert.equal(next.response?.kind, 'worthlessKarama');
  assert.equal(next.pendingKarama?.opportunity?.kind, 'cancel');
  return next;
}
function privateViews(g: Game) {
  const before = structuredClone(g);
  for (const p of g.players) {
    const view = viewGame(reload(g), p.id);
    assert.equal('pendingKarama' in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const other of view.players)
      if (other.id !== p.id)
        for (const key of ['hand', 'spice', 'traitors'])
          assert.equal(key in other, false, key);
  }
  assert.deepEqual(g, before);
}
function inventory(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.auction?.cards.slice(
      g.auction.index + (g.currentAuctionSale ? 1 : 0),
    ) ?? []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function paidBox(g: Game, f: Fixture) {
  const paid = action(g, 'r', { type: 'card', card: f.box });
  assert.ok(paid.pendingNullentropy);
  assert.equal(player(paid, 'r').spice, 18);
  privateViews(paid);
  return paid;
}
function finishBox(g: Game) {
  const pending = g.pendingNullentropy!,
    card = g.discard.find((c) => c.name === 'Lasgun')!;
  assert.ok(card);
  return action(reload(g), 'r', {
    type: 'decision',
    event: pending.event,
    card: card.id,
  });
}
function sourceGift(f: Fixture) {
  return action(f.g, 'e', { type: 'emperorGift', amount: 4 });
}
function freeBoxSlot(f: Fixture) {
  const hand = player(f.g, 'r').hand;
  const index = hand.findIndex((card) => card.id === f.given);
  assert.ok(index >= 0);
  f.g.deck.push(...hand.splice(index, 1));
}
function sourceAuction(f: Fixture) {
  freeBoxSlot(f);
  let g = f.g;
  g.phase = 3;
  g.auction = {
    cards: g.deck.splice(0, 1),
    index: 0,
    bid: 0,
    bidder: null,
    active: 'b',
    passed: [],
    opener: 0,
  };
  g = action(g, 'b', { type: 'bid', amount: 2 });
  for (const id of ['r', 'e', 'h']) g = action(g, id, { type: 'passBid' });
  assert.equal(g.decision?.kind, 'auctionPayment');
  g = action(g, 'b', { type: 'decision', karama: false });
  assert.equal(g.response?.kind, 'emperorIncome');
  return g;
}

void test('an actual gift cancellation preserves hand-changing Distrans, Truthtrance and paid Box interruptions without freezing resources', () => {
  const f = fixture(),
    source = sourceGift(f),
    original = structuredClone(source.response),
    ids = inventory(source);
  let g = beginCancel(source, f);
  const stamped = structuredClone(g.pendingKarama);
  g = action(g, 'h', { type: 'passResponse' });
  g = action(g, 'r', {
    type: 'card',
    card: f.distrans,
    target: 'b',
    give: f.given,
  });
  assert.deepEqual(g.pendingKarama, stamped);
  assert.equal(player(g, 'b').hand.length, 3);
  g = action(g, 'b', { type: 'card', card: f.truth });
  for (const id of ['r', 'e', 'h']) g = action(g, id, { type: 'truthPass' });
  g = action(g, 'b', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'e',
      fact: { kind: 'spice', compare: 'eq', value: 20 },
    },
  });
  assert.equal(viewGame(g, 'e').truthAnswer, 'yes');
  assert.equal(viewGame(g, 'b').truthAnswer, null);
  g = action(g, 'e', { type: 'truthAnswer', answer: 'yes' });
  assert.deepEqual(g.pendingKarama, stamped);
  g = finishBox(paidBox(g, f));
  assert.deepEqual(g.pendingKarama, stamped);
  assert.deepEqual(g.pendingKarama!.use, {
    kind: 'cancel',
    response: original,
  });
  assert.equal(player(g, 'r').spice, 18);
  privateViews(g);
  g = passKind(g, 'worthlessKarama');
  assert.equal(g.pendingKarama ?? null, null);
  assert.equal(g.response, null);
  assert.equal(player(g, 'e').spice, 20);
  assert.equal(player(g, 'h').spice, 20);
  assert.equal(g.truthHistory!.length, 1);
  assert.deepEqual(inventory(g), ids);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
});

void test('canceling a real Richese gift survives Box suspension and retains the source transfer intent without giving its card', () => {
  const f = fixture();
  freeBoxSlot(f);
  let g = action(f.g, 'r', { type: 'richeseGift', card: f.gift });
  const original = structuredClone(g.pendingRicheseGift),
    ids = inventory(g);
  g = beginCancel(g, f);
  const stamped = structuredClone(g.pendingKarama);
  const paid = paidBox(g, f);
  assert.equal(paid.pendingKarama, null);
  assert.deepEqual(paid.pendingNullentropy!.resume.pendingKarama, stamped);
  assert.deepEqual(paid.pendingRicheseGift, original);
  g = finishBox(paid);
  assert.deepEqual(g.pendingKarama, stamped);
  privateViews(g);
  g = passKind(g, 'worthlessKarama');
  assert.equal(g.pendingRicheseGift, null);
  assert.equal(g.pendingKarama ?? null, null);
  assert.equal(
    player(g, 'r').hand.some((c) => c.id === f.gift),
    true,
  );
  assert.equal(
    player(g, 'b').hand.some((c) => c.id === f.gift),
    false,
  );
  assert.deepEqual(inventory(g), ids);
});

void test('paid auction income cancellation survives a real Harkonnen exchange and Box inside that exchange without replaying purchase or sampling', () => {
  const f = fixture();
  let g = sourceAuction(f);
  const sale = structuredClone(g.currentAuctionSale),
    auction = structuredClone(g.auction),
    ids = inventory(g);
  g = beginCancel(g, f);
  const stamped = structuredClone(g.pendingKarama);
  g = action(g, 'h', {
    type: 'card',
    mode: 'special',
    card: f.special,
    target: 'b',
    amount: 1,
  });
  assert.equal(g.decision?.kind, 'handExchange');
  assert.equal(g.pendingExchange?.response?.kind, 'worthlessKarama');
  assert.deepEqual(g.pendingKarama, stamped);
  const sampled = structuredClone(g.players.map((p) => p.hand));
  g = finishBox(paidBox(g, f));
  assert.deepEqual(g.pendingKarama, stamped);
  assert.equal(g.decision?.kind, 'handExchange');
  assert.deepEqual(player(g, 'b').hand, sampled[0]);
  assert.deepEqual(player(g, 'h').hand, sampled[3]);
  assert.deepEqual(g.currentAuctionSale, sale);
  assert.deepEqual(g.auction, auction);
  privateViews(g);
  const returned = player(g, 'h').hand.find((c) => c.name === 'Maula Pistol')!;
  g = action(g, 'h', { type: 'decision', returnCards: [returned.id] });
  assert.deepEqual(g.pendingKarama, stamped);
  g = passKind(g, 'worthlessKarama');
  assert.equal(g.pendingKarama ?? null, null);
  assert.equal(g.pendingExchange, null);
  assert.equal(player(g, 'b').spice, 18);
  assert.equal(player(g, 'e').spice, 20);
  assert.equal(player(g, 'r').spice, 18);
  assert.equal(
    g.log.filter((l) => l.text.includes('won a treachery card')).length,
    1,
  );
  assert.equal(g.log.filter((l) => l.text.includes('unseen cards')).length, 1);
  assert.deepEqual(inventory(g), ids);
});

void test('source-bound saved cancellations reject replaced response, source auction, transfer and battle contexts while valid legacy metadata-free use still resumes', () => {
  for (const source of ['gift', 'auction', 'transfer', 'battle'] as const) {
    const f = fixture();
    let g = f.g;
    if (source === 'gift') g = sourceGift(f);
    else if (source === 'auction') g = sourceAuction(f);
    else if (source === 'transfer')
      g = action(g, 'r', { type: 'richeseGift', card: f.gift });
    else {
      g.phase = 6;
      player(g, 'e').ally = null;
      player(g, 'h').ally = null;
      g.active = 'h';
      g.order = ['h', 'e', 'b', 'r'];
      for (const id of ['h', 'e']) {
        player(g, id).forces = { 'red_chasm:7': 3 };
        player(g, id).reserves = 17;
      }
      player(g, 'e').elites = {
        forces: { 'red_chasm:7': 1 },
        reserves: 4,
        tanks: 0,
        revived: 0,
      };
      g = action(g, 'h', {
        type: 'chooseBattle',
        territory: 'red_chasm',
        target: 'e',
      });
      assert.equal(g.response?.kind, 'eliteStrength');
      assert.equal(g.response.owner, 'e');
    }
    g = beginCancel(g, f);
    const pending = g.pendingKarama!;
    const mutations: ((g: Game) => void)[] = [
      (s) => {
        s.turn++;
      },
      (s) => {
        s.phase = 7;
      },
      (s) => {
        s.pendingKarama!.owner = 'r';
      },
      (s) => {
        s.response!.owner = 'e';
      },
      (s) => {
        s.pendingKarama!.opportunity!.signature = '{}';
      },
      (s) => {
        const use = s.pendingKarama!.use;
        if (use.kind === 'cancel') use.response.owner = 'h';
      },
    ];
    if (source === 'gift')
      mutations.push(
        (s) => {
          const use = s.pendingKarama!.use;
          if (use.kind === 'cancel') use.response.amount = 5;
        },
        (s) => {
          const use = s.pendingKarama!.use;
          if (use.kind === 'cancel') use.response.recipient = 'r';
        },
      );
    if (source === 'auction')
      mutations.push(
        (s) => {
          s.auction!.index++;
        },
        (s) => {
          s.currentAuctionSale!.winner = 'r';
        },
      );
    if (source === 'transfer')
      mutations.push(
        (s) => {
          s.pendingRicheseGift!.intent.cardId = f.box;
        },
        (s) => {
          s.pendingRicheseGift!.event = 'another-gift';
        },
      );
    if (source === 'battle')
      mutations.push(
        (s) => {
          s.battle!.event = 'another-battle';
        },
        (s) => {
          s.battle!.defender = 'r';
        },
      );
    for (const [index, change] of mutations.entries()) {
      const bad = reload(g);
      change(bad);
      const before = structuredClone(bad);
      for (const p of bad.players)
        assert.throws(() => viewGame(bad, p.id), `${source} ${index} view`);
      assert.throws(
        () => normalizeAutomaticGame(bad),
        `${source} ${index} normalize`,
      );
      assert.throws(
        () => action(bad, 'e', { type: 'passResponse' }),
        `${source} ${index} action`,
      );
      assert.deepEqual(bad, before);
    }
    const legacy = reload(g);
    delete legacy.pendingKarama!.opportunity;
    assert.equal(legacy.pendingKarama!.use.kind, 'cancel');
    const done = passKind(legacy, 'worthlessKarama');
    assert.equal(done.pendingKarama ?? null, null);
    assert.equal(done.discard.filter((c) => c.id === f.worthless).length, 1);
    assert.equal(pending.opportunity!.kind, 'cancel');
  }
});

void test('a real spice worm cancellation survives a separately summoned worm and its added ride before restoring the original source', () => {
  const f = fixture();
  const fremen = newPlayer('f', 'Fremen', 'fremen');
  f.g.players.push(fremen);
  f.g.order.push('f');
  f.g.phase = 1;
  f.g.nexus = false;
  f.g.ready = [];
  const lands = spiceDeck().filter((c) => 'territory' in c);
  const original = lands.find((c) => c.territory === 'the_great_flat')!;
  const summoned = 'red_chasm';
  const originalKey = location(original.territory, original.sector);
  const summonedKey = location(summoned, territory(summoned).sectors[0]);
  fremen.forces = { [originalKey]: 2, [summonedKey]: 3 };
  fremen.reserves = 15;
  const hand = player(f.g, 'h').hand;
  const index = hand.findIndex((card) => card.id === f.special);
  fremen.hand.push(...hand.splice(index, 1));
  const worm = spiceDeck().find((card) => 'worm' in card)!;
  f.g.spiceDeck = [worm, ...lands.filter((card) => card !== original)];
  f.g.spiceDiscard = [[original], []];
  let g = f.g;
  for (const id of g.order) g = action(g, id, { type: 'ready' });
  assert.equal(g.response?.kind, 'wormSurvival');
  assert.equal(g.response?.location, original.territory);
  g = beginCancel(g, f);
  const conversion = reload(g).pendingKarama;
  const sequence = structuredClone(g.spiceSequence);
  g = action(g, 'f', {
    type: 'card',
    mode: 'special',
    card: f.special,
    territory: summoned,
  });
  assert.equal(g.response?.kind, 'wormSurvival');
  assert.equal(g.response?.location, summoned);
  assert.equal(g.pendingKarama ?? null, null);
  assert.deepEqual(reload(g).summonedWorm!.resume.pendingKarama, conversion);
  assert.notDeepEqual(g.spiceSequence, sequence);
  privateViews(g);
  g = passKind(g, 'wormSurvival');
  assert.equal(g.summonedWorm, null);
  assert.deepEqual(reload(g).pendingKarama, conversion);
  assert.deepEqual(g.spiceSequence, sequence);
  assert.ok(g.wormRides.includes(summoned));
  privateViews(g);
  g = passKind(g, 'worthlessKarama');
  assert.equal(g.pendingKarama ?? null, null);
  assert.equal(player(g, 'f').forces[originalKey], undefined);
  assert.equal(player(g, 'f').forces[summonedKey], 3);
  assert.equal(player(g, 'f').tanks, 2);
  assert.equal(g.discard.filter((card) => card.id === f.special).length, 1);
  assert.equal(g.discard.filter((card) => card.id === f.worthless).length, 1);
});

void test('a second BG cancellation may resolve separate Richese purchase income and then restore its suspended original cancellation', () => {
  const f = fixture();
  freeBoxSlot(f);
  const richeseHand = player(f.g, 'r').hand;
  const unusedDistrans = richeseHand.findIndex(
    (card) => card.id === f.distrans,
  );
  f.g.deck.push(...richeseHand.splice(unusedDistrans, 1));
  const harkHand = player(f.g, 'h').hand;
  const special = harkHand.findIndex((card) => card.id === f.special);
  richeseHand.push(...harkHand.splice(special, 1));
  const secondIndex = f.g.deck.findIndex((card) => card.kind === 'worthless');
  const second = f.g.deck.splice(secondIndex, 1)[0];
  player(f.g, 'b').hand.push(second);
  let g = beginCancel(sourceGift(f), f);
  const original = reload(g).pendingKarama;
  const acquire = g.richeseCache![0].id;
  const ids = inventory(g);
  g = action(g, 'r', {
    type: 'card',
    mode: 'special',
    card: f.special,
    acquire,
  });
  assert.equal(g.response?.kind, 'richesePurchaseIncome');
  assert.deepEqual(
    reload(g).pendingRichesePurchaseIncome!.resume.pendingKarama,
    original,
  );
  assert.equal(g.pendingKarama ?? null, null);
  g = action(g, 'b', { type: 'card', mode: 'cancel', card: second.id });
  assert.equal(g.pendingKarama?.opportunity?.kind, 'cancel');
  assert.notEqual(
    g.pendingKarama?.opportunity?.signature,
    original?.opportunity?.signature,
  );
  assert.equal(g.pendingKarama?.use.kind, 'cancel');
  privateViews(g);
  for (let i = 0; g.pendingRichesePurchaseIncome; i++) {
    assert.ok(i < 12);
    g = action(
      reload(g),
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  }
  assert.deepEqual(reload(g).pendingKarama, original);
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(player(g, 'e').spice, 20);
  assert.equal(player(g, 'r').spice, 17);
  assert.equal(
    player(g, 'r').hand.filter((card) => card.id === acquire).length,
    1,
  );
  privateViews(g);
  g = passKind(g, 'worthlessKarama');
  assert.equal(g.pendingKarama ?? null, null);
  assert.equal(player(g, 'e').spice, 20);
  assert.equal(player(g, 'h').spice, 20);
  assert.deepEqual(inventory(g), ids);
  for (const id of [f.worthless, second.id, f.special])
    assert.equal(g.discard.filter((card) => card.id === id).length, 1);
});
