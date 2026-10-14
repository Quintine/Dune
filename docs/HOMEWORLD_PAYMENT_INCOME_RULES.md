# Low Kaitain and Junction: faction payment income

Source-composition contract, 9 September 2026. This covers population-based reductions to existing Emperor and Guild payment receipts. It does not implement occupied income, decide competing Occupiers or certify a complete Homeworld module. [Occupation source boundary](HOMEWORLD_OCCUPATION_RULES.md).

Runtime follow-up, 5 October 2026: the fresh occupation profile now has a
[separate original percentage ledger](HOMEWORLD_OCCUPATION_RULES.md#occupied-economics-bidding-and-advanced-source-cutover--5-october-2026).
The unoccupied contract below remains historical authority for ordinary native
receipt reduction, not for canceling a printed occupied share.

## Printed effects and source precedence

The verified low faces say that native Emperor receives the rounded-up half of Treachery Card payments and native Guild receives the rounded-up half of shipping payments. Both are low at zero through four native forces. Kaitain population is its own physical native pool, excluding forces allocated to Salusa Secundus. Component provenance is recorded in the [Homeworld component audit](HOMEWORLD_COMPONENT_AUDIT.md); this pass did not re-download its historical reverse-image cache.

The E3 Kaitain FAQ's five-spice purchase produces Emperor three and occupier two, even if the occupier bought the card. This supports a division of the existing payment, not an additional buyer charge. It supplies no allied-contribution example. E3 also makes Homeworld penalties Karama-immune and describes threshold effects as continuously dependent on native population. [GF9 E3, pp.9–10,15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9).

Preserve the November FAQ's contribution routing before applying Junction's cut: non-Guild contributions eligible for shipment income go to Guild; Guild's own contribution goes to the bank. Preserve the existing independent-Karama bank-only route. The later funding answer replaces the earlier transfer-to-shipper instruction. This source adjudication and its Guild-as-shipper application are already documented in [Guild shipment payments](GUILD_SHIPMENT_PAYMENTS.md#publisher-contract-and-precedence), with the [November FAQ, p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2). No new contributor-rounding ruling was retrieved in this audit.

## Supported receipts and ruled whole-invoice rounding

The coordinating implementation keeps these operations separate:

1. Validate the transaction’s actual authorized contributions. Complete admitted purchases or shipments and debit each contribution once under the transaction’s own source rule. Two eligible odd contributions are admitted under the 14 October user ruling; the former comparative fence is removed.
2. Determine the amount that the existing ordinary income rule would deliver to the eligible faction. This `gross` is the faction's eligible receipt, not necessarily the total cost.
3. If ordinary faction-income cancellation succeeds, credit zero and leave that eligible amount in the bank. Homeworld immunity does not immunize the separate ordinary income advantage.
4. Otherwise evaluate the native world’s current low condition at income settlement. Credit `ceil(gross / 2)` once for the whole eligible invoice and leave the remainder in the Bank. Without the low condition, credit `gross`. Payer costs and contribution routing do not change.
5. Keep original gross and positive eligible contributions immutable and server-private through responses. Recompute current low-state previews without repricing the purchase, merging payer evidence or halving an already reduced amount.

**14 October user ruling:** round the whole eligible invoice once, not each contribution. For final Bank attribution, floor each remaining contribution’s half, then assign extra Bank rounding units primary payer first and ally second internally. Bureaucrat’s flat two is attributed to the first individually eligible contribution in that same order; it combines only with that payer’s other actual Bank portions of this original invoice. No funding/eligibility identity is exposed and unrelated invoices or different payers never pool. These are selected user interpretations, not new publisher examples.

**Current population at actual income settlement is also a source composition.** Continuous threshold wording supports applying the condition when the faction receives spice. The publisher supplies no worked example of Ghola changing the native population during an already-open payment response. The implementation must label this composition honestly and test it; it must not reprice the buyer's completed purchase or shipment when the recipient's population changes.

| Supported or deferred example | Low native receipt | Bank portion of the total payment |
| --- | --- | --- |
| Five-spice auction payment eligible for Emperor | 3 | 2 |
| One shipment funded by two non-Guild payers, 1 + 1 | **Pending ruling: 1 or 2; blocked before commitment** | **Pending: 1 or 0** |
| One shipment funded by two non-Guild payers, 2 + 1 | 2 under either interpretation | 1 |
| Shipment cost 5, with Guild contributing 2 | 2 from eligible gross 3 | 3: the Guild-funded 2 plus the cut 1 |
| Guild's own shipment, personal 2 plus non-Guild ally 3 | 2 from eligible gross 3 | 3 |
| Independent Karama bank-only payment | 0 | Entire actual payment |
| Zero-price/free acquisition or shipment | 0 | 0 |

The supported multi-payer arithmetic examples deliberately use splits on which both interpretations agree; the five-spice Kaitain split has the cited E3 worked example. The blocked 1 + 1 case is recorded to make the unanswered choice concrete. A paid tariff discount and a reduced income receipt are separate calculations. A recipient cannot spend its future income to fund the same transaction.

## Income-source adapters

| Source | Existing destination/classification to preserve before applying the cut |
| --- | --- |
| Normal paid Treachery auction | Emperor income from another faction's payment; the Emperor's own purchase gives no self-income. Free Karama acquisition supplies no paid receipt. |
| Richese compulsory cache auction bought by Richese | Emperor or bank normally. This destination is explicit in E2 p.5; a positive Emperor receipt uses Kaitain's cut. |
| Richese cache auction bought by another faction | Richese receives its sale proceeds. Do not send them to Emperor merely because the physical item is a Treachery Card. |
| Richese Black Market hand-card sale | Preserve its separately specified seller-income destination and existing self-sale handling. This document does not resolve the older self-sale gap or redirect the seller's receipt. |
| Richese advanced special Karama three-spice cache purchase | Existing composition treats the purchase payment as Emperor income. Apply Kaitain's cut to that receipt; do not cancel or replay the protected special purchase when ordinary income is canceled. |
| Richese Ambassador three-spice paid draw | Existing composition treats a successful paid draw as a purchase. Another purchasing faction supplies Emperor income; Emperor as buyer supplies none. A failed conditional draw supplies no payment. Preserve its Ambassador continuation and subsequent Harkonnen bonus. |
| Ordinary reserve, Guild cross/return and admitted Homeworld shipment | Preserve each route's price, payer routing and actual eligible Guild income, then apply Junction's cut. Being a Homeworld route alone does not redefine the receipt. |
| Junction-sponsored transport | Preserve the explicit route quote and donor contributions. The high transport permission and later low income condition are different effects; do not replay the completed route if population changes before income. |

The Emperor trigger and the two special-purchase compositions are sourced in [Richese acquisition rules](RICHESE_ACQUISITION_RULES.md#1-advanced-special-karama-purchase) and [Richese Ambassador rules](RICHESE_AMBASSADOR_RULES.md). The publisher directly confirms Richese cache self-purchase routing in [GF9 E2, p.5](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=5). Black Market has its own [source contract](RICHESE_BLACK_MARKET_RULES.md#official-expansion-anchors). The special purchase and Ambassador destinations are general-rule compositions, not claims of dedicated GF9 FAQ answers.

Do not reduce unrelated Emperor/Guild bank awards, charity, revival income, ordinary Collection, sales to CHOAM, or Kaitain's paid card disposal. In particular, the Emperor Ambassador's five bank spice is not a Treachery payment; free Guild Ambassador transport does not manufacture shipping income.

## Occupied branch remains separate

The unoccupied calculation leaves the missing half in the Bank. The fresh
occupation profile instead assigns that rounded-down portion to its proved
occupier, independently of the printed Collection bank icons. Advanced uses the
authorized supplied p22 sole/last-departure lifecycle; Basic retains guarded
historical cases. Native repopulation does not expire a retained Advanced source.

The original eligible paid receipt, present force state and original qualification
history remain distinct. Native income Karama sends only its native portion to
the Bank; the printed occupied portion survives under Homeworld immunity and may
be immediately shared with the reciprocal ally. This is explicit source
composition, not a dedicated retrieved worked cancellation FAQ. The payer’s
completed debit and delivery never repeat. Whole-invoice rounding is now ruled;
independent-Karama Bank routing and Guild Nexus full-fee overrides remain distinct.
No past receipt is back-awarded. The separate fresh classic Homeworld Banker entry
is documented in [the current runtime](SPICE_BANKER_RUNTIME.md#classic-homeworld-final-bank-income--14-october-2026).

### Guild Nexus Betrayal is a full-fee exception

The [original Guild Nexus face and bounded payment contract](NEXUS_GUILD_RULES.md#nexus-guild-betrayal) expressly take one whole shipment payment, including one's own, and override occupied Junction income. For an accepted use, preserve the original **charged total**, not only this document's eligible `gross` or `ceil(gross / 2)`: the holder receives all of that fee once, and ordinary Guild/bank/occupier settlement for this invoice is suppressed. A four-spice fee yields four to the holder, not two plus two to an occupier. The original payer and authorized escrow still fund it once before any own-payment refund; future receipt is not upfront funding.

This exception does not decide occupation owner/expiry or retained penalties. All-pass/no-use settlement retains original routing with the separately ruled whole-invoice rounding; hypothetical Nexus play supplies no new ordinary permission. Free or stopped transport has no positive fee to redirect. The explicit fresh classic/Guild/Nexus profile uses genuine Homeworld custody and existing shipment/Junction adapters, not a new route or sponsorship. Its [bounded local verification](NEXUS_GUILD_RULES.md#verification-and-release-boundary) remains distinct from the new Homeworld Banker entry, which excludes Nexus.

## Required verification before a runtime claim

Meaningful regressions cover odd/even and zero receipts, whole-invoice two-odd contributions, both original contributor identities, final per-payer Bank thresholds, cancellation without refund and preserved occupied shares. Existing threshold-change, source-binding and native routing regressions remain relevant. Comprehensive recovery, privacy and full-family acceptance follow all rules; targeted payment evidence is not a substitute.

The 9 September source audit is historical. Current native consumers, actual CLI/phone proof and the frozen292-case related union are recorded in [the current runtime](HOMEWORLD_PAYMENT_INCOME_RUNTIME.md) and [Banker contract](SPICE_BANKER_RUNTIME.md#classic-homeworld-final-bank-income--14-october-2026), not full-module certification.
