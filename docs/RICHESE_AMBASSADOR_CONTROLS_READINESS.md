# Richese Ambassador controls readiness

Reviewed 2026-09-07. The final implementation contract is automatic resolution after Ecaz triggers and assigns the benefit. There is no additional beneficiary purchase decision. An earlier design considered separate consent; that would add a choice absent from the printed effect and is not the adopted contract.

## Source and agreed composition

The [GF9 Ecaz & Moritani rules, pp.7–8](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=8) give Ecaz the optional trigger and beneficiary assignment. Richese's effect pays three spice to the bank for the top Treachery card when the hand is not full. See [ECAZ_AMBASSADOR_EFFECTS_AUDIT.md](ECAZ_AMBASSADOR_EFFECTS_AUDIT.md) for the original source record. The coordinator's concurrent primary-source review owns purchase modifiers and their final settlement classification; this controls review makes no independent Harkonnen or Ixian ruling.

The final engineering contract consumes the triggered token, then automatically performs the purchase if executable. If it cannot complete, it takes no spice and draws no card, finishes the effect and publishes only a generic no-card result. This conditional failure policy is the coordinator's composed implementation contract, not a separately quoted FAQ. There is no later buy/decline command and no acknowledgement-only card-result stage.

## Projection and privacy

`game/engine.ts` projects `ambassadorEntry` with public event, owner, entrant, territory, effective effect, stage and beneficiary. Ecaz alone gets beneficiary choices at `offer`; the beneficiary alone gets choices at `copy` or `cards`. Opponent hand counts are public only during Bidding, and an ally's spice balance is not generally public.

The Richese beneficiary list must depend on public eligibility and supported faction combinations only. Do not put an ally's private affordability or hidden hand fullness into `ambassadorEffectBlock` as projected to Ecaz. An ally row must not disappear, become disabled or change reason when only those private facts change. The same restriction applies to Ecaz's aggregate BG-copy eligibility for an ally. A beneficiary's own copy options may use its private information, but none of that availability should be copied into other seats' views.

No purchase descriptor is necessary: the only actual choice is trigger/assignment or BG-copy selection. The server performs canonical current hand-limit, current personal spice, card-custody and draw-availability checks at commitment. Pledged/incoming resources do not become available personal spice merely because shipment controls expose them. Projection must neither sample a top card nor reveal the hidden draw pool, exact private failure reason or random index.

All seats see the same generic failure outcome. They can observe a successful purchase and its fixed public transaction, but must not receive the failed precondition or a hidden-state-derived extra decision window. Public action consequences are distinct from an advance affordability oracle.

## UI contract

`components/ecaz-entry.tsx` retains the existing trigger-for-self/ally and leave-in-place buttons. For Richese, the offer states that triggering automatically spends three spice from the selected beneficiary and draws a card if executable; otherwise neither occurs, but the token is used. This makes the financial consequence clear before the only optional action.

BG's Richese copy choice describes the same automatic payment using the beneficiary's own spice and explains that BG remains removed even when no purchase completes. There is no payment form, card picker, extra confirmation or result acknowledgement. The acquired card appears in the recipient's existing private hand and inspector.

Explicitly limit this component to `offer`, `copy` and `cards`. New `income` and `bonus` stages belong to response controls; they must not fall through into the existing card-discard panel. Preserve the existing 44-pixel controls, busy-state disabling and original token inspection. Full Ecaz start gates remain unchanged.

## AI contract

The narrow Ambassador branch in `game/bots.ts` can use only the current decision owner's `GameView`.

- At Richese offer, prefer self only when its own current spice is at least three and its own hand has room. An eligible ally is still a possible recipient regardless of unprojected affordability. With no useful self benefit and no ally, leave the token in place.
- Add Richese explicitly to copy priorities. If its own balance or hand makes the purchase unusable and another supported copied effect exists, choose another effect. If Richese is the only supported choice, resolve it instead of stalling the already committed BG token.
- Return no card-selection action for response-owned income/bonus stages. Existing response policy handles their actual owner.
- No level inspects another seat's private hand, balance, deck order or unprojected purchase quote. All four levels use the same legal boundary; existing strategic priorities remain otherwise intact.

## Runtime and recovery boundaries

The current offer pipeline commits the token before `resolveAmbassadorEffect`. Preserve that ordering and the frozen BG copy cohort. Keep the original event/entrant/territory and ordinary or worm-ride resume record. Do not change `g.active` to the beneficiary or replay the entrant's paid shipment/move.

Payment, card acquisition and any source-supported purchase modifiers must use the coordinator's canonical acquisition path. A subsequent response may own `income` or `bonus`; those are actual rule opportunities, not consent for the original purchase. Finish the Ambassador and recycle the five-token cohort only after the full effect and its children finish. Reconnect and duplicate commands must not repeat the charge or draw.

## Focused evidence required

Actual entry tests should cover all four bot profiles buying for self, choosing an ally without inspecting its affordability, preserving the token when self has no useful purchase and no ally, and choosing an available alternative to an unusable BG Richese copy. Verify successful one-charge/one-card automatic completion, used-token generic no-card completion, and no fabricated purchase stage.

Paired Ecaz views must remain equal when only an ally's private balance or non-Bidding hand count changes. After resolution, assert that no-card logs do not distinguish those causes. Nonowners must not acquire decision actions or see newly drawn card identities. Wrong actor, stale event, reconnect and concurrent settlement remain coordinator engine/SQL coverage.

The historical unsupported-effect list in `tests/ecaz-entry-bots.test.ts` must remove Richese once enabled. New focused coverage belongs in `tests/richese-ambassador-bots.test.ts`; this document does not claim those tests have passed before their execution.
