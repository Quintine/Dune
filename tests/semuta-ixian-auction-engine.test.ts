import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaIxianAuctionFixture as fixture, actSemutaIxianAuction as act,
  passSemutaIxianAuction as pass, claimSemutaIxianAuction as claim,
  finishSemutaIxianAuction as finish, semutaIxianAuctionPlayer as player,
  semutaIxianAuctionInventory as inventory, type SemutaIxianAuctionFixture,
} from './fixture-semuta-ixian-auction';

const physical = (game: Game) => ({ turn: game.turn, phase: game.phase, order: game.order,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves, tanks: p.tanks,
    forces: p.forces, elites: p.elites, shipped: p.shipped, moved: p.moved, revived: p.revived })) });
function reject(game: Game, actor: string, proposed: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, proposed)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaIxianAuctionFixture) {
  assert.equal(f.game.advanced, f.advanced); assert.equal(f.setup.advanced, f.advanced);
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.ok(f.ixSetup); assert.equal(f.ixSetup.step.actor, f.owner);
  assert.ok(f.ixSetup.before.ixSetupCards!.some(card => card.id === f.cost));
  assert.equal(player(f.afterSetup, f.owner).hand[0].kind, 'shield');
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(f.afterSetup, f.observer).hand.some(card => card.id === f.observerKarama));
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.equal(f.beforePool.turn, 1); assert.equal(f.beforePool.response?.kind, 'ixAuction');
  assert.deepEqual(f.beforePool.ixAuction?.cards, []); assert.equal(f.beforePool.ixAuction?.count, f.poolCount);
  assert.ok(f.beforePool.mobileStronghold?.location); assert.ok(!f.beforePool.auction);
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 57);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaIxianAuctionFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard; assert.ok(pending);
  assert.equal(pending.continuation.kind, 'karamaAuctionAdvantageDiscard');
  if (pending.continuation.kind !== 'karamaAuctionAdvantageDiscard') throw Error('Expected the exact printed auction-cost continuation');
  assert.equal(pending.continuation.use.kind, 'cancel');
  if (pending.continuation.use.kind !== 'cancel') throw Error('Expected the original cancellation');
  assert.equal(pending.continuation.use.response.kind, f.kind);
  assert.equal(pending.continuation.use.response.owner, f.owner);
  assert.deepEqual(pending.batch.entries.map(entry => entry.card.id), [f.cost]);
  assert.deepEqual(pending.batch.entries.map(entry => entry.discardedBy), [f.spender]);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.deepEqual(game.deck, f.game.deck); assert.deepEqual(game.auction, f.game.auction);
  assert.deepEqual(game.ixAuction, f.game.ixAuction); assert.deepEqual(game.pendingIxTechnology, f.game.pendingIxTechnology);
  assert.equal(game.ixTechnologyTurn, f.game.ixTechnologyTurn);
  assert.deepEqual(physical(game), physical(f.game)); assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  return game;
}
function physicalCost(game: Game, f: SemutaIxianAuctionFixture, claimed: boolean) {
  assert.ok(!game.pendingTreacheryDiscard); assert.deepEqual(physical(game), physical(f.game));
  assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.ok(player(game, f.observer).hand.some(card => card.id === f.observerKarama));
}
function poolDenied(game: Game, f: SemutaIxianAuctionFixture, claimed: boolean) {
  physicalCost(game, f, claimed);
  assert.ok(!game.ixAuction); assert.ok(!game.ixAuctionKnown);
  assert.notEqual(game.decision?.kind, 'ixAuction');
  const expected = f.game.deck.slice(0, f.poolCount).map(card => card.id);
  assert.deepEqual(game.auction!.cards.map(card => card.id), expected);
  assert.equal(game.auction!.index, 0); assert.equal(game.auction!.bid, 0); assert.equal(game.auction!.bidder, null);
  assert.deepEqual(game.deck, f.game.deck.slice(f.poolCount));
  assert.equal(game.ixTechnologyTurn, f.game.ixTechnologyTurn);
  const beforePeekDeck = structuredClone(game.deck), done = finish(game);
  assert.deepEqual(done.deck, beforePeekDeck); assert.deepEqual(done.auction!.cards.map(card => card.id), expected);
  assert.equal(done.auction!.peekKnown, true);
  assert.equal(viewGame(done, f.spender).auction?.card?.id, expected[0]);
  assert.equal(done.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.deepEqual(inventory(done), f.originalInventory); return done;
}
function technologyDenied(game: Game, f: SemutaIxianAuctionFixture, claimed: boolean) {
  physicalCost(game, f, claimed);
  assert.ok(f.technology && f.declaredCard && f.lotCard);
  assert.equal(game.pendingIxTechnology, null); assert.equal(game.ixTechnologyTurn, game.turn);
  assert.deepEqual(game.auction!.cards, f.game.auction!.cards); assert.equal(game.auction!.index, f.game.auction!.index);
  assert.deepEqual(game.deck, f.game.deck); assert.deepEqual(game.ixAuctionKnown, f.game.ixAuctionKnown);
  const expectedHand = player(f.game, f.owner).hand.filter(card => !(f.selectedSemuta && claimed && card.id === f.semuta));
  if (f.selectedSemuta && claimed) expectedHand.push(player(f.game, f.spender).hand.find(card => card.id === f.cost)!);
  assert.deepEqual(player(game, f.owner).hand.map(card => card.id).sort(), expectedHand.map(card => card.id).sort());
  assert.equal(game.auction!.peekKnown, false); assert.equal(game.response?.kind, 'atreidesAuction');
  assert.equal(game.response?.owner, f.spender);
  assert.equal(viewGame(game, f.spender).auction?.card, null);
  reject(game, f.owner, f.technology.step.action);
  const done = finish(game);
  assert.equal(done.auction!.cards[done.auction!.index].id, f.lotCard);
  assert.equal(viewGame(done, f.spender).auction?.card?.id, f.lotCard);
  assert.equal(done.ixTechnologyTurn, done.turn); assert.equal(done.pendingIxTechnology, null);
  assert.deepEqual(done.deck, f.game.deck); assert.deepEqual(inventory(done), f.originalInventory);
  reject(done, f.owner, f.technology.step.action); return done;
}

for (const advanced of [false, true]) for (const claimed of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} native Ixian undrawn-pool cost Semuta ${claimed ? 'claim' : 'pass'} draws only the original ordinary count after prevention`, () => {
    const f = fixture({ advanced }); nativeSource(f);
    const offered = open(f);
    assert.deepEqual(offered.ixAuction!.cards, []); assert.equal(offered.ixAuction!.count, f.poolCount);
    assert.ok(!offered.auction); assert.equal(offered.deck.length, f.game.deck.length);
    const done = poolDenied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    assert.equal(done.decision, null); assert.equal(done.response, null);
  },
);

for (const claimed of [false, true]) void test(
  `Advanced native Technology outgoing-Shield cost Semuta ${claimed ? 'claim' : 'pass'} preserves the exact unseen lot and spent attempt`, () => {
    const f = fixture({ kind: 'ixTechnology' }); nativeSource(f);
    assert.ok(f.poolSelection); assert.equal(f.selectedSemuta, false);
    assert.equal(f.technology!.step.action.card, f.declaredCard);
    const offered = open(f);
    const done = technologyDenied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    assert.ok(player(done, f.owner).hand.some(card => card.id === f.declaredCard));
    assert.equal(player(done, f.owner).hand.some(card => card.id === f.lotCard), false);
  },
);

for (const claimed of [false, true]) void test(
  `Advanced native Technology selected Semuta itself ${claimed ? 'claims the counter cost' : 'passes'} after its real paid acquisition`, () => {
    const f = fixture({ kind: 'ixTechnology', holder: 'ixians' }); nativeSource(f);
    assert.equal(f.holder, f.owner); assert.equal(f.selectedSemuta, true);
    assert.equal(f.declaredCard, f.semuta); assert.equal(f.technology!.step.action.card, f.semuta);
    const offered = open(f);
    assert.equal(offered.pendingIxTechnology!.card, f.semuta);
    assert.ok(player(offered, f.owner).hand.some(card => card.id === f.semuta));
    technologyDenied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native Ixian counter-cost windows reject stale, foreign and underlying replies without a premature draw or exchange', () => {
  for (const kind of ['ixAuction', 'ixTechnology'] as const) {
    const f = fixture({ advanced: true, kind }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    reject(offered, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(offered, f.spender, { type: 'semutaCommit', event });
    reject(offered, f.spender, f.action); reject(offered, f.owner, { type: 'passResponse' });
    reject(offered, f.owner, kind === 'ixTechnology' ? f.technology!.step.action
      : { type: 'decision', card: f.game.deck[0].id, position: 'bottom' });
    const done = kind === 'ixAuction' ? poolDenied(pass(offered), f, false) : technologyDenied(pass(offered), f, false);
    reject(done, f.holder, { type: 'semutaCommit', event });
    reject(done, f.spender, f.action);
  }
});

void test('all four minimal profiles legally answer native pool and Technology costs including the outgoing Semuta singleton', () => {
  const options = [{ advanced: false }, { advanced: true },
    { kind: 'ixTechnology' as const }, { kind: 'ixTechnology' as const, holder: 'ixians' as const }];
  for (const option of options) {
    const f = fixture(option), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed, difficulty);
      assert.ok(proposed.type === 'semutaPass' || proposed.type === 'semutaCommit'); assert.equal(proposed.event, event);
      let done = act(structuredClone(offered), f.holder, proposed);
      const claimed = proposed.type === 'semutaCommit';
      if (done.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(done, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        done = act(done, f.holder, selected);
      } else if (done.pendingTreacheryDiscard) done = pass(done);
      if (f.kind === 'ixAuction') poolDenied(done, f, claimed); else technologyDenied(done, f, claimed);
    }
  }
});
