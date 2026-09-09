import type { FactionId } from './catalog';
import {
  HomeworldCustodyError,
  homeworldForceGroups,
  homeworldLocations,
  type HomeworldCustody,
  type HomeworldCustodyContext,
} from './homeworld-custody';

type Cause = 'change' | 'turnStart' | 'turnEnd';
type Source = {
  event: string;
  turn: number;
  cause: Cause | 'setup';
  snapshot: number;
  signature: string;
};
export type HomeworldOccupationQualification = {
  event: string;
  world: string;
  player: string;
  faction: FactionId;
  turn: number;
  cause: 'sole' | 'turnStart' | 'turnEnd';
};
export type HomeworldOccupationHistory = {
  version: 1;
  coverage: 'setup';
  advanced: boolean;
  seats: [string, FactionId][];
  /** Interned canonical public typed force groups, shared across event receipts. */
  snapshots: string[];
  sources: Source[];
  qualifications: HomeworldOccupationQualification[];
  signature: string;
};
type Snapshot = [string, [string, number, number][]][];
const validText = (s: unknown): s is string =>
  typeof s === 'string' && s.trim().length > 0;
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
function requireHistory(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition)
    throw new HomeworldCustodyError(`Homeworld occupation history: ${message}`);
}
function keys(value: unknown, expected: string[]): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function seats(context: HomeworldCustodyContext): [string, FactionId][] {
  homeworldLocations(context);
  return context.players
    .map((p): [string, FactionId] => [p.id, p.faction])
    .sort((a, b) => a[0].localeCompare(b[0]));
}
function sourceSnapshot(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
): string {
  const snapshot: Snapshot = homeworldForceGroups(context, custody).map(
    (home) => [
      home.id,
      Object.entries(home.forces)
        .filter(
          ([player, forces]) =>
            player === home.native || forces.normal + forces.elite > 0,
        )
        .map(([player, forces]): [string, number, number] => [
          player,
          forces.normal,
          forces.elite,
        ])
        .sort((a, b) => a[0].localeCompare(b[0])),
    ],
  );
  snapshot.sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(snapshot);
}
function readSnapshot(
  value: string,
  context: HomeworldCustodyContext,
): Snapshot {
  requireHistory(typeof value === 'string', 'a source snapshot is missing.');
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    requireHistory(false, 'a source snapshot is malformed.');
  }
  const homes = homeworldLocations(context);
  requireHistory(
    Array.isArray(raw) && raw.length === homes.length,
    'a source snapshot needs every seated world.',
  );
  const visited = new Set<string>();
  const reserves = new Map(
    context.players.map((p) => [p.id, { normal: 0, elite: 0 }]),
  );
  const custody: HomeworldCustody = { visitors: {}, salusa: null };
  for (const row of raw) {
    requireHistory(
      Array.isArray(row) &&
        row.length === 2 &&
        validText(row[0]) &&
        Array.isArray(row[1]),
      'invalid world source row.',
    );
    const home = homes.find((h) => h.id === row[0]);
    requireHistory(
      home && !visited.has(home.id),
      'a source world is unknown or repeated.',
    );
    visited.add(home.id);
    const players = new Set<string>();
    for (const group of row[1]) {
      requireHistory(
        Array.isArray(group) &&
          group.length === 3 &&
          validText(group[0]) &&
          reserves.has(group[0]) &&
          !players.has(group[0]) &&
          whole(group[1]) &&
          whole(group[2]),
        'invalid typed source army.',
      );
      const [player, normal, elite] = group as [string, number, number];
      players.add(player);
      if (player === home.native) {
        const total = reserves.get(player)!;
        total.normal += normal;
        total.elite += elite;
        if (home.secondary) custody.salusa = { normal, elite };
      } else (custody.visitors[home.id] ??= {})[player] = { normal, elite };
    }
    requireHistory(
      players.has(home.native),
      'the native physical pool is missing.',
    );
  }
  const historical: HomeworldCustodyContext = {
    advanced: context.advanced,
    players: context.players.map((p) => {
      const total = reserves.get(p.id)!;
      return {
        id: p.id,
        faction: p.faction,
        reserves: total.normal + total.elite,
        eliteReserves: total.elite,
      };
    }),
  };
  requireHistory(
    sourceSnapshot(historical, custody) === value,
    'source armies are not canonical or physically valid.',
  );
  return raw as Snapshot;
}
function sourceSignature(
  source: Omit<Source, 'signature'>,
  snapshot: string,
): string {
  return JSON.stringify([
    'homeworldOccupationSource',
    source.event,
    source.turn,
    source.cause,
    snapshot,
  ]);
}
function historySignature(history: HomeworldOccupationHistory): string {
  return JSON.stringify([
    'homeworldOccupationHistory',
    history.version,
    history.coverage,
    history.advanced,
    history.seats,
    history.snapshots,
    history.sources,
    history.qualifications,
  ]);
}
function facts(
  source: Source,
  snapshot: Snapshot,
  context: HomeworldCustodyContext,
): HomeworldOccupationQualification[] {
  if (source.cause === 'setup') return [];
  const homes = homeworldLocations(context);
  const result: HomeworldOccupationQualification[] = [];
  for (const [world, groups] of snapshot) {
    const native = homes.find((home) => home.id === world)!.native;
    const present = groups.filter(([, normal, elite]) => normal + elite > 0);
    const foreign =
      source.cause === 'change'
        ? present.length === 1 && present[0][0] !== native
          ? present
          : []
        : present.filter(([player]) => player !== native);
    for (const [player] of foreign)
      result.push({
        event: source.event,
        world,
        player,
        faction: context.players.find((p) => p.id === player)!.faction,
        turn: source.turn,
        cause: source.cause === 'change' ? 'sole' : source.cause,
      });
  }
  return result;
}
const factKey = (fact: HomeworldOccupationQualification) =>
  JSON.stringify([fact.world, fact.player, fact.turn, fact.cause]);

/** Validate stored evidence independently of today's physical garrisons. This
 * proves recorded qualification, never current entitlement or a spice award. */
export function validateHomeworldOccupationHistory(
  history: HomeworldOccupationHistory,
  context: HomeworldCustodyContext,
  currentTurn?: number,
): void {
  requireHistory(
    keys(history, [
      'version',
      'coverage',
      'advanced',
      'seats',
      'snapshots',
      'sources',
      'qualifications',
      'signature',
    ]) &&
      history.version === 1 &&
      history.coverage === 'setup' &&
      history.advanced === context.advanced &&
      JSON.stringify(history.seats) === JSON.stringify(seats(context)) &&
      Array.isArray(history.snapshots) &&
      history.snapshots.length > 0 &&
      Array.isArray(history.sources) &&
      history.sources.length > 0 &&
      Array.isArray(history.qualifications),
    'the initialized record or seated world roster is invalid.',
  );
  if (currentTurn !== undefined)
    requireHistory(
      whole(currentTurn) && currentTurn > 0,
      'invalid current turn.',
    );
  requireHistory(
    new Set(history.snapshots).size === history.snapshots.length,
    'source snapshots must be interned.',
  );
  const snapshots = history.snapshots.map((value) =>
    readSnapshot(value, context),
  );
  const events = new Set<string>(),
    used = new Set<number>(),
    seenFacts = new Set<string>();
  const expected: HomeworldOccupationQualification[] = [];
  let lastTurn = 0;
  for (const [index, source] of history.sources.entries()) {
    requireHistory(
      keys(source, ['event', 'turn', 'cause', 'snapshot', 'signature']) &&
        validText(source.event) &&
        !events.has(source.event) &&
        whole(source.turn) &&
        source.turn > 0 &&
        source.turn >= lastTurn &&
        (currentTurn === undefined || source.turn <= currentTurn) &&
        (index === 0
          ? source.cause === 'setup'
          : ['change', 'turnStart', 'turnEnd'].includes(source.cause)) &&
        whole(source.snapshot) &&
        source.snapshot < snapshots.length,
      'a source event is duplicated, stale, future or malformed.',
    );
    events.add(source.event);
    used.add(source.snapshot);
    lastTurn = source.turn;
    requireHistory(
      source.signature ===
        sourceSignature(source, history.snapshots[source.snapshot]),
      'source event physical facts changed.',
    );
    if (index === 0) {
      const homes = homeworldLocations(context);
      requireHistory(
        snapshots[source.snapshot].every(([world, groups]) =>
          groups.every(
            ([player]) =>
              player === homes.find((home) => home.id === world)!.native,
          ),
        ),
        'setup cannot prove history while foreign armies are present.',
      );
    }
    for (const fact of facts(source, snapshots[source.snapshot], context)) {
      const key = factKey(fact);
      if (!seenFacts.has(key)) {
        expected.push(fact);
        seenFacts.add(key);
      }
    }
  }
  requireHistory(
    used.size === snapshots.length,
    'unreferenced source snapshots are invalid.',
  );
  requireHistory(
    history.qualifications.every((fact) =>
      keys(fact, ['event', 'world', 'player', 'faction', 'turn', 'cause']),
    ) && JSON.stringify(history.qualifications) === JSON.stringify(expected),
    'qualification evidence no longer matches the independent source facts.',
  );
  requireHistory(
    history.signature === historySignature(history),
    'the signed history was changed.',
  );
}

export function createHomeworldOccupationHistory(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  turn: number,
  event: string,
): HomeworldOccupationHistory {
  requireHistory(
    Object.keys(custody.visitors).length === 0,
    'setup requires empty foreign custody.',
  );
  const snapshot = sourceSnapshot(context, custody);
  const source: Source = {
    event,
    turn,
    cause: 'setup',
    snapshot: 0,
    signature: '',
  };
  source.signature = sourceSignature(source, snapshot);
  const history: HomeworldOccupationHistory = {
    version: 1,
    coverage: 'setup',
    advanced: context.advanced,
    seats: seats(context),
    snapshots: [snapshot],
    sources: [source],
    qualifications: [],
    signature: '',
  };
  history.signature = historySignature(history);
  validateHomeworldOccupationHistory(history, context, turn);
  return history;
}

/** Observe only committed semantic changes. Simultaneous destruction belongs to
 * one caller event; separately ordered loser/winner losses need separate events. */
export function observeHomeworldOccupation(
  history: HomeworldOccupationHistory,
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
  turn: number,
  cause: Cause,
  event: string,
): HomeworldOccupationHistory {
  validateHomeworldOccupationHistory(history, context, turn);
  requireHistory(
    whole(turn) &&
      turn > 0 &&
      validText(event) &&
      ['change', 'turnStart', 'turnEnd'].includes(cause),
    'invalid observation event.',
  );
  const snapshot = sourceSnapshot(context, custody);
  const prior = history.sources.find((source) => source.event === event);
  if (prior) {
    requireHistory(
      prior.turn === turn &&
        prior.cause === cause &&
        history.snapshots[prior.snapshot] === snapshot,
      'a repeated source event has different physical facts.',
    );
    return structuredClone(history);
  }
  const latest = history.sources.at(-1)!;
  requireHistory(
    turn >= latest.turn,
    'observations cannot move backwards in time.',
  );
  if (
    cause === 'change' &&
    latest.turn === turn &&
    history.snapshots[latest.snapshot] === snapshot
  )
    return structuredClone(history);
  const result = structuredClone(history);
  let index = result.snapshots.indexOf(snapshot);
  if (index < 0) {
    index = result.snapshots.length;
    result.snapshots.push(snapshot);
  }
  const source: Source = { event, turn, cause, snapshot: index, signature: '' };
  source.signature = sourceSignature(source, snapshot);
  result.sources.push(source);
  const existing = new Set(result.qualifications.map(factKey));
  for (const fact of facts(source, readSnapshot(snapshot, context), context)) {
    if (!existing.has(factKey(fact))) {
      result.qualifications.push(fact);
      existing.add(factKey(fact));
    }
  }
  result.signature = historySignature(result);
  return result;
}

/** No qualification since proven setup is affirmative evidence. A past qualifier
 * or absent legacy history needs the pending entitlement/expiry ruling. */
export function tupileOccupationStatus(
  history: HomeworldOccupationHistory | undefined,
  context: HomeworldCustodyContext,
  currentTurn?: number,
): 'unoccupied' | 'unknown' {
  if (history === undefined) return 'unknown';
  validateHomeworldOccupationHistory(history, context, currentTurn);
  const native = context.players.find((p) => p.faction === 'choam');
  if (!native) return 'unknown';
  return history.qualifications.some((fact) => fact.world === 'homeworld:choam')
    ? 'unknown'
    : 'unoccupied';
}
