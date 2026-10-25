import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaRicheseCacheKaramaFixture as fixture,
  actSemutaRicheseCacheKarama as act, claimSemutaRicheseCacheKarama as claim,
  passSemutaRicheseCacheKarama as pass, finishSemutaRicheseCacheKarama as finish,
  semutaRicheseCacheKaramaInventory as inventory, semutaRicheseCacheKaramaPlayer as player,
  type SemutaRicheseCacheKaramaFixture,
} from './fixture-semuta-richese-cache-karama';

const resources = (game: Game) => game.players.map(player => ({
  id: player.id, spice: player.spice, reserves: player.reserves, tanks: player.tanks,
  forces: player.forces, elites: player.elites, shipped: player.shipped, moved: player.moved,
  revived: player.revived, freeForcesRevived: player.freeForcesRevived, ally: player.ally,
}));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function nativeSource(f: SemutaRicheseCacheKaramaFixture) {
  assert.equal(f.initial.status, 'lobby');
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.semutaPreview, true);
  assert.equal(f.setup.advanced, f.advanced);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(player(f.afterSetup, f.spender).hand.find(card => card.id === f.cost)!.effect, 'karama');
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(player(f.acquisition.after, f.holder).hand.some(card => card.id === f.semuta));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.owner).spice - player(f.acquisition.before, f.owner).spice, 1);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 3);
  assert.equal(f.game.response?.kind, 'richeseAuction'); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.richeseBidding!.position, f.position);
  assert.equal(f.game.richeseBidding!.normalCountBeforeCache, f.beforeCount);
  assert.equal(f.game.richeseBidding!.normalCount, f.beforeCount - 1);
  assert.equal(f.game.richeseBidding!.cacheCanceled, false);
  assert.equal(f.game.richeseBidding!.blackMarketSold, !!f.blackMarketSale);
  assert.equal(f.cache.length, 9);
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaRicheseCacheKaramaFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaRicheseAuctionDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, 'karama:richeseAuction');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, public: entry.publicFace })),
    [{ card: f.cost, by: f.spender, public: true }]);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.response, null, 'The original cache response is parked while its cost is fresh');
  if (pending.continuation.kind !== 'karamaRicheseAuctionDiscard') throw Error('Use the exact cache cancellation continuation');
  assert.equal(pending.continuation.player, f.spender);
  assert.equal(pending.continuation.card, f.cost);
  assert.equal(pending.continuation.use.kind, 'cancel');
  assert.equal(pending.continuation.use.response.kind, 'richeseAuction');
  assert.equal(pending.continuation.use.response.owner, f.owner);
  assert.deepEqual(pending.continuation.resume.response, f.game.response);
  assert.equal(game.richeseBidding!.cacheCanceled, false, 'Prevention waits for the committed cost reaction');
  assert.equal(game.richeseBidding!.normalCount, f.beforeNormalCount);
  assert.equal(game.richeseBidding!.normalCountBeforeCache, f.beforeCount);
  assert.deepEqual(game.richeseCache!.map(card => card.id), f.cache);
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  return game;
}
function canceled(state: Game, f: SemutaRicheseCacheKaramaFixture, claimed: boolean) {
  const game = finish(state);
  assert.ok(!game.pendingTreacheryDiscard);
  assert.equal(game.turn, f.game.turn); assert.equal(game.phase, 3);
  assert.equal(game.richeseBidding!.event, f.event);
  assert.equal(game.richeseBidding!.stage, 'normal');
  assert.equal(game.richeseBidding!.position, f.position);
  assert.equal(game.richeseBidding!.cacheCanceled, true);
  assert.equal(game.richeseBidding!.blackMarketSold, !!f.blackMarketSale);
  assert.equal(game.richeseBidding!.normalCountBeforeCache, f.beforeCount);
  assert.equal(game.richeseBidding!.normalCount, f.beforeCount);
  assert.equal(game.richeseAuction, null);
  assert.ok(game.auction); assert.equal(game.auction.index, 0);
  assert.equal(game.auction.cards.length, f.beforeCount);
  assert.equal(game.auction.bid, 0); assert.equal(game.auction.bidder, null);
  assert.equal(game.currentAuctionSale, null);
  assert.equal(game.response, null); assert.equal(game.decision, null);
  assert.deepEqual(game.richeseCache!.map(card => card.id), f.cache);
  assert.deepEqual(resources(game), resources(f.game));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}

for (const advanced of [false, true]) for (const position of ['first', 'last'] as const) for (const claimed of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} genuine paid Semuta ${claimed ? 'claims' : 'passes'} the cache-${position} printed Karama before original prevention completes`, () => {
    const f = fixture({ advanced, position }); nativeSource(f);
    const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(pending, f) : pass(pending), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
  });
}

for (const claimed of [false, true]) void test(`Advanced actual Black Market reduction survives ${claimed ? 'claimed' : 'passed'} cache-cancel cost`, () => {
  const f = fixture({ advanced: true, position: 'last', blackMarket: true }); nativeSource(f);
  assert.ok(f.blackMarketSale);
  assert.equal(f.beforeCount, 3); assert.equal(f.beforeNormalCount, 2);
  assert.ok(player(f.blackMarketSale.after, f.emperor).hand.some(card => card.id === f.blackMarketSale!.card));
  assert.equal(player(f.blackMarketSale.before, f.emperor).spice - player(f.blackMarketSale.after, f.emperor).spice, 1);
  assert.equal(player(f.blackMarketSale.after, f.owner).spice - player(f.blackMarketSale.before, f.owner).spice, 1);
  const pending = open(f), game = canceled(claimed ? claim(pending, f) : pass(pending), f, claimed);
  assert.equal(game.auction!.cards.length, 3, 'Cache prevention restores one lot without undoing the real Black Market reduction');
  assert.ok(player(game, f.emperor).hand.some(card => card.id === f.blackMarketSale!.card));
});

void test('parked cost and stale source controls cannot repeat the cache cancellation or change its frozen count', () => {
  const f = fixture({ position: 'last' }); nativeSource(f);
  const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
  reject(pending, f.spender, f.action);
  reject(pending, f.spender, { type: 'passResponse' });
  reject(pending, f.owner, f.declaration.step.action);
  const game = canceled(claim(pending, f), f, true);
  reject(game, f.owner, f.declaration.step.action);
  reject(game, f.holder, { type: 'semutaCommit', event });
  assert.equal(game.richeseBidding!.cacheCanceled, true);
  assert.equal(game.richeseBidding!.stage, 'normal');
  assert.equal(game.richeseBidding!.normalCount, f.beforeCount);
  // A future real response may independently accept a held Karama; no global
  // ban is inferred from retirement of this original cache opportunity.
});

void test('all four minimal policies resolve the actual fresh cache-cancel cost and native ordinary suffix legally', () => {
  for (const difficulty of DIFFICULTIES) {
    const f = fixture(), pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    let game = pending;
    for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < 32; count++) {
      let proposal: { actor: string; action: Action } | undefined;
      for (const seat of game.players) {
        const view = viewGame(game, seat.id);
        view.players.find(player => player.id === seat.id)!.bot = difficulty;
        const before = structuredClone(view), action = botActions(view)[0];
        assert.deepEqual(view, before);
        if (action) { proposal = { actor: seat.id, action }; break; }
      }
      assert.ok(proposal);
      assert.ok(['semutaPass', 'semutaCommit', 'semutaSelect'].includes(proposal.action.type));
      game = act(game, proposal.actor, proposal.action);
    }
    assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event);
    const claimed = !player(game, f.holder).hand.some(card => card.id === f.semuta);
    canceled(game, f, claimed);
  }
});
