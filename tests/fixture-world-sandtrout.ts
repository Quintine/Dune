import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { spiceDeck } from '../game/cards';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import {
  actMixedPhaseModules, createMixedPhaseModulesFixture, mixedPhaseModulesClean,
  mixedPhaseModulesInventory, mixedPhaseModulesPlayer, nextMixedPhaseModules,
  type MixedPhaseModulesStep, type MixedPhaseModulesTransition,
} from './fixture-mixed-phase-modules';
import { beforeIxSpiceDraw, orderIxSpiceCards, type IxSpicePick } from './fixture-ix-spice-cards';

export type WorldSandtroutStep = MixedPhaseModulesStep;
export type WorldSandtroutTransition = MixedPhaseModulesTransition;
export const WORLD_SANDTROUT_TRAINING = { atreides: 'warmaster', emperor: 'spice-banker', ixians: 'mentat' } as const;
export const actWorldSandtrout = actMixedPhaseModules;
export const nextWorldSandtrout = nextMixedPhaseModules;
export const worldSandtroutClean = mixedPhaseModulesClean;
export const worldSandtroutPlayer = mixedPhaseModulesPlayer;
export const worldSandtroutInventory = mixedPhaseModulesInventory;
export function advanceWorldSandtrout(game: Game, until: (state: Game) => boolean,
  actions: WorldSandtroutStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original World Sandtrout source ended before its native control');
    const next = nextWorldSandtrout(game); assert.ok(next);
    game = actWorldSandtrout(game, next.actor, next.action, actions);
  }
  throw Error('The original World Sandtrout source did not reach its finite boundary');
}
export function finishWorldSandtrout(game: Game, actions: WorldSandtroutStep[] = []): Game {
  const turn = game.turn;
  return advanceWorldSandtrout(game, state => state.turn === turn && state.phase === 2 && worldSandtroutClean(state), actions);
}
export function worldSandtroutDeferred(game: Game, owner = 'emperor') {
  return viewGame(game, owner).spiceBankerIncome?.deferred.find(row => row.owner === owner)?.amount ?? 0;
}

/** Sandtrout is set aside while active: count its live boolean once, then its
 * physical discard once after suppression. Suppression annotates an original
 * worm; it does not mint another Spice Card. */
export function worldSandtroutSpice(game: Game) {
  const cards = [...game.spiceDeck, ...game.spiceDiscard.flat(), ...(game.spiceSequence?.skipped ?? [])]
    .filter(card => !('worm' in card && card.thumper));
  const inventory = cards.map(card => JSON.stringify('worm' in card ? { worm: true } : card));
  if (game.sandtrout) inventory.push(JSON.stringify({ sandtrout: true }));
  assert.equal(cards.filter(card => 'worm' in card).length, 6);
  assert.equal(cards.filter(card => 'territory' in card).length, 15);
  assert.equal(cards.filter(card => 'sandtrout' in card).length + Number(!!game.sandtrout), 1);
  assert.deepEqual(inventory.sort(), spiceDeck(true).map(card => JSON.stringify(card)).sort());
  return inventory.sort();
}
export function worldSandtroutSkills(game: Game) {
  const skills = game.leaderSkills ? [...game.leaderSkills.deck,
    ...game.leaderSkills.assignments.map(assignment => assignment.skill),
    ...Object.values(game.leaderSkills.offers).flatMap(offer => offer.cards)].sort() : [];
  if (game.leaderSkills) assert.deepEqual(skills, LEADER_SKILL_CARDS.map(card => card.id).sort());
  return skills;
}
export function worldSandtroutStocks(game: Game) {
  return game.players.map(player => ({ player: player.id, reserves: player.reserves, tanks: player.tanks,
    forces: structuredClone(player.forces), eliteReserves: player.elites?.reserves ?? 0,
    eliteTanks: player.elites?.tanks ?? 0, eliteForces: structuredClone(player.elites?.forces ?? {}) }));
}

/** Genuine public A/E/Ix +Ix World/Tech setup. Advanced additionally trains
 * three original all14 offers and enables original Strongholds. Only the
 * original scalar/Skill lottery and unopened Spice prefix are selected. No
 * played Sandtrout flag, card, force, wallet, occupation or clock is installed.
 * Stop at the actual first blow with Sandtrout physically waiting. */
export function createWorldSandtroutFixture(options: { advanced?: boolean; firstTurnWorm?: boolean } = {}) {
  const advanced = options.advanced ?? false, firstTurnWorm = options.firstTurnWorm ?? false;
  const source = createMixedPhaseModulesFixture({ factions: ['atreides', 'emperor', 'ixians'], expansions: ['ix'],
    advanced, homeworlds: true, tech: true, strongholds: advanced, skills: advanced,
    training: advanced ? WORLD_SANDTROUT_TRAINING : undefined });
  let game = structuredClone(source.game);
  const actions = [...source.actions];
  assert.ok(beforeIxSpiceDraw(game));
  const picks: IxSpicePick[] = ['sandtrout', ...(firstTurnWorm ? ['worm' as const] : []),
    { territory: 'broken_land' }, ...(advanced ? [{ territory: 'funeral_plain' }] : [])];
  const spiceOrder = orderIxSpiceCards(game, picks);
  const beforeDraw = structuredClone(game), from = actions.length;
  game = advanceWorldSandtrout(game, state => !!state.spiceWindow && worldSandtroutClean(state), actions);
  const draw: WorldSandtroutTransition = { before: beforeDraw, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  assert.equal(game.sandtrout, true); assert.equal(game.spiceWindow!.territory, 'broken_land');
  assert.equal(game.nexus, false);
  const originalSpice = worldSandtroutSpice(source.setup), originalSkills = worldSandtroutSkills(source.setup);
  assert.deepEqual(worldSandtroutSpice(game), originalSpice);
  assert.deepEqual(worldSandtroutInventory(game), source.originalInventory);
  homeworldGameIntegrity(game);
  return { ...source, game, sourceGame: structuredClone(game), advanced, firstTurnWorm,
    actor: 'atreides', owner: 'atreides', action: { type: 'ready' } as Action, banker: advanced ? 'emperor' : null,
    origin: 'homeworld:atreides', target: game.spiceWindow!.territory, targetSector: game.spiceWindow!.sector,
    targetLocation: `${game.spiceWindow!.territory}:${game.spiceWindow!.sector}`,
    spiceOrder, beforeDraw, draw, originalSpice, originalSkills,
    training: advanced ? WORLD_SANDTROUT_TRAINING : null,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[], sourceDisclosure: 'Original public A/E/Ix Worlds/Tech and optional Advanced all14/Strongholds use actual controls. Only original scalar/Skill lotteries and unopened Sandtrout/territory/worm positions are selected; no played flags, hands, armies, wallets, occupation state or turn is installed. First-turn ignoring and immediate-only doubling retain the provisional source policy in docs/IX_PROTOTYPE.md.' };
}
export type WorldSandtroutFixture = ReturnType<typeof createWorldSandtroutFixture>;

/** An actual paid native A2 arrival becomes the later worm's physical source.
 * The active original Sandtrout survives real Collection, Mentat and Storm;
 * the next drawn worm is suppressed and only its immediate territory doubles. */
export function completeWorldSandtrout(f: WorldSandtroutFixture, state = f.game) {
  let game = state;
  const actions: WorldSandtroutStep[] = [];
  const act = (actor: string, action: Action) => { game = actWorldSandtrout(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceWorldSandtrout(game, until, actions); };
  const transition = (run: () => void): WorldSandtroutTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const firstSpice = transition(() => { game = finishWorldSandtrout(game, actions); });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === f.actor && worldSandtroutClean(state));
  const shipmentSources = nativeShipmentSources(viewGame(game, f.actor), 2, 0); assert.ok(shipmentSources);
  const shipmentAction: Action = { type: 'ship', territory: f.target, sector: f.targetSector, amount: 2, elite: 0,
    allyPayment: 0, homeworldSources: shipmentSources };
  const shipment = transition(() => { act(f.actor, shipmentAction); reach(worldSandtroutClean); });
  assert.equal(worldSandtroutPlayer(shipment.before, f.actor).spice - worldSandtroutPlayer(game, f.actor).spice, 4);
  assert.equal(worldSandtroutPlayer(game, f.actor).forces[f.targetLocation], 2);
  reach(state => state.phase === 5 && state.active === state.order.at(-1) && worldSandtroutClean(state));
  const techOwner = game.techTokens!.heighliners.owner; assert.ok(techOwner);
  const techAmount = game.techTokens!.heighliners.spice;
  const collection = transition(() => {
    act(game.active!, { type: 'endMovement' });
    reach(state => state.phase === 7 && worldSandtroutClean(state));
  });
  assert.equal(game.sandtrout, true);
  const mentat = transition(() => {
    reach(state => state.turn === 2 && state.phase === 0 && worldSandtroutClean(state));
  });
  assert.equal(game.sandtrout, true);
  const storm = transition(() => { reach(state => state.turn === 2 && beforeIxSpiceDraw(state)); });
  assert.equal(game.sandtrout, true);
  assert.equal(worldSandtroutPlayer(game, f.actor).forces[f.targetLocation], 2);
  const secondSpiceOrder = orderIxSpiceCards(game, ['worm', { territory: 'hagga_basin' },
    ...(f.advanced ? [{ territory: 'rock_outcroppings' }] : [])]);
  const beforeSuppression = structuredClone(game);
  const suppression = transition(() => { reach(state => !!state.spiceWindow && worldSandtroutClean(state)); });
  const revealed = structuredClone(game);
  assert.equal(game.sandtrout, false); assert.equal(game.nexus, false);
  assert.equal(game.spiceWindow!.territory, 'hagga_basin');
  let secondWindow: Game | null = null;
  if (f.advanced) {
    reach(state => !!state.spiceWindow && state.spiceSequence?.pile === 1 && worldSandtroutClean(state));
    secondWindow = structuredClone(game);
  }
  const finishedSpice = transition(() => { game = finishWorldSandtrout(game, actions); });
  homeworldGameIntegrity(game);
  assert.deepEqual(worldSandtroutSpice(game), f.originalSpice);
  assert.deepEqual(worldSandtroutInventory(game), f.originalInventory);
  assert.deepEqual(worldSandtroutSkills(game), f.originalSkills);
  const bankerSource = shipment.after.spiceBankerIncome?.sources.find(receipt => receipt.source.kind === 'shipment' &&
    receipt.source.bankLegs.some(leg => leg.payer === f.actor && leg.amount === 4)) ?? null;
  const bankerCollection = bankerSource ? game.spiceBankerIncome?.collections.find(receipt =>
    receipt.turn === 1 && receipt.grants.includes(bankerSource.cursor)) ?? null : null;
  return { game, firstSpice, shipmentSources, shipmentAction, shipment, techOwner, techAmount,
    collection, mentat, storm, secondSpiceOrder, beforeSuppression, suppression, revealed,
    secondWindow, finishedSpice, bankerSource: structuredClone(bankerSource),
    bankerCollection: structuredClone(bankerCollection), actions, actionCount: actions.length };
}
