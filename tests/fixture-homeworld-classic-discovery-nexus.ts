import assert from 'node:assert/strict';
import { applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { location, territory } from '../game/board';
import { SPICE_CARDS } from '../game/cards';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_SPICE_CARDS } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import { classicNexusModulesProfile } from '../game/nexus-module-profile';
import { reserveShipmentCost } from '../game/shipment-price';
import { nexusInventory } from './fixture-nexus-cards';
import { classicDiscoveryNexusClean, classicDiscoveryNexusPlayer, nextClassicDiscoveryNexusStep,
  withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken,
  type ClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export type HomeworldClassicDiscoveryNexusStep = ClassicDiscoveryNexusStep;
export type HomeworldClassicDiscoveryNexusOptions = {
  /** Original fresh lobby or its undealt native setup; never a played save. */
  initial?: Game;
  gameId?: string;
  seatIds?: string[];
  seats?: 2 | 3 | 4 | 5 | 6;
  advanced?: boolean;
  /** Original Discovery Spice Cards/tokens/Great Maker. Off keeps the plain Nexus deck. */
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  /** An actual original Shai-Hulud immediately before the Great Maker, not a Nexus flag write. */
  ordinaryWormFirst?: boolean;
};
export type HomeworldClassicDiscoveryNexusShipment = {
  actor: string; amount: number; elite: number; cost: number;
  territory: string; sector: number; homeworldSources: NativeReserveSelections;
};
export type HomeworldClassicDiscoveryNexusMentat = {
  before: Game; step: HomeworldClassicDiscoveryNexusStep; after: Game;
};
export type HomeworldClassicDiscoveryNexusFixture = {
  initial: Game; setup: Game; afterSetup: Game; firstStorm: Game; afterBlow: Game;
  beforeShipment: Game; afterShipments: Game; collection: Game;
  firstMentat: HomeworldClassicDiscoveryNexusMentat; game: Game;
  collector: string; victim: string; fremen: string | null; token: string | null;
  parent: string; parentSector: number; blowKey: string; blowAmount: number;
  wormTerritory: string; wormSource: string; amount: number; elite: number;
  shipments: HomeworldClassicDiscoveryNexusShipment[];
  actions: HomeworldClassicDiscoveryNexusStep[]; staging: string[];
};
export const homeworldClassicDiscoveryNexusClean = classicDiscoveryNexusClean;
export const homeworldClassicDiscoveryNexusPlayer = classicDiscoveryNexusPlayer;

/** Preserve the army under both original Guild interception producers; the
 * original Discovery/Nexus native owner policy keeps every other decision. */
export function nextHomeworldClassicDiscoveryNexusStep(game: Game): HomeworldClassicDiscoveryNexusStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard &&
    (game.decision?.kind === 'guildShipment' || game.decision?.kind === 'homeworldShipmentGuild'))
    return { actor: game.decision.player, action: { type: 'decision', allow: true,
      ...(game.decision.kind === 'homeworldShipmentGuild' ? { event: game.decision.event } : {}) } };
  return nextClassicDiscoveryNexusStep(game);
}
export function applyHomeworldClassicDiscoveryNexusStep(game: Game, step: HomeworldClassicDiscoveryNexusStep,
  actions?: HomeworldClassicDiscoveryNexusStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(game, step.actor, step.action));
}
export function advanceHomeworldClassicDiscoveryNexus(game: Game, until: (game: Game) => boolean,
  actions?: HomeworldClassicDiscoveryNexusStep[]): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original lifecycle ended before its owned boundary.');
    const step = nextHomeworldClassicDiscoveryNexusStep(game);
    assert.ok(step, 'The original continuation requires a human sealed Battle Plan.');
    game = applyHomeworldClassicDiscoveryNexusStep(game, step, actions);
  }
  throw new Error('The original Homeworld/Nexus lifecycle did not reach its owned boundary.');
}
/** Physical conservation of cards, ordinary counters, encountered frames and spice. */
export function homeworldClassicDiscoveryNexusInventory(game: Game): void {
  homeworldGameIntegrity(game);
  nexusInventory(game);
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat(),
    ...(game.spiceResolution?.skipped ?? []), ...(game.spiceSequence?.skipped ?? [])];
  if (game.discoveries) {
    assert.equal(spice.length, 28);
    assert.equal(spice.filter(card => 'territory' in card && !!card.discovery).length, 6);
    assert.equal(spice.filter(card => 'worm' in card && !!card.greatMaker).length, 1);
    assert.equal(game.discoveries.tokens.length, 8);
  } else {
    assert.equal(spice.length, 21);
    assert.ok(spice.every(card => !('territory' in card) || !card.discovery));
  }
  assert.ok(!(game.discoveryEntry && game.nexusCards!.phase?.stage === 'drawing'));
  assert.ok(!(game.greatMaker?.stage === 'vote' && game.nexusCards!.phase?.stage === 'drawing'));
}
type SpicePlan = {
  blow: { territory: string; sector: number; amount: number; discovery: string | null };
  parent: { territory: string; sector: number };
  spare: readonly { territory: string; sector: number }[];
};
/** First three conserved original spare land blows, clear of the storm and of
 * the printed blow/parent territories, so no spare doubles a harvest site. */
function originalSpareBlows(blow: string, parent: string, storm: number): { territory: string; sector: number }[] {
  return SPICE_CARDS
    .filter(([id, , sector]) => id !== blow && id !== parent && sector !== storm)
    .slice(0, 3)
    .map(([id, , sector]) => ({ territory: id, sector }));
}
/** Conserve the original physical blow/spare positions while keeping both
 * printed sectors clear of the actual storm, so the real blow and its harvest
 * are observable rather than storm-lost. */
function planOriginalSpice(game: Game, discovery: boolean): SpicePlan {
  const storm = game.storm;
  if (discovery) {
    const card = DISCOVERY_SPICE_CARDS.find(candidate =>
      DISCOVERY_CARD_PLACEMENTS[candidate.discovery].sector !== storm && candidate.sector !== storm);
    assert.ok(card, 'An original undealt Discovery blow must keep its printed sector out of the storm.');
    const placement = DISCOVERY_CARD_PLACEMENTS[card.discovery];
    return { blow: { territory: card.territory, sector: card.sector, amount: card.amount,
      discovery: card.discovery },
    parent: { territory: placement.territory, sector: placement.sector },
    spare: originalSpareBlows(card.territory, placement.territory, storm) };
  }
  const blow = SPICE_CARDS.find(([, , sector]) => sector !== storm);
  assert.ok(blow, 'An original undealt plain blow must keep its printed sector out of the storm.');
  const parent = SPICE_CARDS.find(([id, , sector]) => id !== blow[0] && sector !== storm);
  assert.ok(parent);
  return { blow: { territory: blow[0], sector: blow[2], amount: blow[1], discovery: null },
    parent: { territory: parent[0], sector: parent[2] },
    spare: originalSpareBlows(blow[0], parent[0], storm) };
}
function orderOriginalSpice(game: Game, plan: SpicePlan, options: HomeworldClassicDiscoveryNexusOptions): void {
  const discovery = !!game.discoveryEnabled;
  const take = (choose: (card: Game['spiceDeck'][number]) => boolean) => {
    const index = game.spiceDeck.findIndex(choose);
    assert.ok(index >= 0, 'Each selected physical Spice Card must remain undealt.');
    return game.spiceDeck.splice(index, 1)[0];
  };
  const plain = (id: string) => (card: Game['spiceDeck'][number]) =>
    'territory' in card && !card.discovery && card.territory === id;
  // Advanced consumes one spare as the turn-one second pile; Basic consumes none.
  const front = [take(card => 'territory' in card && (discovery
    ? card.discovery === plan.blow.discovery : !card.discovery && card.territory === plan.blow.territory))];
  if (game.advanced) front.push(take(plain(plan.spare[0].territory)));
  if (!discovery || options.ordinaryWormFirst) front.push(take(card => 'worm' in card && !card.greatMaker));
  if (discovery) front.push(take(card => 'worm' in card && !!card.greatMaker));
  front.push(take(plain(plan.spare[1].territory)), take(plain(plan.spare[2].territory)));
  game.spiceDeck.unshift(...front);
}
export function finishHomeworldClassicDiscoveryNexusMentat(game: Game,
  actions?: HomeworldClassicDiscoveryNexusStep[]): HomeworldClassicDiscoveryNexusMentat {
  const turn = game.turn;
  game = advanceHomeworldClassicDiscoveryNexus(game,
    state => state.phase === 8 && homeworldClassicDiscoveryNexusClean(state), actions);
  for (let count = 0; count < 100; count++) {
    const before = structuredClone(game), step = nextHomeworldClassicDiscoveryNexusStep(game);
    assert.ok(step);
    game = applyHomeworldClassicDiscoveryNexusStep(game, step, actions);
    if (game.turn !== turn || game.status === 'finished') return { before, step, after: game };
  }
  throw new Error('The original Mentat controls failed to close the owned turn.');
}
/** Original next-turn parent-board free entry; the reveal control decides it. */
export function enterHomeworldClassicDiscoveryNexus(game: Game, actor: string,
  actions?: HomeworldClassicDiscoveryNexusStep[]): Game {
  assert.equal(game.decision?.kind, 'discoveryEntry');
  assert.equal(game.decision!.player, actor);
  const view = viewGame(game, actor), action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources);
  assert.ok(action, 'The revealed parent-board army must be a legal original free entry.');
  return applyHomeworldClassicDiscoveryNexusStep(game, { actor, action }, actions);
}

/** Original create/join/ready/audit initializer, real source-qualified native
 * shipments, the printed blow and the Collection reveal. No hand, custody,
 * clock, alliance, casualty, wallet or outcome field is written by staging. */
export function createHomeworldClassicDiscoveryNexusFixture(
  options: HomeworldClassicDiscoveryNexusOptions = {},
): HomeworldClassicDiscoveryNexusFixture {
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    const factions: FactionId[] = ['emperor', 'atreides', 'fremen', 'harkonnen', 'beneGesserit', 'guild'];
    const seats = options.seats ?? options.seatIds?.length ?? 3;
    assert.ok(seats >= 2 && seats <= 6);
    if (options.seatIds) assert.equal(options.seatIds.length, seats);
    game = createGame(options.gameId ?? 'HWCLASSICDISCOVERYNEXUS',
      newPlayer(options.seatIds?.[0] ?? 'emperor', 'Emperor', 'emperor'),
      options.advanced ?? !!options.strongholds);
    for (let seat = 1; seat < seats; seat++)
      joinGame(game, newPlayer(options.seatIds?.[seat] ?? factions[seat], factions[seat], factions[seat]));
  }
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.leaderSkills && !game.ecazTreachery && !game.spiceBankerIncomePreview);
  assert.ok(game.status === 'lobby' || (game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    ['prediction', 'traitors'].includes(game.setupStage!) &&
    game.players.every(player => !player.hand.length && !player.traitors.length)));
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const collector = game.players.find(player => player.faction === 'emperor')?.id;
  const victim = game.players.find(player => player.faction === 'atreides')?.id;
  assert.ok(collector && victim, 'This original programme needs its Emperor split source and an Atreides army.');
  const actions: HomeworldClassicDiscoveryNexusStep[] = [];
  const fresh = !options.initial;
  const wantDiscovery = options.discovery ?? (fresh || !!game.discoveryEnabled);
  const wantTech = options.tech ?? (fresh || !!game.techTokens);
  const wantStrongholds = options.strongholds ?? (fresh ? game.advanced : !!game.strongholdCards);
  if (game.status === 'lobby') {
    if (!game.homeworlds) game = applyHomeworldClassicDiscoveryNexusStep(game,
      { actor: game.host, action: { type: 'homeworlds', enabled: true } }, actions);
    if (wantTech && !game.techTokens) game = applyHomeworldClassicDiscoveryNexusStep(game,
      { actor: game.host, action: { type: 'techTokens', enabled: true } }, actions);
    if (wantStrongholds && !game.strongholdCards) game = applyHomeworldClassicDiscoveryNexusStep(game,
      { actor: game.host, action: { type: 'strongholdCards', enabled: true } }, actions);
    game.discoveryEnabled = wantDiscovery;
    game.nexusCards ??= { cards: null, phase: null };
    for (const player of game.players) if (!player.ready)
      game = applyHomeworldClassicDiscoveryNexusStep(game, { actor: player.id, action: { type: 'ready' } }, actions);
  }
  assert.ok(game.homeworlds && game.nexusCards, 'This programme needs the original Homeworld and Nexus modules.');
  assert.equal(!!game.discoveryEnabled, wantDiscovery);
  assert.equal(!!game.techTokens, wantTech);
  assert.equal(!!game.strongholdCards, wantStrongholds);
  assert.ok(classicNexusModulesProfile(game));
  const initial = structuredClone(game);
  if (game.status === 'lobby') game = withClassicDiscoveryNexusLottery(() => initializeNexusGameForAudit(game));
  const setup = structuredClone(game);
  game = advanceHomeworldClassicDiscoveryNexus(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  homeworldClassicDiscoveryNexusInventory(afterSetup);
  game = advanceHomeworldClassicDiscoveryNexus(game,
    state => state.phase === 1 && homeworldClassicDiscoveryNexusClean(state), actions);
  const firstStorm = structuredClone(game);
  const plan = planOriginalSpice(game, wantDiscovery);
  orderOriginalSpice(game, plan, options);
  // The physical token lottery must surround the real Spice Blow action.
  if (wantDiscovery) for (let count = 0;
    !game.discoveries!.tokens.some(token => token.face === 'cistern' && token.status === 'placed') && count < 100;
    count++) {
    const step = nextHomeworldClassicDiscoveryNexusStep(game); assert.ok(step);
    actions.push(structuredClone(step));
    game = withClassicDiscoveryNexusToken(game, 'cistern', () => applyAction(game, step.actor, step.action));
  }
  const afterBlow = structuredClone(game), blowKey = location(plan.blow.territory, plan.blow.sector);
  const amount = game.advanced ? 3 : 2, elite = game.advanced ? 1 : 0;
  game = advanceHomeworldClassicDiscoveryNexus(game,
    state => state.phase === 5 && homeworldClassicDiscoveryNexusClean(state), actions);
  const beforeShipment = structuredClone(game), shipments: HomeworldClassicDiscoveryNexusShipment[] = [];
  let afterShipments: Game | null = null;
  for (let count = 0; game.phase === 5 && count < 240; count++) {
    const actor = game.active;
    if (homeworldClassicDiscoveryNexusClean(game) && actor && !shipments.some(row => row.actor === actor) &&
      (actor === collector || actor === victim)) {
      const total = actor === collector ? amount : 2, starred = actor === collector ? elite : 0;
      const sources = nativeShipmentSources(viewGame(game, actor), total, starred);
      assert.ok(sources, `Original ${actor} native reserve sources must cover ${total} physical counters.`);
      const target = actor === collector ? plan.parent : plan.blow;
      const shipment: HomeworldClassicDiscoveryNexusShipment = { actor, amount: total, elite: starred,
        territory: target.territory, sector: target.sector, homeworldSources: sources,
        cost: reserveShipmentCost({ faction: homeworldClassicDiscoveryNexusPlayer(game, actor).faction, halfRate: false },
          territory(target.territory).type, total) };
      shipments.push(shipment);
      game = applyHomeworldClassicDiscoveryNexusStep(game, { actor, action: { type: 'ship',
        territory: target.territory, sector: target.sector, amount: total, elite: starred,
        allyPayment: 0, homeworldSources: sources } }, actions);
      if (shipments.length === 2) afterShipments = structuredClone(game);
    } else {
      const step = nextHomeworldClassicDiscoveryNexusStep(game); assert.ok(step);
      game = applyHomeworldClassicDiscoveryNexusStep(game, step, actions);
    }
  }
  assert.equal(shipments.length, 2);
  assert.ok(afterShipments, 'Both original native shipments must be declared.');
  game = advanceHomeworldClassicDiscoveryNexus(game,
    state => state.phase === 7 && homeworldClassicDiscoveryNexusClean(state), actions);
  const collection = structuredClone(game);
  const token = game.discoveries?.tokens.find(candidate => candidate.face === 'cistern')?.id ?? null;
  if (token) {
    if (viewGame(game, collector).discoveries!.canInspect.includes(token))
      game = applyHomeworldClassicDiscoveryNexusStep(game,
        { actor: collector, action: { type: 'discovery', token, reveal: false } }, actions);
    assert.ok(viewGame(game, collector).discoveries!.canReveal.includes(token),
      'The finder holding the parent-board army may reveal the placed original token.');
    game = applyHomeworldClassicDiscoveryNexusStep(game,
      { actor: collector, action: { type: 'discovery', token, reveal: true } }, actions);
  }
  const firstMentat = finishHomeworldClassicDiscoveryNexusMentat(game, actions);
  game = firstMentat.after;
  assert.equal(game.turn, 2);
  homeworldClassicDiscoveryNexusInventory(game);
  return { initial, setup, afterSetup, firstStorm, afterBlow, beforeShipment, afterShipments,
    collection, firstMentat, game, collector, victim,
    fremen: game.players.find(player => player.faction === 'fremen')?.id ?? null, token,
    parent: plan.parent.territory, parentSector: plan.parent.sector, blowKey, blowAmount: plan.blow.amount,
    wormTerritory: plan.blow.territory, wormSource: blowKey, amount, elite, shipments, actions,
    staging: [
      'Original Homeworld + Nexus opt-in with no Skills; original native setup retained.',
      wantDiscovery
        ? 'Original seven Spice Cards/eight Discovery tokens; the Cistern supply lottery is selected around the real blow.'
        : 'Original plain Spice deck; this composition has no Great Maker card at all.',
      'Conserved original unplayed Spice order only: the printed blow, the Advanced second pile, and the turn-two worm/Great Maker, each kept out of the actual storm.',
      'Only real source-qualified native reserve shipments place the two board armies; no wallet, clock, casualty or outcome is assigned.'] };
}
/** Enter or decline the real encounter without silently voting, riding or paying. */
export function openHomeworldClassicDiscoveryNexusEncounter(fixture: HomeworldClassicDiscoveryNexusFixture,
  enter = true): Game {
  let game = fixture.game;
  if (game.decision?.kind === 'discoveryEntry') game = enter
    ? enterHomeworldClassicDiscoveryNexus(game, fixture.collector, fixture.actions)
    : applyHomeworldClassicDiscoveryNexusStep(game, { actor: fixture.collector,
      action: { type: 'decision', event: game.decision.event, accept: false } }, fixture.actions);
  return advanceHomeworldClassicDiscoveryNexus(game,
    state => fixture.token ? state.greatMaker?.stage === 'vote' : !!state.nexus, fixture.actions);
}
export function voteHomeworldClassicDiscoveryNexus(game: Game, votes: readonly boolean[],
  actions?: HomeworldClassicDiscoveryNexusStep[]): Game {
  for (const yes of votes) {
    assert.equal(game.decision?.kind, 'greatMakerVote');
    game = applyHomeworldClassicDiscoveryNexusStep(game, { actor: game.decision!.player,
      action: { type: 'decision', event: game.decision!.event, yes } }, actions);
  }
  return game;
}
/** Real settled alliance, then the single original closing Nexus draw. */
export function closeHomeworldClassicDiscoveryNexusAlliance(fixture: HomeworldClassicDiscoveryNexusFixture,
  game: Game, card: 'guild' | 'ecaz' = 'ecaz'): { alliance: Game; drawing: Game; after: Game; draw: Action } {
  game = advanceHomeworldClassicDiscoveryNexus(game, state => state.nexus && !state.spiceWindow &&
    !state.spiceResolution && homeworldClassicDiscoveryNexusClean(state), fixture.actions);
  assert.ok(fixture.fremen, 'A settled alliance needs two original seated owners.');
  for (const [actor, target] of [[fixture.victim, fixture.fremen], [fixture.fremen, fixture.victim]])
    game = applyHomeworldClassicDiscoveryNexusStep(game,
      { actor, action: { type: 'alliance', target } }, fixture.actions);
  const alliance = structuredClone(game);
  game = advanceHomeworldClassicDiscoveryNexus(game,
    state => state.nexusCards!.phase?.stage === 'drawing', fixture.actions);
  const deck = game.nexusCards!.cards!.deck, index = deck.indexOf(card); assert.ok(index >= 0);
  deck.unshift(deck.splice(index, 1)[0]);
  fixture.staging.push(`Ordered the conserved original undealt ${card} Nexus singleton before its real closing draw; no hand assigned.`);
  const drawing = structuredClone(game);
  const draw: Action = { type: 'nexusCardChoice', turn: game.turn,
    card: game.nexusCards!.cards!.hands[fixture.collector], choice: 'draw', ownRedraws: 0 };
  game = applyHomeworldClassicDiscoveryNexusStep(game, { actor: fixture.collector, action: draw }, fixture.actions);
  return { alliance, drawing, after: game, draw };
}
