# AI battle-candidate calibration

Measured 7 September 2026 local date after the battle-plan, Prescience and battle-choice candidate changes. **All 192 Basic games completed with zero rejected candidates**. Neither 96-game run recorded a deadlock, action-limit, exception, or checked invariant failure. The original seed exactly preserved all 96 accepted-action traces and final-state hashes from the mobility checkpoint while eliminating its 330 rejected candidates. The second seed eliminated 471 rejections and preserved 92 of 96 traces and final states.

These are bounded full-game results for the supported four-player Basic configuration. They do not prove universal candidate legality, expansion compliance, multiplayer recovery, online pacing, or calibrated Medium → Hard → Brutal strength. The authoritative engine and calibration harness were unchanged. No runtime, harness, room, server, automation or previous result file was modified by this calibration agent.

## Reproduce and inspect

```sh
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260909 --max-actions 6000 --out /tmp/dune-ai-battle-20260909.json
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260919 --max-actions 6000 --out /tmp/dune-ai-battle-20260919.json
```

Both commands exited 0 after their terminal handles (39753 and 77817) were explicitly polled to completion. Output logs are `/tmp/dune-ai-battle-20260909.log` and `/tmp/dune-ai-battle-20260919.log`. Each run's start and end source fingerprints match, and both runs used combined hash `780b972b6d318dcef91bac9689d4a0e73903fe21dac63013ec5590476ae4282d`.

| Run | JSON file | JSON SHA-256 | Elapsed |
| --- | --- | --- | ---: |
| Original seed | `/tmp/dune-ai-battle-20260909.json` | `05dd2a7b9bf02d3234166513995e0fa50701b90504009563d979aa732752d041` | 99.927 s |
| Second seed | `/tmp/dune-ai-battle-20260919.json` | `a4dd01a9e904bbbc6178c5bc1ff6848ec8ae4d377b33449f39b4d9de8685e16c` | 104.283 s |

The runs overlapped each other and root's separate regression suite, so elapsed time is not a controlled performance comparison. Their JSON files contain every seed/assignment, accepted trace, final-state hash, rejection category, outcome and start/end source hash. These local diagnostic files may later be removed; principal evidence is retained in this document.

| Source | SHA-256 at both measured boundaries |
| --- | --- |
| `game/engine.ts` | `f8ef7483bf38f257177bbd51176cde6b24a0f8912b328f6c6c1e740812c9e980` |
| `game/bots.ts` | `3a8f291e26c8e972ae0a9146336ae3a63e5caa749e3308dc2e57ba78c894206a` |
| `game/bot-battle-choices.ts` | `d33ce7cc2b9348e3372d2c88967430d2520b8ba63f380c058019f278a0ce196b` |
| `game/bot-mobility.ts` | `db0a545445f391b5805b7fc7b7a3222fef28c4c0ee5903ca0caa38e92d383eb5` |
| `game/bot-profiles.ts` | `b85b89286d50a8699b6e9a362d3b6978914781e29c9c98e66db7c0d84e6e7ac4` |
| `tools/ai-calibration-stone.ts` | `79d1a676b897a2964b4ea74ae9a250eb544164b2f391d6c52c6e6c4bf8a0ebc0` |

Only `game/bots.ts` and the newly added `game/bot-battle-choices.ts` differ within the hashed source set from the immediately preceding [mobility calibration](AI_MOBILITY_CALIBRATION_20260907.md). Its combined fingerprint was `65e0d7e1df4d308555e3b55f8427f455d2494283db74437a25aaea9e11f45e9f`. Both previous JSON hashes remain unchanged: original seed `815ca5cdc13197ef307c5411188884679fe081cede25b4d43179ba3a8099b09e`; second seed `782b749df1666e64ef8561e04ade60b086f316956d1946edb6471bce283f8255`.

## Design and information boundary

The unchanged design consists of 96 four-player Basic games per seed, six base factions in cyclic four-faction subsets, two faction directions, two replicates and four difficulty rotations per deal block. Every game has one Easy, Medium, Hard and Brutal player. Each difficulty appears 96 times per seed, with sixteen appearances per faction and physical circle and twenty-four per array seat. Expansions and technology tokens are off.

The harness uses real lobby/start actions and feeds only each seat's `viewGame` projection into `botActions`. It applies candidates through `applyAction`, catches only `RuleError`, and measures rejected fallbacks rather than bypassing validators. Deterministic shuffle and separate UUID streams are process-local offline instrumentation; they never enter the live server.

The second seed retains the earlier study's “held-out” label for continuity, but it was already measured and reported at the mobility checkpoint. This is not a newly unseen blind validation set. Future strategy tuning needs fresh seed sets.

Both new runs preserve every paired game's seed, code, seats, faction/difficulty assignments, physical circles, block, direction and replicate. Choices can alter subsequent random consumption, so identical initial deals do not guarantee identical later draws. Post-action checks cover force conservation at twenty per player, nonnegative safe integer resources and supported hand limits, including temporary exchange allowance. The 6,000-action ceiling and those bounded invariants remain unchanged.

## Completion and rejection comparison

| Metric | Mobility original | Battle original | Mobility second seed | Battle second seed |
| --- | ---: | ---: | ---: | ---: |
| Completed games | 96 / 96 | 96 / 96 | 96 / 96 | 96 / 96 |
| Deadlocks / action-limits / exceptions / invariant failures | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Accepted gameplay actions | 28,261 | 28,261 | 30,187 | 29,977 |
| Rejected candidates | 330 | 0 | 471 | 0 |
| Games with rejected candidates | 31 | 0 | 37 | 0 |
| First candidates rejected | 67 | 0 | 94 | 0 |
| Deepest accepted candidate rank | 25 | 1 | 21 | 1 |
| Mean finishing turn | 3.625 | 3.625 | 3.844 | 3.823 |
| Games reaching turn 10 | 4 | 4 | 7 | 6 |

Every accepted action in both new runs was the first proposed candidate. That does not imply every candidate that was never attempted would be legal. No new rejection category appeared, and the mobility/shipment categories stayed absent.

| Remaining category at mobility checkpoint | Mobility original | Battle original | Mobility second seed | Battle second seed |
| --- | ---: | ---: | ---: | ---: |
| Battle plan violates Voice | 180 | 0 | 186 | 0 |
| Available leader / Cheap Hero required | 76 | 0 | 97 | 0 |
| Battle cards selected without a leader | 59 | 0 | 185 | 0 |
| Selected battle is not unresolved | 9 | 0 | 0 | 0 |
| Prescience answer has no legal Voice-compliant completion | 6 | 0 | 0 | 0 |
| Same card in both battle slots | 0 | 0 | 3 | 0 |

Original accepted actions ranged from 75 to 755 per game; second-seed actions ranged from 76 to 768. Across both runs, 58,238 accepted actions were checked. Candidate legality is improved in these sampled games without weakening the unchanged engine validator.

## Trace and outcome changes

For seed 20260909, all 96 accepted-action trace hashes **and** final-state hashes exactly match the mobility checkpoint. Outcomes, finishing turns, accepted counts and winners consequently match too. The new filtering removed rejected attempts while preserving the observed accepted play in this seed.

For seed 20260919, 92 traces and final states match exactly. The four changed rows are:

| Game index | Previous actions | New actions | Previous turn | New turn | Winner effect |
| --- | ---: | ---: | ---: | ---: | --- |
| 3 | 829 | 652 | 10 | 8 | Seat 3 (Hard) changes to seat 0 (Brutal) |
| 15 | 364 | 363 | 4 | 4 | Same winning seat |
| 27 | 560 | 540 | 7 | 7 | Same winning seat |
| 67 | 395 | 383 | 4 | 4 | Same winning seat |

Thus the update cannot be described as universally preserving strategy. The comparison establishes exactly where sampled accepted traces diverged, not which internal heuristic caused each later outcome. A single shifted victory is not evidence of stronger Brutal play in general.

| Difficulty | Original wins, unchanged from mobility | Second-seed mobility wins | Second-seed battle wins | Second-seed battle fractional credit |
| --- | ---: | ---: | ---: | ---: |
| Easy | 1 | 1 | 1 | 1 |
| Medium | 29 | 35 | 35 | 34.5 |
| Hard | 29 | 32 | 31 | 31 |
| Brutal | 37 | 29 | 30 | 29.5 |

Each difficulty has 96 appearances per seed. The second seed still contains one shared Medium/Brutal victory, so its inclusive wins total 97 and fractional credits total 96. Original-seed outcomes are all single-player victories. Brutal leads the original seed, whereas Medium leads the second. This continues to contradict a claimed verified monotonic difficulty ordering.

Original replicate E/M/H/B wins are 1/13/14/20 and 0/16/15/17; second-seed replicate wins are 1/18/17/13 and 0/17/14/17, including the shared victory. Paired four-shift deal blocks are correlated. No independent-trial significance or strength-calibration claim is made.

## Follow-up boundaries

Preserve the successful authoritative validators and projection-only candidate design. Extend complete-game evidence to fresh seeds and the other supported player counts; validate Advanced/expansion combinations separately as their implementations finish. Retain meaningful interaction tests for leaderless plans, Voice, Prescience, advisors, allies, storm-separated battles and concealed No-Field information, since two seed sets cannot exhaust those states. This report does not change release gates or certify the full goal.

## Final regression after the worm-ride candidate correction

Root subsequently corrected the fallback destination filter used by Fremen worm rides: exclude the origin territory and apply public entry conditions before the candidate limit. The separate 120-game study motivated that change; its findings are outside this report's measured sample. Both unchanged 96-game harness commands were then rerun against a new frozen checkpoint, preserving all earlier outputs and the preceding sections.

```sh
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260909 --max-actions 6000 --out /tmp/dune-ai-battle-final-20260909.json
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260919 --max-actions 6000 --out /tmp/dune-ai-battle-final-20260919.json
```

Both final processes exited 0; handles 20442 and 58148 were explicitly polled to completion. Both source boundaries match combined fingerprint `e4821166f70a634c104015fb100c13940cddc36c55e76bf71708e8cdc60843c6`. Only `game/bots.ts` changed in the hashed source set relative to the first battle runs; its final hash is `7a3fe601260f8165f222dbc5352ab267e53a43b1800bcd53f0a52cfd9c29c53d`. Engine, harness, profiles, mobility helper and battle-choice helper hashes remain those recorded above.

| Final run | JSON SHA-256 | Elapsed | Completed | Accepted actions | Rejected candidates |
| --- | --- | ---: | ---: | ---: | ---: |
| `/tmp/dune-ai-battle-final-20260909.json` | `129b48053ab6b862a1869a9b8d9a23e25eeda8241753d7d483151817c32fae3a` | 96.177 s | 96 / 96 | 28,261 | 0 |
| `/tmp/dune-ai-battle-final-20260919.json` | `c717932642c86a5de5235f7b6daf2c7ceac878501366c39ed492e15f9454f4f5` | 97.765 s | 96 / 96 | 29,977 | 0 |

Corresponding logs are `/tmp/dune-ai-battle-final-20260909.log` and `/tmp/dune-ai-battle-final-20260919.log`. There were no deadlocks, action-limit outcomes, exceptions or checked invariant failures. **All 192 accepted-action trace hashes, final-state hashes and every non-timing row field exactly match the first battle calibration runs.** Thus the final correction preserved all sampled accepted play and the win tables above in these two seeds. It does not prove that other seeds are unaffected or independently exercise the worm-ride state that motivated the correction.

These are repeated regression runs of the same assigned games, not 192 additional independent observations of difficulty strength. All prior baseline, mobility and first battle outputs remain intact.
