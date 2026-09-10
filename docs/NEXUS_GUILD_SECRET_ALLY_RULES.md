# Spacing Guild Nexus Secret Ally: route and price contract

Source audit, 10 September 2026. This is a source-backed implementation contract, not certification of the whole card or either expansion module. The broader [Guild audit](NEXUS_GUILD_RULES.md) remains relevant to Cunning and Betrayal.

## Evidence checked

The original Guild component was visually reread in the [photograph of GF9's twelve Nexus cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), using the existing local inspection copy `/tmp/dune-nexus-cards.jpg`. Its Secret Ally panel grants Guild shipment rates and expressly adds cross-planet shipment or return to the holder's reserves as their shipping action. It applies when Guild is absent. It does not promise all Guild advantages.

Fresh searches retrieved official [base rules](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), [November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), and [E3 rules](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf). Direct opening of the latter two URLs returned 403; their indexed publisher passages were checked against the existing E3 PDF/text. The [designers' page](https://futurepastimes.com/dune-board-game/) links the FAQ, but its short-link fetch failed. No Guild Secret Ally/Homeworld clarification was found in these sources. Tournament revisions and comments were not treated as official rulings.

## Supported ordinary routes

Use the holder's one ordinary shipping action in their own combined turn. Preserve their actual faction, typed counters, legal source group, stance and destination restrictions. The card does not add a second shipment or flexible Guild turn order. Rates apply to the whole selected physical group, rounding once upward. [GF9 base rules, pp19 and 23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=19)

| Route | Price for `n` physical forces | Boundary |
| --- | --- | --- |
| Off-planet reserves to an Arrakis stronghold | `ceil(n / 2)` | Ordinary legal destination, including native Ixian direct HMS permission only |
| Off-planet reserves to another Arrakis territory | `n` | Ordinary storm and occupancy restrictions |
| One Arrakis territory to another | Same destination tariff | Guild cross-shipment; neither source nor destination may be in storm |
| One Arrakis territory to own reserves, Homeworlds off | `ceil(n / 2)` | Explicit card grant; no second halving |
| Fremen southern reserves to Arrakis through the paid card route | Same destination tariff | Paid cross-shipment; distinct from free native reinforcement |

The printed return grant exceeds the ordinary Guild alliance: the November FAQ says an ordinary Guild ally cannot return to reserves. Do not accidentally remove the Nexus permission by reusing only the normal alliance predicate. The Guild is absent, so payment goes to the bank; no native Guild collection or interception owner is created. [GF9 November FAQ, p9](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=9)

## Fremen composition

The official FAQ explicitly permits allied Guild cross-shipment from Fremen reserves, treating them as one on-planet territory outside the board. Composing that interpretation with the Nexus cross-shipment grant supports a paid southern-reserve route without Great Flat range. It keeps normal cross-shipment storm exclusion. The free native reinforcement route, including its own Advanced storm rule, remains separate. This is a composition of published rules, not a Nexus-specific FAQ answer. [GF9 November FAQ, p5](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=5)

Native Homeworld custody can represent the same outgoing reserves without creating another reserve pool. A paid Fremen source remains on-planet for effects that distinguish off-planet shipping. Likewise, cross-shipping existing Arrakis forces does not trigger an off-planet arrival merely because its price is paid. Preserve the actual source classification for BG accompaniment and Heighliner. [GF9 E1, p5](https://www.gf9.com/Portals/0/Documents/GF9/IxianAndTleilaxuRulebook.pdf#page=5)

## Homeworld prices and the unresolved return

**Price and permission are separate.** E3 already permits world-to-world shipment by non-Guild factions, with a one-spice-per-force tariff and Guild half price. The card's Guild-rate clause therefore supports `ceil(n / 2)` for an independently legal world-to-world invasion. This price composition borrows no high-Junction advantage and grants no new destination. Preserve the source custody and own/ally-world restrictions. [GF9 E3, p10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)

**Arrakis to native reserves remains a material interpretation question when Homeworlds are enabled.** Reserves occupy native Homeworld discs; E3 expressly restricts Arrakis-to-Homeworld shipment to Guild, with a named Homeworld-advantage exception. The Nexus expressly grants reserve return. A card-specific exception is plausible, especially because it already exceeds normal alliance rights. Conversely, E3's specific Homeworld restriction can be read as limiting that grant. Its Nexus FAQ resolves neither reading. [GF9 E3, pp9–11 and 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9)

The concrete question is whether Secret Ally's reserve-return permission overrides that restriction **for the holder's own native reserves**. An affirmative answer does not grant Arrakis-to-arbitrary-foreign-Homeworld transport. Until resolved, expose this particular return as unfinished; ordinary Arrakis routes and independently legal world-to-world discounted shipment need not be blocked.

## Implementation boundaries

Consume the actual held Nexus atomically with a validated paid declaration, preserving an original route, source, typed group, destination and price receipt. A rejected request must not spend it. Later continuations must match the original declaration rather than infer it from a current hand or reset a usage flag. Private offers reveal no other holder's Nexus identity.

Reuse `guildShipmentCost` for paid cross/return tariffs. Do not price the paid Fremen route through `reserveShipmentCost`, whose native Fremen branch intentionally returns zero. World-to-world pricing needs an explicit quoted rate modifier after route validation; changing the player's faction to Guild would also change custody and permissions. The native `quoteGuildHomeworldShipment` explicitly enforces Guild identity and ordinary Guild counters, so it is not a safe borrowed-return adapter without a separately settled contract.

Generic Karama cannot target an absent native Guild player. That does not establish universal immunity for every borrowed effect. Preserve supported arrival reactions and existing independent Karama payment routing; do not stack two Guild half-rate modifiers into quarter price. Richese concealed No-Field price/transport composition remains its separate documented boundary, without blocking actual physical groups unnecessarily.

Required runtime evidence includes odd/even prices, all supported route types, typed custody, Fremen free-versus-paid choices and storm behavior, native Ixian HMS access, current-source rejection, actual entry continuations, replay/JSON recovery, private projections and concurrent persistence. This audit changed documentation only.
