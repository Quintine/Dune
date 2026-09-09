# Homeworld mobility effects

Primary-source audit, 9 September 2026. This contract covers Caladan low, Wallach IX high/low, Ix low and Richese low. It is not an implementation checkpoint or a release certification. The [component audit](HOMEWORLD_COMPONENT_AUDIT.md) records the inspected physical faces and their provenance; its former `/tmp/dune-rules/` images are absent in this session, so this audit does not claim a new visual inspection. Fresh searches retrieved publisher-indexed rulebook and November FAQ passages; direct publisher PDF requests returned HTTP 403. No community comment or other edition supplies a rule below.

## Population and effect identity

Evaluate the native world's current population. Caladan is low at 0–5; Wallach IX at 0–10; Ix at 0–4; Richese at 0–9. Foreign visitors do not increase native population. E3's minimum-high rule is continuous, not a generic phase-start snapshot. The low penalty remains applicable while the world is occupied. Karama cannot remove a Homeworld advantage or penalty. These rules do not protect a separately sourced faction advantage merely because its faction has a Homeworld. [E3, pp.9–10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)

Implementation consequence: recheck current eligibility before an effect commits, including restored pending frames. A selected two-counter transfer is one batch: starting at native 11 permits both counters and leaves 9. Do not re-evaluate between the first and second counter. An interrupted declaration must retain its selected amount; never silently increase, truncate or replace it. Population-derived public controls need no opponent hand access.

## Caladan: the named Movement advantage

Low Caladan disables the Atreides Spice Deck inspection. The ordinary advantage occurs at the beginning of Movement, before anyone moves; it does **not** spend an ordinary force movement. Earlier Homeworld developer prose calling it a “movement-spent” peek is inaccurate. The penalty does not cancel battle prescience, auction inspection or a separately printed card effect. [Base, p.17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=17)

The November FAQ limits the inspection to one card even with Double Spice Blow. Ordinary Karama can prevent that inspection when otherwise available. Low Caladan supplies a direct prohibition, not an extra Karama target or an acknowledgement decision. Hajr cannot buy a second inspection or bypass the penalty: its additional movement follows normal movement rules. [November FAQ, pp.3,7–8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=3)

Do not grant delayed inspection merely because Caladan becomes high after its printed opening opportunity has passed. Likewise, restoring high does not erase information already legally learned. Availability, historical knowledge and a continuously exposed live deck preview are separate implementation concerns.

## Wallach IX: accompaniment, amount and stance

Spiritual Advisors is the named free accompaniment power. Another faction's completed off-planet shipment **to Dune** creates the opportunity; Basic sends one reserve force to Polar Sink, and Advanced offers the arriving territory instead. BG does not accompany itself. An on-planet relocation, Fremen's ordinary reserve entry or a shipment ending at a Homeworld does not meet that trigger. [Base, p.18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18), [Homeworld invasion audit](HOMEWORLD_INVASION_RULES.md)

Wallach low suppresses both accompaniment destinations. Wallach high permits an optional two-counter Polar Sink accompaniment. One remains available; passing remains available. The same-territory Advanced alternative stays one, and a two-counter action cannot split its destinations. With the module enabled, a native reserve pool of one is necessarily low and permits no accompaniment. With the module absent, the ordinary one-counter option remains valid. The source of these modifiers is the [physical component audit](HOMEWORLD_COMPONENT_AUDIT.md#verified-high-side-effects).

This restriction does not prohibit ordinary paid BG shipment, moving existing advisors, Intrusion or the normal stance transitions. In particular, the November FAQ permits directly shipped forces to join existing advisors and requires arrivals to match the territory's existing BG type. This supersedes the conflicting April FAQ. [November FAQ, p.4](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=4)

The Guild Ambassador's extra shipment also qualifies when it is another faction's off-planet arrival. Its special parent continuation does not remove the Wallach conditions. E3 confirms both that Ambassador shipments interrupt the triggering player's action and that allied BG may accompany Ecaz. Preserve that original entrant, independent beneficiary and BG as separate actors. [E3, p.15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=15), [Guild Ambassador audit](GUILD_AMBASSADOR_RULES.md)

Check Wallach at every accompaniment producer and at placement. Do not freeze high merely when the original shipper starts its turn. Suppressing an unavailable accompaniment must resume the correct original action without a fake “allow” decision. The parent shipment cannot be charged or transferred again.

### Ordinary Karama and the high modifier

E1 explicitly lists Spiritual Advisors and Advanced Advisors as cancelable free shipments. E3 independently protects Homeworld effects. Neither retrieved source directly answers a two-counter Wallach accompaniment cancellation. [E1, p.12](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=12), [E3, p.10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

The adopted composition is that the high face changes the quantity of a qualifying accompaniment; canceling the underlying Spiritual Advisors use leaves no independent bonus shipment. A second Karama aimed only at removing the extra counter is forbidden. This follows the conditional modifier and its underlying action, rather than a specific two-counter FAQ answer. No retrieved primary text contradicts that composition. A Guild Ambassador parent's resistance to ordinary cancellation does not automatically transfer to BG's distinct accompaniment advantage.

## Ix and Richese: prohibit relocation, preserve other actions

Low Ix prohibits moving the Hidden Mobile Stronghold itself. Apply it both to the ordinary pre-storm relocation and the special Ixian Karama relocation during Shipment and Movement. A Karama cannot override the protected low penalty. The special power otherwise adds a two-territory HMS move while preserving normal troop movement. Ordinary HMS movement and its travel-related collection are described separately from initial placement, protected interior and troop entry. [E1, pp.6,9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=6)

Low Ix does not immobilize Cyborgs or Suboids, forbid troop entry/exit through a stationary HMS, erase its shelter, or forbid unrelated collection by troops. Initial setup placement is not a later relocation. Do not spend the special Karama or mark it used on a rejected low-population attempt.

Low Richese prohibits relocating a deployed No-Field marker, including a marker-only move, a mixed group carrying it, Hajr movement or an otherwise legal Fremen Ambassador relocation. It does not prohibit initial shipment, voluntary reveal, mandatory reveal, or moving ordinary forces while leaving the marker in place. The token moves like a force, but deployment and revelation have distinct lifecycle rules. [E2, p.6](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=6), [No-Field audit](RICHESE_NO_FIELD_RULES.md)

Hajr supplies no immunity from the prohibition. CHOAM's Baliset remains a separate movement restriction and expressly permits shipment; do not apply it to free BG accompaniment. A stopped marker move preserves its hidden denomination, physical location and last-use history. Ordinary forces materialized by a separately legal reveal can subsequently move normally. [November FAQ, p.8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8), [E2, p.7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7)

These movement conclusions do not resolve the prior No-Field return/capture or off-planet marker questions. A generic relocation adapter must not fabricate a reveal or change concealed custody to bypass those existing boundaries.

## Verification obligations

Exercise exact thresholds, Basic and Advanced accompaniment, one versus two versus pass, same-territory versus Polar Sink, native 11→9 as one batch, module-off reserve shortage, normal and Ambassador continuations, paid BG arrival joining advisors, low-population restored frames, stationary HMS troop movement, both HMS relocation sources, marker-only/mixed/Hajr moves, independent physical-force movement and legal reveal. Verify rejection immutability, no private information leakage, all four AI profiles and SQLite recovery. No tests were run or code changed by this source-only audit.
