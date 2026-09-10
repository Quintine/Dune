import {
  nexusGuildSecretAllyCanAct,
  nexusGuildSecretAllyQuote,
} from './nexus-guild-secret-ally-options';
import { nexusGuildShipmentAvailable } from './nexus-guild-cunning-options';
import type { Action, GameView } from './engine';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import {
  HomeworldCustodyError,
  type HomeworldCustody,
  type HomeworldForces,
} from './homeworld-custody';
import { quoteHomeworldShipment } from './homeworld-shipment';

export type HomeworldShipmentSources = Record<string, HomeworldForces>;
export function homeworldName(view: GameView, id: string): string {
  const home = view.homeworlds?.worlds?.find((world) => world.id === id);
  return (
    HOMEWORLD_CARDS.find((card) => card.id === home?.card)?.name ?? 'Homeworld'
  );
}

/** Only public physical counters and the actor's own available funding enter
 * the quote. Foreign garrisons are never relabelled as native reserves. */
export function homeworldShipmentChoice(
  view: GameView,
  destination: string,
  sources: HomeworldShipmentSources,
  allyPayment = 0,
  nexus?: string,
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
  const option = view.homeworldShipment;
  const worlds = view.homeworlds?.worlds;
  const me = view.players.find((player) => player.id === view.me);
  if (
    !option ||
    !worlds?.length ||
    !me ||
    view.status !== 'playing' ||
    view.phase !== 5 ||
    view.active !== view.me ||
    !nexusGuildShipmentAvailable(view)
  ) {
    result.blocked = 'Use Homeworld shipment during your unused shipment turn.';
    return result;
  }
  if (option.blocked) {
    result.blocked = option.blocked;
    return result;
  }
  const context = {
    advanced: view.advanced,
    players: view.players.map((player) => ({
      id: player.id,
      faction: player.faction,
      reserves: player.reserves,
      eliteReserves: player.elites?.reserves ?? 0,
      ally: player.ally ?? null,
    })),
  };
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
    const quote = quoteHomeworldShipment(context, custody, {
      player: me.id,
      destination,
      sources,
    });
    const nexusQuote =
      nexus === undefined
        ? null
        : nexusGuildSecretAllyQuote(view, destination, quote.amount);
    if (
      nexus !== undefined &&
      (!nexusQuote || nexus !== view.nexusGuildSecretAlly?.event)
    ) {
      result.blocked = 'Choose a current Guild Secret Ally shipment offer.';
      return result;
    }
    const cost = nexusQuote?.cost ?? quote.cost;
    result.cost = cost;
    result.amount = quote.amount;
    result.elite = quote.elite;
    result.ownPayment = cost - allyPayment;
    if (
      !Number.isSafeInteger(allyPayment) ||
      allyPayment < 0 ||
      allyPayment > cost ||
      allyPayment > (me.ally ? view.aid.available : 0)
    )
      result.blocked =
        'Choose an allied contribution within the current pledge and shipment price.';
    else if (result.ownPayment > (me.spice ?? 0))
      result.blocked =
        'Your spice and selected allied contribution cannot pay this shipment.';
    else
      result.action = {
        type: 'homeworldShip',
        event: option.event,
        destination,
        sources,
        allyPayment,
        ...(nexus === undefined ? {} : { nexus }),
      };
  } catch (error) {
    if (!(error instanceof HomeworldCustodyError)) throw error;
    result.blocked = error.message;
  }
  return result;
}

/** Public tactical candidates retain a native defense and spice for the battle.
 * Higher levels reinforce contested invasions and budget for native strength. */
export function homeworldShipmentActions(
  view: GameView,
  level: number,
): Action[] {
  const me = view.players.find((player) => player.id === view.me);
  const worlds = view.homeworlds?.worlds;
  if (
    !me ||
    !worlds?.length ||
    !view.homeworldShipment ||
    view.homeworldShipment.blocked ||
    view.phase !== 5 ||
    view.active !== me.id ||
    !nexusGuildShipmentAvailable(view)
  )
    return [];
  const useNexus = nexusGuildSecretAllyCanAct(view);
  const difficulty = Math.max(0, Math.min(3, level));
  const budget = Math.max(
    0,
    (me.spice ?? 0) + view.aid.available - [2, 3, 3, 2][difficulty],
  );
  const sources = worlds.filter(
    (world) =>
      (world.forces[me.id]?.normal ?? 0) + (world.forces[me.id]?.elite ?? 0) >
      0,
  );
  const targets = worlds
    .filter(
      (world) =>
        (world.native !== me.id || me.faction === 'guild') &&
        world.native !== me.ally,
    )
    .map((world) => {
      const enemies = Object.entries(world.forces).filter(
        ([owner]) => owner !== me.id && owner !== me.ally,
      );
      const enemy = enemies.reduce(
        (sum, [, forces]) =>
          sum + forces.normal + forces.elite * (view.advanced ? 2 : 1),
        0,
      );
      const native = world.forces[world.native];
      const strength =
        enemy +
        (world.native !== me.id && native.normal + native.elite > 0
          ? world.nativeBattleStrength
          : 0);
      const own = world.forces[me.id];
      const existing =
        (own?.normal ?? 0) + (own?.elite ?? 0) * (view.advanced ? 2 : 1);
      return {
        world,
        strength,
        existing,
        score: (existing > 0 && enemy > 0 ? 10 + difficulty * 3 : 0) - strength,
      };
    })
    .sort((a, b) => b.score - a.score || a.world.id.localeCompare(b.world.id));
  const sourceGroups = sources.map((source) => [source]);
  const imperial = sources.filter((source) => source.native === me.id);
  if (view.advanced && me.faction === 'emperor' && imperial.length === 2)
    sourceGroups.push(imperial);
  const actions: Action[] = [];
  for (const target of targets) {
    if (
      target.world.native === me.id &&
      target.world.side === 'high' &&
      target.strength === 0
    )
      continue;
    const required = Math.max(
      1,
      target.strength + [0, 1, 2, 3][difficulty] - target.existing,
    );
    for (const group of sourceGroups) {
      if (group.some((source) => source.id === target.world.id)) continue;
      const pools = group.map((source) => {
        const force = source.forces[me.id];
        const keep =
          source.native !== me.id
            ? 0
            : source.secondary
              ? Math.min(2, force.elite)
              : [3, 3, 4, 3][difficulty];
        return {
          source,
          force,
          capacity: Math.max(0, force.normal + force.elite - keep),
        };
      });
      const amount = Math.min(
        pools.reduce((sum, pool) => sum + pool.capacity, 0),
        [3, 5, 7, 9][difficulty],
        budget * (me.faction === 'guild' || useNexus ? 2 : 1),
        Math.max([1, 3, 4, 5][difficulty], required),
      );
      if (amount <= 0) continue;
      let remaining = amount;
      const selection: HomeworldShipmentSources = {};
      for (const pool of [...pools].sort((a, b) =>
        difficulty > 0
          ? b.force.elite - a.force.elite
          : a.source.id.localeCompare(b.source.id),
      )) {
        const count = Math.min(remaining, pool.capacity);
        if (!count) continue;
        const availableElite = pool.source.secondary
          ? Math.max(0, pool.force.elite - 2)
          : pool.force.elite;
        const elite =
          difficulty > 0
            ? Math.min(count, availableElite)
            : Math.max(0, count - pool.force.normal);
        selection[pool.source.id] = { normal: count - elite, elite };
        remaining -= count;
      }
      const elite = Object.values(selection).reduce(
        (sum, forces) => sum + forces.elite,
        0,
      );
      const strength = amount + (view.advanced ? elite : 0);
      if (
        strength + target.existing <
        target.strength + (difficulty > 0 ? 1 : 0)
      )
        continue;
      const nexus =
        useNexus && amount > 1 ? view.nexusGuildSecretAlly!.event : undefined;
      const initial = homeworldShipmentChoice(
        view,
        target.world.id,
        selection,
        0,
        nexus,
      );
      const quote = homeworldShipmentChoice(
        view,
        target.world.id,
        selection,
        Math.max(0, initial.cost - (me.spice ?? 0)),
        nexus,
      );
      if (
        quote.action &&
        !actions.some(
          (action) => JSON.stringify(action) === JSON.stringify(quote.action),
        )
      )
        actions.push(quote.action);
    }
  }
  return actions;
}
