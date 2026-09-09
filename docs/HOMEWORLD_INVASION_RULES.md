# Homeworld invasion transport and occupation audit

Source audit, 9 September 2026. This document refines the existing [Homeworld contract](HOMEWORLD_RULES.md#transport-and-arrival); it does not activate transport, occupation, battles, or faction effects. Implementation evidence remains separate.

## Authority and fresh verification

The [GF9 E3 rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf) remains the module authority. Its indexed printed pages 9, 10 and 15 were freshly retrieved. Direct PDF access returned HTTP 403; the earlier `/tmp/dune-rules/ecaz-audit.txt` is no longer present. No claim here relies on that missing file. The [designer expansion page](https://futurepastimes.com/dune-ecaz-moritani) was accessible and links the rules and Homeworld explanation; the video could not be retrieved, so no new spoken ruling is attributed to Jack Reda.

**Fresh E3 checkpoint:** another Homeworld can be invaded; its native reserves defend it. Homeworld-to-Homeworld shipment costs one spice per counter, halved for Guild. Arrakis-to-Homeworld travel requires Guild cross-shipment or the explicit Junction permission. Allied destinations and alliances with an occupier of one's own world are forbidden. Emperor can combine both native origins and has a separate inter-world movement. Homeworlds are not territories. BG advisors cannot arrive there or replace invading fighters. Homeworld effects resist Karama. The FAQ confirms Heighliner activation. Occupier qualification occurs with foreign presence at turn start/end, or immediately upon being alone there; the latter qualification names the current turn. Occupied income is collected during Collection and can immediately be shared with an ally. Native low penalties remain active while occupied. [E3, pp.9–10,15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)

The detailed route and component mappings already in [transport and arrival](HOMEWORLD_RULES.md#transport-and-arrival), [occupation](HOMEWORLD_RULES.md#occupier-lifecycle-and-benefits), and the [physical component audit](HOMEWORLD_COMPONENT_AUDIT.md#verified-high-side-effects) remain the applicable local contract. In particular, the actual Junction, Wallach IX and Tupile faces must be used rather than replacing their text with generic transport or control rules.

## Base-rule composition

The [base rulebook, pp.17,19,23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=17) freshly confirms that both ordinary BG accompaniment and its Advanced destination alternative require another faction's off-planet shipment **to Dune**. Therefore a shipment ending on a Homeworld does not, by itself, create a Polar Sink accompaniment opportunity. The Wallach high face changes the size of an eligible accompaniment, not its trigger. This is source composition, not a separate Homeworld FAQ answer.

Guild's base transport alternatives are one shipment per turn; its cross-board or reserve-return alternatives start in one territory. Its printed alliance grant names reserve-to-Dune and territory-to-territory travel. That alliance grant does not independently authorize the new Arrakis-to-Homeworld route. Fractional shipment costs round up: five counters at the E3 half rate cost three spice, and one costs one. Do not round individual counters first or halve a rounded total again. [Base, pp.19,23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=19)

The [November 2020 FAQ, p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7) allows Karama purchase for another player at Guild rates, paid to the bank. Its cancellation list distinguishes Guild income, half-price shipment, ally rates, cross-shipment/reserve return, and Advanced timing. These are distinct sources. E3's immunity does not justify dropping every ordinary Karama response merely because a Homeworld is involved; equally, a response cannot erase a transport permission supplied by Junction's Homeworld face. The November wording and [E1 cancellation table, p.12](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=12) supersede the older April FAQ's contrary statement that Guild's transport types cannot be canceled.

## Route boundaries for implementation

Use an explicit source-world/source-sector and destination-world/destination-sector pair. A foreign garrison must remain physically separate from native reserves. Existing native-to-Arrakis shipment and Emperor transfer are already documented; the new interface must not turn every off-board force into an interchangeable reserve.

| Route | Required distinction |
| --- | --- |
| Native Homeworld → foreign Homeworld | New invasion route; retain ordinary shipment usage, typed counters and destination ownership. Fremen's free Southern Hemisphere reinforcement onto Arrakis is not a free invasion. |
| Foreign Homeworld → another foreign Homeworld | Covered by the general world-to-world permission; use the actual foreign source pool. |
| Any foreign source → one's native Homeworld | Apply the specific own-world restriction and its explicit exceptions, not merely the general world-to-world sentence. |
| Arrakis → Homeworld | Ordinary Guild privilege and Junction-sponsored permission need different provenance and cancellation handling. The Guild ally flag alone is insufficient. |
| Foreign Homeworld → Arrakis | Do not silently label a foreign garrison as native reserves. Junction explicitly supports transport from Homeworlds; a general unsponsored foreign-garrison departure is not expressly described in the retrieved transport paragraph. Record the selected interpretation before exposing this edge. |
| Any route → ally's Homeworld | Reject before payment or arrival; Ecaz's territorial co-occupation is not an exception. |

There is no retrieved numeric invasion-force cap or Homeworld two-faction capacity rule. Preserve the twenty physical counters, actual available group, affordability and named permissions; do not reuse a stronghold's two-faction occupancy check for a non-territory world. Combining unrelated source worlds in one shipment has no general permission. Emperor's named two-origin exception must remain explicit. These are composition boundaries, not newly printed caps.

**Payment is source composition, not a new question merely because E3 omits a recipient.** The ordinary rule pays the bank; a qualifying faction or funding rule overrides that default. This default is explicit in the [publisher quick-start payment rule, p.8](https://www.gf9games.com/dunegame/wp-content/uploads/Quick-start-Guide.pdf#page=8). A shipper's own invasion fee therefore goes to the bank unless an applicable effect supplies another recipient. Guild's base onto-Dune trigger must not be broadened solely by reusing `guildShipmentIncome`.

Preserve the already documented [November allied-payment adjudication](GUILD_SHIPMENT_PAYMENTS.md#publisher-contract-and-precedence): non-Guild ally contributions go to Guild when present, Guild contributions go to the bank, and an independent Karama rate sends the payment to the bank. This is contributor-specific even when Guild is the shipper. The [November FAQ, p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2) was freshly rechecked. A route quote must separate the shipper's eligible income from that contribution rule. `shipment-price.ts` currently has no route parameter; its arithmetic is reusable, its current caller assumptions are not a new Homeworld authority. No Homeworld-specific user ruling was located in the existing payment documents.

Generic Karama purchase must retain its actual destination scope and never grant a missing transport route. Its FAQ establishes payment/rate but supplies no Homeworld worked example; do not turn the absence of an example into a blanket blocker. An exact card/rule-scope review is still needed before extending the existing reserve-shipment purchase to a new off-board route. Existing unresolved ordinary rate-cancellation timing remains tracked in [Guild rate Karama rules](GUILD_RATE_KARAMA_RULES.md#material-unresolved-timing), without asking those questions again.

## Occupation evidence and unresolved lifecycle

Keep three independent facts: present native/foreign forces, current native population, and a recorded qualification event with its turn. A sole-controller enum loses evidence that the published timing rule explicitly creates. Do not reconstruct historical qualifications from a reloaded current board.

The following cases still require a lifecycle decision; the cited material does not supply an exclusive-controller or automatic handoff algorithm:

- A qualifies alone, then B enters before Collection. Is A's current-turn benefit retained while contested?
- A qualifies, leaves entirely, and B becomes sole occupant later that turn. Which continuing advantages and income entitlements survive?
- Two foreigners remain at a turn boundary, including allies jointly visiting a third faction's world. Does each receive the named qualification, and how are unique rewards resolved?
- Native revival restores a high population while a foreign qualifier remains. Which native high/low effects coexist with the occupied effect, and until when?
- A remembered current-turn qualification remains after departure: does it prohibit a later alliance, or does the alliance restriction use present forces? Do not resolve this merely by sharing one occupation predicate across all consumers.

Tupile's component-specific loss-of-occupation discard must be preserved even if another benefit ultimately uses a turn receipt. A unique physical reward such as Duke ownership cannot be duplicated to mask simultaneous entitlements. Occupied bank income, percentage receipts, hand limits, immunity and victory conditions each need their own consumer timing once the lifecycle is resolved.

Fresh targeted GF9, designer-name and occupation searches produced no new official resolution. A community compilation replaces the publisher's start/end-turn wording with an unopposed-only definition; it is not an erratum and was excluded. Search absence is not proof that no clarification exists.

## Verification handoff

Transport tests should cover odd/even Guild costs, funding and income separation, the ordinary shipment limit, native and foreign custody, mixed Emperor origins, own/ally rejection, Fremen invasion payment, BG non-trigger on Homeworld arrival, and one Heighliner receipt. Capture the exact permission source before each response; restore it through JSON/CAS without spending twice.

Occupation tests must use the five cases above plus loss of the last invader, surviving native defenders after an explosion, Collection exactly once, alliance formation, and unique-reward custody. A transport-only pass cannot certify occupation or a complete Homeworld game. No production, server, saved-room, Sites or automation state was changed by this audit. Existing CHOAM charity, Tleilaxu special-Karama and Ix revival questions are neither repeated nor resolved here.
