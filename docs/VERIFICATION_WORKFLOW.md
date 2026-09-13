# Repeatable verification

Use the [development guide](DEVELOPMENT.md) to choose checks appropriate to the
change. These wrappers retain the existing test runner and simulation harness;
they do not replace rules, browser or release acceptance.

## Compact checks and source evidence

```sh
node --import tsx tools/verify.ts --out /tmp/dune-new-focused focused --focus guild-payment
node --import tsx tools/verify.ts --out /tmp/dune-new-check check
# Add build for app/build/dependency changes, integration for HTTP/auth/persistence.
node --import tsx tools/verify.ts --out /tmp/dune-new-release check build integration
# Only for relevant AI/gameplay work; the existing study covers Basic base factions.
node --import tsx tools/verify.ts --out /tmp/dune-new-study base-games --games 20 --seed 20260913
```

Each output must be a new directory outside the checkout, with an existing parent.
It is created with private permissions. Full command output stays in step logs;
`report.json` records commands, exit codes, timings, HEAD and a content fingerprint
of tracked and nonignored untracked files before and after the run. Ignored local
credentials, saved games and build caches are excluded. Do not supply secrets in
command arguments. A failed child stops subsequent steps. Changed source or HEAD
invalidates a successful run; finish all source/doc edits before broad checks.
This checks the two observed snapshots, not changes made and reverted between them,
nor the contents of dependencies, ignored files or an external HTTP server.
An interrupted or incomplete report is never evidence of success.

## Saved games and online backups

```sh
node --import tsx tools/saved-games.ts snapshot --db /absolute/games.sqlite --out /private/new-baseline --backup
node --import tsx tools/saved-games.ts compare --db /absolute/games.sqlite --baseline /private/new-baseline/snapshot.json
```

The source database is opened read-only. Snapshots store room versions and state
hashes, not private game state. New rooms are allowed; every changed or missing
original room fails comparison. Legitimate human play can change a room: investigate
and document it, never overwrite progress to make a comparison pass. Snapshot the
current set before each maintenance operation so newly created rooms are protected.
Online backup includes WAL contents and requires Node 22.16 or newer; snapshot and
comparison retain the project's Node 22.13 minimum. Backup files contain private
state and session records, remain outside Git, and never overwrite an earlier run.
This tool does not delete, reset or restore the live database.

### Authorized reset, 13 September 2026

The user requested clearing all old local games and starting a new checkpoint.
With no development server running, a verified online backup preceded a single
transaction deleting **3,644 rooms** and cascading their seat/recovery/entry records.
Schema, migrations and Wrangler state files were preserved. All five application
tables were empty afterward; foreign-key validation passed.

Private archive: `/home/quintine/.local/share/dune/checkpoints/20260913-before-reset/`.
Fresh empty database backup and snapshot:
`/home/quintine/.local/share/dune/checkpoints/20260913-fresh-baseline/`.
These machine-local paths are operational records, not portable repo artifacts.
Old room IDs in historical browser evidence no longer identify active local games.
Future games must be preserved. This was a one-time user-authorized reset, not a
maintenance strategy or permission to clear future games.

## Private-seat restoration

Create a private JSON file (mode 0600) outside the checkout with this structure;
substitute credentials only in that private file, never in a command or tracked doc:

```json
{"baseUrl":"http://127.0.0.1:3000","isolatedQa":true,"seats":[{"code":"ABCDEFGH","playerId":"fixture-seat-id","version":4,"token":"fixture_session_token"}]}
```

```sh
node --import tsx tools/restore-seats.ts --config /private/qa-seats.json
```

Use deliberately isolated, stable human QA rooms. The server's GET route can resume
bots or automatic work, so this is not a generally side-effect-free read and must
not probe arbitrary human games. Requests use loopback origins only, reject redirects
and time out. Checks require the expected room, seat and version, the owning seat's
private fields, and absence of selected rival private fields. No session tokens,
response bodies or hands are printed. This is HTTP seat restoration, not recovery-key
rotation, exact hand-content proof, a complete privacy audit or browser rendering.
Pair it with saved-game comparison and feature-specific browser acceptance.
