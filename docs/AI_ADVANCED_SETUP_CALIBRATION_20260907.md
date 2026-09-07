# Advanced base-faction setup and full-game calibration

7 September 2026. This study runs **Advanced from initial creation through the shared staged setup initializer**, with original base factions only and no expansion or optional module. It does not flip a Basic game to Advanced after setup. The public Advanced start gate remains closed, and these simulations do not certify the missing rules or unresolved interpretations described in the implementation ledger.

## Completed 456-game study

**456/456 games completed with zero rejected candidates, stalls, action-limit outcomes, exceptions or checked invariant failures.** The run accepted 116,270 actions, including 1,984 setup choices, and continued through 5,943 actual JSON restoration points. Every accepted action was its actor's first offered candidate. Runtime was 428.168 seconds; individual games used 48–1,479 accepted actions against a 6,000-action cap.

```sh
node --import tsx tools/ai-calibration-advanced.ts --games 456 --seed 20260923 --max-actions 6000 --out /tmp/dune-advanced-full-20260923.json
```

Output is preserved in `/tmp/dune-advanced-full-20260923.json`; log in `/tmp/dune-advanced-full-20260923.log`; independent analysis in `/tmp/dune-advanced-full-analysis.txt`. Terminal session 92787 was explicitly polled to exit 0. Full JSON SHA-256: `922883c5c3a1027fa89d0b5a33fb294fba1aa1966bb4363f649b89d2cb9aadcc`.

The starting/ending source fingerprint equals `7b366ca7326d961fee76cd8034570ffdc07be8b43cda0afc3da9416f667b6a9d`, exactly matching the pilot's measured source set below. An independent immediate post-exit SHA-256 comparison found **zero changed files** across that complete recorded source set before the root was told to release the freeze. Later source formatting or documentation changes must be distinguished from these measured bytes.

All 57 base rosters appeared in each of two seed blocks, at all four difficulty shifts. Each faction appeared 248 times, and each difficulty 372 times. The full run's first 20 rows exactly reproduce **every non-timing pilot row field**, including accepted traces and final-state hashes. Therefore the pilot is a reproducibility prefix of this 456-game study, **not 20 additional independent games**.

| Players | Completed | Accepted actions | Rejected candidates | Setup choices | JSON continuations | Mean final turn |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 120/120 | 19,068 | 0 | 320 | 1,050 | 4.283 |
| 3 | 160/160 | 27,052 | 0 | 640 | 1,528 | 2.656 |
| 4 | 120/120 | 36,883 | 0 | 640 | 1,847 | 3.217 |
| 5 | 48/48 | 27,604 | 0 | 320 | 1,263 | 4.479 |
| 6 | 8/8 | 5,663 | 0 | 64 | 255 | 4.250 |
| Total | 456/456 | 116,270 | 0 | 1,984 | 5,943 | 3.452 |

Games finished on turns 1–10; 19 reached turn 10. All 248 BG games recorded prediction → traitors → forces → playing. Another 120 recorded traitors → forces → playing. The remaining 88 needed no variable force-placement input and went from traitors to playing in the same authoritative action that initialized fixed forces and dealt cards. This is the intended automatic continuation, not a skipped printed placement step.

| Difficulty | Appearances | Wins including shared | Fractional win credit | Accepted actions |
| --- | ---: | ---: | ---: | ---: |
| Easy | 372 | 5 | 5 | 24,728 |
| Medium | 372 | 160 | 160 | 30,579 |
| Hard | 372 | 142 | 142 | 31,373 |
| Brutal | 372 | 149 | 149 | 29,590 |

No game in this sample ended in a shared win, so the two win measures coincide. Easy was substantially weaker descriptively; **Medium → Hard → Brutal is not a verified strength ladder**. Forward-order seed-block wins were 1/90/65/72, while the reversed-order block gave 4/70/77/77. The shared-seed shifts, repeated levels at larger counts, mixed table sizes and order/seed changes prevent treating all rows as independent one-of-each difficulty trials. This study establishes bounded completion and candidate-legality evidence, not a strategic superiority claim.

## Pilot evidence

The first 20 scheduled games completed 20/20 in 29.654 seconds with **zero rejected candidates, stalls, action-limit outcomes, exceptions or checked invariant failures**. There were 7,727 accepted gameplay/setup actions, including 80 setup choices, and 354 actual JSON continuation round-trips. Four games completed at each player count 2–6. All recorded source hashes stayed unchanged throughout the run.

```sh
node --import tsx tools/ai-calibration-advanced.ts --games 20 --seed 20260923 --max-actions 6000 --out /tmp/dune-advanced-pilot-20260923.json
```

Preserved output: `/tmp/dune-advanced-pilot-20260923.json`; log: `/tmp/dune-advanced-pilot-20260923.log`. Terminal session 91731 was explicitly polled to exit 0. Combined source fingerprint: `7b366ca7326d961fee76cd8034570ffdc07be8b43cda0afc3da9416f667b6a9d`.

Node runtime: v26.4.0. Pilot JSON SHA-256: `ae3d03210490fca917b9905c710908a33d59e901ae4618c66af70788b7619c35`.

| Source | SHA-256 at pilot and full-study start/end |
| --- | --- |
| `game/engine.ts` | `b858f1eddecb2bacb0bcc3d7c6acfd0c5961f1e0ad84e53ab00927c61d0290f1` |
| `game/bots.ts` | `0797f9e2689f3a8f3a8fdb73d15ac83e08e4de0892d63e9237dbeebfcbc4e25b` |
| `game/bot-profiles.ts` | `b85b89286d50a8699b6e9a362d3b6978914781e29c9c98e66db7c0d84e6e7ac4` |
| `tools/ai-calibration-advanced.ts` | `e9f47287ef3ad434da05b518d9e7960e0258eab9665cc47f72ec639d66ba9cd3` |

Pilot difficulty appearances were 20 each; wins including shared were Easy 1, Medium 6, Hard 6 and Brutal 7. These small counts are descriptive and do not establish relative strength. The pilot intentionally covers one roster at each table size, rather than balancing factions: appearances were Atreides 20, Harkonnen 20, Emperor 16, Fremen 12, Guild 8 and Bene Gesserit 4. Full-study completion is a separate result, not implied by this pilot.

## Harness and assignment

`tools/ai-calibration-advanced.ts` is a new offline-only harness based on the instrumentation of the unchanged `tools/ai-calibration-stone.ts`. It constructs `createGame(..., true)` and uses `joinGame`, genuine `seatPosition` and readiness actions. Each player moves to its assigned physical circle before the next player joins, so the assignment works at all six occupied circles without illegal swaps. The internal `initializeBaseGameForAudit` performs the shared production initialization on a clone. Its result then advances only through authoritative `applyAction` calls. No room endpoint, player action, public mode flag or live database is altered.

The full study contains 57 distinct faction subsets of sizes 2–6, four difficulty shifts per subset and two seed blocks: **456 games**. Subsets are sorted by bitmask within each player count, then interleaved across counts; this makes the first 20 games cover one subset per count at all shifts. Within a row, difficulty is `(seat + shift) mod 4`. Faction order is forward in replicate 0 and reversed in replicate 1; physical circle is `((block + seat) mod 6) + 1`.

Two-/three-player games omit difficulty levels in an individual game. Five-/six-player games repeat levels. Only a four-player game contains one of each level. Completed full-study marginals, shared-win accounting and actual sample counts must be reported from output, not inferred from a four-player design.

Engine shuffles use a process-local Mulberry32 stream, and UUID generation uses a separately seeded stream. Both reset for each four-shift deal block. The seed is:

```text
(masterSeed
 + imul(playerCount, 0x9e3779b9)
 + imul(block, 0x85ebca6b)
 + imul(replicate, 0xc2b2ae35)
 + (reversed ? 0x27d4eb2f : 0)) >>> 0
```

The UUID stream starts at `seed XOR 0xa5a5a5a5`. Originals are restored in `finally`. Changed choices may consume different later shuffle calls; paired seed blocks are not independent games. Source fingerprints include every `game/*.ts` file and this new harness at both start/end. Accepted action trace hashes and final serialized-state hashes are recorded per game.

## What is checked

The harness follows production bot player/candidate order and passes each policy only its own `viewGame`. It verifies that candidate generation leaves that projection unchanged and that other seats' hands, traitors, traitor choices and prediction, plus the decks and undealt traitor reserve, are not exposed there. It applies each attempted candidate authoritatively, recording `RuleError` before trying the next candidate. The first rejection immediately produces a diagnostic line and a complete synthetic-state artifact; up to eight representative rejected actions are retained in that row. The study stops after the first row with a rejection or failure and exits unsuccessfully instead of reporting a partial clean batch.

Checks after initialization and accepted actions include:

- Configuration remains Advanced/base/no-module; all players conserve twenty physical forces and nonnegative integer resources.
- Emperor/Fremen elite totals remain five/three; elite reserves/Tanks/on-board groups remain subsets of physical forces, and their revival counter does not exceed one per turn.
- No starting hand is dealt while a setup stage remains. Prediction precedes traitor dealing; prediction/traitor stages contain no early starting spice, force placement or elite inventory.
- Native leader pools keep five unique discs and nonnegative integer death history. Participating traitor inventory remains conserved across reserve, kept cards and unresolved choices.
- Every physical base treachery card remains represented once in decks, discard, hands or unawarded auction stock. Completed/pending awarded auction entries are references to hand custody and are excluded from double counting. Temporary Harkonnen hand-exchange excess uses the existing decision allowance.

After setup-stage changes, game completion and every 25 accepted actions, the harness serializes/restores the complete state, compares its serialized form and every personalized projection, then **continues the actual game from the restored state**. This is offline JSON-continuation evidence, not Cloudflare/D1 concurrency, browser reconnect, elapsed bot pacing, real process restart or network-disconnection evidence.

## Boundaries

The initializer tests separately cover all 456 roster/profile/order setup paths and focused alternative placements. This calibration follows actual policy choices: Fremen currently leaves its initial Fedaykin in reserve, which is legal but not proven optimal. Random games may never trigger a particular held special Karama, advisor/captive interaction, arbitrary Truthtrance promise or rare conflict. Their absence cannot certify a missing rule.

The invariants above are stronger than the previous Basic harness's resource-only checks, but they remain selected checks. They do not establish correct bank-wide accounting, every card timing, every alliance/negotiation obligation, every possible hidden-information inference or all Advanced faction exceptions. Full Advanced compliance, reliable difficulty ordering, browser play and online recovery remain separate requirements. Existing Basic calibration artifacts and harnesses are preserved unchanged.
