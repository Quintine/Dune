import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaIxAllyCostFixture as fixture, actSemutaIxAllyCost as act,
  passSemutaIxAllyCost as pass, claimSemutaIxAllyCost as claim,
  allowSemutaIxAllyCost as allow, finishSemutaIxAllyCost as finish,
  semutaIxAllyCostPlayer as player, semutaIxAllyCostInventory as inventory,
  type SemutaIxAllyCostFixture,
} from './fixture-semuta-ix-ally-cost';

const variants = [{ advanced: false }, { advanced: true }];
const physical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  mobile: game.mobileStronghold, aid: game.aid, offers: game.allianceOffers,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves,
    tanks: p.tanks, elites: p.elites, leaders: p.leaders, ally: p.ally, allySinceTurn: p.allySinceTurn,
    moved: p.moved, shipped: p.shipped })),
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaIxAllyCostFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'ixians', 'fremen', 'guild']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.setupChoices.steps.some(step => step.actor === f.owner && step.action.type === 'decision' &&
    player(f.afterSetup, f.owner).hand.some(card => card.id === step.action.card && card.kind === 'shield')));
  assert.equal(player(f.afterSetup, f.buyer).forces['sietch_tabr:14'], 10);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.pact.before.turn, 2); assert.equal(f.pact.before.phase, 1); assert.equal(f.pact.before.nexus, true);
  assert.equal(f.pact.steps.length, 2); assert.ok(f.pact.steps.every(step => step.action.type === 'alliance'));
  assert.equal(player(f.game, f.owner).ally, f.buyer); assert.equal(player(f.game, f.buyer).ally, f.owner);
  assert.ok(f.spiceOrder.some(row => row.turn === 2 && 'worm' in row.card));
  assert.ok(f.pool.steps.some(step => step.actor === f.owner && step.action.type === 'decision' && step.action.position === 'bottom'),
    'The actual native Ixian pool return precedes the ordinary auction');
  assert.ok(f.purchase.steps.some(step => step.actor === f.buyer && step.action.type === 'bid' && step.action.amount === 1));
  assert.equal(player(f.payment.before, f.buyer).spice - player(f.payment.after, f.buyer).spice, 1);
  assert.ok(f.payment.steps.length > 0);
  assert.equal(f.originalSale.origin, 'normal'); assert.equal(f.originalSale.winner, f.buyer);
  assert.equal(f.originalSale.amount, 1); assert.equal(f.originalSale.free, false);
  assert.equal(f.originalPending.player, f.buyer); assert.equal(f.originalPending.card, f.deliveredCard.id);
  assert.equal(f.originalPending.free, false);
  assert.equal(player(f.payment.before, f.buyer).hand.some(card => card.id === f.deliveredCard.id), false);
  assert.equal(player(f.payment.after, f.buyer).hand.filter(card => card.id === f.deliveredCard.id).length, 1);
  assert.deepEqual(f.request.steps, [{ actor: f.buyer, action: f.requestAction }]);
  assert.equal(f.game.response?.kind, 'ixAllyCard'); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.response?.recipient, f.buyer); assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 3);
  assert.equal(f.game.decision ?? null, null); assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(f.game.pendingIxAlly, f.originalPending); assert.deepEqual(f.game.currentAuctionSale, f.originalSale);
  assert.deepEqual(f.game.deck, f.originalDeck); assert.equal(f.originalInventory.length, 57);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaIxAllyCostFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaMarketDiscard');
  if (pending.continuation.kind !== 'karamaMarketDiscard') throw Error('Use the original paid ally replacement cost');
  assert.equal(pending.batch.cause, 'karama:ixAllyCard'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(game.pendingIxAlly, f.originalPending); assert.deepEqual(game.currentAuctionSale, f.originalSale);
  assert.deepEqual(game.auction, f.originalAuction); assert.deepEqual(game.deck, f.originalDeck);
  assert.equal(player(game, f.buyer).hand.filter(card => card.id === f.deliveredCard.id).length, 1);
  assert.deepEqual(physical(game), physical(f.game));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function canceled(state: Game, f: SemutaIxAllyCostFixture, claimed: boolean) {
  assert.equal(state.pendingTreacheryDiscard ?? null, null); assert.equal(state.pendingIxAlly ?? null, null);
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.currentAuctionSale ?? null, null); assert.equal(game.response ?? null, null);
  assert.equal(game.pendingIxAlly ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.equal(game.auction?.index, f.originalAuction.index + 1);
  assert.deepEqual(game.deck, f.originalDeck, 'Prevention never draws a replacement or replays the auction pool');
  assert.equal(player(game, f.buyer).hand.filter(card => card.id === f.deliveredCard.id).length, 1);
  assert.equal(game.discard.some(card => card.id === f.deliveredCard.id), false);
  assert.deepEqual(player(game, f.buyer).hand, player(f.game, f.buyer).hand);
  assert.deepEqual(physical(game), physical(f.game), 'The original bank payment and physical board stay committed');
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.ok(steps.every(step => !['bid', 'richeseBid', 'ship', 'move', 'card'].includes(step.action.type)));
  reject(game, f.buyer, f.requestAction); reject(game, f.spender, f.action);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native Ixian ally paid ordinary replacement cost Semuta ${claimed ? 'claim' : 'pass'} keeps the delivered card and finishes the paid sale once`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
  },
);

void test('native Ixian ally allowance actually discards the delivered card then draws one replacement after its real fresh-discard passes', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f); let game = allow(structuredClone(f.game));
    assert.equal(game.pendingIxAlly ?? null, null);
    assert.equal(player(game, f.buyer).hand.some(card => card.id === f.deliveredCard.id), false);
    assert.equal(game.discard.filter(card => card.id === f.deliveredCard.id).length, 1);
    assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'ixAllyCard');
    assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'ixAllyCard');
    assert.deepEqual(game.currentAuctionSale, f.originalSale); assert.deepEqual(game.deck, f.originalDeck);
    assert.deepEqual(physical(game), physical(f.game));
    const event = game.pendingTreacheryDiscard!.batch.event, steps: { actor: string; action: Action }[] = [];
    game = finish(game, steps);
    assert.ok(steps.some(step => step.action.type === 'semutaPass' && step.action.event === event));
    assert.ok(steps.every(step => !['bid', 'richeseBid', 'card', 'ship', 'move'].includes(step.action.type)));
    assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.currentAuctionSale ?? null, null);
    assert.equal(game.auction?.index, f.originalAuction.index + 1);
    assert.equal(player(game, f.buyer).hand.filter(card => card.id === f.replacementTop.id).length, 1);
    assert.equal(player(game, f.buyer).hand.some(card => card.id === f.deliveredCard.id), false);
    assert.equal(game.discard.filter(card => card.id === f.deliveredCard.id).length, 1);
    assert.deepEqual(game.deck, f.originalDeck.slice(1)); assert.deepEqual(physical(game), physical(f.game));
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(inventory(game), f.originalInventory);
    reject(game, f.buyer, f.requestAction); reject(game, f.holder, { type: 'semutaCommit', event });
  }
});

void test('fresh Ixian ally costs reject stale and underlying purchase answers while the paid original and pending replacement stay parked', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.holder, { type: 'semutaSelect', event, card: f.deliveredCard.id });
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.buyer, f.requestAction);
    reject(game, f.buyer, { type: 'decision', karama: false });
    reject(game, f.buyer, { type: 'bid', amount: 2 }); reject(game, f.buyer, { type: 'passBid' });
    assert.deepEqual(game.currentAuctionSale, f.originalSale); assert.deepEqual(game.pendingIxAlly, f.originalPending);
    assert.deepEqual(game.deck, f.originalDeck); assert.deepEqual(physical(game), physical(f.game));
    canceled(pass(game), f, false);
  }
});

void test('all four minimal profiles legally answer native Basic and Advanced Ixian ally replacement costs', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before); assert.ok(action.type === 'semutaPass' || action.type === 'semutaCommit');
      assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      canceled(game, f, claimed);
    }
  }
});
