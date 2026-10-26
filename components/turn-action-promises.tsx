'use client';

import type { Action, GameView, Plan } from '@/game/engine';
import { bribeAction } from '@/game/bribe-options';
import { alliancePromiseModeSupported } from '@/game/alliance-promises';
import { nativePromiseScopeSupported } from '@/game/native-promise-scope';
import { quoteNexusAlliance } from '@/game/nexus-alliance';
import { ordinaryCardAvailability } from '@/game/card-availability';
import { gholaForcePreparations } from '@/game/ghola-force-preparation';
import { nativeBattlePowerOpportunity, type NativeBattlePower } from '@/game/battle-power-question';
import { battleCardLabel, VOICE_KINDS } from '@/game/battle-cards';
import { WINDOW_CARD_EFFECTS, windowCardNativeEffect, windowCardOpportunity, type WindowCardEffect } from '@/game/window-card-play';
import type { TurnActionLeaf } from '@/game/turn-action-promises';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { truthQuestionText, type TruthAnswer } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { Button } from './ui/button';

type TurnActionProps = { game: GameView; busy: boolean; act: (action: Action) => void; fillPlan?: (plan: Plan) => void };
const publicAllianceContext = (game: GameView) => ({
  players: game.players.map(player => ({ id: player.id, ally: player.ally })), offers: game.allianceOffers,
});
const publicBattleContext = (game: GameView) => game.battle && ({
  event: game.battle.event, territory: game.battle.territory, attacker: game.battle.attacker, defender: game.battle.defender,
  revealed: game.battle.revealed, submitted: game.battle.submitted,
  preparation: game.battle.preparation,
  traitorVoters: game.battle.traitorVoters, traitorSubmitted: game.battle.traitorSubmitted,
});
const isWindowEffect = (effect: unknown): effect is Exclude<WindowCardEffect, 'karamaAuction' | 'karamaShipment'> =>
  effect === 'weather' || effect === 'atomics' || effect === 'harvester' || effect === 'thumper' || effect === 'amal';
const windowRoleNames: Record<WindowCardEffect, string> = { weather: 'Weather Control', atomics: 'Family Atomics', harvester: 'Harvester',
  karamaAuction: 'printed Karama for this ordinary lot', karamaShipment: 'printed Karama for this shipment price', thumper: 'Thumper', amal: 'Amal' };
const namesWindow = (mixed: MixedActionExpression<TurnActionLeaf>, effect: WindowCardEffect, source?: string): boolean =>
  mixed.kind === 'action' ? mixed.action.kind === 'windowCardPlay' && mixed.action.effect === effect && (source === undefined || mixed.action.source === source)
    : mixed.kind !== 'fact' && mixed.terms.some(term => namesWindow(term, effect, source));

/** One projected native packet; no client branch selection or completion solver. */
export function TurnActionGuideButton(props: TurnActionProps) {
  const game = props.game, guide = game.turnActionGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, phase = game.phase, event = guide.event, action = guide.action;
  const act = props.act, fillPlan = props.fillPlan, battle = game.battle;
  const charity = game.charity;
  const charityOwner = action.type === 'charity' ? game.players.find(player => player.id === actor) : undefined;
  const charitySource = (current: GameView) => {
    const owner = current.players.find(player => player.id === actor);
    return JSON.stringify({ quote: current.charity, claimed: owner?.charityClaimed, spice: owner?.spice });
  };
  const charitySignature = action.type === 'charity' ? charitySource(game) : null;
  const battleSignature = JSON.stringify(publicBattleContext(game));
  const power: NativeBattlePower | null = action.type === 'voice' ? 'voice' : action.type === 'prescience' ? 'prescience'
    : action.type === 'declineBattlePower' && (battle?.preparation?.kind === 'voice' || battle?.preparation?.kind === 'prescience')
      ? battle.preparation.kind : null;
  const powerSource = power ? nativeBattlePowerOpportunity(game, actor, power) : null;
  const powerSignature = JSON.stringify(powerSource), powerPreparation = battle?.preparation;
  const signature = JSON.stringify(action), auction = game.auction, decision = game.decision;
  const native = game.richeseAuction, order = game.revivalOrder, revival = game.revival;
  const auctionSource = (current: GameView) => current.auction && JSON.stringify({
    bid: current.auction.bid, bidder: current.auction.bidder, active: current.auction.active,
    remaining: current.auction.remaining, allyPayment: current.auction.allyPayment, lot: current.bidPromiseLot,
  });
  const nativeSource = (current: GameView) => current.richeseAuction && JSON.stringify({
    event: current.richeseAuction.event, method: current.richeseAuction.method,
    eligible: current.richeseAuction.eligible, submitted: current.richeseAuction.submitted,
    active: current.richeseAuction.active, outcome: current.richeseAuction.outcome,
    bid: current.richeseAuction.bid, bidder: current.richeseAuction.bidder,
    passed: current.richeseAuction.passed, acted: current.richeseAuction.acted,
  });
  const auctionSignature = auctionSource(game), nativeSignature = nativeSource(game), orderSignature = JSON.stringify(order);
  const nexus = game.alliancePromiseNexus, nexusOpen = game.nexus, nexusSpiceWindow = game.spiceWindow;
  const nexusSignature = JSON.stringify({ ...publicAllianceContext(game), ready: game.ready });
  const box = game.nullentropy, search = box?.search;
  const windowPromise = game.turnActionPromises.find(promise => promise.event === event && promise.player === actor && promise.turn === turn);
  const windowQuestion = windowPromise && JSON.stringify(windowPromise.mixed);
  const opening = game.phaseOpening, openingSignature = JSON.stringify(opening);
  const currentAmalWindow = windowCardOpportunity(game, 'amal');
  const amalRoleNamed = !!windowPromise && !!currentAmalWindow && namesWindow(windowPromise.mixed, 'amal', currentAmalWindow.source);
  const amalReadyAction = action.type === 'ready' && !!opening && amalRoleNamed;
  const currentAuctionWindow = windowCardOpportunity(game, 'karamaAuction');
  const auctionRoleNamed = !!windowPromise && !!currentAuctionWindow && namesWindow(windowPromise.mixed, 'karamaAuction', currentAuctionWindow.source);
  const auctionPurchaseAction = action.type === 'card' && action.mode === 'purchase';
  const currentShipmentWindow = windowCardOpportunity(game, 'karamaShipment');
  const shipmentRoleNamed = !!windowPromise && !!currentShipmentWindow && namesWindow(windowPromise.mixed, 'karamaShipment', currentShipmentWindow.source);
  const shipmentPriceAction = action.type === 'card' && action.mode === 'shipment';
  const printedShipmentAction = shipmentPriceAction && shipmentRoleNamed;
  const printedInvoiceAction = action.type === 'decision' && action.karama === true && auctionRoleNamed;
  const cardOwner = action.type === 'card' || printedInvoiceAction ? game.players.find(player => player.id === actor) : undefined;
  const heldCard = cardOwner?.hand?.find(card => card.id === action.card);
  const cardSignature = heldCard && JSON.stringify({ id: heldCard.id, kind: heldCard.kind, effect: heldCard.effect });
  const windowEffect = (auctionPurchaseAction || printedInvoiceAction) && heldCard?.effect === windowCardNativeEffect('karamaAuction')
    ? 'karamaAuction' : printedShipmentAction && heldCard?.effect === windowCardNativeEffect('karamaShipment')
      ? 'karamaShipment' : isWindowEffect(heldCard?.effect) ? heldCard.effect : null;
  const cardWindow = windowEffect ? windowCardOpportunity(game, windowEffect) : null;
  const earlyWindowReadyAction = action.type === 'ready' && (phase === 0 || phase === 1);
  const publicWindowState = (current: GameView) => JSON.stringify({
    opportunity: windowEffect ? windowCardOpportunity(current, windowEffect)
      : WINDOW_CARD_EFFECTS.map(effect => windowCardOpportunity(current, effect)),
    stormOpen: current.stormCardWindowOpen,
    thumperOpen: current.thumperWindowOpen, thumperReady: current.thumperReady, nexus: current.nexus,
    amalOpen: current.amalWindowOpen, amalReady: current.amalReady, opening: current.phaseOpening,
    stormPending: current.stormPending, wallDestroyed: current.shieldWallDestroyed,
    blow: current.spiceWindow,
    ...(current.phase === 3 ? { auction: auctionSource(current) } : {}),
    ...(current.phase === 5 ? { shipment: { active: current.active, remaining: current.movementRemaining,
      windows: current.karamaShipmentWindows, grant: current.karamaShipping } } : {}),
    ...(windowEffect === 'atomics' ? { forces: current.players.find(player => player.id === actor)?.forces,
      advisors: current.players.find(player => player.id === actor)?.advisors } : {}),
  });
  const windowSignature = windowEffect || heldCard?.effect === 'nullentropyBox' || earlyWindowReadyAction || amalReadyAction ? publicWindowState(game) : null;
  const originalBlow = windowEffect === 'harvester' || earlyWindowReadyAction && phase === 1 ? game.spiceWindow : null;
  const earlyBoxSignature = box && JSON.stringify({ card: box.card.id, blocked: box.blocked, search: box.search?.event });
  const auctionCards = game.karamaAuctionCards, auctionCardsSignature = JSON.stringify(auctionCards);
  const shipmentCards = game.karamaShipmentCards, shipmentCardsSignature = JSON.stringify(shipmentCards);
  const thumperCards = game.thumperCards, thumperCardsSignature = JSON.stringify(thumperCards);
  const amalCards = game.amalCards, amalCardsSignature = JSON.stringify(amalCards);
  const auctionHandSource = (current: GameView) => {
    const player = current.players.find(player => player.id === actor);
    return JSON.stringify({ hand: player?.hand?.map(card => ({ id: card.id, kind: card.kind, effect: card.effect })), limit: player?.handLimit });
  };
  const auctionHandSignature = windowEffect === 'karamaAuction' ? auctionHandSource(game) : null;
  const ghola = heldCard?.effect === 'ghola' ? game.ghola : null, gholaSignature = JSON.stringify(ghola);
  const hajrSource = (current: GameView) => {
    const player = current.players.find(player => player.id === actor);
    return JSON.stringify({ moved: player?.moved, movesAllowed: player?.movesAllowed,
      hajrPlays: player?.hajrPlays, available: player?.hajrAvailable });
  };
  const hajrSignature = heldCard?.effect === 'hajr' ? hajrSource(game) : null;
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === actor);
    const ownPhysicalCard = (action.type === 'card' || printedInvoiceAction) && !!heldCard && !!me && me === cardOwner &&
      me.hand?.find(card => card.id === action.card) === heldCard &&
      JSON.stringify({ id: heldCard.id, kind: heldCard.kind, effect: heldCard.effect }) === cardSignature;
    const ownCard = action.type === 'card' && ownPhysicalCard;
    const currentAuction = current.auction === auction && auctionSource(current) === auctionSignature && !!auction;
    const ownInvoiceSource = phase === 3 && current.decision === decision && current.decision?.kind === 'auctionPayment' &&
      current.decision.player === actor && !current.richeseAuction && currentAuction && current.auction?.bidder === actor;
    const printedHajr = ownCard && !!heldCard && !!me && heldCard.kind === 'special' && heldCard.effect === 'hajr' && action.mode === undefined &&
      phase === 5 && current.active === actor && me.hajrAvailable === true && hajrSource(current) === hajrSignature &&
      ordinaryCardAvailability(current, heldCard.id)?.available === true;
    const gholaSource = ownCard && !!heldCard && heldCard.kind === 'special' && heldCard.effect === 'ghola' && action.mode === undefined &&
      !!ghola && current.ghola === ghola && JSON.stringify(current.ghola) === gholaSignature &&
      ghola.available && ghola.cards.includes(heldCard.id);
    const forceChoices = gholaSource && !!heldCard && !!me && !!ghola && action.leader === undefined && typeof action.amount === 'number' &&
      Number.isSafeInteger(action.amount) && action.amount >= 1 && action.amount <= 5 &&
      Number.isSafeInteger(ghola.maxForces) && ghola.maxForces >= 0 && ghola.maxForces <= 5
      ? [...gholaForcePreparations({ cards: [heldCard.id], tanks: me.tanks, eliteTanks: me.elites?.tanks ?? 0,
        maxForces: ghola.maxForces, eliteRemaining: ghola.eliteRemaining })].filter(choice => choice.amount === action.amount)
      : [];
    const printedGhola = gholaSource && !!ghola && (action.leader !== undefined
      ? typeof action.leader === 'string' && (action.leader === 'kwisatz' ? ghola.kwisatz : ghola.leaders.some(leader => leader.id === action.leader))
      : action.elite === undefined ? forceChoices.length === 1 : forceChoices.some(choice => choice.elite === action.elite));
    const windowPacket = Object.keys(action).every(key => ['type', 'card', 'turnActionPromiseEvent', 'turnActionPromisePhase',
      ...(windowEffect === 'weather' ? ['amount'] : windowEffect === 'karamaAuction' ? ['mode'] : windowEffect === 'karamaShipment' ? ['mode', 'target'] : [])].includes(key)) &&
      (windowEffect !== 'weather' || typeof action.amount === 'number' && Number.isSafeInteger(action.amount) && action.amount >= 0 && action.amount <= 10);
    const printedWindowSource = ownPhysicalCard && !!heldCard && heldCard.kind === 'special' && !!windowEffect && !!cardWindow &&
      heldCard.effect === windowCardNativeEffect(windowEffect) && !!windowPromise &&
      current.turnActionPromises.includes(windowPromise) && JSON.stringify(windowPromise.mixed) === windowQuestion &&
      namesWindow(windowPromise.mixed, windowEffect, cardWindow.source) &&
      (windowEffect !== 'harvester' || current.spiceWindow === originalBlow) && publicWindowState(current) === windowSignature;
    const nativeAuctionCard = windowEffect === 'karamaAuction' && !!heldCard && currentAuction &&
      Array.isArray(current.karamaAuctionCards) &&
      current.karamaAuctionCards === auctionCards && JSON.stringify(current.karamaAuctionCards) === auctionCardsSignature &&
      current.karamaAuctionCards.includes(heldCard.id) && auctionHandSource(current) === auctionHandSignature;
    const nativeShipmentCard = windowEffect === 'karamaShipment' && !!heldCard && cardWindow?.effect === 'karamaShipment' &&
      phase === 5 && current.active === cardWindow.recipient && action.target === cardWindow.recipient &&
      Array.isArray(current.karamaShipmentCards) && current.karamaShipmentCards === shipmentCards &&
      JSON.stringify(current.karamaShipmentCards) === shipmentCardsSignature && current.karamaShipmentCards.includes(heldCard.id);
    const nativeThumperCard = windowEffect === 'thumper' && !!heldCard && phase === 1 && !current.spiceWindow && !current.nexus &&
      Array.isArray(current.thumperCards) && current.thumperCards === thumperCards &&
      JSON.stringify(current.thumperCards) === thumperCardsSignature && current.thumperCards.includes(heldCard.id);
    const currentOpening = !!opening && current.phaseOpening === opening && JSON.stringify(current.phaseOpening) === openingSignature &&
      !opening.passed.includes(actor);
    const nativeAmalCard = windowEffect === 'amal' && !!heldCard && currentOpening &&
      Array.isArray(current.amalCards) && current.amalCards === amalCards && JSON.stringify(current.amalCards) === amalCardsSignature &&
      current.amalCards.includes(heldCard.id);
    const printedWindow = action.type === 'card' && printedWindowSource && !!heldCard && windowPacket &&
      (windowEffect === 'karamaAuction' ? action.mode === 'purchase' && nativeAuctionCard && !!me && !current.decision &&
        Number.isSafeInteger(me.handLimit) && Array.isArray(me.hand) && me.hand.length < me.handLimit
        : windowEffect === 'karamaShipment' ? action.mode === 'shipment' && nativeShipmentCard
          : windowEffect === 'thumper' ? action.mode === undefined && nativeThumperCard
            : windowEffect === 'amal' ? action.mode === undefined && nativeAmalCard
              : action.mode === undefined && ordinaryCardAvailability(current, heldCard.id, windowEffect === 'weather' ? { amount: action.amount } : undefined)?.available === true);
    const openingReady = amalReadyAction && currentOpening && current.amalReady === true &&
      Object.keys(action).every(key => ['type', 'turnActionPromiseEvent', 'turnActionPromisePhase'].includes(key)) &&
      !!windowPromise && current.turnActionPromises.includes(windowPromise) && JSON.stringify(windowPromise.mixed) === windowQuestion &&
      publicWindowState(current) === windowSignature;
    const allowedOpeningAction = openingReady || windowEffect === 'amal' && printedWindow;
    const printedAuctionInvoice = printedInvoiceAction && printedWindowSource && nativeAuctionCard &&
      Object.keys(action).every(key => ['type', 'card', 'karama', 'turnActionPromiseEvent', 'turnActionPromisePhase'].includes(key));
    const quotedBoxCard = heldCard?.effect !== 'nullentropyBox' || !!box && current.nullentropy === box &&
      JSON.stringify({ card: box.card.id, blocked: box.blocked, search: box.search?.event }) === earlyBoxSignature &&
      !box.blocked && !box.search && box.card.id === heldCard.id;
    const genericCard = ownCard && action.type === 'card' && !auctionPurchaseAction && !printedShipmentAction && quotedBoxCard &&
      (!shipmentPriceAction || (action.target ?? actor) === current.active) &&
      !!heldCard && heldCard.effect !== 'ghola' && heldCard.effect !== 'hajr' && !isWindowEffect(heldCard.effect);
    const earlyWindowBox = (phase === 0 || phase === 1 || phase === 3 || phase === 5) && genericCard && heldCard?.effect === 'nullentropyBox' &&
      action.mode === undefined && Object.keys(action).every(key => ['type', 'card', 'turnActionPromiseEvent', 'turnActionPromisePhase'].includes(key)) &&
      !!box && current.nullentropy === box &&
      JSON.stringify({ card: box.card.id, blocked: box.blocked, search: box.search?.event }) === earlyBoxSignature &&
      !box.blocked && !box.search && box.card.id === heldCard.id &&
      !!windowPromise && current.turnActionPromises.includes(windowPromise) && JSON.stringify(windowPromise.mixed) === windowQuestion &&
      WINDOW_CARD_EFFECTS.some(effect => {
        const opportunity = windowCardOpportunity(current, effect);
        return !!opportunity && namesWindow(windowPromise.mixed, effect, opportunity.source);
      }) && publicWindowState(current) === windowSignature;
    const earlyWindowReady = earlyWindowReadyAction && !current.ready.includes(actor) &&
      Object.keys(action).every(key => ['type', 'turnActionPromiseEvent', 'turnActionPromisePhase'].includes(key)) &&
      !!windowPromise && current.turnActionPromises.includes(windowPromise) && JSON.stringify(windowPromise.mixed) === windowQuestion &&
      publicWindowState(current) === windowSignature &&
      (phase === 0 ? current.stormPending !== null && (['weather', 'atomics'] as const).some(effect => {
        const opportunity = windowCardOpportunity(current, effect);
        return !!opportunity && namesWindow(windowPromise.mixed, effect, opportunity.source);
      }) : (() => {
        const thumper = current.thumperReady && windowCardOpportunity(current, 'thumper');
        if (thumper && namesWindow(windowPromise.mixed, 'thumper', thumper.source)) return true;
        const opportunity = current.spiceWindow === originalBlow && windowCardOpportunity(current, 'harvester');
        return !!opportunity && namesWindow(windowPromise.mixed, 'harvester', opportunity.source);
      })());
    const options = current.bribeOptions;
    const target = action.type === 'bribe' && typeof action.target === 'string'
      ? current.players.find(player => player.id === action.target) : undefined;
    const limit = options.targets.find(recipient => recipient.id === action.target);
    // Ordinary bribes can remain legal during another player's native turn or
    // after this payer has readied. The projected native timing stays decisive.
    const payment = action.type === 'bribe' && !!me && !!target && target.id !== actor && target.id !== me.ally &&
      options.blocked === null && Number.isSafeInteger(options.available) &&
      typeof action.amount === 'number' && action.amount <= options.available &&
      !!limit && Number.isSafeInteger(limit.maximum) && action.amount <= limit.maximum &&
      !!bribeAction(options, target.id, action.amount);
    const paidBox = action.type === 'decision' && current.decision === decision &&
      current.decision?.kind === 'nullentropy' && current.nullentropy === box && current.nullentropy?.search === search &&
      current.decision.player === actor && !!current.nullentropy?.search &&
      current.nullentropy.search.event === action.event && !current.nullentropy.blocked;
    const invoice = phase === 3 && action.type === 'decision' && typeof action.karama === 'boolean' &&
      (!action.karama || typeof action.card === 'string') &&
      ownInvoiceSource && (!printedInvoiceAction || printedAuctionInvoice);
    const nativePass = phase === 3 && action.type === 'richeseBid' && current.richeseAuction === native &&
      nativeSource(current) === nativeSignature && native && native.event === action.event && !native.outcome &&
      native.eligible.includes(actor) && (native.method === 'silent'
        ? !native.submitted.includes(actor) && action.amount === 0
        : native.active === actor && action.amount === null) && action.allyPayment === 0;
    const requiredBid = phase === 3 && action.type === 'bid' && !current.richeseAuction && currentAuction &&
      current.auction?.active === actor && typeof action.amount === 'number' && Number.isSafeInteger(action.amount) && action.amount > 0;
    const revivalTurn = current.revival === revival && !current.revival.pending && !current.revival.orderBlocked &&
      current.revivalOrder === order && JSON.stringify(current.revivalOrder) === orderSignature &&
      (!order || order.turn === turn && order.remaining[0] === actor && current.active === actor);
    const nexusWindow = phase === 1 && nexusOpen && current.nexus === nexusOpen && !nexusSpiceWindow &&
      current.spiceWindow === nexusSpiceWindow && !!nexus &&
      current.alliancePromiseNexus === nexus && nexus.turn === turn && !current.ready.includes(actor) &&
      alliancePromiseModeSupported(current) && JSON.stringify({ ...publicAllianceContext(current), ready: current.ready }) === nexusSignature;
    let ownedAlliance = action.type === 'alliance' && action.target === null;
    if (action.type === 'alliance' && typeof action.target === 'string') {
      try { ownedAlliance = !!quoteNexusAlliance({ ...publicAllianceContext(current), actor, target: action.target }).formed; }
      catch { ownedAlliance = false; }
    }
    const currentBattle = phase === 6 && !!battle && current.battle === battle &&
      JSON.stringify(publicBattleContext(current)) === battleSignature;
    const powerPacket = Object.keys(action).every(key => ['type', 'turnActionPromiseEvent', 'turnActionPromisePhase',
      ...(action.type === 'voice' ? ['kind', 'must'] : action.type === 'prescience' ? ['field'] : [])].includes(key)) &&
      (action.type === 'voice' ? typeof action.kind === 'string' && VOICE_KINDS.includes(action.kind) && typeof action.must === 'boolean'
        : action.type === 'prescience' ? ['leader', 'weapon', 'defense', 'dial'].includes(String(action.field))
          : action.type === 'declineBattlePower');
    const ownedPower = currentBattle && !!power && !!powerSource && powerSource.ready && powerSource.owner === actor &&
      powerSource.event === battle?.event && powerSource.territory === battle?.territory &&
      current.battle?.preparation === powerPreparation && powerPreparation?.kind === power && powerPacket &&
      (action.type === 'declineBattlePower' || !powerPreparation.blocked) &&
      JSON.stringify(nativeBattlePowerOpportunity(current, actor, power)) === powerSignature;
    const planWindow = !!battle && currentBattle && !battle.revealed && [battle.attacker, battle.defender].includes(actor) && !battle.submitted.includes(actor);
    const plan = action.type === 'battlePlan' && planWindow && !!fillPlan && props.fillPlan === fillPlan;
    const battlePreparation = genericCard && planWindow;
    const declaration = action.type === 'traitorCall' && typeof action.call === 'boolean' && !!battle && currentBattle && battle.revealed &&
      battle.traitorVoters.includes(actor) && !battle.traitorSubmitted.includes(actor);
    const charityClaim = action.type === 'charity' && phase === 2 && !!me && me === charityOwner &&
      Object.keys(action).every(key => ['type', 'turnActionPromiseEvent', 'turnActionPromisePhase'].includes(key)) &&
      !current.ready.includes(actor) && me.charityClaimed === false && current.charity === charity &&
      charitySource(current) === charitySignature && current.charity.incomePending === false &&
      Number.isSafeInteger(current.charity.amount) && current.charity.amount > 0;
    const opportunity = openingReady || earlyWindowReady || earlyWindowBox || printedWindow || ownedPower || payment || paidBox || printedHajr || printedGhola || plan || battlePreparation || declaration || nexusWindow && (ownedAlliance || action.type === 'ready') || (phase === 2
      ? charityClaim || !current.ready.includes(actor) && (action.type === 'ready' || genericCard)
      : phase === 3
        ? invoice || nativePass || requiredBid || action.type === 'passBid' && !current.richeseAuction && currentAuction && current.auction?.active === actor
        : phase === 4
          ? !current.ready.includes(actor) && revivalTurn && (['revive', 'reviveLeader', 'reviveKwisatz', 'acceptLeaderRevival', 'ready'].includes(action.type) || genericCard)
          : phase === 5
            ? current.active === actor && (action.type === 'guildShip' && action.from === 'reserves' ||
              ['ship', 'move', 'endMovement', 'prepareAdvisors', 'revealNoField'].includes(action.type) || genericCard)
            : (phase === 7 || phase === 8) &&
              action.type === 'ready' && !current.ready.includes(actor));
    return !props.busy && props.act === act && current === game && nativePromiseScopeSupported(current) && current.status === 'playing' &&
      Number.isSafeInteger(phase) && phase >= 0 && phase <= 8 && current.phase === phase && current.turn === turn && current.me === actor &&
      current.turnActionGuide === guide && guide.event === event && guide.action === action &&
      action.turnActionPromiseEvent === event && action.turnActionPromisePhase === phase && JSON.stringify(action) === signature && opportunity &&
      current.turnActionPromises.some(promise => promise.event === event && promise.player === actor && promise.turn === turn &&
        !promise.fulfilled && !promise.released) &&
      (!amalReadyAction || openingReady) &&
      !!me && !me.autopilot && !current.truthtrance && !current.response && (!current.decision || paidBox || invoice || earlyWindowBox && ownInvoiceSource) &&
      (!current.phaseOpening || allowedOpeningAction) && !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  const amount = action.forces && typeof action.forces === 'object'
    ? Object.values(action.forces as Record<string, number>).reduce((sum, count) => sum + count, 0)
    : typeof action.amount === 'number' ? action.amount : 0;
  const destination = game.combatLocations.find(location => location.id === action.territory)?.name ?? 'the quoted destination';
  const recipient = game.players.find(player => player.id === action.target)?.name ?? 'the quoted recipient';
  const gholaLeader = action.leader === 'kwisatz' ? 'Kwisatz Haderach'
    : ghola?.leaders.find(leader => leader.id === action.leader)?.name ?? 'the quoted leader';
  const sector = typeof action.sector === 'number' ? `, sector ${action.sector}` : '';
  const label = action.type === 'bribe' ? `Pay ${amount} spice to ${recipient} while honoring your whole answer`
    : action.type === 'card' && heldCard?.effect === 'hajr' ? 'Play Hajr in its printed role while honoring your whole answer'
    : action.type === 'card' && heldCard?.effect === 'ghola' ? action.leader !== undefined
      ? `Play Tleilaxu Ghola to return ${gholaLeader} while honoring your whole answer`
      : `Play Tleilaxu Ghola to return ${amount} physical forces while honoring your whole answer`
    : action.type === 'card' && windowEffect === 'karamaAuction' ? 'Spend a printed Karama to purchase this ordinary lot while honoring your whole answer'
    : action.type === 'card' && windowEffect === 'karamaShipment' ? `Spend a printed Karama to grant ${recipient} this native shipment price while honoring your whole answer`
    : action.type === 'card' && windowEffect ? `Play ${windowRoleNames[windowEffect]} in its original native window${windowEffect === 'weather' ? ` with storm distance ${amount}` : ''} while honoring your whole answer`
    : action.type === 'battlePlan' ? 'Fill the quoted battle plan for review before sealing'
    : action.type === 'voice' ? `Declare native Voice: opponent ${action.must ? 'must' : 'cannot'} play ${battleCardLabel(String(action.kind))}`
    : action.type === 'prescience' ? `Request the ${String(action.field)} field with native Prescience while honoring your whole answer`
    : action.type === 'declineBattlePower' ? `Explicitly decline native ${power === 'voice' ? 'Voice' : 'Prescience'} while honoring your whole answer`
    : action.type === 'traitorCall' ? action.call ? 'Reveal traitor while honoring your whole answer' : 'Decline traitor while honoring your whole answer'
    : action.type === 'alliance' ? action.target === null
      ? game.players.find(player => player.id === actor)?.ally ? 'Break your current alliance while preserving your whole answer'
        : 'Withdraw your alliance offer while preserving your whole answer'
      : `Accept ${recipient}’s alliance invitation while preserving your whole answer`
    : action.type === 'charity' ? `Claim ${game.charity.amount} Charity spice while preserving your whole answer`
    : action.type === 'ready' ? amalReadyAction ? 'Pass this original phase opening while preserving your whole answer'
      : phase === 8 ? 'Ready to end this turn while honoring your whole answer'
      : earlyWindowReadyAction && (phase === 0 || !!game.spiceWindow) ? `Accept this ${phase === 0 ? 'Storm' : 'fresh spice-blow'} window while preserving your whole answer`
        : earlyWindowReadyAction && game.thumperReady && !!windowPromise && namesWindow(windowPromise.mixed, 'thumper', `first-spice-reveal:${turn}`)
          ? 'Ready for the original first spice reveal while preserving your whole answer'
        : phase === 1 ? 'Confirm Ready for this Nexus while preserving your whole answer'
        : 'Finish this preparation phase while preserving your whole answer'
    : action.type === 'passBid' ? 'Pass this bid while preserving your whole answer'
    : action.type === 'bid' ? `Place the required bid of ${amount} while preserving your whole answer`
    : action.type === 'richeseBid' ? action.amount === 0 ? 'Submit zero in this Silent auction while preserving your whole answer'
      : 'Pass this Richese bid while preserving your whole answer'
    : action.type === 'revive' ? `Revive ${amount} forces while preserving your whole answer`
    : action.type === 'reviveLeader' ? 'Revive the quoted leader while preserving your whole answer'
    : action.type === 'acceptLeaderRevival' ? 'Accept the quoted leader revival while preserving your whole answer'
    : action.type === 'reviveKwisatz' ? 'Revive your Kwisatz Haderach while preserving your whole answer'
    : action.type === 'ship' || action.type === 'guildShip' ? `Ship ${amount} physical forces from reserves to ${destination}${sector}${action.type === 'guildShip' ? ' using Guild transport' : ''} while honoring your whole answer`
    : action.type === 'move' ? `Move ${amount} physical forces to ${destination}${sector} while honoring your whole answer`
    : action.type === 'endMovement' ? 'Finish movement while preserving any later payment conditions'
    : action.type === 'decision' ? game.decision?.kind === 'auctionPayment'
      ? action.karama === true ? printedInvoiceAction ? 'Spend the quoted printed Karama on this ordinary-lot winning invoice while preserving your whole answer'
        : 'Use the quoted Karama for the current auction payment while preserving your whole answer'
        : 'Pay the current auction price while preserving your whole answer'
      : 'Complete your paid Box search while preserving your whole answer'
    : action.type === 'prepareAdvisors' ? `Prepare advisors in ${destination} while preserving your whole answer`
    : action.type === 'revealNoField' ? 'Reveal your No-Field while preserving your whole answer'
    : 'Use the offered native card preparation while preserving your whole answer';
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="turn-action-promise-guide"
    disabled={!canAct()} onClick={() => {
      if (!canAct()) return;
      if (action.type === 'battlePlan') fillPlan?.(action as Action & Plan);
      else act(action);
    }}>{label}</Button>;
}

/** Own original whole questions and aggregate status only. */
export function TurnActionPromises(props: TurnActionProps) {
  const game = props.game, own = game.turnActionPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const live = own.some(promise => promise.turn === game.turn && !promise.fulfilled && !promise.released);
  return <section className="notice space-y-3" aria-label="Your Truthtrance turn-action promises" id="turn-action-promise-guidance">
    <h3>Your battle and turn-action promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'turnActions', target: promise.player,
        turn: promise.turn, mixed: promise.mixed }, id => id === 'kwisatz' ? 'Kwisatz Haderach' : id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine'
        : game.allLeaders.find(leader => leader.id === id)?.name ?? id,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id,
      id => game.players.find(player => player.id === id)?.name ?? id)}.
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding until its remaining conditions close this turn.'}
    </li>)}</ul>
    <p>AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Separate No answers each create their own restriction. Legal alternatives remain available; no fixed branch is selected for you.
      Current facts freeze at the answer and create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced future branch remain private.</p>
    <p className="fine">Count the sum of future real ordinary payments to each named recipient after the answer.
      Earlier payments, gifts and ally aid do not count. The sender pays immediately; the recipient collects at the next Mentat opening.
      Payments made during Mentat Pause wait until next turn&apos;s Mentat opening; collection never counts twice.
      A legal timeline may use payments now, one remaining Charity claim and later installments.
      The future claim is not current spendable spice; only actual payments add to the recorded total.
      Bid conditions count the highest accepted future declaration in the named current ordinary lot, never the sum of smaller bids.
      A qualifying bid counts even when another player wins; winning still requires the original payment.
      Force Revival conditions count cumulative future ordinary returns; normal and elite physical counters each count once.
      Named leader conditions require an actual future ordinary native return. Earlier returns, requests alone, Ghola,
      foreign leaders and special card returns do not count.
      Alliance conditions concern final actual membership at this Nexus close. Offers alone are not alliances.
      A remaining alliance condition settles only at the actual close; forming an alliance does not fulfill it early.
      No can allow temporary membership followed by a break before the close. Neither answer promises another player’s consent.
      Battle conditions describe your actual plan in the named current battle. An open plan condition settles when both plans are revealed;
      sealing your own plan does not finish it. A plan already fixed can decide its condition at the answer.
      Traitor conditions describe your original Reveal or decline declaration, before any later Karama or betrayal prevention.
      Native Voice and Prescience conditions describe your original use or explicit decline, exact Voice command,
      or requested Prescience field, before later Karama prevention. The requested field is not the inspected answer or value.
      Borrowed Nexus and special powers do not count. These conditions close at the actual native choice or when its original source expires.
      Printed-card conditions count actual future Hajr or Tleilaxu Ghola plays in their printed role after the answer this turn.
      Earlier plays, discards, sales, Karama roles and recovery alone do not count; an actual later Box replay does.
      Hajr counts even if its extra movement is unused and closes at your own Movement turn end.
      Tleilaxu Ghola is separate from ordinary Revival and remains open until the actual turn ends.
      Weather Control, Family Atomics and Harvester conditions count an actual accepted future printed-role play after the answer
      in the original open Storm or fresh spice-blow window. Earlier plays, disposal, other roles and recovery alone do not count.
      They do not promise a selected storm distance or resulting spice amount. Each condition closes only when its original native window closes.
      A current-lot Karama condition requires spending a printed Karama for this original ordinary lot, through immediate purchase
      or its winning invoice. Other Karama roles, Worthless conversion and a successful bid alone do not count.
      Recovery alone does not count. This condition closes with the original ordinary lot.
      A shipment-price Karama condition requires spending a printed Karama to grant the named active recipient this original
      unused native shipment price. The giver may be another player. The price grant counts separately from an actual force shipment;
      it does not require the recipient to ship forces. Other roles, Worthless conversion and recovery alone do not count.
      This condition closes when that original shipment-price opportunity ends.
      Thumper conditions count an actual accepted future printed play before this turn&apos;s original first spice reveal.
      Earlier plays, disposal, other roles and recovery alone do not count. A later reveal is a different opportunity.
      This condition closes when the actual first spice draw begins.
      Amal conditions count an actual accepted future printed play in this original phase opening.
      Earlier plays, disposal, other roles and recovery alone do not count. The condition closes with this opening.
      Amal halves available cash before ordinary payments become legal; preserve enough remaining cash for any payment condition.
      Shipment conditions concern one future original reserve shipment. Ground-movement conditions count the maximum physical forces in one actual future move,
      never the sum of smaller moves. Earlier shipment and movement do not count.
      Bid conditions close with their named ordinary lot; Revival conditions close with your native Revival opportunity.
      Shipment and movement close at your own Movement turn end; ordinary payments remain possible until the actual turn ends.
      A known Inflation Double opening can close payments earlier without closing Ghola.
      Original costs, timing, cards, preparation and action rights still apply. This claim grants no extra action.</p>
    {own.some(promise => promise.turn === 1 && namesWindow(promise.mixed, 'thumper')) && <p className="notice">
      On turn 1, playing Thumper still discards the card, but its worm encounter is ignored and the normal Spice Card draw continues.</p>}
    {live && <p>{game.phase === 8 ? 'Honor remaining Ghola or payment conditions before this turn ends. Late payment recipients collect next turn.'
      : game.phase < 5 ? 'Your Movement turn is still ahead. Preserve the needed forces, spice and cards and complete any offered native preparation.'
        : 'Use the current native controls to honor your whole answer. Payment conditions can remain after your Movement turn ends.'}</p>}
    {live && <TurnActionGuideButton {...props} />}
  </section>;
}

/** Render only the current respondent's private native whole-answer choices. */
export function TurnActionAnswers(props: TurnActionProps) {
  const game = props.game, window = game.truthtrance, question = window?.question;
  if (window?.stage !== 'answer' || question?.kind !== 'turnActions' || question.target !== game.me || !game.truthTurnActionAnswers) return null;
  const actor = game.me, turn = game.turn, phase = game.phase, source = window.queue[0], answers = game.truthTurnActionAnswers;
  const signature = JSON.stringify(question), sourceSignature = JSON.stringify(source);
  const opening = game.phaseOpening, openingSignature = JSON.stringify(opening);
  const canAnswer = (answer: TruthAnswer) => {
    const current = props.game, me = current.players.find(player => player.id === actor);
    return !props.busy && current === game && current.status === 'playing' &&
      Number.isSafeInteger(phase) && phase >= 0 && phase <= 8 && current.phase === phase && current.turn === turn &&
      current.me === actor && question.turn === turn && current.truthtrance === window && window.stage === 'answer' &&
      window.question === question && question.target === actor && JSON.stringify(question) === signature &&
      !!source && window.queue[0] === source && JSON.stringify(source) === sourceSignature &&
      current.truthTurnActionAnswers === answers && answers.includes(answer) &&
      !!me && !me.autopilot && !current.response && !current.decision &&
      current.phaseOpening === opening && JSON.stringify(current.phaseOpening) === openingSignature &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <section aria-label="Answer the whole battle and turn-action question" className="space-y-3">
    <p className="notice">Answer the whole expression. Current facts freeze now; OR keeps legal alternatives and No keeps the whole expression false.
      Future real ordinary payments add together per recipient. Only one future original reserve shipment and actual future ground-movement groups count.
      Ordinary bids use the maximum future accepted declaration in the named current lot; ordinary force returns add together,
      while named leaders must actually return through ordinary native Revival.
      Alliance conditions use actual final membership when the current Nexus closes; offers alone do not count.
      A remaining alliance condition stays open through temporary membership until that close. Neither answer promises another player’s consent.
      Current battle-plan conditions use the actual native plan; an open condition settles when both plans are revealed.
      Traitor conditions use the original Reveal or decline declaration, before later Karama or betrayal prevention.
      Hajr and Tleilaxu Ghola conditions require actual later printed-role plays, not earlier play, disposal or recovery alone.
      Hajr closes at your own Movement turn end even if its extra move is unused; Ghola closes at the actual turn end.
      Bids close with their lot; Revival closes with your native Revival opportunity.
      Shipment and movement close at your own Movement turn end; payment conditions last until the actual turn ends.
      A known Inflation Double opening can close payments earlier without closing Ghola.
      An original-opening Amal play halves available cash before ordinary payments become legal.
      Original rights, preparation, timing and costs still apply. Only your whole answer is shared.</p>
    {answers.map(answer => {
      const action: Action = { type: 'truthAnswer', answer };
      return <Button key={answer} className="game-action min-h-11 whitespace-normal" data-turn-action-answer={answer}
        disabled={!canAnswer(answer)} onClick={() => { if (canAnswer(answer)) props.act(action); }}>
        {answer === 'unknown' ? 'I don’t know yet' : `Answer ${answer === 'yes' ? 'Yes' : 'No'}`}
      </Button>;
    })}
  </section>;
}
