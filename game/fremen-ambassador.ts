import type { Action, Game, Player } from './engine';
import {
  gameTerritories,
  location,
  MOBILE_STRONGHOLD,
  splitLocation,
  validLocation,
} from './board';
import { arrivalAsAdvisor } from './advisors';
import { presenceAt } from './force-presence';
import { territoryEntryBlock } from './occupancy';
import { ecazOccupancyRelation } from './ecaz-occupy';

export class FremenAmbassadorMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FremenAmbassadorMoveError';
  }
}
export type FremenAmbassadorMove = {
  player: string;
  group: [string, number][];
  eliteGroup: Record<string, number>;
  elite: number;
  origin: string;
  total: number;
  to: string;
  sector: number;
  advisors: boolean;
  wantsFighters: boolean;
  lockedTurn?: number;
  noField?: { tokenId: string; event: string; from: string };
};
export type FremenAmbassadorMovement = {
  sources: {
    territory: string;
    sectors: { key: string; forces: number; elites: number }[];
    marker: { tokenId: string; event: string; sector: number } | null;
    destinations: {
      territory: string;
      sector: number;
      advisors: boolean;
      /** Whether an arriving advisor group can request a flip to fighters. */
      canFight: boolean;
    }[];
  }[];
};
function requireMove(value: unknown, message: string): asserts value {
  if (!value) throw new FremenAmbassadorMoveError(message);
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function clear(g: Game, sector: number) {
  return sector === 0 || sector !== g.storm;
}
function usableLocation(g: Game, key: string) {
  const at = splitLocation(key);
  return (
    location(at.territory, at.sector) === key &&
    validLocation(at.territory, at.sector) &&
    (at.territory !== MOBILE_STRONGHOLD || !!g.mobileStronghold?.location)
  );
}
function playerFor(g: Game, id: string) {
  requireMove(
    Array.isArray(g.players) &&
      g.players.length > 0 &&
      new Set(g.players.map((p) => p.id)).size === g.players.length,
    'Relocation requires unique seated players.',
  );
  requireMove(
    count(g.turn) &&
      g.turn > 0 &&
      count(g.phase) &&
      g.phase <= 8 &&
      count(g.storm) &&
      g.storm <= 18,
    'The relocation turn or storm is invalid.',
  );
  requireMove(
    !g.mobileStronghold?.location ||
      (usableLocation(g, g.mobileStronghold.location) &&
        splitLocation(g.mobileStronghold.location).territory !==
          MOBILE_STRONGHOLD),
    'The mobile stronghold must point to a board territory.',
  );
  for (const p of g.players) {
    requireMove(
      typeof p.id === 'string' &&
        p.id.length > 0 &&
        (!p.ally ||
          g.players.some((other) => other.id === p.ally && other.id !== p.id)),
      'The relocation player or alliance is invalid.',
    );
    requireMove(
      record(p.forces) && (!p.elites || record(p.elites.forces)),
      'Relocation requires a valid physical force inventory.',
    );
    for (const [key, n] of Object.entries(p.forces))
      requireMove(
        usableLocation(g, key) && count(n),
        'Invalid board force location or quantity.',
      );
    for (const [key, n] of Object.entries(p.elites?.forces ?? {}))
      requireMove(
        usableLocation(g, key) && count(n) && n <= (p.forces[key] ?? 0),
        'Elite forces must be part of the physical force inventory.',
      );
    const marker = p.noField?.deployed;
    requireMove(
      !marker ||
        usableLocation(
          g,
          location(marker.location.territory, marker.location.sector),
        ),
      'The concealed marker has an invalid board location.',
    );
    for (const [t, stance] of Object.entries(p.advisors ?? {}))
      requireMove(
        gameTerritories(g).some((candidate) => candidate.id === t) &&
          record(stance) &&
          (stance.lockedTurn === undefined || count(stance.lockedTurn)),
        'The advisor stance or lock is invalid.',
      );
  }
  const p = g.players.find((candidate) => candidate.id === id);
  requireMove(p, 'The beneficiary is not seated.');
  return p;
}
function ownMarker(p: Player) {
  const marker = p.noField?.deployed;
  if (!marker) return null;
  requireMove(
    p.faction === 'richese' &&
      marker.controller === p.id &&
      typeof marker.tokenId === 'string' &&
      marker.tokenId.length > 0 &&
      typeof p.noFieldEvent === 'string' &&
      p.noFieldEvent.length > 0,
    'The concealed marker custody is not current.',
  );
  return {
    tokenId: marker.tokenId,
    event: p.noFieldEvent,
    from: location(marker.location.territory, marker.location.sector),
  };
}

/** Pure board relocation only. The caller binds the Ambassador event, actor and
 * saved continuation. This never inspects cards, promises or marker denomination,
 * moves units, consumes movement, samples a draw, or creates an event. */
export function quoteFremenAmbassadorMove(
  g: Game,
  beneficiaryId: string,
  action: Action,
): FremenAmbassadorMove {
  const p = playerFor(g, beneficiaryId);
  requireMove(
    record(action.forces),
    'Choose a physical force group from one territory.',
  );
  requireMove(
    action.eliteForces === undefined || record(action.eliteForces),
    'Choose an elite allocation for the force group.',
  );
  requireMove(
    action.fighters === undefined || typeof action.fighters === 'boolean',
    'Choose whether arriving advisors request fighters.',
  );
  const group: [string, number][] = [];
  const eliteGroup: Record<string, number> = {};
  let origin: string | undefined;
  let noField: FremenAmbassadorMove['noField'];
  if (action.noField !== undefined) {
    const marker = ownMarker(p);
    requireMove(
      record(action.noField) &&
        marker &&
        action.noField.tokenId === marker.tokenId &&
        action.noField.event === marker.event,
      'The selected concealed marker is no longer current.',
    );
    noField = marker;
    origin = splitLocation(marker.from).territory;
    requireMove(
      clear(g, splitLocation(marker.from).sector),
      'The concealed marker cannot leave a sector in storm.',
    );
  }
  for (const [key, value] of Object.entries(action.forces)) {
    requireMove(
      usableLocation(g, key) && count(value) && value <= (p.forces[key] ?? 0),
      'Select available physical forces from valid sectors.',
    );
    if (!value) continue;
    const at = splitLocation(key);
    requireMove(
      !origin || origin === at.territory,
      'A force group must come from one territory.',
    );
    requireMove(clear(g, at.sector), 'Forces cannot leave a sector in storm.');
    origin = at.territory;
    const available = p.forces[key],
      eliteAvailable = p.elites?.forces[key] ?? 0;
    const minimum = Math.max(0, value - (available - eliteAvailable));
    const selectedElite =
      (action.eliteForces as Record<string, unknown> | undefined)?.[key] ??
      minimum;
    requireMove(
      count(selectedElite) &&
        selectedElite >= minimum &&
        selectedElite <= Math.min(value, eliteAvailable),
      'Choose an available elite allocation within the selected physical forces.',
    );
    group.push([key, value]);
    eliteGroup[key] = selectedElite;
  }
  for (const [key, value] of Object.entries(action.eliteForces ?? {}))
    requireMove(
      count(value) && (value === 0 || group.some(([source]) => source === key)),
      'Elite allocations must belong to selected physical forces.',
    );
  requireMove(
    origin && (group.length > 0 || noField),
    'Choose at least one physical force or the concealed marker.',
  );
  const to = action.territory,
    sector = action.sector;
  requireMove(
    typeof to === 'string' &&
      count(sector) &&
      usableLocation(g, location(to, sector)),
    'Choose a sector belonging to an available destination territory.',
  );
  requireMove(clear(g, sector), 'The destination sector is in storm.');
  const target = location(to, sector);
  requireMove(
    [...group.map(([key]) => key), ...(noField ? [noField.from] : [])].every(
      (key) => key !== target,
    ),
    'Select forces or a marker that actually change location.',
  );
  requireMove(
    to !== MOBILE_STRONGHOLD ||
      p.faction === 'ixians' ||
      origin === splitLocation(g.mobileStronghold?.location ?? '').territory,
    'Enter the mobile stronghold from the territory it points to.',
  );
  const advisors = arrivalAsAdvisor(g, p, to, origin);
  const lockedTurn = p.advisors?.[origin]?.lockedTurn;
  requireMove(
    advisors ||
      lockedTurn !== g.turn ||
      !g.players.some((other) => other.id !== p.id && presenceAt(other, to)),
    'New advisors cannot become fighters this turn.',
  );
  const wantsFighters = advisors && action.fighters === true;
  requireMove(
    !wantsFighters ||
      (lockedTurn !== g.turn &&
        !presenceAt(p, to) &&
        (!(
          p.ally &&
          presenceAt(
            g.players.find((other) => other.id === p.ally)!,
            to,
          )
        ) ||
          ecazOccupancyRelation(g.players, p.id, p.ally!, {
            kind: 'territory',
            id: to,
          }) === 'ecazAlliance')),
    'These advisors cannot flip to fighters on arrival.',
  );
  try {
    const blocked = territoryEntryBlock(
      g.players,
      p.id,
      to,
      advisors && !wantsFighters,
    );
    requireMove(!blocked, blocked ?? 'This destination cannot be entered.');
  } catch (error) {
    if (error instanceof FremenAmbassadorMoveError) throw error;
    throw new FremenAmbassadorMoveError(
      error instanceof Error ? error.message : 'Invalid territory occupancy.',
    );
  }
  const choam = g.players.find((other) => other.faction === 'choam');
  requireMove(
    !(
      g.phase === 5 &&
      origin !== to &&
      choam &&
      presenceAt(choam, to) > 0 &&
      g.choamBaliset?.some(
        (entry) =>
          entry.turn === g.turn &&
          entry.player === p.id &&
          entry.territory === to,
      )
    ),
    'Baliset prevents movement into that CHOAM territory.',
  );
  const physical = group.reduce((sum, [, n]) => sum + n, 0);
  const elite = Object.values(eliteGroup).reduce((sum, n) => sum + n, 0);
  const total = physical + (noField ? 1 : 0);
  requireMove(
    count(total) &&
      count(elite) &&
      count((p.forces[target] ?? 0) + physical) &&
      count((p.elites?.forces[target] ?? 0) + elite),
    'The resulting force quantity is invalid.',
  );
  return {
    player: p.id,
    group,
    eliteGroup,
    elite,
    origin,
    total,
    to,
    sector,
    advisors,
    wantsFighters,
    ...(lockedTurn === undefined ? {} : { lockedTurn }),
    ...(noField ? { noField } : {}),
  };
}

/** Finite existential source/destination domain; one minimum physical force or
 * marker witnesses each destination. No enumeration of force subsets is needed. */
export function fremenAmbassadorMovement(
  g: Game,
  beneficiaryId: string,
): FremenAmbassadorMovement {
  const p = playerFor(g, beneficiaryId);
  const marker = ownMarker(p);
  const sources: FremenAmbassadorMovement['sources'] = [];
  for (const t of gameTerritories(g)) {
    const sectors = Object.entries(p.forces)
      .filter(
        ([key, n]) =>
          n > 0 &&
          splitLocation(key).territory === t.id &&
          clear(g, splitLocation(key).sector),
      )
      .map(([key, forces]) => ({
        key,
        forces,
        elites: p.elites?.forces[key] ?? 0,
      }));
    const sourceMarker =
      marker &&
      splitLocation(marker.from).territory === t.id &&
      clear(g, splitLocation(marker.from).sector)
        ? {
            tokenId: marker.tokenId,
            event: marker.event,
            sector: splitLocation(marker.from).sector,
          }
        : null;
    if (!sectors.length && !sourceMarker) continue;
    const destinations: FremenAmbassadorMovement['sources'][number]['destinations'] =
      [];
    for (const to of gameTerritories(g))
      for (const sector of to.sectors) {
        if (!clear(g, sector)) continue;
        const target = location(to.id, sector);
        const source = sectors.find((candidate) => candidate.key !== target);
        const selectedMarker =
          !source && sourceMarker && marker!.from !== target
            ? sourceMarker
            : null;
        if (!source && !selectedMarker) continue;
        const action: Action = {
          type: 'decision',
          territory: to.id,
          sector,
          forces: source ? { [source.key]: 1 } : {},
          ...(selectedMarker
            ? {
                noField: {
                  tokenId: selectedMarker.tokenId,
                  event: selectedMarker.event,
                },
              }
            : {}),
        };
        try {
          const quote = quoteFremenAmbassadorMove(g, p.id, action);
          let canFight = false;
          if (quote.advisors) {
            try {
              canFight = quoteFremenAmbassadorMove(g, p.id, {
                ...action,
                fighters: true,
              }).wantsFighters;
            } catch (error) {
              if (!(error instanceof FremenAmbassadorMoveError)) throw error;
            }
          }
          destinations.push({
            territory: to.id,
            sector,
            advisors: quote.advisors,
            canFight,
          });
        } catch (error) {
          if (!(error instanceof FremenAmbassadorMoveError)) throw error;
        }
      }
    if (destinations.length)
      sources.push({
        territory: t.id,
        sectors,
        marker: sourceMarker,
        destinations,
      });
  }
  return { sources };
}
