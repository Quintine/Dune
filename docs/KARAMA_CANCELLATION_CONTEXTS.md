# Karama cancellation sources and pure prerequisites

Subsequent checkpoint: [Battle, revival and disaster preflight](BATTLE_REVIVAL_DISASTER_PREFLIGHT.md) adds shared revealed-battle calculations, per-location loss custody, canceled-revival quotes and storm/worm guards. Later aftermath, exhaustive response semantics and original-actor promise feasibility remain unfinished.

7 September 2026. This checkpoint extends the [previous conversion checkpoint](KARAMA_PREFLIGHT_AND_CONVERSIONS.md). It preserves the original power behind new BG cancellation conversions and checks two additional cancellation suffixes before accepting their cost. It does **not** introduce a Karama cost-discard frame or certify complete Advanced/expansion play.

## Original canceled power

`game/karama-context.ts` supplies an exhaustive typed selector for every current response kind. Each selector identifies that response's own source: committed auction and sale, battle event and relevant power payload, resolved battle receipt, movement declaration, placement, revival, transfer or worm/spice context. New BG cancellations record `opportunity.kind = 'cancel'` using the existing internal signature envelope for owner, original use/response, turn, phase, status and Advanced mode. The source additionally binds the source owner's and recipient's faction identities. Unrecognized response kinds and invalid response ownership/passes reject before cost.

The engine verifies the signature and matching Worthless response on view, action and automatic continuation. It follows the existing direct, gift, Box, purchase-income, summoned-worm and completed-discard resume records; Harkonnen exchanges may hold the response separately. Private signatures are absent from every seat's view. Optional metadata preserves older unstamped saves, whose original source cannot be retrospectively authenticated. Signatures detect inconsistent records, not coordinated rewriting of a whole save, and do not replace semantic suffix validation.

Hands, spice, current response passes, logs, AI control and unrelated interruptions are deliberately excluded. The original canceled response's saved confirmations remain fixed. Real Distrans, Truthtrance, Box, Harkonnen hand exchange and Richese gift/special purchase sequences remain available. A second BG cancellation can resolve a **separate** Richese purchase-income response while its original conversion is suspended; the existing direct-conversion restriction remains unchanged.

A separately summoned worm temporarily replaces the live spice context. `karamaSourceGame` follows explicit control-parent links and evaluates the older conversion against its saved original context without restoring a replacement Game. Worm rides and Nexus are excluded from identity: finishing the summoned worm legitimately adds a ride before the original response resumes. Both a new action-level test and the established summoned-worm regression detected this required exclusion. [Independent review](KARAMA_CANCEL_SOURCE_REVIEW.md) records the finding and tested resolutions.

## Moritani canceled retention

`game/karama-battle-preflight.ts` validates modern completed-battle receipts and returns an event-free seed for supported legacy cleanup. The live cleanup caller alone allocates or preserves an event. The canceled-retention quote checks the original response owner/stage, turn, losing combatant, unique played/eligible card IDs, chosen retained card, and exact held/global physical custody. Canceling retention discards every played card, including the selected keep. Knowledge receipts and historical auction prefixes do not count as extra physical cards.

The same pure validators serve cancellation preflight and actual cleanup. Missing, duplicate or crossed played cards and contradictory completed-battle receipts now reject before a BG Worthless card is consumed or a room version is written. Real modern and legacy battles still finish once, retaining the original losses and payments; Advanced stronghold income occurs once when the final battle enters Collection. This helper validates cleanup and its disposal, not all of `finishBattle` or full Harkonnen-traitor battle resolution.

## Canceled Baliset and completed movement

`game/karama-movement-preflight.ts` computes the resulting movement arrival's intrusion, Ambassador/Terror reaction conflicts and final Ornithopter retirement fence without moving forces, reading hands, drawing randomness or allocating events. Actual `completeMove` uses this quote before mutation. It replaces the former cloned `finishMovedGroup` preview used by final Ornithopter movement.

For canceled CHOAM Baliset, the engine first uses the existing pure movement-order validator. Its existing RuleError outcome remains an **accepted cancellation with no movement** when the declared group or route is no longer legal. Only a valid order reaches the arrival quote, with the canceled response removed from the predicted controls. Competing arrival reactions reject before either printed or BG cancellation cost; a valid final range-three or two-groups flight moves and retires its played card once. Same-territory intrusion, advisor stance, and a first two-groups move retain their separate behavior.

The quote does not prove every No-Field/cohort/promise or storm/worm continuation executable. Those checks and original-actor promise feasibility remain prerequisites for future durable pre-effect Karama frames.

## Verification

**1,850 rules/client/component tests and 194 multiplayer tests pass: 2,044 total.** There are 44 newly registered tests:

- `tests/karama-battle-preflight.test.ts`: 8 pure and actual modern/legacy battle-cleanup scenarios, including malformed raw records and card custody.
- `tests/karama-movement-preflight.test.ts`: 24 scenarios, including 10 actual dispatcher sequences across both cancellation forms and both movement modes, zero-RNG/UUID rejected arrival, accepted no-move and exactly-once flight disposal.
- `tests/bg-karama-cancel-context.test.ts`: 6 scenarios for actual transfers, Truthtrance, paid Box, hand exchange, 32 source corruptions, legacy recovery, separately summoned worm and nested BG income cancellation.
- `tests/bg-karama-cancel-recovery.test.ts`: 6 production SQLite scenarios with real migrations/authenticated room APIs, four final-allowance races, paid Box restoration, 42 source corruptions plus three pre-cost Moritani corruptions with zero writes, and legacy unsupported-count counter-cancellation.

Root reviewed every complete new source and test file and integrated all production edits. TypeScript, lint and the production build pass. Final logs: `/tmp/dune-karama-cancel-full2.log`, `/tmp/dune-karama-cancel-multiplayer.log`, `/tmp/dune-karama-cancel-final2-{type,lint}.log`, `/tmp/dune-karama-cancel-final-build.log`. The first broad rules run's single summoned-worm failure was fixed; the final full suite passes.

The unchanged-source Basic completion sample finished **20/20 games**, two through six seats at each of the four homogeneous AI profiles: **12,735 accepted actions, zero rejected candidates/stalls, and 567 JSON round trips**, in 117.535 seconds. Seed 20261009; result `/tmp/dune-karama-cancel-fullgames.json`. Engine SHA-256 `fec7d29db12e60d3dd276dee681afed531554deed05eba3fdcdd2b996af758d6`; source fingerprint `032947eb0260f8253a2244fc4c8cd3f34f7b336fa157516d9af88bcef2df62c3`. This Basic sample does not exercise Advanced BG, Moritani or Richese; dedicated tests above provide that bounded coverage. It is not difficulty-strength calibration or full expansion acceptance.

Browser QA used only the existing explicitly named test room `8S3MRDEK`. An actual Emperor gift response offered Baliset-as-Karama. Clicking it consumed one card and displayed the BG response. Refresh restored the same cancellation, two-card private hand and 20 spice, without exposing another hand or offering the declaring owner an allowance button. The desktop screenshot showed a readable response panel. QA remains at version 61 intentionally awaiting its other human-designated test seat; automated SQL tests cover final allowance. This is focused staged QA, not a full browser game or mobile acceptance.

The final read-only database check found 2,106 rooms. All 2,075 prior non-QA rooms in the 05:50 UTC maintenance backup retain exact versions and JSON hashes; only the deliberately staged QA room changed. The known human room remains version 14. No additional restart was due this checkpoint: next manual maintenance is around 06:50 UTC if active work and human play permit. The user-removed automation remains removed.

## Remaining work

The [cost-preflight contract](KARAMA_COST_PREFLIGHT_REVIEW.md) still requires exhaustive semantic canceled-response validation, full battle/storm/worm suffix checks, original-actor post-cost/intended-use promise feasibility and successor-aware discard handling. Only then can remaining ordinary/special Karama costs join the consumed-card pipeline. Semuta timing/capacity questions, other card producers, unresolved official-rule questions, all-module acceptance, broader AI calibration, component inspection and overall polish remain unfinished. Public Advanced and expansion starts remain gated. The full goal remains active.
