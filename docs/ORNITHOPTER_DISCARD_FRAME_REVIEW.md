# Ornithopter escrow retirement: discard-frame contract

Read-only current-source audit, 2026-09-07. Inspected `game/engine.ts`, `game/ornithopter.ts`, `game/advisors.ts`, bot/calibration consumers, existing Ornithopter engine/recovery tests, and `docs/SEMUTA_DISCARD_CONTINUATIONS.md`. No runtime, tests or project documents edited; no new source ruling adopted.

## Existing physical lifecycle

A valid `move` with `movementCard` removes the canonical Ornithopter from the player's hand and creates `g.ornithopter = {event, player, card, turn, mode, startingMove, completed:0}`. The original physical card is in played escrow, not discard. The movement can still await a CHOAM decision or a normal Fremen/Ixian faction-speed response. The card is already played in those states; it cannot be treated as an unplayed hand card or returned by merely canceling faction speed.

`finishOrnithopter` has exactly two production callers: final completion inside `completeMove`, and `endMovement`. It currently pushes the escrow card to discard, clears escrow, and logs completion. It does not call `discard`, because the physical card is not in hand. The one new batch must be the actual escrow card, public face, `discardedBy: flight.player`; the action initiator may instead be the CHOAM decision owner or a response passer/canceler.

## Two distinct prefix/suffix contracts

### A. Final group completion

By the existing `finishOrnithopter` call in `completeMove`, the following is already committed on the action clone:

- The movement and flight event were validated. The first two-group move saved original remaining typed quotas before removing its selected group.
- A moved No-Field changed location and received its new marker event; its hidden denomination was not revealed. Movement total counts the marker as one presence, while physical force placement subtracts that one marker.
- The selected ordinary/elite group left its sources and arrived; advisor state was applied. A generic `wantsFighters` arrival would install its advisorFlip response here.
- Unused shipment promises were checked/finished, `shipped` is true, and both `moved` and `flight.completed` were incremented.

The discard prefix then moves the physical escrow card to discard, clears escrow, and logs its completed count once. The frame must stop the caller here rather than let it execute the remaining lines.

Remaining suffix, in original order: clear `karamaShipping`; write the movement log; invoke `intrusion`; if origin differs from destination, invoke `openTerritoryEntry(..., 'movement')`. This suffix may create a real BG intrusion, Terror or Ambassador decision. It must not revalidate/reperform the move, remove forces again, regenerate the marker event, recreate the cohort or increment a movement. Revalidating an old route against post-move custody is incorrect.

A bounded continuation can retain `{kind:'ornithopterMove', flight, movement:{player,origin,to,sector,total,elite,noField}, resume}`. `noField` here is a presence/logging fact or the minimal already-public movement binding, not a copied hidden marker inventory. The final movement order may be stored as immutable evidence if useful, but its original source group is never an instruction to replay.

The generic completeMove can set advisorFlip before the retirement point. However, current supported public Ornithopter paths prohibit advisor origins; `arrivalAsAdvisor` can then identify an advisor destination only where the owner already has advisors, and `wantsFighters` requires no existing own destination forces. Consequently, current public Ornithopter play does not produce that response. Do not enable the pending advisor/Ornithopter rule combination merely to support this refactor. If extracting a general shared movement suffix, retain defensively bound controls or move only response creation into the suffix with identical ordering; do not silently discard a response.

### B. End movement early

`endMovement` first checks/finishes shipment promises and verifies phase 5/current actor. If the actor has active escrow, it retires the card even after zero completed group moves. Zero is reachable after an actual declared flight was prevented; the initial card itself cannot be played standalone without a movement declaration.

The frame prefix is only escrow-to-discard, clear escrow and completion log. The actor remains active and still in `movementRemaining` until the suffix.

Remaining suffix: clear `karamaShipping`; initialize legacy movementRemaining if absent; apply the existing allied co-occupation tanks deadline (including the existing newly formed alliance exception); remove only this actor; clear its Sapho-last marker; call `movementTurn` once. This may yield a Guild timing choice or begin Battle, so it cannot overtake the frame. A bounded `{kind:'ornithopterEnd', flight, player, resume}` discriminant prevents confusion with completed-move arrival processing. Do not replay the public endMovement action or repeat a fulfilled shipment commitment.

## Validation of a saved retired flight

Use current turn/phase plus existing flight event and the global discard sequence. No new random flight event is required. Before any projection, action or automatic recovery validate:

- Playing, phase 5, seated owner, current active equals owner, original flight turn equals current turn, nonempty original event, canonical Ornithopter card, valid mode and safe integer starting/completed counts.
- Exactly one public batch entry, effect-specific cause, former owner equals flight.player, receipt ID/face matches the actual card uniquely in discard, absent from every physical hand/deck/cache/removed/current-pool/unconsumed-auction zone. `g.ornithopter` is null. Flight snapshot is evidence, not second custody.
- Owner moved equals startingMove plus completed. For final movement, completed equals the mode's total (range3:1, twoGroups:2). For early ending, completed is in `[0,total)`. Do not call current `ornithopterIntegrity` on a reinstalled completed flight: it deliberately requires completed strictly below the total and actual escrow absent from discard.
- The final-move payload belongs to that owner/event and valid source/destination/sector; positive total includes any marker presence; elite count is nonnegative and within physical total. Preserve same-territory sector moves: those log and invoke intrusion but do not open a new territory-entry opportunity. Do not infer marker denomination or require its old event after the prefix already replaced it.
- Parent controls and still-live obligations must be bound and suspended coherently; the original `pendingChoamMove`, `pendingIxMove` or `pendingFremenMove` has normally been cleared before actual completion. A completed flight must not leave an old pending declaration that could move twice. Preserve an unconsumed shipping-rate record until its original suffix clears it, rather than inventing new rate/refund semantics.
- For early ending, preserve the actual queue, Guild timing flags and Sapho record until suffix. Do not demand that queue[0] equal active when a granted Guild turn uses a different physical queue order. Preserve the existing legacy-null queue fallback.

A saved binding can detect inconsistent single-field edits and retired-sequence replay; it is not proof against wholesale manual rewriting of every field. Do not validate the final movement by replaying a cloned original action. Use narrow structural/custody and event/count checks or an immutable committed movement receipt.

## Paths with no new Ornithopter discard

- First successful group of twoGroups: escrow stays, completed becomes 1, original typed remainder persists.
- A CHOAM decision is still pending; Baliset prevents entry; or `resumeChoamMovement` finds the declaration no longer legal: no group moves and the played card stays in escrow. Revised legal movement or explicit early ending remains possible.
- Fremen/Ixian normal-range Karama cancellation: no move is spent; escrow and original flight event remain, and replacement movement must use the restricted normal range. Fixed range3 does not open those faction-speed responses.
- Invalid initial card declaration, source, range, storm or reserved card: the whole cloned action rejects, so no lasting escrow removal or discard. A stale second-group event similarly rejects without changing custody.
- Sabotage after the first group targets a hand card, not the escrow card. A Sabotage gift, No-Field reveal, Truthtrance answer or unrelated card use does not itself retire the flight.
- No escrow at endMovement: normal existing turn completion, no empty discard frame.

## Nested controls and automatic consumers

A paid Box can suspend a movement decision/response while Ornithopter remains in escrow. Its existing physical custody validator excludes that escrow from selectable/discarded cards. Box frame retirement restores its parent before normal movement resolution; a final movement may then produce the separate Ornithopter frame. Retire each frame first, permit a successor frame, and never merge Box and Ornithopter into one batch.

Active Truthtrance locks the underlying movement decision until its queue finishes; it does not own the flight card. Its eventual restored continuation may complete a group. No live consumed Truthtrance queue head should be carried into the Ornithopter frame. BG Worthless Karama conversion can wrap a Fremen/Ixian movement-speed response; its activation/discard and cancellation result remain separate from later escrow retirement. Do not turn canceling a faction advantage into canceling Ornithopter itself.

Current automatic machinery may call completeMove indirectly through `finishResponse` → `offerChoamMovement` or `resumeChoamMovement`. Frame draining must therefore work both after a direct public move and during automatic response settlement. A caller must return at the new frame boundary, then resume only the saved suffix. If that suffix raises a currently supported entry-choice decision, leave it for its owner; if the current engine rejects an unsupported competing-arrival combination, preserve that behavior atomically rather than enabling a partial movement.

No engine reachability search directly calls finishOrnithopter or completeMove: the latter's callers are offerChoamMovement and resumeChoamMovement. Bot candidate generation uses public projection and pure cohort checks; runBots and the calibration harnesses apply full authoritative actions and therefore should receive a fully automatically drained result. Existing battle/shipment trial searches execute other card effects on clones and do not retire Ornithopter. Do not add generic frame creation to unrelated `discard` calls to implement this one producer. A test-only inner-dispatch VM can observe the real pre-drain frame without adding a production simulation seam.

## Existing evidence and recommended bounded checks

Existing engine/review tests cover all twelve holders in both modes, fixed range, two typed groups, quotas after merging, No-Field replacement quotas, actual CHOAM arrival decisions, real Ixian cancellation/revised movement, Sabotage while escrow is held, early ending and privacy. Existing SQLite recovery covers active escrow and actual movement actions; it is not yet evidence of a new retired-flight discard frame.

For the new frame, add genuine final range3/second-group movement and explicit early ending after both zero and one completed groups; verify post-prefix forces/counters/card/log never replay. Cover same-territory movement and one-marker No-Field accounting, actual CHOAM-deferred completion, real speed cancellation with no frame then early end, restored Guild/Sapho queue ordering, and Box frame followed by movement retirement if supported. Check JSON/CAS recovery, wrong owner/event/completed count/destination/duplicate custody rejection, all-profile bot recovery, hidden cohort/marker projection, and final arrival reaction versus end-turn separation. No new tests were run for this contract-only audit.
