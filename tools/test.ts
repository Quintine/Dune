import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { discoverTests, selectTests, type TestSuite } from './test-discovery';

const root = fileURLToPath(new URL('../', import.meta.url));

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      suite: { type: 'string', default: 'offline' },
      list: { type: 'boolean', default: false },
      name: { type: 'string' },
      concurrency: { type: 'string' },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(`Usage: npm test -- [filename-fragment ...] [options]

  --suite offline|unit|recovery|integration|multiplayer|all
  --list                 Print selected files without running tests
  --name REGEX           Run matching test names within selected files
  --concurrency NUMBER   Parallel test files (default: up to 4; HTTP: 1)
  --verbose              Include passing test rows (default: failures + summary)

Examples:
  npm test -- ecaz-collection ecaz-spice
  npm run test:recovery -- guild-ambassador
  npm run test:integration -- --list`);
    return;
  }
  const suites = [
    'offline',
    'unit',
    'recovery',
    'integration',
    'multiplayer',
    'all',
  ];
  if (!suites.includes(values.suite))
    throw new Error('Unknown test suite. Use --help.');
  const selected = selectTests(
    discoverTests(root),
    values.suite as TestSuite,
    positionals,
  );
  if (values.name !== undefined) new RegExp(values.name);
  if (values.name === '') throw new Error('--name must not be empty.');
  if (values.list) {
    for (const file of selected) console.log(`${file.kind}\t${file.path}`);
    console.log(`${selected.length} test files`);
    return;
  }
  const network = selected.some(({ kind }) => kind === 'integration');
  const concurrency =
    values.concurrency === undefined
      ? network
        ? 1
        : Math.min(4, availableParallelism())
      : Number(values.concurrency);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error('--concurrency must be a positive integer.');
  if (network) {
    const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
    try {
      const response = await fetch(new URL('/', base), {
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      throw new Error(
        `Test server unavailable at ${base}. Run npm run db:local, then npm run dev, or set DUNE_TEST_URL to a test server.`,
      );
    }
  }
  console.log(
    `Running ${selected.length} ${values.suite} test files (concurrency ${concurrency}).`,
  );
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      '--test',
      `--test-concurrency=${concurrency}`,
      '--test-reporter=./tools/test-reporter.ts',
      ...(values.name !== undefined
        ? [`--test-name-pattern=${values.name}`]
        : []),
      ...selected.map(({ path }) => path),
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        DUNE_TEST_VERBOSE: values.verbose ? '1' : '0',
      },
    },
  );
  // Forward cancellation so a stopped check does not leave test workers behind.
  let interrupted = 0;
  const interrupt = () => {
    interrupted = 130;
    child.kill('SIGINT');
  };
  const terminate = () => {
    interrupted = 143;
    child.kill('SIGTERM');
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    const { promise, resolve, reject } = Promise.withResolvers<number>();
    child.once('error', reject);
    child.once('close', (code, signal) =>
      resolve(
        interrupted ||
          (code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1)),
      ),
    );
    process.exitCode = await promise;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
