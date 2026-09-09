import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
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

void test('the TypeScript test subprocess returns failure for a failing assertion', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'dune-test-failure-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'failure.test.mts');
  writeFileSync(
    file,
    "import test from 'node:test';\ntest('failure sentinel', () => { throw new Error('expected failure'); });\n",
  );
  // A nested runner must not inherit the parent test worker's IPC context.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--test', file],
    {
      cwd: new URL('../', import.meta.url),
      env,
      timeout: 15_000,
      encoding: 'utf8',
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /expected failure/);
});
