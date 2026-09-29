# Guild shipment rates and ordinary Karama

Initial primary-source and engine audit, 2026-09-06. The bounded ordinary-reserve cancellation policy below was selected on 2026-09-28 after a targeted publisher-source search found no affordability procedure; the later original audit remains historical evidence for unfinished transport and module combinations.

## Implemented payment follow-up

The shared contributor-income calculation and private Guild transport quotes were integrated in the earlier payment checkpoint. November 2020 direct contribution routing credits a non-Guild ally’s contribution when Guild ships; Guild’s own contribution still goes to the bank. The source adjudication, earlier 1,600-check checkpoint and browser evidence are in [GUILD_SHIPMENT_PAYMENTS.md](GUILD_SHIPMENT_PAYMENTS.md). That checkpoint preceded the bounded rate-cancellation path below.

## Selected ordinary-reserve interpretation — 28 September 2026

In classic-faction Basic and Advanced tables without optional modules, Guild or its reciprocal ally declaring an ordinary reserve shipment at the Guild rate opens a **prepayment** Karama response. Advanced Guild's separate special shipment-stop decision resolves first. A Karama spent against the rate does not cancel Guild income, permission to ship, or an independent Karama-purchased discount. The original number and types of forces, destination and approved ally contribution are fixed while opponents respond.

If Karama cancels the rate, recalculate the same force shipment at the normal one/two-spice-per-force price. If the shipper and the **original approved split** can fund it, transfer that exact amount and then commit the original shipment once; another faction's pledge is never silently increased. Otherwise the declaration returns with no spice, forces or shipment allowance spent. The responding Karama is still discarded. A replacement ordinary shipment in this turn uses full price; the restriction expires at turn end. An independent purchased Karama rate remains separate. This is the recommended conservative software interpretation where the publisher does not prescribe the unaffordable outcome: no forced debt, retroactive cancellation or unauthorized ally charge. It is **not** an asserted GF9 timing/refund ruling. [GF9 November FAQ, p. 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

Guild cross-planet and return shipments, optional-module rate sources, Homeworld advantages and special combinations still need their own integration; this first version does not certify the complete Guild faction or public Advanced rules.

## Confirmed source contract

The November 2020 FAQ distinguishes canceling Guild income for one shipment, its own half-price use, rates granted to one ally, cross-planet/return transport, and Advanced out-of-order action. General cancellation affects one use; alliance powers are cancelable. The older April FAQ contradicts the transport restriction and should not override November. Independent Karama shipment purchase can benefit another player and pays the bank. [GF9 November FAQ, p. 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

The Ixian/Tleilaxu Karama reference separately lists removal of the discount, requiring full price; prohibition of cross-planet/return transport; and income redirection to the bank. Canceling one does not automatically cancel all three. Its explicit out-of-order timing is when Guild attempts that change; it gives no comparably precise announcement/payment sentence for the discount. [GF9 Ixian & Tleilaxu, final Karama reference, PDF p. 12](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=12)

Ordinary reserve shipment costs one spice per force into a stronghold, two elsewhere. Guild pays half; its ally can ship from reserves or across the planet at that rate. Return to reserves belongs to Guild itself and normally costs one spice per two forces. Fractions round up. [GF9 base rules, pp. 9, 19, 23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

An ally may pay some or all of a shipment, up to its price. That contribution normally goes directly to Guild, or to the bank if Guild is absent. **Guild's own contribution to its ally goes to the bank**, rather than returning to Guild. Removing the rate does not cancel ordinary allied payment permission. Fremen's ordinary reserve entry remains exempt from Karama cancellation. [GF9 November FAQ, pp. 2, 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

## Scope and composition

| Shipment                                                           | Rate cancellation contract                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guild reserves to Dune                                             | Remove Guild discount: one/two spice per force according to destination.                                                                                                                                                                             |
| Guild cross-planet                                                 | Same destination pricing after discount removal; canceling permission to cross-ship is a separate power cancellation.                                                                                                                                |
| Guild return to reserves                                           | The table says full price, but no retrieved example explicitly recalculates this special return tariff. One spice per force is the natural doubled-tariff interpretation, not a dedicated FAQ result.                                                |
| Guild ally reserves to Dune                                        | Remove Guild's alliance discount; the ally remains shipper. Ordinary shipment permission remains.                                                                                                                                                    |
| Guild ally cross-planet, including allied Fremen southern reserves | The rate is Guild's alliance benefit; discount removal and cancellation of cross-shipment permission must remain separate. The general alliance-cancellation answer supports the permission cancellation, without a dedicated allied-Fremen example. |
| Fremen ordinary free reserve arrival                               | No Guild discount to remove; do not turn this into paid shipment.                                                                                                                                                                                    |
| Independently purchased Karama rate                                | Its source is the Treachery card, not Guild's faction advantage. A Guild-rate power cancellation should not erase the independent card benefit. This is source composition, not an explicit two-Karama timing example.                               |

Track **power owner**, **shipper**, **card owner/beneficiary**, and **payment contributors** separately. A Guild-funded ally is still the ally's shipment, using Guild's alliance benefit. Cancellation of income changes the recipient of payment; it does not double the fee. Discount cancellation changes the fee; it does not redirect the remaining legitimate Guild income.

Homeworld advantages have their own Karama immunity and are outside this ordinary-shipment audit; do not extend these rules to that gated module by analogy. [GF9 Ecaz & Moritani, p. 10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

## Material unresolved timing

The retrieved publisher sources do **not** state whether a declared shipment can be reduced, redirected, replaced or declined after cancellation makes it unaffordable. They do not specify whether that attempt consumes shipment, whether another declaration can regain the discount, or how a prior independent rate card is treated if transport itself is stopped. Do not present an automatic refund, retry, forced debt, smaller shipment, or full-price reservation prerequisite as an official ruling.

Likewise, no retrieved primary passage orders ordinary rate cancellation against Guild's Advanced shipment-stop declaration, a second payment-contributor choice, or a newly played independent rate card. The base Advanced Guild power stops a shipment; it is not the ordinary discount cancellation. Existing implementation's canceled-special-shipment settlement is already marked provisional and must not silently become authority for this new case.

For the bounded ordinary reserve path, the user’s later instruction to choose the conservative recommended option where no publisher ruling exists is applied above. Other transport, repeated-declaration and combined-response questions retain the source boundaries below until connected.

## Initial implementation findings (before the bounded rate response)

- `ship` computes a valid discounted quote and exact typed reserve count. Its existing `pendingShipment` only pauses for Advanced Guild's special shipment-stop choice. Ordinary games call `commitShipment` directly.
- `commitShipment` pays, transfers forces, marks shipment used and generates technology/arrival effects before opening `guildIncome`. That existing response can redirect income, but is too late for discount cancellation. Reusing it to reprice would require undoing already-settled effects and is unsafe.
- `guildShip` validates exact source groups, elites, advisor state and entry, then pays/transfers inline. It needs a normalized pending transport intent if ordinary permission/rate responses are added. Retain exact sectors and unit types; do not reconstruct a different group after a response.
- Existing payment math correctly sends Guild-funded ally spice to the bank: eligible Guild income subtracts Guild's contribution. The rate helper itself has no new cancellation regression; the absent rate/transport response was a preexisting compliance gap.
- `g.karamaShipping` already distinguishes card owner and beneficiary. Keep this independent rate source distinct from Guild's ordinary ability during repricing and resumption.
- Existing aid is escrowed and visible to the recipient. A changed price can invalidate the recorded contributor split even when the combined budget suffices. Do not silently enlarge another player's authorized contribution beyond their pledged amount, or replace an explicit split without the chosen settlement contract.

Proposed intent fields are shipper ID, source kind and exact force groups, destination/sector, typed amounts/advisor stance, turn/phase, rate source, quoted costs, and chosen ally contribution. Record which one-use windows have resolved, so JSON resume cannot reopen a canceled discount or replay payments. Revalidate custody, legal destination, alliance and contribution before committing once. This is a software proposal, not a stored arbitrary Action or printed rule.

## Initial focused acceptance targets

Cover own and allied reserve shipments at both destination prices; odd force counts; cross/return transport separately; free Fremen; independent Karama rates; explicit/default aid splits; Guild versus non-Guild contributors; separate income cancellation; nested Bene Gesserit Worthless conversion and cancellation; JSON reload/stale submissions; unchanged forces/payment/technology before settlement; and exactly one final commit. Include both sufficient and insufficient full-price budgets, but bind the latter tests only after the pending interpretation is selected.

Official indexed PDF passages were verified in the browser and compared with local publisher-authored base/Ix extracts. Direct current GF9 PDF fetching returned 403, so this is not a claim that a newly downloaded binary was checked. Targeted GF9 searches for affordability, changed declarations and refunds found no ruling. Community and tournament variants were not used to fill that gap. No game files or live rooms were modified.
