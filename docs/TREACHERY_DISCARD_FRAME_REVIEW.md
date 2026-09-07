# Persisted Treachery discard frame review

Independent read-only review, 7 September 2026. Scope: the current `Game.pendingTreacheryDiscard` foundation for CHOAM/Ixian Ambassador discards and Ixian alliance replacement. This does not approve or activate Semuta Drug, choose its capacity policy, or claim coverage of other discard producers. Engine source was being integrated during review; function names are more durable references than line numbers.

## What the implementation gets right

- `treacheryDiscardIntegrity` runs before `applyAction`, `normalizeAutomaticGame`, and `viewGame`. Consequently malformed frames can fail before room CAS writes, including actions that would otherwise only change seat control.
- `treacheryDiscardSequence` and `resolvedTreacheryDiscardSequence` are nonnegative safe integers with exactly one outstanding sequence. The batch event includes turn, phase and sequence. A restored old frame with an already-retired sequence is rejected.
- A receipt is not physical custody. Each entry must correspond to one actual discard card with matching ID/name/kind/effect, and must be absent from hands, deck, cache, current Ix pools, Ornithopter escrow and unconsumed auction cards. Purchased/earlier auction prefixes and Ix knowledge intentionally remain receipt aliases.
- Producers discard once, detach their live parent, and transfer a cloned typed continuation. Ixian alliance captures the paid sale plus normal auction index/Richese event. It does not replay the auction or its funding action.
- `finishTreacheryDiscard` retires and clears the frame before drawing or calling another continuation. Its Ambassador CHOAM branch does **not** add spice: the selected-count payout and log were committed alongside the original discard. Replaying a drain cannot repeat that income.
- Ixian replacement occurs after retirement, so an empty deck can safely refill from the real discard pile. The ordinary current behavior permits the discarded card itself to be redrawn when it is the only available card; tests must not prohibit that.
- The optional zero-card CHOAM selection finishes directly and creates no empty batch.
- `finishActionContinuations` drains before ordinary setup/cleanup finalizers; room automatic recovery now schedules a frame-only state. Gameplay actions are fenced while a frame is saved, except normalization and explicitly independent seat-control changes.
- Public views are constructed field by field and do not expose the frame, its private receipt faces, or the stored Ambassador entry. No newly introduced card-identity leak was found in this path.

## Concrete saved-state hardening findings sent to root

These are corruption-only findings from validator inspection, not demonstrated client-action exploits. A normal authorized producer supplies the correct data.

1. **Ambassador receipt is insufficiently bound to the consumed token.** At the reviewed version, the validator accepts any matching used/removed token and independently accepts `entry.effect` of CHOAM or Ixians. Relabeling a one-card CHOAM frame to Ixians, including `batch.cause`, can therefore pass that check and earn an unauthorized replacement draw. Bind an ordinary used token's printed effect to the selected effect; for removed Bene Gesserit, validate that the copied effect belongs to the saved legal copy choices. Also validate beneficiary is Ecaz or its mutual ally, entry territory/sector is a real permitted location, and `wormRide` resume belongs to the actual Spice Blow ride continuation. An arbitrary used token or `resume: 'wormRide'` in phase 5 must not authorize extra continuation work.
2. **Impossible overlays produce inconsistent automatic recovery.** The reviewed validator rejects direct response/decision and Box, but permits Truthtrance, a phase-opening window, or suspended Richese gift/Karama state beside the frame. `continueRoomAutomatic` skips Truthtrance/phase-opening rooms, while direct normalization drains the frame first. For these initial producers, reject impossible coexisting overlays; later reaction architecture should explicitly model allowed nesting rather than inherit permissive state combinations.
3. **Ixian sale equality is a binding check, not full sale validation.** The saved sale copy must equal the current sale, but equality alone does not validate either object. Recommended bounded checks: supported sale origin (`normal` or the actually supported Black Market path), boolean free flag, nonnegative safe-integer paid amount, seated winner and valid seller, current lot's sold outcome/winner/amount matching the sale, and a current Ixian alliance context. A cache origin currently is not an actual Ixian replacement producer. This matters particularly because the suffix can credit a Black Market seller and then continue Harkonnen/Emperor income. Do not accept matching malformed copies merely because they agree.

The sequence mechanism prevents reinserting an old frame into the current otherwise intact state. It is not a cryptographic proof against an operator rewriting both sequence counters and every associated parent receipt. Such wholesale database forgery is outside ordinary API replay protection; distinguish it from a stale client request or a singly corrupted field.

## Focused tests required for this foundation

| Test | Required invariant |
| --- | --- |
| Genuine Ixian Ambassador selection with known nonempty deck | One consumed hand card, one replacement, one completion log, no pending frame after automatic drain; input state unchanged. |
| Same operation with empty deck | Refill occurs once after frame retirement; exact physical card inventory preserved, including possible redraw of the just-discarded card. |
| CHOAM zero/one/multiple selection | Three spice per actually selected card once, zero selection creates no frame, chosen cards form one private simultaneous batch; no extra payout after normalization. |
| Last Ambassador in cohort, including a copied BG effect | Cohort replenishment/log/RNG happens once in suffix; a JSON-restored saved frame produces one new supply and correct worm-ride continuation. |
| Actual paid normal Ixian-alliance purchase | Purchase payment already committed; draw once, Emperor response/Harkonnen bonus or next lot occurs once; receipt alias in purchased auction prefix is accepted. |
| Actual Black Market Ixian replacement | Seller income once, sale outcome/index/event retained until its suffix, then cleared/advanced once. Canceled replacement produces no frame/draw. |
| Persisted current frame read by every seat | Read does not normalize or mutate stored JSON; private discarded names are absent from opponents' views; no receipt/continuation object appears in any public view. |
| Two simultaneous `continueRoomAutomatic` calls | One CAS success, other stale attempt has no resource or card duplication; fresh room-module reload sees the completed result; repeated recovery makes no additional write. |
| Replay old frame into completed state | Resolved sequence rejects it before CAS, regardless of card still being in discard. |
| Single-field corruption matrix | Wrong sequence/event/turn/phase, missing/duplicate physical card, face mismatch, hand/deck/escrow duplicate, wrong former owner/publicFace, impossible effect/token/beneficiary/resume, mismatched sale/index/event/free/card all reject before SQL mutation. |
| Action while legitimate saved frame pending | Wrong owner, replayed original decision, unrelated card play and stale request do not change JSON/version; allowed seat-control operation preserves frame exactly. |
| Legacy no-frame room | Missing counters remain compatible; repeated normalization does not invent a discard or repeat income. |

Use the existing production `db/rooms.ts`/isolated SQLite harness with a pre-CAS barrier. Unit tests alone cannot verify that recovery's scheduling predicate actually reaches the frame or that malformed data is rejected before persistence.

## Future reaction boundary

The current automatic drain correctly preserves existing behavior, but the pure Semuta helper cannot simply be inserted and followed by the same receipt validator: a successful claim intentionally removes a batch card from discard and adds it to the claimant's hand. The reaction layer will need a distinct committed/resolved receipt state and target-custody validation, plus owner-only post-commit candidate projection. Until that is implemented, keep Semuta unavailable. The current sequence and typed suffix remain useful without selecting any unresolved card ruling.

No shared project files were edited and no tests were run for this read-only review. Existing tests and the implementation should be rerun by their respective owners after the final validator changes.
