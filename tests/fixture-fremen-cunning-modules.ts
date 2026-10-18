import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { territory } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import { sandmasterCunningCollection } from '../game/sandmaster-worm';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { skillOfferRolls } from './fixture-independent-card-modules';
import { nextPairedChoamSkillsStep } from './fixture-paired-choam-nexus-skills';

export type FremenCunningModulesStep = { actor: string; action: Action };
export type FremenCunningModulesOptions = {
  advanced?: boolean;
  expansions?: Game['expansions'];
  factions?: readonly FactionId[];
  skills?: boolean;
  homeworlds?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  hmsAtSource?: boolean;
};
export const fremenCunningModulesPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const fremenCunningModulesClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingGuildBetrayal &&
  !game.pendingNexusIxianReplacement && !game.pendingNexusIxianBetrayal && !game.pendingNexusHarkonnenBetrayal;

/** Scope the real undealt skill lottery; all remaining scalar shuffles retain
 * their original order. UUIDs and all other random byte arrays stay native. */
function originalLottery<T>(rolls: readonly number[], operation: () => T): T {
  const native = crypto.getRandomValues.bind(crypto), descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actFremenCunningModules(game: Game, actor: string, action: Action, actions?: FremenCunningModulesStep[]): Game {
  actions?.push({ actor, action: structuredClone(action) });
  return originalLottery([], () => applyAction(game, actor, action));
}
/** Original no-spend/no-movement progression stops at owned Terror, Ambassador
 * and the remote ride. The real first empty appearance has no held Fremen card
 * and is declined; no private Nexus entitlement is manufactured for it. */
export function nextFremenCunningModulesStep(game: Game): FremenCunningModulesStep | null {
  if (game.pendingGuildBetrayal) {
    const frame = game.pendingGuildBetrayal, actor = frame.required.find(actor => !frame.passed.includes(actor)); assert.ok(actor);
    return { actor, action: { type: 'guildBetrayalPass', event: frame.invoice.event } };
  }
  if (game.pendingNexusIxianReplacement) return { actor: game.pendingNexusIxianReplacement.buyer,
    action: { type: 'nexusIxianReplacementPass', event: game.pendingNexusIxianReplacement.event } };
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'nexusFremenCunningRide' || decision?.kind === 'moritaniTerror' || decision?.kind === 'ecazAmbassador') return null;
    if (decision?.kind === 'nexusFremenCunningOffer') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, accept: false } };
    if (decision?.kind === 'homeworldShipmentGuild') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, allow: true } };
    if (decision?.kind === 'homeworldDefense') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, use: false } };
    if (decision?.kind === 'moritaniPlacement' || decision?.kind === 'ecazPlacement' ||
        decision?.kind === 'homeworldRevivalDeployment' || decision?.kind === 'caladanReinforcement' || decision?.kind === 'grummanCollection')
      return { actor: decision.player, action: { type: 'decision', event: 'event' in decision ? decision.event : undefined, decline: true } };
    if (decision?.kind === 'guildTiming') return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision?.kind === 'wormRide' || decision?.kind === 'wormPlacement' || decision?.kind === 'advisor' ||
        decision?.kind === 'intrusion' || decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'leaderSkillVisibility') return { actor: decision.player,
      action: { type: 'leaderSkillVisibility', event: decision.event, hide: false } };
    if (decision?.kind === 'mentatQuestion') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'moritaniSetup') return { actor: decision.player,
      action: { type: 'decision', territory: 'pasty_mesa', sector: 5 } };
  }
  return nextPairedChoamSkillsStep(game);
}
export function advanceFremenCunningModules(game: Game, until: (state: Game) => boolean,
  actions: FremenCunningModulesStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Fremen Cunning chronology ended early');
    const next = nextFremenCunningModulesStep(game);
    assert.ok(next, `Choose the original ${game.decision?.kind ?? 'Battle Plan'} at ${game.turn}/${game.phase}`);
    game = actFremenCunningModules(game, next.actor, next.action, actions);
  }
  throw Error('The genuine Fremen Cunning chronology did not reach its boundary');
}

/** Move original unopened physical Spice Cards only. Never assign a discard
 * target, board pile, appearance identity or historical worm record. */
function orderOriginalSpice(game: Game, entries: readonly string[]): void {
  const front: Game['spiceDeck'] = [];
  for (const entry of entries) {
    const index = game.spiceDeck.findIndex(card => entry === 'worm'
      ? 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper
      : 'territory' in card && card.territory === entry && !card.discovery);
    assert.ok(index >= 0, `Use original unopened Spice Card ${entry}`);
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}
const quietTraining: Partial<Record<FactionId, LeaderSkillId>> = {
  fremen: 'sandmaster', guild: 'killer-medic', emperor: 'master-of-assassins',
  ixians: 'prana-bindu-adept', choam: 'swordmaster-of-ginaz', ecaz: 'warmaster',
};

/** Ordinary host module selections and private setup choices. The all14 case
 * chooses a genuinely offered Sandmaster and eligible living Fremen trainer.
 * Only unopened lotteries are ordered; no post-deal inventory is replaced. */
export function createFremenCunningModulesFixture(options: FremenCunningModulesOptions = {}) {
  const factions = options.factions ?? ['fremen', 'guild', 'emperor'];
  assert.equal(factions[0], 'fremen');
  assert.ok(factions.includes('guild') && factions.includes('emperor'));
  let game = createGame('FREMENCUNNINGMODULES', newPlayer('fremen', 'Fremen', 'fremen'),
    options.advanced ?? false, options.expansions ?? ['ecaz']);
  for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: FremenCunningModulesStep[] = [], staging: string[] = [];
  const act = (actor: string, action: Action) => { game = actFremenCunningModules(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceFremenCunningModules(game, until, actions); };
  for (const selection of ['ecazTreachery', 'nexusCards', ...(options.skills ? ['leaderSkills'] : [])])
    act(game.host, { type: 'moduleOption', module: selection, enabled: true });
  for (const [type, enabled] of [['homeworlds', options.homeworlds], ['techTokens', options.tech], ['strongholdCards', options.strongholds]] as const)
    if (enabled) act(game.host, { type, enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game), start: FremenCunningModulesStep = { actor: game.host,
    action: game.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' } };
  actions.push(structuredClone(start));
  game = originalLottery(options.skills ? skillOfferRolls(game, quietTraining) : [], () => applyAction(game, start.actor, start.action));
  const offered = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 300; count++) {
    if (game.setupStage === 'leaderSkills' && !game.decision) {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const wanted = quietTraining[fremenCunningModulesPlayer(game, actor).faction];
      const skill = wanted && own.offer!.cards.includes(wanted) ? wanted : own.offer!.cards.find(card => !own.unavailableSkills?.[card]);
      const leader = own.eligibleLeaders[0];
      assert.ok(skill && !own.unavailableSkills?.[skill] && leader);
      act(actor, { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id });
      continue;
    }
    if (game.setupStage === 'forces' && fremenCunningModulesPlayer(game, 'fremen').reserves === 20) {
      act('fremen', { type: 'fremenSetup', placements: { [`sietch_tabr:${territory('sietch_tabr').sectors[0]}`]: 10 } });
      continue;
    }
    const next = nextFremenCunningModulesStep(game); assert.ok(next); act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const trainer = game.leaderSkills?.assignments.find(assignment => assignment.owner === 'fremen' && assignment.skill === 'sandmaster')?.leader ?? null;
  assert.ok(!options.skills || trainer);
  orderOriginalSpice(game, game.advanced ? ['broken_land', 'rock_outcroppings'] : ['broken_land']);
  const counterIndex = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(counterIndex >= 0);
  const counterCard = game.deck[counterIndex].id;
  game.deck.unshift(game.deck.splice(counterIndex, 1)[0]);
  let counterBid: { before: Game; step: FremenCunningModulesStep } | null = null;
  let hmsPlacement: { before: Game; step: FremenCunningModulesStep; after: Game } | null = null;
  for (let count = 0; count < 700; count++) {
    if (fremenCunningModulesPlayer(game, 'guild').hand.some(card => card.id === counterCard)) break;
    let next: FremenCunningModulesStep | null;
    if (options.hmsAtSource && !game.response && !game.phaseOpening &&
        game.decision?.kind === 'mobileStronghold' && game.decision.placement) {
      const before = structuredClone(game), step: FremenCunningModulesStep = {
        actor: game.decision.player, action: { type: 'decision', location: 'wind_pass:14' } };
      act(step.actor, step.action);
      hmsPlacement = { before, step, after: structuredClone(game) };
      continue;
    }
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'ixAuction' &&
        game.ixAuction?.cards.some(card => card.id === counterCard)) {
      const returned = game.ixAuction.cards.find(card => card.id !== counterCard); assert.ok(returned);
      act(game.decision.player, { type: 'decision', card: returned.id, position: 'bottom' });
      continue;
    }
    if (fremenCunningModulesClean(game) && game.auction?.cards[game.auction.index]?.id === counterCard) {
      next = { actor: game.auction.active, action: game.auction.active === 'guild' && game.auction.bidder !== 'guild'
        ? { type: 'bid', amount: 1, allyPayment: 0 } : { type: 'passBid' } };
      if (next.action.type === 'bid') counterBid = { before: structuredClone(game), step: structuredClone(next) };
    } else next = nextFremenCunningModulesStep(game);
    assert.ok(next, 'The original paid Karama must pass through its native bank auction');
    act(next.actor, next.action);
  }
  assert.ok(counterBid && fremenCunningModulesPlayer(game, 'guild').hand.some(card => card.id === counterCard));
  assert.ok(!options.hmsAtSource || hmsPlacement);
  const counterPurchase = { ...counterBid, after: structuredClone(game) };
  reach(state => state.turn === 1 && state.phase === 5 && state.active === 'fremen' && fremenCunningModulesClean(state));
  const elite = game.advanced ? 2 : 0, homeworldSources = game.homeworlds ? nativeShipmentSources(viewGame(game, 'fremen'), 3, elite) : undefined;
  assert.ok(!game.homeworlds || homeworldSources);
  const shipmentBefore = structuredClone(game), shipmentStep: FremenCunningModulesStep = { actor: 'fremen', action: {
    type: 'ship', territory: 'wind_pass', sector: 14, amount: 3, elite, allyPayment: 0,
    ...(homeworldSources ? { homeworldSources } : {}) } };
  act(shipmentStep.actor, shipmentStep.action); reach(fremenCunningModulesClean);
  const shipmentAfter = structuredClone(game);
  assert.equal(fremenCunningModulesPlayer(game, 'fremen').forces['wind_pass:14'], 3);
  reach(state => state.turn === 2 && state.phase === 1 && fremenCunningModulesClean(state));
  orderOriginalSpice(game, game.advanced ? ['worm', 'red_chasm', 'south_mesa'] : ['worm', 'red_chasm']);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && fremenCunningModulesClean(state));
  const beforeAlliance = structuredClone(game);
  act('guild', { type: 'alliance', target: 'emperor' });
  act('emperor', { type: 'alliance', target: 'guild' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && fremenCunningModulesClean(state));
  const deck = game.nexusCards!.cards!.deck, index = deck.indexOf('fremen'); assert.ok(index >= 0);
  deck.unshift(deck.splice(index, 1)[0]);
  const drawBefore = structuredClone(game), drawStep: FremenCunningModulesStep = { actor: 'fremen', action: {
    type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
  act(drawStep.actor, drawStep.action);
  const drawAfter = structuredClone(game);
  reach(state => state.turn === 3 && state.phase === 1 && fremenCunningModulesClean(state));
  orderOriginalSpice(game, game.advanced ? ['worm', 'hagga_basin', 'habbanya_erg'] : ['worm', 'hagga_basin']);
  let beforeWorm = structuredClone(game), producer: FremenCunningModulesStep | null = null;
  for (let count = 0; count < 150; count++) {
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'nexusFremenCunningOffer') break;
    beforeWorm = structuredClone(game); producer = nextFremenCunningModulesStep(game); assert.ok(producer);
    act(producer.actor, producer.action);
  }
  assert.ok(producer && game.decision?.kind === 'nexusFremenCunningOffer' && game.nexusFremenCunningOffer);
  assert.equal(game.nexusFremenCunningOffer.occurrence.territory, 'red_chasm');
  staging.push('Original host/module/setup actions, undealt skill and scalar shuffles, actual one-spice Guild Karama purchase, native free typed Fremen reinforcement, real empty worm and Guild/Emperor alliance, actual own Fremen closing draw, then a distinct real empty worm before devouring. Only unopened physical Treachery, Spice and Nexus order is selected.');
  return { initial, lobby, offered, afterSetup, game, actions, staging, owner: 'fremen', trainer,
    source: 'wind_pass', sourceKey: 'wind_pass:14', destination: 'hagga_basin', destinationSector: 12,
    shipment: { before: shipmentBefore, step: shipmentStep, after: shipmentAfter },
    counterCard, counterPurchase, hmsPlacement,
    beforeAlliance, draw: { before: drawBefore, step: drawStep, after: drawAfter },
    beforeWorm, producer, occurrence: structuredClone(game.nexusFremenCunningOffer.occurrence) };
}
export type FremenCunningModulesFixture = ReturnType<typeof createFremenCunningModulesFixture>;

/** Actual spend/response/devouring/Nexus/remote selection, then its native
 * arrival continuation. Optional collection debits only the newly earned
 * replacement-Blow destination pile before any arrival reaction. */
export function completeFremenCunningModules(fixture: FremenCunningModulesFixture,
  options: { collect?: boolean; pile?: string; destination?: { territory: string; sector: number } } = {}) {
  const actions = fixture.actions, owner = fixture.owner, event = fixture.occurrence.event;
  let game = fixture.game;
  const beforeSpend = structuredClone(game), spend: FremenCunningModulesStep = { actor: owner,
    action: { type: 'decision', event, accept: true } };
  game = actFremenCunningModules(game, owner, spend.action, actions);
  const spentResponse = structuredClone(game);
  game = advanceFremenCunningModules(game, state => !state.response && !state.phaseOpening && state.decision?.kind === 'nexusFremenCunningRide', actions);
  const beforeRide = structuredClone(game), player = fremenCunningModulesPlayer(game, owner);
  const total = player.forces[fixture.sourceKey], elite = player.elites?.forces[fixture.sourceKey] ?? 0;
  assert.equal(total, 3);
  const destination = options.destination ?? { territory: fixture.destination, sector: fixture.destinationSector };
  const collection = options.collect ? sandmasterCunningCollection(game, owner, fixture.source,
    destination.territory, destination.sector, options.pile) : null;
  if (options.collect) assert.ok(collection && !collection.blocked && collection.key);
  const ride: FremenCunningModulesStep = { actor: owner, action: { type: 'decision', event, accept: true,
    source: fixture.source, forces: { [fixture.sourceKey]: { normal: total - elite, elite } },
    territory: destination.territory, sector: destination.sector,
    ...(options.collect !== undefined ? { sandmasterCollect: options.collect } : {}),
    ...(options.collect ? { sandmasterPile: collection!.key! } : {}) } };
  game = actFremenCunningModules(game, owner, ride.action, actions);
  const afterRide = structuredClone(game);
  game = advanceFremenCunningModules(game, fremenCunningModulesClean, actions);
  return { game, actions, beforeSpend, spend, spentResponse, beforeRide, ride, afterRide, collection };
}
