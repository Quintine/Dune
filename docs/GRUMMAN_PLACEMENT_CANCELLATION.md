# Grumman stacks and Mentat placement cancellation

10 September 2026. This checkpoint fixes an interaction between the implemented [Grumman Collection addition](GRUMMAN_STACKED_TERROR_RUNTIME.md) and the ordinary [Moritani placement cancellation](PLACEMENT_CANCELLATION_RECOVERY.md). It does not introduce new placement permissions or resolve the remaining Nexus interpretations.

## Reproduced defect and final behavior

A real high-Grumman Collection addition creates two hidden Terror tokens in Arrakeen and pays four spice. Moritani then reaches its separate Mentat opportunity and declares an available token for empty Carthag. Before this fix, an opponent's printed Karama fails because the cancellation validator requires every already-placed Terror token to have a different stronghold. That assumption predates the supported Grumman stacks. The regression reproduced the failure in Basic and Advanced play and after Grumman later falls below high population.

Cancellation now preserves the entire physical inventory, including the legal stack and the proposed token's original position. It consumes the Mentat opportunity and the one Karama as before. The Collection payment is neither repeated nor refunded, and no hidden Terror face is revealed.

The established denial contract remains unchanged: canceling a previously declared operation does not execute it or require its current source and destination still to make the placement useful. An initially considered replay of `placeTerror` was removed because it would change that existing contract. Allowance still uses the ordinary placement helper and its current legality checks. Neither path grants another placement or moves every member of a stack.

An independent production SQLite corruption test found a second defect: an unrelated duplicate physical token ID rejected on cancellation but could be persisted by allowing the placement. Both outcomes now validate the same complete physical inventory and declared source before resolving. The allowance then performs its separate placement validation. The regression retains the unrelated duplicate as well as a duplicate of the selected token, rather than narrowing away the original failure.

## Evidence

- [Three engine/quote cases](../tests/grumman-placement-cancellation.test.ts): genuine Basic/Advanced Collection-to-Mentat cancellation, later low-population and turn handling, unchanged hidden inventory and income, prior denial semantics, and malformed inventory/source rejection without mutation.
- [Three production SQLite cases](../tests/grumman-placement-cancellation-recovery.test.ts): restored private seats, cancellation versus final allowance with exactly one successful write, lost-response/replay behavior, and zero-write rejection of unknown IDs, invalid territory, both duplicate-ID variants and stale turn.
- The focused selection passes **31 cases**, including historical placement cancellation and Grumman Collection behavior. Full-project check, build and final preservation totals are recorded in the opening implementation checkpoint after verification.
- A new three-seat browser room reaches the real Mentat opportunity after Collection, declares Carthag through the phone controls and cancels through the opponent's Karama control. The two-token Arrakeen stack, available proposed token and four-spice Collection income survive. Desktop/390-pixel phone screenshots were inspected, with no horizontal overflow or page errors. All three private seats restore after refresh; opponents see placed counts without hidden faces or the private declaration.
- The scheduled controlled restart preceded this fix. All **3,453** then-existing games retained their exact versions and state hashes, and twelve private seats from the preceding Emperor/Bene Gesserit checkpoints reconnected successfully. The new cancellation room separately passes refresh recovery; its new behavior is covered by production-module reload tests, rather than being claimed as played before that earlier restart.

## Remaining work

[Ixian purchased-card replacement](NEXUS_IXIAN_REPLACEMENT_RULES.md) and [Fremen worm/revival effects](NEXUS_FREMEN_RULES.md) now have new primary-source and integration audits. They remain unimplemented; the purchase privacy preference is pending, and the audits distinguish unresolved timing, scope and accounting questions from established mechanics. The Moritani Cunning audit also identified the need to adapt placement, entry and saved-state validators together before non-stronghold Terror can work. No Nexus effect, expansion or public mode was enabled by this fix. No recurring automation was recreated.
