import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { runVerification, type VerificationStep } from './verification';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      focus: { type: 'string', multiple: true },
      games: { type: 'string' },
      seed: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node --import tsx tools/verify.ts --out /tmp/new-run check [build] [integration]\nOr: --out /tmp/new-run focused --focus fragment [--focus fragment]\nOr: --out /tmp/new-run base-games --games 20 --seed 20260913\nLogs and source-bound report.json stay outside the checkout. Commands stop on failure; changed source invalidates success.',
    );
    return;
  }
  if (!values.out || !positionals.length)
    throw new Error('Provide --out and verification steps; see --help.');
  if (values.focus?.some((fragment) => !fragment || fragment.startsWith('-')))
    throw new Error('--focus accepts filename fragments, not runner options.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const steps: VerificationStep[] = positionals.map((name) => {
    if (['check', 'build', 'integration'].includes(name))
      return {
        name,
        command: 'npm',
        args: ['run', name === 'integration' ? 'test:integration' : name],
      };
    if (name === 'focused' && values.focus?.length)
      return { name, command: 'npm', args: ['test', '--', ...values.focus] };
    if (name === 'base-games') {
      const games = Number(values.games),
        seed = Number(values.seed);
      if (
        !Number.isSafeInteger(games) ||
        games < 1 ||
        games > 120 ||
        !Number.isSafeInteger(seed) ||
        seed < 1 ||
        seed > 0xffffffff
      )
        throw new Error(
          'base-games requires --games 1..120 and --seed 1..4294967295.',
        );
      return {
        name,
        command: process.execPath,
        args: [
          '--import',
          'tsx',
          'tools/ai-calibration.ts',
          '--games',
          String(games),
          '--seed',
          String(seed),
          '--out',
          resolve(values.out!, 'base-games.json'),
        ],
      };
    }
    throw new Error(`Unknown or incomplete step: ${name}`);
  });
  if (values.focus && !positionals.includes('focused'))
    throw new Error('--focus requires the focused step.');
  if ((values.games || values.seed) && !positionals.includes('base-games'))
    throw new Error('--games/--seed require base-games.');
  const report = await runVerification(root, values.out, steps);
  console.log(
    `Verification ${report.status}; ${resolve(values.out, 'report.json')}`,
  );
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
main().catch(() => {
  console.error(
    'Verification could not complete. Check arguments, repository and output location; see --help.',
  );
  process.exitCode = 1;
});
