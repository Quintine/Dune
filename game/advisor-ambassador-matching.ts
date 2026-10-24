import { gameTerritories, splitLocation, type MobileBoard } from './board';
import type { FactionId } from './catalog';
import type { AdvisorStance } from './advisor-automatic-flip';

export type AdvisorAmbassadorMatchingSource = {
  event: string;
  parent: string;
  owner: string;
  turn: number;
  phase: number;
  origin: string;
  destination: string;
  sector: number;
  advisors: boolean;
  group: Record<string, number>;
};

export type AdvisorAmbassadorMatchingIntent = Omit<AdvisorAmbassadorMatchingSource, 'event' | 'turn' | 'phase'>;
export type AdvisorAmbassadorMatchingQuote = Omit<AdvisorAmbassadorMatchingSource, 'event'>;

export type AdvisorAmbassadorMatchingPlayer = {
  id: string;
  faction: FactionId;
  forces: Readonly<Record<string, number>>;
  advisors?: Readonly<Record<string, AdvisorStance>>;
};

export type AdvisorAmbassadorMatchingContext = MobileBoard & {
  advanced: boolean;
  status: string;
  turn: number;
  phase: number;
  players: readonly AdvisorAmbassadorMatchingPlayer[];
  pendingAmbassador?: {
    event: string;
    turn?: number;
    phase?: number;
    effect?: string;
    stage?: string;
    beneficiary?: string | null;
  } | null;
  advisorAmbassadorMatchingDenied?: readonly string[];
};

export class AdvisorAmbassadorMatchingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvisorAmbassadorMatchingError';
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
  if (!value) throw new AdvisorAmbassadorMatchingError(message);
}

/** Only the original public Ambassador opportunity, packet and target stance
 * identify prevention. A new response UUID or destination sector is no retry. */
export function advisorAmbassadorMatchingKey(
  source: AdvisorAmbassadorMatchingSource | AdvisorAmbassadorMatchingQuote,
): string {
  const group = Object.entries(source.group).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return JSON.stringify([
    'advisorAmbassadorMatching', source.turn, source.parent, source.owner,
    source.origin, source.destination, source.advisors, group,
  ]);
}

function hasResidents(player: AdvisorAmbassadorMatchingPlayer, territory: string) {
  return Object.entries(player.forces).some(([key, count]) =>
    splitLocation(key).territory === territory && count > 0);
}

/** The original Fremen grant, not the active ordinary mover, owns this request.
 * Native phase permission, route, locks and occupancy stay with that producer. */
export function quoteAdvisorAmbassadorMatching(
  ctx: AdvisorAmbassadorMatchingContext,
  intent: AdvisorAmbassadorMatchingIntent,
): AdvisorAmbassadorMatchingQuote | null {
  if (ctx.advanced !== true || ctx.status !== 'playing') return null;
  requireMatching(record(intent) && identifier(intent.owner), 'Choose the native BG Ambassador beneficiary.');
  const owners = ctx.players.filter((player) => player.id === intent.owner);
  const owner = owners[0];
  if (owners.length !== 1 || owner.faction !== 'beneGesserit') return null;
  const parent = ctx.pendingAmbassador;
  if (!record(parent) || parent.effect !== 'fremen' || parent.stage !== 'move' || parent.beneficiary !== owner.id) return null;
  requireMatching(identifier(intent.parent) && identifier(parent.event) && intent.parent === parent.event &&
    positive(ctx.turn) && parent.turn === ctx.turn && nonnegative(ctx.phase) && ctx.phase <= 8 && parent.phase === ctx.phase,
  'The original current-turn Fremen Ambassador relocation has changed.');
  requireMatching(identifier(intent.origin) && identifier(intent.destination) && nonnegative(intent.sector) &&
    typeof intent.advisors === 'boolean',
  'Choose the original board packet and resident destination stance.');
  const places = gameTerritories(ctx);
  const origin = places.find((place) => place.id === intent.origin);
  const destination = places.find((place) => place.id === intent.destination && place.sectors.includes(intent.sector));
  requireMatching(origin && destination, 'Ambassador matching needs a current board origin and destination sector.');
  // Sector-only relocation retains the territory's existing single BG type.
  if (intent.origin === intent.destination || !hasResidents(owner, intent.destination)) return null;
  const targetAdvisors = !!owner.advisors?.[intent.destination];
  requireMatching(intent.advisors === targetAdvisors,
    'The resident BG group no longer has the declared Ambassador matching stance.');
  if (!!owner.advisors?.[intent.origin] === targetAdvisors) return null;
  requireMatching(record(intent.group) && Object.keys(intent.group).length > 0,
    'Select one nonempty physical BG packet for Ambassador matching.');
  const group: Record<string, number> = {};
  let total = 0;
  for (const key of Object.keys(intent.group)) {
    const point = splitLocation(key);
    requireMatching(key === `${point.territory}:${point.sector}` && point.territory === intent.origin &&
      origin.sectors.includes(point.sector),
    'Select the incoming physical packet from one current board origin.');
    const count = intent.group[key];
    const held = owner.forces[key];
    requireMatching(positive(count) && nonnegative(held) && held >= count,
      'The incoming Ambassador packet is no longer held at its original location.');
    total += count;
    requireMatching(positive(total), 'The incoming Ambassador packet exceeds the supported physical count.');
    group[key] = count;
  }
  const quote: AdvisorAmbassadorMatchingQuote = {
    parent: parent.event, owner: owner.id, turn: ctx.turn, phase: ctx.phase,
    origin: intent.origin, destination: intent.destination, sector: intent.sector,
    advisors: targetAdvisors, group,
  };
  requireMatching(ctx.advisorAmbassadorMatchingDenied === undefined ||
    (Array.isArray(ctx.advisorAmbassadorMatchingDenied) &&
      ctx.advisorAmbassadorMatchingDenied.every((key) => typeof key === 'string')),
  'The Ambassador matching prevention history is invalid.');
  requireMatching(!ctx.advisorAmbassadorMatchingDenied?.includes(advisorAmbassadorMatchingKey(quote)),
    'Karama already prevented this selected packet from matching in that territory during the original Ambassador opportunity.');
  return quote;
}

/** Recheck the same uncommitted packet before either counter outcome. */
export function validateAdvisorAmbassadorMatching(
  ctx: AdvisorAmbassadorMatchingContext,
  source: AdvisorAmbassadorMatchingSource,
): void {
  requireMatching(record(source) &&
    Object.keys(source).sort().join(',') === 'advisors,destination,event,group,origin,owner,parent,phase,sector,turn' &&
    identifier(source.event) && positive(source.turn) && source.turn === ctx.turn &&
    nonnegative(source.phase) && source.phase === ctx.phase,
  'Ambassador matching lost its original current-turn public source.');
  const quote = quoteAdvisorAmbassadorMatching(ctx, {
    parent: source.parent, owner: source.owner, origin: source.origin, destination: source.destination,
    sector: source.sector, advisors: source.advisors, group: source.group,
  });
  requireMatching(quote, 'There is no current incoming BG stance change for this Fremen Ambassador source.');
}
