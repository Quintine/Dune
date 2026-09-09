# Low Kaitain and Junction: faction payment income

Source-composition contract, 9 September 2026. This covers population-based reductions to existing Emperor and Guild payment receipts. It does not implement occupied income, decide competing Occupiers or certify a complete Homeworld module. [Occupation source boundary](HOMEWORLD_OCCUPATION_RULES.md).

## Printed effects and source precedence

The verified low faces say that native Emperor receives the rounded-up half of Treachery Card payments and native Guild receives the rounded-up half of shipping payments. Both are low at zero through four native forces. Kaitain population is its own physical native pool, excluding forces allocated to Salusa Secundus. Component provenance is recorded in the [Homeworld component audit](HOMEWORLD_COMPONENT_AUDIT.md); this pass did not re-download its historical reverse-image cache.

The E3 Kaitain FAQ's five-spice purchase produces Emperor three and occupier two, even if the occupier bought the card. This supports a division of the existing payment, not an additional buyer charge. It supplies no allied-contribution example. E3 also makes Homeworld penalties Karama-immune and describes threshold effects as continuously dependent on native population. [GF9 E3, pp.9–10,15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9).

Preserve the November FAQ's contribution routing before applying Junction's cut: non-Guild contributions eligible for shipment income go to Guild; Guild's own contribution goes to the bank. Preserve the existing independent-Karama bank-only route. The later funding answer replaces the earlier transfer-to-shipper instruction. This source adjudication and its Guild-as-shipper application are already documented in [Guild shipment payments](GUILD_SHIPMENT_PAYMENTS.md#publisher-contract-and-precedence), with the [November FAQ, p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2). No new contributor-rounding ruling was retrieved in this audit.

## Supported receipts and pending contributor-rounding question

The coordinating implementation keeps these operations separate:

1. Validate the transaction's actual authorized contributions. Before a low-Junction shipment declaration or cost commits, reject a split whose two positive eligible contributions are both odd: the two plausible rounding interpretations differ. This is an unsupported-case guard, not a printed prohibition. Complete admitted purchases or shipments and debit each contribution once under the transaction's own source rule.
2. Determine the amount that the existing ordinary income rule would deliver to the eligible faction. This `gross` is the faction's eligible receipt, not necessarily the total cost.
3. If ordinary faction-income cancellation succeeds, credit zero and leave that eligible amount in the bank. Homeworld immunity does not immunize the separate ordinary income advantage.
4. Otherwise evaluate the native world's current low condition at income settlement. For supported low receipts, credit `ceil(gross / 2)` and leave the remainder in the bank. This aggregate arithmetic agrees with per-contributor rounding only where the contributor guard admits the transaction; it does not establish a rule for blocked cases. Without the low condition, credit `gross`.
5. Keep the original gross transaction receipt and the original positive eligible contribution amounts immutable through responses and restore. These source amounts remain server-private. Recompute the current low-state preview; do not overwrite the original amount with an earlier preview, merge away payer evidence or halve an already reduced amount. Threshold changes must not let a previously high receipt bypass the unresolved-case check when it settles low.

**Contributor rounding remains unanswered.** The coordinating agent has sent a second user question: for low Guild income on a shipment funded by two non-Guild contributions of one spice each, is the income one spice (round the total) or two spice (round each contribution)? Neither interpretation is selected for cases where they differ. Do not duplicate the question, treat elapsed time as an answer, or present the pending aggregate hypothesis as a verified rule. Single positive eligible contributions are unaffected by this distinction; with two contributors, the alternatives coincide unless both are odd. Do not pool unrelated purchases or shipments either. The [payment source gap](HOMEWORLD_CARD_ECONOMY_RULES.md#deferred-payment-splitting) remains open. The separate occupation-lifecycle question is also pending.

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

The unoccupied calculation leaves the missing half in the bank. An occupied face can assign that portion to a qualifying occupier and may independently award printed bank spice during Collection. Do not convert the bank remainder into an occupier award until the lifecycle and actual recipient are resolved. Likewise, high native population alone cannot prove that a retained occupation penalty has expired. Any runtime scope guard must acknowledge this limitation rather than describing the population-only quote as complete occupation support.

Future integration must preserve the original eligible receipt, present force state and qualification history separately. Ordinary income cancellation, retained low effects, occupied percentage income and immediate ally sharing must compose from their own rules; the current unoccupied branch is not authority for a future occupied Karama outcome.

## Required verification before a runtime claim

Meaningful regressions cover odd/even and zero receipts, rejection of two eligible odd contributions before declaration or payment, coincident 2 + 1 rounding, both contributor identities, protected original contribution evidence, module-off parity, current 4-to-5 and 5-to-4 changes across legal Ghola interruptions, cancellation without refund, all listed Emperor sources, all admitted shipment adapters and exact parent restoration. Save/recovery tests should prove no repeat debit, card acquisition, force move or faction credit, and reject altered gross/source/owner binding without persistence. Public previews may show the current numeric split but must not expose the purchased card's private face.

This documentation pass reviewed source links, referenced local targets, the limited adapter wiring and whitespace only. The contributor guard and unpublished development code are not a completed runtime checkpoint. Runtime tests, full checks and release evidence belong to the coordinating implementation checkpoint; no such result is claimed here.
