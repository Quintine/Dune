# AI calibration at the Stone Burner checkpoint

Measured 6 September 2026 with `tools/ai-calibration-stone.ts`. **All 96 Basic games completed**, with no deadlock, action-limit, exception, or checked invariant failure. Easy won 1 game, Medium 30, Hard 28, and Brutal 37. Each difficulty appeared exactly 96 times. This supports Easy being substantially weaker in this configuration; it does **not** establish a reliable Medium → Hard → Brutal strength ordering.

This is a bounded offline study of the implemented Basic game. It does not certify the complete published rules, expansion play, online pacing/recovery, or performance against humans. Stone Burner and the other Richese cards are absent from these Basic games; the filename identifies the development checkpoint. No production engine, bot policy, resource allocation, server, live room, or automation was changed for the study. The original 120-game harness remains separate.

## Reproduce and inspect

```sh
node --import tsx tools/ai-calibration-stone.ts --games 96 --seed 20260909 --max-actions 6000 --out /tmp/dune-ai-calibration-stone-20260909.json
```

Node v26.4.0; terminal exit 0; elapsed **71.085 seconds**. Full JSON: `/tmp/dune-ai-calibration-stone-20260909.json`; captured output: `/tmp/dune-ai-calibration-stone-20260909.log`. These local diagnostic files may be removed, so the principal findings are recorded here. The JSON includes every assignment, seed, outcome, rejection reason, accepted-action trace hash, final-state hash, and start/end source hashes. Its SHA-256 was `2b82625a8e832874b3522a83e4c6a7fb723719ade0c0cb1e189f418240958aaa`.

The harness hashes every `game/*.ts` file and itself. **No hashed file changed during the measured run.** Start and end combined fingerprint: `7fd1df9057566806a63d2186e80e446ebe832f5e90d21d16a3dbec47e5be7569`.

| Source                          | SHA-256 at both measured boundaries                                |
| ------------------------------- | ------------------------------------------------------------------ |
| `game/engine.ts`                | `f8ef7483bf38f257177bbd51176cde6b24a0f8912b328f6c6c1e740812c9e980` |
| `game/bots.ts`                  | `a71c606840062e6d68b8a5aa25005f9bf5c9f54a72131d7efc52f1fb6fe29821` |
| `game/bot-profiles.ts`          | `b85b89286d50a8699b6e9a362d3b6978914781e29c9c98e66db7c0d84e6e7ac4` |
| `tools/ai-calibration-stone.ts` | `79d1a676b897a2964b4ea74ae9a250eb544164b2f391d6c52c6e6c4bf8a0ebc0` |

## Balanced assignment and information boundary

- Four players per table: one Easy, Medium, Hard, and Brutal. Basic rules, no expansions, technology tokens disabled, six base factions only.
- Twenty-four paired deal blocks: two seed replicates × six cyclic faction starts × two faction directions. Each block runs four difficulty shifts, giving 96 games and 384 player appearances.
- For faction start `b`, seat `s`, direction `q` in `{1, -1}`, and difficulty shift `d`: faction index is `(b + q*s + 6) % 6`; difficulty index is `(s + d) % 4`; physical circle is `(b + s) % 6 + 1`.
- The harness uses actual `createGame`, `joinGame`, lobby `seatPosition`, and `start` operations. Spare physical circles permit assignments without overwriting occupied circles. Difficulty/readiness are configured before starting; forces, spice, hands, and faction abilities receive no difficulty-dependent bonuses.
- Each difficulty appears 16 times with each faction, 24 times in each array seat, and 16 times at each physical circle. Each faction and each circle have 64 total appearances; each array seat has 96. These are balanced marginals, not an exhaustive crossing of faction and circle. The design samples six cyclic four-faction subsets in both directions, not every subset or seat permutation.
- Each four-shift block resets its seeded shuffle stream and uses identical room/seat identities. Bot decisions receive only `botActions(viewGame(game, playerId))`. Authoritative state is used for applying actions, collecting outcomes, and checking invariants, never as bot input. Different choices can consume subsequent random draws differently; paired games do not promise the same draw at each later event.

The unsigned 32-bit deal seed is:

```text
(20260909 + imul(4, 0x9e3779b9) + imul(b, 0x85ebca6b)
 + imul(replicate, 0xc2b2ae35) + (q === -1 ? 0x27d4eb2f : 0)) >>> 0
```

The CLI replaces `crypto.getRandomValues` with Mulberry32 and `crypto.randomUUID` with a separate deterministic stream seeded by `dealSeed ^ 0xa5a5a5a5`, restoring both in `finally`. UUID generation does not consume shuffle words. This is process-local offline instrumentation and must not be imported into the application. Production randomness and the 1.5-second server pacing are unchanged.

## Outcomes and uncertainty

| Difficulty | Appearances | Wins | Win rate | First candidate rejected / tested |
| ---------- | ----------: | ---: | -------: | --------------------------------: |
| Easy       |          96 |    1 |    1.04% |               250 / 6,303 (3.97%) |
| Medium     |          96 |   30 |   31.25% |               219 / 7,658 (2.86%) |
| Hard       |          96 |   28 |   29.17% |               217 / 7,310 (2.97%) |
| Brutal     |          96 |   37 |   38.54% |               225 / 7,108 (3.17%) |

All victories were single-player outcomes, so fractional shared-win credit equals the win counts above. Mean finishing turn was **3.635**; 3 games reached turn 10. Accepted gameplay actions totaled **28,379**, ranging from 75 to 766 per game against a 6,000-action cap. Checked invariants after each accepted action were physical force conservation at 20, nonnegative safe integer resources, and ordinary hand limits with the existing temporary exchange allowance. These checks are not a complete proof of all game invariants.

| Seed replicate (48 games each) | Easy | Medium | Hard | Brutal |
| ------------------------------ | ---: | -----: | ---: | -----: |
| 0                              |    1 |     13 |   13 |     21 |
| 1                              |    0 |     17 |   15 |     16 |

Brutal led the combined sample, but Medium led the second replicate. Medium and Hard differ by only two wins overall. The four games within each deal block are paired and correlated; treating 96 outcomes as independent Bernoulli trials would overstate precision. No significance claim or monotonic difficulty certification follows from this sample.

Faction wins (64 appearances each): Atreides 15, Harkonnen 25, Emperor 12, Fremen 9, Guild 22, Bene Gesserit 13. Array-seat wins (96 appearances each): seats 0–3 had 20, 25, 25, 26. Physical-circle wins (64 appearances each): circles 1–6 had 16, 24, 14, 9, 19, 14. These are descriptive checks, not independent estimates of faction or circle strength.

## Rejected candidates and remaining work

There were **5,508 rejected candidate actions**, and all 96 games encountered at least one. The runner follows the production bot player/candidate ordering, catches only `RuleError`, and tries the next candidate. Its first candidate succeeded on **27,468 / 28,379 accepted steps (96.79%)**. The 911 first-candidate failures account for 3.21% of steps; fallback rejection count alone is not a failure-to-progress rate. Every nonempty bot candidate list eventually produced an accepted action in this run. The deepest accepted fallback was candidate 46.

| Rejection reason                                          | Count |
| --------------------------------------------------------- | ----: |
| Movement blocked or beyond range 1                        | 3,016 |
| Fremen shipment beyond Great Flat entry range             | 1,285 |
| Movement blocked or beyond range 2                        |   318 |
| Guild transport unaffordable                              |   243 |
| Shipment would place a third faction in a stronghold      |   190 |
| Battle plan violates Voice                                |   176 |
| Movement would place a third faction in a stronghold      |   121 |
| Available leader / Cheap Hero required                    |    73 |
| Battle cards selected without a leader                    |    59 |
| Movement blocked or beyond range 3                        |    12 |
| Selected battle is not an unresolved battle               |     9 |
| Prescience answer has no legal Voice-compliant completion |     6 |

These are concrete remaining candidate-generation costs, not evidence of an engine failure or permission to weaken validators. Reachability/entry filtering is the largest target for a future separately tested improvement. The 243 unaffordable Guild transports also warrant an isolated quote/commitment comparison; this run did not change pricing rules or diagnose the exact cause. Future strength work should retain balanced paired designs, add independent seeds and other supported player counts, and test proposed changes on held-out deals rather than tune to this outcome table.

The earlier study in `docs/AI_CALIBRATION.md` used different seeds, player counts, and assignment details. Its results and these 96 games are not a controlled before/after comparison, and their wins should not be pooled as one homogeneous sample.

## Harness validation

Targeted lint and TypeScript checks passed before the measured run. An initial four-game smoke completed all games but correctly returned a nonzero status because another agent changed hashed sources during that smoke; those results are excluded from the calibration.

After the measured run, a fresh four-game prefix replay completed in 4.275 seconds. All four accepted-action hashes, final-state hashes, and every non-timing row field matched the corresponding measured games exactly. The replay's sources were stable internally, but its aggregate source hash differed because `game/reference.ts` and `game/richese-cards.ts` had changed after the measured run was released; engine, bot policy, and harness hashes were unchanged. This verifies the observed prefix reproducibility, not an identical-source replay of all 96 games.
