import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer,
  type TruthMovementStep,
} from './fixture-truth-movement';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type TruthMovementNativeEarlyStep = TruthMovementStep;
export type TruthMovementNativeEarlyRoster = 'richese-choam' | 'ecaz-moritani' | 'ixians-tleilaxu';
export type TruthMovementNativeEarlyAuction = {
  position?: 'first' | 'last';
  method?: 'onceAround' | 'silent';
  direction?: 'clockwise' | 'counterclockwise';
  card?: string;
  keepUnbid?: boolean;
};
export const actTruthMovementNativeEarly = actTruthMovement;
export const truthMovementNativeEarlyClean = truthMovementClean;
export const truthMovementNativeEarlyPlayer = truthMovementPlayer;
export const truthMovementNativeEarlyInventory = truthMovementInventory;

/** Consume live native controls only. Callers own Truthtrance, paid bids and
 * Emperor's shipment/movement; cache defaults are actual zero/pass actions. */
export function nextTruthMovementNativeEarlyStep(game: Game,
  auction: TruthMovementNativeEarlyAuction = {}): TruthMovementNativeEarlyStep | null {
  if (game.truthtrance) return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision) {
      const actor = decision.player, event = game.richeseBidding?.event;
      if (decision.kind === 'richeseBlackMarket')
        return { actor, action: { type: 'decision', event, decline: true } };
      if (decision.kind === 'richeseDeclaration')
        return { actor, action: { type: 'decision', event, position: auction.position ?? 'first' } };
      if (decision.kind === 'richeseCacheTerms') return { actor, action: {
        type: 'decision', event, method: auction.method ?? 'onceAround',
        direction: auction.direction ?? 'clockwise',
      } };
      if (decision.kind === 'richeseCache') {
        const card = game.richeseCache?.find(card => auction.card ? card.id === auction.card : true);
        assert.ok(card, 'Choose an original card still held in the native Richese cache');
        return { actor, action: { type: 'decision', event, card: card.id,
          ...(actor === game.richeseBidding?.owner ? {
            method: auction.method ?? 'onceAround', direction: auction.direction ?? 'clockwise',
          } : {}),
        } };
      }
      if (decision.kind === 'richeseUnbid')
        return { actor, action: { type: 'decision', event, keep: auction.keepUnbid ?? false } };
      if (decision.kind === 'ecazPlacement' || decision.kind === 'choamMovement')
        return { actor, action: { type: 'decision', decline: true } };
      if (decision.kind === 'moritaniSetup')
        return { actor, action: { type: 'decision', territory: 'oh_gap', sector: 9 } };
      if (decision.kind === 'ixSetup') {
        const card = game.ixSetupCards?.find(card => card.kind === 'shield');
        assert.ok(card, 'Ixians must actually choose the original Shield from their starting-card inspection');
        return { actor, action: { type: 'decision', card: card.id } };
      }
    }
    const ecaz = game.players.find(player => player.faction === 'ecaz');
    if (!decision && game.status === 'setup' && game.setupStage === 'forces' && ecaz?.reserves === 20)
      return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
  }
  if (truthMovementNativeEarlyClean(game)) {
    if (game.richeseAuction && !game.richeseAuction.outcome) {
      const lot = game.richeseAuction;
      const actor = lot.method === 'silent'
        ? lot.eligible.find(id => !Object.hasOwn(lot.sealed, id)) : lot.active;
      assert.ok(actor, 'An unfinished native cache lot needs its next eligible bidder');
      return { actor, action: { type: 'richeseBid',
        event: lot.event, amount: lot.method === 'silent' ? 0 : null } };
    }
    if (game.status === 'playing' && game.phase === 5 && game.active === 'emperor') return null;
  }
  return nextStrongholdFactionsNativeStep(game);
}

export function advanceTruthMovementNativeEarly(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementNativeEarlyStep[] = [], auction: TruthMovementNativeEarlyAuction = {}): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original native source ended before its requested control');
    const step = nextTruthMovementNativeEarlyStep(game, auction);
    assert.ok(step, 'Supply the real Truthtrance, bid or Emperor movement choice before continuing');
    game = actTruthMovementNativeEarly(game, step.actor, step.action, actions);
  }
  throw Error('The original native early movement source did not reach its finite boundary');
}

/** Fresh public Basic expansion setup, stopped at clean Charity before any
 * question or Bidding. Select only original unopened deal/Spice positions and
 * scalar lotteries; original setup controls supply every physical counter. */
export function createTruthMovementNativeEarlyFixture(options: {
  roster?: TruthMovementNativeEarlyRoster;
} = {}) {
  const roster = options.roster ?? 'richese-choam', asker = 'atreides', target = 'emperor';
  const native = roster === 'richese-choam' ? ['richese', 'choam'] as const
    : roster === 'ecaz-moritani' ? ['ecaz', 'moritani'] as const : ['ixians', 'tleilaxu'] as const;
  const expansions = roster === 'richese-choam' ? ['choam'] : roster === 'ecaz-moritani' ? ['ecaz'] : ['ix'];
  let game = createGame(`TRUTHMOVEMENTEARLY${roster.toUpperCase()}`,
    newPlayer(asker, 'Atreides', 'atreides'), false, expansions);
  for (const faction of [target, ...native] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: TruthMovementNativeEarlyStep[] = [];
  const act = (actor: string, action: Action) => {
    game = actTruthMovementNativeEarly(game, actor, action, actions);
  };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceTruthMovementNativeEarly(game, until, actions);
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game), lobbyActionCount = actions.length;
  act(game.host, { type: 'start' });
  const setup = structuredClone(game), setupActionCount = actions.length;
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.deepEqual(game.expansions, expansions);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0), 'Choose only an unopened original deal');
  const originalMainDeck = game.deck.map(card => card.id), originalCache = (game.richeseCache ?? []).map(card => card.id);
  const originalCards = truthMovementNativeEarlyInventory(game);
  if (roster === 'richese-choam') {
    assert.equal(originalMainDeck.length, 35); assert.equal(originalCache.length, 10);
  }
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const baliset = game.deck.find(card => card.name === 'Baliset');
  const shield = game.deck.find(card => card.kind === 'shield');
  const snooper = game.deck.find(card => card.kind === 'snooper');
  assert.ok(truth && baliset && shield && snooper);
  const deal = [truth.id, baliset.id, shield.id, snooper.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), afterSetupActionCount = actions.length;
  for (const [index, player] of game.players.entries())
    assert.deepEqual(player.hand.map(card => card.id), [deal[index]]);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const beforeSpiceOrder = structuredClone(game);
  const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
  const land = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(land);
  const spiceOrder = [{ position: 0, from, card: structuredClone(land) }];
  reach(state => state.turn === 1 && state.phase === 2 && truthMovementNativeEarlyClean(state));
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, false);
  assert.deepEqual(game.ready, []); assert.equal(game.auction ?? null, null);
  assert.equal(game.richeseBidding ?? null, null); assert.equal(game.richeseAuction ?? null, null);
  assert.equal(game.truthtrance ?? null, null); assert.equal(game.movementPromises, undefined);
  const emperor = truthMovementNativeEarlyPlayer(game, target);
  assert.equal(emperor.spice, 10); assert.equal(emperor.reserves, 20); assert.equal(emperor.tanks, 0);
  assert.deepEqual(emperor.forces, {}); assert.equal(emperor.shipped, false); assert.equal(emperor.moved, 0);
  assert.ok(truthMovementNativeEarlyPlayer(game, asker).hand.some(card => card.id === truth.id));
  assert.deepEqual(truthMovementNativeEarlyInventory(game), originalCards);
  assert.deepEqual([...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort(), originalSpice);
  const claim = { kind: 'movement' as const, target, territory: 'carthag', minimum: 8 };
  return {
    game, source: structuredClone(game), roster, expansions, asker, target, native,
    richese: roster === 'richese-choam' ? 'richese' : null,
    choam: roster === 'richese-choam' ? 'choam' : null,
    ecaz: roster === 'ecaz-moritani' ? 'ecaz' : null,
    moritani: roster === 'ecaz-moritani' ? 'moritani' : null,
    ixians: roster === 'ixians-tleilaxu' ? 'ixians' : null,
    tleilaxu: roster === 'ixians-tleilaxu' ? 'tleilaxu' : null,
    lobby, lobbyActionCount, setup, setupActionCount, beforeStartingDeal, afterSetup, afterSetupActionCount,
    beforeSpiceOrder, spiceOrder, deal, dealOrder, startingDealSelection: dealOrder,
    originalMainDeck, originalCache, originalCards, originalTreachery: originalCards, originalSpice,
    actions, sourceActionCount: actions.length,
    sourceCounts: { lobby: lobbyActionCount, setup: setupActionCount, storm: afterSetupActionCount, charity: actions.length },
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    card: truth.id, truth: truth.id, claim, question: claim,
    declarationStep: { actor: asker, action: { type: 'card', card: truth.id } } satisfies TruthMovementNativeEarlyStep,
    askStep: { actor: asker, action: { type: 'truthAsk', question: claim } } satisfies TruthMovementNativeEarlyStep,
    bid: { type: 'bid', amount: 2, allyPayment: 0 } satisfies Action,
    payment: { type: 'decision', karama: false } satisfies Action,
    purchaseCost: 2,
    shipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 8, elite: 0, allyPayment: 0 } satisfies Action,
    shipmentCost: 8,
    move: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 8 } satisfies Action,
    endMovement: { type: 'endMovement' } satisfies Action,
    staging: [
      `Original public bare Basic Atreides/Emperor/${native.join('/')} setup uses four original unopened deal positions, one ordinary unopened Spice position and native scalar lotteries. Actual setup deals Truthtrance to Atreides and Baliset to Emperor, and actual Storm/Spice controls reach clean turn-1 Charity in exactly ${actions.length} recorded actions. Emperor retains its printed ten spice, twenty reserves, zero board forces and unused movement. ${roster === 'richese-choam' ? 'The original 35-card main deck and ten-card cache are conserved; native first/last Once Around/Silent auctions remain future controls.' : roster === 'ecaz-moritani' ? 'Ecaz actually places six in Imperial Basin and Moritani actually places six in empty Oh Gap; neither spends Emperor resources.' : 'Ixians actually inspect the four original starting cards and choose the original Shield; the remaining Truthtrance/Baliset/Snooper are natively shuffled and dealt to Atreides/Emperor/Tleilaxu. The native mobile-stronghold placement retains its original six-counter garrison, and Tleilaxu receives its actual original Face Dancers.'} The constructor stops before any Truthtrance declaration, answer, auction declaration, bid or payment. Future purchase2, city shipment8, ground movement8 and ending movement remain caller actions; no dealt hand, wallet, force, clock, answer, promise or completed receipt is installed.`,
    ],
  };
}
export type TruthMovementNativeEarlyFixture = ReturnType<typeof createTruthMovementNativeEarlyFixture>;
