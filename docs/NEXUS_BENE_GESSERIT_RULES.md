# Bene Gesserit Nexus: stance conversion and borrowed Voice

Primary-source audit, 10 September 2026. This document separates printed rules, their implementation composition and unresolved interactions. It does not certify a complete Nexus module. The [common contract](NEXUS_CARD_RULES.md) governs physical custody and alliance disposal; the existing [Atreides audit](NEXUS_ATREIDES_RULES.md) records the still-pending private response policy.

## Authority and acquisition

- [Original printed Nexus cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), visually reinspected in the local photograph `/tmp/dune-nexus-cards.jpg`: all three Bene Gesserit panels.
- [GF9 E3 rulebook, pp.10–11 and 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10): Homeworld restrictions, mode definitions and borrowed-Voice timing. The previously acquired publisher-authored [PDF mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf) was read alongside fresh publisher-indexed text.
- [GF9 base rulebook, pp.18 and 23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18): advisors, Voice and inspection order.
- [GF9 November 2020 FAQ, pp.4–5 and 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=4): stance, storm, Voice categories and cancellation. Fresh official-domain indexed passages were retrieved. Direct requests returned 403; older purported local base/FAQ PDFs were HTML and were not accepted as evidence. The superseded April FAQ, tournament rules and fan compilations are not adopted.

## Printed scope

| Mode | Condition | Effect |
| --- | --- | --- |
| Cunning | Native Bene Gesserit holder | During that player's Shipment and Movement turn, select any or all advisor groups and convert them to fighters. All its forces in each territory must finish in one stance. |
| Secret Ally | Bene Gesserit absent | In the holder's battle, use the Bene Gesserit Voice advantage against the opponent's Treachery Card choice. |
| Betrayal | Another player is Bene Gesserit | Prevent that faction's attempted Voice. |

The card specifically calls Secret Ally permission to “use the Bene Gesserit Voice advantage.” This differs from the Atreides card's standalone instruction to reveal a plan element; neither wording establishes blanket Nexus immunity. [Printed components](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani)

E3 describes Cunning as enhancing a native advantage. Cards are discarded after use and cannot remain held by allied players. Secret Ally requires the named faction to be absent; it creates no seated ally. Its FAQ explicitly requires borrowed Voice before Prescience. Homeworlds are not territories; advisors cannot be sent there, and invading BG fighters cannot become advisors there. [E3, pp.10–11,16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11)

## Existing restrictions

Advisors are an Advanced feature. Ordinary free accompanying advisors cannot become fighters that turn while other forces remain. Ordinary Battle flips occur before any shipment. Voice can require or prohibit a weapon, defense, Worthless card or Cheap Hero; an opponent unable to comply is free of that requirement. Voice precedes Prescience; unaffected plan elements remain changeable. [Base, pp.18,23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18)

November's FAQ requires one stance per territory, forbids flipping alongside an ally and forbids the ordinary pre-shipment flip in a storm-locked stronghold. It allows generic projectile/poison and shield/snooper commands, but special cards require their specific name. Weirding Way and Chemistry use their default classification for Voice rather than every legal slot. Karama stops one use, including alliance abilities, native Voice and native token flipping. [November FAQ, pp.4–5,7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=4)

## Executable composition

These are implementation consequences, not additional publisher quotations:

- Cunning chooses a set of territories, not individual counters or sectors. Convert every BG counter in each selected territory, preserving locations and quantities. Selecting a territory containing several sectors cannot leave mixed stances. A nonempty selection supplies an actual use; no zero-effect disposal is inferred.
- The opportunity belongs to the owner's current Shipment and Movement action, including after shipment and before ending that action. It is not an anytime effect throughout everybody else's turns. Selection need not be restricted to the group being moved. Basic supplies no eligible advisors.
- Conversion is a stance change in place. It consumes no shipment, movement, reserves or spice and creates no arrival for Guild income, accompaniment, Terror or Ambassadors. Recompute fighter presence and subsequent movement/battle eligibility. Homeworld native reserves are not a selectable advisor group.
- Cunning enhances the native stance advantage. Treat its one announced territory set as one use for Karama: cancel that entire pending conversion, preserving every original advisor group. The card provides one selection, not independent successive plays. This follows the one-use cancellation rule; there is no separately retrieved worked batch example.
- Preserve stronghold capacity and allied-territory constraints; the card specifies no exemption. Use public faction presence, including public No-Field presence, without reading its denomination. Recheck the complete selection at settlement; reject atomically if it has become illegal.
- Secret Ally supplies one Voice in one owned battle and spends the card. It does not grant Voice in another faction's battle or future battles. Reuse native command classification, compliance, compulsory-card logic and existing promise validation; do not expose whether the opponent privately holds a matching card.
- Bind Voice to its original battle, owner, target and command. Close the opportunity before either Prescience or sealed plans make the command late. Native and Nexus inspections must share that boundary; this is consistent timing composition for Atreides Secret Ally, not a separately printed FAQ answer.

## Material boundaries requiring a ruling

No retrieved primary clarification resolves these specific combinations. Do not silently broaden permission or describe a conservative block as the printed rule.

1. **Newly accompanied groups:** does Cunning's any/all permission override the same-turn advisor lock, or only the ordinary pre-shipment timing? The face does not name that prohibition.
2. **Storm:** does Cunning allow an in-place flip in a storm-locked stronghold? The FAQ's prohibition explicitly addresses the earlier ordinary Battle flip; its rationale concerns inability to battle. Applying it to this later card is plausible, not explicit.
3. **Borrowed Voice and Karama:** the card expressly grants a named advantage, while the normal native owner is absent. E3's secret-alliance terminology and the general alliance-cancellation rule support cancellation; absence of a native BG owner supports the opposite reading used for Atreides' differently worded effect. No retrieved Nexus FAQ selects one. Do not copy that earlier implementation choice as authority.

The existing Betrayal response-privacy question remains pending; this audit adds no duplicate user question. It likewise does not settle historical Homeworld occupation ownership. Ordinary unoccupied, older, storm-free advisor groups are a clear selection subset, but broader claims must retain the boundaries above.

## Suggested state and verification contract

Keep stance choices public and event-bound: owner, turn, own-action identity, selected territory IDs, original counts/stances and settled/canceled result. A retry must not flip twice or consume a second card. For borrowed Voice, keep source and receipt separate from native ability ownership, with cancellation behavior dependent on the unresolved ruling.

Exercise multi-territory and multi-sector selections, current-owner timing, conserved counters, Basic absence, occupied strongholds, No-Field getter traps, stale selection and saved continuations. Voice tests should cover generic and named special commands, impossible compliance, prior inspection, sealed plans, private hand permutation and bot actions using only projected choices. No runtime was changed by this audit.
