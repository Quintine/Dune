# Ixian Nexus Cunning: full-strength Suboids

Primary-source audit, 10 September 2026. This is a source contract, not an implementation or expansion-release claim. Other Ixian Nexus modes are outside this checkpoint.

## Authority and result

The original Ixian face was freshly inspected in `/tmp/dune-nexus-cards.jpg`, the [photograph of GF9's twelve printed cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani). Its Cunning panel applies before the native Ixian player's Battle Plan is formulated. All that player's Suboids count at full strength in all battles during that turn, without spending spice to support them. The physical Nexus card is then discarded under the [E3 common rules, p.11](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11).

[E1 p.9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=9) makes Suboids half-strength in Basic. Its Advanced paragraph keeps them at half strength and prohibits increasing that value by paying spice. The new card explicitly overrides that limitation. It is useful in **both Basic and Advanced**, rather than an Advanced-only advantage.

| Force profile | Ordinary rules | With Cunning active this turn |
| --- | --- | --- |
| Basic Suboid | 0.5 per physical counter | 1 per physical counter |
| Advanced Suboid | 0.5, unaffected by spice support | 1, without a support payment |
| Cyborg | Its existing Basic/Advanced values and support rules | Unchanged |

The Advanced support distinction comes from [base p.13](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=13), combined with E1's Suboid exception. Cunning does not double a Cyborg, create extra counters, or change shipment, revival, spice collection or movement. The [November FAQ p.7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7) expressly excludes Suboid strength from Karama cancellation. Applying that named exception to enhanced Suboid strength is a source composition; it does not establish immunity for every Nexus card or suppress separately cancelable Cyborg substitution.

Fresh official-domain indexed excerpts were retrieved for E1 p.9, base p.13 and the November FAQ. The card is the primary source for its duration and timing; no tournament or fan rewrite was used.

## Executable composition

- Activation belongs to native Ixians holding its own Nexus card, before its plan in a current battle. Preserve the common unallied requirement. Playing it spends the single physical card and records one public activation; no subsequent confirmation is needed.
- Bind the grant to `{event, owner, faction: ixians, turn, activationBattle}`. Eligibility is not re-created from whether the discarded card remains visible in the current discard pile: recycling or a later draw must not end or duplicate this turn's grant.
- The effect covers the activation battle and later battles that turn. It cannot change an already resolved earlier battle. Native ownership of affected counters is the relevant identity; do not turn another faction's forces into Suboids.
- Every strength consumer must use the same active-turn force profile: feasible dials, support choices and costs, Truthtrance/Prescience commitments, bot plans, previews, resolution and the winner's legal casualty allocations. A Suboid still represents one physical token when lost. Preserve ordinary survivor-for-Cyborg substitution and its separate cancellation conditions.
- In Advanced, support selection/payment must not charge the active Suboids; Cyborg support remains chargeable. A blanket free-support flag for the whole Ixian army would be wrong.
- Keep the receipt after card disposal and through JSON restoration. Compare its recorded turn at each relevant calculation, and expire the benefit on the actual turn transition without replaying an earlier activation.

“Before formulating” is the printed timing. Treating the server's first committed plan as the submission boundary is an implementation convention, not additional publisher wording. A prior inspected element or Truthtrance commitment must remain binding if activation is allowed afterward; the effect is not permission to change an already promised dial. No source permits reopening a sealed plan to play the card. Early battle preparation before any own commitment is the unambiguous activation window; later partial-plan timing needs to be represented consistently with the game's established plan workflow.

## Boundaries and verification

The face does not restrict the bonus to one territory, the first battle, or the counters present at activation. Later revived/arriving Suboids are still that player's Suboids in a battle during the same turn. This follows its turn-wide class description rather than a new per-counter grant. Homeworld combat and any Ecaz combined-force adapter must retain their existing physical-owner and printed battle-size rules while applying the applicable token profile; Cunning does not enlarge a Homeworld's allowed defensive army.

Test Basic and Advanced with mixed Cyborg/Suboid armies, zero spice, a later same-turn battle, expiration next turn, physical losses and substitution, unchanged protected commitments, duplicate/stale activation, owner/phase integrity, and JSON/CAS recovery. Preserve all existing Homeworld, Advanced and expansion gates; passing this force modifier does not certify the other two Ixian Nexus effects.
