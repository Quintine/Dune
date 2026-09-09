import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type TestKind = 'unit' | 'recovery' | 'integration';
export type TestSuite = TestKind | 'offline' | 'multiplayer' | 'all';
export type TestFile = { path: string; kind: TestKind };

// HTTP tests opt in explicitly. SQLite recovery tests use disposable memory DBs.
export function classifyTest(source: string): TestKind {
  if (/^\/\/ @dune-suite integration\s*$/m.test(source)) return 'integration';
  if (/^import\b[^\n]*from ['"]node:sqlite['"]/m.test(source))
    return 'recovery';
  return 'unit';
}

export function discoverTests(root: string, directory = 'tests'): TestFile[] {
  return readdirSync(join(root, directory), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry): TestFile[] => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return discoverTests(root, path);
      if (!entry.isFile() || !/\.test\.(?:ts|tsx|mts|js|mjs)$/.test(entry.name))
        return [];
      const source = readFileSync(join(root, path), 'utf8');
      const kind = classifyTest(source);
      if (
        /process\.env\.DUNE_TEST_URL\b/.test(source) &&
        kind !== 'integration'
      )
        throw new Error(`${path}: HTTP tests need // @dune-suite integration`);
      return [{ path, kind }];
    });
}

export function selectTests(
  files: TestFile[],
  suite: TestSuite,
  filters: string[] = [],
): TestFile[] {
  const selected = files.filter(({ path, kind }) => {
    const included =
      suite === 'all' ||
      (suite === 'offline' && kind !== 'integration') ||
      (suite === 'multiplayer' && kind !== 'unit') ||
      suite === kind;
    return (
      included && (!filters.length || filters.some((f) => path.includes(f)))
    );
  });
  // A typo should never produce a green run that executed no tests.
  for (const filter of filters)
    if (!selected.some(({ path }) => path.includes(filter)))
      throw new Error(`No ${suite} test files match "${filter}".`);
  if (!selected.length) throw new Error(`No test files in suite "${suite}".`);
  return selected;
}
