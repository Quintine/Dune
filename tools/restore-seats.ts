import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  checkSeatRestoration,
  loadRestorationConfig,
} from './seat-restoration';

async function main() {
  const { values } = parseArgs({
    options: { config: { type: 'string' }, help: { type: 'boolean' } },
  });
  if (values.help) {
    console.log(
      'Usage: node --import tsx tools/restore-seats.ts --config /private/qa-seats.json\nRequires a private manifest outside the checkout and isolated, stable human QA rooms on a loopback server. GET can resume automatic game work. This checks HTTP restoration, not browser rendering.',
    );
    return;
  }
  if (!values.config) throw new Error();
  const config = loadRestorationConfig(
    values.config,
    fileURLToPath(new URL('../', import.meta.url)),
  );
  console.log(JSON.stringify(await checkSeatRestoration(config)));
}
main().catch(() => {
  console.error(
    'Private-seat restoration failed. Check the private manifest, stable QA versions and local server; see --help.',
  );
  process.exitCode = 1;
});
