import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import {
  createSelectedIndependentEntry, type SelectedIndependentEntryOptions,
} from './fixture-selected-independent-nexus-entry';
import {
  withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken,
} from './fixture-discovery-classic-nexus';
import {
  fremenCunningModulesClean, fremenCunningModulesPlayer, nextFremenCunningModulesStep,
  type FremenCunningModulesStep,
} from './fixture-fremen-cunning-modules';

export type IndependentDiscoveryCardsOptions = Partial<Omit<SelectedIndependentEntryOptions, 'discoveries'>>;
export type IndependentDiscoveryCardsStep = FremenCunningModulesStep;
export const independentDiscoveryCardsPlayer = fremenCunningModulesPlayer;
export const independentDiscoveryCardsClean = fremenCunningModulesClean;

export function actIndependentDiscoveryCards(game: Game, actor: string, action: Action,
  actions?: IndependentDiscoveryCardsStep[]): Game {
  actions?.push({ actor, action: structuredClone(action) });
  return withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
}
export function nextIndependentDiscoveryCardsStep(game: Game): IndependentDiscoveryCardsStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'discoveryEntry' || decision?.kind === 'greatMakerRide')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
    if (decision?.kind === 'greatMakerVote')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, yes: false } };
    if (decision?.kind === 'discoveryDiscard') {
      const card = independentDiscoveryCardsPlayer(game, decision.player).hand[0]; assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', event: decision.event, card: card.id } };
    }
  }
  return nextFremenCunningModulesStep(game);
}
export function advanceIndependentDiscoveryCards(game: Game, until: (state: Game) => boolean,
  actions: IndependentDiscoveryCardsStep[] = []): Game {
  for (let count = 0; count < 2500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original independent Discovery chronology ended early');
    const next = nextIndependentDiscoveryCardsStep(game); assert.ok(next,
      `Choose the original ${game.decision?.kind ?? 'Battle Plan'} at ${game.turn}/${game.phase}`);
    game = actIndependentDiscoveryCards(game, next.actor, next.action, actions);
  }
  throw Error('The original independent Discovery chronology did not reach its requested boundary');
}
/** Only original unopened Spice Cards are positioned. A Discovery card uses
 * its real printed parent placement and ordinary production, not a saved flag. */
function orderOriginalSpice(game: Game, entries: readonly string[]): void {
  const front: Game['spiceDeck'] = [];
  for (const entry of entries) {
    const index = game.spiceDeck.findIndex(card => entry === 'worm'
      ? 'worm' in card && !card.greatMaker && !card.thumper && !card.suppressed
      : entry === 'sandtrout' ? 'sandtrout' in card
        : entry.startsWith('discovery-') ? 'territory' in card && card.discovery === entry
          : 'territory' in card && !card.discovery && card.territory === entry);
    assert.ok(index >= 0, `Use original unopened Spice Card ${entry}`);
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}
function nativeShipment(game: Game, actor: string, territory: string, sector: number, amount: number, elite = 0): Action {
  const sources = game.homeworlds ? nativeShipmentSources(viewGame(game, actor), amount, elite) : undefined;
  assert.ok(!game.homeworlds || sources);
  return { type: 'ship', territory, sector, amount, elite, allyPayment: 0,
    ...(sources ? { homeworldSources: sources } : {}) };
}

/** Original host modules/setup → physical Discovery placement → paid parent
 * shipment → private inspection/public reveal → actual next-turn free-entry
 * window. Fremen separately earns its remote source through native shipment.
 * No hand, purse, force, clock, token custody or receipt is assigned afterward. */
export function createIndependentDiscoveryCardsFixture(options: IndependentDiscoveryCardsOptions = {}) {
  const source = withClassicDiscoveryNexusLottery(() => createSelectedIndependentEntry({
    ...options, expansions: options.expansions ?? [], factions: options.factions ?? ['fremen', 'guild', 'emperor'], discoveries: true,
  }));
  let game = source.game;
  const actions = [...source.actions], afterSetup = structuredClone(game), staging: string[] = [];
  assert.ok(game.discoveryEnabled && game.discoveries && game.ecazTreachery && game.nexusCards?.cards);
  for (const actor of ['fremen', 'guild', 'emperor']) assert.ok(game.players.some(player => player.id === actor));
  const act = (actor: string, action: Action) => { game = actIndependentDiscoveryCards(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceIndependentDiscoveryCards(game, until, actions); };
  orderOriginalSpice(game, game.advanced ? ['discovery-hagga-basin', 'broken_land'] : ['discovery-hagga-basin']);
  reach(state => state.phase === 1 && independentDiscoveryCardsClean(state));
  for (let count = 0; count < 100 && !game.discoveries!.tokens.some(token => token.face === 'cistern' && token.status === 'placed'); count++) {
    const next = nextIndependentDiscoveryCardsStep(game); assert.ok(next);
    actions.push(structuredClone(next));
    // This original supply-token lottery must surround the actual producer,
    // outside the generic scalar wrapper used for all other actions.
    game = withClassicDiscoveryNexusToken(game, 'cistern', () => applyAction(game, next.actor, next.action));
  }
  const token = game.discoveries!.tokens.find(token => token.face === 'cistern' && token.status === 'placed'); assert.ok(token);
  const placed = structuredClone(game), parent = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  assert.equal(token.territory, parent.territory); assert.equal(token.sector, parent.sector);
  const shipments: Array<{ actor: string; before: Game; step: IndependentDiscoveryCardsStep; after: Game }> = [];
  const shipped = new Set<string>();
  for (let count = 0; count < 800; count++) {
    if (game.phase === 7 && independentDiscoveryCardsClean(game)) break;
    if (game.phase === 5 && independentDiscoveryCardsClean(game) && game.active &&
        ['fremen', 'guild'].includes(game.active) && !shipped.has(game.active)) {
      const actor = game.active, before = structuredClone(game);
      const action = actor === 'fremen' ? nativeShipment(game, actor, 'wind_pass', 14, 3, game.advanced ? 2 : 0)
        : nativeShipment(game, actor, parent.territory, parent.sector, 3);
      const step: IndependentDiscoveryCardsStep = { actor, action };
      act(actor, action); reach(independentDiscoveryCardsClean);
      shipments.push({ actor, before, step, after: structuredClone(game) }); shipped.add(actor);
      continue;
    }
    const next = nextIndependentDiscoveryCardsStep(game); assert.ok(next); act(next.actor, next.action);
  }
  assert.equal(shipped.size, 2);
  assert.equal(game.phase, 7);
  const beforeInspection = structuredClone(game), own = viewGame(game, 'guild').discoveries; assert.ok(own);
  assert.ok(own.canInspect.includes(token.id));
  const inspect: IndependentDiscoveryCardsStep = { actor: 'guild', action: { type: 'discovery', token: token.id, reveal: false } };
  act(inspect.actor, inspect.action);
  const inspected = structuredClone(game);
  assert.ok(viewGame(game, 'guild').discoveries!.canReveal.includes(token.id));
  const reveal: IndependentDiscoveryCardsStep = { actor: 'guild', action: { type: 'discovery', token: token.id, reveal: true } };
  act(reveal.actor, reveal.action);
  const revealed = structuredClone(game);
  reach(state => state.turn === 2 && !state.phaseOpening && !state.response && state.decision?.kind === 'discoveryEntry' && state.decision.player === 'guild');
  staging.push('Original host independently selects all modules; only unopened Spice order and the original Cistern supply-token lottery are positioned. Real native Fremen reinforcement and paid Guild parent shipment precede actual inspection, reveal and next-turn entry.');
  return { source, afterSetup, game, actions, staging, token: token.id, parent: parent.territory, parentSector: parent.sector,
    placed, shipments, beforeInspection, inspect, inspected, reveal, revealed,
    owner: 'fremen', collector: 'guild', sourceKey: 'wind_pass:14', destination: 'cistern' };
}
export type IndependentDiscoveryCardsFixture = ReturnType<typeof createIndependentDiscoveryCardsFixture>;

/** Continue the original free-entry choice, then a real ordinary worm,
 * reciprocal alliance and actual closing draw. The common source is returned
 * immediately before its next physical Spice production. */
function openIndependentDiscoveryCardsDraw(fixture: IndependentDiscoveryCardsFixture) {
  let game = fixture.game;
  const actions = fixture.actions, owner = fixture.owner;
  const entryBefore = structuredClone(game), own = viewGame(game, 'guild'), available = own.discoveryEntry!.sources.find(source => source.normal >= 1); assert.ok(available);
  const entryAction = discoveryEntryMoveAction(own, [{ source: available.source, normal: 1, elite: 0 }]); assert.ok(entryAction);
  const entry: IndependentDiscoveryCardsStep = { actor: 'guild', action: entryAction };
  game = actIndependentDiscoveryCards(game, entry.actor, entry.action, actions);
  const entered = structuredClone(game);
  game = advanceIndependentDiscoveryCards(game, state => state.turn === 2 && state.phase === 1 && independentDiscoveryCardsClean(state), actions);
  orderOriginalSpice(game, game.advanced ? ['worm', 'red_chasm', 'rock_outcroppings'] : ['worm', 'red_chasm']);
  game = advanceIndependentDiscoveryCards(game, state => state.nexus && !state.spiceWindow && !state.spiceResolution && independentDiscoveryCardsClean(state), actions);
  const beforeAlliance = structuredClone(game);
  for (const [actor, target] of [['guild', 'emperor'], ['emperor', 'guild']])
    game = actIndependentDiscoveryCards(game, actor, { type: 'alliance', target }, actions);
  game = advanceIndependentDiscoveryCards(game, state => state.nexusCards?.phase?.stage === 'drawing' && independentDiscoveryCardsClean(state), actions);
  const deck = game.nexusCards!.cards!.deck, index = deck.indexOf('fremen'); assert.ok(index >= 0);
  deck.unshift(deck.splice(index, 1)[0]);
  const drawBefore = structuredClone(game), draw: IndependentDiscoveryCardsStep = { actor: owner, action: {
    type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
  game = actIndependentDiscoveryCards(game, draw.actor, draw.action, actions);
  const drawn = structuredClone(game);
  game = advanceIndependentDiscoveryCards(game, state => state.turn === 3 && state.phase === 1 && independentDiscoveryCardsClean(state), actions);
  return { game, actions, entryBefore, entry, entered, beforeAlliance, drawBefore, draw, drawn };
}

/** Spend the actually drawn own card and take its typed post-Nexus remote ride
 * into the revealed nested location, retaining native destination admission. */
export function completeIndependentDiscoveryCards(fixture: IndependentDiscoveryCardsFixture) {
  const opened = openIndependentDiscoveryCardsDraw(fixture), actions = opened.actions;
  let game = opened.game;
  orderOriginalSpice(game, game.advanced ? ['worm', 'sihaya_ridge', 'habbanya_erg'] : ['worm', 'sihaya_ridge']);
  game = advanceIndependentDiscoveryCards(game, state => !state.response && !state.phaseOpening && state.decision?.kind === 'nexusFremenCunningOffer', actions);
  const beforeSpend = structuredClone(game), occurrence = structuredClone(game.nexusFremenCunningOffer!.occurrence);
  const spend: IndependentDiscoveryCardsStep = { actor: fixture.owner, action: { type: 'decision', event: occurrence.event, accept: true } };
  game = actIndependentDiscoveryCards(game, spend.actor, spend.action, actions);
  const spent = structuredClone(game);
  game = advanceIndependentDiscoveryCards(game, state => !state.response && !state.phaseOpening && state.decision?.kind === 'nexusFremenCunningRide', actions);
  const beforeRide = structuredClone(game), source = independentDiscoveryCardsPlayer(game, fixture.owner);
  const elite = game.advanced ? 2 : 0;
  assert.ok(source.forces[fixture.sourceKey] >= 3 && (source.elites?.forces[fixture.sourceKey] ?? 0) >= elite);
  const ride: IndependentDiscoveryCardsStep = { actor: fixture.owner, action: { type: 'decision', event: occurrence.event,
    accept: true, source: 'wind_pass', forces: { [fixture.sourceKey]: { normal: 3 - elite, elite } }, territory: fixture.destination, sector: 0 } };
  game = actIndependentDiscoveryCards(game, ride.actor, ride.action, actions);
  const afterRide = structuredClone(game);
  game = advanceIndependentDiscoveryCards(game, independentDiscoveryCardsClean, actions);
  return { ...opened, game, actions, occurrence, beforeSpend, spend, spent, beforeRide, ride, afterRide };
}

/** The original E1 Sandtrout breaks the actual alliance, suppresses the next
 * original worm and doubles only its immediate original land replacement. */
export function completeIndependentDiscoverySandtrout(fixture: IndependentDiscoveryCardsFixture) {
  assert.ok(fixture.afterSetup.expansions.includes('ix'));
  const opened = openIndependentDiscoveryCardsDraw(fixture), actions = opened.actions;
  let game = opened.game;
  const before = structuredClone(game);
  orderOriginalSpice(game, game.advanced ? ['sandtrout', 'worm', 'sihaya_ridge', 'habbanya_erg'] : ['sandtrout', 'worm', 'sihaya_ridge']);
  game = advanceIndependentDiscoveryCards(game, state => state.spiceWindow?.territory === 'sihaya_ridge', actions);
  const doubled = structuredClone(game);
  game = advanceIndependentDiscoveryCards(game, state => state.phase === 2 && independentDiscoveryCardsClean(state), actions);
  return { ...opened, game, actions, before, doubled };
}
