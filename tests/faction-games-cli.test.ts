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

import type { Game } from '../game/engine';
import { isAuditorLeader, treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { STRONGHOLD_CARDS } from '../game/stronghold-cards';
import { sampleInventory, verifySampleCustody } from '../tools/sample-custody';
import { createTechTokens } from '../game/tech-tokens';
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

void test('native Stronghold samples admit every two-to-six-seat roster and preserve canonical physical inventories', (t) => {
  const area = temporary(t);
  const out = join(area, 'native');
  assert.equal(run(out, '--profile', 'stronghold-factions',
    '--players', 'all', '--seed', '1000', '--max-actions', '1').status, 1);
  const results = json<{ results: CliResult[] }>(join(out, 'results.json')).results;
  const families = [
    { native: 'ixians-choam', expansions: ['ix', 'choam'],
      roster: ['ixians', 'choam', 'emperor', 'fremen', 'harkonnen', 'beneGesserit'], counts: [2, 3, 4, 5, 6], ordinal: 151 },
    { native: 'ixians-tleilaxu', expansions: ['ix'],
      roster: ['ixians', 'tleilaxu', 'emperor', 'fremen', 'harkonnen', 'beneGesserit'], counts: [2, 3, 4, 5, 6], ordinal: 156 },
    { native: 'choam-richese', expansions: ['choam'],
      roster: ['choam', 'richese', 'emperor', 'fremen', 'harkonnen', 'beneGesserit'], counts: [2, 3, 4, 5, 6], ordinal: 161 },
    { native: 'ixians-tleilaxu-choam-richese', expansions: ['ix', 'choam'],
      roster: ['ixians', 'tleilaxu', 'choam', 'richese', 'emperor', 'fremen'], counts: [4, 5, 6], ordinal: 166 },
  ];
  const scenarios = families.flatMap(family => family.counts.map((count, index) => ({
    ...family, count, seed: 1000 + family.ordinal + index,
    name: `stronghold-factions-${family.native}-${count}-advanced`,
  })));
  assert.deepEqual(results.map(result => result.name), scenarios.map(scenario => scenario.name));
  for (const [index, result] of results.entries()) {
    const scenario = scenarios[index];
    assert.equal(result.seed, scenario.seed);
    assert.equal(result.error, 'Error: Action limit');
    assert.equal(result.actions, 1);
    const game = json<Game>(join(out, `failed-${result.name}.json`));
    assert.equal(game.advanced, true);
    assert.deepEqual(game.expansions, scenario.expansions);
    assert.deepEqual(game.players.map(player => player.faction), scenario.roster.slice(0, scenario.count));
    assert.deepEqual(game.players.map(player => player.bot),
      ['Easy', 'Medium', 'Hard', 'Brutal', 'Easy', 'Medium'].slice(0, scenario.count));
    const deck = treacheryDeck(scenario.expansions).map(card => card.id).sort();
    assert.equal(deck.length, scenario.expansions.includes('ix') ? 47 : 35);
    const cache = scenario.roster.includes('richese') ? richeseCards().map(card => card.id).sort() : [];
    const inventory = sampleInventory(game);
    assert.deepEqual(inventory.cards, [...deck, ...cache].sort());
    assert.deepEqual((game.richeseCache ?? []).map(card => card.id).sort(), cache);
    verifySampleCustody(game, inventory);
    assert.deepEqual(Object.keys(game.strongholdCards!.owners).sort(),
      STRONGHOLD_CARDS.map(card => card.id).sort());
    assert.ok(Object.values(game.strongholdCards!.owners).every(owner => owner === null));
    assert.equal(game.strongholdCards!.claimedTurn, 0);
    const choam = game.players.find(player => player.faction === 'choam');
    if (choam) assert.equal(choam.leaders.filter(isAuditorLeader).length, 1);
  }
  for (const scenario of scenarios.filter(candidate => candidate.count === 6)) {
    const snapshot = join(out, `failed-${scenario.name}.json`);
    const original = readFileSync(snapshot, 'utf8');
    const continued = join(area, `continued-${scenario.native}`);
    assert.equal(run(continued, '--resume', snapshot, '--seed', '1000',
      '--max-actions', '1').status, 1);
    const report = assertFailedEvidence(continued, scenario.name, scenario.seed, true);
    assert.equal(report.options.resume?.path, snapshot);
    verifySampleCustody(json<Game>(join(continued, `failed-${scenario.name}.json`)),
      sampleInventory(json<Game>(snapshot)), json<Game>(snapshot));
    assert.equal(readFileSync(snapshot, 'utf8'), original);
  }
});

void test('native Stronghold admission and resume reject foreign profiles and corrupted custody before gameplay', (t) => {
  const area = temporary(t);
  const basic = join(area, 'basic');
  assert.equal(run(basic, '--profile', 'stronghold-factions', '--rules', 'basic').status, 1);
  assert.equal(existsSync(basic), false);
  const out = join(area, 'native');
  assert.equal(run(out, '--profile', 'stronghold-factions', '--players', '2',
    '--max-actions', '1').status, 1);
  const source = json<Game>(join(out, 'failed-stronghold-factions-ixians-choam-2-advanced.json'));
  const corruptions: [string, (game: Game) => void][] = [
    ['basic', game => { game.advanced = false; }],
    ['wrong-deck', game => { game.expansions = ['ix']; }],
    ['foreign-faction', game => { game.players[1].faction = 'ecaz'; }],
    ['missing-module', game => { delete game.strongholdCards; }],
    ['nexus', game => { game.nexusCards = { cards: null, phase: null }; }],
    ['tech', game => { game.techTokens = createTechTokens(); }],
    ['missing-stronghold', game => { Reflect.deleteProperty(game.strongholdCards!.owners, 'arrakeen'); }],
    ['foreign-owner', game => { game.strongholdCards!.owners.arrakeen = 'foreign-seat'; }],
    ['future-custody', game => { game.strongholdCards!.claimedTurn = game.turn + 1; }],
    ['missing-treachery', game => { game.deck.pop(); }],
  ];
  for (const [label, corrupt] of corruptions) {
    const game = structuredClone(source);
    corrupt(game);
    const snapshot = join(area, `${label}.json`);
    writeFileSync(snapshot, JSON.stringify(game), { mode: 0o600 });
    const before = readFileSync(snapshot, 'utf8');
    const rejected = join(area, `${label}-resume`);
    assert.equal(run(rejected, '--resume', snapshot, '--max-actions', '1').status, 1, label);
    assert.equal(existsSync(rejected), false, label);
    assert.equal(readFileSync(snapshot, 'utf8'), before, label);
  }
});

void test('Ecaz card samples keep all three physical identities through saved resume', (t) => {
  const area = temporary(t);
  const out = join(area, 'ecaz-cards');
  const result = run(out, '--profile', 'ecaz-treachery', '--players', '2',
    '--rules', 'advanced', '--seed', '1000', '--max-actions', '1');
  assert.equal(result.status, 1);
  assertFailedEvidence(out, 'ecaz-treachery-2-advanced', 1137, false);
  const snapshot = join(out, 'failed-ecaz-treachery-2-advanced.json');
  const game = json<{
    ecazTreachery: boolean;
    deck: { id: string }[];
    discard: { id: string }[];
    players: { hand: { id: string }[] }[];
  }>(snapshot);
  assert.equal(game.ecazTreachery, true);
  assert.deepEqual(
    [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
      .map(card => card.id).filter(id => id.startsWith('ecaz-')).sort(),
    ['ecaz-harass-withdraw', 'ecaz-recruits', 'ecaz-reinforcements'],
  );
  const resumed = join(area, 'resumed');
  assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(resumed, 'ecaz-treachery-2-advanced', 1137, true);
});

void test('Advanced Moritani assassination samples retain their preview and physical Traitor pool on resume', (t) => {
  const area = temporary(t);
  const out = join(area, 'assassinate');
  assert.equal(run(out, '--profile', 'moritani-assassinate', '--players', '3',
    '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(out, 'moritani-assassinate-3-advanced', 1147, false);
  const snapshot = join(out, 'failed-moritani-assassinate-3-advanced.json');
  const game = json<{ advanced: boolean; moritaniAssassinatePreview: boolean;
    moritaniAssassinate: { owner: string; opportunities: unknown[] };
    players: { id: string; faction: string }[] }>(snapshot);
  assert.equal(game.advanced, true);
  assert.equal(game.moritaniAssassinatePreview, true);
  assert.equal(game.moritaniAssassinate.owner, game.players.find(p => p.faction === 'moritani')?.id);
  const resumed = join(area, 'resumed');
  assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(resumed, 'moritani-assassinate-3-advanced', 1147, true);
  const unsupported = join(area, 'basic');
  assert.equal(run(unsupported, '--profile', 'moritani-assassinate', '--rules', 'basic').status, 1);
  assert.equal(existsSync(unsupported), false);
});

void test('Moritani Skills samples preserve their full module on saved continuation and reject Advanced before running', (t) => {
  const area = temporary(t);
  const out = join(area, 'skills');
  const result = run(out, '--profile', 'moritani-skills', '--players', '2', '--seed', '1000', '--max-actions', '1');
  assert.equal(result.status, 1);
  assertFailedEvidence(out, 'moritani-skills-2-basic', 1016, false);
  const snapshot = join(out, 'failed-moritani-skills-2-basic.json');
  const game = json<{ advanced: boolean; leaderSkills: { deck: string[]; offers: Record<string, { cards: string[] }>; assignments: { skill: string }[] } }>(snapshot);
  assert.equal(game.advanced, false);
  const physical = [...game.leaderSkills.deck, ...Object.values(game.leaderSkills.offers).flatMap(o => o.cards), ...game.leaderSkills.assignments.map(a => a.skill)];
  assert.equal(physical.length, 14); assert.equal(new Set(physical).size, 14);
  const resumed = join(area, 'skills-resumed');
  assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(resumed, 'moritani-skills-2-basic', 1016, true);
  const unsupported = join(area, 'unsupported');
  const bad = run(unsupported, '--profile', 'moritani-skills', '--rules', 'advanced');
  assert.equal(bad.status, 1);
  assert.equal(existsSync(unsupported), false);
});

void test('Tleilaxu Skills samples preserve their full module on saved continuation and reject Advanced before running', (t) => {
  const area = temporary(t);
  const out = join(area, 'skills');
  const result = run(out, '--profile', 'tleilaxu-skills', '--players', '2', '--seed', '1000', '--max-actions', '1');
  assert.equal(result.status, 1);
  assertFailedEvidence(out, 'tleilaxu-skills-2-basic', 1021, false);
  const snapshot = join(out, 'failed-tleilaxu-skills-2-basic.json');
  const game = json<{ advanced: boolean; leaderSkills: { deck: string[]; offers: Record<string, { cards: string[] }>; assignments: { skill: string }[] } }>(snapshot);
  assert.equal(game.advanced, false);
  const physical = [...game.leaderSkills.deck, ...Object.values(game.leaderSkills.offers).flatMap(o => o.cards), ...game.leaderSkills.assignments.map(a => a.skill)];
  assert.equal(physical.length, 14); assert.equal(new Set(physical).size, 14);
  const resumed = join(area, 'skills-resumed');
  assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(resumed, 'tleilaxu-skills-2-basic', 1021, true);
  const unsupported = join(area, 'unsupported');
  const bad = run(unsupported, '--profile', 'tleilaxu-skills', '--rules', 'advanced');
  assert.equal(bad.status, 1);
  assert.equal(existsSync(unsupported), false);
});

void test('Ixian Skills samples preserve their full module on saved continuation and reject Advanced before running', (t) => {
  const area = temporary(t);
  const out = join(area, 'skills');
  const result = run(out, '--profile', 'ix-skills', '--players', '2', '--seed', '1000', '--max-actions', '1');
  assert.equal(result.status, 1);
  assertFailedEvidence(out, 'ix-skills-2-basic', 1026, false);
  const snapshot = join(out, 'failed-ix-skills-2-basic.json');
  const game = json<{ advanced: boolean; leaderSkills: { deck: string[]; offers: Record<string, { cards: string[] }>; assignments: { skill: string }[] } }>(snapshot);
  assert.equal(game.advanced, false);
  const physical = [...game.leaderSkills.deck, ...Object.values(game.leaderSkills.offers).flatMap(o => o.cards), ...game.leaderSkills.assignments.map(a => a.skill)];
  assert.equal(physical.length, 14); assert.equal(new Set(physical).size, 14);
  const resumed = join(area, 'skills-resumed');
  assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(resumed, 'ix-skills-2-basic', 1026, true);
  const unsupported = join(area, 'unsupported');
  const bad = run(unsupported, '--profile', 'ix-skills', '--rules', 'advanced');
  assert.equal(bad.status, 1);
  assert.equal(existsSync(unsupported), false);
});

void test('CHOAM Skills samples preserve their full module on saved continuation and reject Advanced before running', (t) => {
  const area = temporary(t);
  const out = join(area, 'skills');
  const result = run(out, '--profile', 'choam-skills', '--players', '2', '--seed', '1000', '--max-actions', '1');
  assert.equal(result.status, 1);
  assertFailedEvidence(out, 'choam-skills-2-basic', 1031, false);
  const snapshot = join(out, 'failed-choam-skills-2-basic.json');
  const game = json<{ advanced: boolean; leaderSkills: { deck: string[]; offers: Record<string, { cards: string[] }>; assignments: { skill: string }[] } }>(snapshot);
  assert.equal(game.advanced, false);
  const physical = [...game.leaderSkills.deck, ...Object.values(game.leaderSkills.offers).flatMap(o => o.cards), ...game.leaderSkills.assignments.map(a => a.skill)];
  assert.equal(physical.length, 14); assert.equal(new Set(physical).size, 14);
  const resumed = join(area, 'skills-resumed');
  assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(resumed, 'choam-skills-2-basic', 1031, true);
  const unsupported = join(area, 'unsupported');
  const bad = run(unsupported, '--profile', 'choam-skills', '--rules', 'advanced');
  assert.equal(bad.status, 1);
  assert.equal(existsSync(unsupported), false);
});
void test('Homeworld and Nexus sample snapshots resume only their matching module and roster', (t) => {
  const area = temporary(t);
  for (const [profile, ordinal, module, other] of [
    ['homeworld', 37, 'homeworlds', 'nexusCards'],
    ['nexus', 39, 'nexusCards', 'homeworlds'],
  ] as const) {
    const out = join(area, profile);
    const name = profile === 'nexus' ? 'nexus-6-advanced' : 'homeworld-4-advanced';
    const playerFilter = ['--players', profile === 'nexus' ? '6' : '4'];
    assert.equal(run(out, '--profile', profile, '--rules', 'advanced', ...playerFilter, '--seed', '1000', '--max-actions', '1').status, 1);
    assertFailedEvidence(out, name, 1000 + ordinal, false);
    const snapshot = join(out, `failed-${name}.json`);
    const game = json<Record<string, unknown>>(snapshot);
    assert.ok(game[module], `${profile} module remains in the snapshot`);
    assert.equal(Boolean(game[other]), false);
    const resumed = join(area, `${profile}-resumed`);
    assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
    assertFailedEvidence(resumed, name, 1000 + ordinal, true);
    const unsupported = join(area, `${profile}-combined.json`);
    writeFileSync(unsupported, JSON.stringify({ ...game, [other]: game[module] }), { mode: 0o600 });
    const refused = join(area, `${profile}-refused`);
    const result = run(refused, '--resume', unsupported);
    assert.equal(result.status, 1);
    assert.equal(existsSync(refused), false);
  }
});

void test('Homeworld samples cover each two-to-six-seat roster under both rules and resume the two-seat configuration', (t) => {
  const area = temporary(t);
  const out = join(area, 'homeworld');
  assert.equal(run(out, '--profile', 'homeworld', '--seed', '1000', '--max-actions', '1').status, 1);
  assert.deepEqual(json<{ results: CliResult[] }>(join(out, 'results.json')).results.map(({ name, seed }) => [name, seed]), [
    ['homeworld-2-basic', 1048], ['homeworld-2-advanced', 1049],
    ['homeworld-3-basic', 1050], ['homeworld-3-advanced', 1051],
    ['homeworld-4-basic', 1036], ['homeworld-4-advanced', 1037],
    ['homeworld-5-basic', 1054], ['homeworld-5-advanced', 1055],
    ['homeworld-6-basic', 1056], ['homeworld-6-advanced', 1057],
  ]);
  const snapshot = join(out, 'failed-homeworld-2-advanced.json');
  const game = json<{ players: unknown[]; homeworlds: unknown }>(snapshot);
  assert.equal(game.players.length, 2);
  assert.ok(game.homeworlds);
  const resumed = join(area, 'resumed');
  assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(resumed, 'homeworld-2-advanced', 1049, true);
});

void test('combined Homeworld and Nexus snapshots keep both physical modules across saved continuation', (t) => {
  const area = temporary(t);
  const out = join(area, 'combined');
  assert.equal(run(out, '--profile', 'homeworld-nexus', '--players', '3', '--rules', 'advanced', '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(out, 'homeworld-nexus-3-advanced', 1061, false);
  const snapshot = join(out, 'failed-homeworld-nexus-3-advanced.json');
  const game = json<Record<string, unknown>>(snapshot);
  assert.equal((game.players as unknown[]).length, 3);
  assert.ok(game.homeworlds);
  assert.ok(game.nexusCards);
  const resumed = join(area, 'resumed');
  assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
  assertFailedEvidence(resumed, 'homeworld-nexus-3-advanced', 1061, true);
});

void test('combined modules reach saved Nexus draws and actual Homeworld shipment in one complete game', (t) => {
  const out = join(temporary(t), 'complete');
  const result = run(out, '--profile', 'homeworld-nexus', '--players', '5', '--rules', 'advanced', '--seed', '20260927');
  assert.equal(result.status, 0, result.stderr);
  const report = json<CliReport>(join(out, 'report.json'));
  const evidence = json<{ results: (CliResult & {
    used: Record<string, number>;
    rejected: Record<string, number>;
    restores: number;
  })[] }>(join(out, 'results.json')).results[0];
  assert.equal(report.status, 'passed');
  assert.equal(evidence.outcome, 'complete');
  assert.ok(evidence.used.nexusCardChoice > 0);
  assert.ok(evidence.used.homeworldShip > 0);
  assert.deepEqual(evidence.rejected, {});
  assert.ok(evidence.restores > 0);
});

void test('expansion-roster snapshots resume their own Advanced games rather than the fixed four-seat sample', (t) => {
  const area = temporary(t);
  for (const [profile, seed] of [['choam-roster', '20260928'], ['ecaz-roster', '20260927'], ['ix-roster', '20260927'], ['choam-nexus', '20260928'], ['ecaz-nexus', '20260927'], ['ix-nexus', '20260927']] as const) {
    const name = `${profile}-4-advanced`;
    const initial = join(area, `${profile}-initial`);
    assert.equal(run(initial, '--profile', profile, '--players', '4', '--rules', 'advanced', '--seed', seed, '--max-actions', '1').status, 1);
    const snapshot = join(initial, `failed-${name}.json`);
    const continued = join(area, `${profile}-continued`);
    const resumed = run(continued, '--resume', snapshot, '--seed', seed);
    assert.equal(resumed.status, 0, resumed.stderr);
    const report = json<CliReport>(join(continued, 'report.json'));
    const result = json<{ results: (CliResult & { restores: number; rejected: Record<string, number> })[] }>(join(continued, 'results.json')).results[0];
    assert.equal(report.status, 'passed');
    assert.equal(result.name, name);
    assert.equal(result.outcome, 'complete');
    assert.equal(result.resumed, true);
    assert.deepEqual(result.rejected, {});
    assert.ok(result.restores > 0);
  }
});

void test('six-seat Advanced Ixian/Tleilaxu game resolves Technology and Face Dancers through JSON restores', (t) => {
  const out = join(temporary(t), 'ix-complete');
  const runResult = run(out, '--profile', 'ix-roster', '--players', '6', '--rules', 'advanced', '--seed', '20260927');
  assert.equal(runResult.status, 0, runResult.stderr);
  const evidence = json<{ results: (CliResult & {
    used: Record<string, number>;
    rejected: Record<string, number>;
    restores: number;
  })[] }>(join(out, 'results.json')).results[0];
  assert.equal(evidence.name, 'ix-roster-6-advanced');
  assert.equal(evidence.outcome, 'complete');
  assert.ok(evidence.used['decision:ixTechnology'] > 0);
  assert.ok(evidence.used['decision:faceDance'] > 0);
  assert.deepEqual(evidence.rejected, {});
  assert.ok(evidence.restores > 0);
});

void test('combined-expansion Advanced sample completes with Richese Technology declines and saved continuation', (t) => {
  const out = join(temporary(t), 'combined-complete');
  const result = run(out, '--profile', 'combined', '--rules', 'advanced', '--seed', '20260927');
  assert.equal(result.status, 0, result.stderr);
  const report = json<CliReport>(join(out, 'report.json'));
  const game = json<{ results: (CliResult & {
    used: Record<string, number>;
    rejected: Record<string, number>;
    restores: number;
  })[] }>(join(out, 'results.json')).results[0];
  assert.equal(report.status, 'passed');
  assert.equal(report.sourceUnchanged, true);
  assert.equal(game.name, 'combined-advanced');
  assert.equal(game.outcome, 'complete');
  assert.ok(game.used['decision:ixRicheseTechnology'] > 0);
  assert.ok(game.used['decision:ecazAmbassador'] > 0);
  assert.ok(game.used['decision:faceDance'] > 0);
  assert.deepEqual(game.rejected, {});
  assert.ok(game.restores > 0);
});

void test('CHOAM/Richese Nexus game reaches an unallied card choice and restores across phases', (t) => {
  const out = join(temporary(t), 'choam-nexus-complete');
  const result = run(out, '--profile', 'choam-nexus', '--players', '3', '--rules', 'advanced', '--seed', '20260927');
  assert.equal(result.status, 0, result.stderr);
  const report = json<CliReport>(join(out, 'report.json'));
  const game = json<{ results: (CliResult & {
    used: Record<string, number>;
    rejected: Record<string, number>;
    restores: number;
  })[] }>(join(out, 'results.json')).results[0];
  assert.equal(report.status, 'passed');
  assert.equal(report.sourceUnchanged, true);
  assert.equal(game.name, 'choam-nexus-3-advanced');
  assert.equal(game.outcome, 'complete');
  assert.ok(game.used.nexusCardChoice > 0);
  assert.deepEqual(game.rejected, {});
  assert.ok(game.restores > 0);
});

void test('Ecaz/Moritani Nexus game draws cards and resolves Ambassador battles through JSON restores', (t) => {
  const out = join(temporary(t), 'ecaz-nexus-complete');
  const result = run(out, '--profile', 'ecaz-nexus', '--players', '3', '--rules', 'basic', '--seed', '20260927');
  assert.equal(result.status, 0, result.stderr);
  const report = json<CliReport>(join(out, 'report.json'));
  const game = json<{ results: (CliResult & {
    used: Record<string, number>;
    rejected: Record<string, number>;
    restores: number;
  })[] }>(join(out, 'results.json')).results[0];
  assert.equal(report.status, 'passed');
  assert.equal(report.sourceUnchanged, true);
  assert.equal(game.name, 'ecaz-nexus-3-basic');
  assert.equal(game.outcome, 'complete');
  assert.ok(game.used.nexusCardChoice > 0);
  assert.ok(game.used['decision:ecazAmbassador'] > 0);
  assert.deepEqual(game.rejected, {});
  assert.ok(game.restores > 0);
});

void test('Ixian/Tleilaxu Nexus games reach unallied card choices, Technology and Face Dancers across saves', (t) => {
  const area = temporary(t);
  for (const rules of ['basic', 'advanced'] as const) {
    const out = join(area, rules);
    const result = run(out, '--profile', 'ix-nexus', '--players', '3', '--rules', rules, '--seed', '20260927');
    assert.equal(result.status, 0, result.stderr);
    const report = json<CliReport>(join(out, 'report.json'));
    const game = json<{ results: (CliResult & {
      used: Record<string, number>;
      rejected: Record<string, number>;
      restores: number;
    })[] }>(join(out, 'results.json')).results[0];
    assert.equal(report.status, 'passed');
    assert.equal(report.sourceUnchanged, true);
    assert.equal(game.name, `ix-nexus-3-${rules}`);
    assert.equal(game.outcome, 'complete');
    assert.ok(game.used.nexusCardChoice > 0);
    assert.ok(game.used['decision:ixAuction'] > 0);
    assert.ok(game.used[rules === 'advanced' ? 'decision:ixTechnology' : 'decision:faceDance'] > 0);
    assert.deepEqual(game.rejected, {});
    assert.ok(game.restores > 0);
  }
});

void test('three-seat Nexus samples preserve their module and roster across saved continuation', (t) => {
  const area = temporary(t);
  for (const [rules, ordinal] of [['basic', 42], ['advanced', 43]] as const) {
    const out = join(area, rules);
    const initial = run(out, '--profile', 'nexus', '--players', '3', '--rules', rules, '--seed', '1000', '--max-actions', '1');
    assert.equal(initial.status, 1);
    assertFailedEvidence(out, `nexus-3-${rules}`, 1000 + ordinal, false);
    const snapshot = join(out, `failed-nexus-3-${rules}.json`);
    const game = json<{ players: unknown[]; nexusCards: unknown }>(snapshot);
    assert.equal(game.players.length, 3);
    assert.ok(game.nexusCards);
    const resumed = join(area, `${rules}-resumed`);
    assert.equal(run(resumed, '--resume', snapshot, '--seed', '1000', '--max-actions', '1').status, 1);
    assertFailedEvidence(resumed, `nexus-3-${rules}`, 1000 + ordinal, true);
  }
});

void test('a genuine three-seat Advanced Nexus game reaches unallied card choice and completes without illegal bot actions', (t) => {
  const out = join(temporary(t), 'card-draw');
  const result = run(out, '--profile', 'nexus', '--players', '3', '--rules', 'advanced', '--seed', '20260927');
  assert.equal(result.status, 0, result.stderr);
  const report = json<CliReport>(join(out, 'report.json'));
  const evidence = json<{ results: (CliResult & {
    used: Record<string, number>;
    rejected: Record<string, number>;
    restores: number;
  })[] }>(join(out, 'results.json')).results[0];
  assert.equal(report.status, 'passed');
  assert.equal(evidence.outcome, 'complete');
  assert.ok(evidence.used.nexusCardChoice > 0);
  assert.deepEqual(evidence.rejected, {});
  assert.ok(evidence.restores > 0);
});

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

  for (const [label, args] of [
    ['profile', ['--profile', 'base']],
    ['rules', ['--rules', 'advanced']],
    ['players', ['--players', '3']],
  ] as const) {
    const out = join(area, `invalid-resume-${label}`);
    const invalid = run(out, '--resume', snapshot, ...args);
    assert.equal(invalid.status, 1);
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
  for (const [label, args] of [
    ['without-base', ['--players', '3']],
    ['expansion-profile', ['--profile', 'choam', '--players', '3']],
    ['invalid-count', ['--profile', 'base', '--players', '7']],
  ] as const) {
    const out = join(area, label);
    const result = run(out, ...args);
    assert.equal(result.status, 1);
    assert.equal(existsSync(out), false);
  }
});
