import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaNativeMarketsFixture as fixture, actSemutaNativeMarkets as act,
  passSemutaNativeMarkets as pass, claimSemutaNativeMarkets as claim,
  allowSemutaNativeMarkets as allow, finishSemutaNativeMarkets as finish,
  semutaNativeMarketsPlayer as player, semutaNativeMarketsInventory as inventory,
  type SemutaNativeMarketsFixture,
} from './fixture-semuta-native-markets';

const variants = [
  { kind: 'choamSale' as const, advanced: false },
  { kind: 'choamSale' as const, advanced: true },
  { kind: 'choamSale' as const, advanced: false, worthless: true },
  { kind: 'richeseBlackMarket' as const, advanced: true },
];
const resources = (game: Game) => ({ turn: game.turn, phase: game.phase, storm: game.storm,
  order: game.order, ready: game.ready, movementRemaining: game.movementRemaining,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  players: game.players.map(player => ({ id: player.id, spice: player.spice, bribes: player.bribes,
    forces: player.forces, reserves: player.reserves, tanks: player.tanks, elites: player.elites,
    leaders: player.leaders, ally: player.ally, shipped: player.shipped, moved: player.moved, revived: player.revived })) });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaNativeMarketsFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'emperor']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(player(f.afterSetup, f.owner).hand.some(card => card.id === f.saleCard));
  assert.notEqual(f.saleCard, f.semuta); assert.notEqual(f.saleCard, f.cost);
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.game.phase, 3); assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.decision ?? null, null); assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(player(f.game, f.owner), player(f.beforeDeclaration, f.owner));
  assert.equal(player(f.game, f.owner).hand.filter(card => card.id === f.saleCard).length, 1);
  assert.equal(f.game.discard.some(card => card.id === f.saleCard), false);
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  if (f.kind === 'choamSale') {
    assert.equal(f.game.turn, 1); assert.ok(f.originalMarket && f.sale && f.expected);
    assert.equal(f.originalMarket.owner, f.holder); assert.equal(f.originalMarket.resume, 'phase');
    assert.deepEqual(f.sale, { card: f.saleCard, witness: f.witness, price: f.price });
    assert.equal(f.price, f.worthless ? 2 : 3);
    if (f.witness) {
      assert.ok(f.normalPurchase);
      assert.ok(f.normalPurchase.steps.some(step => step.actor === f.holder && step.action.type === 'bid' && step.action.amount === 1));
      assert.equal(player(f.normalPurchase.before, f.holder).spice - player(f.normalPurchase.after, f.holder).spice, 1);
      const sold = player(f.game, f.owner).hand.find(card => card.id === f.saleCard);
      const witness = player(f.game, f.owner).hand.find(card => card.id === f.witness);
      assert.ok(sold && witness); assert.notEqual(sold.id, witness.id); assert.equal(sold.name, witness.name);
    } else {
      assert.equal(f.normalPurchase, null);
      assert.equal(player(f.game, f.owner).hand.find(card => card.id === f.saleCard)?.kind, 'worthless');
    }
  } else {
    assert.equal(f.game.turn, 2); assert.equal(f.game.advanced, true); assert.ok(f.originalLot && f.originalRound);
    assert.equal(f.originalLot.source, 'blackMarket'); assert.equal(f.originalLot.cardId, f.saleCard);
    assert.equal(f.originalLot.bid, 0); assert.equal(f.originalLot.bidder, null);
    assert.equal(f.originalLot.outcome ?? null, null); assert.equal(f.originalRound.stage, 'lot');
    assert.equal(f.originalLot.method, 'normal'); assert.equal(f.originalCache.length, 9);
    assert.equal(f.game.currentAuctionSale ?? null, null);
  }
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaNativeMarketsFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaMarketDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, `karama:${f.kind}`);
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.notEqual(pending.batch.entries[0].card.id, f.saleCard);
  if (pending.continuation.kind !== 'karamaMarketDiscard') throw Error('Use the original native market cancellation cost');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(game.choamMarket ?? null, f.originalMarket);
  assert.deepEqual(game.richeseAuction ?? null, f.originalLot); assert.deepEqual(game.richeseBidding ?? null, f.originalRound);
  assert.deepEqual(game.auction ?? null, f.originalAuction);
  assert.deepEqual(game.deck.map(card => card.id), f.originalDeck);
  assert.equal(player(game, f.owner).hand.filter(card => card.id === f.saleCard).length, 1);
  if (f.witness) assert.equal(player(game, f.owner).hand.filter(card => card.id === f.witness).length, 1);
  assert.equal(game.discard.some(card => card.id === f.saleCard), false);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function originalChooser(game: Game, f: SemutaNativeMarketsFixture) {
  assert.equal(game.phase, 3); assert.equal(game.turn, f.game.turn);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.notEqual(game.response?.kind, f.kind);
  if (f.kind === 'choamSale') {
    assert.equal(game.decision?.kind, 'choamMarket'); assert.equal(game.decision?.player, f.owner);
    assert.equal(game.choamMarket?.resume, f.originalMarket!.resume);
    assert.equal(game.choamMarket?.sale, undefined);
  } else {
    assert.equal(game.decision?.kind, 'richeseDeclaration'); assert.equal(game.decision?.player, f.richese);
    assert.equal(game.richeseAuction ?? null, null); assert.equal(game.currentAuctionSale ?? null, null);
    assert.equal(game.richeseBidding?.blackMarketSold, false); assert.equal(game.richeseBidding?.cacheCanceled, false);
    assert.equal(game.richeseBidding?.normalCountBeforeCache, 3); assert.equal(game.richeseBidding?.normalCount, 2);
  }
  assert.deepEqual(game.richeseCache?.map(card => card.id), f.originalCache);
  assert.deepEqual(game.deck.map(card => card.id), f.originalDeck);
  assert.deepEqual(inventory(game), f.originalInventory);
}
function prevented(game: Game, f: SemutaNativeMarketsFixture, claimed: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.deepEqual(resources(game), resources(f.game));
  assert.equal(player(game, f.owner).hand.filter(card => card.id === f.saleCard).length, 1);
  assert.equal(game.discard.some(card => card.id === f.saleCard), false);
  if (f.witness) assert.equal(player(game, f.owner).hand.filter(card => card.id === f.witness).length, 1);
  if (f.kind === 'choamSale') {
    assert.ok(f.expected); assert.deepEqual(game.choamMarket, f.expected.market);
    assert.deepEqual(game.decision, f.expected.decision);
    assert.equal(game.choamMarket!.blocked.filter(card => card === f.saleCard).length, 1);
  }
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  const steps: { actor: string; action: Action }[] = [];
  game = finish(game, f.kind, steps); assert.deepEqual(steps, []);
  originalChooser(game, f);
  assert.deepEqual(finish(game, f.kind), game);
  return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native ${variant.kind}${variant.kind === 'choamSale' ? 'worthless' in variant ? ' Worthless2' : ' duplicate3' : ''} cost ${claimed ? 'claim' : 'pass'} retains the original offered card and resumes its native chooser once`, () => {
    const f = fixture(variant); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    reject(game, f.owner, f.nativeAction);
  });

void test('native CHOAM sale and Black Market allowance controls complete only the actual sale/discard or real unbid lot', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f);
    let game = allow(structuredClone(f.game));
    if (f.kind === 'choamSale') {
      assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice + f.price);
      assert.equal(player(game, f.owner).hand.some(card => card.id === f.saleCard), false);
      assert.equal(game.discard.filter(card => card.id === f.saleCard).length, 1);
      if (f.witness) assert.equal(player(game, f.owner).hand.filter(card => card.id === f.witness).length, 1);
      if (game.pendingTreacheryDiscard) {
        assert.equal(game.pendingTreacheryDiscard.continuation.kind, 'choamSaleDiscard');
        assert.deepEqual(game.pendingTreacheryDiscard.batch.entries.map(entry => entry.card.id), [f.saleCard]);
      }
    } else {
      assert.equal(game.response ?? null, null); assert.ok(game.richeseAuction);
      assert.equal(game.richeseAuction.source, 'blackMarket'); assert.equal(game.richeseAuction.outcome ?? null, null);
      assert.equal(game.richeseAuction.bid, 0); assert.deepEqual(resources(game), resources(f.game));
    }
    const steps: { actor: string; action: Action }[] = [];
    game = finish(game, f.kind, steps); originalChooser(game, f);
    if (f.kind === 'choamSale') {
      assert.ok(steps.every(step => step.action.type === 'semutaPass'));
      assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice + f.price);
      assert.equal(game.discard.filter(card => card.id === f.saleCard).length, 1);
    } else {
      assert.ok(steps.length > 0); assert.ok(steps.every(step => step.action.type === 'richeseBid' && step.action.amount === null));
      assert.deepEqual(resources(game), resources(f.game));
      assert.equal(player(game, f.owner).hand.filter(card => card.id === f.saleCard).length, 1);
    }
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('fresh native-market costs reject stale and underlying replies without paying or disposing the original offered cards', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.owner, f.nativeAction);
    reject(game, f.kind === 'choamSale' ? f.owner : f.originalLot!.active!, f.kind === 'choamSale'
      ? { type: 'decision', done: true } : { type: 'richeseBid', event: f.originalLot!.event, amount: null });
    assert.deepEqual(resources(game), resources(f.game));
    prevented(pass(game), f, false);
  }
});

void test('all four minimal profiles answer the actual native sale and Black Market cancellation costs legally', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass'); assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const choosing = viewGame(game, f.holder); choosing.players.find(player => player.id === f.holder)!.bot = difficulty;
        const selected = botActions(choosing)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      prevented(game, f, claimed);
    }
  }
});
