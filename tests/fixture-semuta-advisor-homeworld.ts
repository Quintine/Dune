import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import { junctionTransportChoice } from '../game/junction-transport-options';
import type { HomeworldShipmentSources } from '../game/homeworld-shipment-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory, semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';
import {
  passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement,
} from './fixture-semuta-fremen-guild-movement';

export type SemutaAdvisorHomeworldKind = 'native' | 'junction';
export type SemutaAdvisorHomeworldStep = { actor: string; action: Action };
export const actSemutaAdvisorHomeworld = actSemutaRicheseCacheKarama;
export const passSemutaAdvisorHomeworld = passSemutaFremenGuildMovement;
export const claimSemutaAdvisorHomeworld = claimSemutaFremenGuildMovement;
export const semutaAdvisorHomeworldPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaAdvisorHomeworldInventory = semutaRicheseCacheKaramaInventory;
export const semutaAdvisorHomeworldClean = semutaRicheseCacheKaramaClean;
export const semutaAdvisorHomeworldPhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order, active: game.active, ready: game.ready,
  movementRemaining: game.movementRemaining, guildTimingGranted: game.guildTimingGranted,
  guildTimingLocked: game.guildTimingLocked, homeworlds: game.homeworlds,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  auction: game.auction, richeseAuction: game.richeseAuction, richeseBidding: game.richeseBidding,
  basicAlliedShipment: game.basicAlliedShipment,
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    leaders: player.leaders, shipped: player.shipped, moved: player.moved, revived: player.revived, ally: player.ally })),
});

/** Keep setup, Guild timing and typed Homeworld interception native. Neither
 * the automatic conversion nor a fresh discard is silently answered here. */
export function nextSemutaAdvisorHomeworld(game: Game,
  kind: SemutaAdvisorHomeworldKind = 'native'): SemutaAdvisorHomeworldStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.response?.automaticAdvisorFlip) return null;
  if (!game.phaseOpening && !game.response) {
    const bg = game.players.find(player => player.faction === 'beneGesserit'); assert.ok(bg);
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: bg.id, action: { type: 'predict', faction: 'atreides', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces' && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup',
        territory: kind === 'native' ? 'tueks_sietch' : 'arrakeen', sector: kind === 'native' ? 5 : 10 } };
    if (game.decision?.kind === 'advisorBattle' || game.decision?.kind === 'advisor')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.decision?.kind === 'intrusion') return null;
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: kind === 'native' } };
    if (game.decision?.kind === 'homeworldShipmentGuild')
      return { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, allow: true } };
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaAdvisorHomeworld(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorHomeworldStep[] = [], kind: SemutaAdvisorHomeworldKind = 'native'): Game {
  for (let count = 0; count < 1400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorHomeworld(game, kind);
    assert.ok(step, 'Choose the original conversion or fresh discard before continuing');
    game = actSemutaAdvisorHomeworld(game, step.actor, step.action, actions);
  }
  throw Error('The original Homeworld-conversion programme did not reach its finite boundary');
}
export function allowSemutaAdvisorHomeworld(game: Game,
  actions: SemutaAdvisorHomeworldStep[] = []): Game {
  assert.equal(game.response?.automaticAdvisorFlip?.producer, 'homeworldTransport');
  for (let count = 0; game.response?.kind === 'advisorFlip' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaAdvisorHomeworld(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.equal(game.response ?? null, null); return game;
}
/** Both original destinations are native Worlds and have no board-arrival
 * child. Close only the already-shipped original actor's actual native turn. */
export function finishSemutaAdvisorHomeworld(game: Game,
  actions: SemutaAdvisorHomeworldStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.pendingAutomaticAdvisorHomeworldTransport, undefined);
  assert.equal(game.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(game.pendingArrivalReaction ?? null, null); assert.equal(game.pendingHomeworldShipment ?? null, null);
  assert.ok(semutaAdvisorHomeworldClean(game)); assert.equal(game.phase, 5); assert.ok(game.active);
  const actor = game.active, shipper = semutaAdvisorHomeworldPlayer(game, actor);
  assert.equal(shipper.shipped, true); assert.equal(shipper.moved, 0);
  game = actSemutaAdvisorHomeworld(game, actor, { type: 'endMovement' }, actions);
  assert.ok(!game.movementRemaining?.includes(actor)); return game;
}

/** Original Advanced exact-CHOAM Homeworld initializer, real paid Semuta,
 * and a native return or sponsored Junction return. Original typed custody,
 * source quotes, payment and public receipts all come from native actions. */
export function createSemutaAdvisorHomeworldFixture(options: { kind: SemutaAdvisorHomeworldKind }) {
  const { kind } = options, richese = 'richese', holder = 'choam', owner = 'beneGesserit', spender = 'atreides', guild = 'guild';
  const territory = kind === 'native' ? 'tueks_sietch' : 'arrakeen', sector = kind === 'native' ? 5 : 10;
  let game = createGame('SEMUTAADVISORHOMEWORLD', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of [holder, owner, spender, guild] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorHomeworldStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorHomeworld(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorHomeworld(game, until, actions, kind); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const enableHomeworlds = transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-undealt-semuta-homeworld-preview' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.equal(game.homeworlds?.custody, null); assert.deepEqual(game.expansions, ['choam']);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorHomeworldInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const selected = [ordinary[0], ordinary[1], ordinary[2], printed, ordinary[3]], cost = printed.id;
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), from = `${territory}:${sector}`;
  assert.ok(game.homeworlds?.custody);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorHomeworldPlayer(game, owner).forces[from], 1);
  assert.equal(isAdvisor(semutaAdvisorHomeworldPlayer(game, owner), territory), true);
  assert.equal(semutaAdvisorHomeworldPlayer(game, kind === 'native' ? guild : spender).forces[from], kind === 'native' ? 5 : 10);
  assert.ok(semutaAdvisorHomeworldPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < 2; position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaAdvisorHomeworldStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAdvisorHomeworldPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorHomeworld(game, kind); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0, 'CHOAM really buys the original cache Semuta');
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorHomeworldPlayer(beforeBid, holder).spice - semutaAdvisorHomeworldPlayer(game, holder).spice, 1);
  assert.equal(semutaAdvisorHomeworldPlayer(game, richese).spice - semutaAdvisorHomeworldPlayer(beforeBid, richese).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && !state.phaseOpening && !state.response && state.decision?.kind === 'advisorBattle');
  const openingOffer = structuredClone(game);
  const declinedPreparation = transition(() => {
    act(owner, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === (kind === 'native' ? guild : owner) && semutaAdvisorHomeworldClean(state));
  });
  let bgEnd: ReturnType<typeof transition> | null = null;
  let junctionOffer: ReturnType<typeof transition> | null = null;
  let offerStep: SemutaAdvisorHomeworldStep | null = null;
  if (kind === 'junction') {
    bgEnd = transition(() => {
      act(owner, { type: 'endMovement' });
      reach(state => state.phase === 5 && state.active === spender && semutaAdvisorHomeworldClean(state));
    });
    const sponsor = viewGame(game, guild).junctionTransport; assert.ok(sponsor?.canOffer);
    assert.equal(sponsor.recipient, spender);
    offerStep = { actor: guild, action: { type: 'offerJunctionTransport', event: sponsor.offerEvent, rate: 'half' } };
    junctionOffer = transition(() => { act(offerStep!.actor, offerStep!.action); });
  }
  const shipper = kind === 'native' ? guild : spender, amount = kind === 'native' ? 5 : 10;
  const destination = `homeworld:${shipper}`, sources: HomeworldShipmentSources = { [from]: { normal: amount, elite: 0 } };
  const routeQuote = kind === 'native'
    ? guildHomeworldShipmentChoice(viewGame(game, shipper), destination, sources, 0)
    : junctionTransportChoice(viewGame(game, shipper), destination, sources, 0);
  assert.equal(routeQuote.blocked, null); assert.ok(routeQuote.action);
  const nativeAction = routeQuote.action, price = routeQuote.cost;
  assert.equal(price, kind === 'native' ? 3 : 5);
  const beforeDeclaration = structuredClone(game);
  const beforeTypedGroups = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  const depositBefore = beforeTypedGroups.find(world => world.id === destination)?.forces[shipper]; assert.ok(depositBefore);
  const transport = transition(() => {
    act(shipper, nativeAction);
    reach(state => state.response?.automaticAdvisorFlip?.producer === 'homeworldTransport');
  });
  const actor = semutaAdvisorHomeworldPlayer(game, shipper);
  assert.equal(semutaAdvisorHomeworldPlayer(transport.before, shipper).spice - actor.spice, price);
  assert.equal(actor.forces[from], undefined); assert.equal(actor.shipped, true); assert.equal(actor.moved, 0);
  const afterTypedGroups = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  const depositAfter = afterTypedGroups.find(world => world.id === destination)?.forces[shipper]; assert.ok(depositAfter);
  assert.equal(depositAfter.normal, depositBefore.normal + amount); assert.equal(depositAfter.elite, depositBefore.elite);
  assert.equal(actor.reserves, semutaAdvisorHomeworldPlayer(transport.before, shipper).reserves + amount);
  assert.equal(game.response?.kind, 'advisorFlip'); assert.equal(game.response?.owner, owner);
  assert.equal(game.response?.automaticAdvisorFlip?.producer, 'homeworldTransport');
  assert.ok(game.pendingAutomaticAdvisorHomeworldTransport && game.pendingAutomaticAdvisorFlips?.length === 1);
  assert.equal(game.pendingAutomaticAdvisorHomeworldTransport.receipt.kind, kind);
  assert.equal(game.pendingAutomaticAdvisorHomeworldTransport.arrival, undefined);
  assert.equal(isAdvisor(semutaAdvisorHomeworldPlayer(game, owner), territory), true);
  assert.ok(semutaAdvisorHomeworldPlayer(game, owner).advisors?.[territory]?.aloneFlipHold);
  assert.equal(game.pendingHomeworldShipment ?? null, null);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.ok(semutaAdvisorHomeworldPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAdvisorHomeworldPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaAdvisorHomeworldInventory(game), originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, advanced: true as const, richese, holder, owner, bg: owner,
    spender, atreides: spender, guild, shipper, actor: shipper, cost, semuta: SEMUTA_DRUG_ID, action, nativeAction,
    from, to: destination, destination, territory, sector, location: from, amount, elite: 0, sources, price, routeQuote,
    originalResponse: structuredClone(game.response!),
    originalAutomaticSource: structuredClone(game.response!.automaticAdvisorFlip!),
    originalParent: structuredClone(game.pendingAutomaticAdvisorHomeworldTransport!),
    originalQueue: structuredClone(game.pendingAutomaticAdvisorFlips!),
    originalArrival: structuredClone(game.pendingArrivalReaction ?? null),
    originalHeldStance: structuredClone(semutaAdvisorHomeworldPlayer(game, owner).advisors![territory]),
    originalPhysical: structuredClone(semutaAdvisorHomeworldPhysical(game)), originalHistory: structuredClone(game.log),
    originalCustody: structuredClone(game.homeworlds!.custody!), beforeTypedGroups, afterTypedGroups,
    depositBefore: structuredClone(depositBefore), depositAfter: structuredClone(depositAfter),
    initial, enableHomeworlds, lobby, setup, initialization, beforeStartingDeal, afterSetup, dealOrder, spiceOrder, originalSpice,
    acquired, acquisition, openingOffer, declinedPreparation, bgEnd, junctionOffer, offerStep,
    beforeDeclaration, transport: { ...transport, price }, originalInventory,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Actual lobby Homeworlds enable action, original Advanced Semuta initializer on the ready undealt R/C/BG/A/G exact-CHOAM roster, and no other optional modules. Original physical native pools remain.',
      'Select original unopened starting-card positions so Atreides really receives printed Karama, plus two original ordinary Spice positions. CHOAM actually purchases original cache Semuta for one spice.',
      kind === 'native'
        ? 'Actual advisorSetup at Tueks Sietch5 beside Guilds five native board counters. Native Storm, Spice, Charity, Bidding and Revival execute, BG declines preparation, and Guild takes its actual early turn.'
        : 'Actual advisorSetup at Arrakeen10 beside Atreides ten native board counters. Native Storm, Spice, Charity, Bidding and Revival execute, BG declines preparation and Guild waits. BG really ends its turn; Guild then offers its real current high-Junction half tariff to Atreides.',
      kind === 'native'
        ? 'Actual owner-view guildHomeworldShipmentChoice returns G5 from Tueks to Junction for three. Native Homeworld interception, transport permission and Guild rate are allowed; payment and typed custody commit before the automatic conversion.'
        : 'Actual owner-view junctionTransportChoice returns A10 from Arrakeen to Caladan for five. The original sponsored offer, payment and typed custody commit before the automatic conversion; any original Guild income resolves through native passes.',
      'Stop at the original homeworldTransport advisorFlip before Atreides spends its original printed Karama. No played hand, counter, stance, wallet, custody, clock, source or response is installed. Finish closes only that original shipped actor turn with actual endMovement.',
    ],
  };
}
export type SemutaAdvisorHomeworldFixture = ReturnType<typeof createSemutaAdvisorHomeworldFixture>;
