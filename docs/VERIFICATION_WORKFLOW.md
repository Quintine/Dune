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

### Reusable base and faction sample games

```sh
node --import tsx tools/faction-games.ts --out /tmp/dune-new-faction-games
# Ten genuine base samples: Basic and Advanced at each player count.
node --import tsx tools/faction-games.ts --out /tmp/dune-new-base-games --profile base
node --import tsx tools/faction-games.ts --out /tmp/dune-new-base-three --profile base --players 3 --rules advanced
node --import tsx tools/faction-games.ts --out /tmp/dune-new-combined --profile combined --rules advanced --seed 20260926
node --import tsx tools/faction-games.ts --out /tmp/dune-new-resume --resume /private/failed-combined-advanced.json
```

Default and `--profile all` retain the original six fixed CHOAM/Richese,
Ecaz/Moritani and combined Basic/Advanced samples. `--profile base` selects ten
additional samples: Basic and Advanced with two through six players.
`--players 2..6` narrows only that base profile; omission or `all` retains all
five counts. The fixed base roster adds Atreides, Harkonnen, Fremen, Emperor,
Guild and Bene Gesserit in that order. These are sample rosters, not an assertion
that these are the only rules-permitted player-count configurations.

All samples use genuine setup and saved AI profiles, cycling Easy, Medium,
Hard and Brutal by seat. Smaller games necessarily contain fewer profiles;
the matrix collectively exercises all four. Filters retain each scenario's
seed offset: the original six use 0–5; base uses
`6 + 2 × (players − 2) + Advanced`, where Advanced is 0 or 1. `--seed` defaults to 20260926;
`--max-actions` defaults to 3500 accepted actions per game. Every action checks
physical card custody (including unsold auction cards), nonnegative integer
forces/spice, twenty-force totals and the distinct Fremen/Emperor/Ixian elite totals
and subsets. Base samples also check the exact Traitor inventory after dealing
has finished; expansion Traitor/Face Dancer zones are not certified by this
check. Every rejected candidate must leave its input unchanged. Every 37 actions
checks all private views after JSON restoration and absence of rival hand,
spice, Traitor and Face Dancer fields. Rejected candidates remain visible in private traces even when
a later candidate succeeds. Samples are development evidence, not calibration or
complete rules certification.

The output is a new private directory outside the checkout. It contains private
traces, incomplete-game snapshots, `results.json` and a source-bound `report.json`.
An incomplete game or changed source exits nonzero. Resume requires a matching
fixed base or expansion scenario snapshot with saved AI profiles and records its
SHA-256; it cannot be combined with profile/rules/player-count filters. Its action budget starts at the snapshot,
and its random stream restarts from the supplied seed plus scenario offset.
Check setup provenance against the original report: accepting a supplied snapshot
does not prove it came from genuine setup. No live room or database is accessed.

### Preservation commands

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
