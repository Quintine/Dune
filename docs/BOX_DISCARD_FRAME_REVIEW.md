# Nullentropy Box discard-frame contract review

Read-only current-source review, 7 September 2026. Read `game/nullentropy-box.ts`, engine Box integration, existing Box engine/recovery tests, and `docs/SEMUTA_DISCARD_CONTINUATIONS.md`. Line pointers below refer to `game/engine.ts` unless a file is named. This is a continuation refactor contract, not authorization to enable Semuta or change the current full-hand/search/refund guards.

## The prefix is already a completed paid transaction

`beginNullentropy` (1367–1396) validates the canonical held Box, current availability, pre-existing hand space, at least two uncommitted spice, available non-Box discard targets, reservations and relevant promise feasibility. It then charges two spice once, assigns a private search event, snapshots original discard IDs/signature, and suspends `{response, decision, pendingKarama, phaseOpening}` in `pendingNullentropy.resume`. The direct fields are cleared except the owner-only `nullentropy` decision. The paid search is intentionally stable under normalization.

`finishNullentropy` (1301–1366) currently:

1. Verifies the paid owner/event and untouched original paid-search custody/signature.
2. Builds a pure preview using the old pile order; checks the selected non-Box target and `validateTransferCompletion` in a reconstructed original context (`nullentropyContext`, 1197–1207).
3. Only after rejection paths, server-shuffles the remaining discard once.
4. Calls `resolveNullentropyBox` with that exact order; installs returned owner hand and pile. The chosen card moves from discard into the owner's hand. The activating Box leaves hand and becomes the **last/top** pile card.
5. Clears the paid search, restores its four saved parent fields and logs completed recovery.

The new pause belongs between steps 4 and restoration in step 5. The fee, selected transfer, one Box shuffle, Box placement and completed-use log are committed prefix work. Never call `beginNullentropy`, `finishNullentropy`, `resolveNullentropyBox`, `shuffle`, or `validateNullentropyBegin` again to resume it. The consumed Box is no longer held and original search signature intentionally no longer matches.

Only the activating Box creates a fresh discard receipt: `{card: activatingBox, discardedBy: searchOwner, publicFace: true}`. Old shuffled cards are old discards, not a new batch. The recovered card is a private transfer, not a discard. The independent `result.selected` clone is evidence, not extra physical custody (`game/nullentropy-box.ts:3–7, 25–90`).

## Concrete continuation proposal

```ts
{
  kind: 'nullentropyDiscard';
  player: string;
  searchEvent: string;
  box: string;
  selected: Card; // private receipt only
  finalDiscardIds: string[];
  finalDiscardSignature: string;
  resume: NonNullable<Game['pendingNullentropy']>['resume'];
}
```

The shared batch supplies current turn/phase and fresh-discard sequence/event. Retain a clone of the exact **post-rewrite** pile, or its full-card signature plus ordered IDs, so a saved frame cannot reorder it or falsely attach an old Box in the pile. Retain only the private facts needed to bind the completed transaction; do not expose selected card or pile in `GameView`.

Commitment clears `pendingNullentropy` and the consumed `nullentropy` decision. Keep the parent's four direct fields clear while the frame is live; copying them back before staging conflicts with the shared frame's direct-response/decision/opening fences and can let an automatic income/draw overtake the pause. The typed suffix retires the frame first, then restores the exact four fields without executing the original parent action. Ordinary finalization/response machinery handles any now-automatic parent.

The old paid-search event belongs to this completed transaction; do not allocate a new event or shuffle order during JSON recovery. Sequence retirement prevents re-inserting a consumed frame into current state. It cannot authenticate wholesale manual rewriting of every historic receipt and sequence counter.

## Required saved-state and custody checks

- Playing status, current turn/phase, stable shared batch identity and exactly one public receipt with canonical held-effect definition for the physical `richese-nullentropy-box`. Former owner equals `player`, a seated player; `searchEvent` is a nonempty stable source event.
- `pendingNullentropy` is gone and no direct consumed `nullentropy` decision remains. Old search signature is not used as a post-completion invariant.
- The exact activating Box is uniquely present at the last/top position of the current discard, absent from all physical hands/deck/cache/removed supply/auction remainder/escrows. Other Box-looking cards in old piles remain old cards and are not receipt entries.
- `selected` is not any Box by the same pure helper's criteria. Its exact ID/name/kind/effect matches the one actual card in the selecting player's hand, absent from discard and other physical zones. Respect existing receipt aliases such as completed auction prefixes and private knowledge snapshots; do not count those as duplicate ownership.
- Current ordered discard IDs and full-card signature match the committed final pile; the old selected ID is absent and batch Box is top. Other physical cards retain unique custody. Do not claim a noncustodial receipt is an extra card.
- Validate saved resume shape and bindings before action, automatic recovery and view. Response owner, decision player, phase opening and pending Karama must remain valid for their original live parent records. A cloned shadow with the frame removed and the four fields restored is suitable for existing context validators; do not run effectful automatic continuation merely to validate it.
- Preserve the existing pre-use free-slot guard. Post-use owner hand count equals pre-use hand count because one Box exchanged for one card; inventing a second slot requirement at resume changes current behavior. Preserve existing empty/only-Box and provisional Guild rate-refund guards. No new rule is selected here.

Current frame custody assumptions apply only before any future reaction moves the used Box elsewhere. An eventual successful Semuta claim intentionally changes target custody, so it will need an explicit reacted stage and corresponding validator; do not weaken the current pending-receipt validation to speculate about that future path.

## Parent overlays: substantive integration risk

The existing generic frame validator prohibits `pendingRicheseGift`, `pendingAmbassador`, and `pendingIxAlly` globally. Box can legitimately interrupt an existing decision/response involving these records when the Box itself is not reserved. `pendingNullentropy.resume` stores only the four direct controls; those additional authoritative records stay top-level. Applying the current blanket exclusions to a Box frame would therefore reject previously supported Box use.

Prefer a Box-specific allowed-parent policy that validates those records against the saved resume, rather than forbidding them or erasing their data. Alternatively detach the entire bound parent into a typed wrapper, but then every parent validator/projector must know where to find it. Do not clone and restore the entire `Game`: that could restore old hands, spice or already completed continuations.

Specific interactions:

| Parent | Required treatment |
| --- | --- |
| Ordinary cancellation response | Preserve exact kind/owner/passed/intent and corresponding pending effect record. Resume through existing response resolution once. |
| BG Worthless Karama conversion | Preserve `pendingKarama` and its full typed `use`, including any older canceled response, alongside current conversion response. The activating Worthless is already a prior discard; it is not a second fresh Box batch entry. |
| Auditor response/payment | `auditorIntegrity` currently searches direct controls, `pendingNullentropy.resume`, and Richese gift resume (around 8291–8320). Add the Box-discard frame's resume to this lookup, or validate via an equivalent reconstructed parent context. Otherwise clearing the paid search loses its only binding and can reject a legitimate pending Auditor response/payment before frame drain. |
| Richese gift / Ixian alliance / Ambassador / hand exchange | Retain the existing pending records and validate their exact suspended controls. The Box cannot be the separately reserved card. Existing `validateTransferCompletion` (1464–1527) already checks gift/exchange/auction capacity and Ambassador completion feasibility before shuffle. Do not replay their transfer/draw actions. |
| Phase opening | Keep opening—including initialization and passes—inside frame until suffix. Restore exactly; do not initialize the phase twice. A public frame must not have direct `phaseOpening`, since room recovery otherwise intentionally skips it. |
| Truthtrance | Box initiation is explicitly prohibited while `g.truthtrance` exists (1246–1249). A paid Box search locks Truthtrance actions too (10828–10842). There is **no supported live Truthtrance resume** to invent. Existing completed battle/shipment promises still constrain pre-payment and completion. |
| Harkonnen bonus / next auction | After Box frame retirement, restored automatic response may legitimately draw and reshuffle the now-completed pile if deck is empty. That is a subsequent draw, not a repeated Box shuffle. Tests must distinguish the frozen pre-suffix pile from legitimate downstream draw consumption. |

## One-choice and many-choice paths

With multiple candidates, one room CAS saves paid search and private inspection authority; a later selected action commits the Box frame. A read/reconnect must not re-charge or choose for the owner. An invalid selection must fail before the Box shuffle and before the selection CAS.

With exactly one eligible non-Box card, `beginNullentropy` calls `finishNullentropy` immediately (1394–1395), including any other ineligible Boxes left in the pile. The new implementation should stage then automatically drain the same frame in the **original single paid action/CAS**, without requiring another user acknowledgement. Both paths must reach the same typed suffix. A saved test-only pre-drain frame should normalize identically to uninterrupted production execution.

## Bounded tests for future implementation

1. Multi-choice paid search → actual selection → observed pre-drain frame. Exact two-spice fee, selected hand identity, once-shuffled final order and Box top remain unchanged through JSON reload and competing SQL workers. Recovered card never appears in any unentitled view.
2. Sole eligible non-Box target completes in one original CAS; old other Boxes remain below the activating Box. No paid-search decision/inspection authority survives.
3. Saved regular response plus phase opening, nested BG Karama, Auditor payment/response, and unreserved Box during a separate pending gift/Ix/hand-exchange context restore exact controls without replay.
4. Empty-deck restored Harkonnen bonus draws only after Box retirement; inventory remains unique and no second fee/selection occurs.
5. Corrupt selected custody, Box position, final order/signature, player/event, suspended parent binding or duplicate receipt rejects action/view/recovery before writes. Old retired frame replay fails; concurrent workers produce one CAS winner.

No project files were changed and no tests were run for this read-only report.
