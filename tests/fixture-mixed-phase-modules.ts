import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { TERRITORIES, MOBILE_STRONGHOLD, location, territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import { actAdvisorPreparation } from './fixture-advisor-preparation';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type MixedPhaseModulesStep = { actor: string; action: Action };
export type MixedPhaseModulesTransition = { before: Game; steps: MixedPhaseModulesStep[]; after: Game };
export type MixedPhaseModulesOptions = {
  factions: readonly FactionId[];
  expansions: Game['expansions'];
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  independent?: boolean;
};
export const MIXED_PHASE_NATIVE_FACTIONS = ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'] as const;
export const actMixedPhaseModules = actAdvisorPreparation;
export const mixedPhaseModulesPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const mixedPhaseModulesClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingTreacheryDiscard && !game.pendingRevival && !game.truthtrance &&
  !game.pendingShipment && !game.pendingKarama && !game.currentAuctionSale;

/** Current physical zones, excluding the ordinary auction's historical aliases. */
export function mixedPhaseModulesInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original physical Treachery Card has one current slot');
  return ids;
}

/** Native decisions only. Optional Terror placement is declined so the positive
 * shipment source does not depend on a separately selected Terror effect. */
export function nextMixedPhaseModules(game: Game): MixedPhaseModulesStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard && game.decision) {
    const d = game.decision;
    if (d.kind === 'moritaniSetup') return { actor: d.player,
      action: { type: 'decision', territory: 'carthag', sector: territory('carthag').sectors[0] } };
    if (d.kind === 'moritaniPlacement' || d.kind === 'choamStorm' || d.kind === 'choamMovement' ||
      d.kind === 'revivalStop') return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d.kind === 'guildTiming') return { actor: d.player, action: { type: 'decision', take: false } };
    if (d.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
    if (d.kind === 'richeseUnbid') return { actor: d.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceMixedPhaseModules(game: Game, until: (state: Game) => boolean,
  actions: MixedPhaseModulesStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original phase-module source ended before its requested boundary');
    const step = nextMixedPhaseModules(game);
    assert.ok(step, `Original continuation required at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actMixedPhaseModules(game, step.actor, step.action, actions);
  }
  throw Error('The original phase-module source did not reach its finite boundary');
}
export function finishMixedPhaseModules(game: Game, actions: MixedPhaseModulesStep[] = []): Game {
  const phase = game.phase, turn = game.turn;
  return advanceMixedPhaseModules(game, state => (state.phase !== phase || state.turn !== turn) && mixedPhaseModulesClean(state), actions);
}

/** Public module selections, ready/start and every original setup decision.
 * Only scalar lotteries and unopened Spice positions are selected. No played
 * card, force, wallet, Tanks, phase, token or Stronghold owner is installed. */
export function createMixedPhaseModulesFixture(options: MixedPhaseModulesOptions) {
  const [host, ...others] = options.factions; assert.ok(host);
  let game = createGame('MIXEDPHASEMODULES', newPlayer(host, host, host), options.advanced ?? false, options.expansions);
  for (const faction of others) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: MixedPhaseModulesStep[] = [];
  const act = (actor: string, action: Action) => { game = actMixedPhaseModules(game, actor, action, actions); };
  if (options.independent) act(host, { type: 'moduleOption', module: 'ecazTreachery', enabled: true });
  if (options.tech) act(host, { type: 'techTokens', enabled: true });
  if (options.strongholds) act(host, { type: 'strongholdCards', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(host, options.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = mixedPhaseModulesInventory(game);
  game = advanceMixedPhaseModules(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position);
    const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  game = advanceMixedPhaseModules(game, state => state.phase === 1 && mixedPhaseModulesClean(state), actions);
  const firstStorm = structuredClone(game);
  assert.deepEqual(mixedPhaseModulesInventory(game), originalInventory);
  return { game, sourceGame: structuredClone(game), independent: options.independent ?? false,
    initial, lobby, setup, afterSetup, firstStorm,
    originalInventory, originalSpice, spiceOrder, actions, sourceActions: structuredClone(actions),
    sourceActionCount: actions.length, staging: [] as string[] };
}

/** Actual all-six-native two-turn programme. The first two positive shipments
 * accrue Heighliners once; native first Mentat claims precede a real later
 * Storm casualty (Basic dials2 / Advanced card1) and that owner's free return. Sources remain ordinary public
 * entry plus original native choices, with no played-state installation. */
export function createMixedPhaseModulesProgramme(options: { advanced?: boolean; strongholds?: boolean; independent?: boolean } = {}) {
  const advanced = options.advanced ?? false, strongholds = options.strongholds ?? advanced;
  const source = createMixedPhaseModulesFixture({ factions: MIXED_PHASE_NATIVE_FACTIONS,
    expansions: ['ix', 'choam', 'ecaz'], advanced, tech: true, strongholds, independent: options.independent });
  let game = source.game;
  const actions = [...source.actions];
  const act = (actor: string, action: Action) => { game = actMixedPhaseModules(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceMixedPhaseModules(game, until, actions); };
  const transition = (run: () => void): MixedPhaseModulesTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  reach(state => state.turn === 1 && state.phase === 5 && state.active === 'choam' && mixedPhaseModulesClean(state));
  const tabr = territory('sietch_tabr').sectors[0], choamLocation = location('sietch_tabr', tabr);
  assert.ok(game.players.every(player => !player.forces[choamLocation]));
  const choamShipment = transition(() => {
    act('choam', { type: 'ship', territory: 'sietch_tabr', sector: tabr, amount: 1, elite: 0, allyPayment: 0 });
    reach(mixedPhaseModulesClean);
  });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === 'moritani' && mixedPhaseModulesClean(state));
  const sector = game.storm % 18 + 1;
  const target = TERRITORIES.find(t => t.type === 'sand' && t.id !== 'imperial_basin' && t.sectors.includes(sector) &&
    game.players.every(player => !Object.entries(player.forces).some(([key, count]) => count > 0 && key.startsWith(`${t.id}:`))));
  assert.ok(target, 'The next original Storm sector has an empty desert shipment destination');
  const casualtyLocation = location(target.id, sector);
  const moritaniShipment = transition(() => {
    act('moritani', { type: 'ship', territory: target.id, sector, amount: 1, elite: 0, allyPayment: 0 });
    reach(mixedPhaseModulesClean);
  });
  // Capture the actual phase-closing action, rather than folding later income
  // into the Heighliners receipt.
  reach(state => state.phase === 5 && mixedPhaseModulesClean(state) &&
    state.order.at(-1) === state.active);
  const shipmentPayout = transition(() => {
    act(game.active!, { type: 'endMovement' });
    reach(state => state.phase !== 5);
  });
  reach(state => state.turn === 1 && state.phase === 8 && mixedPhaseModulesClean(state));
  const mentat = transition(() => {
    reach(state => state.turn === 2 && state.phase === 0 && state.stormPending !== null && mixedPhaseModulesClean(state));
  });
  assert.equal(game.stormMovementSource?.kind, advanced ? 'card' : 'dials'); assert.equal(game.stormPending, advanced ? 1 : 2);
  const storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1 && mixedPhaseModulesClean(state)); });
  assert.equal(mixedPhaseModulesPlayer(game, 'moritani').forces[casualtyLocation], undefined);
  assert.equal(mixedPhaseModulesPlayer(game, 'moritani').tanks, 1);
  reach(state => state.turn === 2 && state.phase === 4 && mixedPhaseModulesClean(state) &&
    (!state.revivalOrder || state.revivalOrder.remaining[0] === 'moritani'));
  const revival = transition(() => {
    act('moritani', { type: 'revive', amount: 1, elite: 0 }); reach(mixedPhaseModulesClean);
  });
  // Complete earlier/remaining owned opportunities with the original ready
  // controls, and expose only the final phase-end token payout as its receipt.
  reach(state => state.phase === 4 && mixedPhaseModulesClean(state) && (state.revivalOrder
    ? state.revivalOrder.remaining.length === 1 : state.ready.length === state.players.length - 1));
  const revivalPayout = transition(() => {
    const step = nextMixedPhaseModules(game); assert.ok(step); act(step.actor, step.action);
    reach(state => state.phase === 5 && mixedPhaseModulesClean(state));
  });
  assert.equal(game.phase, 5);
  reach(state => state.phase === 5 && mixedPhaseModulesClean(state));
  assert.deepEqual(mixedPhaseModulesInventory(game), source.originalInventory);
  if (strongholds) {
    assert.equal(mentat.after.strongholdCards?.owners.carthag, 'moritani');
    assert.equal(mentat.after.strongholdCards?.owners.sietch_tabr, 'choam');
    assert.equal(mentat.after.strongholdCards?.owners[MOBILE_STRONGHOLD], 'ixians');
  }
  return { ...source, game, sourceGame: structuredClone(game), advanced, strongholds,
    choamLocation, casualtyLocation, choamShipment, moritaniShipment, shipmentPayout, mentat, storm,
    revival, revivalPayout, actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length };
}
