# Homeworld transport source update

9 September 2026. Targeted source review for invasion integration. This supplements [the invasion audit](HOMEWORLD_INVASION_RULES.md), preserves its occupation questions, and changes no runtime behavior or release gate.

Subsequent source adjudication: [Junction transport rules](JUNCTION_TRANSPORT_RULES.md) resolves the sponsored-route payment recipient using the bank default, the native off-planet reserve income trigger and the independent contributor rule. It separately documents Junction's Karama immunity. The earlier open Junction recipient item below is retained as this audit's historical evidence boundary.

## Newly checked authority

Fresh indexed publisher passages were retrieved from E3 printed p.10, the base rulebook p.14, and the November 2020 FAQ pp.2 and 7. The publisher base PDF returned HTTP 403 on direct access. An accessible [mirror of the publisher-authored 24-page base rulebook](https://www.qugs.org/rules/r283355.pdf) independently supplied the same special-Karama wording and the payment/shipment paragraphs on pp.9 and 19. Its content is the GF9 rulebook, not the mirror host's interpretation. Search results for fan compilations and tournament rules were excluded, including a compilation that narrows the Guild special power to arrivals on Arrakis.

The [publisher E2 rulebook, p.4](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=4) confirms that its two updated Karama cards replace the base copies. A readable original replacement card face was not retrieved during this review; a search result quoting a community revision is not a substitute for that component.

## Route contracts

The explicit own-world restriction takes precedence over the general world-to-world permission. Ordinary factions cannot ship back to their native world; Guild and Junction-sponsored cross-shipping are named exceptions. Emperor's inter-world movement remains separate. World-to-world shipment costs one spice per physical counter, halved for Guild, and Emperor may combine its two native origins. Arrakis-to-world shipment requires Guild or the named Junction exception. Allied destinations remain prohibited. [GF9 E3, p.10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

The previously inspected Junction high face authorizes offers to other factions, at half or full price, during the recipient's Shipping action. Its scope includes travel to or from Homeworlds, including the shipper's own. Retain the actual offered tariff and permission source. Guild alliance status alone is not a Junction offer. [Physical component audit](HOMEWORLD_COMPONENT_AUDIT.md#verified-high-side-effects)

**Unresolved departure edge:** neither the freshly retrieved E3 transport paragraph nor ordinary reserve shipment expressly authorizes an unsponsored foreign garrison to ship to Arrakis. Junction supplies a supported path. Do not silently reclassify foreign forces as reserves to manufacture the other path. This remains a targeted source gap, not a reason to block explicit world-to-world invasion.

## Karama: distinguish three effects

**Special Guild interception.** The publisher's operative phrase is “stop one off-planet shipment of any one player.” It does not name Arrakis as the destination. [GF9 base, p.14](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=14)

Recommended source composition: an actual interplanetary invasion is an eligible shipment, including a Fremen invasion. Fremen's ordinary Southern Hemisphere reinforcement is on Arrakis; the faction's identity does not turn every future shipment into that reinforcement. The module's generic invasion route is distinct from a Homeworld card advantage. This is a composition of the published predicates, not an explicit Homeworld example in the FAQ. Stamp route provenance in the pending intent instead of testing only `faction !== 'fremen'`. A Fremen garrison leaving Caladan provides a particularly clear regression against a faction-wide exemption.

**Ordinary cancellation.** The November FAQ distinguishes Guild payment, its personal discount, allied rates, and cross/return transport. Canceling one does not cancel the others. Fremen's protected reinforcement is its movement from reserves during shipping. [November FAQ, p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7)

E3 immunity covers Homeworld advantages and penalties. Junction's granted route/rate therefore needs a different cancellation source from Guild's ordinary discount. Printing the standard Guild half rate in the module's general tariff paragraph does not convert it into Junction's high-face advantage. [GF9 E3, p.10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

**Generic purchased rate.** November confirms that Karama may benefit another player, at Guild rates, paid to the bank. It provides no Homeworld example. [November FAQ, p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7) The replacement physical card's exact destination scope is still an evidence gap. Do not grant a missing route through the rate card. Do not present either universal Homeworld eligibility or a publisher-confirmed prohibition as established by this review. Existing [ordinary rate-cancellation timing questions](GUILD_RATE_KARAMA_RULES.md#material-unresolved-timing) remain unchanged.

## Contributor routing and Junction

Ordinary shipment payments go to the bank. Guild's base personal income override names other factions shipping from their off-planet reserves onto Dune. That does not independently collect a shipper's world-to-world invasion fee. [GF9 base, pp.9 and 19](https://www.qugs.org/rules/r283355.pdf#page=9)

The November funding rule separately sends a non-Guild ally's contribution directly to Guild when present; Guild's contributions go to the bank. The FAQ sets no destination restriction on this funding paragraph. Preserve the existing [contributor-specific adjudication](GUILD_SHIPMENT_PAYMENTS.md#publisher-contract-and-precedence), including when Guild is the shipper. An independently purchased Karama rate sends the payment to the bank. [November FAQ, pp.2 and 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

Consequently, `guildShipmentIncome` cannot receive an invasion's full fee unchanged: its shipper contribution currently assumes an eligible ordinary route. Example under this composition: a five-spice invasion funded by shipper three plus a non-Guild ally two routes three to the bank and two to Guild before applicable Junction effects. Preserve the two debits and their provenance; the incoming receipt cannot fund the same shipment.

Junction low retains the rounded-up half of eligible shipping payments. Its occupied face awards the rounded-down other half paid by other players to the occupier. These face effects modify an eligible payment; they do not manufacture another full fee or broaden every bank payment into Guild income. [Physical component audit](HOMEWORLD_COMPONENT_AUDIT.md#verified-low-side-effects) This review does not resolve existing occupation lifecycle questions or a new multiple-beneficiary rounding policy. Store an original payment identity and contributor ledger so a later consumer can apply the finalized split once. The exact payment recipient for a Junction-sponsored route whose shipper contribution misses the base income trigger should be resolved explicitly before that distinct sponsored route is exposed.

## Integration checks

Keep route legality, tariff provenance, funding, income entitlement, and interception separate in a detached quote. Revalidation must use the actual typed source pools and authorized escrow without replacing the original offer after a pause. Validate ownership and ally restrictions before card disposal, payment, force arrival, or technology income. No sector, stronghold-capacity, advisor accompaniment, or territorial arrival effect should be inferred merely from an off-board location ID.

Required focused cases for this contract: own-world rejection despite general invasion permission; explicit Guild/Junction exceptions; Emperor combined origins; odd Guild force count; paid Fremen invasion versus free reinforcement; a Fremen foreign-garrison interception; shipper/donor routing in both Guild directions; independent card-rate provenance; unchanged funds and forces on rejection; and exactly one final settlement after JSON recovery and duplicate requests.

Validation of this document: local links and referenced function were inspected; primary passages were freshly browsed. No executable tests, databases, saved games, server processes, or automation settings were changed.
