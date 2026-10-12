import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { createBureaucratQualifyingSplitSetup, advanceBureaucratQualifyingSplit, type BureaucratQualifyingSplitStep } from './fixture-bureaucrat-qualifying-split';
export interface BureaucratQualifyingAuctionFixture {
  game: Game;
  setup: Game;
  beforeBribe: Game;
  bribe: Game;
  afterFirstMentat: Game;
  worm: Game;
  alliance: Game;
  sourceSetup: Game;
  beforePledge: Game;
  originalPledge: BureaucratQualifyingSplitStep;
  pledged: Game;
  beforeAction: Game;
  action: Action;
  payer: string;
  donor: string;
  trainer: string;
  guild: string;
  emperor: string;
  payerShare: number;
  donorShare: number;
  amount: number;
  counterCard?: string;
  physical: string[];
  reservedCard: string;
  bonusCard?: string;
  actions: BureaucratQualifyingSplitStep[];
  staging: string[];
}


export const qualifyingAuctionPlayer = (game: Game, id: string) => game.players.find(player => player.id === id)!;
export function qualifyingAuctionPhysicalCards(game: Game): string[] {
  return [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale?.origin === 'normal' ? 1 : 0)) ?? [])]
    .map(card => card.id).sort();
}

/** Swap conserved physical cards, retaining the original hand size and auction
 * quantity. Harkonnen's Karama makes the native winning payment a real choice;
 * no purchase bonus is dealt until the original income continuation finishes. */
function positionKarama(game: Game, actor: string, staging: string[]): string {
  const player = qualifyingAuctionPlayer(game, actor);
  const held = player.hand.find(card => card.effect === 'karama');
  if (held) return held.id;
  const index = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0, 'An original undealt physical Karama must be available');
  const outgoing = player.hand[0];
  assert.ok(outgoing);
  const incoming = game.deck[index];
  game.deck[index] = outgoing;
  player.hand[0] = incoming;
  staging.push(`Swap original held ${outgoing.id} with original undealt ${incoming.id} for ${actor}; retain hand size and committed lots.`);
  return incoming.id;
}

export function createBureaucratQualifyingAuctionFixture({
  advanced = false, payerShare = 5, donorShare = 3, donor = 'f', counter = false, lastHandSpace = false,
}: { advanced?: boolean; payerShare?: number; donorShare?: number; donor?: 'f' | 'b' | 'e'; counter?: boolean; lastHandSpace?: boolean } = {}): BureaucratQualifyingAuctionFixture {
  const native = createBureaucratQualifyingSplitSetup(advanced);
  let game = native.game, alliance = native.alliance;
  let actions = native.actions;
  const staging = native.staging;
  if (donor !== native.donor) {
    // Branch at the actual worm, before either mutual alliance proposal.
    game = structuredClone(native.worm);
    actions = actions.slice(0, actions.findIndex(step => step.action.type === 'alliance'));
    for (const [actor, target] of [[native.payer, donor], [donor, native.payer]]) {
      const action: Action = { type: 'alliance', target };
      actions.push({ actor, action });
      game = applyAction(game, actor, action);
    }
    alliance = structuredClone(game);
    game = advanceBureaucratQualifyingSplit(game, state => state.phase === 3 && !!state.auction &&
      !state.phaseOpening && !state.response && !state.decision, actions);
  }
  const sourceSetup = structuredClone(game);
  const physical = qualifyingAuctionPhysicalCards(game);
  positionKarama(game, native.payer, staging);
  const counterCard = counter ? positionKarama(game, native.trainer, staging) : undefined;
  if (lastHandSpace) {
    const payer = qualifyingAuctionPlayer(game, native.payer);
    while (payer.hand.length < handLimit(payer) - 1) {
      const incoming = game.deck.shift();
      assert.ok(incoming);
      payer.hand.push(incoming);
      staging.push(`Conserve original undealt ${incoming.id} into ${payer.id} after original auction quantity committed.`);
    }
  }
  assert.deepEqual(qualifyingAuctionPhysicalCards(game), physical);
  const originalPledge: BureaucratQualifyingSplitStep = { actor: donor, action: { type: 'pledgeAid', amount: donorShare } };
  const beforePledge = structuredClone(game);
  actions.push(originalPledge);
  game = applyAction(game, originalPledge.actor, originalPledge.action);
  const pledged = structuredClone(game);
  for (let n = 0; game.auction!.active !== native.payer && n < game.players.length; n++) {
    const step: BureaucratQualifyingSplitStep = { actor: game.auction!.active, action: { type: 'passBid' } };
    actions.push(step);
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.auction!.active, native.payer);
  const beforeAction = structuredClone(game), amount = payerShare + donorShare;
  const action: Action = { type: 'bid', amount, allyPayment: donorShare };
  return { ...native, donor, alliance, game, sourceSetup, beforePledge, originalPledge, pledged, beforeAction, action,
    payerShare, donorShare, amount, counterCard, physical, reservedCard: game.auction!.cards[game.auction!.index].id,
    bonusCard: game.deck[0]?.id, actions, staging };
}

export function payBureaucratQualifyingAuction(fixture: BureaucratQualifyingAuctionFixture, state = fixture.game): Game {
  let game = applyAction(state, fixture.payer, fixture.action);
  fixture.actions.push({ actor: fixture.payer, action: fixture.action });
  for (let n = 0; game.decision?.kind !== 'auctionPayment' && n < game.players.length + 2; n++) {
    assert.ok(game.auction && !game.currentAuctionSale);
    const step: BureaucratQualifyingSplitStep = { actor: game.auction.active, action: { type: 'passBid' } };
    fixture.actions.push(step);
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.decision?.kind, 'auctionPayment');
  assert.equal(game.decision!.player, fixture.payer);
  const action: Action = { type: 'decision', karama: false };
  fixture.actions.push({ actor: fixture.payer, action });
  return applyAction(game, fixture.payer, action);
}

export function allowQualifyingAuctionResponses(state: Game): Game {
  let game = state;
  for (let n = 0; game.response && n < 40; n++) {
    const actor = game.players.find(player => {
      const controls = viewGame(game, player.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(actor, 'The original response must have a legal unpassed counter holder');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}

export function chooseQualifyingAuction(game: Game, redirect = true): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player, { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}
