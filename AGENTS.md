# Working on Dune

Unofficial Dune board game: React 19, TypeScript, Vinext/Vite, Cloudflare
Workers and D1. Use npm and the checked-in lockfile; Node >=22.13 is required
for the in-memory SQLite tests. `tsx` is a pinned development dependency.

## Start small

- Read `README.md` and this guide first. See `docs/DEVELOPMENT.md` for the
  architecture map and focused verification commands.
- Read `docs/CURRENT_STATUS.md` for current gates and `docs/RULE_DECISIONS.md`
  for existing rulings before reopening research.
- Run `git status --short` before editing; preserve other work.
- Search the relevant feature in `game/`, `components/`, `tests/`, and `docs/`.
  Use `rg -n` and bounded reads for `game/engine.ts` and
  `components/game-table.tsx`; both are large orchestration files.
- `docs/IMPLEMENTATION_STATUS.md` is a historical evidence log, newest first.
  Read its opening checkpoint and the relevant feature document rather than
  loading the entire log. Verify historical claims against current code/tests.
- Do not read `github.md` for routine development: it is ignored private local
  credential material. Do not put secrets in logs or tracked files.

## Prototype the remaining scope first

- The user prioritizes working first versions of all remaining functions across
  Basic, Advanced and every expansion, followed by integration, refinement and
  polish. Reuse existing capabilities; batch related functions by dependency.
- Track missing, prototyped, integrated, verified and polished work in the
  existing checklist. Prototypes need usable controls, a legal AI path and saved
  continuation; placeholders and disconnected helpers are not completed features.
- Keep focused checks for crashes, deadlocks, legality, custody, privacy and save
  integrity. Defer exhaustive combinations, AI calibration and visual polish
  until broader functional coverage, unless current failures require them.
- Preserve required checkpoint checks, selective subagents and independent
  review for complex rules/privacy/persistence. Commit and push verified
  checkpoints under standing authorization; stop at 80% weekly usage consumed.
- Keep material rulings explicit and prototype independent work while pending.
  Prototype evidence does not open mode or publication gates.

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

- The user-authorized 2026-09-13 reset cleared old local games once; see
  `docs/VERIFICATION_WORKFLOW.md`. Preserve all games created afterward.
- Keep `.wrangler/state` and all saved games. Never reset a database to fix a
  test, migration, connection or gameplay problem. Migrations are additive.
- Reuse a running dev server. Restart only when a code/configuration change or
  observed server condition warrants it; there is no hourly restart schedule.
  Warn before interrupting human play, defer to a safe point, and verify
  restoration after a necessary restart. No recurring maintenance automation
  is installed; do not recreate it without a request.
- `.openai/hosting.json` identifies the existing Sites project. Preserve it.
  Follow the applicable Sites skills for site work; publication has existing
  completion and verification gates documented in `README.md`.
- Keep generated builds, caches and editor backups out of version control.
  Avoid mass formatting, unrelated dependency updates and broad engine rewrites.

## Efficient checkpoints

- Use `docs/VERIFICATION_WORKFLOW.md` for compact source-bound check reports
  and private saved-game/seat checks. Keep artifacts outside the checkout.
- Use subagents selectively for bounded independent tasks and complex reviews;
  they remain explicitly authorized. Share concise briefs and file ownership.
- Review, verify, commit and push completed checkpoints automatically under
  “Push all from now on.” Confirm push success; never force-push or expose secrets.
