# Working on Dune

Unofficial Dune board game: React 19, TypeScript, Vinext/Vite, Cloudflare
Workers and D1. Use npm and the checked-in lockfile; Node >=22.13 is required
for the in-memory SQLite tests. `tsx` is a pinned development dependency.

## Start small

- Start here; use `docs/DEVELOPMENT.md#context-index` to open only the task's
  canonical paths, then the relevant README instructions if needed.
- When continuing the complete project goal in this checkout, explicitly read
  `GOAL.local.md` if present; it is local and ignored, not automatically loaded
  project context. If absent, use the tracked guidance and the current user
  request. Never recreate it from credential-bearing handovers or commit it.
- Read the opening of `docs/CURRENT_STATUS.md` for active work; use the bounded
  lookup in `docs/DEVELOPMENT.md#canonical-feature-lookup` for feature evidence
  and `docs/RULE_DECISIONS.md` for source authority and rulings.
- Run `git status --short` before editing; preserve other work.
- Locate the feature's helper and consumers from its existing evidence paths;
  search the relevant subsystem only when those paths are missing.
  Use OMP `find` for unknown behavior, `grep` for known literals and bounded
  `read` for `game/engine.ts` and `components/game-table.tsx`; both are large
  orchestration files.
- `docs/IMPLEMENTATION_STATUS.md` is a historical evidence log, newest first.
  Read its opening checkpoint and the relevant feature document rather than
  loading the entire log. Verify historical claims against current code/tests.
- Do not read `github.md` for routine development: it is ignored private local
  credential material. Do not put secrets in logs or tracked files.

## Prototype the remaining scope first

- The user prioritizes working first versions of all remaining functions across
  Basic, Advanced and every expansion, followed by integration, refinement and
  polish. Reuse existing capabilities; batch related functions by dependency.
- The 2 October 2026 amendment supersedes the 26 September sequencing:
  implement all rules first; save/recovery, privacy and custody assurance plus
  comprehensive review follow afterward, not as per-prototype gates. Do not
  repeat seat-restoration audits, whole-database comparisons or preservation
  loops at each feature. This defers assurance, not printed card/force/payment
  mechanics, existing authorization, no-reset/no-deletion or secret protection.
- Track missing, prototyped, integrated, verified and polished work in the
  existing checklist. Prototypes need usable controls, connected rule behavior,
  a minimal legal AI path and changed-path smoke; placeholders and disconnected
  helpers are not completed features. Recovery certification comes later.
- A complete administration panel is required non-AI scope: room creation,
  lifecycle/removal, participant support, backups/restoration and operations.
  Follow `docs/ADMIN_PANEL.md`; retain authorization, privacy, audit history and
  saved-game safeguards. Adding this scope does not authorize a game reset.
- Iterate on the smallest failing case first. Keep legality, crashes, deadlocks,
  usable controls and minimal legal AI feedback; batch related rules by dependency
  before integration proof. Do not add privacy/custody/save audits to that loop.
- Defer full AI implementation, strategic refinement and difficulty calibration
  until all non-AI game features are complete. Until then, maintain only minimal
  legal participation and fix critical playability/correctness issues. Afterward,
  target approximately 75% higher-tier wins for each adjacent pair: Medium/Easy,
  Hard/Medium and Brutal/Hard. See `docs/AI_DEVELOPMENT_PLAN.md` for evaluation.
- Keep one shared integration owner and selectively delegate disjoint substantial
  slices. Rule-specific decisions may need bounded review now; comprehensive
  rules/privacy/persistence review follows all rules. Commit and push verified
  checkpoints under standing authorization. No usage cutoff or routine
  account-usage check remains.
- Keep material rulings explicit and prototype independent work while pending.
  The user-authorized Advanced preview permits unfinished base-faction starts
  with a visible warning; see `docs/ADVANCED_PREVIEW.md`. Prototype evidence does
  not certify complete modes or open expansion/publication gates.

## OMP harness workflow

See [the OMP harness workflow](docs/DEVELOPMENT.md#omp-harness-workflow) and
[compact handoff](docs/DEVELOPMENT.md#compact-agent-handoff). Live tool schemas
take precedence. Use native planning, delegation and browser tools; one
integration owner freezes related work before running shared checks.

## Implement and verify

- Keep rule calculations/validation in focused `game/` modules; integrate them
  through the engine, player view, bots and UI as the feature requires.
- Reuse shared rule quotes rather than duplicating legality in bots or components.
  Preserve existing rejected-action immutability, physical card/force mechanics,
  private boundaries and JSON behavior; defer their assurance campaigns until
  all rules are implemented rather than making them new per-feature gates.
- Add meaningful regressions to `tests/**/*.test.ts`; discovery is automatic.
  HTTP tests must start with `// @dune-suite integration`. Tests importing
  `node:sqlite` are classified as in-memory recovery tests automatically.
- During iteration: `npm test -- <filename-fragment> --name '<failing-case-regex>'`.
  Inspect with `--list`; verify the intended case actually ran. Once repaired,
  run the related file union once, not after every tiny fixture edit. Filename
  typos fail instead of passing an empty selection.
- At a frozen related-rule batch, the integration owner runs `npm run check:quick`
  (types/lint), affected tests and the changed runtime path once. Build
  app/build/dependency changes;
  run relevant HTTP tests for actual boundary changes, not routine assurance.
  See `docs/DEVELOPMENT.md#feedback-and-proof-schedule` for the full schedule.
- Full `npm run check`, comprehensive review, recovery/privacy/custody audits,
  combinations, browser/deployed acceptance and required release proof remain
  due after all rules. Earlier broad checks need a concrete integration risk or
  observed failure, not habit. Documentation-only edits need link/command review.
  Do not run AI calibration or unrelated browser acceptance for maintenance.
- If a sandbox blocks test subprocess pipes with `EPERM`, rerun the exact check
  with approved subprocess permissions. Do not disable isolation or skip tests
  to obtain a green result; the runner self-test checks real failure propagation.
- Report actual check results and limitations. Passing focused tests does not
  certify a complete faction, expansion or rules mode; preserve release gates.
- Verify relevant runtime changes on `https://dune.procrastination.games` after
  deployment, matching the deployed revision to the checkpoint. Use dedicated
  QA rooms and preserve existing games; local success is not deployed evidence.
  Follow `docs/VERIFICATION_WORKFLOW.md` for production checks and limitations.

## Preserve development state

- The user-authorized 2026-09-13 reset cleared old local games once; see
  `docs/VERIFICATION_WORKFLOW.md`. Preserve all games created afterward.
- Keep `.wrangler/state` and all saved games: do not delete/reset or
  intentionally damage existing games; extensive historical-save hardening
  follows the content-first priority above. Never reset a database to fix a
  test, migration, connection or gameplay problem. Migrations are additive.
- Reuse a running dev server. Restart only when a code/configuration change or
  observed server condition warrants it; there is no hourly restart schedule.
  Warn before interrupting human play and defer to a safe point. Observe server
  health after a necessary restart; comprehensive restoration assurance follows
  all rules. No recurring maintenance automation is installed.
- `.openai/hosting.json` identifies the existing Sites project. Preserve it.
  Follow the applicable Sites skills for site work; publication has existing
  completion and verification gates documented in `README.md`.
- Keep generated builds, caches and editor backups out of version control.
  Avoid mass formatting, unrelated dependency updates and broad engine rewrites.

## Efficient checkpoints

- Use `docs/VERIFICATION_WORKFLOW.md` for compact source-bound reports and the
  deferred final saved-game/seat assurance commands. Keep artifacts outside Git.
- Use subagents selectively for bounded independent tasks and complex reviews;
  they remain explicitly authorized. Share concise briefs and file ownership.
- Review, verify, commit and push completed checkpoints automatically under
  “Push all from now on.” Confirm push success; never force-push or expose secrets.
