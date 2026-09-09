# Development workflow

Start with [README](../README.md) for installation and saved-game behavior and
[AGENTS.md](../AGENTS.md) for project invariants. This page is a navigation and
verification guide, not a second implementation-status log.

## Architecture map

| Concern                            | Entry points                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| Authoritative state and actions    | `game/engine.ts`: `Game`, `applyAction`, `viewGame`, `normalizeAutomaticGame`                      |
| Rule validation and calculations   | Feature modules in `game/`; `*-quote.ts` modules compute validated outcomes before mutation        |
| AI                                 | `game/bots.ts`: `botActions`, `runBots`; `game/bot-*.ts` and shared rule modules                   |
| Persistence, concurrency, recovery | `db/rooms.ts`; D1 schema in `db/schema.ts`, additive SQL in `drizzle/`                             |
| HTTP and session boundary          | `app/api/rooms/route.ts`, `app/api/rooms/[code]/route.ts`, `app/api/rooms/[code]/control/route.ts` |
| Table UI                           | `components/game-table.tsx` orchestrates feature components; `app/page.tsx` is the route entry     |
| Client request/retry state         | `lib/client-request.ts`, `lib/room-entry.ts`, `lib/seat-recovery.ts`                               |
| Player reference and evidence      | `game/reference.ts`, `game/faction-reference.ts`, `app/rules/`; feature docs in `docs/`            |
| Tooling                            | `package.json`, `tools/test.ts`, `tools/test-discovery.ts`, `vite.config.ts`                       |

For a rule change, locate its helper, engine action/continuation, projected player
view, bot policy, UI and existing tests before editing. Keep server legality
authoritative and reuse helpers across those consumers. Test rejection without
mutation, physical resource conservation, interrupted decisions and saved JSON
restoration where relevant. See `tests/fixture-hand.ts` for physical card fixtures.

## Fast feedback

```sh
# Inspect selection without loading the engine or starting a server.
npm test -- ecaz-collection ecaz-spice --list

# Run related files, optionally narrowing test names.
npm test -- ecaz-collection ecaz-spice
npm test -- ecaz-spice --name 'fallback|conserves'

# Broad offline validation once the change is coherent.
npm run check

# App, build configuration or dependency changes also need a production build.
npm run build
```

| Command                    | Scope                                                                             | Live server? |
| -------------------------- | --------------------------------------------------------------------------------- | ------------ |
| `npm test`                 | All offline tests: rules, bots, client/components, tooling and in-memory recovery | No           |
| `npm run test:unit`        | Rules, bots, client/components and tooling                                        | No           |
| `npm run test:recovery`    | In-memory SQLite persistence and recovery                                         | No           |
| `npm run test:integration` | Explicitly marked HTTP/session tests                                              | Yes          |
| `npm run test:multiplayer` | Recovery plus HTTP tests; preserves the previous command's scope                  | Yes          |
| `npm run test:all`         | Every discovered test                                                             | Yes          |
| `npm run check`            | Typecheck, lint, then all offline tests                                           | No           |

All test commands accept filename fragments, `--list`, `--name REGEX`, and
`--concurrency NUMBER` after npm's `--`. Filename filters are literal substring
matches, combined with OR; every supplied filter must match its selected suite.
Name patterns are Node test-runner regular expressions and may skip every case,
so check the reported results when using them.

The runner discovers `tests/**/*.test.{ts,tsx,mts,js,mjs}` recursively and sorts
the paths. New offline tests require no manifest entry. HTTP files carry the
first-line annotation `// @dune-suite integration`; in-memory recovery tests
are identified by their single-line `node:sqlite` import. A file referencing
`process.env.DUNE_TEST_URL` without the HTTP annotation fails discovery. Tests
that introduce a different network helper must also carry the HTTP annotation.
The default offline suite includes every test without that annotation regardless
of its unit/recovery classification.

Offline test files run in isolated processes with at most four workers, avoiding
Node's machine-sized default on large hosts. Suites containing HTTP tests default
to one worker to avoid competing for the same development Worker. The launcher
uses `node --import tsx`, which avoids the tsx CLI's extra IPC listener. The exact
tsx version is declared directly and locked for clean installs.

## HTTP testing and stored games

Start the existing development environment with `npm run db:local`, then
`npm run dev`. Reuse a server already serving this checkout. Tests default to
`http://localhost:3000`; `DUNE_TEST_URL` can select a dedicated test server:

```sh
DUNE_TEST_URL=http://localhost:3000 npm run test:integration
```

The runner checks server availability before starting any selected HTTP suite.
HTTP tests create their own rooms in that server's database; use a development
or dedicated test instance. In-memory recovery tests execute production room
code and migrations against disposable SQLite databases and do not touch
`.wrangler/state`. Preserve that directory and existing human games.

## Keeping future changes small

TypeScript keeps incremental metadata under `node_modules/.cache/dune/`; build
outputs and Wrangler state are excluded from typechecking. `*.tsbuildinfo` and
patch backups are ignored. Git history preserves prior source versions.

Use feature docs for rule decisions and evidence, and keep new evidence concise.
The large [implementation status](IMPLEMENTATION_STATUS.md) log contains historical
checkpoints; a previous green count is not proof that the current source passes.
Full AI studies and browser acceptance belong to changes in their respective
behavior, not every edit. Runtime optimizations should follow a measured bottleneck
and retain legality, secrecy and saved-game invariants.
