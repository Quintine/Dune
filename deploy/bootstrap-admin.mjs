// Run after migrations, before the container accepts requests. The conditional
// insert is atomic: existing accounts (including disabled ones) are never replaced.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const id = randomUUID();
const key = `dune-admin.${id}.${randomBytes(32).toString('hex')}`;
const hash = createHash('sha256').update(key).digest('hex');
const now = Date.now();
const sql = `INSERT INTO admin_accounts (id, name, role, key_hash, enabled, session_generation, created_at, updated_at)
SELECT '${id}', 'Initial owner', 'owner', '${hash}', 1, 0, ${now}, ${now}
WHERE NOT EXISTS (SELECT 1 FROM admin_accounts)
RETURNING id;`;
const output = execFileSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB',
  '--local', '--config', 'tools/wrangler.local.json',
  '--persist-to', process.env.DUNE_STATE_PATH || '/data',
  '--command', sql, '--json',
], { encoding: 'utf8' });
const result = JSON.parse(output);
if (!Array.isArray(result) || result.length !== 1 || result[0].success !== true ||
    !Array.isArray(result[0].results)) {
  throw new Error('Initial administrator provisioning did not return a valid result');
}
if (result[0].results.length === 1 && result[0].results[0].id === id) {
  console.log(`Initial administrator access key (save privately; shown only on first provisioning): ${key}`);
} else if (result[0].results.length !== 0) {
  throw new Error('Initial administrator provisioning returned an unexpected account');
}
