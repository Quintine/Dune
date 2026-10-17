import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { createIndependentCardModulesFixture, type IndependentCardModulesOptions, type IndependentCardModulesStep } from './fixture-independent-card-modules';
import { nextPairedChoamSkillsStep } from './fixture-paired-choam-nexus-skills';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type SelectedIndependentNexusStep = IndependentCardModulesStep;
export type SelectedIndependentNexusOptions = Pick<IndependentCardModulesOptions, 'advanced' | 'skills' | 'tech' | 'strongholds'> & {
  expansions?: Game['expansions'];
  /** A real first-turn bribe funds a paid ten-force turn-two shipment; the
   * original drawn Cunning is retained for turn three. */
  drainReserves?: boolean;
  choamNexus?: 'choam' | 'ixians';
};
export const selectedIndependentNexusClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingGuildBetrayal &&
  !game.pendingNexusIxianBetrayal && !game.pendingNexusHarkonnenBetrayal;
export function selectedIndependentNexusPlayer(game: Game, actor: string) {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
}
export function actSelectedIndependentNexus(game: Game, actor: string, action: Action, actions?: SelectedIndependentNexusStep[]): Game {
  actions?.push({ actor, action: structuredClone(action) });
  return withClassicDiscoveryNexusLottery(() => {
    // The original action owns all payment, marker, card and force transitions.
    // Stable scalar lotteries only order still-unused native shuffles.
    return applyAction(game, actor, action);
  });
}

function nextSelectedIndependentNexus(game: Game): SelectedIndependentNexusStep | null {
  if (game.pendingGuildBetrayal) {
    const pending = game.pendingGuildBetrayal;
    const actor = pending.required.find(actor => !pending.passed.includes(actor)); assert.ok(actor);
    return { actor, action: { type: 'guildBetrayalPass', event: pending.invoice.event } };
  }
  if (game.pendingNexusIxianReplacement)
    return { actor: game.pendingNexusIxianReplacement.buyer,
      action: { type: 'nexusIxianReplacementPass', event: game.pendingNexusIxianReplacement.event } };
  if (!game.phaseOpening && !game.response && !game.truthtrance) {
    const decision = game.decision;
    if (decision?.kind === 'homeworldDefense')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, use: false } };
    if (decision?.kind === 'homeworldRevivalDeployment' || decision?.kind === 'caladanReinforcement')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'richeseDeclaration') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, position: 'first' } };
    if (decision?.kind === 'richeseBlackMarket') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, decline: true } };
    if (decision?.kind === 'richeseCache') {
      const card = game.richeseCache![0]; assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'onceAround', direction: 'counterclockwise' } };
    }
    if (decision?.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
    if (!decision && game.richeseAuction && !game.richeseAuction.outcome) {
      const lot = game.richeseAuction;
      const actor = lot.method === 'silent'
        ? lot.order.find(actor => lot.eligible.includes(actor) && !Object.hasOwn(lot.sealed, actor)) : lot.active;
      assert.ok(actor);
      return { actor, action: { type: 'richeseBid', event: lot.event, amount: lot.method === 'silent' ? 0 : null } };
    }
  }
  return nextPairedChoamSkillsStep(game);
}
export function advanceSelectedIndependentNexus(game: Game, until: (state: Game) => boolean,
  actions: SelectedIndependentNexusStep[] = [], basicStormDial?: number): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The real selected-deck chronology ended before its card control');
    const step = nextSelectedIndependentNexus(game); assert.ok(step, 'Supply the current original human Battle Plan');
    const action = basicStormDial !== undefined && !game.advanced && step.action.type === 'stormDial'
      ? {...step.action,amount:basicStormDial} : step.action;
    game = actSelectedIndependentNexus(game, step.actor, action, actions);
  }
  throw Error('The selected-deck independent/Nexus chronology did not reach its requested boundary');
}
function frontOriginalCard(game: Game, id: string): void {
  const index = game.deck.findIndex(card => card.id === id); assert.ok(index >= 0, `Original unused ${id} must remain in the deck`);
  game.deck.unshift(game.deck.splice(index, 1)[0]);
}
function orderOriginalBlow(game: Game, worm = false): void {
  const front: Game['spiceDeck'] = [];
  if (worm) {
    const index = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.thumper && !card.suppressed);
    assert.ok(index >= 0); front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
    assert.ok(index >= 0); front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}
function buyOriginalNormalCard(game: Game, actor: string, card: string, actions: SelectedIndependentNexusStep[]): Game {
  for (let count = 0; count < 500; count++) {
    if (selectedIndependentNexusPlayer(game, actor).hand.some(face => face.id === card)) return game;
    let step: SelectedIndependentNexusStep | null;
    if (selectedIndependentNexusClean(game) && game.auction && !game.richeseAuction &&
      game.auction.cards[game.auction.index]?.id === card) {
      const auction = game.auction;
      step = { actor: auction.active, action: auction.active === actor && auction.bidder !== actor
        ? { type: 'bid', amount: 1, allyPayment: 0 } : { type: 'passBid' } };
    } else step = nextSelectedIndependentNexus(game);
    assert.ok(step, 'The original normal lot must expose its bid/payment control');
    game = actSelectedIndependentNexus(game, step.actor, step.action, actions);
  }
  throw Error(`The real first-turn normal auction did not deliver ${card}`);
}

/** Fresh selected deck + independent3 + Nexus12 + optional all14/phase modules.
 * Real first-turn normal purchases supply Recruits and Reinforcements; real
 * first marker/reveal supplies the later reserve budget. Nothing is granted to
 * a played hand, wallet, army or receipt. Only unused original stock is ordered. */
export function createSelectedIndependentNexusCardsFixture(options: SelectedIndependentNexusOptions = {}) {
  const source = createIndependentCardModulesFixture({ ...options, nexus: true, independent: true,
    tech: options.tech ?? false, expansions: options.expansions ?? ['choam'], factions: ['richese', 'choam', 'guild', 'atreides'] });
  let game = structuredClone(source.game);
  const afterSetup = structuredClone(game), actions = source.steps;
  // The bank deals in front order. Both physical independent cards remain
  // unused after the native initial base/E1/E2 starting deals.
  frontOriginalCard(game, REINFORCEMENTS_CARD); frontOriginalCard(game, RECRUITS_CARD_ID);
  orderOriginalBlow(game);
  const staging = ['Order the unopened original Recruits and Reinforcements as the first two normal bank lots; buy each for one spice through native bidding.',
    'Order original non-worm first Blow and the original second-turn worm/land Blow before they are drawn.'];
  game = buyOriginalNormalCard(game, 'choam', RECRUITS_CARD_ID, actions);
  game = buyOriginalNormalCard(game, 'richese', REINFORCEMENTS_CARD, actions);
  const afterPurchases = structuredClone(game);
  game = advanceSelectedIndependentNexus(game, state => state.phase === 5 && state.active === 'richese' && selectedIndependentNexusClean(state), actions);
  const marker = selectedIndependentNexusPlayer(game, 'richese').noField!.tokens.find(token => token.value === 0); assert.ok(marker);
  const firstShipmentBefore = structuredClone(game);
  const firstShipmentStep: SelectedIndependentNexusStep = { actor: 'richese', action: { type: 'ship', noField: marker.id,
    event: selectedIndependentNexusPlayer(game, 'richese').noFieldEvent, territory: 'habbanya_ridge_sietch', sector: 17 } };
  game = actSelectedIndependentNexus(game, firstShipmentStep.actor, firstShipmentStep.action, actions);
  game = advanceSelectedIndependentNexus(game, selectedIndependentNexusClean, actions);
  const firstShipmentAfter = structuredClone(game);
  const deployed = selectedIndependentNexusPlayer(game, 'richese').noField!.deployed; assert.ok(deployed);
  game = actSelectedIndependentNexus(game, 'richese', { type: 'revealNoField',
    event: selectedIndependentNexusPlayer(game, 'richese').noFieldEvent, token: deployed.tokenId }, actions);
  const afterFirstReveal = structuredClone(game);
  let reserveFunding: { before: Game; step: SelectedIndependentNexusStep; after: Game } | null = null;
  if (options.drainReserves) {
    const before = structuredClone(game), step: SelectedIndependentNexusStep = {
      actor: 'choam', action: { type: 'bribe', target: 'richese', amount: 9 },
    };
    game = actSelectedIndependentNexus(game, step.actor, step.action, actions);
    reserveFunding = { before, step, after: structuredClone(game) };
    staging.push('CHOAM pays a real nine-spice turn-one bribe to Richese; its native END Mentat credit funds the later paid reserve-draining shipment.');
  }
  game = advanceSelectedIndependentNexus(game, state => state.turn === 2 && state.phase === 1 && selectedIndependentNexusClean(state), actions);
  orderOriginalBlow(game, true);
  game = advanceSelectedIndependentNexus(game, state => state.nexus && !state.spiceWindow && !state.spiceResolution && selectedIndependentNexusClean(state), actions);
  const beforeAlliance = structuredClone(game);
  for (const [actor, target] of [['guild', 'atreides'], ['atreides', 'guild']])
    game = actSelectedIndependentNexus(game, actor, { type: 'alliance', target }, actions);
  game = advanceSelectedIndependentNexus(game, state => state.nexusCards?.phase?.stage === 'drawing' && selectedIndependentNexusClean(state), actions);
  const beforeClosingDraw = structuredClone(game), draws: Array<{ before: Game; step: SelectedIndependentNexusStep; after: Game }> = [];
  for (const [actor, face] of [['richese', 'richese'], ['choam', options.choamNexus ?? 'choam']] as const) {
    const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(face); assert.ok(index >= 0);
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    const before = structuredClone(game), step: SelectedIndependentNexusStep = { actor,
      action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } };
    game = actSelectedIndependentNexus(game, step.actor, step.action, actions);
    draws.push({ before, step, after: structuredClone(game) });
  }
  game = advanceSelectedIndependentNexus(game, state => state.nexusCards?.phase?.stage === 'complete' && selectedIndependentNexusClean(state), actions);
  assert.equal(game.nexusCards!.cards!.hands.richese, 'richese');
  assert.equal(game.nexusCards!.cards!.hands.choam, options.choamNexus ?? 'choam');
  return { ...source, afterSetup, afterPurchases, firstShipment: { before: firstShipmentBefore, step: firstShipmentStep, after: firstShipmentAfter },
    afterFirstReveal, reserveFunding, beforeAlliance, beforeClosingDraw, draws, game, actions, staging };
}

export function selectedIndependentChoamFuelAction(game: Game): Action {
  const play = viewGame(game, 'choam').choamWorthless!.plays.find(play => play.source === 'nexus' &&
    play.card.id === RECRUITS_CARD_ID && play.effect === 'kulon');
  assert.ok(play && play.source === 'nexus' && !play.blocked);
  return { type: 'card', mode: 'choam', card: RECRUITS_CARD_ID, effect: 'kulon', nexus: play.event };
}
export function selectedIndependentRichesePairAction(game: Game): Action {
  const player = selectedIndependentNexusPlayer(game, 'richese'), offer = viewGame(game, 'richese').nexusRicheseCunning;
  assert.ok(offer && !offer.blocked);
  const concealed = player.noField!.tokens.find(token => token.value === 3), revealed = player.noField!.tokens.find(token => token.value === 5);
  assert.ok(concealed && revealed);
  return { type: 'ship', noField: concealed.id, revealedToken: revealed.id, nexus: offer.event,
    event: player.noFieldEvent, territory: 'tueks_sietch', sector: 5, allyPayment: 0 };
}
/** Real two-marker Cunning attacks the untouched native Guild starting army.
 * Optional paid ten-force ordinary shipment leaves two reserves after the
 * later concealed 3 appears; the canonical marker values remain 0/3/5. */
export function createSelectedIndependentNexusBattleFixture(options: SelectedIndependentNexusOptions = {}) {
  const source = createSelectedIndependentNexusCardsFixture(options), actions = source.actions;
  let game = advanceSelectedIndependentNexus(source.game, state => state.phase === 5 && state.active === 'richese' && selectedIndependentNexusClean(state), actions);
  let reserveShipment: { before: Game; step: SelectedIndependentNexusStep; after: Game } | null = null;
  if (options.drainReserves) {
    const before = structuredClone(game), step: SelectedIndependentNexusStep = { actor: 'richese',
      action: { type: 'ship', amount: 10, elite: 0, territory: 'habbanya_ridge_sietch', sector: 17, allyPayment: 0 } };
    game = actSelectedIndependentNexus(game, step.actor, step.action, actions);
    game = advanceSelectedIndependentNexus(game, selectedIndependentNexusClean, actions);
    reserveShipment = { before, step, after: structuredClone(game) };
    assert.equal(selectedIndependentNexusPlayer(game, 'richese').reserves, 10);
    assert.equal(selectedIndependentNexusPlayer(game, 'richese').spice,
      selectedIndependentNexusPlayer(before, 'richese').spice - 10);
    assert.equal(game.nexusCards!.cards!.hands.richese, 'richese');
    game = advanceSelectedIndependentNexus(game, state => state.turn === 3 && state.phase === 1 && selectedIndependentNexusClean(state), actions, 2);
    orderOriginalBlow(game);
    game = advanceSelectedIndependentNexus(game, state => state.turn === 3 && state.phase === 5 && state.active === 'richese' && selectedIndependentNexusClean(state), actions);
    source.staging.push('Richese pays ten spice for an actual ten-force ordinary turn-two shipment to empty Habbanya, then retains its original Nexus until turn-three Cunning. Actual legal Basic Storm dials of two leave the protected Guild stronghold available for shipment.');
  }
  const beforePair = structuredClone(game), pairAction = selectedIndependentRichesePairAction(game);
  game = actSelectedIndependentNexus(game, 'richese', pairAction, actions);
  game = advanceSelectedIndependentNexus(game, selectedIndependentNexusClean, actions);
  const afterPair = structuredClone(game);
  game = advanceSelectedIndependentNexus(game, state => state.phase === 6 && !!state.active && selectedIndependentNexusClean(state), actions);
  const choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === 'tueks_sietch'); assert.ok(choice);
  const battleAction: Action = { type: 'chooseBattle', territory: choice.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker };
  game = actSelectedIndependentNexus(game, choice.chooser, battleAction, actions);
  game = advanceSelectedIndependentNexus(game, state => !!state.battle && !state.battle.preparation &&
    state.battle.preLeader?.closed !== false && selectedIndependentNexusClean(state), actions);
  const available = (actor: string) => selectedIndependentNexusPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt &&
    !game.leaderSkills?.assignments.some(assignment => assignment.owner === actor && assignment.leader === leader.id))
    .sort((a, b) => a.strength - b.strength);
  const own = available('richese').at(-1), other = available('guild')[0]; assert.ok(own && other);
  const plans: SelectedIndependentNexusStep[] = [
    { actor: 'richese', action: { type: 'battlePlan', leader: own.id, dial: 2, support: game.advanced ? 2 : 0,
      defense: REINFORCEMENTS_CARD } },
    { actor: 'guild', action: { type: 'battlePlan', leader: other.id, dial: 0, support: 0 } },
  ];
  return { ...source, game, actions, reserveShipment, beforePair, pairAction, afterPair, battleAction, plans, location: 'tueks_sietch:5' };
}
export function revealSelectedIndependentNexusPlans(game: Game, plans: readonly SelectedIndependentNexusStep[], actions: SelectedIndependentNexusStep[] = []): Game {
  for (const plan of plans) {
    game = actSelectedIndependentNexus(game, plan.actor, plan.action, actions);
    game = advanceSelectedIndependentNexus(game, state => !!state.battle && !state.battle.preparation &&
      state.battle.preLeader?.closed !== false && selectedIndependentNexusClean(state), actions);
  }
  assert.ok(game.battle?.revealed); return game;
}

/** Actual compulsory cache auction, funded CHOAM bid and absent-Ix offer. The
 * discarded bought cache face is replaced by an original independent face. */
export function createSelectedIndependentNexusCacheFixture(options: SelectedIndependentNexusOptions = {}) {
  const source = createSelectedIndependentNexusCardsFixture({ ...options, choamNexus: 'ixians' }), actions = source.actions;
  let game = advanceSelectedIndependentNexus(source.game, state => !state.phaseOpening && !state.response && state.decision?.kind === 'richeseCache', actions);
  const card = structuredClone(game.richeseCache![0]); assert.ok(card);
  game = actSelectedIndependentNexus(game, 'richese', { type: 'decision', event: game.richeseBidding!.event,
    card: card.id, method: 'silent' }, actions);
  game = advanceSelectedIndependentNexus(game, selectedIndependentNexusClean, actions);
  const beforePurchase = structuredClone(game), lot = game.richeseAuction; assert.ok(lot && !lot.outcome);
  frontOriginalCard(game, HARASS_WITHDRAW_CARD);
  const replacement = structuredClone(game.deck[0]);
  for (let count = 0; !game.pendingNexusIxianReplacement && count < 200; count++) {
    const current = game.richeseAuction;
    let step: SelectedIndependentNexusStep | null;
    if (selectedIndependentNexusClean(game) && current && !current.outcome) {
      const actor = current.order.find(actor => current.eligible.includes(actor) && !Object.hasOwn(current.sealed, actor)); assert.ok(actor);
      step = { actor, action: { type: 'richeseBid', event: current.event, amount: actor === 'choam' ? 2 : 0 } };
    } else step = nextSelectedIndependentNexus(game);
    assert.ok(step); game = actSelectedIndependentNexus(game, step.actor, step.action, actions);
  }
  const offer = viewGame(game, 'choam').nexusIxianReplacement;
  assert.ok(offer && offer.origin === 'cache' && offer.canUse && offer.purchased?.id === card.id);
  return { ...source, game, actions, beforePurchase, card, replacement, price: 2,
    useAction: { type: 'nexusIxianReplacementUse', event: offer.event } as Action };
}
