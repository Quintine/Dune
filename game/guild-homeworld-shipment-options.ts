import { nexusGuildShipmentAvailable } from './nexus-guild-cunning-options';
import type { Action, GameView } from './engine';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import { gameTerritories, MOBILE_LOCATION, splitLocation } from './board';
import {
  HomeworldCustodyError,
  type HomeworldCustody,
} from './homeworld-custody';
import { quoteGuildHomeworldShipment } from './guild-homeworld-shipment';
import type { HomeworldShipmentSources } from './homeworld-shipment-options';

/** The quote uses public physical counters, never opposing private resources. */
export function guildHomeworldShipmentChoice(
  view: GameView,
  destination: string,
  sources: HomeworldShipmentSources,
  allyPayment = 0,
) {
  const result: {
    blocked: string | null;
    cost: number;
    amount: number;
    elite: number;
    ownPayment: number;
    allyPayment: number;
    action: Action | null;
  } = {
    blocked: null,
    cost: 0,
    amount: 0,
    elite: 0,
    ownPayment: 0,
    allyPayment,
    action: null,
  };
  const me = view.players.find((player) => player.id === view.me);
  const option = view.guildHomeworldShipment;
  const worlds = view.homeworlds?.worlds;
  if (
    !me ||
    me.faction !== 'guild' ||
    !option ||
    !worlds?.length ||
    view.status !== 'playing' ||
    view.phase !== 5 ||
    view.active !== me.id ||
    !nexusGuildShipmentAvailable(view)
  ) {
    result.blocked = 'Use Guild transport during your unused shipment turn.';
    return result;
  }
  if (option.blocked) {
    result.blocked = option.blocked;
    return result;
  }
  const custody: HomeworldCustody = { salusa: null, visitors: {} };
  for (const world of worlds) {
    if (world.secondary) custody.salusa = { ...world.forces[world.native] };
    const visitors = Object.entries(world.forces).filter(
      ([owner]) => owner !== world.native,
    );
    if (visitors.length)
      custody.visitors[world.id] = Object.fromEntries(
        visitors.map(([owner, forces]) => [owner, { ...forces }]),
      );
  }
  try {
    const quote = quoteGuildHomeworldShipment(
      {
        advanced: view.advanced,
        storm: view.storm,
        mobileStronghold: view.mobileStronghold?.location ?? null,
        players: view.players.map((player) => ({
          id: player.id,
          faction: player.faction,
          reserves: player.reserves,
          eliteReserves: player.elites?.reserves ?? 0,
          ally: player.ally ?? null,
        })),
        // Only the acting Guild map is needed. Concealed rival counters never enter.
        board: {
          [me.id]: { forces: me.forces, eliteForces: me.elites?.forces ?? {} },
        },
      },
      custody,
      { player: me.id, destination, sources },
    );
    result.cost = quote.cost;
    result.amount = quote.amount;
    result.elite = quote.elite;
    result.ownPayment = quote.cost - allyPayment;
    if (
      !Number.isSafeInteger(allyPayment) ||
      allyPayment < 0 ||
      allyPayment > quote.cost ||
      allyPayment > (me.ally ? view.aid.available : 0)
    )
      result.blocked =
        'Choose an allied contribution within the current pledge and shipment price.';
    else if (result.ownPayment > (me.spice ?? 0))
      result.blocked =
        'Your spice and selected allied contribution cannot pay this shipment.';
    else
      result.action = {
        type: 'guildHomeworldShip',
        event: option.event,
        destination,
        sources,
        allyPayment,
      };
  } catch (error) {
    if (!(error instanceof HomeworldCustodyError)) throw error;
    result.blocked = error.message;
  }
  return result;
}

/** Gather actual Guild counters by one Arrakis territory, retaining sectors. */
export function guildHomeworldShipmentOrigins(view: GameView) {
  const me = view.players.find((player) => player.id === view.me);
  if (!me || me.faction !== 'guild') return [];
  return gameTerritories(view).flatMap((territory) => {
    const pools = Object.entries(me.forces).flatMap(([key, amount]) => {
      if (splitLocation(key).territory !== territory.id || amount <= 0)
        return [];
      const elite = me.elites?.forces[key] ?? 0;
      return [
        {
          key,
          sector: key === MOBILE_LOCATION ? null : splitLocation(key).sector,
          normal: amount - elite,
          elite,
        },
      ];
    });
    return pools.length ? [{ territory, pools }] : [];
  });
}

/** Return exposed desert armies to a depleted Junction or reinforce attainable
 * invasions. Keep stronghold defenders and spice collectors on Arrakis. */
export function guildHomeworldShipmentActions(
  view: GameView,
  level: number,
): Action[] {
  const me = view.players.find((player) => player.id === view.me);
  if (
    !me ||
    me.faction !== 'guild' ||
    !view.guildHomeworldShipment ||
    view.guildHomeworldShipment.blocked ||
    !nexusGuildShipmentAvailable(view) ||
    view.phase !== 5 ||
    view.active !== me.id
  )
    return [];
  const difficulty = Math.max(0, Math.min(3, level));
  const budget = Math.max(
    0,
    (me.spice ?? 0) +
      (me.ally ? view.aid.available : 0) -
      [2, 3, 3, 2][difficulty],
  );
  const origins = guildHomeworldShipmentOrigins(view);
  const actions: Action[] = [];
  const targets = (view.homeworlds?.worlds ?? [])
    .filter((world) => world.native !== me.ally)
    .map((world) => {
      const enemy = Object.entries(world.forces)
        .filter(([id]) => id !== me.id && id !== me.ally)
        .reduce(
          (sum, [, pool]) =>
            sum + pool.normal + pool.elite * (view.advanced ? 2 : 1),
          0,
        );
      const native = world.forces[world.native];
      const strength =
        enemy +
        (world.native !== me.id && native.normal + native.elite > 0
          ? world.nativeBattleStrength
          : 0);
      const own = world.forces[me.id];
      const existing = (own?.normal ?? 0) + (own?.elite ?? 0);
      return { world, strength, existing };
    })
    .sort((a, b) =>
      a.world.native === me.id
        ? -1
        : b.world.native === me.id
          ? 1
          : a.strength - b.strength,
    );
  for (const target of targets) {
    if (
      target.world.native === me.id &&
      target.world.side === 'high' &&
      target.strength === 0
    )
      continue;
    for (const origin of origins) {
      const eligible = origin.pools.filter(
        (pool) => pool.sector !== view.storm,
      );
      const total = eligible.reduce(
        (sum, pool) => sum + pool.normal + pool.elite,
        0,
      );
      const retain =
        origin.territory.type === 'stronghold'
          ? [2, 3, 4, 4][difficulty]
          : (view.spice[origin.territory.id] ?? 0) > 0
            ? Math.min(total, Math.ceil(view.spice[origin.territory.id] / 2))
            : 0;
      const desired =
        target.world.native === me.id
          ? Math.max(
              1,
              (HOMEWORLD_CARDS.find((card) => card.id === target.world.card)
                ?.high.reserves.min ?? 5) - target.existing,
            )
          : Math.max(
              [1, 3, 4, 5][difficulty],
              target.strength + [0, 1, 2, 3][difficulty] - target.existing,
            );
      const amount = Math.min(
        total - retain,
        budget * 2,
        [3, 5, 7, 9][difficulty],
        desired,
      );
      if (
        amount <= 0 ||
        (target.world.native !== me.id &&
          amount + target.existing < target.strength + (difficulty > 0 ? 1 : 0))
      )
        continue;
      let remaining = amount;
      const sources: HomeworldShipmentSources = {};
      for (const pool of eligible) {
        const count = Math.min(remaining, pool.normal + pool.elite);
        if (!count) continue;
        sources[pool.key] = { normal: count, elite: 0 };
        remaining -= count;
      }
      const initial = guildHomeworldShipmentChoice(
        view,
        target.world.id,
        sources,
      );
      const quote = guildHomeworldShipmentChoice(
        view,
        target.world.id,
        sources,
        Math.max(0, initial.cost - (me.spice ?? 0)),
      );
      if (quote.action) actions.push(quote.action);
    }
  }
  return actions;
}
