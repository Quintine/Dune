import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import {
  createMixedPhaseModulesFixture, actMixedPhaseModules, mixedPhaseModulesClean,
  mixedPhaseModulesInventory, mixedPhaseModulesPlayer, nextMixedPhaseModules,
  type MixedPhaseModulesStep, type MixedPhaseModulesTransition,
} from './fixture-mixed-phase-modules';

export type HomeworldPhaseOccupationStep = MixedPhaseModulesStep;
export type HomeworldPhaseOccupationTransition = MixedPhaseModulesTransition;
export const actHomeworldPhaseOccupation = actMixedPhaseModules;
export const homeworldPhaseOccupationClean = mixedPhaseModulesClean;
export const homeworldPhaseOccupationInventory = mixedPhaseModulesInventory;
export const homeworldPhaseOccupationPlayer = mixedPhaseModulesPlayer;

/** Optional Ambassador placement is declined; all source/return/payment/phase
 * choices remain their actual native decisions. No income chooser is invented
 * for an unallied occupied-bank award, which settles automatically. */
export function nextHomeworldPhaseOccupation(game: Game): HomeworldPhaseOccupationStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard && game.decision?.kind === 'ecazPlacement')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  return nextMixedPhaseModules(game);
}
export function advanceHomeworldPhaseOccupation(game: Game, until: (state: Game) => boolean,
  actions: HomeworldPhaseOccupationStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original occupied-income source ended before its next native control');
    const step = nextHomeworldPhaseOccupation(game);
    assert.ok(step, `Choose the actual native control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actHomeworldPhaseOccupation(game, step.actor, step.action, actions);
  }
  throw Error('The original occupied-income source did not reach its finite boundary');
}
export function finishHomeworldPhaseOccupation(game: Game, actions: HomeworldPhaseOccupationStep[] = []): Game {
  return advanceHomeworldPhaseOccupation(game, state => state.turn === 2 && state.phase === 0 && homeworldPhaseOccupationClean(state), actions);
}

/** Public Atreides/Ecaz/Ixians +all3 selected decks, independent cards, Worlds,
 * Tech and optional Advanced Strongholds. Atreides actually spends its native10
 * to ship all10 Caladan normal counters into already-held Arrakeen; Ecaz then
 * pays1 for an original normal counter from its own World into empty Caladan.
 * The accepted arrival records sole occupation. Only the shared source's
 * original scalar and unopened Spice lotteries are controlled. No card, army,
 * wallet, World owner, qualification, income ledger or clock is installed.
 * Stop at the real final Movement actor before automatic Collection credit. */
export function createHomeworldPhaseOccupationFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false, native = 'atreides', owner = 'ecaz', techOwner = 'ixians';
  const world = 'homeworld:atreides', card = 'caladan' as const;
  const source = createMixedPhaseModulesFixture({ factions: [native, owner, techOwner],
    expansions: ['ix', 'choam', 'ecaz'], advanced, homeworlds: true,
    tech: true, strongholds: advanced, independent: true });
  let game = source.game;
  const actions = [...source.actions];
  const act = (actor: string, action: Action) => { game = actHomeworldPhaseOccupation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceHomeworldPhaseOccupation(game, until, actions); };
  const transition = (run: () => void): HomeworldPhaseOccupationTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  assert.ok(game.homeworldOccupationPreview && game.homeworldOccupationHistory);
  assert.equal(game.homeworldOccupationHistory.qualifications.length, 0);
  assert.equal(game.techTokens?.heighliners.owner, techOwner);
  reach(state => state.phase === 5 && state.active === native && homeworldPhaseOccupationClean(state));
  assert.equal(homeworldPhaseOccupationPlayer(game, native).reserves, 10);
  const evacuationSources = nativeShipmentSources(viewGame(game, native), 10, 0); assert.ok(evacuationSources);
  const evacuationAction: Action = { type: 'ship', territory: 'arrakeen', sector: 10,
    amount: 10, elite: 0, allyPayment: 0, homeworldSources: evacuationSources };
  const evacuation = transition(() => { act(native, evacuationAction); reach(homeworldPhaseOccupationClean); });
  assert.equal(homeworldPhaseOccupationPlayer(game, native).reserves, 0);
  assert.equal(homeworldPhaseOccupationPlayer(game, native).forces['arrakeen:10'], 20);
  assert.equal(homeworldPhaseOccupationPlayer(evacuation.before, native).spice - homeworldPhaseOccupationPlayer(game, native).spice, 10);
  assert.equal(quoteStableHomeworldOccupation(game, card).entitlement, null);
  reach(state => state.phase === 5 && state.active === owner && homeworldPhaseOccupationClean(state));
  const incomingSources = nativeShipmentSources(viewGame(game, owner), 1, 0); assert.ok(incomingSources);
  const invasionQuote = homeworldShipmentChoice(viewGame(game, owner), world, incomingSources);
  assert.equal(invasionQuote.blocked, null); assert.ok(invasionQuote.action);
  const invasionAction = invasionQuote.action;
  const invasion = transition(() => { act(owner, invasionAction); reach(homeworldPhaseOccupationClean); });
  assert.equal(homeworldPhaseOccupationPlayer(invasion.before, owner).spice - homeworldPhaseOccupationPlayer(game, owner).spice, 1);
  assert.deepEqual(game.homeworlds?.custody?.visitors[world]?.[owner], { normal: 1, elite: 0 });
  const qualification = game.homeworldOccupationHistory!.qualifications.find(q => q.world === world && q.player === owner);
  assert.ok(qualification, 'The actual accepted sole arrival records the original qualification');
  const stable = quoteStableHomeworldOccupation(game, card);
  assert.equal(stable.blocked, null); assert.ok(stable.entitlement);
  assert.equal(stable.entitlement.qualification, qualification.event);
  assert.equal(stable.entitlement.occupier, owner); assert.equal(stable.entitlement.spice, 2);
  assert.equal(stable.entitlement.ally, null);
  homeworldGameIntegrity(game);
  reach(state => state.phase === 5 && state.active === techOwner && homeworldPhaseOccupationClean(state));
  assert.equal(game.order.at(-1), techOwner);
  assert.equal(game.techTokens?.heighliners.spice, 1);
  assert.deepEqual(homeworldPhaseOccupationInventory(game), source.originalInventory);
  return { ...source, game, sourceGame: structuredClone(game), advanced, native, owner, techOwner,
    world, card, current: techOwner, action: { type: 'endMovement' } as Action,
    evacuationSources, evacuationAction, evacuation, incomingSources, invasionQuote, invasionAction, invasion,
    qualification: structuredClone(qualification), entitlement: structuredClone(stable.entitlement),
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[] };
}
export type HomeworldPhaseOccupationFixture = ReturnType<typeof createHomeworldPhaseOccupationFixture>;

/** The original final Movement action pays its pending Tech first; original
 * Collection then automatically credits the unallied occupier's printed2.
 * Actual END Mentat later claims the six separate Stronghold cards. */
export function completeHomeworldPhaseOccupation(f: HomeworldPhaseOccupationFixture, state = f.game) {
  let game = state;
  const actions: HomeworldPhaseOccupationStep[] = [];
  const act = (actor: string, action: Action) => { game = actHomeworldPhaseOccupation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceHomeworldPhaseOccupation(game, until, actions); };
  const transition = (run: () => void): HomeworldPhaseOccupationTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const collection = transition(() => { act(f.current, f.action); reach(state => state.phase === 7 && homeworldPhaseOccupationClean(state)); });
  const history = game.homeworldOccupiedIncomeHistory?.find(receipt => receipt.turn === game.turn &&
    receipt.queue.some(row => row.world === f.world)); assert.ok(history);
  const incomeReceipt = history.receipts.find(receipt => receipt.world === f.world); assert.ok(incomeReceipt);
  const mentat = transition(() => { game = finishHomeworldPhaseOccupation(game, actions); });
  homeworldGameIntegrity(game);
  assert.deepEqual(homeworldPhaseOccupationInventory(game), f.originalInventory);
  return { game, collection, incomeHistory: structuredClone(history), incomeReceipt: structuredClone(incomeReceipt),
    mentat, actions, actionCount: actions.length };
}
