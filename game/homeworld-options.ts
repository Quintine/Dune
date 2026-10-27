import type { Action, GameView } from './engine';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import {
  type HomeworldCustody,
  type HomeworldCustodyContext,
  type HomeworldForces,
  homeworldForceGroups,
  HomeworldCustodyError,
} from './homeworld-custody';
import {
  EmperorHomeworldMoveError,
  quoteEmperorHomeworldMove,
  type EmperorHomeworldMove,
} from './homeworld-emperor-move';
import {
  NativeReserveError,
  quoteNativeReserveWithdrawal,
  type NativeReserveSelections,
} from './homeworld-native-reserves';
import { imperialFlightPools, imperialFlightCohort } from './ornithopter-homeworld';
import { validateCohortSelection, type OrnithopterMode } from './ornithopter';
import { richeseCardDefinition } from './richese-cards';

/** Reconstitute only the public physical custody accepted by the shared quotes.
 * Private hands, plans, reserve decks and random state are never consulted. */
function publicCustody(view: GameView) {
  const worlds = view.homeworlds?.worlds;
  if (!worlds?.length) return null;
  const context = {
    advanced: view.advanced,
    players: view.players.map((p) => ({
      id: p.id,
      faction: p.faction,
      reserves: p.reserves,
      eliteReserves: p.elites?.reserves ?? 0,
    })),
  };
  const custody: HomeworldCustody = { salusa: null, visitors: {} };
  for (const home of worlds) {
    if (home.secondary) custody.salusa = { ...home.forces[home.native] };
    const visitors = Object.entries(home.forces).filter(
      ([owner]) => owner !== home.native,
    );
    if (visitors.length)
      custody.visitors[home.id] = Object.fromEntries(
        visitors.map(([owner, forces]) => [owner, { ...forces }]),
      );
  }
  return { context, custody, worlds };
}

/** A deterministic explicit source choice for an ordinary native shipment.
 * Amount includes elites. Null means no applicable/valid allocation; zero is
 * valid physical custody even when the shipment route has other requirements. */
export function nativeShipmentSources(
  view: GameView,
  amount: number,
  elite = 0,
): NativeReserveSelections | null {
  const physical = publicCustody(view);
  if (!physical) return null;
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > 20 ||
    !Number.isSafeInteger(elite) ||
    elite < 0 ||
    elite > amount
  )
    return null;
  return nativeReserveSources(physical.context, physical.custody, view.me, {
    normal: amount - elite,
    elite,
  });
}

/** Shared deterministic custody choice for public clients and server-generated
 * shipment witnesses. This has no viewGame dependency or action permission. */
export function nativeReserveSources(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  actor: string,
  requested: HomeworldForces,
): NativeReserveSelections | null {
  try {
    const remaining = { ...requested };
    const sources: Record<string, { normal: number; elite: number }> = {};
    const homes = homeworldForceGroups(context, custody)
      .filter((home) => home.native === actor)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const home of homes) {
      const available = home.forces[actor];
      sources[home.id] = {
        normal: Math.min(remaining.normal, available.normal),
        elite: Math.min(remaining.elite, available.elite),
      };
      remaining.normal -= sources[home.id].normal;
      remaining.elite -= sources[home.id].elite;
    }
    quoteNativeReserveWithdrawal(context, custody, actor, requested, sources);
    return sources;
  } catch (error) {
    if (
      error instanceof NativeReserveError ||
      error instanceof HomeworldCustodyError
    )
      return null;
    throw error;
  }
}

/** Preserve human source choices; add a source choice for generated ordinary
 * shipments. No-Fields and disabled modules retain their own route semantics. */
export function withNativeShipmentSources(
  view: GameView,
  action: Action,
): Action | null {
  if (
    action.type !== 'ship' ||
    action.noField !== undefined ||
    !view.homeworlds
  )
    return action;
  if (typeof action.amount !== 'number') return null;
  const me = view.players.find((p) => p.id === view.me);
  if (!me) return null;
  const elite =
    action.elite ??
    Math.max(0, action.amount - (me.reserves - (me.elites?.reserves ?? 0)));
  if (typeof elite !== 'number') return null;
  const sources =
    action.homeworldSources !== undefined
      ? action.homeworldSources
      : nativeShipmentSources(view, action.amount, elite);
  const physical = publicCustody(view);
  if (!physical || !sources) return null;
  try {
    quoteNativeReserveWithdrawal(
      physical.context,
      physical.custody,
      view.me,
      { normal: action.amount - elite, elite },
      sources as NativeReserveSelections,
    );
    return { ...action, homeworldSources: sources };
  } catch (error) {
    if (
      error instanceof NativeReserveError ||
      error instanceof HomeworldCustodyError
    )
      return null;
    throw error;
  }
}

/** One exact native World route, optionally declaring or continuing the actual
 * physical flight. Ornithopter supplies no new route or World range benefit. */
export function emperorHomeworldMoveAction(
  view: GameView,
  order: EmperorHomeworldMove,
  mode?: OrnithopterMode,
): Action | null {
  const movement = view.homeworldMove;
  const me = view.players.find(p => p.id === view.me);
  const flight = view.ornithopter?.active;
  if (
    !movement ||
    movement.blocked ||
    (flight ? flight.remaining <= 0 : movement.remaining <= 0) ||
    !view.advanced ||
    view.status !== 'playing' ||
    view.phase !== 5 ||
    view.active !== view.me ||
    me?.faction !== 'emperor' || view.response || view.decision || view.truthtrance ||
    view.phaseOpening || view.automaticContinuationPending || view.nexusTraitors?.pending ||
    view.roomControl?.paused || view.roomControl?.closed
  )
    return null;
  const physical = publicCustody(view);
  if (!physical) return null;
  let envelope: Partial<Action> = {};
  if (flight) {
    const needsCohort = flight.mode === 'twoGroups' && flight.completed === 1;
    if ((needsCohort && !flight.cohort) || !flight.event || (mode !== undefined && mode !== flight.mode) ||
        richeseCardDefinition(view.ornithopter!.card)?.card.effect !== 'ornithopter') return null;
    if (needsCohort) {
      try {
        const pools = imperialFlightPools(me.forces, me.elites?.forces ?? {}, physical.worlds, me.id);
        const cohort = imperialFlightCohort(flight.cohort!, flight.homeworldCohort === true, physical.worlds, me.id);
        validateCohortSelection(cohort, pools.forces, pools.elites,
          { [order.origin]: order.forces.normal + order.forces.elite }, { [order.origin]: order.forces.elite });
      } catch (error) {
        if (error instanceof RangeError || error instanceof TypeError) return null;
        throw error;
      }
    }
    envelope = { ornithopterEvent: flight.event };
  } else if (mode !== undefined) {
    const card = view.ornithopter;
    if (!card || card.blocked || !card.modes.some(option => option.mode === mode && !option.blocked) ||
        !me.hand?.some(held => held.id === card.card.id && richeseCardDefinition(held)?.card.effect === 'ornithopter'))
      return null;
    envelope = { movementCard: card.card.id, ornithopter: mode };
  }
  try {
    quoteEmperorHomeworldMove({ ...physical.context, status: view.status, phase: view.phase,
      currentPlayer: view.active, movesLeft: Math.max(movement.remaining, flight?.remaining ?? 0) },
    physical.custody, view.me, order);
    return { type: 'emperorHomeworldMove', event: movement.event, origin: order.origin,
      normal: order.forces.normal, elite: order.forces.elite, ...envelope };
  } catch (error) {
    if (error instanceof EmperorHomeworldMoveError || error instanceof HomeworldCustodyError)
      return null;
    throw error;
  }
}

/** Keep the ordinary threshold repair first. Actual card candidates merely
 * supply legal participation; original typed quotas cap a continuing group. */
export function emperorHomeworldMoveActions(view: GameView): Action[] {
  if (!view.homeworldMove || view.homeworldMove.blocked || !view.advanced ||
      view.status !== 'playing' || view.phase !== 5 || view.active !== view.me ||
      view.players.find(p => p.id === view.me)?.faction !== 'emperor') return [];
  const physical = publicCustody(view);
  if (!physical) return [];
  const kaitain = physical.worlds.find(
    (home) => home.native === view.me && home.card === 'kaitain',
  );
  const salusa = physical.worlds.find(
    (home) => home.native === view.me && home.card === 'salusa_secundus',
  );
  if (!kaitain || !salusa) return [];
  const kaitainMinimum = HOMEWORLD_CARDS.find((card) => card.id === 'kaitain')!
    .high.reserves.min;
  const salusaMinimum = HOMEWORLD_CARDS.find(
    (card) => card.id === 'salusa_secundus',
  )!.high.reserves.min;
  const atKaitain = kaitain.forces[view.me],
    atSalusa = salusa.forces[view.me];
  const salusaDeficit = Math.max(0, salusaMinimum - atSalusa.elite);
  const kaitainDeficit = Math.max(
    0,
    kaitainMinimum - atKaitain.normal - atKaitain.elite,
  );
  let order: EmperorHomeworldMove | null = null;
  if (salusaDeficit > 0 && atKaitain.elite >= salusaDeficit)
    order = {
      origin: 'homeworld:emperor',
      forces: { normal: 0, elite: salusaDeficit },
    };
  else if (kaitainDeficit > 0 && atSalusa.normal >= kaitainDeficit)
    order = {
      origin: 'homeworld:emperor:salusa',
      forces: { normal: kaitainDeficit, elite: 0 },
    };
  const active = view.ornithopter?.active;
  const actions: Action[] = [];
  if (order && !active) {
    const ordinary = emperorHomeworldMoveAction(view, order);
    if (ordinary) actions.push(ordinary);
  }
  if (!view.ornithopter) return actions;
  const needsCohort = active?.mode === 'twoGroups' && active.completed === 1;
  let cohort = needsCohort ? active.cohort : undefined;
  if (needsCohort && !cohort) return actions;
  if (cohort) cohort = imperialFlightCohort(cohort, active?.homeworldCohort === true, physical.worlds, view.me);
  const orders: EmperorHomeworldMove[] = [];
  for (const home of [salusa, kaitain]) {
    const group = home.forces[view.me];
    const normal = cohort ? Math.min(group.normal, (cohort.forces[home.id] ?? 0) - (cohort.elites[home.id] ?? 0)) : group.normal;
    const elite = cohort ? Math.min(group.elite, cohort.elites[home.id] ?? 0) : group.elite;
    if (order?.origin === home.id) {
      const capped = { normal: Math.min(order.forces.normal, normal), elite: Math.min(order.forces.elite, elite) };
      if (capped.normal + capped.elite > 0) orders.push({ origin: order.origin, forces: capped });
    }
    if (normal > 0) orders.push({ origin: home.id as EmperorHomeworldMove['origin'], forces: { normal: 1, elite: 0 } });
    if (elite > 0) orders.push({ origin: home.id as EmperorHomeworldMove['origin'], forces: { normal: 0, elite: 1 } });
  }
  for (const candidate of orders) for (const mode of active ? [undefined] : ['range3', 'twoGroups'] as const) {
    const action = emperorHomeworldMoveAction(view, candidate, mode);
    if (action && !actions.some(earlier => JSON.stringify(earlier) === JSON.stringify(action))) actions.push(action);
  }
  return actions;
}
