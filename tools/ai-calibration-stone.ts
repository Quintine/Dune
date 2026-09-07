/**
 * Offline, deterministic base-game calibration. Never import into the app/server:
 * this harness replaces crypto.getRandomValues only within its own Node process.
 * Run: node --import tsx tools/ai-calibration-stone.ts --seed 20260909 --out /tmp/dune-ai-calibration-stone.json
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyAction,
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
const masterSeed = positive('--seed', 20260909) >>> 0;
const gameLimit = positive('--games', 96);
const maxActions = positive('--max-actions', 6000);
if (gameLimit > 96) throw new Error('This balanced design contains 96 games.');
const output = resolve(
  argument('--out', '/tmp/dune-ai-calibration-stone.json'),
);
const started = Date.now();

function sourceFingerprint() {
  const files = readdirSync('game')
    .filter((name) => name.endsWith('.ts'))
    .sort()
    .map((name) => `game/${name}`);
  files.push('tools/ai-calibration-stone.ts');
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
function invariant(g: Game) {
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
): Row {
  const count = 4;
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
    faction: baseFactions[(block + direction * seat + 6) % 6],
    level: DIFFICULTIES[(seat + shift) % DIFFICULTIES.length],
  }));
  const row: Row = {
    index,
    seed,
    block,
    shift,
    replicate,
    direction,
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
  );
  try {
    for (const seat of seats.slice(1))
      joinGame(g, newPlayer(seat.id, seat.faction, seat.faction));
    // Move to the assigned physical circles through genuine lobby actions.
    // Two spare circles permit cycles without overwriting another player's seat.
    for (
      let moves = 0;
      seats.some((s) => g.playerPositions![s.id] !== s.circle);
      moves++
    ) {
      if (moves > 20) throw new Error('Circle assignment did not converge');
      const occupied = new Set(Object.values(g.playerPositions!));
      const direct = seats.find(
        (s) => g.playerPositions![s.id] !== s.circle && !occupied.has(s.circle),
      );
      const seat =
        direct ?? seats.find((s) => g.playerPositions![s.id] !== s.circle)!;
      const position =
        direct?.circle ?? [1, 2, 3, 4, 5, 6].find((n) => !occupied.has(n))!;
      g = applyAction(g, seat.id, { type: 'seatPosition', position });
    }
    for (const [i, p] of g.players.entries()) {
      p.bot = seats[i].level;
      p.ready = true;
    }
    // Go through the real supported start gate; no advanced/expansion injection.
    g = applyAction(g, g.host, { type: 'start' });
    for (let step = 0; step < maxActions; step++) {
      let next: Game | undefined;
      // Match runBots' player/candidate order while counting its caught RuleErrors.
      for (const p of g.players.filter((p) => p.bot)) {
        for (const [rank, action] of botActions(viewGame(g, p.id)).entries()) {
          if (rank === 0) row.firstCandidatesByLevel[p.bot!]++;
          try {
            next = applyAction(g, p.id, action);
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
      g = next;
      row.accepted++;
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
  outer: for (let replicate = 0; replicate < 2; replicate++)
    for (const direction of [1, -1] as const)
      for (let block = 0; block < 6; block++)
        for (let shift = 0; shift < 4; shift++) {
          if (rows.length >= gameLimit) break outer;
          const row = play(rows.length, block, shift, replicate, direction);
          rows.push(row);
          if (rows.length % 4 === 0 || row.outcome !== 'complete')
            console.log(
              JSON.stringify({
                progress: rows.length,
                of: gameLimit,
                replicate,
                direction,
                block,
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
      advanced: false,
      expansions: [],
      techTokens: false,
      players: 4,
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
      [4].map((n) => [n, statistics(rows.filter((r) => r.players === n))]),
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
    rows.some((r) => r.outcome !== 'complete') ||
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
