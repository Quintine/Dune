#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = `Create an administrator access key and provisioning SQL:
  node tools/admin-access.mjs --name 'Owner' --role owner --out /private/new-directory

Revoke an account and all its sessions (the final enabled owner is protected):
  node tools/admin-access.mjs --revoke <account-uuid> --out /private/new-directory

Roles: owner, operator, viewer. The output directory must be new, absolute and
outside the application checkout. Apply the generated SQL to the intended D1
database with your operator tooling. No database is contacted by this command.
The private access key is written only to access-key.txt, never to the SQL or stdout.
`;

function parseArgs(args) {
  if (args.length === 1 && args[0] === '--help') return null;
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const option = args[i];
    if (
      !['--name', '--role', '--out', '--revoke'].includes(option) ||
      Object.hasOwn(options, option) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error('Use --help for the required command options.');
    options[option] = args[i + 1];
  }
  if (!options['--out'] || !isAbsolute(options['--out']))
    throw new Error(
      '--out must name a new absolute directory outside the checkout.',
    );
  if (options['--revoke']) {
    if (
      options['--name'] ||
      options['--role'] ||
      options['--revoke'].length !== 36 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        options['--revoke'],
      )
    )
      throw new Error(
        'Revocation requires only --revoke with an account UUID and --out.',
      );
  } else {
    const name = options['--name']?.trim();
    if (
      !name ||
      name.length > 80 ||
      [...name].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || (code >= 127 && code <= 159);
      })
    )
      throw new Error(
        '--name must contain 1–80 characters without control characters.',
      );
    if (!['owner', 'operator', 'viewer'].includes(options['--role']))
      throw new Error('--role must be owner, operator or viewer.');
    options['--name'] = name;
  }
  return options;
}

const quote = (value) => `'${value.replaceAll("'", "''")}'`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    process.stdout.write(usage);
    return;
  }
  const checkout = await realpath(
    resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  );
  const requested = resolve(options['--out']);
  // Resolve the parent before checking containment, including symlink aliases.
  const parent = await realpath(dirname(requested));
  const output = resolve(parent, relative(dirname(requested), requested));
  const within = relative(checkout, output);
  if (
    within === '' ||
    (within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within))
  )
    throw new Error(
      'The output directory must be outside the application checkout.',
    );

  await mkdir(output, { mode: 0o700 }); // Existing files/directories are never reused.
  try {
    const now = Date.now();
    const revoked = options['--revoke'];
    const id = revoked || randomUUID();
    if (revoked) {
      const sql = `-- Apply to the intended D1 database; this contains no access key.
-- The database trigger refuses to revoke the final enabled owner.
UPDATE admin_accounts SET enabled = 0, updated_at = ${now}
WHERE id = ${quote(id)} AND enabled = 1
RETURNING id, name, role, enabled;
`;
      await writeFile(resolve(output, 'revoke.sql'), sql, {
        mode: 0o600,
        flag: 'wx',
      });
    } else {
      const key = `dune-admin.${id}.${randomBytes(32).toString('hex')}`;
      const keyHash = createHash('sha256').update(key).digest('hex');
      const sql = `-- Apply to the intended D1 database; this contains only the access-key hash.
-- The database trigger records provisioning in the administrator audit history.
INSERT INTO admin_accounts (id, name, role, key_hash, enabled, session_generation, created_at, updated_at)
VALUES (${quote(id)}, ${quote(options['--name'])}, ${quote(options['--role'])}, ${quote(keyHash)}, 1, 0, ${now}, ${now});
`;
      await writeFile(resolve(output, 'access-key.txt'), key + '\n', {
        mode: 0o600,
        flag: 'wx',
      });
      await writeFile(resolve(output, 'provision.sql'), sql, {
        mode: 0o600,
        flag: 'wx',
      });
    }
    process.stdout.write(
      `Created ${revoked ? 'revocation' : 'provisioning'} files for administrator ${id} in ${output}.\n`,
    );
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  // Filesystem errors may include operator paths; credential values never enter errors.
  process.stderr.write(
    `Administrator access setup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
});
