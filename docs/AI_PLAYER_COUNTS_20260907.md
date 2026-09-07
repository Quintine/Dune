# Basic AI completion across two through six players

**Final same-seed verification: 120 / 120 games completed, 51,547 accepted actions, zero rejected candidates and zero checked failure outcomes.** Each player count from two through six completed all 24 games. The final verification follows the original measured checkpoint below and preserves its single rejection as historical evidence.

## Initial measurement before the worm-ride correction

Measured 7 September 2026 local date after the battle-plan candidate fix. **All 120 Basic games completed: 24 games at each player count from two through six.** The run recorded no deadlock, action-limit, exception, or checked invariant failure. Of 51,547 accepted actions, one encountered a rejected fallback candidate: a Fremen worm ride selected its origin territory. All recorded battle-plan, prescience, ordinary movement and shipment rejection categories were zero.

This is bounded offline completion evidence for the implemented Basic game. It does not certify complete published rules, Advanced games, expansion combinations, online pacing/reconnection, or a monotonic AI difficulty ranking. The single rejected worm-ride candidate remains part of this measured result even if a later change fixes it.

## Reproduce and inspect

```sh
node --import tsx tools/ai-calibration.ts --games 120 --seed 20260920 --max-actions 6000 --out /tmp/dune-ai-battle-player-counts.json
```

The unchanged harness ran on Node v26.4.0 and exited 0 after **178.243 seconds**. Terminal session 9030 was explicitly polled to completion. The log is `/tmp/dune-ai-battle-player-counts.log`; detailed rows and aggregate statistics are in `/tmp/dune-ai-battle-player-counts.json`. JSON SHA-256: `443a4bca7eceb4db30fdcc07482c72a4e0ce149b3fb3af40bee6fef72643ca22`. These local diagnostic files may later be removed; the principal evidence is preserved here.

The harness reported `sourceFilesChangedDuringRun: false`. Its combined starting fingerprint was `8f592eefca9c97f263cca1ed2798477c06ac0cc496f11731f3e1a385139bb449`; the ending fingerprint matched. An independent immediate post-run hash comparison also found **zero changes** across every recorded `game/*.ts` file and the harness. The root held the runtime stable during this measured interval. This audit changed only its developer documentation, not runtime, harness, live rooms, server or automation.

| Source                    | SHA-256 at the measured checkpoint                                 |
| ------------------------- | ------------------------------------------------------------------ |
| `game/engine.ts`          | `f8ef7483bf38f257177bbd51176cde6b24a0f8912b328f6c6c1e740812c9e980` |
| `game/bots.ts`            | `3a8f291e26c8e972ae0a9146336ae3a63e5caa749e3308dc2e57ba78c894206a` |
| `game/bot-mobility.ts`    | `db0a545445f391b5805b7fc7b7a3222fef28c4c0ee5903ca0caa38e92d383eb5` |
| `game/bot-profiles.ts`    | `b85b89286d50a8699b6e9a362d3b6978914781e29c9c98e66db7c0d84e6e7ac4` |
| `tools/ai-calibration.ts` | `ab89b804d7dfa291545940d775edc0ef3249d56279532ccdcc624166b9afbf01` |

## Design and information boundary

For each player count, six cyclic base-faction roster blocks run four difficulty shifts. Faction index is `(block + seat) % 6`; difficulty index is `(seat + shift) % 4`. Each difficulty appears 120 times overall, and each base faction appears 80 times. Per player count, each difficulty has 12, 18, 24, 30 or 36 appearances respectively. Counts below four omit some difficulty levels in a game; counts above four repeat some levels. This balances the stated marginals without exhaustively crossing rosters, opponents or physical seating circles.

Every game uses actual `createGame`, `joinGame` and `start` operations. The harness sets lobby bot difficulty/readiness, then passes each bot only `viewGame(game, playerId)`. It follows production player/candidate ordering and tries the next candidate only when the authoritative engine throws `RuleError`; other exceptions become failed rows. The harness does not weaken validators, manufacture gameplay resources or bypass the supported start gate. All games use Basic rules, no expansions and no technology tokens.

Shuffle randomness uses a process-local Mulberry32 replacement for `crypto.getRandomValues`; the four shifts reset the same roster-block seed:

```text
(20260920 + imul(playerCount, 0x9e3779b9) + imul(block, 0x85ebca6b)) >>> 0
```

The harness restores the original function in `finally`. **It does not seed `crypto.randomUUID`**, record accepted-action hashes or save final-state hashes. Therefore this result makes no deterministic UUID, complete trace or byte-identical replay claim. Different choices can also change subsequent shuffle consumption. The newer four-player harness in [AI_MOBILITY_CALIBRATION_20260907.md](AI_MOBILITY_CALIBRATION_20260907.md) has different instrumentation and assignment design; its result is not pooled here as a homogeneous trial sample.

## Completion and remaining rejection

| Players | Completed | Accepted actions | Rejected candidates | Mean finishing turn | Games reaching turn 10 |
| ------: | --------: | ---------------: | ------------------: | ------------------: | ---------------------: |
|       2 |   24 / 24 |            4,168 |                   0 |               5.208 |                      3 |
|       3 |   24 / 24 |            5,296 |                   0 |               3.958 |                      1 |
|       4 |   24 / 24 |            7,011 |                   0 |               3.625 |                      3 |
|       5 |   24 / 24 |           14,297 |                   1 |               5.417 |                      4 |
|       6 |   24 / 24 |           20,775 |                   0 |               6.250 |                      8 |
|   Total | 120 / 120 |           51,547 |                   1 |               4.892 |                     19 |

Every player-count group had zero deadlock, action-limit, exception and invariant outcomes. Accepted action counts ranged from 47 to 1,489 per game against a 6,000-action cap. Exactly one game encountered any rejection; the harness does not record first-candidate rank, so this report does not infer a first-candidate failure rate.

The sole rejection was `decision: Choose another destination territory.` It occurred in row **84**, code `C1b6miae`, deal seed `2853038102`, roster block 3, difficulty shift 0, five players. The row completed on turn 10, phase 8, with 929 accepted actions. Seats were Fremen/Easy, Guild/Medium, Bene Gesserit/Hard, Atreides/Brutal and Harkonnen/Easy. Guild/Medium won.

Source inspection identifies this exact error at the `wormRide` origin/destination check in `game/engine.ts` (line 9053 at this checkpoint). It concerns riding a worm to another territory, not the separate `wormPlacement` action. The row records the action type and Easy difficulty, but not a complete rejected action snapshot. Fremen is inferred from the uniquely matching decision branch and the roster. This exposed the need for a compact regression and measured rerun, documented below; the original run retains the rejection.

## Checks and strategy limits

After every accepted action, the harness checked that each player's reserves + tanks + on-board physical forces equaled 20; forces, reserves, tanks and spice were nonnegative safe integers; and hand size respected the base faction limit (8 for Harkonnen, 4 otherwise) with the existing temporary hand-exchange allowance. These checks do not cover every rules invariant or multiplayer failure mode.

| Difficulty | Appearances | Wins including shared | Fractional win credit |
| ---------- | ----------: | --------------------: | --------------------: |
| Easy       |         120 |                     4 |                     4 |
| Medium     |         120 |                    44 |                  43.5 |
| Hard       |         120 |                    37 |                    37 |
| Brutal     |         120 |                    36 |                  35.5 |

One four-player game had a shared Medium/Brutal victory, so wins including shared total 121 while fractional credits total 120. These are descriptive outcomes across different table sizes and repeated difficulty seats. Medium led this sample; **no verified Medium → Hard → Brutal strength ordering follows**. Roster shifts are paired and correlated, and not every game contains one instance of each difficulty. Future strength studies need independent seed sets, appropriate paired comparisons and separately verified Advanced/expansion coverage.

## Final verification after the worm-ride correction

Root changed only candidate generation: before limiting ranked worm-ride destinations, it excludes the worm's origin territory and checks public destination entry restrictions. It does not impose ordinary ground range or the free Fremen reserve reinforcement radius on worm rides, and the authoritative engine remains unchanged.

Independent `tests/bot-worm-ride.test.ts` contains three **worm-ride** regressions. All three named tests passed across the four difficulties, including Basic/Advanced destination restrictions, long-distance rides, origin exclusion, allied/occupied strongholds, storm sectors, multi-sector source selection and preservation of unavoidable elite tokens. The test passed every generated candidate through `applyAction`. Targeted lint and TypeScript checks passed.

The unchanged harness then reran the same 120 assignments and seed with a separate output:

```sh
node --import tsx tools/ai-calibration.ts --games 120 --seed 20260920 --max-actions 6000 --out /tmp/dune-ai-battle-player-counts-final.json
```

Terminal session **37140** was explicitly polled to exit 0. Elapsed time: **178.608 seconds**. Log: `/tmp/dune-ai-battle-player-counts-final.log`. JSON SHA-256: `502d3b1198dec90d3d77caa024d2786dbc897f56ecf97b287b98cf5d08e53590`. The original JSON was preserved and its hash rechecked unchanged.

The final run again reported `sourceFilesChangedDuringRun: false`; an immediate independent hash check found zero changes. Combined final-checkpoint source fingerprint: `c9c1172664ef41ecc90447b5d80a4610982f08083df133a85854d5fd8bfa57b2`. Between the original and final measurements, the only changed hashed source was `game/bots.ts`, now SHA-256 `7a3fe601260f8165f222dbc5352ab267e53a43b1800bcd53f0a52cfd9c29c53d`. Engine, mobility helper, difficulty profiles and harness hashes remained as listed above.

| Players | Final completed | Accepted actions | Original rejections | Final rejections |
| ------: | --------------: | ---------------: | ------------------: | ---------------: |
|       2 |         24 / 24 |            4,168 |                   0 |                0 |
|       3 |         24 / 24 |            5,296 |                   0 |                0 |
|       4 |         24 / 24 |            7,011 |                   0 |                0 |
|       5 |         24 / 24 |           14,297 |                   1 |                0 |
|       6 |         24 / 24 |           20,775 |                   0 |                0 |
|   Total |       120 / 120 |           51,547 |                   1 |                0 |

Every count again had zero deadlock, action-limit, exception and checked invariant outcomes. All final rejection-reason dictionaries were empty. The final row 84 completed with the same 929 accepted actions and Guild winner; its rejected count, per-level rejection count and reason dictionary changed from one rejection to zero.

An explicit comparison of all 120 recorded rows found that **every non-timing field matched except those three rejection fields in row 84**. Finishing turns, outcomes, assignments, accepted-action counts and winner IDs therefore matched in the recorded evidence. This harness does not save complete action traces or deterministic UUID streams, so that comparison does not establish identical internal histories or final-state bytes. Difficulty win counts and their limitations remain exactly as stated above; the same-seed rerun is verification of the candidate correction, not an independent strength sample.
