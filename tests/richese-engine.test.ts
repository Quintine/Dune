import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
function fixture(advanced = false) {
  let g = createGame('RICHTEST', newPlayer('r', 'Richese', 'guild'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'r', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.players[0].faction = 'richese';
  g.players[0].leaders = leaders('richese');
  g.players.forEach((p) => {
    p.hand = [];
    p.spice = 20;
  });
  g.deck = baseDeck();
  g.discard = [];
  g.richeseCache = richeseCards();
  g.richeseRemoved = [];
  g.phase = 2;
  g.turn = 2;
  g.ready = [];
  g.order = ['h', 'e', 'r'];
  g.response = null;
  g.decision = null;
  g.phaseOpening = null;
  g.advanced = advanced;
  return g;
}
function begin(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function decision(g: Game, extra: Record<string, unknown>) {
  return applyAction(g, g.decision!.player, {
    type: 'decision',
    event: g.richeseBidding!.event,
    ...extra,
  });
}
function bid(g: Game, id: string, amount: number | null, allyPayment = 0) {
  return applyAction(g, id, {
    type: 'richeseBid',
    event: g.richeseAuction!.event,
    amount,
    allyPayment,
  });
}
function cache(
  g = fixture(),
  position: 'first' | 'last' = 'first',
  method: 'onceAround' | 'silent' = 'silent',
) {
  g = begin(g);
  g = decision(g, { position });
  if (position === 'last') return g;
  return decision(g, {
    card: g.richeseCache![0].id,
    method,
    direction: 'counterclockwise',
  });
}
function physical(g: Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
    ...(g.ixAuction?.cards ?? []),
  ].map((c) => c.id);
}
void test('cache-first declaration precedes pool preparation and seals use storm ties with exact single custody', () => {
  let g = cache();
  assert.equal(g.auction, null);
  assert.equal(g.richeseBidding?.normalCount, 2);
  const card = g.richeseAuction!.cardId;
  g = bid(g, 'e', 4);
  const observer = viewGame(g, 'h').richeseAuction!;
  assert.equal(observer.ownBid, null);
  assert.equal(observer.revealedBids, null);
  assert.equal(observer.bid, 0);
  g = bid(g, 'h', 4);
  g = bid(g, 'r', 0);
  assert.equal(g.players[1].spice, 16);
  assert.equal(g.players[0].spice, 24);
  assert.equal(g.players[2].spice, 20);
  assert.ok(g.players[1].hand.some((c) => c.id === card));
  assert.equal(g.players[1].hand.length, 2, 'Harkonnen bonus automatic');
  assert.equal(
    g.auction?.cards.length,
    2,
    'declared count frozen before bonus',
  );
  assert.equal(physical(g).filter((id) => id === card).length, 1);
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(g))), g);
});
void test('last-position cache remains available after ordinary all-pass and is not selected early', () => {
  let g = cache(fixture(), 'last');
  assert.ok(g.auction);
  assert.equal(g.richeseAuction, null);
  assert.equal(viewGame(g, 'e').richeseBidding!.cache, null);
  const deck = physical(g).sort();
  while (g.auction) g = applyAction(g, g.auction.active, { type: 'passBid' });
  assert.equal(g.decision?.kind, 'richeseCache');
  assert.equal(g.phase, 3);
  g = decision(g, {
    card: g.richeseCache![1].id,
    method: 'onceAround',
    direction: 'clockwise',
  });
  while (!g.richeseAuction?.outcome)
    g = bid(g, g.richeseAuction!.active!, null);
  assert.equal(g.decision?.kind, 'richeseUnbid');
  g = decision(g, { keep: false });
  assert.equal(g.phase, 4);
  assert.equal(g.richeseRemoved?.length, 1);
  assert.deepEqual(physical(g).sort(), deck);
});
void test('Richese buying its cache pays the Emperor; unbid keeping is free and not a sale', () => {
  let g = cache();
  g = bid(g, 'h', 1);
  g = bid(g, 'e', 0);
  g = bid(g, 'r', 2);
  assert.equal(g.players[0].spice, 18);
  assert.equal(g.players[2].spice, 22);
  assert.equal(g.players[0].hand.length, 1);
  g = cache();
  for (const id of ['h', 'e', 'r']) g = bid(g, id, 0);
  g = decision(g, { keep: true });
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(g.richeseRemoved!.length, 0);
});
void test('all-zero cache is automatically removed when Richese hand is full', () => {
  const before = fixture();
  before.players[0].hand = before.deck.splice(0, 4);
  let g = cache(before);
  assert.ok(!g.richeseAuction!.eligible.includes('r'));
  g = bid(g, 'h', 0);
  g = bid(g, 'e', 0);
  assert.equal(g.richeseRemoved!.length, 1);
  assert.equal(g.players[0].hand.length, 4);
  assert.notEqual(g.decision?.kind, 'richeseUnbid');
});
void test('Once Around physical direction differs from storm order and ignores unoccupied circles', () => {
  const before = fixture();
  before.playerPositions = { r: 1, h: 3, e: 6 };
  const cc = cache(structuredClone(before), 'first', 'onceAround');
  assert.deepEqual(cc.richeseAuction!.order, ['h', 'e', 'r']);
  let cw = begin(before);
  cw = decision(cw, { position: 'first' });
  cw = decision(cw, {
    card: cw.richeseCache![0].id,
    method: 'onceAround',
    direction: 'clockwise',
  });
  assert.deepEqual(cw.richeseAuction!.order, ['e', 'h', 'r']);
  assert.deepEqual(cw.richeseAuction!.tieOrder, ['h', 'e', 'r']);
});
void test('sealed own and allied funds cannot be spent twice or withdrawn, and release for losing bidders', () => {
  let g = cache();
  g.players[1].ally = 'e';
  g.players[2].ally = 'h';
  g.players[1].spice = 2;
  g = applyAction(g, 'e', { type: 'pledgeAid', amount: 6 });
  g = bid(g, 'h', 7, 5);
  assert.throws(
    () => applyAction(g, 'e', { type: 'pledgeAid', amount: 4 }),
    /Ally funding/,
  );
  assert.throws(
    () => applyAction(g, 'h', { type: 'bribe', target: 'r', amount: 1 }),
    /Spice/,
  );
  const frozen = structuredClone(g);
  assert.throws(() => bid(g, 'h', 1), /already submitted/);
  assert.deepEqual(g, frozen);
  g = bid(g, 'e', 8);
  g = bid(g, 'r', 0);
  assert.equal(g.players[1].spice, 2);
  assert.equal(g.aid.e.amount, 6);
  assert.equal(g.players[2].spice, 6);
});
void test('Black Market stays concealed through all methods, pays seller and reduces normal count only on sale', () => {
  for (const method of ['normal', 'onceAround', 'silent'] as const) {
    const before = fixture(true);
    before.players[0].hand = [before.deck.shift()!];
    let g = begin(before);
    const card = g.players[0].hand[0];
    assert.equal(g.decision?.kind, 'richeseBlackMarket');
    g = decision(g, {
      card: card.id,
      method,
      direction: 'clockwise',
      claim: 'A weapon, perhaps',
    });
    assert.equal(viewGame(g, 'h').richeseAuction?.cardId, null);
    assert.equal(viewGame(g, 'h').richeseAuction?.card, null);
    assert.equal(physical(g).filter((id) => id === card.id).length, 1);
    if (method === 'silent') {
      g = bid(g, 'e', 3);
      g = bid(g, 'h', 0);
      g = bid(g, 'r', 0);
    } else {
      let guard = 0;
      while (g.richeseAuction && !g.richeseAuction.outcome && guard++ < 10) {
        const id = g.richeseAuction.active!;
        g = bid(g, id, id === 'e' && g.richeseAuction.bid === 0 ? 3 : null);
      }
    }
    assert.equal(g.decision?.kind, 'richeseDeclaration');
    assert.equal(g.players[0].spice, 23);
    assert.equal(g.players[2].spice, 17);
    assert.equal(g.richeseBidding!.blackMarketSold, true);
    assert.equal(g.richeseBidding!.normalCount, 1);
    assert.equal(physical(g).filter((id) => id === card.id).length, 1);
  }
});
void test('unsold and canceled Black Market preserve the exact card and do not reduce count', () => {
  for (const canceled of [false, true]) {
    const before = fixture(true);
    before.players[0].hand = [before.deck.shift()!];
    if (canceled) {
      const k = before.deck.find((c) => c.effect === 'karama')!;
      before.players[2].hand = [k];
      before.deck = before.deck.filter((c) => c.id !== k.id);
    }
    let g = begin(before);
    const card = g.players[0].hand[0];
    g = decision(g, { card: card.id, method: 'silent' });
    if (canceled)
      g = applyAction(g, 'e', {
        type: 'card',
        card: g.players[2].hand[0].id,
        mode: 'cancel',
      });
    else for (const id of ['h', 'e', 'r']) g = bid(g, id, 0);
    assert.deepEqual(g.players[0].hand, [card]);
    assert.equal(g.richeseBidding!.blackMarketSold, false);
    assert.equal(g.richeseBidding!.normalCount, 2);
  }
});
void test('Atreides inspection grants only its entitled view and survives JSON before a Black Market bid', () => {
  const before = fixture(true);
  before.players[1].faction = 'atreides';
  before.players[1].leaders = leaders('atreides');
  before.players[0].hand = [before.deck.shift()!];
  let g = begin(before);
  const card = g.players[0].hand[0];
  g = decision(g, { card: card.id, method: 'silent' });
  g = JSON.parse(JSON.stringify(g));
  assert.equal(viewGame(g, 'h').richeseAuction!.card!.id, card.id);
  assert.equal(viewGame(g, 'e').richeseAuction!.card, null);
  assert.equal(viewGame(g, 'e').richeseAuction!.cardId, null);
  assert.equal(g.players[0].hand[0].id, card.id);
});
void test('unresolved cache-cancel and seller self-bid branches reject atomically and gates stay closed', () => {
  const before = fixture();
  const k = before.deck.find((c) => c.effect === 'karama')!;
  before.players[2].hand = [k];
  before.deck = before.deck.filter((c) => c.id !== k.id);
  let g = begin(before);
  g = decision(g, { position: 'first' });
  const snapshot = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'e', { type: 'card', card: k.id, mode: 'cancel' }),
    /ruling|interpretation/,
  );
  assert.deepEqual(g, snapshot);
  const bm = fixture(true);
  bm.players[0].hand = [bm.deck.shift()!];
  g = begin(bm);
  g = decision(g, { card: g.players[0].hand[0].id, method: 'silent' });
  const exact = structuredClone(g);
  assert.throws(() => bid(g, 'r', 1), /self-bid/);
  assert.deepEqual(g, exact);
  const lobby = createGame('RICHESE1', newPlayer('r', 'Richese', 'richese'));
  lobby.players.push(newPlayer('e', 'Emperor', 'emperor'));
  lobby.players.forEach((p) => (p.ready = true));
  assert.throws(
    () => applyAction(lobby, 'r', { type: 'start' }),
    /still being implemented/,
  );
});

void test('an outbid ally-funded player whose hand fills is automatically skipped without reserving losing credit', () => {
  const before = fixture(true);
  before.players[0].hand = [before.deck.shift()!];
  let g = begin(before);
  g = decision(g, { card: g.players[0].hand[0].id, method: 'normal' });
  g.players[1].ally = 'e';
  g.players[2].ally = 'h';
  g.players[1].spice = 0;
  g = applyAction(g, 'e', { type: 'pledgeAid', amount: 5 });
  g = bid(g, 'h', 3, 3);
  g = bid(g, 'e', 4);
  g.players[1].hand = g.deck.splice(0, 8);
  g = bid(g, 'r', null);
  assert.equal(g.decision?.kind, 'richeseDeclaration');
  assert.equal(g.players[0].spice, 24);
  assert.equal(g.players[2].spice, 11);
  assert.equal(g.aid.e.amount, 5);
  assert.ok(
    g.log.some((entry) =>
      entry.text.includes(
        'automatically passed because their hand became full',
      ),
    ),
  );
});
void test('restored full hands automatically submit zero or remove an unbid cache card once', () => {
  let g = cache();
  g = bid(g, 'h', 2);
  g = bid(g, 'e', 0);
  g.players[0].hand = g.deck.splice(0, 4);
  g = normalizeAutomaticGame(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[1].hand.length, 2);
  assert.equal(g.players[0].spice, 22);
  assert.equal(g.players[0].hand.length, 4);
  assert.ok(
    g.log.some((entry) => entry.text.includes('automatically submitted zero')),
  );
  let unbid = cache();
  for (const id of ['h', 'e', 'r']) unbid = bid(unbid, id, 0);
  assert.equal(unbid.decision?.kind, 'richeseUnbid');
  unbid.players[0].hand = unbid.deck.splice(0, 4);
  unbid = normalizeAutomaticGame(JSON.parse(JSON.stringify(unbid)));
  assert.equal(unbid.richeseRemoved?.length, 1);
  assert.equal(unbid.decision, null);
  assert.deepEqual(normalizeAutomaticGame(structuredClone(unbid)), unbid);
});
void test('a frozen normal pool is not drawn and lost after every hand becomes full', () => {
  const before = fixture();
  before.players[0].hand = before.deck.splice(0, 3);
  before.players[1].hand = before.deck.splice(0, 7);
  before.players[2].hand = before.deck.splice(0, 3);
  let g = cache(before);
  assert.equal(g.richeseBidding?.normalCount, 2);
  g = bid(g, 'r', 2);
  g.players[1].hand.push(g.deck.shift()!);
  g.players[2].hand.push(g.deck.shift()!);
  const cards = physical(g).sort(),
    deck = g.deck.map((c) => c.id);
  g = normalizeAutomaticGame(g);
  assert.equal(g.phase, 4);
  assert.equal(g.auction, null);
  assert.deepEqual(
    g.deck.map((c) => c.id),
    deck,
  );
  assert.deepEqual(physical(g).sort(), cards);
});
