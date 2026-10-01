import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyTest,
  discoverTests,
  selectTests,
} from '../tools/test-discovery';

void test('discovery includes new and nested tests, excluding fixture helpers', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dune-discovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tests/nested'), { recursive: true });
  writeFileSync(join(root, 'tests/rules.test.ts'), '');
  writeFileSync(join(root, 'tests/fixture.ts'), '');
  writeFileSync(
    join(root, 'tests/nested/restart.test.ts'),
    "import { DatabaseSync } from 'node:sqlite';",
  );
  writeFileSync(
    join(root, 'tests/http.test.ts'),
    '// @dune-suite integration\n',
  );
  const files = discoverTests(root);
  assert.equal(files.length, 3);
  assert.deepEqual(
    selectTests(files, 'offline')
      .map((f) => f.kind)
      .sort(),
    ['recovery', 'unit'],
  );
  assert.deepEqual(
    selectTests(files, 'integration').map((f) => f.path),
    ['tests/http.test.ts'],
  );
  assert.equal(selectTests(files, 'multiplayer').length, 2);
  assert.equal(selectTests(files, 'recovery').length, 1);
  assert.equal(selectTests(files, 'unit').length, 1);
  assert.equal(selectTests(files, 'all').length, 3);
});

void test('HTTP annotation takes precedence over in-memory SQLite imports', () => {
  assert.equal(
    classifyTest(
      "// @dune-suite integration\nimport { DatabaseSync } from 'node:sqlite';",
    ),
    'integration',
  );
  assert.equal(classifyTest('// Uses node:sqlite in a mocked example'), 'unit');
});

void test('an unmarked HTTP test cannot silently enter the offline suite', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dune-http-discovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tests'));
  // Assemble the fixture expression so this offline regression isn't an HTTP test.
  writeFileSync(
    join(root, 'tests/http.test.ts'),
    ['process', 'env', 'DUNE_TEST_URL'].join('.'),
  );
  assert.throws(() => discoverTests(root), /HTTP tests need/);
});

void test('each filename filter must match within its suite, including combined filters', () => {
  const files = [{ path: 'tests/rules.test.ts', kind: 'unit' as const }];
  assert.equal(selectTests(files, 'offline', ['rules']).length, 1);
  assert.throws(() => selectTests(files, 'offline', ['']));
  assert.throws(
    () => selectTests(files, 'offline', ['rules', 'typo']),
    /No offline test files match/,
  );
  assert.throws(
    () => selectTests(files, 'integration', ['rules']),
    /No integration test files match/,
  );
  assert.throws(() => selectTests([], 'all'), /No test files/);
});

function runnerFixture(t: test.TestContext, sources: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'dune-test-runner-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tools'));
  mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
  for (const tool of ['test.ts', 'test-discovery.ts', 'test-reporter.ts'])
    cpSync(new URL(`../tools/${tool}`, import.meta.url), join(root, 'tools', tool));
  symlinkSync(
    fileURLToPath(new URL('../node_modules', import.meta.url)),
    join(root, 'node_modules'),
    'dir',
  );
  for (const [file, source] of Object.entries(sources))
    writeFileSync(join(root, 'tests', file), source);
  // A nested runner must not inherit the parent test worker's IPC context.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const args = ['--import', import.meta.resolve('tsx'), 'tools/test.ts'];
  return {
    root,
    env,
    args,
    run: (...options: string[]) =>
      spawnSync(process.execPath, [...args, ...options], {
        cwd: root,
        env,
        timeout: 15_000,
        encoding: 'utf8',
      }),
  };
}

void test('concise CLI preserves nested assertion details, output and failure exit', (t) => {
  const fixture = runnerFixture(t, {
    'failure.test.mjs': `
      import { test, describe } from 'node:test';
      import assert from 'node:assert/strict';
      describe('parent suite', () => {
        test('passing sentinel', () => {});
        test('failure sentinel', t => {
          console.log('stdout sentinel');
          console.error('stderr sentinel');
          t.diagnostic('diagnostic sentinel');
          assert.deepEqual({ payment: 7 }, { payment: 11 });
        });
      });
    `,
  });
  for (const options of [[], ['--verbose']]) {
    const result = fixture.run(...options);
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    const output = result.stdout + result.stderr;
    assert.match(output, /failure sentinel/);
    assert.match(output, /failure\.test\.mjs:\d+:\d+/);
    assert.match(output, /payment: 7/);
    assert.match(output, /payment: 11/);
    for (const channel of ['stdout', 'stderr', 'diagnostic'])
      assert.match(output, new RegExp(`${channel} sentinel`));
    if (options.length) assert.match(output, /passing sentinel/);
    else assert.doesNotMatch(output, /passing sentinel/);
  }
});

void test('CLI applies union filename selection and name intersection without green empty runs', (t) => {
  const fixture = runnerFixture(t, {
    'empty.test.mjs': '',
    'skipped.test.mjs': `
      import test from 'node:test';
      test('pending case', { skip: true }, () => {});
    `,
    'alpha.test.mjs': `
      import test from 'node:test';
      test('chosen alpha', () => {});
      test('excluded failure', () => { throw new Error('must not execute'); });
    `,
    'beta.test.mjs': `
      import test from 'node:test';
      test('chosen beta', () => {});
    `,
    'other.test.mjs': `
      import test from 'node:test';
      test('chosen outside selection', () => { throw new Error('must not execute'); });
    `,
  });
  const result = fixture.run('alpha', 'beta', '--name', '^chosen', '--verbose');
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /chosen alpha/);
  assert.match(result.stdout, /chosen beta/);
  assert.doesNotMatch(result.stdout + result.stderr, /must not execute/);
  const listed = fixture.run('alpha', 'beta', '--list');
  assert.equal(listed.status, 0);
  assert.match(listed.stdout, /tests\/alpha\.test\.mjs/);
  assert.match(listed.stdout, /tests\/beta\.test\.mjs/);
  assert.doesNotMatch(listed.stdout, /tests\/other\.test\.mjs/);
  for (const options of [
    ['empty'],
    ['skipped'],
    ['alpha', '--name', '^no matching tests$'],
    ['alpha', '--name', '^no matching tests$', '--verbose'],
    ['alpha', '--name', '['],
    ['alpha', '--name', ''],
    ['', '--name', '^chosen'],
    ['alpha', 'missing'],
    ['--suite', 'unknown'],
  ]) {
    const invalid = fixture.run(...options);
    assert.ifError(invalid.error);
    assert.equal(invalid.status, 1, JSON.stringify(options));
  }
});

void test('CLI cancellation remains failure when its test driver handles the signal with exit zero', { timeout: 30_000 }, async (t) => {
  for (const [signal, expected] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const) {
    const fixture = runnerFixture(t, {
      'waiting.test.mjs': `
        import test from 'node:test';
        test('waiting', () => {});
      `,
    });
    // A real Node test driver whose reporter gracefully handles cancellation.
    writeFileSync(
      join(fixture.root, 'tools/test-reporter.ts'),
      `import { MessageChannel } from 'node:worker_threads';
      export default async function* reporter(source) {
        // Keep the driver alive until the real OS signal, without timer guesses.
        const { port1, port2 } = new MessageChannel();
        port1.on('message', () => {});
        process.on('${signal}', () => {
          port1.close();
          port2.close();
          process.exit(0);
        });
        console.log('cancellation-ready');
        for await (const event of source) yield '';
        await Promise.withResolvers().promise;
      }\n`,
    );
    const child = spawn(process.execPath, fixture.args, {
      cwd: fixture.root,
      env: fixture.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => child.kill('SIGKILL'));
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes('cancellation-ready')) {
        output = '';
        child.kill(signal);
      }
    });
    const { promise, resolve, reject } = Promise.withResolvers<number | null>();
    child.once('error', reject);
    child.once('close', resolve);
    assert.equal(await promise, expected);
  }
});
