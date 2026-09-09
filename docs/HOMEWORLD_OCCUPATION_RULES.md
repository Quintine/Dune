# Homeworld occupation: qualification and unresolved entitlement

Source audit, 9 September 2026. This supplements [Homeworld rules](HOMEWORLD_RULES.md#occupier-lifecycle-and-benefits) and the [invasion audit](HOMEWORLD_INVASION_RULES.md#occupation-evidence-and-unresolved-lifecycle). It defines the evidence that can safely be recorded; it does **not** settle every occupied benefit or authorize a complete occupation release. The [integration audit](HOMEWORLD_OCCUPATION_LIFECYCLE_AUDIT.md) maps the physical mutation and recovery boundaries.

## Confirmed publisher contract

The E3 rulebook establishes these distinct rules:

- Foreign forces at the start or end of a game turn qualify their faction as an Occupier. Sole foreign occupation at any instant qualifies immediately for that turn.
- High advantages follow the native reserve threshold. Occupation retains the native low penalty; no global sentence explicitly suppresses a restored high advantage or replaces its battle value.
- The printed occupied bank award occurs during Spice Collection, including Basic. Occupation income may immediately be shared with the occupier's ally.
- Homeworld effects cannot be canceled with Karama.

These are separate conditions, rather than three mutually exclusive card states. [GF9 E3, pp.9–10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=9).

The Kaitain FAQ divides a five-spice purchase into Emperor three and occupier two, including an occupier's own purchase. It does not demonstrate multiple contributors or resolve competing recipients. [GF9 E3, p.15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=15).

Here a game turn is the complete nine-phase sequence, Storm through Mentat Pause; an individual player's shipment/movement opportunity is not this boundary. [GF9 base rules, p.7](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=7).

## Executable evidence contract

The following is an implementation design derived from those timing requirements, not an additional rule about who receives a disputed reward:

1. Keep native population, present foreign armies and historical qualification evidence separate. Include the exact Homeworld ID: Emperor's two worlds are distinct locations.
2. After a completed semantic force change, record a sole-occupation event when exactly one foreign faction has forces and no other faction has forces there. A single foreign faction sharing the world with natives is not alone. Do not require an Arrakis stronghold or treat Homeworlds as territories.
3. Observe the old turn's end before incrementing the turn; observe the new turn's start before opening Storm opportunities. At a boundary, preserve every foreign presence relevant to the printed qualification sentence. If multiple factions satisfy the sentence, storing their evidence does not authorize duplicate rewards.
4. Bind each observation to its accepted event, turn, world, qualifying faction and cause (`sole`, `turnStart`, `turnEnd`). Make observation replay idempotent. Keep historical facts after departure; a future entitlement policy can expire a benefit without erasing that the qualification happened.
5. Observe semantic casualty groups rather than intermediate array writes. A separately ordered loser removal can make a foreign winner alone before its own casualties; simultaneous destruction must not manufacture a survivor from implementation order. See the integration audit for the existing battle continuation boundaries.
6. Use a separate once-only Collection receipt for any awarded bank income and its immediate ally allocation. Qualification, refresh, view projection and JSON normalization must not themselves mint spice. A later qualification is not an instruction to replay an earlier Collection.

A public qualification record needs no hand, Traitor, Face Dancer or sealed-plan data. Malformed initialized evidence must fail validation; a legacy save lacking history cannot be claimed to prove that no earlier qualifier existed. Resolving entitlement by scanning current armies alone would discard the distinction the publisher created.

## Questions the retrieved sources do not settle

| Concrete situation | Missing decision; do not silently substitute a policy |
| --- | --- |
| A qualifies alone, then departs completely | Whether all continuing benefits expire immediately or some survive for the stated game turn. |
| A departs and B becomes alone in the same turn | Whether A retains any entitlement, and which faction controls a unique occupied power or receives the next receipt. |
| B enters while qualified A remains | Whether A's remembered qualification continues to supply each benefit while contested. |
| Multiple foreigners remain at a turn boundary | How the qualification wording composes with a unique card choice, Duke custody or a single income stream. Storm order is not an established automatic tie-break here. |
| Native revival restores the high threshold after qualification | How retained low penalties and occupied benefits expire; occupation alone supplies no explicit global high-benefit suppression. Do not infer low charity/revival bonuses or a low native battle value merely from a remembered qualifier. |
| A leaves and returns during the same turn | Whether departure interrupts a specific benefit and triggers its cleanup. Recording a second arrival must not itself create a second Collection award. |

Tupile's verified physical reverse explicitly requires hand-limit cleanup when occupation ceases and removes native CHOAM's low advantage. That specific endpoint must be implemented once its triggering occupation condition is determined; it does not establish a universal expiry policy for every card. Original component provenance and the separate occupied income symbols are recorded in the [component audit](HOMEWORLD_COMPONENT_AUDIT.md). This audit did not re-fetch the old reverse-image cache.

The sharing sentence covers occupation income broadly. A bank-only implementation should not silently exclude later occupied percentage receipts; their funding identity and legal beneficiary must first be resolved. An alliance prohibition arising from physically invading a prospective ally is separately grounded in actual presence, rather than in an invented single controller shared by every consumer.

## Fresh research and implementation boundary

The current publisher-indexed E3 Homeworld text was retrieved again. The previously examined E3 FAQ supplies the Kaitain arithmetic but no complete departure/replacement algorithm. Bounded searches of GF9, Future Pastimes and designer-name results found no authenticated further ruling. The [designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani) links [Homeworlds Revealed](https://www.youtube.com/watch?v=4KZKz13wf9c); no usable spoken transcript was retrieved. Earlier component-frame inspection is not evidence for an unheard spoken clarification. A community compilation's replacement of the publisher's boundary clause with an unopposed-only definition is not an official erratum. Search absence does not prove that no clarification exists.

The existing source documents already record these unresolved cases. During this audit the coordinating agent sent the user this concrete clarification, and the answer is pending: **If Guild occupies an empty Homeworld, then withdraws its last force and another faction occupies it during the same game turn, who keeps that Homeworld's occupied ability and income—the first faction, the current occupier, or both?** None of these alternatives is presented here as the official answer. Do not send a duplicate question or treat elapsed time as an answer.

Progress can continue independently on population-only low Kaitain/Junction income reductions, retaining the [contributor routing contract](GUILD_SHIPMENT_PAYMENTS.md#publisher-contract-and-precedence). Rounding once over an eligible transaction total and evaluating a continuous threshold when income actually settles are reasoned compositions, not explicit worked publisher examples for allied funding or Ghola-interrupted receipts. Preserve those distinctions and the already documented [payment-splitting source gap](HOMEWORLD_CARD_ECONOMY_RULES.md#deferred-payment-splitting). A unique current garrison is not sufficient evidence to discard an earlier faction's same-turn qualification.

This documentation-only audit changes no runtime, stored games, mode gates or publication status. Verification is limited to source/link review and the patch whitespace check.
