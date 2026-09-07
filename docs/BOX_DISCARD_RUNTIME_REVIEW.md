# Nullentropy Box continuation: independent runtime review

Read-only review, 2026-09-07. No project files changed. This initial section records pre-patch requirements; final runtime verification is appended after the coordinator releases the patch.

## Required validation order

`applyAction` validates existing frame integrity before dispatch; after inner selection it runs Ornithopter, late-defense, Stone Burner, Stronghold and Auditor integrity before draining the new frame. `normalizeAutomaticGame` runs the same family before `finishActionContinuations`. Therefore a legitimate suspended parent must already be recognized while the Box frame is live. Deferring parent validation until after restoring controls is too late for Auditor and too permissive for stale saved decisions.

Use a cloned shadow that clears the Box frame/search and restores exactly `{response, decision, pendingKarama, phaseOpening}`. Validate the controls' structural shape and seated references, then call applicable existing pure integrity helpers. Do not replay a paid search, original declaration, transfer, auction settlement, shuffle or automatic response. Do not clone/restore the whole Game over the committed prefix.

Do not use `normalizeAutomaticGame`, `finishActionContinuations`, `settleAutomaticContinuations`, `normalizeBattle`, `cleanupBattleContext`, or promise reconciliation as purportedly pure validation. These can normalize, log, release commitments, invent a legacy event, resolve an effect, draw or advance. Existing transfer-completion checks belong before the single Box shuffle on the reconstructed original context; normal post-action reconciliation belongs after restoring the parent.

## Exact integration needs

- Auditor: add the Box-frame resume to `auditorIntegrity`'s known controls. Its response/payment stages require a bound matching decision or response, including a cancellation response nested in BG `pendingKarama.use`. This must work before frame drain and in projection. Pending offer/response/payment records remain top-level. Missing-parent checks also need to see restored controls, otherwise a forged Auditor decision can hide inside a frame.
- Stronghold: inspect the restored `strongholdCopy` decision with `strongholdIntegrity`, including the no-module case. The current helper validates current battle event, ownership, combatants, physical control and exact choice set only if the decision is directly visible. Detaching the decision must not silently bypass that binding.
- Stone Burner and Portable Snooper: existing integrity primarily checks the unchanged live battle and reserved hand-card custody. These checks remain applicable to a Box frame; it must not clear the battle or treat reserved hand cards as new discards. Validate any restored decision's event/owner binding as appropriate without choosing a mode or advancing the revealed battle.
- Ornithopter and Sapho: their state/custody and turn checks are independent of the four controls. Retain the top-level records unchanged and run their pure checks. Do not finish a played movement card while validating Box.
- Shipment promises: `shipmentPromiseIntegrity` is pure and remains applicable to the shadow. Live shipment Truthtrance itself is an unsupported Box parent because Box initiation excludes active Truthtrance. Existing completed commitments must continue constraining voluntary payment/recovery; do not release them merely because controls are temporarily detached. The existing supported commitment scope is Basic/no-expansions; this refactor does not broaden it.
- Richese gift: the top-level pending gift and its own older resume must survive. Validate the Box resume's gift/cancellation binding and reserved gift card custody; the unreserved Box may be used. Do not replay transfer or clear a gift because its direct response is currently in the Box frame.
- Ambassador: keep the exact pending entry, beneficiary and stage. Bind its decision through the restored controls, including an older decision suspended beneath another supported overlay. Existing `validateTransferCompletion` checks whether an accepted Ixian discard or copied effect remains completable before the Box shuffle. Do not re-trigger an Ambassador or draw its replacement.
- Ixian ally replacement: keep pending buyer/card/free and actual paid auction state. A decision before acceptance and a cancellation response after acceptance are distinct valid parents. The purchased reserved card stays in hand; another Box can be used. Do not assume only a direct current response is possible: BG conversion may wrap it. The later replacement discard can legitimately create a second frame after the Box frame retires.
- Harkonnen exchange: keep `pendingExchange` and the live `handExchange` decision suspended in Box resume, with its original older decision/response intact. Check count and hand capacity using the existing transfer-completion validation, without returning cards or restoring the older exchange parent prematurely.
- Phase opening: allow its existing simultaneous response plus opening combination. Its passed seats and initialize flag are preserved exactly and remain suspended through the Box frame. A top-level opening would interfere with room recovery and must stay detached until suffix.

## Compatibility and privacy limits

Existing tests cover all twelve holders across both modes and all nine phases (216 combinations). Do not introduce an active-player-only or selected-phase-only Box guard in this refactor. Existing pre-use free-space, empty/only-Box, cost/reservation and provisional Guild-refund restrictions remain unchanged.

The activating Box must be canonical. Old other Box-looking cards are deliberately excluded as search targets by the existing pure helper, including legacy/test cards with an alternate ID; this is not permission to treat them as activating Boxes. Do not add whole-old-pile catalog validation or count completed auction-prefix/knowledge receipts as physical custody.

The final ordered pile and public Box receipt are committed evidence; selected card and complete pile remain private. One eligible target must stage and drain in the original action without a confirmation or inspection decision. An empty-deck Harkonnen bonus may draw from the finalized pile only after Box frame retirement; that is a legitimate subsequent shuffle, not a repeated Box shuffle.

## Released-patch review and independent checks

The coordinator's implementation has now been reviewed. No blocking valid-action regression was found in this bounded audit.

The new `nullentropyDiscard` variant clears the paid search and consumed decision, records only the public activating Box as fresh, and preserves the selected private card plus final pile order/signature. Its suffix retires the frame before restoring only the four original controls. Existing fee, transfer preview and shuffle remain in the committed prefix; no effectful replay is used as validation.

`nullentropyResumeIntegrity` verifies a parent signature over the search event, saved four controls and nonnull top-level pending obligations, plus basic control/seat/pass shape. It runs the seven pure shadow validators for shipment promises, Sapho, Ornithopter, late defense, Stone Burner, Stronghold and Auditor. The shadow removes the frame and restores its four controls, without normalizing or resolving the parent. Only this variant relaxes the shared bans on separate pending Richese gift, Ambassador and Ixian ally records. The unchanged pending records are part of the parent signature. Auditor also sees the Box resume directly before drain.

This preserves the broad existing parent acceptance rather than replacing it with an incomplete list of permitted decision/response kinds. A changed saved control or parent record fails its unchanged signature. This signature is not semantic or cryptographic authentication against rewriting both the parent and signature consistently. It does not make previously unvalidated arbitrary malformed parent state valid; comprehensive semantic validation of every action union is outside this refactor. Existing dedicated pure validators still enforce their stronger battle and opportunity bindings.

Independent regression command:

```
./node_modules/.bin/tsx --test tests/nullentropy-box-engine.test.ts tests/nullentropy-box-engine-review.test.ts tests/nullentropy-box-bots.test.ts
```

Result: **17/17 tests passed**, including the existing 216 holder/mode/phase cases, automatic sole-target recovery, private access, paid auction income response, response plus phase opening, preserved paid inspection, and promise/reservation exclusions. Log: `/tmp/dune-box-frame-independent-tests.log`.

Additional reproducible probe: `/tmp/dune-box-parent-review-probe.ts`, run with the project's `./node_modules/.bin/tsx`; log `/tmp/dune-box-parent-review-probe.log`. It explicitly constructs valid saved Auditor payment and cancellation-response contexts, then performs actual Box initiation and selection. A test-only VM observes the unmodified inner dispatcher before normal automatic drain. Both contexts project successfully for all seats while the frame is pending; JSON recovery restores the exact Auditor controls and record, charges only the original two-spice Box fee, and does not pay, inspect or advance the battle. The cancellation response includes a real opposing Karama so automatic cancellation-window closure does not obscure control preservation. The Auditor parent is deliberately constructed, not claimed to originate from a resolved battle in this probe.

The first probe assertion compared an in-memory object containing optional `undefined` keys against a JSON round-trip lacking those keys; it was corrected to compare serialized states. No runtime adjustment was needed. These parent probes complement, rather than replace or claim execution of, the separately owned full frame and SQL/CAS recovery suites.

Source hash at review release: `c9e3e9ba820c8fbae64f62718d4a364c8e47bdcfb685ca95866e9635915176a1` (`game/engine.ts`). The coordinator additionally bound the search event in the parent signature while integrating the focused suites.

## Subsequent integrated Auditor finding

Independent semantic tests recomputed the Box parent signature after changing the Auditor event or territory. They exposed an existing missing binding to `lastBattleContext`. The coordinator added a check of its event, turn, territory and ordered combatants whenever that modern receipt exists, retaining legacy no-context support. Four new registered tests exercise 20 malformed Auditor/control/battle cases and legacy restoration. The genuine battle-origin Auditor cases remain in the fourteen-case continuation suite. All 1,872 final registered tests and build/type/lint checks pass; see the Box checkpoint.
