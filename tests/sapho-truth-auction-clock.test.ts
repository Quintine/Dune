import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceAuctionClock, hasAuctionClockOpportunity, synchronizeAuctionClock, type Game } from '../game/engine';
import { createSaphoTruthAuctionFixture as fixture, act, inventory, player, assertAuctionParent } from './fixture-sapho-truth-auction';
import { truthOrderFrame as frame, playSaphoTruthOrder as play, passFreshDiscard,
  finishTruthOrder as finish, finishOriginalTruthQuestions as answer } from './fixture-sapho-truth-order';

const epoch = '0:0';

/** Replays the original starting deal and earned cache Sapho fixture into its
 * original ordinary lot. A Truth↔hand exchange is already labeled there; for
 * Basic Semuta cases, additionally exchange the actual cached Semuta with an
 * Atreides hand card, preserving physical inventory and the original purse.
 * Trusted clock times below are supplied directly, not read from wall time. */
function openTimedTruth(advanced: boolean, semuta: boolean) {
  const f = fixture({advanced,standingBid:true,mode:'first'});
  let game: Game = structuredClone(f.beforeTruth);
  if (semuta) {
    const cache = game.richeseCache, holder = player(game,'atreides'); assert.ok(cache);
    const at = cache.findIndex(card => card.effect === 'semutaDrug'); assert.ok(at >= 0 && holder.hand.length > 0);
    const [card] = cache.splice(at,1), [exchange] = holder.hand.splice(0,1);
    holder.hand.push(card); cache.push(exchange);
  }
  assertAuctionParent(game,f.parent); assert.deepEqual(inventory(game),f.originalCards);
  assert.equal(game.auction?.clockVersion,1); assert.equal(hasAuctionClockOpportunity(game),true);
  game = synchronizeAuctionClock(game,1_000,epoch);
  assert.ok(game.auctionClock); assert.equal(game.auctionClock.remainingMs,10_000);
  assert.equal(game.auctionClock.startedAt,1_000); assert.equal(game.auctionClock.player,game.auction!.active);
  const initial = structuredClone(game.auctionClock);
  // A real Truth declaration interrupts the bidder after two elapsed seconds.
  game = act(game,f.owner,{type:'card',card:f.truth});
  game = synchronizeAuctionClock(game,3_000,epoch);
  assert.equal(game.auctionClock?.event,initial.event); assert.equal(game.auctionClock?.remainingMs,8_000);
  assert.equal(game.auctionClock?.startedAt,null);
  game = act(game,f.other,{type:'card',card:f.otherTruth});
  game = synchronizeAuctionClock(game,10_000,epoch);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(actor);
    game = act(game,actor.id,{type:'truthPass'});
    game = synchronizeAuctionClock(game,20_000,epoch);
  }
  assert.equal(game.truthtrance?.stage,'order');
  assert.equal(game.auctionClock?.event,initial.event); assert.equal(game.auctionClock?.remainingMs,8_000);
  assert.equal(game.auctionClock?.startedAt,null); assertAuctionParent(game,f.parent);
  return {f,game,initial};
}

for (const scenario of [
  {label:'Basic Semuta pass',advanced:false,semuta:true,claim:false},
  {label:'Basic Semuta claim',advanced:false,semuta:true,claim:true},
  {label:'Advanced without Semuta preview',advanced:true,semuta:false,claim:false},
]) void test(`${scenario.label}: the native bidder clock pauses through Truth order and Sapho disposal`, () => {
  const {f,game:opened,initial} = openTimedTruth(scenario.advanced,scenario.semuta);
  let game = opened;
  const event = game.auctionClock!.event, playerId = game.auctionClock!.player;
  assert.equal(event,initial.event);
  assert.equal(game.auctionClock!.remainingMs,8_000); assert.equal(game.auctionClock!.startedAt,null);
  const beforeLot = structuredClone(game.auction), orderFrame = frame(game);
  game = play(game,f.owner,f.card,'first');
  game = synchronizeAuctionClock(game,70_000,epoch);
  assert.equal(game.auctionClock?.event,event); assert.equal(game.auctionClock?.player,playerId);
  assert.equal(game.auctionClock?.remainingMs,8_000); assert.equal(game.auctionClock?.startedAt,null);
  assert.deepEqual(game.auction,beforeLot);
  if (scenario.semuta) {
    assert.ok(game.pendingTreacheryDiscard?.reaction);
    const pendingEvent = game.pendingTreacheryDiscard.batch.event;
    const held = advanceAuctionClock(game,100_000,epoch);
    assert.equal(held.auctionClock?.event,event); assert.equal(held.auctionClock?.remainingMs,8_000);
    assert.equal(held.auctionClock?.startedAt,null); assert.deepEqual(held.auction,beforeLot);
    game = held;
    if (scenario.claim) game = act(game,'atreides',{type:'semutaCommit',event:pendingEvent});
    else game = passFreshDiscard(game);
    game = synchronizeAuctionClock(game,120_000,epoch);
    assert.equal(game.pendingTreacheryDiscard,null);
    assert.equal(frame(game).event,orderFrame.event);
  }
  assert.equal(game.auctionClock?.event,event); assert.equal(game.auctionClock?.remainingMs,8_000);
  assert.equal(game.auctionClock?.startedAt,null);
  game = finish(game); game = synchronizeAuctionClock(game,150_000,epoch);
  assert.equal(game.truthtrance?.stage,'ask'); assert.equal(game.auctionClock?.startedAt,null);
  game = answer(game); assert.equal(game.truthtrance,null);
  game = synchronizeAuctionClock(game,200_000,epoch);
  assert.equal(game.auctionClock?.event,event); assert.equal(game.auctionClock?.player,playerId);
  assert.equal(game.auctionClock?.remainingMs,8_000); assert.equal(game.auctionClock?.startedAt,200_000);
  assert.deepEqual(game.auction,beforeLot); assert.deepEqual(inventory(game),f.originalCards);
  const stillLive = advanceAuctionClock(game,207_999,epoch);
  assert.equal(stillLive.auctionClock?.event,event); assert.deepEqual(stillLive.auction,beforeLot);
  const expired = advanceAuctionClock(stillLive,208_000,epoch);
  assert.ok(expired.auction?.passed.includes(playerId) || expired.auction?.index !== beforeLot!.index,
    'The original bidder receives the native timeout only after the retained budget expires');
  assert.deepEqual(inventory(expired),f.originalCards);
  assert.ok(initial.event,'A real clock event was created');
});
