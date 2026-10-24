import { gameTerritories, splitLocation, type MobileBoard } from './board';
import type { FactionId } from './catalog';
import type { AdvisorStance } from './advisor-automatic-flip';

/** One incoming selected group changes to the resident BG group's stance. */
export type AdvisorMatchingSource = {
  event: string;
  kind: 'movement' | 'shipment';
  owner: string;
  turn: number;
  move: number;
  origin: string;
  destination: string;
  sector: number;
  advisors: boolean;
  group: Record<string, number>;
};

export type AdvisorMatchingIntent = Omit<AdvisorMatchingSource, 'event' | 'turn'>;
export type AdvisorMatchingQuote = Omit<AdvisorMatchingSource, 'event'>;

export type AdvisorMatchingPlayer = {
  id: string;
  faction: FactionId;
  forces: Readonly<Record<string, number>>;
  advisors?: Readonly<Record<string, AdvisorStance>>;
  moved?: number;
  reserves?: number;
};

export type AdvisorMatchingContext = MobileBoard & {
  advanced: boolean;
  status: string;
  phase: number;
  turn: number;
  active: string | null;
  players: readonly AdvisorMatchingPlayer[];
  advisorMatchingDenied?: readonly string[];
};

export class AdvisorMatchingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvisorMatchingError';
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
  if (!value) throw new AdvisorMatchingError(message);
}

/** Destination-sector retries and fresh response UUIDs do not change the packet.
 * A new turn, native opportunity, selected group or target stance has its own key. */
export function advisorMatchingKey(source: AdvisorMatchingSource | AdvisorMatchingQuote): string {
  const group = Object.entries(source.group).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return JSON.stringify([
    'advisorMatching', source.turn, source.owner, source.kind, source.move,
    source.origin, source.destination, source.advisors, group,
  ]);
}

function residentForces(player: AdvisorMatchingPlayer, destination: string) {
  return Object.entries(player.forces).some(([key, count]) =>
    splitLocation(key).territory === destination && count > 0);
}

function selectedGroup(
  player: AdvisorMatchingPlayer,
  intent: AdvisorMatchingIntent,
  originSectors: readonly number[],
): Record<string, number> {
  requireMatching(record(intent.group) && Object.keys(intent.group).length > 0,
    'Select one nonempty physical group for advisor matching.');
  const group: Record<string, number> = {};
  let total = 0;
  for (const key of Object.keys(intent.group)) {
    if (intent.kind === 'shipment') {
      requireMatching(key === 'reserves', 'Normal BG shipment matching uses only the selected reserve forces.');
    } else {
      const point = splitLocation(key);
      requireMatching(key === `${point.territory}:${point.sector}` && point.territory === intent.origin &&
        originSectors.includes(point.sector),
      'Select physical movement counters from the original board territory.');
    }
    const count = intent.group[key];
    const held = intent.kind === 'shipment' ? player.reserves : player.forces[key];
    requireMatching(positive(count) && nonnegative(held) && held >= count,
      'The selected incoming physical group is no longer available.');
    total += count;
    requireMatching(positive(total), 'The selected incoming group exceeds the supported physical count.');
    group[key] = count;
  }
  return group;
}

/** Matching is an incoming-group counter only. The caller keeps normal route,
 * arrival permissions, funding and the uncommitted original action authoritative. */
export function quoteAdvisorMatching(
  ctx: AdvisorMatchingContext,
  intent: AdvisorMatchingIntent,
): AdvisorMatchingQuote | null {
  if (ctx.advanced !== true || ctx.status !== 'playing' || ctx.phase !== 5 || !positive(ctx.turn)) return null;
  requireMatching(record(intent) && identifier(intent.owner), 'Choose the current advisor-matching owner.');
  const owners = ctx.players.filter((player) => player.id === intent.owner);
  const owner = owners[0];
  if (owners.length !== 1 || owner.faction !== 'beneGesserit' || ctx.active !== owner.id) return null;
  requireMatching((intent.kind === 'movement' || intent.kind === 'shipment') && nonnegative(intent.move) &&
    identifier(intent.origin) && identifier(intent.destination) && nonnegative(intent.sector) &&
    typeof intent.advisors === 'boolean',
  'Choose a valid native movement or reserve-shipment matching declaration.');
  const places = gameTerritories(ctx);
  const destination = places.find((place) => place.id === intent.destination && place.sectors.includes(intent.sector));
  const origin = places.find((place) => place.id === intent.origin);
  requireMatching(destination && (intent.kind === 'shipment' ? intent.origin === 'reserves' : origin),
    'Advisor matching needs its current board destination and original physical source.');
  if (!residentForces(owner, intent.destination)) return null;
  const targetAdvisors = !!owner.advisors?.[intent.destination];
  requireMatching(intent.advisors === targetAdvisors,
    'The resident Bene Gesserit group no longer has the declared target stance.');
  // Selected ordinary reserve forces provisionally arrive with the normal fighter default.
  const incomingAdvisors = intent.kind === 'shipment' ? false : !!owner.advisors?.[intent.origin];
  if (incomingAdvisors === targetAdvisors) return null;
  requireMatching(intent.kind === 'shipment' ? intent.move === 0 :
    nonnegative(owner.moved) && intent.move === owner.moved,
  'Advisor matching lost its original owned movement or shipment opportunity.');
  const group = selectedGroup(owner, intent, origin?.sectors ?? []);
  const quote: AdvisorMatchingQuote = {
    kind: intent.kind, owner: owner.id, turn: ctx.turn, move: intent.move,
    origin: intent.origin, destination: intent.destination, sector: intent.sector,
    advisors: targetAdvisors, group,
  };
  requireMatching(ctx.advisorMatchingDenied === undefined ||
    (Array.isArray(ctx.advisorMatchingDenied) && ctx.advisorMatchingDenied.every((key) => typeof key === 'string')),
  'The advisor-matching prevention history is invalid.');
  requireMatching(!ctx.advisorMatchingDenied?.includes(advisorMatchingKey(quote)),
    'Karama already prevented this selected group from matching in that territory during the current owned opportunity.');
  return quote;
}

/** Validate before either response outcome; this never commits or refunds the action. */
export function validateAdvisorMatching(ctx: AdvisorMatchingContext, source: AdvisorMatchingSource): void {
  requireMatching(record(source) &&
    Object.keys(source).sort().join(',') === 'advisors,destination,event,group,kind,move,origin,owner,sector,turn' &&
    identifier(source.event) && positive(source.turn) && source.turn === ctx.turn,
  'Advisor matching lost its original current-turn public source.');
  const quote = quoteAdvisorMatching(ctx, {
    kind: source.kind, owner: source.owner, move: source.move, origin: source.origin,
    destination: source.destination, sector: source.sector, advisors: source.advisors, group: source.group,
  });
  requireMatching(quote, 'There is no current incoming BG stance change for this matching source.');
}
