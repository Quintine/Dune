# AI calibration: supported basic games

Measured 6 September 2026 (Australia/ACT), using the local engine and bot policy in this checkout. **All 120 seeded games completed; no deadlock, action-limit, exception, or checked invariant failure occurred.** Easy won once in 120 seat appearances. Medium and Brutal each won 41 times, and Hard won 37 times. These observations do **not** establish an increasing Medium → Hard → Brutal strength ladder.

This is a bounded simulation study of the current implementation, not a verification of the published game's complete rules, a browser/recovery test, or a human skill benchmark. No bot, engine, UI, or package configuration was changed for this study.

## Reproduce

From the project root, with its installed dependencies and Node supporting `--import tsx`:

```sh
node --import tsx tools/ai-calibration.ts --games 120 --seed 20260906 --max-actions 6000 --out /tmp/dune-ai-calibration.json
```

The run used Node v26.4.0 and took **140.194 seconds**. The JSON contains every game's assignments, seed, outcome, turn count, accepted and rejected action counts, rejection reasons, winning player IDs, source hashes, and failure context where applicable. The `/tmp` output is a local diagnostic artifact and is not guaranteed to persist; the tables below preserve the measured results. `--games 4` runs a short prefix for a smoke check, not a balanced calibration. The script intentionally caps a run at its 120-game design and exits unsuccessfully if any game fails to complete.

The harness replaces `crypto.getRandomValues` only inside its own Node process with a seeded Mulberry32 stream, matching the engine's `Uint32Array` randomness contract. It restores the original property in `finally`. Do not import this offline script into the application or server. It does not change production randomness.

## Configuration and assignment design

- Basic rules: `advanced: false`, no expansion modules, technology tokens disabled.
- Exactly 24 games at each player count from 2 through 6; 120 games and 480 player appearances overall.
- Six base factions only, in catalog order: Atreides, Harkonnen, Emperor, Fremen, Guild, Bene Gesserit. The harness creates and joins actual players, marks the bot seats ready, and uses the real `start` action. It does not bypass unsupported faction-start gates.
- Six roster blocks per player count. In block `b`, seat `s` receives faction `(b + s) mod 6`. This rotates every faction through every occupied seat equally.
- Four difficulty shifts per roster block. In shift `d`, seat `s` receives level `(s + d) mod 4`, using Easy, Medium, Hard, Brutal order. Each faction/seat assignment plays once at each difficulty. There are 120 appearances per level and 80 per faction overall.
- Every table contains mixed difficulties. For 5–6 players, some levels necessarily occupy more than one seat, and the shifts balance those duplicates.
- The four shifts share the same initial deal seed, room code, and player IDs, then reset the random stream before starting each game. Stable room code and IDs also preserve the bot's deterministic `variation` input. Different decisions can consume later random draws differently; this does not guarantee identical later draws by event.
- A game is limited to 6,000 accepted actions. The observed maximum was 2,328.

For master seed `m = 20260906`, player count `n`, and zero-based roster block `b`, the unsigned 32-bit seed is:

```text
(m + imul(n, 0x9e3779b9) + imul(b, 0x85ebca6b)) >>> 0
```

Each listed seed runs shifts 0, 1, 2, and 3, in that order. Player IDs are `seat-0` onward. Room code is `C` followed by the seed's base-36 representation padded to seven characters.

| Players | Block 0    | Block 1    | Block 2    | Block 3    | Block 4    | Block 5    |
| ------- | ---------- | ---------- | ---------- | ---------- | ---------- | ---------- |
| 2       | 1034165148 | 3280987655 | 1232842866 | 3479665373 | 1431520584 | 3678343091 |
| 3       | 3688600917 | 1640456128 | 3887278635 | 1839133846 | 4085956353 | 2037811564 |
| 4       | 2048069390 | 4294891897 | 2246747108 | 198602319  | 2445424826 | 397280037  |
| 5       | 407537863  | 2654360370 | 606215581  | 2853038088 | 804893299  | 3051715806 |
| 6       | 3061973632 | 1013828843 | 3260651350 | 1212506561 | 3459329068 | 1411184279 |

## Completion and turns

| Players   | Completed / games | Mean finishing turn | Accepted actions | Rejected candidates |
| --------- | ----------------- | ------------------- | ---------------- | ------------------- |
| 2         | 24 / 24           | 4.50                | 3,944            | 2,331               |
| 3         | 24 / 24           | 3.58                | 6,263            | 2,870               |
| 4         | 24 / 24           | 3.42                | 9,272            | 4,432               |
| 5         | 24 / 24           | 4.46                | 18,228           | 7,053               |
| 6         | 24 / 24           | 7.04                | 38,181           | 14,702              |
| **Total** | **120 / 120**     | **4.60**            | **75,888**       | **31,388**          |

Deadlocks: **0**. Action-limit failures: **0**. Unexpected exceptions: **0**. Checked invariant failures: **0**. All 120 games had at least one rejected candidate action. Finishing-turn counts for turns 1–10 respectively were **8, 18, 21, 23, 16, 11, 6, 1, 3, 13**.

After every accepted action, the harness checks conservation of each faction's 20 forces, nonnegative integer spice/force resources, and hand capacity, including the temporary hand-exchange allowance. These are selected invariants, not an exhaustive proof that every accepted transition implements all rules correctly.

## Observed wins

Win rate uses completed **player appearances** as its denominator. A shared winner would credit each winning player once; fractional credit would instead award each winner `1 / number of winners`. All 120 measured games had exactly one winning player, so the two counts coincide here.

| Difficulty | Appearances | Wins including shared | Win rate | Fractional win credit | Rejected candidates |
| ---------- | ----------- | --------------------- | -------- | --------------------- | ------------------- |
| Easy       | 120         | 1                     | 0.83%    | 1                     | 2,522               |
| Medium     | 120         | 41                    | 34.17%   | 41                    | 6,878               |
| Hard       | 120         | 37                    | 30.83%   | 37                    | 11,318              |
| Brutal     | 120         | 41                    | 34.17%   | 41                    | 10,670              |

| Players | Appearances per level | Easy wins | Medium wins | Hard wins | Brutal wins |
| ------- | --------------------- | --------- | ----------- | --------- | ----------- |
| 2       | 12                    | 1         | 8           | 8         | 7           |
| 3       | 18                    | 0         | 5           | 9         | 10          |
| 4       | 24                    | 0         | 11          | 6         | 7           |
| 5       | 30                    | 0         | 12          | 5         | 7           |
| 6       | 36                    | 0         | 5           | 9         | 10          |

For context, each faction had 80 appearances: Atreides won 16, Harkonnen 33, Emperor 21, Fremen 14, Guild 23, and Bene Gesserit 13. Balanced assignment reduces faction and seat confounding; it does not remove interaction effects. The engine's faction-specific endgame outcomes also affect measured success, especially among the 13 games that reached turn 10.

The observed Easy gap is large in this sample. Medium, Hard, and Brutal are close overall, with different results across player counts. More aggressive settings and more candidate exploration do not themselves prove higher playing strength. These data should guide later bot work without advertising an empirically verified four-level ranking.

## Rejected proposals versus failures

The instrumented loop follows `runBots` player order and candidate order, calling `botActions(viewGame(g, player.id))` and attempting candidates with `applyAction`. The policy receives only the source-derived view for its own player; it is never given the authoritative `Game`. The harness uses authoritative state solely for engine application, result collection, and invariant checks. It exercises the same policy/application loop rather than the exported `runBots` batching wrapper or the browser/server scheduling paths.

`runBots` already catches `RuleError` and tries the next candidate. This study counts those rejected proposals explicitly. A deadlock would mean that no candidate from any bot succeeded. A rejection is therefore neither an accepted illegal transition nor, by itself, a hard failure. However, it may be an invalid preferred choice as well as a later speculative fallback: **candidate position was not recorded, so the first-choice illegal-action rate is unmeasured**. The counts below must not be described as exclusively expected later-candidate filtering or as zero illegal proposals.

| Action / rejection reason                                    | Count      |
| ------------------------------------------------------------ | ---------- |
| Ship: insufficient spice                                     | 20,151     |
| Move: destination blocked or beyond one-territory range      | 5,073      |
| Ship: Fremen reinforcements outside Great Flat arrival range | 2,074      |
| Ship: stronghold would contain three factions                | 1,001      |
| Revive leader: insufficient spice                            | 609        |
| Battle plan: cards selected without a leader                 | 604        |
| Move: destination blocked or beyond two-territory range      | 488        |
| Move: stronghold would contain three factions                | 427        |
| Guild shipment: insufficient spice                           | 326        |
| Battle plan: does not comply with Voice                      | 296        |
| Battle plan: must use available leader or Cheap Hero         | 271        |
| Revive leader: revival cycle cannot begin yet                | 40         |
| Move: destination blocked or beyond three-territory range    | 24         |
| Choose battle: not an unresolved battle                      | 4          |
| **Total**                                                    | **31,388** |

Rejected proposals comprise 29.26% of attempted candidates, excluding the setup `start` action. Larger per-level rejection totals can reflect more attempted candidates, longer survival, and more turns, as well as less accurate proposals; these totals are not normalized measures of skill. Shipment affordability and movement eligibility are the largest candidates for a subsequent proposal-quality audit. No changes to those policies were made here.

## Evidence, validation, and limits

The full run recorded unchanged source hashes from beginning to end. Its combined SHA-256 over sorted `game/*.ts` hashes and the harness was `056590064d63efadef8f4e8747fd3d2eada1ab70393f1c3f03880ee9c46de3bc`. The engine hash was `06da5ee3f8735509965531fb766fd1c2689bb7011af7358e89a21c834ab7409b`; the bot hash was `a296de0689e7d602628acbded28c1d1254e54d87ac52c4d2b187dd35dd2d9d9d`.

After that run, a lint-only type guard was added to format string-valued action modes in rejection labels. No engine or bot files changed. The delivered harness hash is `ab89b804d7dfa291545940d775edc0ef3249d56279532ccdcc624166b9afbf01`. Replaying the first four seeds/shifts with that harness matched every recorded game field except elapsed time, including assignments, actions, rejections, turns, and winners. All game source hashes also matched. Total simulation work was 128 games: an initial four-game smoke check, the 120-game study, and a four-game replay.

Validation completed successfully:

```sh
./node_modules/.bin/oxfmt tools/ai-calibration.ts
./node_modules/.bin/oxlint tools/ai-calibration.ts
npm run typecheck
node --import tsx tools/ai-calibration.ts --games 4 --seed 20260906 --out /tmp/dune-ai-calibration-repeat.json
```

A Python comparison of the full run's first four rows and replay rows, removing only `elapsedMs`, passed. The main simulation itself is the complete-game validation; no package script was added.

Limits and next evidence needed:

- The 120 games comprise only **30 paired roster/deal blocks**, not 120 independent random deals. Seats within a game and shifts within a block are correlated. No independent-sample confidence interval or significance claim is justified by treating all 480 appearances as independent observations.
- Six cyclic faction rosters do not enumerate every possible faction subset, seat permutation, or opponent-difficulty combination. Balanced marginals reduce confounding without eliminating it.
- One master seed family and a modest sample cannot establish a stable win-rate estimate or exclude rare deadlocks. A later independent seed family and alternative roster/opponent schedules would be needed before claiming a strength ranking.
- Only currently supported basic base starts were measured. This provides no coverage claim for advanced rules, technology-token games, expansion factions/cards, unfinished faction-start gates, or manually injected subsystem fixtures.
- First-choice legality, decision latency by difficulty, alliance negotiation quality, and strategic correctness were not measured. The results establish observed completion and selected invariants for this sample, not full rules completeness or online multiplayer recovery.

## Paired shipment affordability study — seed 20260907

A later baseline after native-revival and Moritani-retention work, followed by the ordinary-shipment budget filter, used the same 120-game design with master seed20260907. Outputs are `/tmp/dune-ai-calibration-20260907.json` and `/tmp/dune-ai-calibration-20260907-budget.json`. Both captured unchanged source files during their runs.

| Measurement                                                      | Before filter | After filter |
| ---------------------------------------------------------------- | ------------- | ------------ |
| Completed games                                                  | 120/120       | 120/120      |
| Accepted actions                                                 | 73,398        | 73,398       |
| Rejected candidates                                              | 26,146        | 9,081        |
| Mean finishing turn                                              | 4.4167        | 4.4167       |
| Elapsed time                                                     | 138.739s      | 139.341s     |
| Deadlock / action limit / exception / checked invariant failures | 0/0/0/0       | 0/0/0/0      |

A row-by-row comparison matched every recorded field after removing only `elapsedMs`, `rejected`, `rejectionReasons` and `rejectedByLevel`. This verifies matching roster/deal assignments, outcomes, winners, phases, finishing turns and accepted-action counts; the harness does not record full accepted-action traces or final-state hashes, so this is not a claim that those unrecorded details were compared.

Filtering eliminated all16,735 ordinary insufficient-spice rejections. It also removed330 unaffordable candidates that previously reached the stronghold occupancy rejection before pricing. All remaining rejection-reason totals were identical. The65.27% reduction is in rejected proposals; wall-clock speed did not improve in these two runs and was not an isolated performance benchmark.

Wins remained Easy0, Medium39, Hard36, Brutal45, each from120 appearances. This independent seed family again does not establish Medium→Hard→Brutal ordering. No difficulty settings or strategic destination/amount preferences changed. The server still validates geometry, payment and powers; AI reads only its own projection. The filter handles ordinary reserve shipment, with Fremen free and Guild/ally/Karama total-price rounding. It does not remove speculative movement, Fremen-range or Guild-transport candidates.

Before fingerprint: `d3edd548f3a392f64da2e0a9abd9a8f4dcd361ade52a09c33127e2bdb3686905`.
After fingerprint: `037bb006aaea1c458926bc1c6752cd54383c71b338f887916efcc5f94e0f0b62`.

Reproduce the after run with:

```sh
node --import tsx tools/ai-calibration.ts --games 120 --seed 20260907 --out /tmp/dune-ai-calibration-20260907-budget.json
```

The full rules/client suite now passes951 tests and the persisted multiplayer suite45. Focused shipment tests cover all four profiles, projected aid, private balances, Guild and allied rates, Karama's recipient, free Fremen and the exact retained candidate subsequence. Advanced and expansion starts remain gated; this study does not validate them. Independent source review also identified a preexisting missing Guild-rate Karama cancellation window; shared pricing intentionally preserves the prior rate semantics while that separate rule remains unfinished.

## Automatic-response rerun — 2026-09-06, seed20260907

After automatic responses and private cancellation controls were integrated, the same balanced120-game Basic design completed120/120 with zero deadlocks, action-limit exits, exceptions or conservation failures. Raw output: `/tmp/dune-ai-calibration-20260907-auto.json`. Source fingerprint `79fca928bae9adf8f83ca98a6d0fd7741884c5f80bccb111ee1f04aa108b425a` remained unchanged throughout the run.

Accepted actions fell from73,398 to49,510:23,888 redundant response submissions removed (32.55%). Rejected candidates remained9,081. Every per-game field other than accepted-action count and elapsed time matched the preceding shipment-budget run, including winners, completed turn, seat assignment and rejection diagnostics. Mean completion remained4.4167 turns. Measured elapsed time was121,418ms versus139,341ms previously; these single local runs are not a controlled latency benchmark, and online play now deliberately uses server pacing.

Win counts including shared wins remained Easy0, Medium39, Hard36 and Brutal45, with120 appearances per level. This continues to show separation from Easy but does not establish a strict Medium < Hard < Brutal strength ladder. The experiment covers the enabled Basic configuration across2–6 players and all six base factions; it does not certify Advanced, expansion/module combinations or an entire real-time HTTP game.

## Automatic payment regression run (2026-09-06)

Seed 20260907, all120 Basic games, 2–6 seats and four profiles:120 completed, zero deadlocks/action limits/exceptions/invariant failures. Accepted actions47,965; rejected candidates9,081; mean completed turns4.4167. Easy/Medium/Hard/Brutal wins0/39/36/45 from120 appearances each. This does not establish a strict Medium→Hard strength ordering.

Compared with `/tmp/dune-ai-calibration-20260907-auto.json`, automatic payment removed1,545 accepted decisions and every other per-game field except elapsed time is unchanged. Result `/tmp/dune-ai-calibration-20260907-ambassadors.json`;124,248ms wall time (single local run, not a benchmark); fingerprint `c696ceef17f3a36bf7ac18649339cb4daefdf67eac532a392f9d866fdfaa646c`; no game-source file changed during the run. Expansion effects were tested in scenarios, not in these Basic games.

## Richese integration Basic regression checkpoint (2026-09-06)

After the Richese pipeline and shared ordinary-sale adapter changes, the same seed20260907 design completed **120/120 Basic games**, with zero deadlocks, action-limit exits, exceptions or checked invariant failures. There were **47,965 accepted actions and 9,081 rejected candidates**, with a mean finishing turn of4.4167. The rejected candidates are speculative proposals filtered by authoritative validation; they are not accepted illegal actions or a measurement of first-choice legality.

Every recorded per-game field matches `/tmp/dune-ai-calibration-20260907-ambassadors.json` after removing **only `elapsedMs`**. This includes all assignments, winners, finishing turns/phases, accepted counts, rejected counts and rejection categories. The harness does not record full action traces or final-state hashes, so those are not part of this comparison. Wins remain Easy0, Medium39, Hard36 and Brutal45 from120 appearances each; no new difficulty-ranking claim follows from this regression run.

The fingerprint across `game/*.ts` and the calibration harness is `c3fae32a60ddd788b0778780dfaf097f92707012ab7b540c4a39974d7e9632d5`; `sourceFilesChangedDuringRun` is false. Measured elapsed time was119,396ms, a single local run rather than a performance benchmark. This covers six base factions, Basic rules, 2–6 players and all four profiles. It does not exercise Richese or other expansion starts, Advanced rules, technology tokens, browser UI or persisted multiplayer.

```sh
node --import tsx tools/ai-calibration.ts --games 120 --seed 20260907 --out /tmp/dune-ai-calibration-20260907-richese.json > /tmp/dune-ai-calibration-richese.log 2>&1
```

The detailed field comparison is saved at `/tmp/dune-ai-calibration-20260907-richese-comparison.json` with an empty mismatch list. The new JSON retains individual source hashes and all twelve rejection-reason counts, unchanged from the prior checkpoint. Only this documentation checkpoint was edited during the calibration task; game/UI sources were held stable.
