import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { biddingPhysicalIds } from './fixture-homeworld-occupied-bidding';
import { semutaEmperorPlayer as player, moveSemutaEmperorCard } from './fixture-semuta-emperor-share';
import { advanceSemutaHomeworldChoam, reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import {
  createSemutaHomeworldKaramaAuctionFixture, disposeSemutaHomeworldKaramaAuction,
  finishSemutaHomeworldKaramaAuction, type SemutaHomeworldKaramaAuctionFixture,
} from './fixture-semuta-homeworld-karama-auction';

function assertReserved(f: SemutaHomeworldKaramaAuctionFixture, pending: Game) {
  const cost = pending.pendingTreacheryDiscard!;
  assert.equal(cost.continuation.kind, f.scope === 'purchase' ? 'karamaPurchaseDiscard' : 'karamaPaymentDiscard');
  assert.equal(cost.reaction?.stage, 'offer');
  assert.deepEqual(cost.batch.entries.map(entry => ({ id: entry.card.id, owner: entry.discardedBy, public: entry.publicFace })),
    [{ id: f.card, owner: f.actor, public: true }]);
  assert.equal(player(pending, f.actor).hand.some(card => card.id === f.card), false);
  assert.equal(pending.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(pending, f.actor).hand.some(card => card.id === f.reservedLot), false);
  assert.deepEqual(pending.auction, f.game.auction, 'The same native lot and winning bid remain reserved, not delivered');
  assert.deepEqual(pending.players.map(p => ({ player: p.id, spice: p.spice })), f.payers);
  assert.deepEqual(pending.deck, f.game.deck);
  assert.deepEqual(pending.richeseCache, f.game.richeseCache);
  assert.deepEqual(pending.richeseBidding, f.game.richeseBidding);
  assert.deepEqual(pending.homeworlds, f.custody);
  assert.deepEqual(biddingPhysicalIds(pending), biddingPhysicalIds(f.game));
  assert.equal(pending.response, null);
  assert.equal(pending.decision, null);
}

function assertAcquired(f: SemutaHomeworldKaramaAuctionFixture, done: Game, claimed: boolean) {
  assert.equal(done.pendingTreacheryDiscard, null);
  const buyerBefore = player(f.game, f.actor), buyer = player(done, f.actor);
  const lot = f.game.auction!.cards[f.game.auction!.index];
  assert.deepEqual(buyer.hand, [...buyerBefore.hand.filter(card => card.id !== f.card), lot]);
  assert.equal(buyer.hand.filter(card => card.id === f.reservedLot).length, 1);
  assert.deepEqual(done.players.map(p => ({ player: p.id, spice: p.spice })), f.payers,
    'Zero price creates neither Emperor income, foreign occupied share nor refund');
  assert.deepEqual(done.deck, f.game.deck, 'No bonus or replacement card is drawn');
  assert.deepEqual(done.richeseCache, f.game.richeseCache);
  assert.deepEqual(done.richeseRemoved, f.game.richeseRemoved);
  assert.deepEqual(done.richeseBidding, f.game.richeseBidding);
  assert.deepEqual(done.homeworlds, f.custody);
  assert.deepEqual(done.order, f.game.order);
  assert.deepEqual(biddingPhysicalIds(done), biddingPhysicalIds(f.game));
  assert.deepEqual(done.auction!.cards, f.game.auction!.cards);
  assert.equal(done.auction!.index, f.game.auction!.index + 1);
  assert.equal(done.auction!.bid, 0);
  assert.equal(done.auction!.bidder, null);
  assert.equal(player(done, f.holder).hand.filter(card => card.id === f.card).length, Number(claimed));
  assert.equal(done.discard.filter(card => card.id === f.card).length, Number(!claimed));
  assert.equal(done.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claimed));
  assert.equal(player(done, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claimed);
}

for (const advanced of [false, true]) for (const scope of ['purchase', 'payment'] as const) {
  const label = `${advanced ? 'Advanced' : 'Basic'} Homeworld printed Karama ${scope}`;
  void test(`${label}: original cost reserves the lot until an exact singleton claim or pass`, () => {
    const f = createSemutaHomeworldKaramaAuctionFixture(scope, advanced);
    if (scope === 'payment') {
      assert.equal(f.game.auction!.bidder, f.actor);
      assert.ok(f.nativeBid > player(f.game, f.actor).spice);
      assert.equal(f.game.decision?.kind, 'auctionPayment');
    }
    const pending = disposeSemutaHomeworldKaramaAuction(f);
    assertReserved(f, pending);
    const event = pending.pendingTreacheryDiscard!.batch.event;
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assert.throws(() => applyAction(pending, f.actor, f.action));
    assert.throws(() => applyAction(pending, f.holder, { type: 'semutaCommit', event: `${event}-stale` }));
    assert.throws(() => applyAction(pending, f.actor, { type: 'bid', amount: f.nativeBid + 1 }));
    assert.throws(() => applyAction(pending, f.actor, { type: 'decision', karama: false }));
    for (const seat of pending.players.filter(seat => seat.id !== f.holder)) {
      assert.equal(viewGame(pending, seat.id).semutaReaction?.canCommit, false);
      assert.throws(() => applyAction(pending, seat.id, { type: 'semutaCommit', event }));
    }
    for (const claim of [false, true]) {
      const done = reactSemutaHomeworldChoam(JSON.parse(JSON.stringify(pending)) as Game, f.holder, claim);
      assertAcquired(f, done, claim);
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event }));
      assert.throws(() => applyAction(done, f.actor, f.action));
      for (const seat of done.players.filter(seat => seat.id !== f.actor))
        assert.throws(() => applyAction(done, seat.id, { type: 'decision', karama: true, card: f.card }));
      const finished = finishSemutaHomeworldKaramaAuction(done, f);
      assert.equal(finished.phase, 5);
      assert.equal(finished.turn, f.game.turn);
      assert.equal(finished.richeseBidding!.stage, 'complete');
      assert.equal(finished.richeseCache!.length, f.game.richeseCache!.length - 1,
        'The original compulsory cache auction is completed, never cut from the continuation');
      assert.deepEqual(finished.players.map(p => ({ player: p.id, spice: p.spice })), f.payers);
      assert.equal(player(finished, f.actor).hand.filter(card => card.id === f.reservedLot).length, 1);
    }
  });

  void test(`${label}: full holder exchange is atomic and nonholder projections cannot reveal entitlement`, () => {
    const f = createSemutaHomeworldKaramaAuctionFixture(scope, advanced, true);
    assert.equal(player(f.game, f.holder).hand.length, 4);
    assert.equal(f.game.richeseBidding!.normalCount, f.beforeLot.richeseBidding!.normalCount);
    assert.deepEqual(f.game.auction!.cards, f.beforeLot.auction!.cards);
    const absent = structuredClone(f.game), hand = player(absent, f.holder).hand;
    const index = hand.findIndex(card => card.id === SEMUTA_DRUG_ID);
    const replacement = absent.deck.findIndex(card => card.id !== SEMUTA_DRUG_ID);
    [hand[index], absent.deck[replacement]] = [absent.deck[replacement], hand[index]];
    assert.deepEqual(biddingPhysicalIds(absent), biddingPhysicalIds(f.game));
    const pending = disposeSemutaHomeworldKaramaAuction(f), neutral = disposeSemutaHomeworldKaramaAuction(f, absent);
    assertReserved(f, pending);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    for (const seat of pending.players.filter(seat => seat.id !== f.holder))
      assert.deepEqual(JSON.parse(JSON.stringify(viewGame(pending, seat.id))),
        JSON.parse(JSON.stringify(viewGame(neutral, seat.id))));
    assert.throws(() => applyAction(neutral, f.holder,
      { type: 'semutaCommit', event: neutral.pendingTreacheryDiscard!.batch.event }));
    const done = reactSemutaHomeworldChoam(pending, f.holder, true);
    assertAcquired(f, done, true);
    assert.equal(player(done, f.holder).hand.length, handLimit(player(done, f.holder)));
    const declined = reactSemutaHomeworldChoam(neutral, f.holder, false);
    assert.equal(player(declined, f.actor).hand.filter(card => card.id === f.reservedLot).length, 1);
    assert.deepEqual(declined.players.map(p => ({ player: p.id, spice: p.spice })), f.payers);
  });

  void test(`${label}: changed reserved native settlement rejects without effect replay across JSON`, () => {
    const f = createSemutaHomeworldKaramaAuctionFixture(scope, advanced);
    const pending = disposeSemutaHomeworldKaramaAuction(f), event = pending.pendingTreacheryDiscard!.batch.event;
    const mutations: ((game: Game) => void)[] = [
      game => { game.auction!.cards[game.auction!.index].name = 'Changed reserved face'; },
      game => { game.richeseBidding!.position = 'first'; },
      game => { game.auction!.bidder = f.holder; },
      game => {
        const continuation = game.pendingTreacheryDiscard!.continuation;
        if (continuation.kind === 'karamaPurchaseDiscard' || continuation.kind === 'karamaPaymentDiscard')
          continuation.stateSignature = 'retired';
      },
    ];
    for (const mutate of mutations) {
      const altered = JSON.parse(JSON.stringify(pending)) as Game;
      mutate(altered);
      const original = JSON.stringify(altered);
      assert.throws(() => applyAction(altered, f.holder, { type: 'semutaCommit', event }));
      assert.equal(JSON.stringify(altered), original, 'Rejected altered continuation neither settles nor spends Semuta');
    }
    for (const seat of f.game.players.filter(seat => seat.id !== f.actor))
      assert.throws(() => disposeSemutaHomeworldKaramaAuction({ ...f, actor: seat.id }));
  });

  for (const difficulty of DIFFICULTIES) void test(`${difficulty}: ${label} consumes a minimal legal private reaction then native next-lot control`, () => {
    const f = createSemutaHomeworldKaramaAuctionFixture(scope, advanced);
    let game = disposeSemutaHomeworldKaramaAuction(f);
    const own = viewGame(game, f.holder);
    own.players.find(seat => seat.id === f.holder)!.bot = difficulty;
    const reaction = botActions(own)[0];
    assert.ok(reaction?.type === 'semutaCommit' || reaction?.type === 'semutaPass');
    game = applyAction(game, f.holder, reaction);
    if (game.pendingTreacheryDiscard) {
      const pending = game.pendingTreacheryDiscard, offer = pending.reaction;
      assert.ok(offer?.stage === 'offer');
      for (const seat of game.players.filter(seat => !offer.passed.includes(seat.id)))
        game = applyAction(game, seat.id, { type: 'semutaPass', event: pending.batch.event });
    }
    assertAcquired(f, game, reaction.type === 'semutaCommit');
    game = advanceSemutaHomeworldChoam(game, state => !state.response && !state.decision);
    const actor = game.auction!.active, native = viewGame(game, actor);
    native.players.find(seat => seat.id === actor)!.bot = difficulty;
    const action = botActions(native)[0];
    assert.ok(action);
    const moved = applyAction(game, actor, action);
    assert.equal(player(moved, f.actor).hand.filter(card => card.id === f.reservedLot).length, 1);
    const done = finishSemutaHomeworldKaramaAuction(moved, f);
    assert.equal(done.phase, 5);
    assert.equal(done.richeseBidding!.stage, 'complete');
    assert.equal(player(done, f.actor).hand.filter(card => card.id === f.reservedLot).length, 1);
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'}: native buyer capacity distinguishes direct purchase from spending a winning-payment Karama`, () => {
  for (const scope of ['purchase', 'payment'] as const) {
    const f = createSemutaHomeworldKaramaAuctionFixture(scope, advanced), game = structuredClone(f.game);
    const buyer = player(game, f.actor);
    while (buyer.hand.length < handLimit(buyer)) buyer.hand.push(game.deck.shift()!);
    assert.equal(buyer.hand.length, handLimit(buyer));
    assert.deepEqual(biddingPhysicalIds(game), biddingPhysicalIds(f.game));
    if (scope === 'purchase') {
      const original = JSON.stringify(game);
      assert.throws(() => disposeSemutaHomeworldKaramaAuction(f, game));
      assert.equal(JSON.stringify(game), original);
    } else {
      const cost = disposeSemutaHomeworldKaramaAuction(f, game);
      assert.equal(player(cost, f.actor).hand.length, handLimit(buyer) - 1);
      assert.equal(player(cost, f.actor).hand.some(card => card.id === f.reservedLot), false);
      const done = reactSemutaHomeworldChoam(cost, f.holder, true);
      assert.equal(player(done, f.actor).hand.length, handLimit(buyer));
      assert.equal(player(done, f.actor).hand.filter(card => card.id === f.reservedLot).length, 1);
      assert.deepEqual(done.players.map(p => ({ player: p.id, spice: p.spice })), f.payers);
    }
  }
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'}: original printed cache lot still cannot be taken with normal-auction Karama`, () => {
  const f = createSemutaHomeworldKaramaAuctionFixture('purchase', advanced);
  let game = advanceSemutaHomeworldChoam(f.game, state => state.decision?.kind === 'richeseCache');
  game = applyAction(game, game.decision!.player, { type: 'decision', event: game.richeseBidding!.event,
    card: game.richeseCache![0].id, method: 'onceAround', direction: 'counterclockwise' });
  game = advanceSemutaHomeworldChoam(game, state => !state.response && !state.decision);
  assert.equal(game.richeseAuction!.source, 'cache');
  assert.equal(game.auction, null);
  const original = JSON.stringify(game);
  assert.throws(() => disposeSemutaHomeworldKaramaAuction(f, game));
  assert.equal(JSON.stringify(game), original);
  assert.equal(player(game, f.actor).hand.filter(card => card.id === f.card).length, 1);
});

void test('Advanced: genuine original normal-method Black Market still cannot be taken by normal-auction Karama', () => {
  const f = createSemutaHomeworldKaramaAuctionFixture('purchase', true);
  let game = structuredClone(f.setup);
  if (!player(game, f.actor).hand.some(card => card.id === f.card))
    moveSemutaEmperorCard(game, f.card, f.actor);
  // These are the same still-unplayed physical cards, before any first-turn blow.
  for (let position = 0; position < 2; position++) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  game = advanceSemutaHomeworldChoam(game, state => state.decision?.kind === 'richeseBlackMarket');
  const owner = game.decision!.player, lot = player(game, owner).hand[0];
  assert.ok(lot);
  game = applyAction(game, owner, { type: 'decision', event: game.richeseBidding!.event,
    card: lot.id, method: 'normal' });
  game = advanceSemutaHomeworldChoam(game, state => !state.response && !state.decision);
  assert.equal(game.richeseAuction!.source, 'blackMarket');
  assert.equal(game.richeseAuction!.method, 'normal');
  assert.equal(game.auction, null);
  const original = JSON.stringify(game);
  assert.throws(() => disposeSemutaHomeworldKaramaAuction(f, game));
  assert.equal(JSON.stringify(game), original);
  assert.equal(player(game, f.actor).hand.filter(card => card.id === f.card).length, 1);
});
