import { TERRITORIES, splitLocation, validGameLocation } from './board';
import type { Game, Player } from './engine';
import { presenceAt } from './force-presence';
import { nexusCardMode, validateNexusCards } from './nexus-cards';
import { territoryEntryBlock } from './occupancy';

/** The engine allocates a distinct event for each accepted worm appearance, even
 * when two worms visit the same territory. Capture before any devouring. */
export type FremenCunningOccurrence = Readonly<{
  event: string;
  turn: number;
  territory: string;
  origin: 'natural' | 'additional' | 'summoned';
  pile?: 0 | 1;
  parent?: string;
  initiallyEmpty: boolean;
}>;

export type FremenCunningCounts = Readonly<{ normal: number; elite: number }>;
export type FremenCunningSource = Readonly<{
  territory: string;
  sectors: Readonly<Record<string, FremenCunningCounts>>;
}>;
export type FremenCunningSelection = Readonly<{
  source: string;
  forces: Readonly<Record<string, FremenCunningCounts>>;
  destination: Readonly<{ territory: string; sector: number }>;
}>;
export type FremenCunningQuote = Readonly<{
  event: string;
  sources: readonly FremenCunningSource[];
}>;
/** Persisted by the engine only after spending the owner's actual card.
 * The caller must authenticate this receipt against its saved event history. */
export type FremenCunningRideAuthorization = Readonly<{
  event: string;
  turn: number;
  owner: string;
}>;

/** Call only from the accepted appearance branch, before wormSurvival/devour.
 * The caller persists and authenticates this record; it is not a card-draw hook. */
export function captureFremenCunningOccurrence(
  g: Game,
  occurrence: Omit<FremenCunningOccurrence, 'turn' | 'initiallyEmpty'>,
): FremenCunningOccurrence {
  if (g.status !== 'playing' || g.phase !== 1 || !occurrence.event ||
    !['natural', 'additional', 'summoned'].includes(occurrence.origin) ||
    !TERRITORIES.some(t => t.id === occurrence.territory) ||
    (occurrence.origin === 'summoned'
      ? !occurrence.parent || g.summonedWorm?.event !== occurrence.parent ||
        g.summonedWorm?.territory !== occurrence.territory
      : occurrence.parent !== undefined))
    throw new Error('Capture Cunning at an actual Arrakis worm appearance.');
  return {
    ...occurrence,
    turn: g.turn,
    initiallyEmpty: g.players.every(p => presenceAt(p, occurrence.territory) === 0),
  };
}

function physicalDesertSources(g: Game, p: Player): FremenCunningSource[] {
  const sources = new Map<string, Record<string, FremenCunningCounts>>();
  for (const [key, total] of Object.entries(p.forces)) {
    if (!Number.isSafeInteger(total) || total <= 0) continue;
    const { territory: id, sector } = splitLocation(key);
    const terrain = TERRITORIES.find(t => t.id === id);
    if (terrain?.type !== 'sand' || !validGameLocation(g, id, sector) || sector === g.storm) continue;
    const elite = p.elites?.forces[key] ?? 0;
    if (!Number.isSafeInteger(elite) || elite < 0 || elite > total)
      throw new Error('Cunning source has invalid physical force custody.');
    const sectors = sources.get(id) ?? {};
    sectors[key] = { normal: total - elite, elite };
    sources.set(id, sectors);
  }
  return [...sources].map(([territory, sectors]) => ({ territory, sectors }));
}

/** Null means this seat/appearance cannot use native Fremen Cunning. No
 * post-devour presence check may replace the occurrence's original fact. */
export function quoteFremenCunning(
  g: Game, owner: string, occurrence: FremenCunningOccurrence,
): FremenCunningQuote | null {
  const p = g.players.find(player => player.id === owner);
  const cards = g.nexusCards?.cards;
  if (!p || g.status !== 'playing' || occurrence.turn !== g.turn ||
    !occurrence.event || !occurrence.initiallyEmpty ||
    !TERRITORIES.some(t => t.id === occurrence.territory) ||
    (occurrence.origin === 'summoned' &&
      (!occurrence.parent || g.summonedWorm?.event !== occurrence.parent ||
        g.summonedWorm?.territory !== occurrence.territory)) ||
    p.faction !== 'fremen' || p.ally ||
    cards?.hands[owner] !== 'fremen' ||
    nexusCardMode('fremen', p.faction, g.players.map(seat => seat.faction)) !== 'cunning') return null;
  validateNexusCards(cards, g.players);
  const sources = physicalDesertSources(g, p);
  return sources.length ? { event: occurrence.event, sources } : null;
}

/** A spent card is in the physical discard, not the rider's hand. The engine
 * must verify this authorization is its own saved receipt, never action input. */
export function quoteFremenCunningRide(
  g: Game, owner: string, occurrence: FremenCunningOccurrence,
  authorization: FremenCunningRideAuthorization,
): FremenCunningQuote | null {
  const p = g.players.find(player => player.id === owner);
  const cards = g.nexusCards?.cards;
  if (!p || p.faction !== 'fremen' || g.status !== 'playing' ||
    !occurrence.initiallyEmpty || !occurrence.event || occurrence.turn !== g.turn ||
    !TERRITORIES.some(t => t.id === occurrence.territory) ||
    (occurrence.origin === 'summoned' && !occurrence.parent) ||
    !authorization || authorization.event !== occurrence.event ||
    authorization.turn !== occurrence.turn || authorization.owner !== owner ||
    !cards?.discard.includes('fremen') || cards.hands[owner] === 'fremen')
    return null;
  validateNexusCards(cards, g.players);
  const sources = physicalDesertSources(g, p);
  return sources.length ? { event: occurrence.event, sources } : null;
}

/** Same structural, storm and occupation restrictions as ordinary riding.
 * Dynamic Homeworld/Discovery/HMS arrival needs its own dedicated adapter. */
export function fremenCunningDestinationBlock(
  g: Game, owner: string, occurrence: FremenCunningOccurrence,
  source: string, destination: FremenCunningSelection['destination'],
): string | null {
  const { territory: to, sector } = destination;
  if (!TERRITORIES.some(t => t.id === to) || !validGameLocation(g, to, sector))
    return 'Choose an Arrakis board sector.';
  if (to === source)
    return 'Choose another destination territory.';
  if (sector !== 0 && sector === g.storm) return 'That sector is in storm.';
  return territoryEntryBlock(g.players, owner, to);
}

/** Requote immediately before committing, while the authenticated appearance
 * remains pending. This only validates; the engine performs typed movement. */
export function validateFremenCunningSelection(
  g: Game, owner: string, occurrence: FremenCunningOccurrence,
  selection: FremenCunningSelection,
  authorization: FremenCunningRideAuthorization,
): Readonly<{ total: number; elite: number }> {
  const quote = quoteFremenCunningRide(g, owner, occurrence, authorization);
  if (!quote) throw new Error('Fremen Cunning is not available for this appearance.');
  const source = quote.sources.find(row => row.territory === selection.source);
  if (!source || !selection.forces || typeof selection.forces !== 'object' ||
    Array.isArray(selection.forces)) throw new Error('Choose one occupied desert territory.');
  let total = 0, elite = 0;
  for (const [key, count] of Object.entries(selection.forces)) {
    const available = Object.hasOwn(source.sectors, key) ? source.sectors[key] : undefined;
    if (!available || !count || Object.keys(count).sort().join(',') !== 'elite,normal' ||
      !Number.isSafeInteger(count.normal) || !Number.isSafeInteger(count.elite) ||
      count.normal < 0 || count.elite < 0 ||
      count.normal > available.normal || count.elite > available.elite)
      throw new Error('Choose available typed physical forces in the source territory.');
    total += count.normal + count.elite;
    elite += count.elite;
  }
  if (!Number.isSafeInteger(total) || !total)
    throw new Error('Choose at least one physical force to ride.');
  if (!selection.destination || typeof selection.destination.territory !== 'string' ||
    !Number.isSafeInteger(selection.destination.sector))
    throw new Error('Choose an Arrakis destination sector.');
  const blocked = fremenCunningDestinationBlock(
    g, owner, occurrence, selection.source, selection.destination,
  );
  if (blocked) throw new Error(blocked);
  return { total, elite };
}
