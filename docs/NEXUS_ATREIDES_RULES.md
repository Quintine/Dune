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

**Selected provisional composition — 26 October 2026.** The 14 October
choose-recommended authority supersedes the earlier blanket product refusal.
The printed Residual Poison window remains available after two completed
nonleader Cunning inspections, before either combatant commits a leader.
Active interactions and exact card commitments still resolve as required.
This does not make leader-valued inspection commitments poisonable.

Resolve the one actual random eligible leader death and discard first. Use the
same existing reconciliation already used after canceled Sardaukar enhancement:

1. Test the original native nonleader answer without obsolete extra bindings
   or Truthtrance. Keep it if a legal prepared plan can still honor it.
2. Test the extra Cunning answer jointly with any retained native answer. If
   no legal plan honors both, reopen the extra answer's original field.
3. If the native answer itself is impossible, reopen both current bindings.
   Answer its original field first, then the extra field through the original
   saved protocol, so the old extra binding cannot constrain the renewed native
   choice.
4. Reconcile Truthtrance only after retiring the impossible inspection bindings.
   Keep earlier private observations and the spent Nexus receipt; re-answering
   changes neither field selection nor card cost. Never redraw the victim,
   restore a dead leader or repeat the discard to save a commitment.

The ordered pair reopening when native becomes impossible applies to Residual
Poison, including its original discard continuation. Sardaukar cancellation
retains its existing still-feasible other answer. The native-first priority is
an explicit online interpretation, not a retrieved publisher choice among
incomparable surviving answer sets. The earlier source
question is not a separately answered publisher ruling. Ordinary single-element
Secret Ally and native inspection paths continue to use their existing rules.

A resource-exclusive example motivates the joint check: Advanced CHOAM can have
four ordinary battle forces, no spice, one usable living leader, a projectile,
Ghola and the one Karama needed to activate its unused cash-in power. Native
dial3 and Cunning projectile may both be reachable before death by selling
Ghola for support. After that last usable leader dies, Ghola cannot both be
sold for support and revive a leader for the projectile. Keeping native dial3
permits an unarmed plan after cash-in; keeping the projectile alone can permit
revival with a lower dial. The special-activation Karama is not a second freely
saleable funding card. The controlled regression must execute the real actions
and check reachable continuations rather than treating this prose as proof.

[Controlled reconciliation evidence](../tests/nexus-residual-ambiguity.test.ts)
is separate from [the genuine acquisition/Nexus/battle source](../tests/fixture-residual-cunning.ts)
and [its runtime cases](../tests/residual-cunning-engine.test.ts).
Complete combinations and final assurance remain open.

## Focused prototype evidence — 26 October 2026

Frozen17-file131/131, types/lint/build and five engine/GameTable SSR journeys
pass. Genuine public Basic108/Advanced120-action sources really buy Residual1,
draw the original Atreides Nexus, ship Richese1 into Arrakeen and answer both
fields. The actual random death preserves both feasible answers; each battle
finishes legally. Separate controlled Advanced resource/leader seams execute
both resource-exclusive priorities and impossible-native ordered re-answers,
including actual cash-in, Ghola and battle. All45 physical Treachery and12 Nexus
cards remain. Seven native cases, four controlled engine cases and six rendering
supplements include four-profile legal participation and existing cancellation
compatibility. Controlled setup is not original acquisition proof.

Report/logs: `/home/quintine/.local/share/dune/checkpoints/20261026-residual-cunning-proof-v3/`;
journeys/HTML: adjacent `20261026-residual-cunning-runtime/`.
No saved-room/D1/server, deployment/restart or recovery operation. No DOM/
hydration, browser/mobile or clicked-control acceptance; complete combinations,
full rules and final assurance remain due.
