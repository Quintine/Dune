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

/** Spend at most one movement restoring a printed high threshold. Salusa has
 * priority; normal-only returns to Kaitain cannot undo its Sardaukar repair. */
export function emperorHomeworldMoveActions(view: GameView): Action[] {
  const movement = view.homeworldMove;
  if (
    !movement ||
    movement.blocked ||
    movement.remaining <= 0 ||
    !view.advanced ||
    view.status !== 'playing' ||
    view.phase !== 5 ||
    view.active !== view.me ||
    view.players.find((p) => p.id === view.me)?.faction !== 'emperor'
  )
    return [];
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
  if (!order) return [];
  try {
    quoteEmperorHomeworldMove(
      {
        ...physical.context,
        status: view.status,
        phase: view.phase,
        currentPlayer: view.active,
        movesLeft: movement.remaining,
      },
      physical.custody,
      view.me,
      order,
    );
    return [
      {
        type: 'emperorHomeworldMove',
        event: movement.event,
        origin: order.origin,
        normal: order.forces.normal,
        elite: order.forces.elite,
      },
    ];
  } catch (error) {
    if (
      error instanceof EmperorHomeworldMoveError ||
      error instanceof HomeworldCustodyError
    )
      return [];
    throw error;
  }
}
