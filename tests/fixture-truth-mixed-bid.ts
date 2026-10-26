import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { BidActionClaim } from '../game/mixed-bid-question';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact } from '../game/truthtrance';
import {
  actTruthBid, advanceTruthBid, answerTruthBid, continueTruthBidLot, createTruthBidFixture,
  declareTruthBid, finishTruthBid, nextTruthBid, truthBidClean, truthBidInventory,
  truthBidPlayer, type TruthBidStep,
} from './fixture-truth-bid';

export type TruthMixedBidExpression = MixedActionExpression<BidActionClaim>;
export type TruthMixedBidStep = TruthBidStep;
export const actTruthMixedBid = actTruthBid;
export const advanceTruthMixedBid = advanceTruthBid;
export const answerTruthMixedBid = answerTruthBid;
export const continueTruthMixedBidLot = continueTruthBidLot;
export const finishTruthMixedBid = finishTruthBid;
export const nextTruthMixedBid = nextTruthBid;
export const truthMixedBidClean = truthBidClean;
export const truthMixedBidInventory = truthBidInventory;
export const truthMixedBidPlayer = truthBidPlayer;

export const truthMixedBidFact = (fact: TruthFact): TruthMixedBidExpression => ({ kind: 'fact', fact });
export const truthMixedBidMinimum = (minimum = 4): TruthMixedBidExpression => ({ kind: 'action', action: { minimum } });
export const truthMixedBidGroup = (kind: 'and' | 'or', ...terms: TruthMixedBidExpression[]): TruthMixedBidExpression =>
  ({ kind, terms });

/** Original public H/A/E base33, Basic22/Advanced25 active or Basic20/Advanced23
 * waiting. This thin adapter changes only the raw question. It installs no
 * played hand, purse, auction clock, response, frozen fact or residual binding. */
export function createTruthMixedBidFixture(options: {
  advanced?: boolean; window?: 'waiting' | 'active'; targetKarama?: boolean; mixed?: TruthMixedBidExpression;
} = {}) {
  const { mixed: suppliedMixed, ...sourceOptions } = options;
  const base = createTruthBidFixture({ ...sourceOptions, window: options.window ?? 'active' });
  const shield = base.setup.deck.find(card => card.kind === 'shield');
  const hajr = base.setup.deck.find(card => card.effect === 'hajr');
  assert.ok(shield && hajr, 'The original unopened base33 supplies printed current-fact identities');
  const shieldFact: TruthFact = { kind: 'hand', name: shield.name };
  const hajrFact: TruthFact = { kind: 'hand', name: hajr.name };
  const spiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: 10 };
  const forecastFact: TruthFact = { kind: 'stormForecast', compare: 'gte', value: 1 };
  const mixed = structuredClone(suppliedMixed ?? truthMixedBidGroup('and', truthMixedBidFact(spiceFact),
    truthMixedBidMinimum()));
  const question = { kind: 'mixedBid' as const, target: base.target, turn: base.game.turn,
    lot: base.game.auction!.index + 1, mixed };
  return { ...base, bidSource: base, mixed, question, shieldFact, hajrFact, spiceFact, forecastFact,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    sourceCounts: { inherited: base.sourceActions.length, basicActive: 22, advancedActive: 25,
      basicWaiting: 20, advancedWaiting: 23 },
    sourceDisclosure: `${base.sourceDisclosure} This thin mixed adapter changes only the original raw question: current facts and future accepted minimum bids share one AND/OR tree in the original current lot. No compiled threshold or answer-time fact is installed.` };
}
export type TruthMixedBidFixture = ReturnType<typeof createTruthMixedBidFixture>;

export function declareTruthMixedBid(f: TruthMixedBidFixture, source = f.game, options: { copies?: 1 | 2 } = {}) {
  return declareTruthBid(f.bidSource, source, options);
}
export function askTruthMixedBid(game: Game, asker: string, target: string, mixed: TruthMixedBidExpression,
  actions: TruthMixedBidStep[] = []): Game {
  assert.ok(game.auction);
  return actTruthMixedBid(game, asker, { type: 'truthAsk', question: {
    kind: 'mixedBid', target, turn: game.turn, lot: game.auction.index + 1, mixed: structuredClone(mixed),
  } }, actions);
}
export function bindTruthMixedBid(f: TruthMixedBidFixture, answer: 'yes' | 'no' = 'yes',
  mixed = f.mixed, source = f.game) {
  const declared = declareTruthMixedBid(f, source), actions = [...declared.actions];
  const asked = askTruthMixedBid(declared.game, f.asker, f.target, mixed, actions);
  const game = answerTruthMixedBid(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}

/** Own original question and whole answer only; no frozen fact, reduced minimum
 * or physical-lot source is read through this accessor. */
export function truthMixedBidPromise(game: Game,
  target = game.truthHistory?.at(-1)?.question.target ?? game.players[0].id) {
  const row = viewGame(game, target).mixedBidPromises.find(row => row.player === target);
  assert.ok(row, 'The respondent retains the original mixed question and aggregate status');
  return row;
}
