import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type BasicSemutaAmbassadorEffect = 'choam' | 'ixians';
export type BasicSemutaAmbassadorStep = { actor: string; action: Action };
export type BasicSemutaAmbassadorTransition = { before: Game; step: BasicSemutaAmbassadorStep; after: Game };
export const basicSemutaAmbassadorPlayer = (game: Game, actor = 'ecaz') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const basicSemutaAmbassadorClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export const basicSemutaAmbassadorBalances = (game: Game) => Object.fromEntries(
  game.players.map(player => [player.id, player.spice]),
);
export const basicSemutaAmbassadorInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original physical Treachery card has one current slot');
  return ids;
};

/** Only original scalar lotteries are selected. Nine supplied rolls are scoped
 * to native packet creation; UUID and all other byte entropy remains native. */
function withOriginalScalarLottery<T>(run: () => T, packet: readonly number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < packet.length ? packet[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const result = run(); assert.equal(cursor, packet.length, 'The original packet consumed its nine selected draws');
    return result;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actBasicSemutaAmbassador(game: Game, actor: string, action: Action,
  actions: BasicSemutaAmbassadorStep[] = []): Game {
  const next = withOriginalScalarLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}

/** The source owns its auction, placement and effect selections. Continuations
 * close actual native windows without playing Semuta or choosing a card grant. */
export function nextBasicSemutaAmbassadorStep(game: Game): BasicSemutaAmbassadorStep | null {
  if (game.pendingTreacheryDiscard) {
    const pending = game.pendingTreacheryDiscard, reaction = pending.reaction;
    if (reaction?.stage !== 'offer') return null;
    const actor = game.players.find(player => !reaction.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'semutaPass', event: pending.batch.event } };
  }
  if (!game.response && !game.phaseOpening) {
    if (game.decision?.kind === 'ecazAmbassador' || game.decision?.kind === 'richeseCache') return null;
    if (game.decision?.kind === 'ecazPlacement')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
    if (game.status === 'setup' && game.setupStage === 'forces' &&
      basicSemutaAmbassadorPlayer(game).reserves === 20)
      return { actor: 'ecaz', action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceBasicSemutaAmbassador(game: Game, until: (state: Game) => boolean,
  actions: BasicSemutaAmbassadorStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Basic programme ended before its next control');
    const next = nextBasicSemutaAmbassadorStep(game);
    assert.ok(next, `Supply the original auction or Ambassador choice before advancing: ${JSON.stringify({
      status: game.status, turn: game.turn, phase: game.phase, active: game.active, decision: game.decision,
      entry: game.pendingAmbassador ? { stage: game.pendingAmbassador.stage,
        effect: game.pendingAmbassador.effect, entrant: game.pendingAmbassador.entrant } : null,
      discard: game.pendingTreacheryDiscard?.reaction?.stage,
    })}`);
    game = actBasicSemutaAmbassador(game, next.actor, next.action, actions);
  }
  throw Error('The original Basic Semuta/Ambassador programme did not reach its finite boundary');
}

/** Select the original ten-token Fisher–Yates packet, never replace its state.
 * A BG source deliberately excludes the eventual copied effect from its cohort. */
function originalPacket(effect: BasicSemutaAmbassadorEffect, copied: boolean) {
  const pool = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = [copied ? 'beneGesserit' : effect,
    'atreides', 'emperor', 'fremen', 'harkonnen'];
  const desired = [...supply, ...pool.filter(effect => !supply.includes(effect))];
  const current = [...pool], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); assert.equal(rolls.length, 9);
  return { rolls, supply };
}

/** Fresh public Basic E2/E3 source. Guild really buys Semuta from the original
 * ten-card Richese cache. Ecaz buys one normal card and pays for one placement;
 * Guild then pays for an actual entry at that marker. Stop at the native cards
 * grant BEFORE any discard, payout, replacement draw or Semuta commitment. */
export function createBasicSemutaAmbassadorFixture(options: {
  effect: BasicSemutaAmbassadorEffect; copied?: boolean; arrival?: 'shipment' | 'movement';
  cacheCard?: 'semuta' | 'ornithopter'; ecazTruth?: boolean;
}) {
  const effect = options.effect, copied = options.copied ?? false, packet = originalPacket(effect, copied);
  const arrivalKind = options.arrival ?? 'shipment';
  const cacheCardId = options.cacheCard === 'ornithopter' ? 'richese-ornithopter' : SEMUTA_DRUG_ID;
  let game = createGame('BASICSEMUTAAMBASSADOR', newPlayer('ecaz', 'Ecaz', 'ecaz'), false, ['ecaz', 'choam']);
  for (const faction of ['choam', 'richese', 'guild'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const owner = 'ecaz', beneficiary = owner, holder = 'guild', entrant = holder;
  const actions: BasicSemutaAmbassadorStep[] = [];
  const act = (actor: string, action: Action) => { game = actBasicSemutaAmbassador(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceBasicSemutaAmbassador(game, until, actions); };
  const transition = (step: BasicSemutaAmbassadorStep, until: (state: Game) => boolean): BasicSemutaAmbassadorTransition => {
    const before = structuredClone(game); act(step.actor, step.action); reach(until);
    return { before, step: structuredClone(step), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.equal(game.semutaPreview, true, 'A fresh public bare Basic Richese start owns the Semuta marker');
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.equal(game.deck.length, 35); assert.equal(game.richeseCache?.length, 10);
  assert.ok(game.richeseCache!.some(card => card.id === cacheCardId));
  const originalMainDeck = game.deck.map(card => card.id).sort();
  const originalCache = game.richeseCache!.map(card => card.id).sort();
  const originalTreachery = basicSemutaAmbassadorInventory(game);
  // Four still-undealt starts plus the first still-unopened normal purchase.
  // Ordinary cards avoid optional card-use controls during the source path.
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 5);
  assert.equal(ordinary.length, 5);
  if (options.ecazTruth) ordinary[0] = game.deck.find(card => card.effect === 'truthtrance')!;
  const deal = ordinary.map(card => card.id);
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  let packetCreation: BasicSemutaAmbassadorTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 80; count++) {
    const next = nextBasicSemutaAmbassadorStep(game); assert.ok(next);
    const initializesForces = game.setupStage === 'traitors' && next.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length > 0).length === 1;
    if (initializesForces) {
      const before = structuredClone(game);
      game = withOriginalScalarLottery(() => applyAction(game, next.actor, next.action), packet.rolls);
      actions.push(structuredClone(next));
      packetCreation = { before, step: structuredClone(next), after: structuredClone(game) };
    } else act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing'); assert.ok(packetCreation);
  const afterSetup = structuredClone(game);
  const token = game.ecazAmbassadors!.tokens.find(token => token.effect === (copied ? 'beneGesserit' : effect))!;
  assert.equal(token.zone, 'supply');
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.effect === effect)!.zone, copied ? 'pool' : 'supply');
  assert.deepEqual(game.ecazAmbassadors!.cohort.map(id =>
    game.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), packet.supply);
  assert.deepEqual(basicSemutaAmbassadorPlayer(game).hand.map(card => card.id), [deal[0]]);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);

  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'richeseCache');
  const beforeCacheOffer = structuredClone(game), acquisitionStart = actions.length;
  const cacheOffer: BasicSemutaAmbassadorStep = { actor: 'richese', action: { type: 'decision',
    event: game.richeseBidding!.event, card: cacheCardId, method: 'onceAround', direction: 'counterclockwise' } };
  act(cacheOffer.actor, cacheOffer.action);
  reach(state => basicSemutaAmbassadorClean(state) && !!state.richeseAuction && !state.richeseAuction.outcome);
  const cacheAuction = structuredClone(game);
  const cacheBidSteps: BasicSemutaAmbassadorStep[] = [];
  let semutaBid: BasicSemutaAmbassadorTransition | null = null;
  for (let count = 0; !basicSemutaAmbassadorPlayer(game, holder).hand.some(card => card.id === cacheCardId) && count < 8; count++) {
    const lot = game.richeseAuction; assert.ok(lot && !lot.outcome && lot.active);
    const bid: BasicSemutaAmbassadorStep = { actor: lot.active, action: { type: 'richeseBid', event: lot.event,
      amount: lot.active === holder ? 1 : null, allyPayment: 0 } };
    cacheBidSteps.push(structuredClone(bid));
    const result = transition(bid, state => basicSemutaAmbassadorClean(state));
    if (bid.actor === holder) semutaBid = result;
  }
  assert.ok(semutaBid); assert.ok(basicSemutaAmbassadorPlayer(game, holder).hand.some(card => card.id === cacheCardId));
  assert.equal(game.richeseCache!.length, 9);
  assert.equal(basicSemutaAmbassadorPlayer(game, holder).spice,
    basicSemutaAmbassadorPlayer(beforeCacheOffer, holder).spice - 1);
  const acquisition = { before: beforeCacheOffer, steps: structuredClone(actions.slice(acquisitionStart)), after: structuredClone(game) };

  reach(state => state.phase === 3 && basicSemutaAmbassadorClean(state) && state.auction?.active === owner);
  const normalPurchase = transition({ actor: owner, action: { type: 'bid', amount: 1, allyPayment: 0 } },
    state => basicSemutaAmbassadorPlayer(state, owner).hand.length === 2 && basicSemutaAmbassadorClean(state));
  assert.equal(basicSemutaAmbassadorPlayer(game).spice, basicSemutaAmbassadorPlayer(normalPurchase.before).spice - 1);
  assert.deepEqual(basicSemutaAmbassadorPlayer(game).hand.map(card => card.id), [deal[0], deal[4]]);
  reach(state => state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const territory = 'habbanya_ridge_sietch', sector = 17;
  const placement = transition({ actor: owner, action: { type: 'decision', token: token.id, territory } },
    state => !state.response && state.decision?.kind === 'ecazPlacement');
  assert.equal(basicSemutaAmbassadorPlayer(game).spice, basicSemutaAmbassadorPlayer(placement.before).spice - 1);
  act(owner, { type: 'decision', decline: true });
  reach(state => state.phase === 5 && state.active === entrant && basicSemutaAmbassadorClean(state));
  const beforeArrival = structuredClone(game);
  assert.equal(basicSemutaAmbassadorPlayer(game, entrant).shipped, false);
  assert.equal(basicSemutaAmbassadorPlayer(game, entrant).ally, null);
  assert.ok(game.players.every(player => !Object.keys(player.forces).some(location => location.startsWith(`${territory}:`))));
  const shipmentTerritory = arrivalKind === 'movement' ? 'habbanya_ridge_flat' : territory;
  const shipment = transition({ actor: entrant, action: { type: 'ship', amount: 1, territory: shipmentTerritory, sector, elite: 0, allyPayment: 0 } },
    state => arrivalKind === 'shipment'
      ? !state.response && state.pendingAmbassador?.stage === 'offer'
      : basicSemutaAmbassadorClean(state));
  const arrival = arrivalKind === 'shipment' ? shipment : transition({ actor: entrant, action: {
    type: 'move', from: `${shipmentTerritory}:${sector}`, amount: 1, territory, sector,
  } }, state => !state.response && state.pendingAmbassador?.stage === 'offer');
  assert.equal(basicSemutaAmbassadorPlayer(game, entrant).spice,
    basicSemutaAmbassadorPlayer(beforeArrival, entrant).spice - 1);
  const offer = structuredClone(game), event = game.pendingAmbassador!.event;
  assert.equal(game.pendingAmbassador!.token, token.id);
  const triggerStep: BasicSemutaAmbassadorStep = { actor: owner,
    action: { type: 'decision', event, trigger: true, beneficiary, choice: 'effect' } };
  act(triggerStep.actor, triggerStep.action);
  let beforeCopy: Game | null = null, copyStep: BasicSemutaAmbassadorStep | null = null;
  if (copied) {
    assert.equal(game.pendingAmbassador?.stage, 'copy');
    assert.ok(game.pendingAmbassador!.copyChoices.includes(effect)); beforeCopy = structuredClone(game);
    copyStep = { actor: beneficiary, action: { type: 'decision', event, effect } };
    act(copyStep.actor, copyStep.action);
  }
  assert.equal(game.pendingAmbassador?.stage, 'cards'); assert.equal(game.pendingAmbassador!.effect, effect);
  assert.equal(game.pendingAmbassador!.beneficiary, beneficiary); assert.equal(game.pendingAmbassador!.entrant, entrant);
  assert.equal(game.decision?.player, beneficiary); assert.equal(game.active, entrant);
  assert.equal(game.turn, 1); assert.equal(game.phase, 5); assert.ok(!game.pendingTreacheryDiscard);
  assert.ok(basicSemutaAmbassadorPlayer(game, holder).hand.some(card => card.id === cacheCardId));
  assert.deepEqual(basicSemutaAmbassadorInventory(game), originalTreachery);
  const currentGrant = structuredClone(game), eligibleChosenIds = basicSemutaAmbassadorPlayer(game, beneficiary).hand
    .slice(0, effect === 'choam' ? 2 : 1).map(card => card.id);
  assert.equal(eligibleChosenIds.length, effect === 'choam' ? 2 : 1);
  const preReplacementDeckTop = structuredClone(game.deck[0]); assert.ok(preReplacementDeckTop);
  const discardStep: BasicSemutaAmbassadorStep = { actor: beneficiary, action: { type: 'decision', event, cards: eligibleChosenIds } };
  return { game, lobby, setup, beforeStartingDeal, afterSetup, packetCreation, packet, deal, dealOrder,
    spiceOrder, originalMainDeck, originalCache, originalTreachery, beforeCacheOffer, cacheOffer,
    cacheAuction, cacheBidSteps, semutaBid, acquisition, normalPurchase, placement, beforeArrival, shipment, arrival, arrivalKind, offer,
    triggerStep, beforeCopy, copyStep, currentGrant, ownerView: viewGame(game, owner), holderView: viewGame(game, holder),
    entrantView: viewGame(game, entrant), effect, copied, advanced: false as const,
    owner, beneficiary, holder, entrant, token: token.id, semuta: cacheCardId, event, territory, sector,
    location: `${territory}:${sector}`, cacheCard: cacheCardId, eligibleChosenIds, chosenCards: eligibleChosenIds, discardStep,
    preReplacementDeckTop, balances: basicSemutaAmbassadorBalances(game),
    entrantContinuation: { actor: entrant, action: { type: 'endMovement' } } as BasicSemutaAmbassadorStep,
    actions, sourceActionCount: actions.length,
    staging: [`Only five unopened original main-deck positions (four starts and the first normal purchase), two unopened ordinary land Spice positions and original scalar lotteries are selected. Nine explicitly recorded draws select the original Ambassador packet on the final original traitor choice. Other scalar draws retain Fisher–Yates order; UUID/byte entropy remains native. Public Basic Ecaz/CHOAM/Richese/Guild setup retains the selected Ecaz+CHOAM decks (35 main plus 10 genuine native cache cards) and no optional modules. Guild buys the physical Semuta Drug in the real Once Around cache auction for 1; Ecaz pays 1 for the original first ordinary card and 1 for its actual placement. Guild then pays 1 for the non-allied original reserve entry. Native/BG-copy choices stop at the original cards grant. No dealt hands, resources, armies, clocks, alliances, deaths, token custody, pending reactions or receipts are installed. No discard, CHOAM payout, Ixian replacement or Semuta commitment has happened in this source snapshot. Optional source selection buys ${cacheCardId} instead and deals original Truthtrance to Ecaz=${!!options.ecazTruth}.`] };
}
export type BasicSemutaAmbassadorFixture = ReturnType<typeof createBasicSemutaAmbassadorFixture>;
