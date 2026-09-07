# Placement and Duke cancellation continuations

Independent bounded audit, 7 September 2026. Read current producers, existing pure helpers, rule documents and relevant tests. No engine/test changes or database writes. Temporary in-memory probes use genuine declarations followed by explicit copied-save corruption. This document proposes engineering contracts; it does not enable a full expansion or settle new tabletop interpretations.

Review snapshot: `game/engine.ts` SHA-256 `1f2f68ad8624510c0be4d5e53c82a1b71e9e8176d23e3edae0ae6e3226acfaba`, `game/board-resolution-quote.ts` `237646b933f2ed9364214be394f13c1a3d8c27fd081b5755a7302e62f3d523b9`. Other source work was concurrent; line anchors below are approximate.

## Findings and priority

The next useful slice is **three denial receipts plus shared phase-boundary prerequisites**, not another placement simulation. Ecaz cancellation starts Shipment and Movement; Moritani placement cancellation may calculate victory; Duke cancellation may settle tech income/refund aid and start Battle. Their canceled effects do not place tokens, pay placement spice, or acquire Duke.

A probe at `/tmp/dune-placement-cancellation-probe.ts` produced each response through real actions: end-of-Revival readiness→Ecaz placement declaration; phase7 readiness→Moritani Mentat placement declaration; final `endMovement` with two qualifying stronghold battles→Duke response. Only then were copies corrupted. `/tmp/dune-placement-cancellation-probe.log` records:

| Source and corruption | Printed cancellation | New BG cancellation declaration |
| --- | --- | --- |
| Ecaz: duplicate order `['o','o','b']` | Accepted; phase5 gets that duplicate movement queue, omitting Emperor. | Accepted and Worthless cost spent. |
| Moritani placement: Moritani ally ID changed to an absent player | Public action rejects atomically when victory dereferences the ally. | Accepted and Worthless cost spent before the later invalid victory branch. |
| Duke: saved aid refund for Emperor changed to−50 while spice20 | Accepted; enters phase6 with Emperor spice−30. | Accepted and Worthless cost spent. |

These are reproduced **malformed-save** defects. No legitimate-state deadlock or legal-action exploit was established. In the Moritani printed case, the current outer atomic action does its job; the missing proof matters before a new separately persisted BG conversion. Ecaz and Duke cases return invalid state through the public dispatcher.

## Existing evidence and boundaries

Use the already recorded publisher/designer authority in [ECAZ_AMBASSADORS_RULES.md](ECAZ_AMBASSADORS_RULES.md), [MORITANI_TERROR_RULES.md](MORITANI_TERROR_RULES.md), and [DUKE_VIDAL_RULES.md](DUKE_VIDAL_RULES.md). The underlying [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf) provides Ecaz placement at end of Revival, one Moritani place-or-relocate opportunity in Mentat, acquisition timing for Duke at completed movement, and their separate Karama cancellation provisions. The existing source docs record mirror/revision limits and unresolved Duke custody/Occupy cases. No new external research was performed here.

Current faction gates remain separate from these finite mechanics. Preserve Basic and Advanced internal fixtures: none of these three response families is globally Advanced-only. Preserve the current exceptional Duke acquisition guard for captured/ghola custody and Advanced Harkonnen tables without presenting it as a universal printed prohibition. Do not enable disputed Ecaz Occupy, Duke capture/loan return, Homeworlds, or any full-mode gate by adding validators.

## Actual producers and denied receipts

| Family | Producer and current canceled branch | Minimum shared declaration contract |
| --- | --- | --- |
| Ecaz | `advancePhase` ~7428 first settles end-of-Revival work, then offers `ecazPlacement`. Decision handler ~12679 validates actual placement quote and saves `{token,territory,turn,cost}` without paying. Canceled response ~10209 calls pure `blockAmbassadorPlacement`, then `finishEcazPlacement` ~7465 stamps completion, clears pending/decision and calls `completePhase`. | Playing phase4, positive safe turn, actual seated Ecaz owner, pending current turn, not already completed; canonical Ambassador inventory; declared token identity and canonical ordinary stronghold; safe declared positive cost. Return blocked inventory plus completion stamp and exact clear fields. Reuse `blockAmbassadorPlacement`, which already validates inventory/current placement bookkeeping. |
| Moritani placement | `beginPhase(8)` ~7560 settles bribes/inflation, then offers the once-per-turn decision before victory. Decision ~12835 calls `placeTerror` as a validation only and saves `{token,territory,turn}`. Cancellation ~10248 stamps `placementTurn`, clears pending, calls `finishMoritaniPlacement` ~3521. | Playing phase8, positive safe turn, actual seated Moritani owner, current pending declaration, unused current placement opportunity, canonical Terror inventory and selected physical identity, ordinary legal Terror stronghold identity. Return placement stamp and pending clear only; retain every token zone/location/face. Current consumer lacks an explicit owner-faction check, so source ownership belongs in the shared quote. |
| Moritani Duke | `movementTurn` ~7240 calls `offerMoritaniDuke` ~6996 only after queue exhaustion. It stamps the attempt, creates the shared disc if needed, derives two distinct strongholds from actual forthcoming battles excluding Ecaz opponents, then opens response. Cancellation ~10162 logs denial and calls `nextPhase`. | Playing phase5, seated Moritani owner, empty completed movement queue, current acquisition-attempt stamp, canonical shared Duke identity/current custody record and source-bound response. Return no acquisition and a phase-departure descriptor. Leave the entire existing Duke disc/controller state untouched. Current consumer only checks phase/stamp/truthy Duke; semantic owner/source binding must precede new cost. |

Cancellation must not rerun `placeAmbassador`, `placeTerror`, or `acquireDuke`. Do not require current placement affordability, an empty destination, absence of storm, remaining supply availability, or that Duke is currently acquirable merely to deny the already declared effect. Validate stable identities and the continuation actually executed; changes to a denied effect's usefulness are not authorization to charge or apply it. Do not invent a new event for these legacy pending records, which currently have turn/source evidence but no placement event.

Ecaz has already settled prior phase-end tech income before its placement decision. Calling `advancePhase` again from its cancellation would repeat that prefix; preserve the existing direct `completePhase` suffix. Moritani has already settled bribes/inflation before its decision, so cancellation must not re-enter `beginPhase(8)`.

## Shared phase4→5 initialization

Extract a pure `quoteMovementPhaseStart` shared by Ecaz completion and real `beginPhase(5)`, rather than invoking the general normalizer on a clone. Its deterministic part validates a complete unique seated storm order and returns:

- Movement queue copied exactly once; shipment/move counters reset; Sapho last-turn marker and Guild timing flags reset; `spicePeekKnown=false`.
- Advisor stance releases and possible Advanced BG `advisorBattle` choice using public board geometry.
- If no advisor choice, an Advanced Guild timing choice where appropriate, otherwise the first active mover.

If the Ix expansion is enabled, `openPhase` stops at the real public phase-opening window before this initialization. Record that boundary; do not silently ready all seats. Without that window, Atreides may cause `refillSpice` and a peek response before the first turn is available. An empty spice deck can require actual refill/shuffle: quote the source prerequisites and deferred draw/refill work, not a sampled future card. The Atreides response can auto-allow when no opposing cancellation card remains.

`advisorBattleOptions` currently settles advisors and uses a cloned game to examine a possible flip. A pure helper can instead use `quoteBattleBoard` with an explicitly adjusted readonly advisor projection. Return releases rather than mutating stances during validation. This reuses established battle geometry without effectful gameplay preview.

No forces enter a territory just because phase5 starts. Fremen reserve entry, BG accompanying shipment, Ecaz Ambassador reactions and Moritani Terror are subsequent actual shipment/movement/arrival contracts. Do not synthesize an arrival, restart a worm ride, or trigger a placed token because a territory is already occupied. The immediate BG advisor choice here concerns existing forces; its later chosen response is a separate branch.

## Moritani Mentat victory boundary

`finishMoritaniPlacement` immediately calls `victory` only if CHOAM is absent. With CHOAM it returns to the existing phase8 lifecycle; it does not open or complete a market itself. The later normal ready/CHOAM market/Mentat path owns the final victory check. Preserve that genuine boundary and the already-settled phase8 prefix.

For the no-CHOAM branch, extract a **pure victory quote** shared with actual `victory` (~7643). Validate order, seated alliance references, public board/No-Field presence, advisor stance releases, winner list, and tech-token ownership inputs actually read. Calculate the existing normal/allied stronghold threshold and BG prediction replacement. The same function must preserve current turn10 Fremen/Guild fallback and final BG prediction handling; do not turn this refactor into a new victory-rule adjudication.

If the result finishes the game, the current function also settles optional Advanced Stronghold ownership. Treat that as an explicit final result with its own valid module/board/turn receipt, not an unexamined side effect. If no winner, remain in phase8; do not advance a turn on cancellation. Private BG prediction may be read server-side to compute the actual result but must not appear in a general public prerequisite/quote projection before disclosure is permitted.

## Duke phase5→6 departure

A canceled Duke response calls `nextPhase`. With CHOAM this opens the actual phase5 market and stops; the current empty-market auto-completion is deliberately phase3-only. Do not validate or execute a future market choice as though it had been made.

Without CHOAM, `advancePhase` settles current tech income, refunds all remaining phase5 aid, clears ready/active, then enters Battle (or first opens the Ix phase window). A generic pure **phase resource settlement quote** should validate exact token income and current donor refund balances with safe nonnegative arithmetic and return receipts for real settlement once. The existing `quoteBattlePhaseAdvance` includes phase6→7 collection; extract its refund primitive instead of calling that full function at phase5 and accidentally collecting early. The reproduced negative refund is resolved at this shared primitive.

If no Ix opening intervenes, `beginPhase(6)` uses current battle geometry and advisor releases. With battles it sets the first attacker, without creating a battle/plan or resolving it. If intervening supported state changes leave no battles, the engine immediately departs phase6; that reaches the existing battle-phase advance/collection contract and can open another phase boundary. Do not confuse two distinct strongholds at the original Duke declaration with a frozen future battle queue. Validate current successor geometry, while preserving denied acquisition without moving or acquiring the disc.

## Minimal verification after implementation

1. Convert the three temporary probes into genuine-declaration tests: malformed order, absent ally and negative refund reject before initial BG/printed cost and at final paid conversion allowance. Preserve input and SQL version on rejection.
2. Ecaz cancellation keeps token and spice, blocks remaining placement this turn, initializes exactly one complete movement queue. Cover Ix phase opening, Atreides refill/response, Advanced BG existing-advisor choice and Guild timing separately, without injecting arrival effects.
3. Moritani cancellation preserves hidden token faces/locations; cover no winner, actual winner, BG prediction, turn10 Fremen/Guild behavior and the CHOAM deferred branch. Include a token whose destination later became unusable to prove denial does not perform placement validation.
4. Duke cancellation preserves prior holder, disc/death history and completed movement stamp; settle valid aid/tech once; cover CHOAM market and Ix phase opening, existing battles and an explicitly supported no-battle successor. Countercanceling BG must restore the original Duke response without executing denial/acquisition twice.
5. Pure checks must allocate no event, call no RNG, expose no secret token face or prediction, and leave resources unchanged. Keep the outer atomic action until all automatic suffixes and original-actor promise reconciliation are covered; these local quotes alone do not establish a durable general Karama cost frame.

No permanent tests were run for this documentation-only audit. Validation consisted of source/test inspection and the temporary dispatcher probe above. Reproduced results identify current engineering gaps; full-game verification and all expansion completeness claims remain outside this bounded audit.


## Integration follow-up

The bounded contracts and genuine-declaration regressions were subsequently integrated. See [Placement cancellation recovery](PLACEMENT_CANCELLATION_RECOVERY.md) for current behavior, final validation, browser recovery and remaining limits. The findings above describe the pre-integration snapshot.
