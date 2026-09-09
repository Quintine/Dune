import type { Action, GameView } from './engine';
import {
  gameTerritories,
  MOBILE_LOCATION,
  MOBILE_STRONGHOLD,
  splitLocation,
} from './board';
import { arrivalAsAdvisor, forceCount } from './advisors';
import { territoryEntryBlock } from './occupancy';
import {
  HomeworldCustodyError,
  type HomeworldCustody,
} from './homeworld-custody';
import { quoteJunctionTransport } from './junction-transport';
import {
  homeworldName,
  type HomeworldShipmentSources,
} from './homeworld-shipment-options';
import { liveShipmentPromises, matchesShipment } from './shipment-promises';

export function junctionTransportOrigins(view: GameView) {
  const me = view.players.find((player) => player.id === view.me);
  if (!me) return [];
  const worlds = (view.homeworlds?.worlds ?? []).flatMap((world) => {
    const pool = world.forces[me.id];
    return pool && pool.normal + pool.elite > 0
      ? [
          {
            id: world.id,
            name: homeworldName(view, world.id),
            native: world.native === me.id,
            kind: 'homeworld' as const,
            pools: [
              {
                key: world.id,
                name: homeworldName(view, world.id),
                sector: null as number | null,
                ...pool,
              },
            ],
          },
        ]
      : [];
  });
  const board = gameTerritories(view).flatMap((territory) => {
    const pools = Object.entries(me.forces).flatMap(([key, amount]) => {
      if (amount <= 0 || splitLocation(key).territory !== territory.id)
        return [];
      const sector = key === MOBILE_LOCATION ? null : splitLocation(key).sector;
      return [
        {
          key,
          name: `${territory.name}${sector ? ` sector ${sector}` : ''}`,
          sector,
          normal: amount - (me.elites?.forces[key] ?? 0),
          elite: me.elites?.forces[key] ?? 0,
        },
      ];
    });
    return pools.length
      ? [
          {
            id: territory.id,
            name: territory.name,
            native: false,
            kind: 'arrakis' as const,
            pools,
          },
        ]
      : [];
  });
  const imperial = worlds.filter((world) => world.native);
  return [
    ...worlds,
    ...(me.faction === 'emperor' && view.advanced && imperial.length === 2
      ? [
          {
            id: 'imperial-worlds',
            name: 'Kaitain and Salusa Secundus',
            native: true,
            kind: 'homeworld' as const,
            pools: imperial.flatMap((world) => world.pools),
          },
        ]
      : []),
    ...board,
  ];
}

export function junctionTransportDestinations(view: GameView) {
  const me = view.players.find((player) => player.id === view.me);
  if (!me) return [];
  return [
    ...(view.homeworlds?.worlds ?? [])
      .filter((world) => world.native !== me.ally)
      .map((world) => ({
        id: world.id,
        name: `${homeworldName(view, world.id)}${world.native === me.id ? ' · own Homeworld' : ''}`,
      })),
    ...gameTerritories(view)
      .filter((t) => t.id !== MOBILE_STRONGHOLD || me.faction === 'ixians')
      .flatMap((t) =>
        t.sectors.map((sector) => ({
          id: `${t.id}:${sector}`,
          name: `${t.name}${sector ? ` · sector ${sector}` : ''}${sector && sector === view.storm ? ' · storm' : ''}`,
        })),
      ),
  ];
}

/** Reconstruct public world custody and read only the recipient's own balance.
 * Ordinary arrival/advisor and promise helpers are shared with the engine. */
export function junctionTransportChoice(
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
    advisors: boolean;
    action: Action | null;
  } = {
    blocked: null,
    cost: 0,
    amount: 0,
    elite: 0,
    ownPayment: 0,
    allyPayment,
    advisors: false,
    action: null,
  };
  const me = view.players.find((player) => player.id === view.me);
  const option = view.junctionTransport;
  const offer = option?.offer;
  if (
    !me ||
    !option ||
    !offer ||
    option.recipient !== me.id ||
    offer.recipient !== me.id ||
    offer.owner !== option.owner ||
    offer.turn !== view.turn ||
    view.status !== 'playing' ||
    view.phase !== 5 ||
    view.active !== me.id ||
    me.shipped
  ) {
    result.blocked =
      'Guild must offer Junction transport during your unused shipment turn.';
    return result;
  }
  if (option.blocked) {
    result.blocked = option.blocked;
    return result;
  }
  const custody: HomeworldCustody = { salusa: null, visitors: {} };
  for (const world of view.homeworlds?.worlds ?? []) {
    if (world.secondary) custody.salusa = { ...world.forces[world.native] };
    const visitors = Object.entries(world.forces).filter(
      ([id]) => id !== world.native,
    );
    if (visitors.length)
      custody.visitors[world.id] = Object.fromEntries(
        visitors.map(([id, forces]) => [id, { ...forces }]),
      );
  }
  try {
    const quote = quoteJunctionTransport(
      {
        advanced: view.advanced,
        storm: view.storm,
        mobileStronghold: view.mobileStronghold?.location ?? null,
        players: view.players.map((p) => ({
          id: p.id,
          faction: p.faction,
          reserves: p.reserves,
          eliteReserves: p.elites?.reserves ?? 0,
          ally: p.ally ?? null,
        })),
        board: {
          [me.id]: {
            forces: me.forces,
            eliteForces: me.elites?.forces ?? {},
            advisors: me.advisors,
          },
        },
      },
      custody,
      {
        player: me.id,
        sponsor: offer.owner,
        destination,
        sources,
        rate: offer.rate,
      },
    );
    Object.assign(result, {
      cost: quote.cost,
      amount: quote.amount,
      elite: quote.elite,
      ownPayment: quote.cost - allyPayment,
    });
    const arrival =
      quote.destinationKind === 'arrakis' ? splitLocation(destination) : null;
    if (arrival) {
      result.advisors = arrivalAsAdvisor(
        view,
        me,
        arrival.territory,
        quote.originKind === 'arrakis' ? quote.origin : undefined,
      );
      const entryBlock = territoryEntryBlock(
        view.players,
        me.id,
        arrival.territory,
        result.advisors,
      );
      if (arrival.territory === MOBILE_STRONGHOLD && me.faction !== 'ixians')
        result.blocked =
          'Only Ixians may ship directly into the mobile stronghold.';
      else if (arrival.sector !== 0 && arrival.sector === view.storm)
        result.blocked = 'That sector is in storm.';
      else if (entryBlock) result.blocked = entryBlock;
      else if (
        quote.originKind === 'arrakis' &&
        !result.advisors &&
        me.advisors?.[quote.origin]?.lockedTurn === view.turn &&
        view.players.some(
          (p) => p.id !== me.id && forceCount(p, arrival.territory),
        )
      )
        result.blocked = 'New advisors cannot become fighters this turn.';
    }
    const nativeOrigin =
      quote.originKind === 'homeworld' &&
      Object.keys(sources).every((key) =>
        view.homeworlds?.worlds?.some(
          (w) => w.id === key && w.native === me.id,
        ),
      );
    const promiseShipment =
      arrival && nativeOrigin
        ? { territory: arrival.territory, amount: quote.amount }
        : null;
    if (
      !result.blocked &&
      liveShipmentPromises(view.shipmentPromises ?? [], me.id, view.turn).some(
        (promise) =>
          matchesShipment(promise, promiseShipment) !== promise.answer,
      )
    )
      result.blocked =
        'This transport conflicts with your binding shipment answer.';
    if (
      !result.blocked &&
      (!Number.isSafeInteger(allyPayment) ||
        allyPayment < 0 ||
        allyPayment > quote.cost ||
        allyPayment > (me.ally ? view.aid.available : 0))
    )
      result.blocked =
        'Choose an allied contribution within the pledge and shipment price.';
    if (!result.blocked && result.ownPayment > (me.spice ?? 0))
      result.blocked =
        'Your spice and selected allied contribution cannot pay this transport.';
    if (!result.blocked)
      result.action = {
        type: 'junctionShip',
        event: option.event,
        offer: offer.event,
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

/** Sponsors offer once per opportunity. Recipients compare public targets,
 * preserve useful armies and increase their battle reserve with difficulty. */
export function junctionTransportActions(
  view: GameView,
  level: number,
): Action[] {
  const me = view.players.find((p) => p.id === view.me);
  const option = view.junctionTransport;
  if (!me || !option) return [];
  const difficulty = Math.max(0, Math.min(3, Math.trunc(level)));
  if (me.id === option.owner) {
    const rate =
      me.ally === option.recipient || difficulty === 0 ? 'half' : 'full';
    return option.canOffer && !option.offer
      ? [{ type: 'offerJunctionTransport', event: option.offerEvent, rate }]
      : [];
  }
  if (
    me.id !== option.recipient ||
    !option.offer ||
    option.blocked ||
    me.shipped ||
    view.active !== me.id ||
    view.phase !== 5
  )
    return [];
  const budget = Math.max(
    0,
    (me.spice ?? 0) +
      (me.ally ? view.aid.available : 0) -
      [1, 2, 3, 3][difficulty],
  );
  const spiceAt = (territory: string) =>
    Object.entries(view.spice).reduce(
      (sum, [key, amount]) =>
        sum + (splitLocation(key).territory === territory ? amount : 0),
      0,
    );
  const targets = junctionTransportDestinations(view)
    .map((target) => {
      const world = view.homeworlds?.worlds?.find((w) => w.id === target.id);
      const location = world ? null : splitLocation(target.id);
      const t = location
        ? gameTerritories(view).find((t) => t.id === location.territory)
        : null;
      const own = world
        ? (world.forces[me.id]?.normal ?? 0) + (world.forces[me.id]?.elite ?? 0)
        : forceCount(me, location!.territory);
      const enemy = world
        ? Object.entries(world.forces)
            .filter(([id]) => id !== me.id && id !== me.ally)
            .reduce(
              (n, [, pool]) =>
                n + pool.normal + pool.elite * (view.advanced ? 2 : 1),
              0,
            ) +
          (world.native !== me.id &&
          world.forces[world.native].normal + world.forces[world.native].elite >
            0
            ? world.nativeBattleStrength
            : 0)
        : view.players
            .filter((p) => p.id !== me.id && p.id !== me.ally)
            .reduce((n, p) => n + forceCount(p, location!.territory), 0);
      const defend =
        world?.native === me.id && (world.side === 'low' || enemy > 0);
      const score =
        (defend
          ? 20
          : world?.native === me.id
            ? -20
            : t?.type === 'stronghold'
              ? 12
              : world
                ? 5
                : spiceAt(location!.territory) > 0
                  ? 7
                  : -8) +
        (own > 0 && enemy > 0 ? 8 : 0) -
        enemy;
      return { ...target, own, enemy, score };
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const actions: Action[] = [];
  const seen = new Set<string>();
  for (const target of targets)
    for (const origin of junctionTransportOrigins(view)) {
      const pools = origin.pools.filter(
        (pool) =>
          pool.sector === null ||
          pool.sector === 0 ||
          pool.sector !== view.storm,
      );
      const total = pools.reduce((n, pool) => n + pool.normal + pool.elite, 0);
      const t = gameTerritories(view).find((t) => t.id === origin.id);
      const retain = origin.native
        ? [3, 4, 5, 6][difficulty]
        : t?.type === 'stronghold'
          ? [2, 3, 4, 4][difficulty]
          : spiceAt(origin.id) > 0
            ? Math.min(total, Math.ceil(spiceAt(origin.id) / 2))
            : 0;
      const desired = Math.max(
        [2, 3, 4, 5][difficulty],
        target.enemy + [0, 1, 2, 3][difficulty] - target.own,
      );
      for (
        let amount = Math.min(
          total - retain,
          desired,
          [4, 6, 8, 10][difficulty],
        );
        amount > 0;
        amount--
      ) {
        if (amount + target.own < target.enemy + (difficulty > 0 ? 1 : 0))
          break;
        let left = amount;
        const sources: HomeworldShipmentSources = {};
        for (const pool of pools) {
          const normal = Math.min(left, pool.normal);
          left -= normal;
          const elite = Math.min(left, pool.elite);
          left -= elite;
          if (normal + elite) sources[pool.key] = { normal, elite };
        }
        const initial = junctionTransportChoice(view, target.id, sources);
        if (initial.cost > budget) continue;
        const quote = junctionTransportChoice(
          view,
          target.id,
          sources,
          Math.max(0, initial.cost - (me.spice ?? 0)),
        );
        if (quote.action) {
          const key = JSON.stringify(quote.action);
          if (!seen.has(key)) {
            actions.push(quote.action);
            seen.add(key);
          }
          break;
        }
      }
    }
  return actions;
}
