import { gameTerritories, splitLocation } from './board';
import {
  AdvisorMatchingError,
  quoteAdvisorMatching,
  type AdvisorMatchingContext,
  type AdvisorMatchingQuote,
} from './advisor-matching';

export type AdvisorGatherMatchingIntent = {
  owner: string;
  move: number;
  destination: string;
  sector: number;
  advisors: boolean;
  group: Record<string, number>;
};

export class AdvisorGatherMatchingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvisorGatherMatchingError';
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
  if (!value) throw new AdvisorGatherMatchingError(message);
}

/** Resident gather changes each incoming origin independently. The original
 * Planetologist quote retains trainer, route and complete-order permission;
 * enemy-only and empty destinations retain their existing native policy. */
export function quoteAdvisorGatherMatching(
  ctx: AdvisorMatchingContext,
  intent: AdvisorGatherMatchingIntent,
): AdvisorMatchingQuote[] {
  if (ctx.advanced !== true || ctx.status !== 'playing' || ctx.phase !== 5 || !positive(ctx.turn)) return [];
  requireMatching(record(intent) && identifier(intent.owner), 'Choose the current BG gather owner.');
  const owners = ctx.players.filter((player) => player.id === intent.owner);
  const owner = owners[0];
  if (owners.length !== 1 || owner.faction !== 'beneGesserit' || ctx.active !== owner.id) return [];
  requireMatching(nonnegative(intent.move) && identifier(intent.destination) && nonnegative(intent.sector) &&
    typeof intent.advisors === 'boolean',
  'Choose the original gather movement and resident destination stance.');
  const residents = Object.entries(owner.forces).some(([key, count]) =>
    splitLocation(key).territory === intent.destination && count > 0);
  if (!residents) return [];
  const places = gameTerritories(ctx);
  requireMatching(places.some((place) => place.id === intent.destination && place.sectors.includes(intent.sector)),
    'Gather matching needs a current board destination sector.');
  requireMatching(record(intent.group) && Object.keys(intent.group).length > 0,
    'Select two nonempty physical board origins for gather matching.');
  const origins = new Map<string, Record<string, number>>();
  let total = 0;
  // Sorting also gives every public origin packet a stable physical-key order.
  for (const key of Object.keys(intent.group).sort()) {
    const point = splitLocation(key);
    requireMatching(key === `${point.territory}:${point.sector}` &&
      places.some((place) => place.id === point.territory && place.sectors.includes(point.sector)),
    'Gather matching needs physical counters from current canonical board sectors.');
    const count = intent.group[key];
    const held = owner.forces[key];
    requireMatching(positive(count) && nonnegative(held) && held >= count,
      'The selected gather packet is no longer held at its original board sources.');
    total += count;
    requireMatching(positive(total), 'The selected gather packet exceeds the supported physical count.');
    const group = origins.get(point.territory) ?? {};
    group[key] = count;
    origins.set(point.territory, group);
  }
  requireMatching(origins.size === 2, 'Resident gather matching requires exactly two selected origin territories.');
  const quotes: AdvisorMatchingQuote[] = [];
  try {
    for (const origin of [...origins.keys()].sort()) {
      const quote = quoteAdvisorMatching(ctx, {
        kind: 'movement', owner: owner.id, move: intent.move, origin,
        destination: intent.destination, sector: intent.sector, advisors: intent.advisors,
        group: origins.get(origin)!,
      });
      if (quote) quotes.push(quote);
    }
  } catch (error) {
    if (error instanceof AdvisorMatchingError) throw new AdvisorGatherMatchingError(error.message);
    throw error;
  }
  return quotes;
}
