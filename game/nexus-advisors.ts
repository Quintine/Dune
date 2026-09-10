import {
  gameDistance,
  gameTerritories,
  location,
  MOBILE_LOCATION,
  splitLocation,
  territory,
  validLocation,
} from './board';
import {
  settledBoard,
  type BoardContext,
  type BoardSeat,
} from './board-resolution-quote';
import { presenceAt, presenceByLocation } from './force-presence';
import { fighterCount } from './advisors';
import { territoryEntryBlock } from './occupancy';
import { ecazOccupancyIdentity } from './ecaz-occupy';

export type NexusAdvisorContext = BoardContext & { turn: number };
export type NexusAdvisorSelection = {
  territory: string;
  count: number;
  locations: { location: string; count: number }[];
  noField: string | null;
  stance: { lockedTurn?: number };
};
export type NexusAdvisorReceipt = {
  version: 1;
  event: string;
  owner: string;
  turn: number;
  selections: NexusAdvisorSelection[];
  signature: string;
};
function requireAdvisors(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
function record(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
function exact(value: unknown, keys: string[]): boolean {
  return (
    record(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
  );
}
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
function validStance(
  stance: unknown,
  turn: number,
): stance is { lockedTurn?: number } {
  return (
    record(stance) &&
    Object.keys(stance).every((key) => key === 'lockedTurn') &&
    (stance.lockedTurn === undefined ||
      (whole(stance.lockedTurn) && stance.lockedTurn <= turn))
  );
}
function board(context: NexusAdvisorContext, owner: string) {
  requireAdvisors(
    whole(context.turn) &&
      context.turn > 0 &&
      typeof context.advanced === 'boolean' &&
      Array.isArray(context.players),
    'Nexus advisors need a valid public board and turn.',
  );
  ecazOccupancyIdentity(context.players, owner, {
    kind: 'territory',
    id: 'polar_sink',
  });
  const player = context.players.find((p) => p.id === owner)!;
  requireAdvisors(
    player.faction === 'beneGesserit',
    'Only native Bene Gesserit may convert Nexus advisors.',
  );
  const sites = gameTerritories(context);
  for (const p of context.players)
    if (p.advisors !== undefined) {
      requireAdvisors(
        record(p.advisors),
        'Advisor stances need a valid territory map.',
      );
      for (const [id, stance] of Object.entries(p.advisors)) {
        // Homeworld invasions are outside the advisor territory subsystem.
        if (id.startsWith('homeworld:')) continue;
        requireAdvisors(
          sites.some((site) => site.id === id) &&
            validStance(stance, context.turn),
          'Invalid original advisor territory stance.',
        );
      }
    }
  const settled = settledBoard(context);
  return { player, sites, settled };
}
function selection(player: BoardSeat, to: string): NexusAdvisorSelection {
  const locations = Object.entries(player.forces)
    .filter(([key, count]) => count > 0 && splitLocation(key).territory === to)
    .sort(([one], [two]) => one.localeCompare(two))
    .map(([key, count]) => ({ location: key, count }));
  const marker = player.noField?.deployed?.location;
  const noField =
    marker?.territory === to ? location(marker.territory, marker.sector) : null;
  const count =
    locations.reduce((sum, group) => sum + group.count, 0) + (noField ? 1 : 0);
  return {
    territory: to,
    count,
    locations,
    noField,
    stance:
      player.advisors![to].lockedTurn === undefined
        ? {}
        : { lockedTurn: player.advisors![to].lockedTurn },
  };
}
function stormBlocked(
  context: NexusAdvisorContext,
  players: readonly BoardSeat[],
  owner: BoardSeat,
  to: string,
): boolean {
  if (context.storm === 0 || territory(to).type === 'polar') return false;
  const inStorm = (key: string) =>
    splitLocation(
      key === MOBILE_LOCATION
        ? (context.mobileStronghold?.location ?? key)
        : key,
    ).sector === context.storm;
  const keys = (p: BoardSeat) =>
    Object.entries(presenceByLocation(p))
      .filter(
        ([key, count]) => count > 0 && splitLocation(key).territory === to,
      )
      .map(([key]) => key);
  const own = keys(owner);
  if (own.some(inStorm)) return true;
  // Only storm-caused separation is an unresolved interaction. No general
  // requirement to be in a battle-capable territory is imposed by this card.
  for (const other of players) {
    if (
      other.id === owner.id ||
      other.id === owner.ally ||
      !fighterCount(other, to)
    )
      continue;
    const theirs = keys(other);
    if (
      own.some((x) =>
        theirs.some((y) => x === y || gameDistance(context, x, y) === 0),
      ) &&
      !own.some((x) =>
        theirs.some(
          (y) =>
            !inStorm(x) &&
            !inStorm(y) &&
            (x === y || gameDistance(context, x, y, inStorm) === 0),
        ),
      )
    )
      return true;
  }
  return false;
}
export function quoteNexusAdvisors(
  context: NexusAdvisorContext,
  owner: string,
): {
  territories: { territory: string; count: number; blocked: string | null }[];
} {
  const { player, sites, settled } = board(context, owner);
  if (!context.advanced) return { territories: [] };
  const territories = sites
    .filter(
      (site) =>
        player.advisors?.[site.id] &&
        presenceAt(player, site.id) > 0 &&
        !settled.released.some(
          (release) =>
            release.player === owner && release.territory === site.id,
        ),
    )
    .map((site) => {
      const original = selection(player, site.id);
      let blocked = territoryEntryBlock(settled.players, owner, site.id);
      if (!blocked && player.advisors![site.id].lockedTurn === context.turn)
        blocked =
          'Whether Nexus Cunning overrides the same-turn advisor lock is unresolved.';
      if (!blocked && stormBlocked(context, settled.players, player, site.id))
        blocked =
          'Nexus advisor conversion involving storm-blocked forces awaits a ruling.';
      return { territory: site.id, count: original.count, blocked };
    });
  return { territories };
}
function signature(receipt: Omit<NexusAdvisorReceipt, 'signature'>): string {
  return JSON.stringify([
    'nexusAdvisors',
    receipt.version,
    receipt.event,
    receipt.owner,
    receipt.turn,
    receipt.selections.map((s) => [
      s.territory,
      s.count,
      s.locations.map((group) => [group.location, group.count]),
      s.noField,
      Object.hasOwn(s.stance, 'lockedTurn') ? [s.stance.lockedTurn] : null,
    ]),
  ]);
}
function validateReceipt(receipt: NexusAdvisorReceipt): void {
  requireAdvisors(
    exact(receipt, [
      'version',
      'event',
      'owner',
      'turn',
      'selections',
      'signature',
    ]) &&
      receipt.version === 1 &&
      text(receipt.event) &&
      text(receipt.owner) &&
      whole(receipt.turn) &&
      receipt.turn > 0 &&
      Array.isArray(receipt.selections) &&
      receipt.selections.length > 0 &&
      new Set(receipt.selections.map((s) => s.territory)).size ===
        receipt.selections.length,
    'Invalid saved Nexus advisor selection.',
  );
  for (const chosen of receipt.selections) {
    requireAdvisors(
      exact(chosen, ['territory', 'count', 'locations', 'noField', 'stance']) &&
        text(chosen.territory) &&
        validLocation(
          chosen.territory,
          territory(chosen.territory).sectors[0],
        ) &&
        whole(chosen.count) &&
        chosen.count > 0 &&
        Array.isArray(chosen.locations) &&
        validStance(chosen.stance, receipt.turn) &&
        (!Object.hasOwn(chosen.stance, 'lockedTurn') ||
          chosen.stance.lockedTurn !== undefined),
      'Invalid original Nexus advisor group.',
    );
    const validKey = (key: unknown) => {
      if (!text(key)) return false;
      const loc = splitLocation(key);
      return (
        loc.territory === chosen.territory &&
        key === location(loc.territory, loc.sector) &&
        validLocation(loc.territory, loc.sector)
      );
    };
    requireAdvisors(
      chosen.locations.every(
        (group) =>
          exact(group, ['location', 'count']) &&
          validKey(group.location) &&
          whole(group.count) &&
          group.count > 0,
      ) &&
        new Set(chosen.locations.map((group) => group.location)).size ===
          chosen.locations.length &&
        (chosen.noField === null || validKey(chosen.noField)) &&
        chosen.count ===
          chosen.locations.reduce((sum, group) => sum + group.count, 0) +
            (chosen.noField ? 1 : 0),
      'The Nexus advisor receipt needs exact original public force counts.',
    );
  }
  requireAdvisors(
    receipt.signature === signature(receipt),
    'The Nexus advisor selection has lost its original stance or force counts.',
  );
}
export function createNexusAdvisors(
  context: NexusAdvisorContext,
  owner: string,
  event: string,
  territories: string[],
): NexusAdvisorReceipt {
  const quote = quoteNexusAdvisors(context, owner);
  requireAdvisors(
    text(event) &&
      Array.isArray(territories) &&
      territories.length > 0 &&
      territories.every(text) &&
      new Set(territories).size === territories.length,
    'Choose a nonempty distinct set of advisor territories.',
  );
  for (const to of territories) {
    const offer = quote.territories.find((offer) => offer.territory === to);
    requireAdvisors(
      offer && !offer.blocked,
      offer?.blocked ?? 'Choose an original advisor territory.',
    );
  }
  const player = context.players.find((p) => p.id === owner)!;
  const receipt: NexusAdvisorReceipt = {
    version: 1,
    event,
    owner,
    turn: context.turn,
    selections: territories.map((to) => selection(player, to)),
    signature: '',
  };
  receipt.signature = signature(receipt);
  validateNexusAdvisors(context, receipt, true);
  return receipt;
}
export function validateNexusAdvisors(
  context: NexusAdvisorContext,
  receipt: NexusAdvisorReceipt,
  pending: boolean,
): void {
  validateReceipt(receipt);
  requireAdvisors(
    typeof pending === 'boolean' &&
      whole(context.turn) &&
      context.turn >= receipt.turn &&
      context.players.some(
        (p) => p.id === receipt.owner && p.faction === 'beneGesserit',
      ),
    'The Nexus advisor receipt needs its original owner and turn.',
  );
  if (!pending) return;
  requireAdvisors(
    context.turn === receipt.turn,
    'Complete the Nexus advisor conversion in its original turn.',
  );
  const quote = quoteNexusAdvisors(context, receipt.owner),
    player = context.players.find((p) => p.id === receipt.owner)!;
  for (const chosen of receipt.selections) {
    const current = quote.territories.find(
      (offer) => offer.territory === chosen.territory,
    );
    requireAdvisors(
      current && !current.blocked,
      current?.blocked ?? 'The original advisor group is no longer available.',
    );
    const actual = selection(player, chosen.territory);
    requireAdvisors(
      JSON.stringify(actual) === JSON.stringify(chosen),
      'The pending Nexus conversion must retain its exact original forces and stance.',
    );
  }
}
