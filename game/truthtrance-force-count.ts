import { location, territory } from './board';
import type { FactionId } from './catalog';

export type ForceCountFact = {
  kind: 'forceCount';
  zone:
    | { kind: 'reserves' }
    | { kind: 'tanks' }
    | { kind: 'location'; territory: string; sector: number };
  counter: 'total' | 'normal' | 'elite';
  compare: 'eq' | 'gte' | 'lte';
  value: number;
};

export type ForceCountPlayer = {
  faction: FactionId;
  reserves: number;
  tanks: number;
  forces: Readonly<Record<string, number>>;
  elites?: Readonly<{
    reserves: number;
    tanks: number;
    forces: Readonly<Record<string, number>>;
  }>;
};

type ValidLocation = Readonly<{ territory: string; sector: number }>;

const splitFactions = new Set<FactionId>(['emperor', 'fremen', 'ixians']);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function count(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} must be a nonnegative safe whole number.`);
  return value;
}

/** Parse a current public force fact against the room's actual board locations. */
export function parseForceCountFact(
  value: unknown,
  validLocations: readonly ValidLocation[],
): ForceCountFact {
  if (
    !record(value) ||
    !exactKeys(value, ['kind', 'zone', 'counter', 'compare', 'value']) ||
    value.kind !== 'forceCount'
  )
    throw new Error('Choose only a current physical force-count fact.');
  if (
    value.counter !== 'total' &&
    value.counter !== 'normal' &&
    value.counter !== 'elite'
  )
    throw new Error('Choose total, normal, or elite physical forces.');
  if (
    value.compare !== 'eq' &&
    value.compare !== 'gte' &&
    value.compare !== 'lte'
  )
    throw new Error(
      'Compare force counts using exactly, at least, or at most.',
    );
  const threshold = count(value.value, 'The force threshold');
  const zone = value.zone;
  if (!record(zone)) throw new Error('Choose a current force pool.');
  let parsedZone: ForceCountFact['zone'];
  if (zone.kind === 'reserves' || zone.kind === 'tanks') {
    if (!exactKeys(zone, ['kind']))
      throw new Error('Reserve and Tanks facts cannot name a board location.');
    parsedZone = { kind: zone.kind };
  } else if (zone.kind === 'location') {
    if (
      !exactKeys(zone, ['kind', 'territory', 'sector']) ||
      typeof zone.territory !== 'string' ||
      !Number.isSafeInteger(zone.sector) ||
      !validLocations.some(
        (candidate) =>
          candidate.territory === zone.territory &&
          candidate.sector === zone.sector,
      )
    )
      throw new Error('Choose an exact current board territory and sector.');
    parsedZone = {
      kind: 'location',
      territory: zone.territory,
      sector: zone.sector as number,
    };
  } else {
    throw new Error('Choose reserves, the Tanks, or a current board location.');
  }
  return {
    kind: 'forceCount',
    zone: parsedZone,
    counter: value.counter,
    compare: value.compare,
    value: threshold,
  };
}

/** Public reason that denomination-specific facts cannot be answered safely. */
export function forceCountCounterError(
  player: Pick<ForceCountPlayer, 'faction' | 'elites'>,
  counter: ForceCountFact['counter'],
): string | null {
  return counter !== 'total' &&
    splitFactions.has(player.faction) &&
    player.elites === undefined
    ? 'Normal and elite force counts are unavailable without a tracked special-force split.'
    : null;
}

function chosenPool(player: ForceCountPlayer, fact: ForceCountFact) {
  const eliteState = player.elites;
  if (eliteState !== undefined && !record(eliteState))
    throw new Error('The tracked special-force split is malformed.');

  let totalValue: unknown;
  let eliteValue: unknown = 0;
  if (fact.zone.kind === 'reserves') {
    totalValue = player.reserves;
    if (eliteState !== undefined) eliteValue = eliteState.reserves;
  } else if (fact.zone.kind === 'tanks') {
    totalValue = player.tanks;
    if (eliteState !== undefined) eliteValue = eliteState.tanks;
  } else {
    if (!record(player.forces))
      throw new Error('The selected board force pool is malformed.');
    const key = location(fact.zone.territory, fact.zone.sector);
    totalValue = player.forces[key] ?? 0;
    if (eliteState !== undefined) {
      if (!record(eliteState.forces))
        throw new Error('The selected elite board force pool is malformed.');
      eliteValue = eliteState.forces[key] ?? 0;
    }
  }
  const total = count(totalValue, 'The selected physical force count');
  const elite = count(eliteValue, 'The selected elite force count');
  if (elite > total)
    throw new Error(
      'The selected elite force count exceeds its physical force pool.',
    );
  return { total, elite };
}

/** Compare one current physical pool; unrelated pools are deliberately unread. */
export function forceCountFactMatches(
  player: ForceCountPlayer,
  fact: ForceCountFact,
): boolean {
  const unavailable = forceCountCounterError(player, fact.counter);
  if (unavailable) throw new Error(unavailable);
  const pool = chosenPool(player, fact);
  const actual =
    fact.counter === 'total'
      ? pool.total
      : fact.counter === 'elite'
        ? pool.elite
        : pool.total - pool.elite;
  return fact.compare === 'eq'
    ? actual === fact.value
    : fact.compare === 'gte'
      ? actual >= fact.value
      : actual <= fact.value;
}

export function forceCountFactText(fact: ForceCountFact): string {
  const comparison =
    fact.compare === 'eq'
      ? 'exactly'
      : fact.compare === 'gte'
        ? 'at least'
        : 'at most';
  const plural = fact.value === 1 ? 'force' : 'forces';
  const counters =
    fact.counter === 'total'
      ? `physical ${plural}`
      : fact.counter === 'normal'
        ? `normal ${plural}`
        : `elite ${plural}`;
  const zone =
    fact.zone.kind === 'reserves'
      ? 'in your reserves'
      : fact.zone.kind === 'tanks'
        ? 'in the Tleilaxu Tanks'
        : `in ${territory(fact.zone.territory).name}, sector ${fact.zone.sector}`;
  return `you currently have ${comparison} ${fact.value} ${counters} ${zone}`;
}
