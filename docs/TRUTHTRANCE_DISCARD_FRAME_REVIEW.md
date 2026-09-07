# Truthtrance consumed-head discard continuation

Read-only bounded contract audit, 2026-09-07. Inspected `game/truthtrance.ts`, its engine callbacks, promise binding and integrity, current discard/suspended-control frames, projection/bot/room finalization, existing Truthtrance tests and the Semuta producer inventory. No runtime or tests changed. This does not select a pending rules interpretation or enable Semuta.

## Exact current resolution order

`resolveTruthAction` overlays the existing Game: battle, auction, response, decision, phase opening, exchange and other pending records remain live beneath `g.truthtrance`. It accepts both `status: 'playing'` and `status: 'setup'`. A new source-specific frame must preserve supported setup use instead of inheriting the generic playing-only frame restriction unchanged. Fresh staged setup may not yet have cards; that does not justify rejecting older/expansion setup states that do.

Declaration reserves one or multiple distinct physically held Truthtrance cards without discarding them. Each declaring player passes that priority window once. Once all seats declared/passed, the queue is stably sorted by storm order with unlisted seated IDs appended. Same-holder declared card order is retained. The first question is then chosen by that queue head's owner.

For a `truthAnswer` with Yes or No, the current prefix is:

1. Require answer stage and the actual questioned player, with a valid answer enum.
2. For structured facts, require the exact truthful aggregate answer. For shipment/battle questions, require an answer among the existing canonical feasible answers. Permanent AI cannot invent a definite freeform answer.
3. Bind a definite shipment commitment, or bind a battle-plan commitment **only when** there is a current unrevealed battle and the target has not already submitted its plan. Revealed/already-submitted plan questions can be definite without creating a new promise. Freeform answers create public history but do not become deterministic machine-enforced contracts.
4. Append one `TruthRecord {turn,phase,asker,question,answer}` and log the questioned player's public answer once.
5. Invoke the engine discard callback with the queue-head owner and exact queue-head physical card. That owner may differ from the actor who submitted the answer. Existing reserved-card/paid-search custody guards apply here.
6. `nextQuestion` shifts the consumed head; if empty, clears Truthtrance, otherwise changes the remaining window to stage `ask`, question null. Passed priority seats remain unchanged, and priority is not reopened or resorted.

The new pause belongs after the definite prefix and physical discard, before step 6 becomes live. The suffix must not call `resolveTruthAction`, answer validation, promise binding, history append, answer log or discard again.

## Concrete bounded internal contract

A suitable new variant is conceptually:

```
{
  kind: 'truthtranceDiscard',
  consumed: { player, card },
  historyIndex,
  record: { turn, phase, asker, question, answer: 'yes' | 'no' },
  remaining: { queue, passed } | null,
  resume: { response, decision, pendingKarama, phaseOpening },
  parentSignature,
  // Optional exact receipt of a newly appended promise index/value, when one was appended.
}
```

The shared discard batch supplies current turn/phase/sequence/event, exactly one public Truthtrance face, and actual former owner. No new random question/event is necessary. History index is valuable because identical questions and answers can legitimately recur; searching history for equal text does not identify the consumed answer. At the stopped stage the indexed record should be the last newly appended history item, with its exact answer/question/asker and expected history length bound. Unknown records from earlier questions/re-asks remain untouched.

The producer callback should own consumption/continuation explicitly. Merely replacing the primitive discard callback with a staging callback leaves the current unconditional `nextQuestion(g)` running immediately afterward. Either the module returns a typed completed-answer intent to the engine or a dedicated completion callback replaces both discard and queue advancement for definite answers. Keep unknown/save paths on their existing non-discard queue logic. Do not intercept every generic discard to implement this one source.

Before staging, detach `g.truthtrance` entirely and suspend its four underlying controls, leaving their authoritative non-control pending records in place. The consumed head cannot remain in a live window. Store only the already-selected remaining order; suffix restores either null or `{stage:'ask',queue:remaining.queue,passed:remaining.passed,question:null}` and the exact four controls. Retire the frame before restoring these fields. Restoring a still-consumed answer window and calling a generic advance helper is unnecessary and risks a second shift.

## Required integrity and parent bindings

- Permit playing, plus setup specifically for this Truthtrance variant. Reject finished/lobby and wrong turn/phase/sequence. Require no simultaneous live Truthtrance/search/frame/control conflict.
- Require exactly one physical public receipt whose card effect is Truthtrance, matching consumed player/card and the history asker. The questioned target must be another seated player. The batch owner is the asker, not the answering HTTP actor.
- Physical card custody must be unique in discard and absent from hands/deck/cache/removed/played escrows/current pools. A snapshot in the history/continuation is evidence only.
- Require definite Yes/No, valid question shape and exact indexed history receipt. Do not append or recompute an answer to validate recovery. Bind the completed receipt to the current authoritative history and applicable promise/battle context. If explicit newly-bound promise evidence is stored, represent “none appended” for facts/freeform and already-submitted/revealed battle plans; do not manufacture an obligation.
- Validate remaining queue entries as unique physical card IDs, each still held exactly once by its seated owner with Truthtrance effect; exclude the consumed card. Multiple cards owned by one player are valid. Preserve queue order, not just membership. Validate passed IDs as distinct seated IDs without requiring one passed entry per queued card.
- Existing `validateSavedShipmentQuestion` requires **every live queued card** to remain held and reparses the current shipment question. It cannot validate a consumed head after discard. The new frame must instead validate the recorded shipment question against a pure reconstructed pre-advance opportunity and its already-bound promise evidence, or use an appropriate receipt validator that does not require the consumed card in hand. Never reinstall a live consumed window merely to satisfy it.
- Preserve the original four underlying controls plus actual pending records. Current global frame exclusions for pending Richese gift/Ambassador/Ix records would otherwise reject supported any-time overlays; use a source-specific exception with bound original controls, not a blanket removal of those records or restriction to a handful of response kinds.
- Reuse pure shadow integrity for Stronghold, Stone/late-defense, Ornithopter, Sapho, shipment and Auditor contexts. Auditor response/payment binding must see the suspended Truthtrance-frame controls before frame drain, just as Box now does. Keep nested pendingKarama cancellation and its older response intact.
- Do not run normalization, automatic settlement, promise reconciliation, battle cleanup or a dummy answer as “validation.” Those can advance, release promises, log, draw or create context IDs. State/signature bindings detect corruption; they are not cryptographic authentication against wholesale manual rewriting.

## No-discard paths

Unknown answers still validate the applicable fact/feasibility rule, append one history record and answer log, then set stage `unknown`; the card stays in hand and no promise is added. The holder can ask another permitted question with the same card, or `truthSave` shifts only that head while retaining its physical card. Saving does not append a second answer history record and does not discard. Declaring, passing priority, asking, invalid answers, stale actors and rejected reserved-card consumption produce no fresh discard batch.

A definite answer after earlier unknown/re-ask attempts consumes the card only once; prior unknown history remains. Multiple queued cards create successive independent batches on successive definite answers, never one batch from a hand difference. An unknown/save between definite answers must not reuse a retired sequence or accidentally consume another queued card.

## Nested contexts and finalization

The existing Truthtrance overlay supports phase opening, ordinary response, decision/hand exchange, battle preparation/revealed decisions, spice windows, Terror and setup. These parents stay suspended until the entire remaining Truthtrance queue has finished. A frame suffix that restores another ask-stage window must keep automatic parent settlement blocked; a last-card suffix may permit normal finalization immediately afterward.

Paid Nullentropy search is not a supported live parent for Truthtrance: the engine's earlier paid-search gate rejects other actions. A new frame must not invent nested paid-Box access. Box/Ornithopter discard frames likewise fence new gameplay until automatic retirement. A Truthtrance overlay over an active played Ornithopter or its movement response is distinct and must retain that escrow/declaration. A later automatic movement completion may legitimately emit an Ornithopter frame after the Truthtrance frame has retired.

`finishActionContinuations` currently drains discard before setup advancement, Terror overflow completion and advisor settlement. Retain that order. In particular, definite Truthtrance can reduce Moritani's Robbery overflow to the hand limit. The consumed Truthtrance frame must retire first, then restore the old Terror decision; only if the Truthtrance queue is now empty may existing overflow finalization finish Terror and open deferred Nexus. If another question remains, do not finish the underlying Terror early.

`settleAutomaticContinuations` already stops on live Truthtrance and calls ordinary finalization after resolving response/decision effects. While the new frame has temporarily cleared Truthtrance, it must not treat the underlying suspended response as free to settle; clear those direct controls and drain the frame before automatic enumeration. `advanceSetup` must likewise not observe a temporarily empty question queue before frame retirement.

The actor distinction matters to existing post-action voluntary promise checks: the original action is the target's `truthAnswer`, while the physical discarded card belongs to the asker. Preserve existing binding/reconciliation semantics rather than pretending the asker submitted a new voluntary `card` action during recovery.

## Privacy contract

Current question text, queue declarations and completed history/Yes/No answer are already public through `viewGame`. Calling the completed answer “private” would misdescribe the existing game. What is private is the target-only pre-answer `truthAnswer`/`truthBattleAnswers`/`truthShipmentAnswers` assistance and the underlying hand, traitor, legal-plan/preparation details or which clause of an AND/OR fact matched.

A pending consumed-head frame should expose only the generic automatic-continuation marker plus already-committed public history. Do not project its receipt, remaining internal window, target legal completions or private witness data. Once restored, the next question follows the existing target-scoped projection rules. Do not emit a new computed answer for the next queue head during the frame. Tests should perturb hidden hands/traitors while preserving the same public answered result and assert unrelated projections remain equal.

## Bounded regression set

Use real declaration → all priority passes → question → answer for single and multiple holders, multiple same-holder cards and stable storm priority. Observe a real pre-drain frame through a test-only inner-dispatch seam, then verify one history entry, one promise when applicable, one physical discard, same queue order and idempotent JSON/CAS recovery. Cover fact, compound/count/spice/traitor fact, structured shipment yes/no, unrevealed battle promise and already-submitted/revealed plan with no new promise. Include unknown→re-ask→definite and unknown→save, setup fact consumption, phase opening, Auditor/BG conversion, hand exchange, Terror overflow/deferred Nexus, and response completion that can produce a successor discard frame.

Corruption cases: consumed owner versus target, wrong physical card, unknown answer mislabeled as consumed, history index/record mismatch, changed queue order/duplicate/absent remaining card, changed underlying pending control, double-restored head, stale turn/phase/sequence and replay after retirement. Real SQL recovery should confirm a single CAS winner and no answer/promise/queue replay. These are recommendations; no new tests were run for this contract-only audit.
