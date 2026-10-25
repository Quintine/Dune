import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { splitLocation, territory } from '../game/board';
import { guildShipmentCost } from '../game/shipment-price';
import { guildTransportQuote } from '../game/transport-quote';
import { junctionTransportChoice } from '../game/junction-transport-options';
import { advisorTransportMatchingKey } from '../game/advisor-transport-matching';
import type { HomeworldShipmentSources } from '../game/homeworld-shipment-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaAdvisorMatching, nextSemutaAdvisorMatching, passSemutaAdvisorMatching, claimSemutaAdvisorMatching,
  semutaAdvisorMatchingPlayer, semutaAdvisorMatchingInventory,
} from './fixture-semuta-advisor-matching';

export type SemutaAdvisorTransportMatchingKind = 'guild' | 'junction';
export type SemutaAdvisorTransportMatchingDirection = 'fightersToAdvisors' | 'advisorsToFighters';
export type SemutaAdvisorTransportMatchingStep = { actor: string; action: Action };
export const actSemutaAdvisorTransportMatching = actSemutaAdvisorMatching;
export const passSemutaAdvisorTransportMatching = passSemutaAdvisorMatching;
export const claimSemutaAdvisorTransportMatching = claimSemutaAdvisorMatching;
export const semutaAdvisorTransportMatchingPlayer = semutaAdvisorMatchingPlayer;
export const semutaAdvisorTransportMatchingInventory = semutaAdvisorMatchingInventory;
export const semutaAdvisorTransportMatchingClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingAdvisorTransportMatching &&
  !game.pendingGuildTransport && !game.pendingHomeworldShipment && !game.pendingAutomaticAdvisorFlips?.length;
export const semutaAdvisorTransportMatchingPhysical = (game: Game) => ({ homeworlds: game.homeworlds,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, elites: p.elites,
    advisors: p.advisors, reserves: p.reserves, tanks: p.tanks, shipped: p.shipped, moved: p.moved, ally: p.ally })) });
const ownedResponse = (game: Game) => !!game.response && (game.response.kind === 'advisorFlip' ||
  game.response.kind === 'guildTransportPermission' || game.response.kind === 'guildRate');

/** Keep matching, native permission/rate and every fresh group caller-owned.
 * Guild actually waits; typed Homeworld interception uses its native reply. */
export function nextSemutaAdvisorTransportMatching(game: Game): SemutaAdvisorTransportMatchingStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || ownedResponse(game)) return null;
  if (!game.response && !game.phaseOpening) {
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: false } };
    if (game.decision?.kind === 'homeworldShipmentGuild')
      return { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, allow: true } };
  }
  return nextSemutaAdvisorMatching(game);
}
export const nextSemutaAdvisorTransportMatchingStep = nextSemutaAdvisorTransportMatching;
export function advanceSemutaAdvisorTransportMatching(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorTransportMatchingStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorTransportMatching(game);
    assert.ok(step, `Choose the original matching/permission/rate/fresh control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAdvisorTransportMatching(game, step.actor, step.action, actions);
  }
  throw Error('The original Semuta/transport matching chronology did not reach its finite boundary');
}
function layer(game: Game) {
  const response = game.response;
  return response ? JSON.stringify([response.kind, response.advisorTransportMatchingSource?.event,
    response.guildTransportEvent, response.guildRateEvent, response.automaticAdvisorFlip?.event]) : null;
}
/** Explicitly allow one original response only. Matching allowance can open
 * the independently owned native permission/rate or payment continuation. */
export function allowSemutaAdvisorTransportMatching(game: Game, actions: SemutaAdvisorTransportMatchingStep[] = []): Game {
  const original = layer(game); assert.ok(original);
  for (let count = 0; layer(game) === original && count < game.players.length; count++) {
    const response: NonNullable<Game['response']> = game.response!;
    const actor = game.players.find(p => !response.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaAdvisorTransportMatching(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(layer(game), original); return game;
}
/** Finish only original ordinary income/arrival controls. Matching and native
 * permission/rate remain explicit; the same BG movement turn stays active. */
export function finishSemutaAdvisorTransportMatching(game: Game, actions: SemutaAdvisorTransportMatchingStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the original fresh cost first');
  return advanceSemutaAdvisorTransportMatching(game, semutaAdvisorTransportMatchingClean, actions);
}

/** Original Advanced R/C/BG/A/G with actual paid Semuta, original printed
 * Karama and two physically earned BG groups. No played state is installed. */
export function createSemutaAdvisorTransportMatchingFixture(options: {
  kind?: SemutaAdvisorTransportMatchingKind; direction?: SemutaAdvisorTransportMatchingDirection;
} = {}) {
  const kind = options.kind ?? 'guild', direction = options.direction ?? 'fightersToAdvisors';
  const seller = 'richese', holder = 'choam', owner = 'beneGesserit', spender = 'atreides', guild = 'guild';
  const homeworlds = kind === 'junction';
  let game = createGame('SEMUTAADVISORTRANSPORTMATCHING', newPlayer(seller, 'Richese', 'richese'), true, ['choam']);
  for (const faction of [holder, owner, spender, guild] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorTransportMatchingStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorTransportMatching(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorTransportMatching(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  const enableHomeworlds = homeworlds ? transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); }) : null;
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: homeworlds ? 'original-undealt-semuta-homeworld-preview' : 'original-undealt-advanced-semuta-preview' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.equal(!!game.homeworlds, homeworlds); assert.ok(game.players.every(p => !p.hand.length));
  assert.ok(!game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorTransportMatchingInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const selected = [ordinary[0], ordinary[1], ordinary[2], printed, ordinary[3]], cost = printed.id;
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: { before: Game; steps: SemutaAdvisorTransportMatchingStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextSemutaAdvisorTransportMatching(game); assert.ok(step);
    const before = step.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(step.actor, step.action);
    if (before) advisorSetup = { before, steps: [structuredClone(step)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorTransportMatchingPlayer(game, owner).forces['arrakeen:10'], 1);
  assert.equal(isAdvisor(semutaAdvisorTransportMatchingPlayer(game, owner), 'arrakeen'), true);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const orderLand = (position: number) => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'arrakeen', 'tueks_sietch'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
  };
  for (let position = 0; position < 4; position++) orderLand(position);
  let beforeBid: Game | undefined, bid: SemutaAdvisorTransportMatchingStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAdvisorTransportMatchingPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorTransportMatching(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorTransportMatchingPlayer(beforeBid, holder).spice - semutaAdvisorTransportMatchingPlayer(game, holder).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && semutaAdvisorTransportMatchingClean(state));
  const fighterShipment = transition(() => {
    act(owner, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 2, elite: 0, allyPayment: 0 });
    reach(semutaAdvisorTransportMatchingClean);
  });
  assert.equal(semutaAdvisorTransportMatchingPlayer(fighterShipment.before, owner).spice - semutaAdvisorTransportMatchingPlayer(game, owner).spice, 4);
  assert.equal(semutaAdvisorTransportMatchingPlayer(game, owner).forces['imperial_basin:9'], 2);
  let beforeWorm: Game | null = null, nexus: Game | null = null;
  let wormOrder: { position: number; from: number; card: Game['spiceDeck'][number] } | null = null;
  let alliance: ReturnType<typeof transition> | null = null;
  if (kind === 'guild') {
    reach(state => state.turn === 2 && state.phase === 1 && semutaAdvisorTransportMatchingClean(state) &&
      !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
    beforeWorm = structuredClone(game);
    const from = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
    assert.ok(from >= 0); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(card);
    wormOrder = { position: 0, from, card: structuredClone(card) }; orderLand(1); orderLand(2);
    reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && semutaAdvisorTransportMatchingClean(state));
    nexus = structuredClone(game);
    alliance = transition(() => { act(owner, { type: 'alliance', target: guild }); act(guild, { type: 'alliance', target: owner }); });
    assert.equal(semutaAdvisorTransportMatchingPlayer(game, owner).ally, guild);
    assert.equal(semutaAdvisorTransportMatchingPlayer(game, guild).ally, owner);
  }
  reach(state => state.turn === 2 && state.phase === 5 && state.active === owner && semutaAdvisorTransportMatchingClean(state));
  let junctionOffer: ReturnType<typeof transition> | null = null, offerStep: SemutaAdvisorTransportMatchingStep | null = null;
  if (kind === 'junction') {
    const sponsor = viewGame(game, guild).junctionTransport; assert.ok(sponsor?.canOffer); assert.equal(sponsor.recipient, owner);
    offerStep = { actor: guild, action: { type: 'offerJunctionTransport', event: sponsor.offerEvent, rate: 'half' } };
    junctionOffer = transition(() => { act(offerStep!.actor, offerStep!.action); });
  }
  const sourceLocation = direction === 'fightersToAdvisors' ? 'imperial_basin:9' : 'arrakeen:10';
  const destinationLocation = direction === 'fightersToAdvisors' ? 'arrakeen:10' : 'imperial_basin:9';
  const replacementLocation = direction === 'fightersToAdvisors' ? 'polar_sink:0' : 'tueks_sietch:5';
  const declarationFor = (to: string, amount: number) => {
    const sources: HomeworldShipmentSources = { [sourceLocation]: { normal: amount, elite: 0 } };
    const point = splitLocation(to);
    if (kind === 'guild') {
      const action: Action = { type: 'guildShip', from: sourceLocation, territory: point.territory,
        sector: point.sector, amount, elite: 0, allyPayment: 0 };
      const quote = guildTransportQuote(viewGame(game, owner), action); assert.deepEqual(quote.unavailableReasons, []);
      return { action, sources, price: guildShipmentCost(territory(point.territory).type, amount, true) };
    }
    const quote = junctionTransportChoice(viewGame(game, owner), to, sources, 0); assert.equal(quote.blocked, null); assert.ok(quote.action);
    return { action: quote.action, sources, price: quote.cost };
  };
  const transportQuote = declarationFor(destinationLocation, 1), replacementQuote = declarationFor(replacementLocation, 1);
  const largerQuote = direction === 'fightersToAdvisors' ? declarationFor(destinationLocation, 2) : null;
  const beforeDeclaration = structuredClone(game), nativeAction = transportQuote.action;
  assert.equal(semutaAdvisorTransportMatchingPlayer(game, owner).shipped, false);
  const declaration = transition(() => { act(owner, nativeAction); });
  assert.ok(game.response?.advisorTransportMatchingSource && game.pendingAdvisorTransportMatching);
  assert.equal(game.response.kind, 'advisorFlip'); assert.equal(game.pendingAdvisorTransportMatching.intent.kind, kind);
  assert.equal(game.pendingGuildTransport ?? null, null); assert.equal(game.pendingHomeworldShipment ?? null, null);
  assert.deepEqual(semutaAdvisorTransportMatchingPhysical(game), semutaAdvisorTransportMatchingPhysical(beforeDeclaration));
  assert.ok(semutaAdvisorTransportMatchingPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAdvisorTransportMatchingPlayer(game, spender).hand.some(card => card.id === cost));
  const source = structuredClone(game), originalResponse = structuredClone(game.response);
  const originalParent = structuredClone(game.pendingAdvisorTransportMatching), originalSource = structuredClone(game.response.advisorTransportMatchingSource);
  const opportunity = originalParent.opportunity, denialKey = advisorTransportMatchingKey(originalSource, opportunity);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.deepEqual(semutaAdvisorTransportMatchingInventory(game), originalInventory);
  return { game, source, beforeCost: source, advanced: true as const, kind, direction, owner, bg: owner, recipient: owner,
    seller, richese: seller, holder, spender, atreides: spender, guild, actor: owner, shipper: owner,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, originalResponse, originalParent, originalPending: originalParent,
    originalSource, receipt: originalSource, opportunity, denialKey, originalDenied: structuredClone(game.advisorTransportMatchingDenied ?? []),
    originalPhysical: structuredClone(semutaAdvisorTransportMatchingPhysical(game)), originalOffer: structuredClone(game.junctionOffer ?? null),
    sourceLocation, destinationLocation, origin: splitLocation(sourceLocation).territory, destination: splitLocation(destinationLocation).territory,
    replacementLocation, replacementActor: owner, replacementAction: replacementQuote.action, replacementQuote,
    noMatch: replacementQuote.action, largerPacket: largerQuote?.action ?? null, largerQuote,
    amount: 1, price: transportQuote.price, transportCost: transportQuote.price, transportQuote,
    initial, enableHomeworlds, lobby, setup, initialization, beforeStartingDeal, afterSetup, advisorSetup,
    deal: selected.map(card => card.id), dealOrder, originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, fighterShipment, beforeWorm, wormOrder, nexus, alliance, junctionOffer, offerStep, beforeDeclaration, declaration,
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced R/C/BG/A/G exact-CHOAM Semuta initialization on a genuinely ready undealt lobby; only original unopened starting-card/Spice positions and scalar lotteries are selected. Atreides really receives printed Karama and CHOAM really buys cache1 Semuta. No played hand, wallet, force, stance, clock, alliance, grant or pending receipt is installed.',
      'BG actually places its original advisor at Arrakeen10 beside A10, declines preparation and pays four to ship two original reserves to empty Basin9 on turn1. Actual native Guild timing/interception/income, Collection, Mentat, next Storm and phase controls execute. Both original groups remain for BG’s unused turn2 shipment.',
      kind === 'guild'
        ? 'One original unopened turn2 Worm and safe original follow-up lands produce a real Nexus. BG actually proposes Guild alliance and Guild accepts; the original reciprocal alliance earns native board cross-shipment. No Nexus Cards module or Secret Ally is selected.'
        : 'Homeworlds are enabled by their real original lobby action. Original typed custody stays native; high Guild really offers its current half-price Junction event to active BG. This source has no alliance and no other optional module.',
      'Declare the original one-counter opposite-type transport and stop at its native matching response, before payment, withdrawal/transfer, permission or rate. Denial keeps the original opportunity unused; expose a real empty Polar destination for fighters, or Guild-occupied Tueks for original advisors. Board groups keep their source stance unless matching resident BG; the genuine larger two-fighter packet remains available separately.',
    ],
  };
}
export type SemutaAdvisorTransportMatchingFixture = ReturnType<typeof createSemutaAdvisorTransportMatchingFixture>;
