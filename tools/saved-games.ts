import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  captureSavedGames,
  compareSavedGames,
  loadSavedGameSnapshot,
  readSavedGames,
} from './saved-game-verification';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      db: { type: 'string' },
      out: { type: 'string' },
      baseline: { type: 'string' },
      backup: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node --import tsx tools/saved-games.ts snapshot --db PATH --out /tmp/new-snapshot [--backup]\nOr: compare --db PATH --baseline /tmp/new-snapshot/snapshot.json\nRead-only source access. New rooms are allowed; any changed or missing original room fails. Backup requires Node >=22.16.',
    );
    return;
  }
  if (!values.db || positionals.length !== 1)
    throw new Error('Provide a database and operation.');
  if (positionals[0] === 'snapshot' && values.out && !values.baseline) {
    const result = await captureSavedGames(
      fileURLToPath(new URL('../', import.meta.url)),
      values.db,
      values.out,
      values.backup,
    );
    console.log(
      JSON.stringify({
        captured: result.rooms.length,
        backup: !!values.backup,
      }),
    );
  } else if (
    positionals[0] === 'compare' &&
    values.baseline &&
    !values.out &&
    !values.backup
  ) {
    const result = compareSavedGames(
      loadSavedGameSnapshot(values.baseline),
      readSavedGames(values.db),
    );
    console.log(
      JSON.stringify({
        ...result,
        missing: result.missing.length,
        changed: result.changed.length,
      }),
    );
    process.exitCode = result.preserved ? 0 : 1;
  } else throw new Error('Invalid operation.');
}
main().catch(() => {
  console.error(
    'Saved-game verification failed. Check arguments, schema and file access; see --help.',
  );
  process.exitCode = 1;
});
