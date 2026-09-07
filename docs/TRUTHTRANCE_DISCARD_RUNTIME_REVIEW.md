# Truthtrance discard-frame runtime review

> Historical independent review copied from `/tmp/dune-truthtrance-frame-runtime-review.md`. The commands, results and hashes below describe that review checkpoint. They are not final integration fingerprints or totals; see [TRUTHTRANCE_DISCARD_CONTINUATIONS.md](TRUTHTRANCE_DISCARD_CONTINUATIONS.md) for the released behavior and final verification status.

Independent read-only audit, 2026-09-07. No project files changed. Initial requirements below are based on the existing source; the released runtime and executed checks will be recorded separately.

## Semantic receipt validation without replay

A consumed receipt should be validated by a pure helper in `game/truthtrance.ts`, which already owns question parsing and queue semantics. Validate definite answer, seated distinct asker/target, current turn/phase, and exact canonical question by parsing against a shadow with the original underlying controls restored. Require the parsed result to equal the stored question: the battle parser intentionally substitutes the current battle territory, so simply calling it without comparing the output would accept an obsolete stored territory.

The consumed physical card must no longer be a live queue head. `validateSavedShipmentQuestion` is unsuitable for that retired head because it requires every live queued Truthtrance to remain in its owner's hand. Do not insert the card back into a shadow hand just to make that validator pass. The current shipment opportunity checks and canonical question shape can be validated without a live window, while existing `shipmentPromiseIntegrity` validates the already-bound promises.

Require the indexed history item to be the exact last appended definite record. Question text alone is not a unique identity: identical questions can recur, including multiple cards owned by one asker and a re-ask after Unknown. Bind the full prior-history boundary or length/index as appropriate. A history record is public evidence, not new physical custody.

Remaining queue validation: null or stage `ask` with question null, nonempty queue if present, unique nonempty physical IDs, each held exactly once as Truthtrance by its seated owner, consumed ID absent, distinct seated priority passed IDs, preserved order. A holder may have multiple queue entries. The queue is not re-sorted and priority is not reopened during recovery.

Do not call fact answer evaluation, feasible-answer enumeration, `resolveTruthAction`, or promise binders while recovering a consumed receipt. Those answer the question against a later state or repeat contractual effects. A fixed matching receipt and its existing authoritative history/promise state are the validation inputs.

## Promise and setup boundaries

`bindShipmentTruth` appends one promise for every definite shipment answer. A corresponding exact new promise can be bound by index/value and target/asker/current turn. `bindBattleTruth` only appends while a current battle is unrevealed and the questioned player has not submitted a plan. A revealed/submitted battle-plan answer may be definite with no new promise. Facts and freeform records also add none. Do not require an invented promise for those cases.

The consumed-answer producer follows the original target's `truthAnswer` action. The physical card belongs to the asker. Keep both identities correct; do not present recovery as a new voluntary card action by the asker. Existing post-action reconciliation should see the restored context after the receipt retires.

Truthtrance supports setup as well as playing. The shared discard validator must admit setup only for this appropriate source instead of weakening other producers' active-game rules. Remaining Truthtrance must continue blocking setup advancement. Last-card completion may then permit the same automatic setup continuation as before. New staged setup normally has no cards before force placement; legacy/expansion setup with held cards remains a supported context.

## Suspended controls and finalizers

The callback must own discard, live-head detachment and remaining-queue handoff. Replacing `effects.discard` alone leaves the original unconditional `nextQuestion` running after the callback; that would skip or activate a head prematurely. Unknown and Save retain their non-discard queue path.

Clear live Truthtrance and the four parent controls before staging, preserve their bound non-control pending records, and restore the remaining ask window together with the exact controls only after retiring the frame. While a remaining question exists, restored parent controls remain blocked by Truthtrance. If none remains, normal finalizers may proceed.

Reuse pure suspended-control checks, and include this frame's resume in Auditor's pre-drain context lookup. Preserve live gift/Ambassador/Ix/exchange records under a source-specific bound-parent policy. A paid Box search is not a supported Truthtrance parent because the earlier paid-search action gate prevents it. Played Ornithopter and movement declarations are valid unrelated retained state.

Frame draining must precede `advanceSetup`, Terror overflow completion, promise reconciliation and automatic response/decision enumeration. In particular, consuming an asker’s Truthtrance may reduce Robbery overflow, but Terror can finish and open its deferred Nexus only when the complete Truthtrance queue has ended. Room recovery must see the generic automatic marker while both live Truthtrance and phase opening are detached; it otherwise intentionally waits on those human windows.

## Limits

A signature of controls, history and promise state binds a saved receipt to those stored values but cannot authenticate wholesale manual rewriting of all of them. Pure shape/context checks remain necessary. Do not claim exhaustive semantic validation of every preexisting pending union from a generic signature.

Completed questions, history and submitted Yes/No answers are already public. Target-only pre-answer suggestions and private witnesses/individual compound-fact clauses remain private. A stopped frame should not project its remaining internal queue or compute suggestions for its not-yet-activated next head. None of this activates Semuta or settles pending rule choices.

## Released-patch review

No blocking valid-action regression found in the released implementation during this bounded review.

`resolveTruthAction` now invokes the required `completeDefiniteAnswer` callback after its existing answer validation, applicable binding, history append and answer log. The callback owns physical discard, consumed-head detachment and construction of the remaining ask-stage window. The former unconditional `nextQuestion` after definite discard is gone; Unknown/Save still use their original non-discard path.

The new frame binds the exact consumed player/card, current last history index/record, remaining held queue and a typed newly-appended promise receipt or null. It restores the remaining window and four controls only after frame retirement. Source-specific setup acceptance and preserved gift/Ambassador/Ix parent records avoid narrowing prior supported contexts. Auditor's pre-drain lookup now recognizes the Truthtrance frame resume.

`validateTruthQuestionReceipt` reparses and compares canonical question structure against a shadow with original controls, without inserting a discarded card into a hand or live queue and without recomputing an answer. It therefore rejects changed battle territory as well as malformed/stale opportunity shape. The frame validator checks exact physical custody, definite answer, indexed last history item, unique held remaining cards, consumed ID exclusion, ask stage/null question and passed-seat shape. Promise validation distinguishes shipment, newly unsubmitted battle promise and cases that did not append one. Matching last-index/value checks do not treat an older equal promise as the new one.

The parent signature binds consumed receipt, complete history, current battle and shipment promises, underlying controls/pending records, phase/status/setup context, active/order, auction and relevant movement/spice/worm records. It preserves those values without restoring a whole old Game. The existing limitation remains: this is consistency checking, not proof against simultaneous manual rewriting of all authoritative values and the signature.

The last-card suffix may resume ordinary finalization; a remaining ask-stage window blocks it. The existing Terror overlay tests confirm consuming Truthtrance can finish Robbery overflow and open deferred Nexus after queue completion, while source inspection confirms the live remaining window continues to block those finalizers. Unknown answers still leave the physical card and create no frame.

## Independent executed evidence

Command:

```
./node_modules/.bin/tsx --test tests/truthtrance.test.ts tests/truthtrance-spice.test.ts tests/truthtrance-card-count.test.ts tests/shipment-promises.test.ts tests/moritani-entry-overlays.test.ts
```

**45/45 tests passed**, zero failures. Log: `/tmp/dune-truthtrance-frame-independent-tests.log`. This is the existing regression coverage, including priority, multiple cards, unknown/save, any-time overlays, supported facts, private assistance, shipment enforcement and real Terror/Truthtrance deferred-Nexus finalization. It does not include the separately owned new frame or SQLite/CAS suites.

Additional reproducible probe: `/tmp/dune-truthtrance-auditor-probe.ts`, run using the project's `./node_modules/.bin/tsx`; log `/tmp/dune-truthtrance-auditor-probe.log`. The probe constructs valid Auditor response/payment parent contexts and then uses actual Truthtrance declaration, priority passes, question and answer. A test-only VM observes the unchanged inner dispatcher before automatic drain. Both frame states project for every seat; consumed live Truthtrance and controls are detached; recovery restores the exact Auditor parent without payment, inspection, phase advancement, additional history or a repeated physical discard. Card inventory is conserved and repeated serialized normalization is stable. A real opposing Karama preserves the response case as an unresolved cancellation window.

These are explicitly constructed saved battle-aftermath contexts followed by real question actions, not claimed to originate from a complete preceding battle or production SQL. No project files changed. The coordinator separately owns projection-witness suppression and final full integration checks.

Historical source hashes at independent-review release (not final checkpoint fingerprints):

- `game/engine.ts`: `f47d65ec5883e80b554f16ed14572a5b1a371f98f7cb14c1e7678242093924f6`
- `game/truthtrance.ts`: `01e205f780febc96c50d3d651d651bb8e751572fcb2bcee3f973938bff996efd`

At release, source inspection also confirms `shipmentCompletion` is suppressed while any discard frame is pending, preventing preparation searches from treating the temporary suspension as an actionable plan.
