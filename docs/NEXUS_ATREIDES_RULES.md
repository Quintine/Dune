# Atreides Nexus: inspection and cancellation

Primary-source audit, 10 September 2026. This is a rule contract and an explicit record of unresolved interactions, not a runtime or expansion-completion claim. The [common Nexus contract](NEXUS_CARD_RULES.md) supplies physical custody, mode selection and alliance disposal.

## Authority

- [GF9 Ecaz & Moritani rulebook, pp.11 and 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11): the illustrated Atreides face, common mode definitions, special battle-card exclusions and Nexus FAQ. Fresh publisher-indexed text was inspected, alongside the previously verified publisher-authored PDF mirror and [photograph of the printed cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani).
- [GF9 base rulebook, pp.17 and 23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=17): native inspection, its alliance counterpart and Voice/Prescience/Truthtrance ordering. Fresh official-domain indexed page text was retrieved.
- [GF9 November 2020 FAQ, pp.3, 7 and 8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=7): effective weapon/defense answers, single-use Karama cancellation, cancellation of alliance abilities and simultaneous Truthtrances. Fresh official-domain indexed page text was retrieved. Direct PDF requests returned HTML despite HTTP 200; those downloaded files were not treated as PDFs or evidence.
- [GF9 CHOAM & Richese rulebook, p.6](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=6): the exact No-Field restriction. Fresh official-domain indexed page text was retrieved.

Tournament compilations surfaced in the search, including a longer battle sequence and broader post-Karama re-answer rules. Those are not adopted here as publisher rules. No newer designer clarification resolving the Nexus-specific cancellation questions below was retrieved.

## Three printed effects

| Mode | Native-faction condition | Effect and target |
| --- | --- | --- |
| Betrayal | Another seat is Atreides | Prevent its attempted battle-plan inspection. This is a reaction to the advantage being attempted. |
| Cunning | Holder is Atreides | Inspect a second element of that holder's opponent's Battle Plan. |
| Secret Ally | No Atreides seat | In the holder's battle, inspect one chosen opposing plan element: leader, weapon, defense or dial. |

Each use consumes the held Nexus card. None of these panels creates a real alliance or grants all Atreides powers. The Cunning wording targets the holder's own opponent; it does not independently grant an extra inspection in an ally's battle. The common Betrayal definition acknowledges that some cards can cancel alliance advantages, but does not enumerate an Atreides alliance example.

## Supported inspection composition

**A completed ordinary answer supplies Cunning's first element.** The face calls for a second element and imposes no requirement to select it before hearing the first. Allowing the holder to choose a different element after the ordinary answer, before battle commitments close the opportunity, follows that wording. This is composition, not a printed worked sequence. An answer of no weapon or no defense is still an answered first element; the native rule forbids a free replacement question, while Cunning expressly purchases the additional element.

**Keep inspection categories distinct from physical slots.** The November FAQ makes Weirding Way and Chemistry follow their role in the actual plan. E3 explicitly excludes Reinforcements and Harass & Withdraw from weapon/defense answers. Reuse the established role-aware answer and feasible-plan validation; do not reveal the entire plan, the player's hand, or an excluded special card merely because it occupies the requested slot.

**Voice precedes inspection.** Base p.23 orders native Voice before native Prescience, allows Truthtrance during their interaction, and permits changes to unaffected plan elements. E3 p.16 expressly puts BG Secret Ally before Prescience. Applying the same ordering when the inspection comes from Atreides Secret Ally is consistent composition; the FAQ does not separately name that reversed native/card pairing. Do not let a later Voice evade an already disclosed element.

**An attempted use needs a durable result.** Bind the requesting seat, opposing seat, battle, source mode and element. Cancellation must terminate that attempt without delivering its answer. Answer delivery must preserve its original value and corresponding commitment. Neither a read nor a retry creates another question. A later legal change requiring renewed disclosure is a continuation of the old commitment, not a new choice of element; the precise publisher basis for a blanket re-answer after every Karama was not established by this audit.

## Cancellation: what is established and what remains open

The November FAQ stops one use of a faction ability, using one battle's Voice as its example; it also permits cancellation of alliance abilities. Its Atreides entry blocks knowledge of one plan element. It does not cancel every inspection for the phase. This supports consuming the native opportunity when canceled rather than immediately offering the same ordinary request again. E3 Betrayal's instruction to prevent the attempted advantage supports the same outcome for its original attempt.

There is no published permission in the inspected material to repeat the canceled ordinary request indefinitely in the same battle. Equally, this does not establish that every independent card-granted inspection in that battle is canceled. Keep sources separate instead of setting one blanket no-inspection flag.

| Interaction | Evidence boundary |
| --- | --- |
| Native inspection canceled, then ordinary inspection redeclared in the same battle | Treat the original native use as spent; no retrieved rule grants a fresh ordinary use. |
| Native inspection answered, then Cunning requests another element | Supported composition of the second-element wording; the second choice is distinct. |
| Native inspection canceled by ordinary Karama, then Cunning played | Material unresolved case: does the enhanced advantage still supply one element after the first attempt failed, or require a first revealed element? No inspected FAQ answers this. A preceding Nexus Betrayal cannot create this sequence because it consumes the same unique card that native Atreides would need for Cunning, with no new draw during Battle. |
| Karama used against a separately declared Cunning inspection | Selected composition: Cunning is explicitly an enhanced native advantage. Karama's one-use cancellation therefore targets the additional live attempt and preserves the already completed first answer. Do not combine both attempts into a new indivisible effect. No new ruling is needed for this sequential case. |
| Karama used against Atreides Secret Ally | Selected composition: the card grants its effect to a non-Atreides seat with Atreides absent, so there is no native Atreides advantage owner for the ordinary cancellation target. Do not create that target. This follows source ownership; it is not a rule that all Nexus effects are immune to Karama. |
| Atreides Betrayal used against Cunning | Unreachable with the one physical Atreides Nexus card: it cannot simultaneously be held by native Atreides for Cunning and another seat for Betrayal. Do not fabricate a second copy to test this interaction. |
| Atreides Betrayal used against an allied native inspection | The cancellation panel names the Atreides battle advantage, and the common definition permits cancellation of some alliance advantages. Treating the ally's original native inspection as the named advantage is consistent composition; it does not turn Cunning into an ally effect. |
| Multiple seats attempt Karama/Betrayal on the same inspection | No inspected primary rule specifies their relative priority. Only simultaneous Truthtrances explicitly use storm order. A general storm-order serializer is implementation composition, not a Nexus-specific publisher instruction. |

Homeworld Karama immunity on E3 p.10 applies to Homeworld advantages and penalties. It supplies no Nexus immunity. Likewise, the separate protection of special faction Karama powers is not a general protection for Nexus cards.

## No-Field is a named-faction restriction

The exact publisher sentence is: “When you are in a Battle with a No-Field token, Atreides may not see your number dialed.” [CHOAM & Richese, p.6](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=6)

Native Atreides cannot evade this through Cunning. The sentence does not say every opponent, every inspection, or every Prescience effect. For Atreides Secret Ally, the later printed card explicitly offers the dial to a holder whose faction is not Atreides. Allowing that holder to request the dial is a defensible literal composition; no retrieved E3 rule expands the older named-faction prohibition. This distinction is not a claim that a card overrides every restriction. Keep the public No-Field token presence, exact hidden force availability and eventual reveal separate: seeing the number dialed does not reveal the token's denomination or the whole plan.

## Private responses and automatic progression

These are software requirements, not printed timing additions:

- The original requested effect may be public; the unplayed identities and response options in other hands remain private. Cunning and Secret Ally are publicly identified only when the holder actually plays the card.
- Validate a response against the exact still-live attempt before discarding either card or changing an answer. A second concurrent cancellation cannot spend another card against an already terminated attempt.
- Show a pass/decline only when the seat has a meaningful choice. A private answer already fixed by the declared plan needs no acknowledgement. Preserve the user's requirement to advance automatically when there is no action.
- Automatically removing seats without hidden responses while publishing the remaining waiting seats can disclose response availability. Hiding only card names does not prove timing privacy. Conversely, making every powerless seat acknowledge a window would violate the requested UX. The coordinator has asked the user about this privacy/progression tradeoff; the answer is pending. A private precommitted response policy could avoid a new hidden-hand-dependent pause, but must not invent or silently choose a player's optional card play.
- Do not retroactively remove an answer already seen, infer hidden eligibility from opponent plans, or inspect other hands in a client/bot legality helper. Historical private observations and live legal commitments are separate data.

The unresolved cases were reported to the coordinator before implementation decisions. This audit sent no user question and resolves none of the unrelated pending Homeworld rulings. Development may support verified common cases while retaining explicit guards, but must not label all three Atreides effects complete until their enabled cancellation and response combinations are decided and verified.

## Residual Poison and two inspected commitments

The following is a reasoned counterexample from the existing preparation rules,
not a reported executed gameplay regression. In Advanced play, CHOAM has four
ordinary forces in the battle, no spice, one living usable leader, a projectile,
Ghola and a real Karama, and its cash-in power is unused. Suppose native
Prescience fixed the dial at three and Cunning fixed the projectile. Before a
leader death, both answers are reachable: cashing Ghola supplies three spice,
enough to support the dial, while the living leader permits the projectile.

If Residual Poison kills that last leader, each answer can remain feasible by
itself. Keeping the projectile permits Ghola revival with a lower dial. Keeping
the dial permits cash-in while omitting the weapon. Keeping both cannot spend
the same Ghola both on revival and on funding, nor cash the committed projectile.
There is therefore no generally valid assumption that an earlier answer, a later
answer, or all individually feasible answers identify the uniquely correct
surviving set. The retrieved publisher rules do not select between these sets.

The coordinator has asked whether the affected player should choose the retained
commitment, the earlier commitment should take priority, or this combination
should await an official ruling. The answer is pending. No such priority is
implemented by this document. Until resolved, the runtime uses an explicit
development boundary: Residual Poison is unavailable after an answered Cunning
inspection. This guard depends on the publicly played mode and completion stage,
not the opponent's hidden cards, spice, or whether a private feasibility search
happens to find a conflict. It is not a printed prohibition. The independent
leader-commitment restriction still applies, and this boundary does not prohibit
the single-element Secret Ally continuation.

Any later implementation should test complete legal continuations with the
proposed retired bindings removed on private copies. Testing one binding while
another impossible binding remains can falsely release a valid dial. Likewise,
reconciling Truthtrance before retiring an impossible inspection can wrongly
release an otherwise feasible promise. Preserve historical disclosures and the
consumed Nexus receipt separately from active bindings; a renewed answer is to
the original field and does not consume another card. Multiple incomparable
maximal surviving sets must not acquire an unexplained software tie-break.

The focused [public-guard regression](../tests/nexus-residual-ambiguity.test.ts)
covers the declared implementation boundary and hidden-state independence. It
does not claim to execute or resolve the counterexample above.
