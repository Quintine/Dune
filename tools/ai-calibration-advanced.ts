/**
 * Offline, deterministic Advanced base-faction calibration through the shared setup initializer. Never import into the app/server:
 * this harness replaces crypto.getRandomValues only within its own Node process.
 * Run: node --import tsx tools/ai-calibration-advanced.ts --seed 20260909 --out /tmp/dune-ai-calibration-advanced.json
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyAction,
  initializeBaseGameForAudit,
  createGame,
  joinGame,
  newPlayer,
  RuleError,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { FACTIONS, type FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';

const args = process.argv.slice(2);
function argument(name: string, fallback: string): string {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error(`Missing value for ${name}`);
  return args[index + 1];
}
function positive(name: string, fallback: number): number {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive safe integer`);
  return value;
}
for (let i = 0; i < args.length; i += 2)
  if (!['--seed', '--games', '--max-actions', '--out'].includes(args[i]))
    throw new Error(`Unknown argument ${args[i]}`);
const masterSeed = positive('--seed', 20260923) >>> 0;
const gameLimit = positive('--games', 456);
const maxActions = positive('--max-actions', 6000);
if (gameLimit > 456) throw new Error('This design contains 456 games.');
const output = resolve(
  argument('--out', '/tmp/dune-ai-calibration-advanced.json'),
);
const started = Date.now();

function sourceFingerprint() {
  const files = readdirSync('game')
    .filter((name) => name.endsWith('.ts'))
    .sort()
    .map((name) => `game/${name}`);
  files.push('tools/ai-calibration-advanced.ts');
  const hashes = Object.fromEntries(
    files.map((file) => [
      file,
      createHash('sha256').update(readFileSync(file)).digest('hex'),
    ]),
  );
  return {
    combined: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),
    files: hashes,
  };
}
const sources = sourceFingerprint();

// Mulberry32 produces deterministic 32-bit words for the engine's shuffle API.
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let word = Math.imul(state ^ (state >>> 15), state | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return (word ^ (word >>> 14)) >>> 0;
  };
}
let randomWord = generator(masterSeed);
let uuidWord = generator(masterSeed ^ 0xa5a5a5a5);
const cryptoObject = globalThis.crypto;
const originalUuid = Object.getOwnPropertyDescriptor(
  cryptoObject,
  'randomUUID',
);
Object.defineProperty(cryptoObject, 'randomUUID', {
  configurable: true,
  value: () => {
    const hex = Array.from({ length: 4 }, () =>
      uuidWord().toString(16).padStart(8, '0'),
    )
      .join('')
      .split('');
    hex[12] = '4';
    hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
    const id = hex.join('');
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  },
});
const originalRandom = Object.getOwnPropertyDescriptor(
  cryptoObject,
  'getRandomValues',
);
Object.defineProperty(cryptoObject, 'getRandomValues', {
  configurable: true,
  value: <T extends ArrayBufferView | null>(array: T): T => {
    if (!(array instanceof Uint32Array))
      throw new Error(
        'Calibration only supports the engine Uint32Array RNG contract.',
      );
    for (let i = 0; i < array.length; i++) array[i] = randomWord();
    return array;
  },
});

type Seat = {
  id: string;
  seat: number;
  circle: number;
  faction: FactionId;
  level: Difficulty;
};
type Outcome =
  | 'complete'
  | 'deadlock'
  | 'action-limit'
  | 'exception'
  | 'invariant';
type Row = {
  index: number;
  seed: number;
  block: number;
  shift: number;
  replicate: number;
  direction: 1 | -1;
  rosterMask: number;
  setupActions: number;
  setupTransitions: string[];
  jsonRoundTrips: number;
  rejectionSamples: {
    player: string;
    level: Difficulty;
    rank: number;
    action: object;
    reason: string;
    context: object;
  }[];
  players: number;
  code: string;
  seats: Seat[];
  outcome: Outcome;
  turn: number;
  phase: number;
  accepted: number;
  rejected: number;
  rejectionReasons: Record<string, number>;
  rejectedByLevel: Record<Difficulty, number>;
  winner: string[];
  elapsedMs: number;
  acceptedByLevel: Record<Difficulty, number>;
  firstCandidatesByLevel: Record<Difficulty, number>;
  firstRejectedByLevel: Record<Difficulty, number>;
  acceptedCandidateRanks: Record<string, number>;
  acceptedTraceHash?: string;
  finalStateHash?: string;
  failure?: string;
  context?: object;
};
const rows: Row[] = [];
const baseFactions = FACTIONS.filter((f) => f.expansion === 'base').map(
  (f) => f.id,
);
const expectedCards = baseDeck()
  .map((c) => c.id)
  .sort();
function invariant(g: Game) {
  if (!g.advanced || g.expansions.length || g.techTokens)
    throw new Error('Configuration changed outside Advanced base scope');
  const undealtSetup =
    g.setupStage === 'prediction' || g.setupStage === 'traitors';
  if (g.setupStage && g.players.some((p) => p.hand.length > 0))
    throw new Error('Treachery dealt before force setup completes');
  if (
    undealtSetup &&
    g.players.some(
      (p) => p.spice !== 0 || Object.keys(p.forces).length || p.elites,
    )
  )
    throw new Error(
      'Starting spice or forces exposed before traitor choices finish',
    );
  if (
    g.setupStage === 'prediction' &&
    g.players.some((p) => p.traitors.length || p.traitorChoices.length)
  )
    throw new Error('Private traitors dealt before prediction');
  const heldCards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(
      g.auction.index + (g.currentAuctionSale?.origin === 'normal' ? 1 : 0),
    ) ?? []),
  ];
  if (
    new Set(heldCards.map((c) => c.id)).size !== heldCards.length ||
    JSON.stringify(heldCards.map((c) => c.id).sort()) !==
      JSON.stringify(expectedCards)
  )
    throw new Error('Physical base treachery inventory changed');
  if (g.setupStage !== 'prediction') {
    const traitors = [
      ...(g.traitorReserve ?? []),
      ...g.players.flatMap((p) => [...p.traitors, ...p.traitorChoices]),
    ];
    if (
      new Set(traitors).size !== traitors.length ||
      JSON.stringify(traitors.slice().sort()) !==
        JSON.stringify(
          g.players.flatMap((p) => p.leaders.map((l) => l.id)).sort(),
        )
    )
      throw new Error('Participating traitor inventory changed');
  }

  for (const p of g.players) {
    const onBoard = Object.values(p.forces).reduce((a, b) => a + b, 0);
    if (p.reserves + p.tanks + onBoard !== 20)
      throw new Error(`Force conservation: ${p.id}/${p.faction}`);
    if (
      ![p.reserves, p.tanks, ...Object.values(p.forces), p.spice].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      )
    )
      throw new Error(`Nonnegative integer resources: ${p.id}/${p.faction}`);
    if (p.faction === 'emperor' || p.faction === 'fremen') {
      const e = p.elites;
      if (!undealtSetup && !e)
        throw new Error(`Missing Advanced elites: ${p.id}`);
      if (e) {
        const total =
          e.reserves +
          e.tanks +
          Object.values(e.forces).reduce((a, b) => a + b, 0);
        if (
          total !== (p.faction === 'emperor' ? 5 : 3) ||
          e.reserves > p.reserves ||
          e.tanks > p.tanks ||
          e.revived > 1 ||
          ![e.reserves, e.tanks, e.revived, ...Object.values(e.forces)].every(
            (n) => Number.isSafeInteger(n) && n >= 0,
          ) ||
          Object.entries(e.forces).some(
            ([key, amount]) => amount > (p.forces[key] ?? 0),
          )
        )
          throw new Error(`Elite conservation/quota: ${p.id}`);
      }
    } else if (p.elites)
      throw new Error(`Unexpected base elite force type: ${p.id}`);
    if (
      p.leaders.length !== 5 ||
      new Set(p.leaders.map((l) => l.id)).size !== 5 ||
      p.leaders.some((l) => !Number.isSafeInteger(l.deaths) || l.deaths < 0)
    )
      throw new Error(`Native leader inventory: ${p.id}`);
    const temporary =
      g.decision?.kind === 'handExchange' && g.decision.player === p.id
        ? g.decision.count
        : 0;
    if (p.hand.length > (p.faction === 'harkonnen' ? 8 : 4) + temporary)
      throw new Error(`Hand limit: ${p.id}/${p.faction}`);
  }
}
function context(g: Game) {
  return {
    status: g.status,
    setupStage: g.setupStage ?? null,
    turn: g.turn,
    phase: g.phase,
    active: g.active,
    decision: g.decision?.kind ?? null,
    decisionPlayer: g.decision?.player ?? null,
    response: g.response?.kind ?? null,
    responseOwner: g.response?.owner ?? null,
    ready: g.ready,
    battle: g.battle
      ? {
          territory: g.battle.territory,
          revealed: g.battle.revealed,
          plans: Object.keys(g.battle.plans),
        }
      : null,
  };
}
function play(
  index: number,
  block: number,
  shift: number,
  replicate: number,
  direction: 1 | -1,
  rosterMask: number,
): Row {
  const roster = baseFactions.filter((_, i) => rosterMask & (1 << i));
  const count = roster.length;
  // The four shifts in a roster block share deal seed/code and stable seat IDs.
  const seed =
    (masterSeed +
      Math.imul(count, 0x9e3779b9) +
      Math.imul(block, 0x85ebca6b) +
      Math.imul(replicate, 0xc2b2ae35) +
      (direction === -1 ? 0x27d4eb2f : 0)) >>>
    0;
  randomWord = generator(seed);
  uuidWord = generator(seed ^ 0xa5a5a5a5);
  const code = `S${seed.toString(36).padStart(7, '0')}`;
  const seats: Seat[] = Array.from({ length: count }, (_, seat) => ({
    id: `seat-${seat}`,
    seat,
    circle: ((block + seat) % 6) + 1,
    faction: roster[direction === 1 ? seat : count - 1 - seat],
    level: DIFFICULTIES[(seat + shift) % DIFFICULTIES.length],
  }));
  const row: Row = {
    index,
    seed,
    block,
    shift,
    replicate,
    direction,
    rosterMask,
    setupActions: 0,
    setupTransitions: [],
    jsonRoundTrips: 0,
    rejectionSamples: [],
    players: count,
    code,
    seats,
    outcome: 'action-limit',
    turn: 1,
    phase: 0,
    accepted: 0,
    rejected: 0,
    rejectionReasons: {},
    rejectedByLevel: { Easy: 0, Medium: 0, Hard: 0, Brutal: 0 },
    winner: [],
    elapsedMs: 0,
    acceptedByLevel: { Easy: 0, Medium: 0, Hard: 0, Brutal: 0 },
    firstCandidatesByLevel: { Easy: 0, Medium: 0, Hard: 0, Brutal: 0 },
    firstRejectedByLevel: { Easy: 0, Medium: 0, Hard: 0, Brutal: 0 },
    acceptedCandidateRanks: {},
  };
  const gameStart = Date.now();
  const trace = createHash('sha256');
  let g = createGame(
    code,
    newPlayer(seats[0].id, seats[0].faction, seats[0].faction),
    true,
  );
  try {
    // Assign each genuine lobby seat before the next joins; this also works with all six circles occupied.
    for (const [i, seat] of seats.entries()) {
      if (i) joinGame(g, newPlayer(seat.id, seat.faction, seat.faction));
      if (g.playerPositions![seat.id] !== seat.circle)
        g = applyAction(g, seat.id, {
          type: 'seatPosition',
          position: seat.circle,
        });
    }
    for (const seat of seats) g = applyAction(g, seat.id, { type: 'ready' });
    for (const [i, p] of g.players.entries()) p.bot = seats[i].level;
    // Offline-only initializer calls the same staged production setup; the public Advanced start gate stays closed.
    const lobbyHash = JSON.stringify(g);
    const initialized = initializeBaseGameForAudit(g);
    if (JSON.stringify(g) !== lobbyHash)
      throw new Error('Audit initializer mutated the source lobby');
    g = initialized;
    invariant(g);
    row.setupTransitions.push(g.setupStage ?? g.status);
    for (let step = 0; step < maxActions; step++) {
      let next: Game | undefined;
      // Match runBots' player/candidate order while counting its caught RuleErrors.
      for (const p of g.players.filter((p) => p.bot)) {
        const view = viewGame(g, p.id);
        for (const other of view.players.filter((s) => s.id !== p.id))
          if (
            other.hand !== undefined ||
            other.traitors !== undefined ||
            other.traitorChoices !== undefined ||
            other.prediction !== undefined
          )
            throw new Error(
              'Private projection exposed another seat’s hidden setup/hand information',
            );
        if ('deck' in view || 'spiceDeck' in view || 'traitorReserve' in view)
          throw new Error('Private deck/reserve projected');
        const viewSnapshot = JSON.stringify(view);
        const actions = botActions(view);
        if (JSON.stringify(view) !== viewSnapshot)
          throw new Error('Candidate generation mutated the player projection');
        for (const [rank, action] of actions.entries()) {
          if (rank === 0) row.firstCandidatesByLevel[p.bot!]++;
          try {
            next = applyAction(g, p.id, action);
            if (g.status === 'setup') row.setupActions++;
            row.acceptedByLevel[p.bot!]++;
            const rankKey = String(rank + 1);
            row.acceptedCandidateRanks[rankKey] =
              (row.acceptedCandidateRanks[rankKey] ?? 0) + 1;
            trace.update(JSON.stringify({ player: p.id, action }) + '\n');
            break;
          } catch (error) {
            if (!(error instanceof RuleError)) throw error;
            const mode =
              typeof action.mode === 'string' ? `/${action.mode}` : '';
            const reason = `${action.type}${mode}: ${error.message}`;
            row.rejected++;
            if (row.rejectionSamples.length < 8)
              row.rejectionSamples.push({
                player: p.id,
                level: p.bot!,
                rank: rank + 1,
                action,
                reason,
                context: context(g),
              });
            if (row.rejected === 1) {
              const diagnostic = `${output}.first-rejection-${index}.json`;
              writeFileSync(
                diagnostic,
                JSON.stringify(
                  {
                    index,
                    seed,
                    rosterMask,
                    seats,
                    state: g,
                    player: p.id,
                    action,
                    reason,
                  },
                  null,
                  2,
                ),
              );
              console.log(
                JSON.stringify({
                  problem: 'rejected-candidate',
                  index,
                  diagnostic,
                  player: p.id,
                  level: p.bot,
                  reason,
                  context: context(g),
                }),
              );
            }
            if (rank === 0) row.firstRejectedByLevel[p.bot!]++;
            row.rejectedByLevel[p.bot!]++;
            row.rejectionReasons[reason] =
              (row.rejectionReasons[reason] ?? 0) + 1;
          }
        }
        if (next) break;
      }
      if (!next) {
        row.outcome = 'deadlock';
        row.context = context(g);
        break;
      }
      const previousStage = g.setupStage ?? g.status;
      g = next;
      row.accepted++;
      const currentStage = g.setupStage ?? g.status;
      if (
        previousStage !== currentStage &&
        (previousStage === 'prediction' ||
          previousStage === 'traitors' ||
          previousStage === 'forces')
      )
        row.setupTransitions.push(currentStage);
      // Subsequent real actions continue from serialized state, not merely a comparison-only clone.
      if (previousStage !== currentStage || row.accepted % 25 === 0) {
        const beforeViews = g.players.map((p) =>
          JSON.stringify(viewGame(g, p.id)),
        );
        const restored = JSON.parse(JSON.stringify(g)) as Game;
        if (
          JSON.stringify(g) !== JSON.stringify(restored) ||
          JSON.stringify(beforeViews) !==
            JSON.stringify(
              restored.players.map((p) =>
                JSON.stringify(viewGame(restored, p.id)),
              ),
            )
        )
          throw new Error(
            'JSON continuation changed state or private projections',
          );
        g = restored;
        row.jsonRoundTrips++;
      }
      try {
        invariant(g);
      } catch (error) {
        row.outcome = 'invariant';
        row.failure = String(error);
        row.context = context(g);
        break;
      }
      if (g.status === 'finished') {
        row.outcome = 'complete';
        row.winner = [...g.winner];
        break;
      }
    }
  } catch (error) {
    row.outcome = 'exception';
    row.failure = String(error);
    row.context = context(g);
  }
  if (row.outcome === 'action-limit') row.context = context(g);
  if (row.outcome !== 'complete')
    writeFileSync(
      `${output}.failure-${index}.json`,
      JSON.stringify({ row, state: g }, null, 2),
    );
  row.turn = g.turn;
  row.phase = g.phase;
  row.elapsedMs = Date.now() - gameStart;
  row.acceptedTraceHash = trace.digest('hex');
  row.finalStateHash = createHash('sha256')
    .update(JSON.stringify(g))
    .digest('hex');
  return row;
}
function statistics(subset: Row[]) {
  const completed = subset.filter((r) => r.outcome === 'complete');
  return {
    games: subset.length,
    complete: completed.length,
    outcomes: Object.fromEntries(
      ['complete', 'deadlock', 'action-limit', 'exception', 'invariant'].map(
        (status) => [status, subset.filter((r) => r.outcome === status).length],
      ),
    ),
    setupActions: subset.reduce((sum, r) => sum + r.setupActions, 0),
    jsonRoundTrips: subset.reduce((sum, r) => sum + r.jsonRoundTrips, 0),
    acceptedActions: subset.reduce((sum, r) => sum + r.accepted, 0),
    rejectedCandidates: subset.reduce((sum, r) => sum + r.rejected, 0),
    gamesWithRejections: subset.filter((r) => r.rejected > 0).length,
    meanCompletedTurns: completed.length
      ? completed.reduce((sum, r) => sum + r.turn, 0) / completed.length
      : null,
    turnHistogram: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        i + 1,
        completed.filter((r) => r.turn === i + 1).length,
      ]),
    ),
    byLevel: Object.fromEntries(
      DIFFICULTIES.map((level) => {
        const appearances = subset.flatMap((r) =>
          r.seats.filter((s) => s.level === level).map((s) => ({ r, s })),
        );
        const completeSeats = appearances.filter(
          ({ r }) => r.outcome === 'complete',
        );
        const winning = completeSeats.filter(({ r, s }) =>
          r.winner.includes(s.id),
        );
        return [
          level,
          {
            appearances: appearances.length,
            completedAppearances: completeSeats.length,
            winsIncludingShared: winning.length,
            winRateIncludingShared: completeSeats.length
              ? winning.length / completeSeats.length
              : null,
            fractionalWinCredit: winning.reduce(
              (sum, { r }) => sum + 1 / r.winner.length,
              0,
            ),
            acceptedActions: subset.reduce(
              (sum, r) => sum + r.acceptedByLevel[level],
              0,
            ),
            firstCandidates: subset.reduce(
              (sum, r) => sum + r.firstCandidatesByLevel[level],
              0,
            ),
            firstRejected: subset.reduce(
              (sum, r) => sum + r.firstRejectedByLevel[level],
              0,
            ),
            rejectedCandidates: subset.reduce(
              (sum, r) => sum + r.rejectedByLevel[level],
              0,
            ),
          },
        ];
      }),
    ),
  };
}
try {
  // Interleave counts so a 20-game pilot covers one roster of each size at every shift.
  const buckets = [2, 3, 4, 5, 6].map((count) =>
    Array.from({ length: 64 }, (_, mask) => mask).filter(
      (mask) => baseFactions.filter((_, i) => mask & (1 << i)).length === count,
    ),
  );
  const masks: number[] = [];
  for (let i = 0; buckets.some((b) => i < b.length); i++)
    for (const bucket of buckets)
      if (bucket[i] !== undefined) masks.push(bucket[i]);
  outer: for (let replicate = 0; replicate < 2; replicate++)
    for (const [block, mask] of masks.entries())
      for (let shift = 0; shift < 4; shift++) {
        if (rows.length >= gameLimit) break outer;
        const direction = replicate === 0 ? 1 : -1;
        const row = play(rows.length, block, shift, replicate, direction, mask);
        rows.push(row);
        if (rows.length % 4 === 0 || row.outcome !== 'complete' || row.rejected)
          console.log(
            JSON.stringify({
              progress: rows.length,
              of: gameLimit,
              replicate,
              block,
              mask,
              players: row.players,
              last: {
                outcome: row.outcome,
                turn: row.turn,
                accepted: row.accepted,
                rejected: row.rejected,
                failure: row.failure,
                context: row.context,
              },
              elapsedSeconds: Math.round((Date.now() - started) / 1000),
            }),
          );
        // Preserve the first failing sample and pause this study for a real correction; never mask it as a clean batch.
        if (row.outcome !== 'complete' || row.rejected) break outer;
      }
  const currentSources = sourceFingerprint();
  const reasons: Record<string, number> = {};
  for (const row of rows)
    for (const [reason, count] of Object.entries(row.rejectionReasons))
      reasons[reason] = (reasons[reason] ?? 0) + count;
  const result = {
    settings: {
      masterSeed,
      games: gameLimit,
      maxActions,
      output,
      advanced: true,
      initializer:
        'initializeBaseGameForAudit (shared staged production initializer; public Advanced gate remains closed)',
      expansions: [],
      techTokens: false,
      playerCounts: [2, 3, 4, 5, 6],
      rosterSubsets: 57,
      completedRequestedSample: rows.length === gameLimit,
      replicates: 2,
      factionDirections: [1, -1],
      rotatedPhysicalCircles: true,
    },
    rng: 'Mulberry32 engine shuffle stream plus independent seeded UUID stream; each four-shift deal block resets both',
    sources,
    sourceFilesChangedDuringRun: sources.combined !== currentSources.combined,
    finalSources: currentSources,
    elapsedMs: Date.now() - started,
    aggregate: statistics(rows),
    byPlayerCount: Object.fromEntries(
      [2, 3, 4, 5, 6].map((n) => [
        n,
        statistics(rows.filter((r) => r.players === n)),
      ]),
    ),
    factionAppearances: Object.fromEntries(
      baseFactions.map((f) => [
        f,
        rows.reduce(
          (sum, r) => sum + r.seats.filter((s) => s.faction === f).length,
          0,
        ),
      ]),
    ),
    rejectionReasons: Object.fromEntries(
      Object.entries(reasons).sort((a, b) => b[1] - a[1]),
    ),
    rows,
  };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        output,
        elapsedMs: result.elapsedMs,
        aggregate: result.aggregate,
        sourceFilesChangedDuringRun: result.sourceFilesChangedDuringRun,
      },
      null,
      2,
    ),
  );
  if (
    rows.length !== gameLimit ||
    rows.some((r) => r.outcome !== 'complete' || r.rejected) ||
    result.sourceFilesChangedDuringRun
  )
    process.exitCode = 1;
} finally {
  if (originalUuid)
    Object.defineProperty(cryptoObject, 'randomUUID', originalUuid);
  else Reflect.deleteProperty(cryptoObject, 'randomUUID');
  if (originalRandom)
    Object.defineProperty(cryptoObject, 'getRandomValues', originalRandom);
  else Reflect.deleteProperty(cryptoObject, 'getRandomValues');
}
