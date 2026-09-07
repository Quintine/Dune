# Karama context runtime review

Independent read-only review, 2026-09-07. Reviewed current `game/engine.ts` opportunity/conversion guards, transfer slot reservations, normal/Richese settlement, supported early card and special-power dispatch, saved private resumes, and the released pure Richese settlement helper. No production files changed by this reviewer; the separately assigned permanent nested regression tests are recorded in the final resolution below. Probes are `/tmp/dune-karama-context-probes.ts` and `.json`; initial fixture/output evidence is preserved in `-initial` files. This review concerns current atomic validation and BG conversion binding; no new Karama cost discard frames exist.

## Genuine interruption regression reported to root

A stamped BG direct purchase can be interrupted by an actual Harkonnen hand exchange. That exchange leaves `g.pendingKarama` in place but stores its `worthlessKarama` response in `g.pendingExchange.response`, clearing the direct response and opening the hand-return decision. This is valid and independently tested to completion.

If a third player then begins a canonical held Nullentropy Box, Box legitimately moves the live pendingKarama into `pendingNullentropy.resume.pendingKarama`; its `resume.response` is null and `resume.decision` is the hand exchange. The newly added `savedKaramaContexts` only consults `pendingExchange.response` for the **direct** pendingKarama entry. For a Box resume it reports the null local response, so `karamaConversionIntegrity` rejects this legal action at the post-action guard (`engine.ts` around 4752 / 11652 at the observed version).

Reproducer is named `Box during Harkonnen exchange over signed BG purchase`. It uses physically extracted cards, actual BG declaration, actual Harkonnen special action, and actual Box action. The failure is the opportunity-integrity error, not capacity, card custody or Box timing. A similar Richese-gift-over-hand-exchange probe is included because the saved response has the same shape. Any fix should resolve the parent response through the bound hand-exchange context for suspended resumes as well as live state, without accepting an unrelated exchange's response as authority.

## Saved-state physical custody gap reported and fixed by root

After a real stamped BG purchase declaration, copying the unchanged current normal-lot card into another player's hand did not alter the opportunity signature, because hands correctly remain unsigned for legitimate interventions. The initial implementation accepted `viewGame` and conversion allowance, producing two live copies in hands. This was a malformed-save bug, not an achievable legal-player action.

Root added a unique current-lot physical custody guard in `normalKaramaAuction` and calls it for stamped auction integrity. Re-running the actual probe now rejects both projection and continuation with `The reserved normal auction card has conflicting physical custody.` Historical auction prefixes and informational card receipts must stay excluded from live custody; unrelated hand substitutions remain legal. The repro retains this as a negative assertion.

## Positive actual paths checked

1. BG purchase → Richese gift → Box over that gift → selected-card recovery → allow gift → allow original purchase. BG ends with its intended four-card hand and normal phase advances once. Both the gift's saved conversion and Box's private search preserve their original controls.
2. BG purchase → Harkonnen exchange → explicit return → allow original purchase. Original lot acquired once; no signature failure from the random private hand change.
3. BG purchase → Richese special cache purchase → its separate Emperor income response → allow original purchase. The physically held second BG Worthless keeps the nested income cancellable, ensuring the saved conversion in `pendingRichesePurchaseIncome.resume` is genuinely exercised rather than automatically disappearing before inspection.

All three pass current guards. Each projects every seat at the relevant suspended point. The initial third-probe failure was fixture-only: the base deck contains two printed Karamas, and after correcting that source ownership a second attempt auto-settled the income because only its owner could cancel. The final fixture keeps an actual non-owner cancellation card and passes. These corrected fixture attempts are not runtime findings.

## Integration semantics checked by reading

- Richese settlement delegates branch/price calculation to `quoteRicheseSettlement`; live payment still uses the returned exact amount and ally share once, transfers one detached physical card from its real source, and retains its ordinary seller/Emperor/Harkonnen/Ix aftermath.
- Unbid Black Market still retains its hand card without requiring sold-lot funding or capacity. Its immediate declaration validates nonempty cache. Sold Black Market quoting is not itself a phase advance and can pause for replacement/bonus; the outer cancellation preflight may require its eventual declaration's existing cache prerequisite. No new cache-exhaustion rule was invented.
- Cache unbid with room still creates the existing choice; a full owner removes the offered card. Sold cache self-purchase remains accepted; Black Market positive self-purchase remains explicitly gated.
- Initial normal free purchase still requires its original normal auction, and direct purchase retains the pre-cost hand eligibility. Normal payment and same-actor Richese cancellation must use post-cost capacity. Root already fixed this known issue separately; it is not counted as a new finding here.
- Conversion signatures deliberately omit hands, balances and response passes, preserving ordinary paid-search, private transfer and cancellation progress. They bind owner, use, turn, phase, mode and the original shipment or auction opportunity. New stamps now require their corresponding `worthlessKarama` response owner. Legacy unstamped saves remain supported intentionally.
- Incoming transfer slot reservation scans live and saved conversions; it reserves pending purchase/payment slots without treating a shipment benefit as a future card acquisition.
- Canceling a legacy Worthless attempt to cancel unsupported Richese counting restores the old response; it must not recursively preflight execution of that unsupported old cancellation. The current branch preserves this direction-sensitive behavior.
- `aidFor` still resolves `p.ally` plus its escrow recipient, and does not itself assert reciprocal alliance. The pure quote accepts this caller-resolved credit and does not invent a donor-field validation. This is existing behavior, not a claim that all surrounding alliance integrity has been newly audited.

## Limits

This is a bounded review. It does not prove every cancellation suffix executable, settle unresolved rules, or justify durable pre-effect cost frames for all response kinds. Current actor-aware post-action promise checks still run within the original atomic action envelope. The probe runner is scenario evidence rather than a full-game/public-start matrix. The initial review required a nested hand-exchange-resume fix and rerun; the final resolution below records their completion.

## Final resolution and permanent regression evidence

Root corrected the suspended-response lookup, including Box/gift contexts whose hand-exchange parent owns the Worthless response. Positive nested probes now restore the original conversion and finish its intended purchase.

A second genuine issue was then reproduced: BG post-cost hand2 → Hark takes1 → first gift leaves2 → second gift leaves3. Each future slot passed an independent check, but hand-return1 plus auction-card1 required two slots; the subsequently mandatory return was rejected. Root changed transfer preflight to reserve `recipientHand + exchange.count + auctionSlot` cumulatively, counting the one auction acquisition once even when multiple commitment descriptions refer to it.

Permanent tests are `tests/bg-karama-nested-controls.test.ts` (owned new test file, no runtime edits by this reviewer). Five tests now pass: Box inside gift, plain Hark exchange, separate special-Richese income, Box inside Hark exchange, and one legal gift plus refused second gift while both future cards remain reserved. Every accepted action uses unique physical cards and JSON continuation, checks immutable input and whole live card inventory; suspended points project every seat. Final test then completes both the hand return and original auction acquisition, proving the first gift was not overrestricted.

Named oxfmt and type-aware oxlint pass. The focused run passed 5/5 in 257.25 ms; terminal session 11276 was explicitly polled to exit 0. The permanent file is frozen/released to root. No remaining concrete blocker found in this bounded review. The earlier physical-duplicate issue is now separately guarded and negative-tested by root. These fixes do not claim full cancellation preflight coverage or introduce new cost frames.
