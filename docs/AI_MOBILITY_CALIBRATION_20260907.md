# AI mobility follow-up calibration

Measured 7 September 2026 local date with the unchanged `tools/ai-calibration-stone.ts` harness. **All 192 Basic games completed** across the original master seed and a separate held-out seed. Neither run recorded a deadlock, action-limit, exception, or checked invariant failure. The original seed produced **330 rejected fallback candidates**, down from **5,508** at the preceding checkpoint. Both new runs produced **zero movement or shipment rejection categories**.

This verifies the sampled candidate-generation improvement while retaining authoritative validators. It does not certify expansion games, every legal movement combination, all player counts, online recovery/pacing, or a monotonic AI difficulty ordering. No harness, runtime, live room, server, automation, or original result file was changed by this calibration agent.

## Reproduction and evidence

```sh
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260909 --max-actions 6000 --out /tmp/dune-ai-mobility-20260909.json
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260919 --max-actions 6000 --out /tmp/dune-ai-mobility-20260919.json
```

Both processes exited 0. Each reported unchanged source files between its measured start and end; both used combined fingerprint `65e0d7e1df4d308555e3b55f8427f455d2494283db74437a25aaea9e11f45e9f`. Root held the runtime stable for the measured interval. The processes ran independently and concurrently, so their wall-clock times are not a benchmark against the earlier single run.

| Run | JSON file | JSON SHA-256 | Elapsed |
| --- | --- | --- | ---: |
| Original seed | `/tmp/dune-ai-mobility-20260909.json` | `815ca5cdc13197ef307c5411188884679fe081cede25b4d43179ba3a8099b09e` | 96.151 s |
| Held-out seed | `/tmp/dune-ai-mobility-20260919.json` | `782b749df1666e64ef8561e04ade60b086f316956d1946edb6471bce283f8255` | 101.460 s |

Logs are the corresponding `/tmp/dune-ai-mobility-20260909.log` and `/tmp/dune-ai-mobility-20260919.log`. Terminal handles were 68826 and 32075; both were explicitly polled to successful completion. JSON files contain individual assignments, per-game outcomes, rejection reasons, trace hashes, final-state hashes, and both boundary source fingerprints. They are local diagnostic artifacts and may later be removed; the principal findings are recorded here.

| Source | SHA-256 in both new runs |
| --- | --- |
| `game/engine.ts` | `f8ef7483bf38f257177bbd51176cde6b24a0f8912b328f6c6c1e740812c9e980` |
| `game/bots.ts` | `b69b89909bbd727c8e34ea046e4ab4ab24fa6f3abadde7f9fae240b63ea019c4` |
| `game/bot-mobility.ts` | `db0a545445f391b5805b7fc7b7a3222fef28c4c0ee5903ca0caa38e92d383eb5` |
| `game/bot-profiles.ts` | `b85b89286d50a8699b6e9a362d3b6978914781e29c9c98e66db7c0d84e6e7ac4` |
| `tools/ai-calibration-stone.ts` | `79d1a676b897a2964b4ea74ae9a250eb544164b2f391d6c52c6e6c4bf8a0ebc0` |

The baseline is [AI_CALIBRATION_20260906.md](AI_CALIBRATION_20260906.md) and `/tmp/dune-ai-calibration-stone-20260909.json`. The existing baseline JSON was re-read and its hash verified as `2b82625a8e832874b3522a83e4c6a7fb723719ade0c0cb1e189f418240958aaa`; it was not overwritten. Engine, difficulty-profile and harness hashes match that baseline exactly. Changed/added hashed files are `game/bots.ts`, the new `game/bot-mobility.ts`, `game/reference.ts`, and `game/richese-cards.ts`. Thus the follow-up uses the same validator and measurement design, but it is not an assertion that every repository byte outside the intended mobility implementation is unchanged.

## Design and measurement limits

Each run retains the earlier balanced 96-game design: four-player Basic tables, no expansions or technology tokens, all six base factions distributed across cyclic four-faction subsets, two faction directions, two replicates and four difficulty rotations per deal block. Every difficulty appears 96 times per run: sixteen times with each faction, twenty-four times in each array seat, and sixteen times at each physical circle. This balances marginals without exhaustively crossing every faction subset and seating order.

Bots receive only `botActions(viewGame(game, playerId))`. The harness applies actual lobby/start actions and actual server-engine validators. Its deterministic shuffle and separate UUID streams are process-local instrumentation. It catches `RuleError` and tries subsequent candidates in production ordering; it records errors instead of suppressing their counts. It does not bypass a failing action or manufacture resources.

All original-seed game rows retain the exact baseline seed, room code, seat IDs, faction/difficulty assignment, physical circles, block, direction and replicate. Different accepted actions can cause subsequent state and random draws to diverge; the pairing does not hold every later deal fixed. No unchanged accepted trace is claimed: all 96 original-seed trace hashes differ from baseline.

Checked invariants after every accepted gameplay action are physical force conservation at twenty per player, nonnegative safe integer resources, and supported ordinary hand limits including temporary exchange allowance. These are useful bounded checks, not a proof of complete rules compliance. The action ceiling remains 6,000 per game.

## Completion and candidate acceptance

| Metric | Baseline 20260909 | Mobility 20260909 | Held-out 20260919 |
| --- | ---: | ---: | ---: |
| Completed games | 96 / 96 | 96 / 96 | 96 / 96 |
| Deadlock / action-limit / exception / invariant outcomes | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Accepted actions | 28,379 | 28,261 | 30,187 |
| Rejected fallback candidates | 5,508 | 330 | 471 |
| Games with any rejected candidate | 96 | 31 | 37 |
| First candidates rejected | 911 | 67 | 94 |
| First-candidate rejection rate per accepted step | 3.210% | 0.237% | 0.311% |
| Deepest accepted candidate rank | 46 | 25 | 21 |
| Mean finishing turn | 3.635 | 3.625 | 3.844 |
| Games reaching turn 10 | 3 | 4 | 7 |

The original-seed reduction is 5,178 rejected candidates, or **94.01%**. The seven mobility/shipment categories previously accounted for 5,185 rejections and now account for zero in both seeds. Other categories changed slightly as accepted play changed; subtracting mobility errors from the old total alone would not reproduce the new total. Original-seed accepted actions ranged from 75 to 755; held-out actions ranged from 76 to 829.

| Rejection category | Baseline | Mobility original | Held-out |
| --- | ---: | ---: | ---: |
| Movement blocked / beyond range 1 | 3,016 | 0 | 0 |
| Fremen reinforcement outside Great Flat entry range | 1,285 | 0 | 0 |
| Movement blocked / beyond range 2 | 318 | 0 | 0 |
| Unaffordable Guild transport | 243 | 0 | 0 |
| Shipment creates a third faction in a stronghold | 190 | 0 | 0 |
| Movement creates a third faction in a stronghold | 121 | 0 | 0 |
| Movement blocked / beyond range 3 | 12 | 0 | 0 |
| Battle plan violates Voice | 176 | 180 | 186 |
| Available leader / Cheap Hero required | 73 | 76 | 97 |
| Battle cards selected without a leader | 59 | 59 | 185 |
| Selected battle is not unresolved | 9 | 9 | 0 |
| Prescience answer has no legal Voice-compliant completion | 6 | 6 | 0 |
| Same card in both battle slots | 0 | 0 | 3 |

No absence in this table certifies that a category can never recur. In particular, battle-plan completion, leader availability and slot uniqueness remain concrete follow-up targets; validators must continue rejecting illegal candidates until the generators improve.

## Descriptive strategy outcomes

| Difficulty | Baseline wins | Mobility original wins | Held-out wins including shared | Held-out fractional win credit |
| --- | ---: | ---: | ---: | ---: |
| Easy | 1 | 1 | 1 | 1 |
| Medium | 30 | 29 | 35 | 34.5 |
| Hard | 28 | 29 | 32 | 32 |
| Brutal | 37 | 37 | 29 | 28.5 |

The original follow-up had only single-player winners. The held-out sample included one shared Medium/Brutal victory, so its difficulty win counts total 97 while fractional credits total 96. Original-seed winning seat changed in three paired rows (indices 29, 73 and 93); finishing turn changed in four. This is evidence that the filters affected accepted play and not merely diagnostic counts. It does not identify an improvement in strategic strength.

| Difficulty | Original first rejected / tested | Held-out first rejected / tested |
| --- | ---: | ---: |
| Easy | 10 / 6,308 | 13 / 6,777 |
| Medium | 21 / 7,627 | 26 / 8,306 |
| Hard | 10 / 7,268 | 27 / 7,610 |
| Brutal | 26 / 7,058 | 28 / 7,494 |

Across the original run's two 48-game replicates, E/M/H/B wins were 1/13/14/20 and 0/16/15/17. Across held-out replicates they were 1/18/18/12 and 0/17/14/17, counting shared victories. Brutal led the original seed while Medium led the held-out seed. These observations directly argue against declaring a verified Medium → Hard → Brutal ordering. Paired deal blocks are correlated; simple independent-trial confidence claims would overstate precision.

Original-seed faction win counts changed from Atreides 15, Harkonnen 25, Emperor 12, Fremen 9, Guild 22, Bene Gesserit 13 to 16, 25, 12, 9, 24, 10 respectively. The held-out counts were 16, 29, 7, 12, 24, 9 including shared wins. These are descriptive outcomes of two bounded seed sets, not faction balance estimates or proof that paid transport made a faction stronger.

## Next evidence needed

Keep the candidate-filter improvement separate from difficulty tuning. The new held-out seed validates completion and the observed absence of the targeted mobility errors, while exposing remaining battle candidate rejection costs. Any subsequent strategy change should retain independent seed sets, report shared wins consistently, and add the other supported player counts. Advanced games, expansion factions/modules, human multiplayer recovery and paced server behavior still require their own complete-game evidence.
