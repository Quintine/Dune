# Moritani retention cancellation: compulsory continuation audit

Read-only runtime audit, 2026-09-07. This document identifies the next bounded pre-cost validation slice; it does not record an implemented fix. No production or test files were changed, and no live room was read or written.

## Result

The current cancellation preflight validates the losing ally's reserved played cards and completed battle receipt, but not all prerequisites of the mandatory discard frame and following `finishBattle`. Six copied-save corruptions reproduced the same gap: printed Karama rejects atomically, while a Bene Gesserit Worthless declaration succeeds and consumes its card before the subsequent allowance rejects. The original battle and retention declaration in each probe were produced by actual dispatcher actions. The corruption was introduced separately afterward; this is not evidence of a legal live-action exploit or valid-state deadlock.

A bounded fix can compose the existing retention quote, shared discard-parent validation, and the existing aftermath/board quotes. It needs no new durable Karama frame, gameplay simulation, RNG preview, or Semuta policy.

## Rules provenance and existing behavior

The already recorded [Moritani retention rules audit](MORITANI_ALLY_RETENTION_RULES.md) supplies the source contract: Moritani's defeated ally may retain one played Treachery card if it could retain that card as the winner. The defeated ally chooses; Moritani owns the alliance power. No winner means no retention. The shared `canRetainBattleCard` predicate handles the implemented mandatory-discard card exceptions. [GF9 Ecaz & Moritani, printed p. 6](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=6)

The November FAQ confirms that Karama may cancel an alliance ability. Cancellation therefore leaves no retained card: all of this loser’s reserved played cards must be discarded. The ally-selects → response → disposal sequence and its ordering before other battle aftermath are the existing implementation choices, not newly established dedicated Moritani timing rulings. [GF9 November 2020 FAQ, printed p. 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

No new external ruling was sought or adopted in this code audit. The prior source audit records the absence of a combined expansion priority ruling. This slice preserves that existing order.

## Actual producer and continuation

Line pointers refer to the audited engine hash below.

| Location | Current contract |
| --- | --- |
| `game/engine.ts:9273`–9335, `resolveBattle` | Installs the quoted retention reservation before mandatory disposal. It settles the battle once, installs capture/technology and other aftermath records, then records `lastBattleContext` and clears the live battle. |
| `game/engine.ts:9398`, `finishWinner` | Winner casualty/substitution/card choices complete before `finishBattle` offers the defeated ally retention. |
| `game/engine.ts:12757`, retention decision | Actual ally `decision {keep: eligibleId}` changes the pending stage to `response`; cancellation window belongs to Moritani. Explicit `keep:null` takes the decline path. |
| `game/engine.ts:5263`, `validateKaramaUse` | Calls only the existing retention custody/context preflight for this response family. The separate aftermath cancellation adapter handles capture, Auditor, and CHOAM income, not retention. |
| `game/engine.ts:10184`, response settlement | A canceled retention invokes `finishMoritaniRetention(g,null)`; an allowed power passes the selected kept ID. |
| `game/engine.ts:9716`, `finishMoritaniRetention` | Removes every played ID except the kept card, logs once, clears the reservation, then stages one public `battle:moritani` batch with `battleCleanup` continuation and the consumed retention record. Cancellation always has a nonempty discard batch. |
| `game/engine.ts:2904`–3030, saved battle-frame validation | Checks battle receipt, remaining aftermath bindings, kept/discarded partition, and consumed retention provenance, including current mutual alliance. These checks currently occur after the Karama cost on the cancellation path. |
| `game/engine.ts:3082`, `stageTreacheryDiscard`; `:3107`, drain | Stages/validates the batch. Current automatic behavior retires it before calling `finishBattle`; no Semuta reaction is enabled. |
| `game/engine.ts:9409`, `currentBattleAftermathQuote`; `:9480`, `finishBattle` | Quotes remaining compulsory tech transfer/empty audit and the next response/decision, otherwise remaining battles or phase advancement. Board continuation has its own pure quote. |

The existing `preflightMoritaniRetentionCancellation` at `game/karama-battle-preflight.ts:189` explicitly limits its guarantee to the played-card discard and completed-battle context. Its narrow guarantee is accurate; the missing work is integration of the subsequent prerequisites before a separately persisted conversion cost.

## Reproduced copied-save gaps

Temporary probe: `/tmp/dune-moritani-retention-continuation-probe.ts`; output: `/tmp/dune-moritani-retention-continuation-probe.log`.

The staged starting position has canonical native leader strengths, one physical catalog card inventory, an actual mutual Moritani/Guild alliance, and an Advanced Arrakeen battle. It is a targeted position, not a claim that an entire expansion game was started through the public setup gate. Actual actions choose the battle, decline preparation powers, submit both plans, decline traitor calls, complete winner cleanup, and select the ally's retained card. Harkonnen wins with a Shield and produces its real capture opportunity; an Emperor variant reaches the board continuation. Printed Karama and a distinct BG Worthless are physically held.

| Copied change after the actual retention declaration | Printed cancellation | BG declaration | Allowance after JSON roundtrip |
| --- | --- | --- | --- |
| Actual pending capture loser replaced by an absent ID | Rejects inconsistent remaining battle effects | Accepts, Worthless discarded, `worthlessKarama` persisted | Rejects the same effects check |
| Actual pending capture territory changed from Arrakeen to Carthag | Same rejection | Same accepted cost | Same rejection |
| Emperor variant's order replaces a seated ID with an absent ID | Rejects invalid distinct player order | Same accepted cost | Same board rejection |
| Moritani's ally link cleared | Rejects consumed retention provenance | Same accepted cost | Same provenance rejection |
| Defeated ally's reciprocal link cleared | Same provenance rejection | Same accepted cost | Same provenance rejection |
| Emperor variant receives a negative aid refund entry | Rejects phase-completion refund/balance validation | Same accepted cost | Same phase-resource rejection |

All attempts verify that `applyAction` leaves its input untouched. Printed rejection therefore preserves the original physical card. A successful BG declaration returns a new state with the Worthless in the discard pile; only the later allowance fails. The probe does not perform SQL writes, so production CAS verification remains a recommended test.

Positive controls pass: printed cancellation and allowed BG conversion reach the real `captureOffer`; a printed counter-cancellation of the BG conversion restores ordinary retention, keeps the selected card, discards exactly the other played card, and reaches phase 7. No legitimate-state failure was found in these bounded controls.

## Minimum shared quote contract

1. Keep the existing source-bound response and retention quote: current playing Battle phase, exact response owner, response-stage selection, unique physical custody of every reserved played ID, loser/winner/territory and modern receipt or supported legacy seed. Add shared checks required by the **existing consumed-frame contract**, especially Moritani faction and current reciprocal alliance, before cost. This is consistency with current settlement, not a new source ruling about dissolving an alliance during a response.
2. Extract the existing battle-frame sibling-effect/provenance checks into a pure shared assertion usable both before disposal and during frame validation. It must cover the same current capture, technology, income, Auditor and Face Dance parent bindings even if an earlier aftermath decision would otherwise make `quoteBattleAftermath` stop before inspecting them. Do not invent a fake batch event or increment the discard sequence to run it.
3. Project only the known compulsory disposal: remove all `pending.played` IDs from the defeated ally’s hand, clear the retention slot in the quote input, and remove the proposed Karama cost from its owner’s projected hand once when that cost has not yet been paid. Keep those IDs in the physical inventory: moving to discard does not destroy a card. Reserved played cards remain unavailable as the cost through existing reservation checks. Paid BG allowance must not remove its already-discarded cost again.
4. Call the existing aftermath quote on that projected input. This prevents retention from being offered again and computes any hand-sensitive audit boundary from the post-cost/post-discard hand. Reuse the existing pure board/phase continuation when the result reaches `board`, including settled resources and collection only within its current supported scope.
5. Return a detached receipt containing the existing cleanup context, losing player, exact discard IDs and finite aftermath result. At actual cancellation, validate before clearing the response or retention, perform the existing discard/log/frame prefix once, and let the existing frame drain consume its suffix. No battle losses, bounty, leader death, support payments, random capture or private audit sampling may be replayed.
6. Revalidate current prerequisites on final allowed BG settlement as well as initial declaration. Preserve legitimate intervening hand/spice changes and nested controls; do not replace the selective opportunity signature with a signature over all hands, resources or unrelated pending records.

The legacy context path must continue to return an event-free seed during preflight. Actual cleanup may allocate the receipt event once as it already does. A pure quote must not draw or allocate it early.

## Boundaries and focused acceptance

| Next boundary | Guarantee of this slice |
| --- | --- |
| CHOAM battle income response | Validate its current receipt and stop at the response. If the dispatcher automatically allows it, its payment and later suffix still execute atomically unless separately covered by existing family-specific quotes. Do not claim every auto-response chain is pre-proved. |
| Multiple technology choices, capture offer, nonempty Auditor offer, Face Dance | Validate the current parent; stop at the genuine player choice. Do not choose tokens, sample leaders/cards, charge audit payments or predict later answers. |
| Single technology token / empty Auditor | Existing aftermath quote accounts for these compulsory steps without RNG. Preserve execution order. |
| Remaining battle | Validate board selection, then stop before actual battle choice and preparation. |
| No remaining battle | Existing board quote stops at the CHOAM market when present; otherwise it validates its current phase-resource/collection path. Preserve existing phase-opening and optional-module boundaries. |
| Declined retention or counter-canceled conversion | Preserve ordinary cleanup semantics; cancellation denial must not accidentally discard the selected retained card. |

Suggested focused engine tests: the six copied-save cases above reject before either kind of cost; mutations introduced only after a valid BG declaration reject its final allowance without further mutation; genuine capture, tech and board continuations preserve settled losses/payments; post-cost Auditor hand count uses remaining physical cards; counter-canceled conversion retains exactly the declared card; repeated pure quotes leave inputs unchanged and use zero RNG/event allocation. Add production SQLite/fresh-auth tests for original action atomicity, two final-allowance CAS workers, secret-hand projection, and no repeated discard sequence/log/aftermath.

Existing battle-discard persistence coverage remains relevant, but does not itself establish this missing pre-cost composition. This audit does not enable Semuta, alter retention priority, or assert complete expansion readiness.

## Audited source snapshot

These are historical review hashes, not a guarantee that later runtime edits match this audit:

- `game/engine.ts`: `90276ae411a9b913f46ccc6fc8e37dbf9df33fba9f932424777bb91c638c8e86`
- `game/karama-battle-preflight.ts`: `4050842bc6ede190416e916a84e90629fa823631beaf58324e77a13394fb529f`
- `game/battle-aftermath-quote.ts`: `7197e9a419d2c01c22c9edbaf37d186be64032198ea3839e1e459a0b64fe1ae0`

Validation performed here: one temporary in-memory probe with a genuine-decision positive case, six labelled corrupted-save cases, and a genuine counter-cancellation positive case. No broad suite, production SQL test, browser test, or runtime fix was performed for this audit.
