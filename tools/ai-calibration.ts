/**
 * Offline, deterministic base-game calibration. Never import into the app/server:
 * this harness replaces crypto.getRandomValues only within its own Node process.
 * Run: node --import tsx tools/ai-calibration.ts --seed 20260906 --out /tmp/dune-ai-calibration.json
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
const masterSeed = positive('--seed', 20260906) >>> 0;
const gameLimit = positive('--games', 120);
const maxActions = positive('--max-actions', 6000);
if (gameLimit > 120)
  throw new Error('This balanced design contains 120 games.');
const output = resolve(argument('--out', '/tmp/dune-ai-calibration.json'));
const started = Date.now();

function sourceFingerprint() {
  const files = readdirSync('game')
    .filter((name) => name.endsWith('.ts'))
    .sort()
    .map((name) => `game/${name}`);
  files.push('tools/ai-calibration.ts');
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
const cryptoObject = globalThis.crypto;
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

type Seat = { id: string; seat: number; faction: FactionId; level: Difficulty };
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
function play(index: number, count: number, block: number, shift: number): Row {
  // The four shifts in a roster block share deal seed/code and stable seat IDs.
  const seed =
    (masterSeed +
      Math.imul(count, 0x9e3779b9) +
      Math.imul(block, 0x85ebca6b)) >>>
    0;
  randomWord = generator(seed);
  const code = `C${seed.toString(36).padStart(7, '0')}`;
  const seats: Seat[] = Array.from({ length: count }, (_, seat) => ({
    id: `seat-${seat}`,
    seat,
    faction: baseFactions[(block + seat) % 6],
    level: DIFFICULTIES[(seat + shift) % DIFFICULTIES.length],
  }));
  const row: Row = {
    index,
    seed,
    block,
    shift,
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
  };
  const gameStart = Date.now();
  let g = createGame(
    code,
    newPlayer(seats[0].id, seats[0].faction, seats[0].faction),
  );
  try {
    for (const seat of seats.slice(1))
      joinGame(g, newPlayer(seat.id, seat.faction, seat.faction));
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
        for (const action of botActions(viewGame(g, p.id))) {
          try {
            next = applyAction(g, p.id, action);
            break;
          } catch (error) {
            if (!(error instanceof RuleError)) throw error;
            const mode =
              typeof action.mode === 'string' ? `/${action.mode}` : '';
            const reason = `${action.type}${mode}: ${error.message}`;
            row.rejected++;
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
  outer: for (let count = 2; count <= 6; count++)
    for (let block = 0; block < 6; block++)
      for (let shift = 0; shift < 4; shift++) {
        if (rows.length >= gameLimit) break outer;
        const row = play(rows.length, count, block, shift);
        rows.push(row);
        if (rows.length % 12 === 0 || row.outcome !== 'complete')
          console.log(
            JSON.stringify({
              progress: rows.length,
              of: gameLimit,
              last: {
                outcome: row.outcome,
                players: count,
                seed: row.seed,
                shift,
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
    },
    rng: 'Mulberry32; one seeded Uint32Array engine stream per roster block; shifts reset same seed',
    sources,
    sourceFilesChangedDuringRun: sources.combined !== currentSources.combined,
    elapsedMs: Date.now() - started,
    aggregate: statistics(rows),
    byPlayerCount: Object.fromEntries(
      [2, 3, 4, 5, 6].map((n) => [
        n,
        statistics(rows.filter((r) => r.players === n)),
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
  if (rows.some((r) => r.outcome !== 'complete')) process.exitCode = 1;
} finally {
  if (originalRandom)
    Object.defineProperty(cryptoObject, 'getRandomValues', originalRandom);
  else Reflect.deleteProperty(cryptoObject, 'getRandomValues');
}
