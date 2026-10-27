import assert from 'node:assert/strict';
import type { Game } from '../game/engine';
import { actTruthBid, advanceTruthBid, createTruthBidFixture, declareTruthBid,
  nextTruthBid, truthBidClean, truthBidPlayer, type TruthBidStep } from './fixture-truth-bid';

export type TruthTurnBidStep = TruthBidStep;
export const actTruthTurnBid = actTruthBid;
export const truthTurnBidPlayer = truthBidPlayer;
export const truthTurnBidClean = truthBidClean;
export const advanceTruthTurnBid = advanceTruthBid;

/** Original H/A/E (optional G) setup, starting deal, ordinary lot creation,
 * and native controls from the shared fixture; only unopened original deal,
 * lot/Spice positions and scalar lotteries are selected. */
export function createTruthTurnBidFixture(options: { advanced?: boolean; extraGuild?: boolean } = {}) {
  const original = createTruthBidFixture({ advanced: options.advanced, extraGuild: options.extraGuild, window:'waiting' });
  return { ...original, phaseQuestion: { kind:'phaseBid' as const, target:original.target,
    turn:original.game.turn, minimum:4 },
    sourceDisclosure: `${original.sourceDisclosure} Phase-wide question, answer and all subsequent bids remain caller actions.` };
}
export type TruthTurnBidFixture = ReturnType<typeof createTruthTurnBidFixture>;

export function bindTruthTurnBid(f: TruthTurnBidFixture, answer: 'yes'|'no', minimum = 4, state = f.game) {
  const declared = declareTruthBid(f,state), actions = [...declared.actions];
  let game = actTruthBid(declared.game,f.asker,{ type:'truthAsk', question: {
    kind:'phaseBid', target:f.target, turn:declared.game.turn, minimum,
  } },actions);
  const asked = structuredClone(game);
  game = actTruthBid(game,f.target,{type:'truthAnswer',answer},actions);
  return { game, declared, asked, actions };
}

/** Finish exactly the existing lot after a genuine winning bid; no future bid
 * or pool is installed. Neutral native continuations pay and advance it. */
export function finishTruthTurnBidLot(game: Game, actions: TruthBidStep[] = []) {
  assert.ok(game.auction && game.auction.bidder && game.auction.bid > 0);
  const turn = game.turn, index = game.auction.index;
  return advanceTruthBid(game,state => truthBidClean(state) &&
    (state.turn !== turn || state.phase !== 3 || !state.auction || state.auction.index !== index),actions);
}

/** Purchase this actual lot for one spice by the named player. Other bidders
 * pass using native controls; native payment and Emperor income settle. */
export function purchaseTruthTurnBidLot(game: Game, winner: string, actions: TruthBidStep[] = []) {
  assert.ok(game.auction); const turn = game.turn, index = game.auction.index;
  const card = game.auction.cards[index].id, before = structuredClone(game);
  for (let n = 0; n < 150; n++) {
    if (truthBidClean(game) && (game.turn !== turn || game.phase !== 3 || !game.auction || game.auction.index !== index)) {
      assert.ok(truthBidPlayer(game,winner).hand.some(c => c.id === card));
      return {game,before,card};
    }
    if (truthBidClean(game) && game.auction && game.auction.index === index && !game.currentAuctionSale) {
      const actor = game.auction.active;
      game = actTruthBid(game,actor,actor === winner && !game.auction.bidder
        ? {type:'bid',amount:1,allyPayment:0} : {type:'passBid'},actions);
    } else {
      const step = nextTruthBid(game); assert.ok(step);
      game = actTruthBid(game,step.actor,step.action,actions);
    }
  }
  throw Error('The actual funded ordinary purchase did not finish');
}
