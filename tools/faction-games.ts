import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import {
  applyAction,
  createGame,
  initializeFactionExpansionsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  RuleError,
  type Action,
  type Game,
} from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { privateOutputDirectory, sourceSnapshot } from './verification';

const DEFAULT_SEED = 20_260_926;
const DEFAULT_MAX_ACTIONS = 3_500;
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;
type Profile = 'choam' | 'ecaz' | 'combined';
type Rules = 'basic' | 'advanced';

type Scenario = {
  ordinal: number;
  profile: Profile;
  rules: Rules;
  expansions: string[];
  roster: FactionId[];
};

const SCENARIOS: readonly Scenario[] = [
  {
    ordinal: 0,
    profile: 'choam',
    rules: 'basic',
    expansions: ['choam'],
    roster: ['richese', 'choam', 'emperor', 'guild'],
  },
  {
    ordinal: 1,
    profile: 'choam',
    rules: 'advanced',
    expansions: ['choam'],
    roster: ['richese', 'choam', 'emperor', 'guild'],
  },
  {
    ordinal: 2,
    profile: 'ecaz',
    rules: 'basic',
    expansions: ['ecaz'],
    roster: ['ecaz', 'moritani', 'atreides', 'beneGesserit'],
  },
  {
    ordinal: 3,
    profile: 'ecaz',
    rules: 'advanced',
    expansions: ['ecaz'],
    roster: ['ecaz', 'moritani', 'atreides', 'beneGesserit'],
  },
  {
    ordinal: 4,
    profile: 'combined',
    rules: 'basic',
    expansions: ['ix', 'choam', 'ecaz'],
    roster: ['ecaz', 'ixians', 'tleilaxu', 'choam', 'richese', 'moritani'],
  },
  {
    ordinal: 5,
    profile: 'combined',
    rules: 'advanced',
    expansions: ['ix', 'choam', 'ecaz'],
    roster: ['ecaz', 'ixians', 'tleilaxu', 'choam', 'richese', 'moritani'],
  },
];

type TraceEntry = {
  attempt: number;
  accepted: number;
  player: string;
  turn: number;
  phase: number;
  setup: string | null;
  decision: string | null;
  response: string | null;
  action: Action;
  outcome: 'accepted' | 'rejected';
  error?: string;
};

type Result = {
  name: string;
  profile: Profile;
  rules: Rules;
  advanced: boolean;
  seed: number;
  resumed: boolean;
  actions: number;
  attempts: number;
  restores: number;
  turn: number;
  phase: number;
  winner: string[];
  used: Record<string, number>;
  rejected: Record<string, number>;
  outcome: 'complete' | 'failure';
  error?: string;
};

function usage() {
  return (
    'Usage: node --import tsx tools/faction-games.ts --out NEW_PRIVATE_DIR ' +
    '[--seed UINT32] [--profile all|choam|ecaz|combined] ' +
    '[--rules both|basic|advanced] [--max-actions POSITIVE] ' +
    '[--resume FAILED_GAME.json]\n' +
    'Runs genuine faction-expansion setup and gameplay offline. Output must be a new private directory outside the checkout.'
  );
}

function supplied(name: string) {
  return process.argv
    .slice(2)
    .some((value) => value === `--${name}` || value.startsWith(`--${name}=`));
}

function unsigned32(value: string | undefined) {
  if (value === undefined) return DEFAULT_SEED;
  if (!/^\d+$/.test(value))
    throw new Error('--seed must be an unsigned 32-bit integer.');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0xffff_ffff)
    throw new Error('--seed must be an unsigned 32-bit integer.');
  return parsed;
}

function positive(value: string | undefined) {
  if (value === undefined) return DEFAULT_MAX_ACTIONS;
  if (!/^\d+$/.test(value))
    throw new Error('--max-actions must be a positive integer.');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error('--max-actions must be a positive integer.');
  return parsed;
}

function scenarioName(scenario: Scenario) {
  return `${scenario.profile}-${scenario.rules}`;
}

function parseProfile(value: string | undefined) {
  const profile = value ?? 'all';
  if (!['all', 'choam', 'ecaz', 'combined'].includes(profile))
    throw new Error('--profile must be all, choam, ecaz or combined.');
  return profile as Profile | 'all';
}

function parseRules(value: string | undefined) {
  const rules = value ?? 'both';
  if (!['both', 'basic', 'advanced'].includes(rules))
    throw new Error('--rules must be both, basic or advanced.');
  return rules as Rules | 'both';
}

function privateWrite(directory: string, name: string, value: unknown) {
  writeFileSync(
    resolve(directory, name),
    JSON.stringify(value, null, 2) + '\n',
    {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    },
  );
}

function gameCards(g: Game) {
  return [
    ...g.players.flatMap((player) => player.hand),
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...(g.ixSetupCards ?? []),
    ...(g.ixAuction?.cards ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
    ...(g.auction?.cards.slice(
      g.auction.index + Number(g.currentAuctionSale?.origin === 'normal'),
    ) ?? []),
  ];
}

function expectedCards(g: Game, roster: readonly FactionId[]) {
  return [
    ...treacheryDeck(g.expansions),
    ...(roster.includes('richese') ? richeseCards() : []),
  ]
    .map((card) => card.id)
    .sort();
}

function verifyCustody(g: Game, expected: readonly string[]) {
  assert.deepEqual(
    gameCards(g)
      .map((card) => card.id)
      .sort(),
    expected,
    'physical card custody',
  );
  for (const player of g.players)
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((sum, amount) => sum + amount, 0),
      20,
      `force custody ${player.faction}`,
    );
}

function freshGame(scenario: Scenario) {
  const [first, ...rest] = scenario.roster;
  const game = createGame(
    'FACTIONR',
    newPlayer(first, first, first),
    scenario.rules === 'advanced',
    scenario.expansions,
  );
  for (const faction of rest)
    joinGame(game, newPlayer(faction, faction, faction));
  for (const [index, player] of game.players.entries()) {
    player.bot = DIFFICULTIES[index % DIFFICULTIES.length];
    player.ready = true;
  }
  return initializeFactionExpansionsGameForAudit(game);
}

function resumedGame(path: string) {
  if (!statSync(path).isFile())
    throw new Error('--resume must name one regular JSON Game snapshot.');
  const input = readFileSync(path);
  const hash = createHash('sha256').update(input).digest('hex');
  let value: unknown;
  try {
    value = JSON.parse(input.toString('utf8'));
  } catch {
    throw new Error('--resume must contain one JSON Game snapshot.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('--resume must contain one JSON Game snapshot.');
  const game = value as Game;
  if (
    !['setup', 'playing'].includes(game.status) ||
    typeof game.advanced !== 'boolean' ||
    !Array.isArray(game.expansions) ||
    !Array.isArray(game.players) ||
    !game.players.length ||
    game.players.some(
      (player) =>
        !player ||
        typeof player.id !== 'string' ||
        typeof player.faction !== 'string' ||
        !DIFFICULTIES.includes(player.bot as (typeof DIFFICULTIES)[number]),
    )
  )
    throw new Error(
      '--resume is not an incomplete faction-games snapshot with saved AI profiles.',
    );
  const scenario = SCENARIOS.find(
    (candidate) =>
      candidate.rules === (game.advanced ? 'advanced' : 'basic') &&
      JSON.stringify(candidate.expansions) ===
        JSON.stringify(game.expansions) &&
      JSON.stringify(candidate.roster) ===
        JSON.stringify(game.players.map((player) => player.faction)),
  );
  if (!scenario)
    throw new Error(
      '--resume does not match one of the six fixed faction-games scenarios.',
    );
  // Projection validates the engine-facing shape and every private seat boundary.
  for (const player of game.players) viewGame(game, player.id);
  return { game, scenario, hash, path: resolve(path) };
}

function simulate(
  initial: Game,
  scenario: Scenario,
  seed: number,
  maxActions: number,
  resumed: boolean,
) {
  let game = initial;
  const expected = expectedCards(game, scenario.roster);
  const trace: TraceEntry[] = [];
  const used: Record<string, number> = {};
  const rejected: Record<string, number> = {};
  let actions = 0;
  let restores = 0;
  try {
    verifyCustody(game, expected);
    while (actions < maxActions && game.status !== 'finished') {
      let next: Game | undefined;
      for (const player of game.players) {
        for (const action of botActions(viewGame(game, player.id))) {
          const context = {
            attempt: trace.length,
            accepted: actions,
            player: player.id,
            turn: game.turn,
            phase: game.phase,
            setup: game.setupStage ?? null,
            decision: game.decision?.kind ?? null,
            response: game.response?.kind ?? null,
            action,
          };
          try {
            next = applyAction(game, player.id, action);
            const label =
              action.type +
              (action.type === 'decision'
                ? `:${game.decision?.kind ?? 'none'}`
                : '');
            used[label] = (used[label] ?? 0) + 1;
            trace.push({ ...context, outcome: 'accepted' });
            actions++;
            break;
          } catch (error) {
            if (!(error instanceof RuleError)) throw error;
            const message = error.message;
            const label = `${action.type}: ${message}`;
            rejected[label] = (rejected[label] ?? 0) + 1;
            trace.push({ ...context, outcome: 'rejected', error: message });
          }
        }
        if (next) break;
      }
      if (!next)
        throw new Error(
          `No legal candidate: ${JSON.stringify({
            status: game.status,
            setup: game.setupStage,
            phase: game.phase,
            decision: game.decision?.kind,
            response: game.response?.kind,
            preparation: game.battle?.preparation,
          })}`,
        );
      game = next;
      verifyCustody(game, expected);
      if (actions % 37 === 0) {
        const restored = JSON.parse(JSON.stringify(game)) as Game;
        for (const player of game.players)
          assert.deepEqual(
            viewGame(restored, player.id),
            viewGame(game, player.id),
            'restored view',
          );
        game = restored;
        restores++;
      }
    }
    if (game.status !== 'finished') throw new Error('Action limit');
    return {
      game,
      trace,
      result: {
        name: scenarioName(scenario),
        profile: scenario.profile,
        rules: scenario.rules,
        advanced: scenario.rules === 'advanced',
        seed,
        resumed,
        actions,
        attempts: trace.length,
        restores,
        turn: game.turn,
        phase: game.phase,
        winner: game.winner,
        used,
        rejected,
        outcome: 'complete',
      } satisfies Result,
    };
  } catch (error) {
    return {
      game,
      trace,
      result: {
        name: scenarioName(scenario),
        profile: scenario.profile,
        rules: scenario.rules,
        advanced: scenario.rules === 'advanced',
        seed,
        resumed,
        actions,
        attempts: trace.length,
        restores,
        turn: game.turn,
        phase: game.phase,
        winner: game.winner,
        used,
        rejected,
        outcome: 'failure',
        error: String(error),
      } satisfies Result,
    };
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      out: { type: 'string' },
      seed: { type: 'string' },
      profile: { type: 'string' },
      rules: { type: 'string' },
      'max-actions': { type: 'string' },
      resume: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: true,
  });
  if (values.help) {
    console.log(usage());
    return;
  }
  if (positionals.length)
    throw new Error(`Unexpected argument: ${positionals[0]}`);
  if (!values.out) throw new Error('--out is required.\n' + usage());
  if (values.resume && (supplied('profile') || supplied('rules')))
    throw new Error('--resume cannot be combined with --profile or --rules.');
  const seed = unsigned32(values.seed);
  const maxActions = positive(values['max-actions']);
  const profile = parseProfile(values.profile);
  const rules = parseRules(values.rules);
  const resume = values.resume ? resumedGame(values.resume) : null;
  const selected = resume
    ? [resume.scenario]
    : SCENARIOS.filter(
        (scenario) =>
          (profile === 'all' || scenario.profile === profile) &&
          (rules === 'both' || scenario.rules === rules),
      );
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const directory = privateOutputDirectory(root, values.out);
  const before = sourceSnapshot(root);
  const originalRandom = Object.getOwnPropertyDescriptor(
    globalThis.crypto,
    'getRandomValues',
  );
  let randomState = seed;
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    configurable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (!(array instanceof Uint32Array))
        throw new Error(
          'Faction game simulation expects Uint32Array randomness.',
        );
      for (let index = 0; index < array.length; index++) {
        randomState = (randomState + 0x6d2b79f5) >>> 0;
        let word = Math.imul(
          randomState ^ (randomState >>> 15),
          randomState | 1,
        );
        word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
        array[index] = (word ^ (word >>> 14)) >>> 0;
      }
      return array;
    },
  });

  const results: Result[] = [];
  try {
    for (const scenario of selected) {
      const scenarioSeed = (seed + scenario.ordinal) >>> 0;
      randomState = scenarioSeed;
      const outcome = simulate(
        resume ? structuredClone(resume.game) : freshGame(scenario),
        scenario,
        scenarioSeed,
        maxActions,
        !!resume,
      );
      privateWrite(
        directory,
        `trace-${outcome.result.name}.json`,
        outcome.trace,
      );
      if (outcome.result.outcome === 'failure')
        privateWrite(
          directory,
          `failed-${outcome.result.name}.json`,
          outcome.game,
        );
      results.push(outcome.result);
      console.log(JSON.stringify(outcome.result));
    }
  } finally {
    if (originalRandom)
      Object.defineProperty(
        globalThis.crypto,
        'getRandomValues',
        originalRandom,
      );
    else Reflect.deleteProperty(globalThis.crypto, 'getRandomValues');
  }

  const after = sourceSnapshot(root);
  const sourceUnchanged =
    before.commit === after.commit && before.tree === after.tree;
  const status = !sourceUnchanged
    ? 'source-changed'
    : results.every((result) => result.outcome === 'complete')
      ? 'passed'
      : 'failed';
  privateWrite(directory, 'results.json', { format: 1, results });
  privateWrite(directory, 'report.json', {
    format: 1,
    before,
    after,
    sourceUnchanged,
    status,
    setup: resume
      ? 'Resume supplied private snapshot; its setup provenance must be checked against the original report. Saved AI profiles choose every continuation action.'
      : 'Genuine faction-only setup; no cards, forces, factions, phases or statistics staged. Real saved AI profiles choose every setup and gameplay action.',
    randomness: resume
      ? 'Continuation restarts the random stream at seed plus scenario ordinal; it does not reconstruct the pre-snapshot random stream.'
      : 'Each scenario starts its random stream at seed plus scenario ordinal.',
    options: {
      seed,
      profile: resume ? resume.scenario.profile : profile,
      rules: resume ? resume.scenario.rules : rules,
      maxActions,
      ...(resume ? { resume: { path: resume.path, sha256: resume.hash } } : {}),
    },
    results: results.map(
      ({ used: _used, rejected: _rejected, ...result }) => result,
    ),
  });
  console.log(
    JSON.stringify({ status, report: resolve(directory, 'report.json') }),
  );
  if (status !== 'passed') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
