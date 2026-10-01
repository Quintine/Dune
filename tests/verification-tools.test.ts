import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  statSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  privateOutputDirectory,
  runVerification,
  sourceSnapshot,
} from '../tools/verification';

void test('focused wrapper cannot turn a filename into a list-only or test-skipping option', (t) => {
  const { root, area } = fixture(t),
    out = join(area, 'run');
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      new URL('../tools/verify.ts', import.meta.url).pathname,
      '--out',
      out,
      'focused',
      '--focus=--list',
    ],
    { cwd: root, encoding: 'utf8', timeout: 15000 },
  );
  assert.equal(result.status, 1);
  assert.equal(existsSync(out), false);
});

void test('focused verification executes only matching names and cannot certify an empty selection', (t) => {
  const { root, area } = fixture(t);
  mkdirSync(join(root, 'tools'));
  mkdirSync(join(root, 'tests'));
  for (const tool of [
    'verify.ts',
    'verification.ts',
    'test.ts',
    'test-discovery.ts',
    'test-reporter.ts',
  ])
    cpSync(new URL(`../tools/${tool}`, import.meta.url), join(root, 'tools', tool));
  symlinkSync(
    fileURLToPath(new URL('../node_modules', import.meta.url)),
    join(root, 'node_modules'),
    'dir',
  );
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      type: 'module',
      scripts: { test: 'node --import tsx tools/test.ts' },
    }),
  );
  writeFileSync(
    join(root, 'tests/rules.test.mjs'),
    `import test from 'node:test';
    test('chosen case', () => console.log('selected case executed'));
    test('excluded case', () => { throw new Error('excluded failure'); });\n`,
  );
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const [name, status] of [
    ['chosen case', 'passed'],
    ['no matching case', 'failed'],
  ]) {
    const out = join(area, status);
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        'tools/verify.ts',
        '--out',
        out,
        'focused',
        '--focus',
        'rules',
        '--name',
        name,
      ],
      { cwd: root, env, encoding: 'utf8', timeout: 15_000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, status === 'passed' ? 0 : 1);
    const report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
    assert.equal(report.status, status);
    const log = readFileSync(join(out, 'focused.log'), 'utf8');
    if (status === 'passed') assert.match(log, /selected case executed/);
    else assert.doesNotMatch(log, /selected case executed/);
    assert.doesNotMatch(log, /excluded failure/);
  }
});

function fixture(t: test.TestContext) {
  const area = mkdtempSync(join(tmpdir(), 'dune-verification-'));
  t.after(() => rmSync(area, { recursive: true, force: true }));
  const root = join(area, 'repo');
  mkdirSync(root);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '-q');
  writeFileSync(join(root, '.gitignore'), 'private.txt\n');
  writeFileSync(join(root, 'source.txt'), 'original');
  git('add', '.');
  git(
    '-c',
    'user.name=Verification',
    '-c',
    'user.email=verification@example.invalid',
    'commit',
    '-qm',
    'fixture',
  );
  return { area, root };
}

void test('interrupted checks fail even when a child handles the signal with exit zero', (t) => {
  const { root, area } = fixture(t);
  for (const [signal, exitCode] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const) {
    const out = join(area, signal),
      script = join(area, `${signal}.mts`);
    const steps = [
      {
        name: 'interrupted',
        command: process.execPath,
        args: [
          '-e',
          `process.on('${signal}',()=>process.exit(0));process.kill(process.ppid,'${signal}');setInterval(()=>{},1000);`,
        ],
      },
      { name: 'must-not-run', command: process.execPath, args: ['-e', ''] },
    ];
    writeFileSync(
      script,
      `import { runVerification } from ${JSON.stringify(new URL('../tools/verification.ts', import.meta.url).href)};\nawait runVerification(${JSON.stringify(root)}, ${JSON.stringify(out)}, ${JSON.stringify(steps)});\n`,
    );
    execFileSync(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), script],
      { cwd: root, stdio: 'pipe', timeout: 15000 },
    );
    const report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
    assert.equal(report.status, 'failed');
    assert.equal(report.steps.length, 1);
    assert.equal(report.steps[0].exitCode, exitCode);
  }
});

void test('fingerprints include untracked source and ignore private local material', (t) => {
  const { root } = fixture(t),
    before = sourceSnapshot(root);
  writeFileSync(join(root, 'private.txt'), 'never include this');
  assert.deepEqual(sourceSnapshot(root), before);
  writeFileSync(join(root, 'new.ts'), 'new source');
  assert.notEqual(sourceSnapshot(root).tree, before.tree);
  rmSync(join(root, 'new.ts'));
  rmSync(join(root, 'source.txt'));
  assert.notEqual(sourceSnapshot(root).tree, before.tree);
});

void test('verification preserves real child failures, stops later work and stores private logs', async (t) => {
  const { root, area } = fixture(t),
    out = join(area, 'run');
  const result = await runVerification(root, out, [
    {
      name: 'first',
      command: process.execPath,
      args: ['-e', 'console.log("first complete")'],
    },
    {
      name: 'failure',
      command: process.execPath,
      args: ['-e', 'console.error("failure detail");process.exit(7)'],
    },
    {
      name: 'must-not-run',
      command: process.execPath,
      args: ['-e', 'process.exit(0)'],
    },
  ]);
  assert.equal(result.status, 'failed');
  assert.deepEqual(
    result.steps.map((s) => s.exitCode),
    [0, 7],
  );
  assert.match(
    readFileSync(join(out, 'failure.log'), 'utf8'),
    /failure detail/,
  );
  assert.equal(
    JSON.parse(readFileSync(join(out, 'report.json'), 'utf8')).status,
    'failed',
  );
  assert.equal(statSync(out).mode & 0o777, 0o700);
  assert.equal(statSync(join(out, 'report.json')).mode & 0o777, 0o600);
  await assert.rejects(
    runVerification(root, out, [
      { name: 'repeat', command: process.execPath, args: ['-e', ''] },
    ]),
  );
  assert.match(
    readFileSync(join(out, 'failure.log'), 'utf8'),
    /failure detail/,
  );
});

void test('green processes cannot certify source changed during verification', async (t) => {
  const { root, area } = fixture(t);
  const result = await runVerification(root, join(area, 'run'), [
    {
      name: 'edit',
      command: process.execPath,
      args: ['-e', 'require("node:fs").writeFileSync("source.txt", "changed")'],
    },
  ]);
  assert.equal(result.steps[0].exitCode, 0);
  assert.equal(result.status, 'source-changed');
  assert.notEqual(result.before.tree, result.after?.tree);
});

void test('unchanged successful checks pass and missing executables fail', async (t) => {
  const { root, area } = fixture(t);
  assert.equal(
    (
      await runVerification(root, join(area, 'good'), [
        { name: 'ok', command: process.execPath, args: ['-e', ''] },
      ])
    ).status,
    'passed',
  );
  assert.equal(
    (
      await runVerification(root, join(area, 'bad'), [
        { name: 'missing', command: join(area, 'missing-command'), args: [] },
      ])
    ).status,
    'failed',
  );
});

void test('output refuses checkout paths, symlink redirects and existing results', (t) => {
  const { root, area } = fixture(t);
  assert.throws(
    () => privateOutputDirectory(root, join(root, 'results')),
    /outside/,
  );
  symlinkSync(root, join(area, 'redirect'), 'dir');
  assert.throws(
    () => privateOutputDirectory(root, join(area, 'redirect/results')),
    /outside/,
  );
  const out = join(area, 'out');
  privateOutputDirectory(root, out);
  writeFileSync(join(out, 'sentinel'), 'keep');
  assert.throws(() => privateOutputDirectory(root, out));
  assert.equal(readFileSync(join(out, 'sentinel'), 'utf8'), 'keep');
});
