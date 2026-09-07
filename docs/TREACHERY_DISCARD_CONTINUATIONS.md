# Treachery discard continuation checkpoint

7 September 2026. This is a necessary Semuta foundation, **not an activated Semuta implementation**. No full-hand or reaction-clock policy has been selected. Basic, Advanced and expansion compliance remain incomplete; no start gate was opened.

Subsequent battle work is recorded in [BATTLE_DISCARD_CONTINUATIONS.md](BATTLE_DISCARD_CONTINUATIONS.md), including mandatory mixed-owner, winner and Moritani batches. The verification counts below describe this earlier exchange checkpoint.

## Implemented changes

`game/semuta-drug.ts` implements an immutable, exact-identity transfer from a current semantic discard batch. It excludes the claimant's own cards, old events, invalid card types and explicitly reserved targets, preserves remaining pile order, and discards the singleton Semuta after acquisition. Candidate inspection requires an explicit matching commitment supplied by the caller. It does not authenticate callers or establish a public reaction opportunity. The two possible capacity interpretations are required inputs without a default; incoming reservations also must be supplied explicitly. No production action invokes this helper yet.

`game/engine.ts` now separates three actual exchange paths at the discard boundary:

| Producer | Already committed in the saved frame | Remaining suffix |
| --- | --- | --- |
| Ixian Ambassador | Exactly one private card discarded; accepted entry and consumed token retained in a detached receipt | One replacement draw, private completion log and Ambassador finalization |
| CHOAM Ambassador | One simultaneous private batch; exactly three bank spice per selected card and its log | Ambassador finalization only; never repeat the payout |
| Ixian alliance purchase replacement | Purchase payment and exact purchased-card discard; original sale, normal index or Black Market event preserved | One replacement draw, then original seller/Emperor income and purchase bonuses |

CHOAM selecting no cards creates no discard frame. Canceled/declined Ixian replacement does not emit a frame. Richese cache sales do not currently offer Ixian replacement, so a restored cache replacement frame is rejected rather than inventing that composition.

`pendingTreacheryDiscard` owns detached receipt faces and a discriminated continuation, not another physical card copy, old whole-game snapshot, original client action or closure. It binds the current turn, phase and monotonic discard sequence. Exactly one unresolved sequence is permitted. Retirement precedes the suffix; subsequent normalization cannot repeat the draw, payment or random Ambassador replenishment. A fresh discard stays physically in the pile until retirement, and `draw`/ordinary `discard` reject while a frame is pending. Empty-deck refills remain legal after retirement, including redrawing the same card if it is the only physical card available.

Under current behavior the public action wrapper drains these frames automatically. Internal paused-stage fixtures exercise JSON/module recovery; the application does not yet expose them as a Semuta reaction. Future interception must add explicit offer/committed/claimed stages and validate their different physical custody. Simply calling the Semuta helper and then applying the current all-targets-still-in-discard validator would be incorrect.

## Persistence, privacy and controls

Apply, normalization and projection validate the frame before proceeding. Checks cover sequence replay, event age, former owner, exact face/custody, consumed Ambassador token or permitted Bene Gesserit copy, beneficiary/location/resume, incompatible overlays and the paid auction receipt. Purchased auction prefixes and Ix knowledge are intentionally receipt aliases; future undrawn auction cards, hands, deck, cache, removed cards and movement escrow remain physical zones.

The public view includes only `automaticContinuationPending`, allowing authenticated GET/POST recovery scheduling without disclosing receipt faces or the continuation. `continueRoomAutomatic` persists completion through the existing SQL compare-and-swap. The table says it is completing the card action and disables gameplay during that saved step. Seat-control changes remain independent and preserve the exact frame. Bot action enumeration waits, while `runBots` normalizes a saved frame even with zero gameplay steps.

The independent review identified and prompted fixes for token/effect binding, impossible overlays, matching-but-malformed sale receipts and the missing public recovery scheduling signal. [Review](TREACHERY_DISCARD_FRAME_REVIEW.md) records the original findings; they were corruption/recovery issues, not evidence of a client exploit.

## Verification scope

Registered tests: `tests/semuta-drug.test.ts`, `tests/treachery-discard-continuations.test.ts` and `tests/multiplayer-discard-continuations.test.ts`.

The engine tests observe unchanged private production functions in an isolated test VM solely to capture the real frame before automatic draining. Every resumed operation uses production exports. Database tests use the production room module, actual migrated SQLite and a pre-CAS barrier. Their documented pre-draw saved fixtures are synthetic, not claims that Semuta can be played from a public lobby.

**Final verification: 1,653 rules/client/component tests and 156 persistence/API tests pass (1,809 total).** New coverage comprises eight pure Semuta tests, fourteen engine/AI continuation tests and four SQL persistence tests. The coordinating agent read all contributed code and tests, the source update and the privacy/continuation reviews. No new complete-game or Semuta browser-activation result is claimed.

- Rules: `/tmp/dune-semuta-frame-final-tests.log`, 61.54 seconds, exit 0.
- Multiplayer: `/tmp/dune-semuta-frame-multiplayer.log`, 17.94 seconds, exit 0.
- TypeScript: `/tmp/dune-semuta-frame-final-type.log`, exit 0.
- Lint: `/tmp/dune-semuta-frame-final-lint.log`, exit 0.
- Production build: `/tmp/dune-semuta-frame-build.log`, exit 0.

The earlier full rules run passed 1,648 tests before five additional continuation cases were added. The final run above includes those cases and the updated in-app five-facet Semuta checklist. All command sessions reached terminal success; the development server was kept alive.

Browser refresh at approximately 03:28 UTC restored the existing isolated QA room at turn 2, Spice Collection, with the same human seat, empty hand, 20 spice and available Ready control. Desktop layout was visually inspected. This was a general recovery regression check, not a Semuta interaction test. The development server remains running; hourly maintenance remains manual and the removed automation remains removed.

## Still required

- Resolve the pending neutral manual opportunity versus fixed reaction clock preference and full-hand capacity interpretation. Neither was silently chosen by this work.
- Refactor the other discard producers, including Box, Ornithopter, Truthtrance and sequential Karama costs/effects. Sabotage/Robbery were subsequently completed in [TERROR_DISCARD_CONTINUATIONS.md](TERROR_DISCARD_CONTINUATIONS.md). Preserve each earned effect and its precise suffix.
- Integrate authenticated commitment/selection, private candidate views, singleton automatic selection, complete AI policies and actual desktop/mobile reaction controls.
- Handle the exact provisionally refundable Guild shipping-Karama target after its existing source question is resolved.
- Verify all producer combinations, actual claim/decline concurrency and full Advanced/expansion games. Semuta and Mirror Weapon remain inactive; Sapho's other timing modes and broad faction/module work remain unfinished.

Source and architecture references: [original audit](SEMUTA_DRUG_ENGINE_AUDIT.md), [fresh source check](SEMUTA_SOURCE_UPDATE_20260907.md), [producer inventory](SEMUTA_DISCARD_CONTINUATIONS.md), [privacy review](SEMUTA_PRIVACY_REVIEW.md). Developer source links stay outside player-facing flows.
