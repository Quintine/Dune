import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaAuctionInspectionFixture as fixture, actSemutaAuctionInspection as act,
  passSemutaAuctionInspection as pass, claimSemutaAuctionInspection as claim,
  finishSemutaAuctionInspection as finish, semutaAuctionInspectionInventory as inventory,
  semutaAuctionInspectionPlayer as player, type SemutaAuctionInspectionFixture,
} from './fixture-semuta-auction-inspection';

const resources = (game: Game) => ({
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    moved: player.moved, shipped: player.shipped, revived: player.revived, ally: player.ally })),
  turn: game.turn, phase: game.phase, order: game.order, active: game.active, ready: game.ready,
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAuctionInspectionFixture) {
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(player(f.acquisition.after, f.holder).hand.some(card => card.id === f.semuta));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 3);
  assert.equal(f.game.response?.kind, 'atreidesAuction'); assert.equal(f.game.response?.owner, f.owner);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.blackMarket ? f.game.richesePeekKnown : f.game.auction!.peekKnown, false);
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function sameOriginalLot(game: Game, f: SemutaAuctionInspectionFixture) {
  assert.deepEqual(f.blackMarket ? game.richeseAuction : game.auction, f.originalLot);
  assert.deepEqual(game.richeseBidding, f.originalRound);
  assert.deepEqual(game.richeseCache!.map(card => card.id), f.cache);
  assert.equal(game.active, f.nextBidder);
  assert.equal(f.blackMarket ? game.richeseAuction!.active : game.auction!.active, f.nextBidder);
  assert.equal(f.blackMarket ? game.richesePeekKnown : game.auction!.peekKnown, false);
  assert.deepEqual(f.blackMarket ? [game.richeseAuction!.cardId] : game.auction!.cards.map(card => card.id), f.cards);
  assert.equal(f.blackMarket ? game.richeseAuction!.bid : game.auction!.bid, 0);
  assert.equal(f.blackMarket ? game.richeseAuction!.bidder : game.auction!.bidder, null);
}
function open(f: SemutaAuctionInspectionFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.reaction?.stage, 'offer');
  assert.equal(pending.continuation.kind, 'karamaAuctionAdvantageDiscard');
  assert.equal(pending.batch.cause, 'karama:atreidesAuction');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, public: entry.publicFace })),
    [{ card: f.cost, by: f.spender, public: true }]);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.response, null, 'The original inspection is parked until its used-cost reaction finishes');
  if (pending.continuation.kind !== 'karamaAuctionAdvantageDiscard') throw Error('Use the native auction-advantage cost continuation');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.equal(pending.continuation.use.kind, 'cancel');
  assert.equal(pending.continuation.use.response.kind, 'atreidesAuction');
  assert.equal(pending.continuation.use.response.owner, f.owner);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  sameOriginalLot(game, f);
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}
function prevented(state: Game, f: SemutaAuctionInspectionFixture, claimed: boolean) {
  const game = finish(state);
  assert.equal(game.response, null); assert.equal(game.decision, null);
  assert.ok(!game.pendingTreacheryDiscard); assert.ok(!game.pendingKarama);
  sameOriginalLot(game, f);
  assert.deepEqual(resources(game), resources(f.game));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}

for (const advanced of [false, true]) for (const claimed of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} actual paid Semuta ${claimed ? 'claims' : 'passes'} printed Karama before normal Atreides inspection prevention resumes`, () => {
    const f = fixture({ advanced }); nativeSource(f);
    assert.equal(f.origin, 'normal'); assert.equal(f.game.auction!.index, 0);
    const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(pending, f) : pass(pending), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
  });

for (const claimed of [false, true]) void test(
  `Advanced unseen native Black Market inspection preserves its exact lot when the printed cost is ${claimed ? 'claimed' : 'passed'}`, () => {
    const f = fixture({ advanced: true, blackMarket: true }); nativeSource(f);
    assert.ok(f.beforeBlackMarket && f.blackMarketStep);
    assert.equal(f.game.richeseAuction!.source, 'blackMarket');
    assert.equal(f.game.richeseAuction!.method, 'normal');
    assert.ok(player(f.game, f.richese).hand.some(card => card.id === f.cards[0]));
    const pending = open(f), game = prevented(claimed ? claim(pending, f) : pass(pending), f, claimed);
    assert.ok(player(game, f.richese).hand.some(card => card.id === f.cards[0]));
    assert.equal(game.richeseBidding!.blackMarketSold, false);
    assert.equal(game.richeseBidding!.normalCount, null);
  });

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} native allowance control actually grants the original normal-lot peek without discarding Karama`, () => {
  const f = fixture({ advanced }); nativeSource(f);
  let game = structuredClone(f.game);
  for (let count = 0; game.response?.kind === 'atreidesAuction' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = act(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null); assert.equal(game.auction!.peekKnown, true);
  assert.ok(!game.pendingTreacheryDiscard);
  assert.deepEqual({ ...game.auction!, peekKnown: false }, f.originalLot);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(inventory(game), f.originalInventory);
});

for (const blackMarket of [false, true]) void test(`${blackMarket ? 'Black Market' : 'normal'} suspended inspection rejects underlying bids and stale cost reactions`, () => {
  const f = fixture({ advanced: blackMarket, blackMarket }); nativeSource(f);
  const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
  reject(pending, f.spender, f.action);
  reject(pending, f.owner, { type: 'passResponse' });
  reject(pending, f.nextBidder, blackMarket
    ? { type: 'richeseBid', event: f.game.richeseAuction!.event, amount: 1 }
    : { type: 'bid', amount: 1 });
  const game = prevented(claim(pending, f), f, true);
  reject(game, f.holder, { type: 'semutaCommit', event });
  reject(game, f.holder, { type: 'semutaPass', event });
});

void test('all four minimal policies resolve the genuine auction-inspection cost without revealing or advancing its lot', () => {
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
    prevented(game, f, claimed);
  }
});
