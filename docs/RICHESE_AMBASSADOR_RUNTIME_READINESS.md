# Richese Ambassador purchase: runtime and recovery contract

Read-only runtime design, 2026-09-07. No production/test files were changed or executed for this audit. This is an implementation proposal, not a released feature or full-expansion compliance claim.

## Source scope

The existing [Ambassador effects audit](ECAZ_AMBASSADOR_EFFECTS_AUDIT.md) and [remaining-effects review](ECAZ_REMAINING_EFFECTS_READINESS.md) establish the direct effect: pay three spice for the next Treachery card, provided the beneficiary has hand capacity. The original entry is interrupted while the effect resolves; it is not performed again afterward. Ecaz can assign the effect to its current ally through the existing beneficiary selection. The Richese token is an ordinary member of the five-token cohort; a BG token may copy Richese only through its already recorded copy pool. [GF9 Ecaz & Moritani, printed pp. 7–8 and 15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Concurrent primary-source review supplied the following composition. This audit applies those findings to software rather than claiming a dedicated Ambassador FAQ:

| Related effect | Supported composition for actual entry contexts |
| --- | --- |
| Harkonnen extra card | Base ability applies when Harkonnen buys a card; a paid Ambassador acquisition is a purchase. Apply the bonus subject to current hand capacity and its own ordinary Karama window. This is composition of the purchase wording, not a separately retrieved Ambassador ruling. |
| Emperor income | The source reviewer recommends composing the bank-payment instruction with Emperor's ability to receive another faction's Treachery purchase payment. The printed direction to pay the bank is not by itself an explicit exception to that income. Sequence the existing purchase-income effect without charging the buyer twice. If Emperor is the buyer, no self-income. |
| Ixian allied replacement | The E1 alliance explicitly qualifies purchases **during Bidding**. Current genuine shipment/movement/worm Ambassador entries occur outside Bidding. Therefore no replacement decision or discard/draw is produced for these entries, even when Ecaz is allied with Ixians. |

Sources supplied by the independent source reviewer: [GF9 base rules, Harkonnen p. 17 and Emperor p. 19](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), [GF9 Ixian & Tleilaxu, alliance p. 9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf), and [November FAQ p. 6](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf) as a comparison showing an income ability overriding another bank-payment instruction. These facts supersede the older audit's unresolved Hark/Ix purchase classification for this specific supported entry scope. They do not authorize an artificial phase-3 Ambassador event.

## Current code boundaries

| Current code | Why it matters |
| --- | --- |
| `game/engine.ts`, `openTerritoryEntry` | Establishes the real event, owner, entrant, token, territory/sector, phase/turn and `resume:'none'|'wormRide'` after physical arrival. Preserves current exclusions and gates competing arrival reactions. |
| `decideAmbassador` / `resolveAmbassadorEffect` | Validates current event and actor; owner selects self/current reciprocal ally, then commits the physical token. BG copying is a later beneficiary decision with a different physical token. Purchase resources must be assessed before payment/draw; private inability does not reject the optional trigger or undo its committed token. |
| `ambassadorEffectBlock` | Richese currently remains outside the implemented handlers. Keep valid Richese trigger/copy availability independent of a beneficiary’s private affordability. Evaluate funds, capacity and drawable pool privately only when resolving the committed effect. |
| `finishAmbassador` | Clears the entry and resumes the worm queue once; may replenish the completed ordinary five-token cohort. Do not call it between the primary purchase and child income/bonus responses. |
| `draw` (around engine2070) | Refuses unresolved discard/Box, shuffles the discard pile only if the deck is empty, clears the discard pile, then removes one top card. Charge only when a real card can be drawn; otherwise finish the committed effect generically without payment/card. |
| `handLimit` | Existing limits: Harkonnen8, CHOAM5, everyone else4. Use this function for both the primary purchase and later bonus. |
| `settleAuction` / `continueAuctionSale` | These install and require `currentAuctionSale`, lot/index/bid and phase3. Their terminal suffix advances Bidding; they are not an Ambassador purchase API. |
| `quoteAuctionContinuation` | Explicitly validates phase3, a real sale and lot. Reusing it by forging an auction would invent source facts and could advance the wrong phase. |
| `pendingRichesePurchaseIncome` / its response handler | Existing three-spice native Richese special purchase stores owner/phase/turn and saved controls. It restores that old parent after income. It does not describe an Ambassador purchase, buyer/card or subsequent Hark bonus. |
| `ixAllyCard` response and discard frame | Require a real paid auction and validate card/lot aliases, then draw and call `continueAuctionSale`. Current Ambassador entries do not qualify under the Bidding restriction and must never be routed here. |
| `harkonnenBonus` handler | Draws at current capacity, then calls `nextAuction`. Its draw portion is reusable; its suffix is wrong for an Ambassador. Existing cancellation preflight and source signature also assume an auction. |

The new work is a small source-specific acquisition continuation. A global auction rewrite or new generic durable-discard architecture is unnecessary.

## Paid acquisition receipt and finite suffix

**Final contract correction:** the proposed beneficiary-owned buy/decline stage was rejected after source review. After Ecaz's optional trigger (or committed BG copy selection), Richese automatically purchases when the beneficiary has three spice, hand room and a drawable card. Otherwise the effect completes without payment/card; the physical token remains committed. Use one generic public failure log, and do not reveal an ally's private affordability through blocked choices or precommit errors. This impossible-effect treatment is an explicitly recorded implementation interpretation; see [the finalized source findings](RICHESE_AMBASSADOR_RULES.md). There is no `purchase` stage/property or `buy` command.

The selected child response contract reuses `emperorIncome` / `harkonnenBonus` with `source:'ambassador'`, and nests `purchaseReceipt:{buyer,card,amount:3,emperor:string|null,stage:'income'|'bonus'}` under the entry. Stages remain offer/copy/cards/income/bonus. Malformed source data still rejects, but a valid privately impossible effect commits the token and resolves generically with no purchase.

Keep the original `pendingAmbassador` until the entire effect finishes. A nested typed purchase receipt can identify:

```ts
// Illustrative software shape; not a new player-visible rule.
type AmbassadorPurchase = {
  event: string;       // original Ambassador event
  buyer: string;      // exact selected beneficiary
  card: string;       // historical physical ID of the completed primary draw
  amount: 3;
  stage: 'income' | 'bonus' | 'finish';
};
```

The surrounding entry already retains original owner, entrant, physical token, effective Richese effect, phase/turn and worm continuation. Do not duplicate them into an unrelated auction object. The receipt's card ID is historical evidence of a completed purchase, not a permanent reservation: an allowed subsequent transfer of that card must not invalidate a pending bonus or require the card still be in its original hand.

Suggested narrow helpers:

1. `quoteAmbassadorPurchase(g, entry, beneficiary)` validates the actual entry/effect, seated eligible beneficiary, safe resource shapes and readable uniquely owned draw/discard piles. It privately returns whether balance is at least3, hand is below capacity and a card is drawable, together with the fixed payment/draw operation when possible. It does not shuffle, expose the top card in a view, mutate the token or sample anything.
2. One commit function consumes the direct physical token (or preserves the BG token already committed at the earlier copy step). If the quoted purchase is possible it debits exactly3, draws once, appends the card, records the receipt and logs without card identity; otherwise it completes with no charge/card and the generic public result.
3. `continueAmbassadorPurchase(g)` advances only the receipt's next unpaid benefit: Emperor income if applicable, then Hark bonus if applicable/currently below capacity, then `finishAmbassador`. It must advance the stage before opening a response, so reload/duplicate completion cannot reopen that response or repeat the primary draw/payment.
4. Shared source-neutral bonus drawing may reuse the existing capacity/draw/log code, but takes an explicit terminal continuation (`finishAmbassador`) rather than implicitly calling `nextAuction`. A canceled bonus skips this draw and completes the same Ambassador suffix.

A distinct response family or a discriminated source on the existing income/bonus families are both workable. If reusing `richesePurchaseIncome` or `harkonnenBonus`, **every** dispatcher, cancellation preflight and source binding must distinguish the Ambassador source before selecting the auction/native-Richese adapter. Require exactly one matching source; do not choose whichever loosely matches first. Bind event, buyer, fixed amount, stage and actual pending entry, and leave native auction behavior unchanged.

The original entry controls remain suspended until this receipt completes. Never store the original `ship`, `move` or worm action for replay. Arrival forces, reserve use, shipping price, movement counters, queue position and entry event have already committed.

## Payment, pool and capacity details

The beneficiary pays from its actual available balance, as other Ambassador effects act on that beneficiary. Do not borrow `payWithAlly`, auction aid or future receipts to manufacture affordability. The constant three is charged once before child income; Emperor allowance credits the designated recipient without subtracting again. Canceling income leaves the buyer's completed card/payment intact and sends the payment to the bank.

Validate the physical draw pool without executing shuffle in a quote. Existing `physicalTreacheryCards` distinguishes actual zones from historical auction/knowledge aliases. Reuse the concept; the Ix auction pool quote itself is phase-specific. Empty deck plus nonempty discard is valid. Both empty means no primary purchase occurs: the committed token is retained as used/removed and the effect finishes with no payment/card and the generic result. This no-op treatment is the selected interpretation, not a dedicated printed empty-pile ruling.

Only perform a real shuffle when `draw` needs one. Persist the resulting deck and selected primary card with the accepted action. A refresh or later benefit must not repeat this shuffle. Two concurrent attempts may each compute speculative state; ordinary room CAS admits exactly one resulting game. Tests should establish one persisted outcome, not claim the process performs no speculative computation.

Harkonnen starting with six cards acquires the paid seventh and can gain an eighth. Starting with seven acquires the eighth and gets no bonus at that point. Recheck capacity when the bonus is reached and again when allowed: legitimate card changes during the preceding Emperor response can create or remove capacity. Existing automatic behavior already finishes a full-hand Hark bonus without drawing.

Do not freeze the future bonus card or its pool before the income/cancellation window. A Karama spent during income can enter an otherwise empty discard pile and become drawable later. Conversely, a valid gift/Box may change a hand or deck. Primary purchase stays completed; later bonus uses the actual current pool. An empty bonus pool means no additional card, following the current Hark bonus behavior, rather than undoing the original purchase.

## Cancellation, nesting and private projections

Current integration touchpoints needing a source-aware branch if existing response kinds are reused:

- `validateAuctionContinuationCancellation` currently captures every `harkonnenBonus` and invokes the phase3 quote. It must delegate the Ambassador source to its own finite quote before card cost and again at actual cancellation.
- `game/karama-context.ts` currently binds `harkonnenBonus` to auction data. The new source must bind the paid Ambassador receipt and original entry instead. Preserve legitimate hand/spice changes and passed responses; do not hash the entire game.
- `finishResponse` must resume the next receipt stage instead of `nextAuction`, and native `richesePurchaseIncome` restoration must not clear or orphan the Ambassador parent.
- Saved gift/Box/Truthtrance controls and nested BG conversions must preserve the source record. The parent may be found through existing typed saved controls; a temporary overlay is not proof that the original purchase ended.
- `finishAmbassador` remains the only terminal replenishment/worm-resumption point. A fifth Richese token or fifth BG-copy trigger must not redraw its cohort before a child response completes. The physical BG marker remains removed; a Richese marker remains used until normal cohort replenishment.

Expose only the owner/beneficiary's current legal purchase choices, amounts and generic unavailability reasons. The primary and bonus card identities stay in the buyer's private hand. `pendingAmbassador` and its internal receipt should not be returned wholesale to other seats; a public stage/payer/count descriptor is sufficient. Ecaz assigning the purchase to its ally does not thereby inspect that ally's new hand.

An ordinary purchase and a Hark bonus are acquisitions, not discards. Under the sourced timing restriction this slice has no Ix replacement disposal, so it needs **no new discard-frame variant**. Existing unrelated cost/Box/Truthtrance frames may temporarily interrupt a child response and must restore it normally. No Semuta policy is selected or enabled here.

## Focused acceptance and remaining limits

Recommended tests use a conserved staged board followed by genuine entry and trigger/copy actions:

- Direct Richese self purchase and ally purchase: exactly3 paid, one actual top card, no reveal to Ecaz for an allied buyer, physical token/cohort and original entrant counters preserved.
- Empty deck/nonempty discard: one accepted recycled pool and stable selected card after refresh; truly empty pool or private insufficient funds/full hand produce a generic committed no-op. Wrong actor/stale event reject without a new cost or token mutation.
- Actual BG→Richese copy with the correct original copy pool; no synthetic direct Richese token, no premature fifth-token replenishment, decline/unavailable alternative behavior retained.
- Hark buyer at6/7/8 cards; Emperor present/absent/self buyer; each income/bonus allowed or canceled using printed and BG Karama. The primary price/card survive cancellation. Ix ally produces no replacement during actual movement/worm entry.
- Repeated final allowances and two production SQL CAS workers: one primary payment/card, at most one income/bonus, one cohort replacement and one original worm continuation. Refresh all seat views and verify secrets and absence of auction changes.
- Changed hand between income and bonus, and a depleted deck whose later Karama discard becomes available: recheck capacity/pool at the correct stage without buying again. Label copied-save mutations separately when testing missing receipt/wrong phase/event/buyer/amount or duplicate physical card rejection.

This proposal does not resolve competing arrival ordering, arbitrary future Bidding-phase arrivals, free-shipment/revival Ambassador effects, Ecaz alliance/loan/Occupy, or full expansion setup and game acceptance. It introduces no synthetic auction and no global durable frame.

Historical inspected hashes (concurrent runtime work may subsequently change them): engine `faa1af0e72e83fbd6174efbb9e76b90394d41587a02871128bc9b7c62f918576`; Ambassador inventory `03aa96e3873521ff15161831b258f4903b9ec2409b8230a47b25d6ad409ae03f`; auction continuation quote `03299adfeb276ebdfac727ea8b416a4d6dee2319aea1769aa02ef382701a45a3`.
