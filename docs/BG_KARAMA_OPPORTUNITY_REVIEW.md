# Persisted BG Karama opportunity review

Independent bounded current-source review, 7 September 2026. Initial code inspection preceded the coordinator's preflight/opportunity patch; the follow-up section distinguishes that patch. No runtime or package edits by this reviewer. The separately assigned new engine regression file is `tests/bg-karama-opportunity.test.ts`.

## Confirmed live-action defect: direct purchase plus Richese gifts

Reproducer `/tmp/dune-bg-karama-gift-probe.ts`; terminal output `/tmp/dune-bg-karama-gift-probe.log`. It uses a conserved base deck/Richese cache and an explicitly staged normal auction, then actual `card`, `richeseGift` and `passResponse` actions. BG holds three cards including the activating Worthless. A direct free-purchase declaration consumes it and opens `worthlessKarama`, leaving two held cards while the existing auction bidder remains Emperor. Richese, a mutual ally, gives BG Ornithopter and then Stone Burner through two actual nested gift windows. BG reaches four cards. Allowing conversion sets the bidder to BG and awards the original lot as a fifth card; the game advances to Revival. No state mutation occurs between those accepted actions.

The cause is precise: `validateTransferCompletion` reserved capacity for `g.auction.bidder`, whereas a pending `purchase` does not set that bidder until `completeKarama`. `settleAuction` appended the card without a capacity guard. It is insufficient merely to reject the final pass after accepting a gift that destroys a mandatory completion. The incoming slot must be reserved during gift validation, including when the conversion itself is suspended in the gift's resume. The first gift leaving one slot must remain legal; only the second filling that slot should reject before any gift prefix.

Distrans is not a second demonstrated auction exploit: `distransBlock` expressly blocks an unresolved unpaid normal/Richese lot. `auctionPayment` already retains BG as the winning bidder, so its existing transfer guard reserves the slot; that path is a useful non-regression/control.

## Existing four-use boundary before the new patch

The original `KaramaUse` stored a canceled response for `cancel`, recipient/card for `shipment`, and only a kind for `purchase`/`auctionPayment`. `pendingKarama` stored owner/use. There was no general opportunity stamp in apply, view or normalize. A direct `worthlessKarama` response was resolved by clearing pending and executing its stored use. Consequently a manually replaced normal lot/bidder/index, changed turn/phase or changed shipment recipient could direct a saved conversion at another opportunity. These are **saved-state corruption/replacement defects**, not a demonstrated public action that bypasses the response lock to advance the auction or movement turn.

All four existing outcomes need distinct treatment:

- `cancel`: restore the actual older response and run its existing cancellation once. If the conversion is canceled, restore the older response without canceling it. Private payloads stay in the saved use, not the public intent summary. Do not validate by executing cancellation; some branches draw, sample, settle or emit successors.
- `shipment`: preserve the same active, unused recipient and absence of an installed rate. The cost's physical card ID is carried forward for existing rate/refund handling. Do not freeze that recipient's balance/hand or invent a new refund/ownership ruling.
- `purchase`: preserve the original unresolved normal lot and reserve an incoming slot for BG even before changing the original bidder. Cancellation must leave the prior bidder/bid intact.
- `auctionPayment`: preserve the original winning bidder and lot. Cancellation returns to existing payment recovery; the provisional unfunded fallback remains an unresolved-rules limit, not an excuse to reinterpret or charge a different lot.

The known Richese auction-count cancellation guard was an actual mandatory-suffix hazard: the BG Worthless declaration could be saved before `finishResponse(..., true)` reached its explicit unsupported-count error. A printed card attempted the same cancellation atomically and rolled back. For BG the accepted conversion could then have no successful allowance; counter-canceling it restored the original count response. This is an existing guarded rule with missing early validation, not a new proposed ruling. The coordinator's pure `validateKaramaUse` now rejects that count target before discarding. This review has not exhaustively certified every other cancellation continuation.

## Preserve allowed interruptions instead of freezing Game

The meaningful binding is the original opportunity, not an immutable complete game snapshot. Response passes, seat AI control, logs and legal private hand/resource changes must be excluded. Hands may change through a supported Richese gift; outside an unpaid lot they may change through Distrans. Truthtrance declarations/questions/answers can consume another card and append public history while leaving the conversion intact. A paid Box can spend its fee, recover a card and reorder the discard before restoring conversion. These operations must not invalidate a correct auction or shipment identity simply because their legitimate private state changed.

Binding can include owner/use, current playing/Advanced/turn/phase, and:

- Normal auction: exact lot/card/index, bid/bidder and funding commitment, opener/current active/order, no overlapping Richese lot or already-paid sale. Existing user actions cannot bid/pass that underlying lot through the conversion response.
- Shipment: recipient, active/unused shipment, current rate absence and applicable movement opportunity/queue.
- Cancel: eventual source-specific response identity/context, including the older pending records needed by that response. This requires its own bounded follow-up; do not blindly hash all hand or money data used by valid interruptions.

Validate the saved conversion wherever it resides: direct `pendingKarama`, a gift/Box/income/summoned parent resume, or a saved discard continuation's resume. Harkonnen exchange currently retains the direct pending record while saving response/decision separately. Nested pending-record validators should inspect a restored shadow, never perform the old use. Capacity reservations must use these same reachable saved conversions, not just the direct field.

Physical consumption is already complete at this boundary. Do not require the activating Worthless to remain in BG's hand; do not bind the complete discard pile merely because the original cost was there. Box and Truthtrance can legitimately change that pile. Any particular existing reservation for shipment refund custody should be preserved separately without deciding new Semuta transfer/full-hand policy.

## Projection review

`viewGame` omits `pendingKarama`. Its public response includes only the conversion's readable intent, owner and that viewer's passed status; the older cancellation response and its private amount/identity remain internal. `responseControls.cancelCards` is calculated from the current viewer's own physically spendable cards, not another hand. No newly demonstrated cross-seat private leak was found here. New opportunity signatures likewise must remain unprojected. Player-hand/traitor/spice privacy and Truthtrance target-only assistance remain their existing separate contracts.

## Coordinator patch observed during review

Current new code adds optional `pendingKarama.opportunity` for new shipment/purchase/payment conversions. `savedKaramaConversions`, `karamaOpportunitySignature` and `karamaConversionIntegrity` enumerate the direct and suspended parents, bind the original opportunity while excluding hands/resources/passes/log/AI, and preserve metadata-absent legacy conversions. `normalKaramaAuction` checks current normal lot and capacity; `validateKaramaUse` runs before spending and before completion. Transfer completion now also reserves the confirmed pending direct-purchase slot across the same direct and suspended conversion contexts. Existing no-metadata legacy support cannot retrospectively authenticate a different old lot; it should retain appropriate current structural/capacity checks without inventing an original identity.

A remaining narrow corruption-only limitation should not be confused with a live exploit: opportunity binding does not itself fully type-check every possible direct conversion response or all old cancel-use contexts. Matching conversion owner/kind and source-specific canceled-response parents deserve explicit tests when that separate scope is implemented. This report does not claim the present non-cancel metadata completes all Karama integrity work or creates a Karama cost-discard frame.

## New regression contract

The new assigned tests use genuine BG declarations after physically sourced component setup. They require one allowed nested gift, second-gift rejection before mutation, unchanged JSON-restored conversion/lot, and exactly one award. They retain winning-bid conversion gift/cancellation behavior, permit actual Distrans and Truthtrance interruptions of a shipment conversion, reject changed new auction/index/bidder/turn/phase/use/recipient opportunities, and preserve legacy unstamped completion. The released `tests/bg-karama-opportunity.test.ts` passes all four tests (0.22 seconds; `/tmp/dune-bg-karama-opportunity.log`), including 21 malformed-opportunity variants across the three newly stamped uses. Named formatting/lint and full TypeScript checks pass (`/tmp/dune-bg-karama-opportunity-tsc.log`). The original overflowing-action probe is preserved as historical pre-fix evidence. No remaining valid-action failure was found in this bounded interruption review.

Current post-patch navigation anchors: `game/engine.ts:1528` transfer completion, `:1616` Distrans validation, `:1695` Richese gift gate, `:4693` saved conversion enumeration, `:4709` opportunity signature, `:4743` integrity, `:4760` normal auction prerequisites, `:4801` use preflight, `:4852` spending, `:4885` completion and `:9523` response settlement. These line numbers are a review snapshot; named functions remain authoritative if subsequent edits move them.
