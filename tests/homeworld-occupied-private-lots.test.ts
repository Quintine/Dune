import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, RuleError, type Game } from '../game/engine';
import {
  addDefenseVisitor, assertDefenseInventory, recordDefensePosition, removeDefenseVisitor,
} from './fixture-homeworld-occupied-defenses';
import { cash } from './fixture-homeworld-occupied-producers';
import {
  freshPrivateLotGame, passPrivateLotWindow, privateLotPhysicalIds,
  privateLotPlayer, privateLotReload, recyclePrivatePurchaseIntoOriginalNormalLot,
  sellPrivateBlackMarketLot,
} from './fixture-homeworld-occupied-private-lots';

function concealedBlackMarket(game: Game) {
  for (const id of ['nativeAt', 'occupier', 'ally', 'rival', 'fremen']) {
    assert.equal(viewGame(game, id).richeseAuction!.card, null, `${id} has no private face before the original peek`);
    assert.equal(viewGame(game, id).richeseAuction!.cardId, null, `${id} has no seller-only identity`);
  }
  assert.deepEqual(viewGame(game, 'nativeRichese').richeseAuction!.card, game.richeseOfferedCard);
}

for (const canceled of [false, true]) {
  void test(`concealed original Black Market inspection ${canceled ? 'survives actual native Karama denial only for the occupier' : 'shares the actual face with native Atreides and the occupier only'}`, () => {
    const fixture = freshPrivateLotGame();
    let game = fixture.game;
    concealedBlackMarket(game);
    assert.equal(game.richesePeekKnown, false);
    const beforeCash = cash(game);
    const sellerHand = structuredClone(privateLotPlayer(game, 'nativeRichese').hand);
    const custody = structuredClone(game.homeworlds!.custody);
    game = passPrivateLotWindow(privateLotReload(game), 'richeseBlackMarket');
    assert.equal(game.response?.kind, 'atreidesAuction');
    assert.equal(game.response!.owner, 'nativeAt');
    concealedBlackMarket(game);
    assert.equal(game.homeworldAuctionInspection!.occupiedKnown, false);

    if (canceled) game = applyAction(privateLotReload(game), 'rival', {
      type: 'card', card: fixture.karama.id, mode: 'cancel',
    });
    else game = passPrivateLotWindow(privateLotReload(game), 'atreidesAuction');

    assert.equal(game.response, null);
    assert.equal(game.richesePeekKnown, !canceled, 'native cancellation remains separate from the printed shared inspection');
    assert.equal(game.homeworldAuctionInspection!.occupiedKnown, true);
    assert.deepEqual(viewGame(game, 'nativeAt').richeseAuction!.card, canceled ? null : fixture.card);
    assert.deepEqual(viewGame(game, 'occupier').richeseAuction!.card, fixture.card);
    assert.deepEqual(viewGame(game, 'nativeRichese').richeseAuction!.card, fixture.card);
    for (const id of ['ally', 'rival', 'fremen']) assert.equal(viewGame(game, id).richeseAuction!.card, null);
    assert.deepEqual(privateLotPlayer(game, 'nativeRichese').hand, sellerHand, 'inspection never acquires the seller card');
    assert.deepEqual(game.homeworlds!.custody, custody);
    assert.deepEqual(cash(game), beforeCash, 'inspection or native cancellation cannot change the invoice payer');
    assert.deepEqual(privateLotPhysicalIds(game), fixture.original);
    if (canceled) {
      assert.ok(game.discard.some(card => card.id === fixture.karama.id));
      assert.equal(privateLotPlayer(game, 'rival').hand.some(card => card.id === fixture.karama.id), false);
    }
    const saved = privateLotReload(game);
    assert.deepEqual(viewGame(saved, 'occupier').richeseAuction!.card, fixture.card);
    assert.deepEqual(viewGame(saved, 'nativeAt').richeseAuction!.card, canceled ? null : fixture.card);
    assert.equal(viewGame(saved, 'ally').richeseAuction!.card, null);

    game = sellPrivateBlackMarketLot(saved);
    assert.equal(privateLotPlayer(game, 'occupier').spice, beforeCash.occupier - 2);
    assert.equal(privateLotPlayer(game, 'nativeRichese').spice, beforeCash.nativeRichese + 2);
    for (const id of ['nativeAt', 'ally', 'rival', 'fremen']) assert.equal(privateLotPlayer(game, id).spice, beforeCash[id]);
    assert.ok(privateLotPlayer(game, 'occupier').hand.some(card => card.id === fixture.card.id));
    assert.equal(privateLotPlayer(game, 'nativeRichese').hand.some(card => card.id === fixture.card.id), false);
    assert.deepEqual(privateLotPhysicalIds(game), fixture.original);
    assert.equal(game.homeworldAuctionInspection, undefined, 'original sale completion retires its private receipt');
    assertDefenseInventory(game);
  });
}

void test('a frozen Black Market receipt cannot authorize the same physical card recycled into an actual new original normal lot', () => {
  const fixture = freshPrivateLotGame();
  let game = passPrivateLotWindow(fixture.game, 'richeseBlackMarket');
  game = passPrivateLotWindow(game, 'atreidesAuction');
  const oldReceipt = structuredClone(game.homeworldAuctionInspection!);
  assert.equal(oldReceipt.occupiedKnown, true);
  assert.deepEqual(viewGame(game, 'occupier').richeseAuction!.card, fixture.card);
  game = sellPrivateBlackMarketLot(privateLotReload(game));
  const paidCash = cash(game);
  game = recyclePrivatePurchaseIntoOriginalNormalLot(game, fixture.card.id);
  const currentReceipt = structuredClone(game.homeworldAuctionInspection!);
  assert.notEqual(currentReceipt.lot, oldReceipt.lot);
  assert.equal(currentReceipt.occupiedKnown, false);
  assert.equal(game.auction!.cards[game.auction!.index].id, fixture.card.id);
  for (const id of ['nativeAt', 'occupier', 'ally', 'rival']) assert.equal(viewGame(game, id).auction!.card, null);

  const stale = privateLotReload(game);
  stale.homeworldAuctionInspection = oldReceipt;
  const frozen = structuredClone(stale);
  const physical = privateLotPhysicalIds(stale);
  for (const id of ['nativeAt', 'occupier', 'ally', 'rival']) assert.equal(viewGame(stale, id).auction!.card, null);
  assert.deepEqual(stale, frozen, 'private projection cannot mutate or repair a stale receipt');
  assert.deepEqual(privateLotPhysicalIds(stale), physical);
  assert.deepEqual(cash(stale), paidCash);
  assert.throws(() => passPrivateLotWindow(stale, 'atreidesAuction'), 'the old lot receipt cannot settle the new original source');
  assert.deepEqual(stale, frozen, 'rejected original continuation preserves the exact stale source');

  // Real current receipt, same card, original current response: the face becomes
  // visible only when THIS lot's original inspection opportunity completes.
  game = passPrivateLotWindow(privateLotReload(game), 'atreidesAuction');
  assert.deepEqual(viewGame(game, 'nativeAt').auction!.card, fixture.card);
  assert.deepEqual(viewGame(game, 'occupier').auction!.card, fixture.card);
  assert.equal(viewGame(game, 'ally').auction!.card, null);
  assert.equal(viewGame(game, 'rival').auction!.card, null);
  assert.deepEqual(cash(game), paidCash);
  assert.deepEqual(privateLotPhysicalIds(game), fixture.original);
});

void test('a frozen receipt discloses neither a new concealed original Black Market card nor its face before the original peek opportunity', () => {
  const first = freshPrivateLotGame();
  let game = passPrivateLotWindow(first.game, 'richeseBlackMarket');
  game = passPrivateLotWindow(game, 'atreidesAuction');
  const oldReceipt = structuredClone(game.homeworldAuctionInspection!);
  game = sellPrivateBlackMarketLot(game);
  assert.ok(privateLotPlayer(game, 'occupier').hand.some(card => card.id === first.card.id));

  // Independent fresh original producer: no artificial round/phase/event.
  // Pick a different original unused card before the native offer is made.
  const next = freshPrivateLotGame(first.card.id);
  assert.notEqual(next.game.richeseAuction!.event, oldReceipt.lot);
  assert.notEqual(next.card.id, first.card.id);
  const saved = privateLotReload(next.game);
  saved.homeworldAuctionInspection = oldReceipt;
  concealedBlackMarket(saved);
  assert.equal(saved.richesePeekKnown, false);
  const beforeCash = cash(saved);
  const physical = privateLotPhysicalIds(saved);
  const opened = passPrivateLotWindow(saved, 'richeseBlackMarket');
  assert.equal(opened.homeworldAuctionInspection!.lot, opened.richeseAuction!.event);
  assert.equal(opened.homeworldAuctionInspection!.occupiedKnown, false);
  concealedBlackMarket(opened);
  const revealed = passPrivateLotWindow(privateLotReload(opened), 'atreidesAuction');
  assert.deepEqual(viewGame(revealed, 'occupier').richeseAuction!.card, next.card);
  assert.equal(viewGame(revealed, 'ally').richeseAuction!.card, null);
  assert.deepEqual(cash(revealed), beforeCash);
  assert.deepEqual(privateLotPhysicalIds(revealed), physical);
});

void test('Advanced p22 retains the original shared private inspection while the qualifier remains despite native return and a competitor', () => {
  const fixture = freshPrivateLotGame();
  let game = fixture.game;
  // Labelled conserved original counters: no new sole qualifier is fabricated.
  const native = privateLotPlayer(game, 'nativeAt');
  native.tanks--;
  native.reserves++;
  addDefenseVisitor(game, 'homeworld:atreides', 'rival');
  recordDefensePosition(game, 'private-lot-native-return-and-competing-visitor-with-original-qualifier-retained');
  const custody = structuredClone(game.homeworlds!.custody);
  let departed = privateLotReload(game);
  removeDefenseVisitor(departed, 'homeworld:atreides');
  recordDefensePosition(departed, 'private-lot-last-original-qualifier-departure');
  game = passPrivateLotWindow(privateLotReload(game), 'richeseBlackMarket');
  game = passPrivateLotWindow(game, 'atreidesAuction');
  assert.deepEqual(viewGame(game, 'nativeAt').richeseAuction!.card, fixture.card);
  assert.deepEqual(viewGame(game, 'occupier').richeseAuction!.card, fixture.card);
  assert.equal(viewGame(game, 'rival').richeseAuction!.card, null);
  assert.equal(viewGame(game, 'ally').richeseAuction!.card, null);
  assert.deepEqual(game.homeworlds!.custody, custody);
  assert.deepEqual(privateLotPhysicalIds(game), fixture.original);
  assertDefenseInventory(game);
  departed = passPrivateLotWindow(privateLotReload(departed), 'richeseBlackMarket');
  departed = passPrivateLotWindow(departed, 'atreidesAuction');
  assert.deepEqual(viewGame(departed, 'nativeAt').richeseAuction!.card, fixture.card);
  assert.equal(viewGame(departed, 'occupier').richeseAuction!.card, null, 'last departure ends the retained printed share');
  assert.equal(viewGame(departed, 'rival').richeseAuction!.card, null, 'a competitor alongside native forces never qualified as a replacement');
  assert.equal(viewGame(departed, 'ally').richeseAuction!.card, null);
  assert.deepEqual(privateLotPhysicalIds(departed), fixture.original);
  assertDefenseInventory(departed);
});

void test('a JSON continuation missing original qualification history cannot use the frozen original private inspection receipt', () => {
  const fixture = freshPrivateLotGame();
  let game = passPrivateLotWindow(fixture.game, 'richeseBlackMarket');
  assert.equal(game.response?.kind, 'atreidesAuction');
  game = privateLotReload(game);
  delete game.homeworldOccupationHistory;
  const frozen = structuredClone(game);
  for (const viewer of ['nativeAt', 'occupier', 'ally', 'nativeRichese'])
    assert.throws(() => viewGame(game, viewer), RuleError);
  assert.throws(() => passPrivateLotWindow(game, 'atreidesAuction'), RuleError);
  assert.deepEqual(game, frozen);
  assert.deepEqual(privateLotPhysicalIds(game), fixture.original);
});
