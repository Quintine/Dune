import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import { TERRITORIES, territory } from '../game/board';
import type { Card } from '../game/cards';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID, type DiscoveryTokenFace } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import {
  completePairedChoamSkillsSetup, initializePairedChoamNexusSkills, nextPairedChoamSkillsStep,
  openPairedSkillsBattle, pairedSkillsBattlePlans, pairedSkillsClean,
  pairedSkillsPlayer, placePairedSkillsForce, revealPairedSkillsRichese,
  type PairedChoamNexusSkillsOptions,
} from './fixture-paired-choam-nexus-skills';
import { nextDiscoveryNativeE2SkillsStep } from './fixture-discovery-native-e2-skills';
import { applyPairedDiscoveryNexusStep, reservePairedDiscoveryNexusBoard } from './fixture-discovery-paired-nexus';

export type DiscoveryPairedNexusE2SkillsStep = { actor: string; action: Action };
export type DiscoveryPairedNexusE2SkillsOptions = PairedChoamNexusSkillsOptions & {
  tech?: boolean;
  strongholds?: boolean;
  kind?: 'shrine' | 'stash';
  arrakeenOwner?: 'richese' | 'choam';
};
export type DiscoveryPairedNexusE2SkillsTransition = {
  before: Game; step: DiscoveryPairedNexusE2SkillsStep; after: Game;
};
export type DiscoveryPairedNexusE2SkillsAcquisition = DiscoveryPairedNexusE2SkillsTransition & {
  buyer: string; card: Card;
};
export type DiscoveryPairedNexusE2SkillsFixture = {
  initial: Game; afterSetup: Game; afterFirstStorm: Game; collection: Game;
  previousMarker: DiscoveryPairedNexusE2SkillsTransition;
  firstMentat: DiscoveryPairedNexusE2SkillsTransition | null;
  game: Game; richese: string; choam: string; guild: string; fremen: string;
  collector: string; token: string; face: DiscoveryTokenFace; source: string;
  trainers: { richese: string; choam: string };
  actions: DiscoveryPairedNexusE2SkillsStep[]; staging: string[];
  acquisitions: DiscoveryPairedNexusE2SkillsAcquisition[];
};
export type DiscoveryPairedNexusE2SkillsClosing = {
  entry: DiscoveryPairedNexusE2SkillsTransition;
  vote: Game; ride: DiscoveryPairedNexusE2SkillsTransition;
  alliance: Game; drawing: Game; draws: DiscoveryPairedNexusE2SkillsTransition[]; movementStart: Game; game: Game;
};
export type DiscoveryPairedNexusE2SkillsBattle = {
  game: Game; plans: DiscoveryPairedNexusE2SkillsStep[]; key: string;
};
export const discoveryPairedNexusE2SkillsClean = pairedSkillsClean;
export const discoveryPairedNexusE2SkillsPlayer = pairedSkillsPlayer;

/** Original selections only. This entry point also serves human two-to-six-seat
 * starts; the longer paired-draw programme needs Guild and Fremen seats.
 * Existing hands, IDs and all14 offers are never replaced or redealt. */
export function initializeDiscoveryPairedNexusE2Skills(options: DiscoveryPairedNexusE2SkillsOptions = {}): Game {
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const factions = options.factions ?? ['richese', 'choam', 'guild', 'fremen'] as const;
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DISCOVERYPAIREDNEXUSE2SKILLS', newPlayer(options.seatIds?.[0] ?? factions[0], factions[0], factions[0]), advanced, ['choam']);
  if (!options.initial) for (const faction of factions.slice(1))
    joinGame(game, newPlayer(options.seatIds?.[game.players.length] ?? faction, faction, faction));
  const tech = options.tech ?? !!game.techTokens;
  const strongholds = options.strongholds ?? !!game.strongholdCards;
  assert.equal(game.advanced, advanced);
  assert.ok(game.players.length >= (tech ? 3 : 2) && game.players.length <= 6);
  assert.ok(!strongholds || advanced, 'Original Stronghold Cards require Advanced.');
  if (game.status === 'lobby') {
    if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
    if (!!game.strongholdCards !== strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: strongholds });
    game.discoveryEnabled = true;
  } else {
    assert.equal(game.discoveryEnabled, true);
    assert.equal(!!game.techTokens, tech, 'Saved native module selection is authoritative.');
    assert.equal(!!game.strongholdCards, strongholds);
  }
  // The existing initializer controls only fresh original offer entropy.
  return initializePairedChoamNexusSkills({ ...options, initial: game, advanced,
    richeseSkill: options.initial ? options.richeseSkill : options.richeseSkill ?? 'suk-graduate',
    choamSkill: options.initial ? options.choamSkill : options.choamSkill ?? 'smuggler' });
}

/** Reuse native response, auction, Guild, skill and original Discovery producers.
 * Owned entry, Maker and battle-plan endpoints remain explicit human actions. */
export function nextDiscoveryPairedNexusE2SkillsStep(game: Game): DiscoveryPairedNexusE2SkillsStep | null {
  if (game.status === 'setup' && game.setupStage === 'leaderSkills') return nextPairedChoamSkillsStep(game);
  if (pairedSkillsClean(game) && game.nexusCards?.phase?.stage === 'drawing') return nextPairedChoamSkillsStep(game);
  if (!game.phaseOpening && !game.response && game.decision) {
    const d = game.decision;
    if (d.kind === 'discoveryEntry' || d.kind === 'greatMakerRide')
      return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
    if (d.kind === 'greatMakerVote')
      return { actor: d.player, action: { type: 'decision', event: d.event, yes: false } };
    if (d.kind === 'discoveryDiscard') {
      const card = pairedSkillsPlayer(game, d.player).hand[0]; assert.ok(card);
      return { actor: d.player, action: { type: 'decision', event: d.event, card: card.id } };
    }
    if (d.kind === 'faceDance') return null;
  }
  return nextDiscoveryNativeE2SkillsStep(game, true);
}
export function stepDiscoveryPairedNexusE2Skills(game: Game, step: DiscoveryPairedNexusE2SkillsStep,
  actions?: DiscoveryPairedNexusE2SkillsStep[]): Game {
  // Existing original scalar entropy; not a fake clock or a fabricated receipt.
  return applyPairedDiscoveryNexusStep(game, step, actions);
}
export function advanceDiscoveryPairedNexusE2Skills(game: Game, until: (g: Game) => boolean,
  actions?: DiscoveryPairedNexusE2SkillsStep[]): Game {
  for (let n = 0; n < 2400; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextDiscoveryPairedNexusE2SkillsStep(game);
    assert.ok(step, 'Continue the original human plan or Face Dance explicitly.');
    game = stepDiscoveryPairedNexusE2Skills(game, step, actions);
  }
  throw Error('Original paired E2 Discovery/Skills programme did not reach its boundary.');
}
export function settleDiscoveryPairedNexusE2Skills(game: Game, actions?: DiscoveryPairedNexusE2SkillsStep[]): Game {
  return advanceDiscoveryPairedNexusE2Skills(game, g => pairedSkillsClean(g) &&
    !g.pendingShipment && !g.pendingTreacheryDiscard && !g.pendingChoamWorthless, actions);
}
export function completeDiscoveryPairedNexusE2SkillsSetup(game: Game,
  options: DiscoveryPairedNexusE2SkillsOptions = {}, actions?: DiscoveryPairedNexusE2SkillsStep[]): Game {
  return completePairedChoamSkillsSetup(game, options, actions);
}
function withToken<T>(game: Game, face: DiscoveryTokenFace, run: () => T): T {
  const supply = game.discoveries!.tokens.filter(t => t.status === 'supply' && t.type === DISCOVERY_TOKEN_BY_ID[face].type);
  const index = supply.findIndex(t => t.face === face); assert.ok(index >= 0);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = Math.floor((index + 0.5) * 0x100000000 / supply.length);
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function orderSpice(game: Game, printed: string, staging: string[]): void {
  const take = (matches: (c: Game['spiceDeck'][number]) => boolean) => {
    const index = game.spiceDeck.findIndex(matches); assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  };
  const cards = [take(c => 'territory' in c && c.discovery === printed)];
  if (game.advanced) cards.push(take(c => 'territory' in c && !c.discovery && c.territory === 'broken_land'));
  cards.push(take(c => 'worm' in c && !!c.greatMaker));
  cards.push(take(c => 'territory' in c && c.discovery === 'discovery-sihaya-ridge'));
  if (game.advanced) cards.push(take(c => 'territory' in c && !c.discovery && c.territory === 'rock_outcroppings'));
  game.spiceDeck.unshift(...cards);
  staging.push('Conserved original unplayed printed Discovery, optional Advanced Broken Land, Great Maker, Sihaya Ridge and optional Advanced Rock Outcroppings order.');
}
/** Only order an undealt physical card. Actual auction bids acquire it; never
 * move cards from other hands/discards or manufacture a held support card. */
export function orderDiscoveryPairedNexusE2SkillsCard(game: Game, matches: (c: Card) => boolean, staging: string[]): Card {
  const index = game.deck.findIndex(matches); assert.ok(index >= 0, 'The requested original card must still be undealt.');
  const card = game.deck.splice(index, 1)[0]; game.deck.unshift(card);
  staging.push(`Conserved original undealt ${card.id} at the next ordinary auction front; no held-card injection.`);
  return card;
}
/** Preserve first hands. Buy only still-undealt requested cards through native
 * Bidding; a genuine existing Karama holder remains the eligible responder. */
function prepareOrdinaryAcquisitions(game: Game, choam: string, fremen: string, staging: string[]): Map<string, string> {
  const buys = new Map<string, string>();
  if (!pairedSkillsPlayer(game, choam).hand.some(c => c.name === 'Kulon' && c.kind === 'worthless')) {
    const card = game.deck.find(c => c.name === 'Kulon' && c.kind === 'worthless');
    if (card) buys.set(orderDiscoveryPairedNexusE2SkillsCard(game, c => c.id === card.id, staging).id, choam);
  }
  if (!pairedSkillsPlayer(game, choam).hand.some(c => c.kind === 'special' && c.effect !== 'karama')) {
    const card = game.deck.find(c => c.kind === 'special' && c.effect !== 'karama');
    assert.ok(card);
    buys.set(orderDiscoveryPairedNexusE2SkillsCard(game, c => c.id === card.id, staging).id, choam);
  }
  if (!game.players.some(p => p.faction !== 'richese' && p.hand.some(c => c.effect === 'karama'))) {
    const card = orderDiscoveryPairedNexusE2SkillsCard(game, c => c.effect === 'karama', staging);
    buys.set(card.id, fremen);
  }
  return buys;
}
function advanceWithAcquisitions(game: Game, until: (g: Game) => boolean, buys: Map<string, string>,
  actions: DiscoveryPairedNexusE2SkillsStep[], acquisitions: DiscoveryPairedNexusE2SkillsAcquisition[]): Game {
  for (let n = 0; n < 2400; n++) {
    if (until(game)) {
      assert.equal(buys.size, 0, 'Every ordered original lot must have been bought by its intended eligible actor.');
      return game;
    }
    let step = nextDiscoveryPairedNexusE2SkillsStep(game); assert.ok(step);
    const auction = game.auction, card = auction?.cards[auction.index];
    const buyer = card && !game.currentAuctionSale ? buys.get(card.id) : undefined;
    // The original no-spend producer emits passBid, not bid. Only the intended
    // buyer raises; all other eligible actors use the native passBid action.
    if (buyer && auction && (step.action.type === 'bid' || step.action.type === 'passBid'))
      step = { actor: auction.active, action: auction.active === buyer && auction.bidder !== buyer
        ? { type: 'bid', amount: auction.bid + 1 } : { type: 'passBid' } };
    const before = game;
    game = stepDiscoveryPairedNexusE2Skills(game, step, actions);
    if (buyer && card && pairedSkillsPlayer(game, buyer).hand.some(c => c.id === card.id)) {
      assert.equal(auction!.bidder, buyer);
      assert.equal(auction!.bid, 1);
      assert.equal(pairedSkillsPlayer(game, buyer).spice, pairedSkillsPlayer(before, buyer).spice - 1);
      acquisitions.push({ before: structuredClone(before), step: structuredClone(step),
        after: structuredClone(game), buyer, card: structuredClone(card) });
      buys.delete(card.id);
    }
  }
  throw Error('Original card acquisition did not reach its boundary.');
}

/** Skill-first original start → zero-marker invoice/reveal → real paid typed
 * collection → inspect/reveal. Stops before Stash disposal or next-turn entry.
 * Board controls are labeled conserved positions, never claimed played history. */
export function createDiscoveryPairedNexusE2SkillsFixture(options: DiscoveryPairedNexusE2SkillsOptions = {}): DiscoveryPairedNexusE2SkillsFixture {
  let game = initializeDiscoveryPairedNexusE2Skills(options);
  const initial = structuredClone(game), actions: DiscoveryPairedNexusE2SkillsStep[] = [], staging: string[] = [
    'Fresh offers use the existing original all14 shuffle control; saved offers and first hands are authoritative. Later original scalar lotteries use the existing paired Discovery scheduler.',
  ];
  const acquisitions: DiscoveryPairedNexusE2SkillsAcquisition[] = [];
  game = completeDiscoveryPairedNexusE2SkillsSetup(game, options, actions);
  const afterSetup = structuredClone(game);
  const seat = (faction: string) => { const p = game.players.find(p => p.faction === faction); assert.ok(p); return p.id; };
  const richese = seat('richese'), choam = seat('choam'), guild = seat('guild'), fremen = seat('fremen');
  const face: DiscoveryTokenFace = options.kind === 'stash' ? 'treachery-card-stash' : 'shrine';
  const printed = face === 'shrine' ? 'discovery-hagga-basin' : 'discovery-wind-pass-north';
  const placement = DISCOVERY_CARD_PLACEMENTS[printed], source = `${placement.territory}:${placement.sector}`;
  const collector = face === 'shrine' ? guild : choam;
  const buys = prepareOrdinaryAcquisitions(game, choam, fremen, staging);
  orderSpice(game, printed, staging);
  game = advanceDiscoveryPairedNexusE2Skills(game, g => g.phase === 1 && pairedSkillsClean(g), actions);
  const afterFirstStorm = structuredClone(game);
  for (let n = 0; !game.discoveries!.tokens.some(t => t.face === face && t.status === 'placed') && n < 100; n++) {
    const step = nextDiscoveryPairedNexusE2SkillsStep(game); assert.ok(step);
    actions.push(structuredClone(step));
    // Bypass the generic scalar wrapper for this exact native placement lottery.
    game = withToken(game, face, () => applyAction(game, step.actor, step.action));
  }
  assert.ok(game.discoveries!.tokens.some(t => t.face === face && t.status === 'placed'));
  game = advanceWithAcquisitions(game, g => g.phase === 5 && pairedSkillsClean(g), buys, actions, acquisitions);
  let previousMarker: DiscoveryPairedNexusE2SkillsTransition | undefined;
  let collectedShipment = false;
  for (let n = 0; (!previousMarker || !collectedShipment) && n < 200; n++) {
    assert.equal(game.turn, 1, 'Do not chase an already-passed original shipment seat into another turn.');
    assert.equal(game.phase, 5);
    if (pairedSkillsClean(game) && game.active === richese && !previousMarker) {
      const before = structuredClone(game), p = pairedSkillsPlayer(game, richese);
      const step: DiscoveryPairedNexusE2SkillsStep = { actor: richese, action: { type: 'ship',
        territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0],
        noField: p.noField!.tokens.find(t => t.value === 0)!.id, event: p.noFieldEvent, allyPayment: 0 } };
      game = settleDiscoveryPairedNexusE2Skills(stepDiscoveryPairedNexusE2Skills(game, step, actions), actions);
      previousMarker = { before, step, after: structuredClone(game) };
      game = revealPairedSkillsRichese(game, richese, actions);
    } else if (pairedSkillsClean(game) && game.active === collector && !collectedShipment) {
      game = stepDiscoveryPairedNexusE2Skills(game, { actor: collector, action: { type: 'ship',
        territory: placement.territory, sector: placement.sector, amount: 3, elite: 0, allyPayment: 0 } }, actions);
      game = settleDiscoveryPairedNexusE2Skills(game, actions);
      collectedShipment = true;
    } else {
      const step = nextDiscoveryPairedNexusE2SkillsStep(game); assert.ok(step);
      game = stepDiscoveryPairedNexusE2Skills(game, step, actions);
    }
  }
  assert.ok(previousMarker && collectedShipment);
  game = advanceDiscoveryPairedNexusE2Skills(game, g => g.phase === 7 && pairedSkillsClean(g), actions);
  const collection = structuredClone(game), token = game.discoveries!.tokens.find(t => t.face === face)!;
  assert.ok(viewGame(game, collector).discoveries!.canInspect.includes(token.id));
  game = stepDiscoveryPairedNexusE2Skills(game, { actor: collector, action: { type: 'discovery', token: token.id, reveal: false } }, actions);
  game = stepDiscoveryPairedNexusE2Skills(game, { actor: collector, action: { type: 'discovery', token: token.id, reveal: true } }, actions);
  const trainers = { richese: game.leaderSkills!.assignments.find(a => a.owner === richese)!.leader,
    choam: game.leaderSkills!.assignments.find(a => a.owner === choam)!.leader };
  // The Stash branch returns the actual disposal endpoint without auto-discard.
  if (face === 'treachery-card-stash') return { initial, afterSetup, afterFirstStorm, collection, previousMarker,
    firstMentat: null, game, richese, choam, guild, fremen, collector, token: token.id, face, source, trainers, actions, staging, acquisitions };
  game = advanceDiscoveryPairedNexusE2Skills(game, g => g.phase === 8 && pairedSkillsClean(g), actions);
  reservePairedDiscoveryNexusBoard(game, [source]);
  placePairedSkillsForce(game, choam, 'hagga_basin:12', 2, staging);
  placePairedSkillsForce(game, options.arrakeenOwner === 'richese' ? richese : choam, `arrakeen:${territory('arrakeen').sectors[0]}`, 1, staging);
  staging.push('Before actual END Mentat conserve unrelated original board groups to their native reserves; retain the paid parent group and stage CHOAM worm-source/Arrakeen counters. No custody, training or earned invoice is assigned.');
  let firstMentat: DiscoveryPairedNexusE2SkillsTransition | undefined;
  while (game.turn === 1) {
    const mentatBefore = structuredClone(game), mentatStep = nextDiscoveryPairedNexusE2SkillsStep(game); assert.ok(mentatStep);
    game = stepDiscoveryPairedNexusE2Skills(game, mentatStep, actions);
    if (game.turn === 2) firstMentat = { before: mentatBefore, step: mentatStep, after: structuredClone(game) };
  }
  assert.ok(firstMentat);
  game = advanceDiscoveryPairedNexusE2Skills(game, g => g.decision?.kind === 'discoveryEntry', actions);
  assert.equal(game.phase, 0); assert.equal(game.decision!.player, collector);
  return { initial, afterSetup, afterFirstStorm, collection, previousMarker, firstMentat, game,
    richese, choam, guild, fremen, collector, token: token.id, face, source, trainers, actions, staging, acquisitions };
}

/** Complete actual end-Mentat free entry, Maker loss/vote/Fremen typed reserve
 * ride, both Advanced Spice piles, reciprocal alliance and closing all12 draws. */
export function closeDiscoveryPairedNexusE2Skills(f: DiscoveryPairedNexusE2SkillsFixture): DiscoveryPairedNexusE2SkillsClosing {
  assert.equal(f.face, 'shrine');
  const before = structuredClone(f.game), offer = viewGame(before, f.collector).discoveryEntry!;
  const action = discoveryEntryMoveAction(viewGame(before, f.collector), offer.sources); assert.ok(action);
  const step = { actor: f.collector, action };
  let game = stepDiscoveryPairedNexusE2Skills(before, step, f.actions);
  const entry = { before, step, after: structuredClone(game) };
  game = advanceDiscoveryPairedNexusE2Skills(game, g => g.greatMaker?.stage === 'vote', f.actions);
  const vote = structuredClone(game);
  while (game.decision?.kind === 'greatMakerVote') game = stepDiscoveryPairedNexusE2Skills(game,
    { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, yes: true } }, f.actions);
  assert.equal(game.decision?.kind, 'greatMakerRide'); assert.equal(game.decision!.player, f.fremen);
  const rideBefore = structuredClone(game), rideAction = greatMakerRideAction(viewGame(game, f.fremen), 'polar_sink', 0, 2, game.advanced ? 1 : 0);
  assert.ok(rideAction);
  const rideStep = { actor: f.fremen, action: rideAction };
  game = stepDiscoveryPairedNexusE2Skills(game, rideStep, f.actions);
  const ride = { before: rideBefore, step: rideStep, after: structuredClone(game) };
  game = advanceDiscoveryPairedNexusE2Skills(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && pairedSkillsClean(g), f.actions);
  game = stepDiscoveryPairedNexusE2Skills(game, { actor: f.guild, action: { type: 'alliance', target: f.fremen } }, f.actions);
  game = stepDiscoveryPairedNexusE2Skills(game, { actor: f.fremen, action: { type: 'alliance', target: f.guild } }, f.actions);
  const alliance = structuredClone(game);
  game = advanceDiscoveryPairedNexusE2Skills(game, g => g.nexusCards?.phase?.stage === 'drawing' && pairedSkillsClean(g), f.actions);
  const cards = game.nexusCards!.cards!;
  for (const face of ['richese', 'choam'] as const) assert.ok(cards.deck.includes(face));
  cards.deck = ['richese', 'choam', ...cards.deck.filter(c => c !== 'richese' && c !== 'choam')];
  f.staging.push('Conserved original unused all12 Richese/CHOAM order before actual qualified end-Spice draws; not a held-card grant.');
  const drawing = structuredClone(game), draws: DiscoveryPairedNexusE2SkillsTransition[] = [];
  for (const actor of [f.richese, f.choam]) {
    const drawBefore = structuredClone(game), drawStep: DiscoveryPairedNexusE2SkillsStep = { actor,
      action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
    game = stepDiscoveryPairedNexusE2Skills(game, drawStep, f.actions);
    draws.push({ before: drawBefore, step: drawStep, after: structuredClone(game) });
  }
  game = advanceDiscoveryPairedNexusE2Skills(game, g => g.phase === 5 && pairedSkillsClean(g), f.actions);
  const choam = pairedSkillsPlayer(game, f.choam), claim = `arrakeen:${territory('arrakeen').sectors[0]}`;
  if (choam.forces[claim]) {
    choam.reserves += choam.forces[claim]; delete choam.forces[claim];
    f.staging.push('Conserve the original CHOAM Arrakeen claim counter to native reserves before Movement; its actually held Stronghold Card persists until real END Mentat. This does not claim movement history or add Ornithopter/Kulon mixed entitlement.');
  }
  const movementStart = structuredClone(game);
  game = advanceDiscoveryPairedNexusE2Skills(game, g => g.phase === 5 && g.active === f.richese && pairedSkillsClean(g), f.actions);
  return { entry, vote, ride, alliance, drawing, draws, movementStart, game };
}
export function discoveryPairedNexusE2SkillsCunningAction(game: Game, richese: string, destination = 'shrine'): Action {
  const p = pairedSkillsPlayer(game, richese), offer = viewGame(game, richese).nexusRicheseCunning;
  assert.ok(offer && !offer.blocked);
  return { type: 'ship', territory: destination, sector: destination === 'shrine' ? 0 : territory(destination).sectors[0],
    noField: p.noField!.tokens.find(t => t.value === 3)!.id, revealedToken: p.noField!.tokens.find(t => t.value === 5)!.id,
    event: p.noFieldEvent, nexus: offer.event, allyPayment: 0 };
}
/** Keep face-up pair counters separate from the marker until actual voluntary
 * reveal; mixed marker/ordinary battle dial remains a source guard. */
export function prepareDiscoveryPairedNexusE2SkillsBattle(f: DiscoveryPairedNexusE2SkillsFixture, shipped: Game,
  trained = true): DiscoveryPairedNexusE2SkillsBattle {
  const deployed = pairedSkillsPlayer(shipped, f.richese).noField!.deployed; assert.ok(deployed);
  const destination = deployed.location.territory, key = `${destination}:${deployed.location.sector}`;
  let game = revealPairedSkillsRichese(shipped, f.richese, f.actions);
  assert.equal(pairedSkillsPlayer(game, f.richese).noField!.deployed, null);
  if (destination !== 'shrine') placePairedSkillsForce(game, f.guild, key, 3, f.staging);
  // The actual Guild free-entry group supplies opposing nested counters.
  game = openPairedSkillsBattle(game, f.richese, f.guild, { territory: destination, band: trained ? 'skilled' : 'normal', actions: f.actions });
  return { game, key, plans: pairedSkillsBattlePlans(game, f.richese, f.guild, 2, trained) };
}
export function finishDiscoveryPairedNexusE2SkillsBattle(game: Game, actions?: DiscoveryPairedNexusE2SkillsStep[]): Game {
  return advanceDiscoveryPairedNexusE2Skills(game, g => !g.battle && pairedSkillsClean(g) && !g.pendingTreacheryDiscard, actions);
}
export function discoveryPairedNexusE2SkillsInvoiceAction(game: Game): { action: Action; key: string } {
  const target = TERRITORIES.find(t => t.type === 'stronghold' && !t.sectors.includes(game.storm) &&
    game.players.every(p => Object.entries(p.forces).every(([key, n]) => !n || !key.startsWith(`${t.id}:`))));
  assert.ok(target);
  return { action: { type: 'ship', territory: target.id, sector: target.sectors[0], amount: 6, elite: 0, allyPayment: 0, smuggler: true },
    key: `${target.id}:${target.sectors[0]}` };
}
/** Actual holder, not a generic first actor. The receipt caller can stop on its
 * signed native response and let each minimal policy pass/cancel a real card. */
export function discoveryPairedNexusE2SkillsKaramaHolder(game: Game, exclude?: string): Player {
  const holder = game.players.find(p => p.id !== exclude && p.hand.some(c => c.effect === 'karama'));
  assert.ok(holder, 'Acquire an actual original Karama through setup or Bidding.');
  return holder;
}
