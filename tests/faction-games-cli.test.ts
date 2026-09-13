import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const cli = new URL('../tools/faction-games.ts', import.meta.url).pathname;
type CliResult = {
  name: string;
  seed: number;
  resumed: boolean;
  outcome: string;
  error?: string;
  actions: number;
  attempts: number;
};
type CliReport = {
  status: string;
  sourceUnchanged: boolean;
  before: { commit: string; tree: string };
  after: { commit: string; tree: string };
  options: {
    seed: number;
    profile: string;
    rules: string;
    maxActions: number;
    players: number | 'all';
    resume?: { path: string; sha256: string };
  };
  results: CliResult[];
};

function run(out: string, ...args: string[]) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), cli, '--out', out, ...args],
    { cwd: root, env, encoding: 'utf8', timeout: 30_000 },
  );
  assert.ifError(result.error);
  return result;
}

function temporary(t: test.TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'dune-faction-games-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function json<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function assertFailedEvidence(
  out: string,
  name: string,
  expectedSeed: number,
  resumed: boolean,
) {
  const report = json<CliReport>(join(out, 'report.json'));
  const results = json<{ results: CliResult[] }>(join(out, 'results.json'));
  assert.equal(report.status, 'failed');
  assert.equal(report.sourceUnchanged, true);
  assert.equal(report.before.commit, report.after.commit);
  assert.equal(report.before.tree, report.after.tree);
  assert.match(report.before.commit, /\S/);
  assert.match(report.before.tree, /^[a-f\d]{64}$/);
  assert.equal(report.results.length, 1);
  assert.equal(results.results.length, 1);
  for (const result of [report.results[0], results.results[0]]) {
    assert.equal(result.name, name);
    assert.equal(result.seed, expectedSeed);
    assert.equal(result.resumed, resumed);
    assert.equal(result.outcome, 'failure');
    assert.match(result.error ?? '', /Action limit/);
    assert.ok(result.actions > 0);
    assert.ok(result.attempts > 0);
  }
  const trace = json<unknown[]>(join(out, `trace-${name}.json`));
  assert.ok(Array.isArray(trace) && trace.length > 0);
  assert.ok(existsSync(join(out, `failed-${name}.json`)));
  for (const file of readdirSync(out))
    assert.equal(statSync(join(out, file)).mode & 0o777, 0o600);
  return report;
}

void test('selected genuine three-player Advanced base sample fails honestly, resumes its fixed snapshot and keeps source-bound private evidence', (t) => {
  const area = temporary(t);
  const first = join(area, 'first');
  const initial = run(
    first,
    '--profile',
    'base',
    '--players',
    '3',
    '--rules',
    'advanced',
    '--seed',
    '1000',
    '--max-actions',
    '1',
  );
  assert.equal(initial.status, 1);
  const firstReport = assertFailedEvidence(
    first,
    'base-3-advanced',
    1009,
    false,
  );
  assert.deepEqual(firstReport.options, {
    seed: 1000,
    profile: 'base',
    rules: 'advanced',
    maxActions: 1,
    players: 3,
  });

  const snapshot = join(first, 'failed-base-3-advanced.json');
  for (const field of [
    'ecazTreachery',
    'mentatQuestionPreview',
    'moritaniAssassinatePreview',
    'moritaniAssassinate',
    'moritaniAssassinateResume',
    'moritaniAssassinateCallEvents',
  ]) {
    const optionalSnapshot = join(area, `optional-${field}.json`);
    const optional = json<Record<string, unknown>>(snapshot);
    optional[field] = true;
    writeFileSync(optionalSnapshot, JSON.stringify(optional), { mode: 0o600 });
    const optionalOut = join(area, `optional-${field}-resume`);
    const optionalResult = run(
      optionalOut,
      '--resume',
      optionalSnapshot,
      '--max-actions',
      '1',
    );
    assert.equal(optionalResult.status, 1);
    assert.match(
      optionalResult.stderr,
      /--resume sample scenarios exclude optional modules\./,
    );
    assert.equal(existsSync(optionalOut), false);
  }

  const resumedOut = join(area, 'resumed');
  const resumed = run(
    resumedOut,
    '--resume',
    snapshot,
    '--seed',
    '1000',
    '--max-actions',
    '1',
  );
  assert.equal(resumed.status, 1);
  const resumedReport = assertFailedEvidence(
    resumedOut,
    'base-3-advanced',
    1009,
    true,
  );
  assert.equal(resumedReport.options.profile, 'base');
  assert.equal(resumedReport.options.rules, 'advanced');
  assert.equal(resumedReport.options.players, 3);
  assert.ok(resumedReport.options.resume);
  assert.equal(resumedReport.options.resume.path, snapshot);
  assert.match(resumedReport.options.resume.sha256, /^[a-f\d]{64}$/);

  const custodyOut = join(area, 'custody-source');
  const custodyRun = run(
    custodyOut,
    '--profile',
    'base',
    '--players',
    '3',
    '--rules',
    'advanced',
    '--max-actions',
    '20',
  );
  assert.equal(custodyRun.status, 1);
  const corruptPath = join(area, 'paired-missing-leader-and-traitor.json');
  const corrupt = json<{
    status: string;
    players: { leaders: { id: string }[]; traitors: string[] }[];
    traitorReserve?: string[];
  }>(join(custodyOut, 'failed-base-3-advanced.json'));
  assert.equal(corrupt.status, 'playing');
  const dealt = new Set([
    ...(corrupt.traitorReserve ?? []),
    ...corrupt.players.flatMap((player) => player.traitors),
  ]);
  const owner = corrupt.players.find((player) =>
    player.leaders.some((leader) => dealt.has(leader.id)),
  );
  assert.ok(owner, 'fixture has a leader represented in the Traitor inventory');
  const missing = owner.leaders.find((leader) => dealt.has(leader.id))!.id;
  owner.leaders = owner.leaders.filter((leader) => leader.id !== missing);
  let removed = false;
  corrupt.traitorReserve = corrupt.traitorReserve?.filter((id) => {
    if (id !== missing) return true;
    removed = true;
    return false;
  });
  for (const player of corrupt.players)
    player.traitors = player.traitors.filter((id) => {
      if (id !== missing) return true;
      removed = true;
      return false;
    });
  assert.equal(removed, true, 'fixture leader has one physical Traitor card');
  writeFileSync(corruptPath, JSON.stringify(corrupt), { mode: 0o600 });
  const corruptOut = join(area, 'corrupt-resume');
  const corrupted = run(
    corruptOut,
    '--resume',
    corruptPath,
    '--max-actions',
    '1',
  );
  assert.equal(corrupted.status, 1);
  const corruptResult = json<{ results: CliResult[] }>(
    join(corruptOut, 'results.json'),
  ).results[0];
  assert.equal(corruptResult.actions, 0);
  assert.match(corruptResult.error ?? '', /physical base traitor custody/);

  for (const [label, args] of [
    ['profile', ['--profile', 'base']],
    ['rules', ['--rules', 'advanced']],
    ['players', ['--players', '3']],
  ] as const) {
    const out = join(area, `invalid-resume-${label}`);
    const invalid = run(out, '--resume', snapshot, ...args);
    assert.equal(invalid.status, 1);
    assert.match(
      invalid.stderr,
      /--resume cannot be combined with --profile, --rules or --players/,
    );
    assert.equal(existsSync(out), false);
  }
});

void test('default expansion samples retain their six names and seed ordinals while base defaults cover every two-to-six-player roster', (t) => {
  const area = temporary(t);
  const expansionOut = join(area, 'expansion-default');
  const expansion = run(expansionOut, '--seed', '2000', '--max-actions', '1');
  assert.equal(expansion.status, 1);
  const expansionResults = json<{ results: CliResult[] }>(
    join(expansionOut, 'results.json'),
  ).results;
  assert.deepEqual(
    expansionResults.map((result) => [result.name, result.seed]),
    [
      ['choam-basic', 2000],
      ['choam-advanced', 2001],
      ['ecaz-basic', 2002],
      ['ecaz-advanced', 2003],
      ['combined-basic', 2004],
      ['combined-advanced', 2005],
    ],
  );
  for (const result of expansionResults) {
    assert.equal(result.actions, 1, `${result.name} reached the action limit`);
    assert.match(result.error ?? '', /Action limit/, result.name);
  }

  const baseOut = join(area, 'base-default');
  const base = run(
    baseOut,
    '--profile',
    'base',
    '--seed',
    '2000',
    '--max-actions',
    '1',
  );
  assert.equal(base.status, 1);
  const baseReport = json<CliReport>(join(baseOut, 'report.json'));
  assert.equal(baseReport.options.players, 'all');
  assert.deepEqual(
    json<{ results: CliResult[] }>(join(baseOut, 'results.json')).results.map(
      (result) => [result.name, result.seed],
    ),
    [
      ['base-2-basic', 2006],
      ['base-2-advanced', 2007],
      ['base-3-basic', 2008],
      ['base-3-advanced', 2009],
      ['base-4-basic', 2010],
      ['base-4-advanced', 2011],
      ['base-5-basic', 2012],
      ['base-5-advanced', 2013],
      ['base-6-basic', 2014],
      ['base-6-advanced', 2015],
    ],
  );
});

void test('invalid player filters fail before creating a private output directory', (t) => {
  const area = temporary(t);
  for (const [label, args, message] of [
    ['without-base', ['--players', '3'], /--players requires --profile base/],
    [
      'expansion-profile',
      ['--profile', 'choam', '--players', '3'],
      /--players requires --profile base/,
    ],
    [
      'invalid-count',
      ['--profile', 'base', '--players', '7'],
      /--players must be all or 2 through 6/,
    ],
  ] as const) {
    const out = join(area, label);
    const result = run(out, ...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.equal(existsSync(out), false);
  }
});
