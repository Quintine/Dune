# Basic AI full-game verification after staged setup

Measured 7 September 2026 local date. **Both batches completed: 192 / 192 games, 59,380 accepted actions, zero rejected candidates, zero deadlocks, zero action-limit outcomes, zero exceptions, and zero checked invariant failures.** This study uses the unchanged offline `tools/ai-calibration-stone.ts` harness against the staged setup implementation: Bene Gesserit prediction before private card deals, traitor selection before starting forces, and starting Treachery Cards after force placement. Automatic stages require no player acknowledgment.

The repeated master seed is 20260909; the fresh master seed is 20260922. Results below describe bounded four-player Basic verification, not certification of all published rules, Advanced games, expansions, other player counts, or online recovery and pacing.

## Commands and artifacts

```sh
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260909 --max-actions 6000 --out /tmp/dune-ai-staged-setup-20260909.json
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260922 --max-actions 6000 --out /tmp/dune-ai-staged-setup-20260922.json
```

Terminal sessions **23465** and **76047** were explicitly polled to exit 0. Logs use the JSON basenames with `.log`. The JSON artifacts contain settings, per-game rosters and outcomes, accepted-action trace hashes, final-state hashes, rejection reasons, and both source snapshots. These temporary artifacts may later be removed; the principal evidence is preserved here.

| Master seed | JSON SHA-256                                                       |   Elapsed |
| ----------- | ------------------------------------------------------------------ | --------: |
| 20260909    | `e0b30ca78d86de4c5cc522e48847f7f93b2a1806c0e539c2ba72bd255155ddc5` |  96.824 s |
| 20260922    | `03f5c7705ecb8c493c6ef1ee95663bea9a0587848b9514c08bc49ce59a0a34b0` | 110.307 s |

The runner creates real Basic lobbies, assigns physical circles through legal lobby actions, and invokes the normal start gate. It supplies only each player's projected view to `botActions`. It follows production player and candidate ordering, records caught `RuleError` rejections, and marks other exceptions as failed rows. It does not modify live rooms, databases, servers, runtime, or tools.

Each batch uses the existing balanced 96-game design: four players, one of each difficulty, six cyclic base-faction starts, both faction directions, two seed replicates, and four difficulty shifts per deal block. Every difficulty appears 96 times, sixteen times with each base faction and twenty-four times in each array seat. Every base faction appears in 64 games. These are balanced marginals, not exhaustive faction and seat combinations.

The harness seeds its process-local shuffle stream and a separate UUID stream, restoring both in `finally`. It records accepted-action trace hashes and final-state hashes. Changes in decisions can change later random consumption; recorded trace comparisons are specific to these artifacts and do not prove production determinism. The two processes overlap on a development machine, so elapsed times are not controlled performance benchmarks.

## Historical comparison boundary

The prior artifact `/tmp/dune-ai-fremen-movement-20260909.json` and its evidence document remain unchanged. It completed 96 games with 27,778 accepted actions and zero rejected candidates, but used the previous, incorrectly ordered setup. Those observations remain historical evidence of that implementation's behavior; they do not establish correct setup ordering. The new staged flow changes both visible information and action order, so identical master seeds do not imply identical gameplay or provide a clean estimate of a strategy-strength change.

After every accepted action, the harness checks force conservation at twenty per player, nonnegative safe integer reserves/tanks/forces/spice, and supported hand limits with the temporary hand-exchange allowance. It does not check every rule or resource invariant. It also does not emit per-stage event counts or verify hidden-information ordering directly: focused staged setup tests provide that separate evidence. Full-game completion establishes that the projected AI interface can progress through the new stages and the ensuing sampled Basic games.

## Source stability

Both runs reported `sourceFilesChangedDuringRun: false`. All starting and ending source fingerprints agreed:

`0741fcea041f87294c5a3dfc96f6b11fd65ca92832f263bb048a05b419f115ac`

The harness fingerprints every `game/*.ts` file and itself. An immediate independent post-run comparison found zero changed files against either starting snapshot. No formatting or runtime edits crossed the measured intervals. Subsequent coordinator edits are outside this measurement.

| Source                          | SHA-256 at both boundaries of both runs                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `game/engine.ts`                | `b858f1eddecb2bacb0bcc3d7c6acfd0c5961f1e0ad84e53ab00927c61d0290f1` |
| `game/bots.ts`                  | `0797f9e2689f3a8f3a8fdb73d15ac83e08e4de0892d63e9237dbeebfcbc4e25b` |
| `game/bot-mobility.ts`          | `6ab7813c2bc5492700c55ceea1a8c63436da81745e1e9b4a883b83274df98dc5` |
| `game/bot-battle-choices.ts`    | `d33ce7cc2b9348e3372d2c88967430d2520b8ba63f380c058019f278a0ce196b` |
| `tools/ai-calibration-stone.ts` | `79d1a676b897a2964b4ea74ae9a250eb544164b2f391d6c52c6e6c4bf8a0ebc0` |

The preserved historical baseline's SHA-256 is `2f9b049d31577f58f5204e8129f5e759c33561386aa4d241f8c5c93358f83e33`; its combined source fingerprint is `162d61e3798eb478e654e821df32d7a4d73958d07a2a5606bc7a749067f003a6`. Changed hashed files between that checkpoint and this one are `game/engine.ts`, `game/bots.ts`, and `game/reference.ts`. The harness, movement and battle-choice helpers, and difficulty profiles are unchanged. This identifies the measured checkpoint difference without claiming that every other repository file was held constant.

## Completion and candidate acceptance

| Metric                                                   | Historical setup, seed 20260909 | Staged setup, seed 20260909 | Fresh seed 20260922 |
| -------------------------------------------------------- | ------------------------------: | --------------------------: | ------------------: |
| Completed games                                          |                         96 / 96 |                     96 / 96 |             96 / 96 |
| Deadlock / action-limit / exception / invariant outcomes |                   0 / 0 / 0 / 0 |               0 / 0 / 0 / 0 |       0 / 0 / 0 / 0 |
| Accepted actions                                         |                          27,778 |                      27,778 |              31,602 |
| Rejected candidates                                      |                               0 |                           0 |                   0 |
| Games with any rejection                                 |                               0 |                           0 |                   0 |
| First-candidate failures                                 |                               0 |                           0 |                   0 |
| Deepest accepted candidate rank                          |                               1 |                           1 |                   1 |
| Mean finishing turn                                      |                           3.542 |                       3.542 |               3.979 |
| Games reaching turn 10                                   |                               3 |                           3 |                   4 |
| Per-game accepted action range                           |                          75–757 |                      75–757 |              73–803 |

Every attempted first candidate was accepted in both new runs; all rejection-reason dictionaries and failed-row lists were empty. No sampled setup or midgame failure was masked by candidate fallback. The 6,000-action cap was never approached. The harness's accepted-action totals count bot actions after the start action; lobby circle assignments and start are outside those totals. Its checks do not enumerate every unused alternative candidate returned by a bot.

## Paired gameplay and descriptive difficulty results

All 96 repeated-seed rows retain the exact historical assignment fields: index, deal seed, roster block, shift, replicate, direction, code, player count, and seat assignments. Eight accepted-action trace hashes match and 88 differ. All 96 final-state hashes differ. Winning seat and finishing turn match in all 96 rows. Thus identical aggregate totals do not mean unchanged action order or persisted state. Hash differences alone do not isolate which setup operation changed; stored state and log changes also affect final-state hashes.

| Difficulty | Historical seed 20260909 wins | Staged seed 20260909 wins | Fresh seed 20260922 wins |
| ---------- | ----------------------------: | ------------------------: | -----------------------: |
| Easy       |                             1 |                         1 |                        5 |
| Medium     |                            29 |                        29 |                       25 |
| Hard       |                            30 |                        30 |                       32 |
| Brutal     |                            36 |                        36 |                       34 |

Every difficulty has 96 appearances per column. Every victory is individual, so fractional win credits equal wins. Repeated-seed replicate E/M/H/B counts are 1/13/14/20 and 0/16/16/16. Fresh-seed replicate counts are 1/13/17/17 and 4/12/15/17. Brutal has the largest aggregate in these two batches, but the differences and replicate ties do not establish a reliable monotonic strength ranking. The preceding fresh-seed study had Hard ahead of Brutal; that historical result remains unchanged. The four difficulty shifts per deal block are correlated, so treating all games as independent trials would overstate precision.

The repeated seed is regression evidence; the fresh seed broadens the sampled Basic games. Neither these outcomes nor clean candidate acceptance establishes complete rule compliance or stronger strategic play. Advanced, expansion, other player-count, and online evidence remain separate requirements.
