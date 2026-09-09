import { FACTIONS, type FactionId } from './catalog';

/** Typed physical counters. Special identity also matters in Basic Homeworlds;
 * it does not by itself grant Advanced battle strength. */
export type HomeworldForces = { normal: number; elite: number };
export type HomeworldReserveSeat = {
  id: string;
  faction: FactionId;
  reserves: number;
  eliteReserves: number;
};
export type HomeworldCustodyContext = {
  advanced: boolean;
  players: readonly HomeworldReserveSeat[];
};
export type HomeworldLocation = {
  id: string;
  native: string;
  secondary: boolean;
};
export type HomeworldCustody = {
  /** Only foreign forces: native primary counts derive from the reserve totals. */
  visitors: Record<string, Record<string, HomeworldForces>>;
  /** Salusa allocation within Emperor's totals, not additional reserve forces. */
  salusa: HomeworldForces | null;
};
export type HomeworldCustodyChange = {
  homeworld: string;
  player: string;
  withdraw: HomeworldForces;
  deposit: HomeworldForces;
};
export type HomeworldCustodyReceipt = {
  homeworld: string;
  player: string;
  before: HomeworldForces;
  after: HomeworldForces;
};
export class HomeworldCustodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomeworldCustodyError';
  }
}
const empty = (): HomeworldForces => ({ normal: 0, elite: 0 });
const validFaction = (value: unknown): value is FactionId =>
  FACTIONS.some((f) => f.id === value);
const eliteLimit = (faction: FactionId) =>
  faction === 'emperor'
    ? 5
    : faction === 'fremen'
      ? 3
      : faction === 'ixians'
        ? 7
        : 0;
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
function requireCustody(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new HomeworldCustodyError(message);
}
function group(value: unknown): asserts value is HomeworldForces {
  requireCustody(
    record(value) &&
      Object.keys(value).length === 2 &&
      whole(value.normal) &&
      whole(value.elite) &&
      value.normal + value.elite <= 20,
    'Homeworld forces need valid physical normal and special counter counts.',
  );
}
function reserveSeats(
  context: HomeworldCustodyContext,
): HomeworldReserveSeat[] {
  requireCustody(
    record(context) &&
      typeof context.advanced === 'boolean' &&
      Array.isArray(context.players) &&
      context.players.length >= 2 &&
      context.players.length <= 6,
    'Homeworld custody needs a valid two-through-six-player configuration.',
  );
  const seats = context.players.map((p) => {
    requireCustody(
      record(p) &&
        identifier(p.id) &&
        validFaction(p.faction) &&
        whole(p.reserves) &&
        p.reserves <= 20 &&
        whole(p.eliteReserves) &&
        p.eliteReserves <= p.reserves &&
        p.eliteReserves <= eliteLimit(p.faction) &&
        (p.eliteReserves === 0 ||
          ['emperor', 'fremen', 'ixians'].includes(p.faction)),
      'Homeworld reserves need valid seated identities and typed totals.',
    );
    return {
      id: p.id,
      faction: p.faction,
      reserves: p.reserves,
      eliteReserves: p.eliteReserves,
    };
  });
  requireCustody(
    new Set(seats.map((p) => p.id)).size === seats.length &&
      new Set(seats.map((p) => p.faction)).size === seats.length,
    'Homeworld reserve seats and factions must be unique.',
  );
  return seats;
}
/** Stable software locations, deliberately outside the Arrakis sector registry. */
export function homeworldLocations(
  context: HomeworldCustodyContext,
): HomeworldLocation[] {
  return reserveSeats(context).flatMap((p) => [
    { id: `homeworld:${p.faction}`, native: p.id, secondary: false },
    ...(p.faction === 'emperor' && context.advanced
      ? [{ id: 'homeworld:emperor:salusa', native: p.id, secondary: true }]
      : []),
  ]);
}
function nativeForces(
  seat: HomeworldReserveSeat,
  home: HomeworldLocation,
  state: HomeworldCustody,
): HomeworldForces {
  if (home.secondary) return { ...state.salusa! };
  const split = seat.faction === 'emperor' ? state.salusa : null;
  return {
    normal: seat.reserves - seat.eliteReserves - (split?.normal ?? 0),
    elite: seat.eliteReserves - (split?.elite ?? 0),
  };
}
function validate(context: HomeworldCustodyContext, state: HomeworldCustody) {
  const seats = reserveSeats(context),
    homes = homeworldLocations(context);
  requireCustody(
    record(state) && Object.keys(state).length === 2 && record(state.visitors),
    'The saved Homeworld custody record is invalid.',
  );
  const emperor = seats.find((p) => p.faction === 'emperor');
  if (context.advanced && emperor) {
    group(state.salusa);
    requireCustody(
      state.salusa.normal <= emperor.reserves - emperor.eliteReserves &&
        state.salusa.elite <= emperor.eliteReserves,
      'Salusa forces must remain within Emperor’s current typed reserve totals.',
    );
  } else
    requireCustody(
      state.salusa === null,
      'Salusa is available only to an Advanced Emperor.',
    );
  const homeById = new Map(homes.map((h) => [h.id, h]));
  const byId = new Map(seats.map((p) => [p.id, p]));
  const away = new Map(seats.map((p) => [p.id, 0]));
  const awayElites = new Map(seats.map((p) => [p.id, 0]));
  for (const [id, visitors] of Object.entries(state.visitors)) {
    const home = homeById.get(id);
    requireCustody(
      home && record(visitors),
      'Foreign forces require an active Homeworld location.',
    );
    for (const [player, forces] of Object.entries(visitors)) {
      requireCustody(
        byId.has(player) && player !== home.native,
        'Native forces belong to their reserve totals, not a foreign-force pool.',
      );
      group(forces);
      away.set(player, away.get(player)! + forces.normal + forces.elite);
      awayElites.set(player, awayElites.get(player)! + forces.elite);
    }
  }
  for (const p of seats)
    requireCustody(
      p.reserves + away.get(p.id)! <= 20 &&
        p.eliteReserves + awayElites.get(p.id)! <= eliteLimit(p.faction),
      'Native reserves and foreign Homeworld forces exceed physical counter custody.',
    );
  return { seats, homes, homeById, byId };
}
/** Setup boundary only: all initial Sardaukar go to Salusa in Advanced play. */
export function createHomeworldCustody(
  context: HomeworldCustodyContext,
): HomeworldCustody {
  const seats = reserveSeats(context),
    emperor = seats.find((p) => p.faction === 'emperor');
  return {
    visitors: {},
    salusa:
      context.advanced && emperor
        ? { normal: 0, elite: emperor.eliteReserves }
        : null,
  };
}
export function homeworldForceGroups(
  context: HomeworldCustodyContext,
  state: HomeworldCustody,
) {
  const { homes, byId } = validate(context, state);
  return homes.map((home) => ({
    ...home,
    forces: Object.fromEntries([
      [home.native, nativeForces(byId.get(home.native)!, home, state)],
      ...Object.entries(state.visitors[home.id] ?? {}).map(([id, forces]) => [
        id,
        { ...forces },
      ]),
    ]) as Record<string, HomeworldForces>,
  }));
}
/** Custody transaction only. Callers must separately authorize shipment, revival,
 * movement or casualties and account for the matching planet/Tanks deltas.
 * Withdrawals use the source's pre-transaction pool; no silent Salusa clamping,
 * replacement type, threshold effect, occupation grant, payment or RNG occurs. */
export function quoteHomeworldCustody(
  context: HomeworldCustodyContext,
  state: HomeworldCustody,
  changes: readonly HomeworldCustodyChange[],
) {
  const { seats, homeById, byId } = validate(context, state);
  requireCustody(
    Array.isArray(changes),
    'Homeworld custody changes must be a list.',
  );
  const totals = new Map<string, HomeworldCustodyChange>();
  for (const change of changes) {
    requireCustody(
      record(change) &&
        identifier(change.homeworld) &&
        identifier(change.player) &&
        homeById.has(change.homeworld) &&
        byId.has(change.player),
      'Choose an active Homeworld and a seated faction.',
    );
    group(change.withdraw);
    group(change.deposit);
    const key = JSON.stringify([change.homeworld, change.player]);
    const total = totals.get(key) ?? {
      homeworld: change.homeworld,
      player: change.player,
      withdraw: empty(),
      deposit: empty(),
    };
    for (const kind of ['normal', 'elite'] as const) {
      total.withdraw[kind] += change.withdraw[kind];
      total.deposit[kind] += change.deposit[kind];
    }
    group(total.withdraw);
    group(total.deposit);
    totals.set(key, total);
  }
  const next: HomeworldCustody = {
    salusa: state.salusa ? { ...state.salusa } : null,
    visitors: Object.fromEntries(
      Object.entries(state.visitors).map(([id, pools]) => [
        id,
        Object.fromEntries(
          Object.entries(pools).map(([player, forces]) => [
            player,
            { ...forces },
          ]),
        ),
      ]),
    ),
  };
  const players = seats.map((p) => ({ ...p })),
    updates = new Map(players.map((p) => [p.id, p]));
  const receipts: HomeworldCustodyReceipt[] = [];
  for (const change of totals.values()) {
    const home = homeById.get(change.homeworld)!;
    const native = home.native === change.player;
    const before = native
      ? nativeForces(byId.get(change.player)!, home, state)
      : Object.hasOwn(state.visitors[home.id] ?? {}, change.player)
        ? state.visitors[home.id][change.player]
        : empty();
    requireCustody(
      change.withdraw.normal <= before.normal &&
        change.withdraw.elite <= before.elite,
      'The selected Homeworld does not hold those physical counters.',
    );
    const after = {
      normal: before.normal - change.withdraw.normal + change.deposit.normal,
      elite: before.elite - change.withdraw.elite + change.deposit.elite,
    };
    group(after);
    if (native) {
      const player = updates.get(change.player)!;
      player.reserves +=
        after.normal + after.elite - before.normal - before.elite;
      player.eliteReserves += after.elite - before.elite;
      if (home.secondary) next.salusa = after;
    } else if (after.normal + after.elite) {
      next.visitors[home.id] = {
        ...next.visitors[home.id],
        [change.player]: after,
      };
    } else {
      delete next.visitors[home.id]?.[change.player];
      if (next.visitors[home.id] && !Object.keys(next.visitors[home.id]).length)
        delete next.visitors[home.id];
    }
    receipts.push({
      homeworld: home.id,
      player: change.player,
      before: { ...before },
      after: { ...after },
    });
  }
  validate({ advanced: context.advanced, players }, next);
  return { players, state: next, receipts };
}
