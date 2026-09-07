# AI full-game verification after Fremen movement Karama

Measured 7 September 2026 local date. **Both 96-game Basic studies completed: 192 / 192 games, 56,766 accepted actions, zero rejected candidates, zero deadlocks, zero action-limit outcomes, zero exceptions and zero checked invariant failures.** The first run repeats master seed 20260909 against the prior battle-candidate checkpoint; the second uses fresh master seed 20260921.

This is bounded offline verification of the implemented four-player Basic game after adding the Fremen movement response and its AI handling. It does not certify complete published rules, Advanced or expansion games, other player counts at this new checkpoint, online pacing/recovery, or a monotonic difficulty ranking. The measured run did not modify runtime, tools, live rooms, database, server or automation.

## Commands and artifacts

```sh
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260909 --max-actions 6000 --out /tmp/dune-ai-fremen-movement-20260909.json
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260921 --max-actions 6000 --out /tmp/dune-ai-fremen-movement-20260921.json
```

The unchanged harness ran as two independent Node processes. Terminal handles **81122** and **2082** were explicitly polled to exit 0. Corresponding logs use the same basenames with `.log`. The local JSON files contain settings, per-game assignments and outcomes, accepted-action trace hashes, final-state hashes, rejected-candidate reasons, and starting/ending source fingerprints. These diagnostic files may later be removed; their principal results are recorded here.

| Master seed | JSON SHA-256                                                       |   Elapsed |
| ----------- | ------------------------------------------------------------------ | --------: |
| 20260909    | `2f9b049d31577f58f5204e8129f5e759c33561386aa4d241f8c5c93358f83e33` |  97.500 s |
| 20260921    | `08d435602e1b710acc144d501606f76678b8e1285d14888f704ce2ea541adb8e` | 100.455 s |

Processes overlapped and shared the development machine with other verification work, so these times are not controlled performance benchmarks.

## Source stability

Both runs reported `sourceFilesChangedDuringRun: false`. Their starting and ending combined fingerprints were identical:

`162d61e3798eb478e654e821df32d7a4d73958d07a2a5606bc7a749067f003a6`

The harness hashes every `game/*.ts` source plus itself. An independent immediate post-run comparison also found **zero changed files** against both starting snapshots. Thus no formatting or runtime change crossed either measured interval.

| Source                          | SHA-256 at both boundaries of both runs                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `game/engine.ts`                | `f859d2b2b57edfa73e7819f53e971c999a992a07b56023f374f726cac409cebc` |
| `game/bots.ts`                  | `bc671341912e834eba575f3f507ea4a889f5d3a004ae451c5b972cec1cff3fed` |
| `game/bot-mobility.ts`          | `6ab7813c2bc5492700c55ceea1a8c63436da81745e1e9b4a883b83274df98dc5` |
| `game/bot-battle-choices.ts`    | `d33ce7cc2b9348e3372d2c88967430d2520b8ba63f380c058019f278a0ce196b` |
| `tools/ai-calibration-stone.ts` | `79d1a676b897a2964b4ea74ae9a250eb544164b2f391d6c52c6e6c4bf8a0ebc0` |

The prior baseline `/tmp/dune-ai-battle-final-20260909.json` was read without modification. Its verified SHA-256 is `129b48053ab6b862a1869a9b8d9a23e25eeda8241753d7d483151817c32fae3a`; its recorded source fingerprint is `e4821166f70a634c104015fb100c13940cddc36c55e76bf71708e8cdc60843c6`. Between that checkpoint and this one, changed hashed sources were `game/engine.ts`, `game/bots.ts`, `game/bot-mobility.ts` and `game/reference.ts`. The battle-choice helper, difficulty profiles and harness were unchanged. This is a measured implementation checkpoint comparison, not a claim that every repository file outside one patch remained byte-identical.

## Assignment and information boundary

Each run uses the existing 96-game balanced design: four-player Basic tables, one Easy, Medium, Hard and Brutal player per table; six cyclic base-faction starts; both faction directions; two seed replicates; four difficulty shifts per deal block; rotated physical circles. Every difficulty appears 96 times, sixteen times with each base faction and twenty-four times in each array seat. Each base faction appears in 64 games, including Fremen. These are balanced marginals, not exhaustive faction/seat combinations.

The runner creates actual lobbies, assigns legal physical circles and invokes the normal start gate. No Advanced mode, expansion or technology tokens are injected. Bots receive only `botActions(viewGame(game, playerId))`; authoritative state is used for validating actions, counting outcomes and checking invariants, never as bot input. It follows production player/candidate ordering, catches only `RuleError` for fallback counting, and records other exceptions as failed rows.

The harness seeds its process-local shuffle stream with Mulberry32 and seeds UUID generation with a separate stream derived from `dealSeed ^ 0xa5a5a5a5`; both functions are restored in `finally`. Changing decisions can change later random consumption. The recorded hashes support actual trace comparisons for these artifacts; they do not prove deterministic behavior in production or across arbitrary environment changes. Unlike the older player-count harness, this specific harness seeds UUIDs and records trace/final-state hashes.

## Completion and candidate acceptance

| Metric                                                   | Prior checkpoint, seed 20260909 | Fremen checkpoint, seed 20260909 | Fresh seed 20260921 |
| -------------------------------------------------------- | ------------------------------: | -------------------------------: | ------------------: |
| Completed games                                          |                         96 / 96 |                          96 / 96 |             96 / 96 |
| Deadlock / action-limit / exception / invariant outcomes |                   0 / 0 / 0 / 0 |                    0 / 0 / 0 / 0 |       0 / 0 / 0 / 0 |
| Accepted actions                                         |                          28,261 |                           27,778 |              28,988 |
| Rejected candidates                                      |                               0 |                                0 |                   0 |
| Games with a rejection                                   |                               0 |                                0 |                   0 |
| First-candidate failures                                 |                               0 |                                0 |                   0 |
| Deepest accepted candidate rank                          |                               1 |                                1 |                   1 |
| Mean finishing turn                                      |                           3.625 |                            3.542 |               3.656 |
| Games reaching turn 10                                   |                               4 |                                3 |                   7 |

Accepted action counts ranged from 75 to 757 in the repeated-seed run and from 71 to 819 in the fresh-seed run, against a 6,000-action cap. Every attempted first candidate was accepted in both measured runs. All rejection-reason dictionaries were empty, so there were no recorded illegal Fremen replacement moves, unhandled response stalls or other candidate rejections in this sample.

The harness does not emit per-power event counts. Therefore these artifacts do not establish the exact number of Fremen movement cancellations, passes or replacement moves. Focused interaction coverage is separately recorded in `tests/fremen-movement-karama.test.ts`: nine named tests verify real-blocker versus automatic resolution, owner exclusion, cancellation custody, shorter replacement moves, Hajr, city/card ranges, two-group Ornithopter recovery, BG Worthless counter-cancellation, restored pending intent and all four AI profiles. Full-game completion and those focused tests provide different scopes of evidence.

After each accepted action, the harness checked physical force conservation at twenty per player, nonnegative safe integer reserves/tanks/forces/spice, and supported hand limits with the existing temporary hand-exchange allowance. These checks are not a complete proof of every rule, card, resource or multiplayer invariant.

## Paired comparison and descriptive strength

All 96 same-seed rows retain exactly the prior index, seed, roster block, shift, replicate, direction, room code, player count and seat assignments. **68 accepted-action trace hashes matched and 28 changed; 47 final-state hashes matched and 49 changed.** One game's winning seat changed, at row 91, from seat 0 to seat 3. Two games changed finishing turn. These observations show changes in accepted gameplay and persisted state; a reduction in accepted-action count by itself is not a measure of stronger strategy.

| Difficulty | Prior seed 20260909 wins | Current seed 20260909 wins | Fresh seed 20260921 wins |
| ---------- | -----------------------: | -------------------------: | -----------------------: |
| Easy       |                        1 |                          1 |                        0 |
| Medium     |                       29 |                         29 |                       35 |
| Hard       |                       29 |                         30 |                       42 |
| Brutal     |                       37 |                         36 |                       19 |

Each difficulty has 96 appearances per column; all victories in these runs were individual, so fractional win credits equal win counts. In the current same-seed replicates, E/M/H/B wins were 1/13/14/20 and 0/16/16/16. Fresh-seed replicates produced 0/15/22/11 and 0/20/20/8. Brutal led the repeated seed; Hard led the fresh seed. **No monotonic Medium → Hard → Brutal strength ordering is established.** Four shifts within a deal block are paired and correlated, so treating all results as independent trials would overstate precision.

The repeated seed verifies behavior against a prior checkpoint and is not a fresh strength sample. The additional seed broadens this bounded Basic study. Advanced games, expansions, other player counts at the new engine checkpoint and online recovery/pacing still require separate full-game evidence before the overall goal can be considered complete.

## Coordinator integration after the measured runs

After both runs completed, the coordinator updated only the Fremen topic's verification prose/evidence in `game/reference.ts` and the browser controls in `components/game-table.tsx` / `components/ornithopter-movement.tsx`. The authoritative engine, bot policy, movement helper, difficulty profiles and harness remained unchanged. Therefore the recorded combined game-directory fingerprint describes the measured checkpoint, not the later reference-only text update. No new full-game run is claimed for presentation edits.
