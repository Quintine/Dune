# Working on Dune

Unofficial Dune board game: React 19, TypeScript, Vinext/Vite, Cloudflare
Workers and D1. Use npm and the checked-in lockfile; Node >=22.13 is required
for the in-memory SQLite tests. `tsx` is a pinned development dependency.

## Start small

- Read `README.md` and this guide first. See `docs/DEVELOPMENT.md` for the
  architecture map and focused verification commands.
- Run `git status --short` before editing; preserve other work.
- Search the relevant feature in `game/`, `components/`, `tests/`, and `docs/`.
  Use `rg -n` and bounded reads for `game/engine.ts` and
  `components/game-table.tsx`; both are large orchestration files.
- `docs/IMPLEMENTATION_STATUS.md` is a historical evidence log, newest first.
  Read its opening checkpoint and the relevant feature document rather than
  loading the entire log. Verify historical claims against current code/tests.
- Do not read `github.md` for routine development: it is ignored private local
  credential material. Do not put secrets in logs or tracked files.

## Implement and verify

- Keep rule calculations/validation in focused `game/` modules; integrate them
  through the engine, player view, bots and UI as the feature requires.
- Preserve rejected-action immutability, physical card/force custody, private
  information boundaries, and JSON save/restore behavior. Reuse shared rule
  quotes instead of independently duplicating legality in bots or components.
- Add meaningful regressions to `tests/**/*.test.ts`; discovery is automatic.
  HTTP tests must start with `// @dune-suite integration`. Tests importing
  `node:sqlite` are classified as in-memory recovery tests automatically.
- During iteration: `npm test -- <filename-fragment>`; multiple fragments form
  a union. Use `--list` to inspect selection and `--name <regex>` to narrow
  cases. A filename typo fails rather than silently passing an empty suite.
- Before handing off code changes: `npm run check` (types, lint, offline tests).
  Run `npm run build` for app/build/dependency changes. Run
  `npm run test:integration` against a development server for HTTP, auth or
  persistence changes. Documentation-only edits need link/command review.
- Extend testing when failures or changed behavior justify it. Do not run AI
  calibration or browser acceptance for unrelated maintenance changes.
- If a sandbox blocks test subprocess pipes with `EPERM`, rerun the exact check
  with approved subprocess permissions. Do not disable isolation or skip tests
  to obtain a green result; the runner self-test checks real failure propagation.
- Report actual check results and limitations. Passing focused tests does not
  certify a complete faction, expansion or rules mode; preserve release gates.

## Preserve development state

- Keep `.wrangler/state` and all saved games. Never reset a database to fix a
  test, migration, connection or gameplay problem. Migrations are additive.
- Reuse a running dev server. Warn before interrupting human play, defer to a
  safe point, and verify restoration after a necessary restart. No recurring
  maintenance automation is installed; do not recreate it without a request.
- `.openai/hosting.json` identifies the existing Sites project. Preserve it.
  Follow the applicable Sites skills for site work; publication has existing
  completion and verification gates documented in `README.md`.
- Keep generated builds, caches and editor backups out of version control.
  Avoid mass formatting, unrelated dependency updates and broad engine rewrites.
