import { gameTerritories, splitLocation, type MobileBoard } from './board';
import type { FactionId } from './catalog';
import type { AdvisorStance } from './advisor-automatic-flip';

/** The selected incoming group, before its transport or payment is committed. */
export type AdvisorTransportMatchingSource = {
  event: string;
  producer: 'guild' | 'junction';
  owner: string;
  turn: number;
  phase: number;
  origin: string;
  destination: string;
  sector: number;
  advisors: boolean;
  group: Record<string, number>;
};

export type AdvisorTransportMatchingIntent = Omit<AdvisorTransportMatchingSource, 'event' | 'turn' | 'phase'>;
export type AdvisorTransportMatchingQuote = Omit<AdvisorTransportMatchingSource, 'event'>;
export type AdvisorTransportMatchingPlayer = {
  id: string;
  faction: FactionId;
  forces: Readonly<Record<string, number>>;
  advisors?: Readonly<Record<string, AdvisorStance>>;
  shipped?: boolean;
};
export type AdvisorTransportMatchingWorld = {
  id: string;
  forces: Readonly<Record<string, { normal: number; elite: number }>>;
};
export type AdvisorTransportMatchingContext = MobileBoard & {
  advanced: boolean;
  status: string;
  turn: number;
  phase: number;
  active: string | null;
  players: readonly AdvisorTransportMatchingPlayer[];
  worlds?: readonly AdvisorTransportMatchingWorld[];
  /** Private native opportunity identity, never copied into the public source. */
  advisorTransportMatchingOpportunity?: string;
  advisorTransportMatchingDenied?: readonly string[];
};

export class AdvisorTransportMatchingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvisorTransportMatchingError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const nonnegative = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireMatching(value: unknown, message: string): asserts value {
  if (!value) throw new AdvisorTransportMatchingError(message);
}

/** A fresh counter UUID or destination sector cannot retry the same native
 * opportunity. The private scope belongs only to this local prevention key. */
export function advisorTransportMatchingKey(
  source: AdvisorTransportMatchingSource | AdvisorTransportMatchingQuote,
  opportunity: string,
): string {
  requireMatching(identifier(opportunity), 'Transport matching needs its original native opportunity.');
  const group = Object.entries(source.group).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return JSON.stringify([
    'advisorTransportMatching', opportunity, source.turn, source.owner, source.producer,
    source.origin, source.destination, source.advisors, group,
  ]);
}

function hasResidents(player: AdvisorTransportMatchingPlayer, destination: string) {
  return Object.entries(player.forces).some(([key, count]) =>
    splitLocation(key).territory === destination && count > 0);
}

function selectedGroup(
  ctx: AdvisorTransportMatchingContext,
  owner: AdvisorTransportMatchingPlayer,
  intent: AdvisorTransportMatchingIntent,
  originSectors: readonly number[] | undefined,
): Record<string, number> {
  requireMatching(record(intent.group) && Object.keys(intent.group).length > 0,
    'Select a nonempty physical BG packet for transport matching.');
  const keys = Object.keys(intent.group);
  if (!originSectors) {
    requireMatching(intent.producer === 'junction' && Array.isArray(ctx.worlds) &&
      intent.origin === [...keys].sort()[0],
    'Junction Homeworld matching needs its canonical first selected source world.');
  }
  const group: Record<string, number> = {};
  let total = 0;
  for (const key of keys) {
    let held: number | undefined;
    if (originSectors) {
      const point = splitLocation(key);
      requireMatching(key === `${point.territory}:${point.sector}` && point.territory === intent.origin &&
        originSectors.includes(point.sector),
      'Select the physical transport packet from one current board territory.');
      held = owner.forces[key];
    } else {
      const worlds = ctx.worlds!.filter((world) => world.id === key);
      const world = worlds[0];
      requireMatching(ctx.players.some((player) => key === `homeworld:${player.faction}` ||
        (player.faction === 'emperor' && key === 'homeworld:emperor:salusa')) &&
        worlds.length === 1 && record(world.forces) && Object.hasOwn(world.forces, owner.id) &&
        record(world.forces[owner.id]),
      'Select BG counters actually held on current source Homeworlds.');
      // Only normal physical BG counters participate; other owners and special
      // counter counts are unrelated to this incoming selected packet.
      held = world.forces[owner.id].normal;
    }
    const count = intent.group[key];
    requireMatching(positive(count) && nonnegative(held) && held >= count,
      'The incoming transport packet is no longer held at its original physical sources.');
    total += count;
    requireMatching(positive(total), 'The incoming transport packet exceeds the supported physical count.');
    group[key] = count;
  }
  return group;
}

/** The native transport keeps grant, route, occupancy, rate and funding
 * permission. This quote only opens an incoming-group stance change. */
export function quoteAdvisorTransportMatching(
  ctx: AdvisorTransportMatchingContext,
  intent: AdvisorTransportMatchingIntent,
): AdvisorTransportMatchingQuote | null {
  if (ctx.advanced !== true || ctx.status !== 'playing' || ctx.phase !== 5 || !positive(ctx.turn)) return null;
  requireMatching(record(intent) && identifier(intent.owner), 'Choose the current BG transport owner.');
  const owners = ctx.players.filter((player) => player.id === intent.owner);
  const owner = owners[0];
  if (owners.length !== 1 || owner.faction !== 'beneGesserit' || ctx.active !== owner.id || owner.shipped === true) return null;
  requireMatching((intent.producer === 'guild' || intent.producer === 'junction') &&
    identifier(intent.origin) && identifier(intent.destination) && nonnegative(intent.sector) &&
    typeof intent.advisors === 'boolean',
  'Choose the native transport, original packet and resident destination stance.');
  // Returning to a Homeworld or reserves never matches an Arrakis resident.
  if (intent.destination === 'reserves' || intent.destination.startsWith('homeworld:')) return null;
  const places = gameTerritories(ctx);
  const destination = places.find((place) => place.id === intent.destination && place.sectors.includes(intent.sector));
  const origin = places.find((place) => place.id === intent.origin);
  requireMatching(destination && (origin ||
    (intent.producer === 'junction' && intent.origin.startsWith('homeworld:'))),
  'Transport matching needs its current board destination and physical board or Junction Homeworld origin.');
  if (intent.origin === intent.destination || !hasResidents(owner, intent.destination)) return null;
  const targetAdvisors = !!owner.advisors?.[intent.destination];
  requireMatching(intent.advisors === targetAdvisors,
    'The resident BG group no longer has the declared transport matching stance.');
  // A Homeworld packet provisionally has the ordinary incoming fighter default.
  const incomingAdvisors = origin ? !!owner.advisors?.[intent.origin] : false;
  if (incomingAdvisors === targetAdvisors) return null;
  const group = selectedGroup(ctx, owner, intent, origin?.sectors);
  requireMatching(identifier(ctx.advisorTransportMatchingOpportunity),
    'Transport matching needs its original native opportunity.');
  const quote: AdvisorTransportMatchingQuote = {
    producer: intent.producer, owner: owner.id, turn: ctx.turn, phase: ctx.phase,
    origin: intent.origin, destination: intent.destination, sector: intent.sector,
    advisors: targetAdvisors, group,
  };
  requireMatching(ctx.advisorTransportMatchingDenied === undefined ||
    (Array.isArray(ctx.advisorTransportMatchingDenied) &&
      ctx.advisorTransportMatchingDenied.every((key) => typeof key === 'string')),
  'The transport matching prevention history is invalid.');
  requireMatching(!ctx.advisorTransportMatchingDenied?.includes(
    advisorTransportMatchingKey(quote, ctx.advisorTransportMatchingOpportunity)),
  'Karama already prevented this selected packet from matching in that territory during the original transport opportunity.');
  return quote;
}

/** Validate the still-uncommitted packet before either counter outcome. */
export function validateAdvisorTransportMatching(
  ctx: AdvisorTransportMatchingContext,
  source: AdvisorTransportMatchingSource,
): void {
  requireMatching(record(source) &&
    Object.keys(source).sort().join(',') === 'advisors,destination,event,group,origin,owner,phase,producer,sector,turn' &&
    identifier(source.event) && positive(source.turn) && source.turn === ctx.turn &&
    source.phase === 5 && source.phase === ctx.phase,
  'Transport matching lost its original current-turn public source.');
  const quote = quoteAdvisorTransportMatching(ctx, {
    producer: source.producer, owner: source.owner, origin: source.origin, destination: source.destination,
    sector: source.sector, advisors: source.advisors, group: source.group,
  });
  requireMatching(quote, 'There is no current incoming BG stance change for this transport matching source.');
}
