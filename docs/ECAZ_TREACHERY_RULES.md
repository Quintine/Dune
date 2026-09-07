# Ecaz expansion Treachery Cards: primary-source audit

Audit: 2026-09-06. Scope: Reinforcements, Recruits, and Harass & Withdraw. This document records component evidence and implementation boundaries; it does not certify an implemented expansion. No runtime files were changed.

## Sources and reproducible visual anchors

- **E3:** [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed pp. 4, 9, 11, 16. Publisher-indexed text was retrieved. Printed pp. 4 and 11 were also visually inspected in the [publisher-authored PDF mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf). The mirror is not assumed to resolve revision conflicts elsewhere in this expansion.
- **F:** [Future Pastimes expansion gallery](https://futurepastimes.com/dune-expansion-sets), figure caption naming the three new Treachery Cards. [Exact original figure](https://images.squarespace-cdn.com/content/v1/5627edd5e4b0e42d8c948a6a/1697055394182-97KD40K94W1GMCCIS1LU/Dune%2Bexp%2B3%2Bcomponents2.png). This 453-by-719 image was successfully inspected in a browser after the web fetch tool could not display it. Harass & Withdraw is fully visible; Recruits and Reinforcements overlap. Do not reconstruct covered text from this figure alone.
- **J:** [Jack Reda / Future Pastimes Games, designer unboxing](https://www.youtube.com/watch?v=iF5E3-LOfhY&t=486s), 8:06-9:45. The [designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani) embeds this video. Its author identifies himself as the expansion designer. Auto-generated captions were inspected as a navigation aid and cross-checked with printed components where possible. At 8:06-8:15 he identifies three additions and a 50-card combined deck including expansion 1. At 8:25-8:48 he explains Recruits; at 8:55-9:05 Reinforcements; at 9:11-9:29 Harass & Withdraw.
- **A:** [Solveig Reda, expansion artist's unboxing](https://www.youtube.com/watch?v=P9ZTV1uZqsM&t=258s), linked directly in J's description. Printed card close-ups: Recruits at 4:21, **Reinforcements at 4:24**, Harass & Withdraw at 4:28. These were visually inspected through the browser, not inferred from captions. The Reinforcements face is unobstructed at 4:24 and legible enough to verify every gameplay sentence. A documents manufactured components; its commentary is not used to invent rules.

The temporary mirror PDF is `/tmp/dune-rules/ecaz-mirror.pdf`. Browser-exported navigation transcripts are `/tmp/browser-use/exports/youtube-iF5E3-LOfhY-cb81ab2f-9773-4bb4-9632-c8956d6c680c.txt` and `/tmp/browser-use/exports/youtube-P9ZTV1uZqsM-88890134-d427-47a5-b6e7-6cd0f812b33c.txt`. Public URLs and timestamps above remain the durable provenance; no copyrighted image was added to the application.

Use a specific official FAQ over a general paragraph where applicable. No fan rewrite, tournament amendment, or unverified transcription is authority here. No material conflict among the inspected Treachery Card passages was found; unresolved interactions below remain unresolved.

## Verified rules

**Shared rules (E3 pp. 4, 9, 11):** There are three physical additions, shuffled into the Treachery Deck. The variant can be used independently of faction selection and other variants. All are discarded after use. Reinforcements and Harass & Withdraw occupy either weapon or defense slot but are neither category. Prescience requesting that category receives a declaration of no such card, without exposing the special card's identity.

**Reinforcements (A 4:24; J 8:55-9:05):** Commit in a Battle Plan in either slot. Increase the dialed number by 2, then transfer 3 own reserve forces to the Tanks. Holding at least 3 reserve forces is a prerequisite. The face states no spice payment. Discard after use.

**Recruits (E3 pp. 11, 16; A 4:21; J 8:25-8:48):** Play during Revival. For this turn, double every faction's current free-revival rate and raise the ordinary force-revival limit to 7. The FAQ's low-threshold Fremen example doubles 4 but caps the result at 7. No separate spice cost is stated; paid revivals are not made free by the card. Discard after use.

**Harass & Withdraw (F; A 4:28; J 9:11-9:29):** Commit in a Battle Plan in either slot. When revealed, return own undialed forces to reserves; leader death still operates normally. An opponent's Traitor call cancels this effect. A Face Dancer affecting the card user's leader does not affect the returned undialed forces. The card cannot be used on the user's own Homeworld. No spice charge is printed. Discard after use. E3 p. 16 clarifies that, with Ecaz and an ally co-present, only the card user's undialed forces return; the other ally resolves normally.

| Component         | Quantity confidence                                                                       | Gameplay definition confidence                             |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Reinforcements    | One: three total additions, three distinct printed identities shown in F/A and named by J | Full face inspected; battle interactions below remain open |
| Recruits          | One, same evidence                                                                        | Official text/FAQ plus card close-up                       |
| Harass & Withdraw | One, same evidence                                                                        | Full face inspected plus official ally clarification       |

These are special cards, not additional Worthless identities. The combined base 33 + Ix 14 + these 3 inventory is 50 physical Treachery Cards, independently corroborated by J 8:06-8:15. This does not add Richese's separate ten-card cache to the ordinary deck.

## Engine contracts supported by this evidence

The following are implementation recommendations, not extra tabletop rules. Existing functions were inspected only to identify integration points.

### Shared battle-card representation

`validatePlan`, `findReachableBattlePlan`, `prescienceAnswer`, and the stored `b.prescience` currently bind weapon/defense fields to physical card IDs. Merely adding these cards to `WEAPON_KINDS` and `DEFENSE_KINDS` would leak identities and could make a truthful answer of no weapon incompatible with a legal plan.

Represent **slot occupancy** separately from **effective card category**. Keep the actual committed ID private until reveal; use a category-aware projection for Prescience and its later equality/feasibility checks. Do not globally equate a null weapon answer with an empty slot. Audit `truthtrance.ts` and battle-promise evaluation, Voice matching, special Prescience, and hand-exchange locks through the same distinction. A generic weapon/defense Voice cannot silently make these into weapons/defenses.

Validate ownership, a single physical card per slot, the ordinary plan prerequisites and any special-card prerequisites before locking. Preserve the exact committed card across JSON recovery and future reactions. Disposal must have an explicit automatic-use path in `resolveBattle`; leaving it in the winner's optional `battleCards` decision would allow unintended retention after a successfully resolved use.

### Reinforcements

Keep a distinct declared card effect and a proposed reserve-casualty selection. Revalidate available reserves at commitment; neither UI nor bots may conjure three off-board units. The effect transfers real reserve units to Tanks and does not place extra units in the battle territory. Preserve regular/elite inventory counts and Atreides battle-loss bookkeeping according to the eventual cost-timing ruling.

A normal, non-Traitor, non-explosion Basic fixture can verify the modifier and reserve transfer. Do not claim its advanced casualties are certified merely by adding 2 to `Plan.dial`: that field also controls physical casualty enumeration and spice support in the current engine. The distinction between the submitted force commitment and the card-adjusted battle number needs an explicit contract before enabling advanced combinations.

### Recruits

Use an authoritative turn-scoped effect, e.g. a stamp keyed by `g.turn`, and a shared effective-rate calculation. `forceRevivalLimit`, `freeRevivalRemaining`, `forceRevivalQuote`, `PendingRevival`, and the CHOAM/Tleilaxu exception checks must consult the same result. Reset by phase/turn lifecycle; do not permanently mutate faction metadata.

The card is global: changing only the player's next quote is insufficient. Preserve previous revivals and recompute remaining allowance from the effective total; do not blindly grant seven additional forces. Reprice/revalidate a pending revival only under an explicit timing decision, rather than changing an already accepted payment after the fact. No source here authorizes consuming the card through an unresolved revival-response window.

### Harass & Withdraw

Retain the physical force commitment needed to distinguish dialed and undialed units. With advanced half-strength/double-strength units, subtracting the numeric dial from territory count is invalid. The existing `casualtyOptions` mechanism can contribute physical choices but currently chooses losses only for a winner; withdrawal can matter to either participant.

A persistent battle-resolution continuation should preserve withdrawal intent through the Traitor decision. Do not move forces irreversibly to reserves and then let a successful Traitor call overlook them. Conversely, `pendingFaceDance` must not treat returned reserves as still in the battle territory. The ally's force collection must stay separate even when Ecaz contributes strength.

## Unresolved interactions: do not introduce house rules

| Issue                                      | What is known / remaining question                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reinforcements and a Traitor outcome       | Its face states modifier, reserve cost and disposal; it does not state whether the reserve cost is paid when the Battle Plan is defeated/canceled by a Traitor, or when its user wins by calling one. Reconcile the normal traitor rule with the special's use timing before enabling this combination.                                              |
| Reinforcements and advanced accounting     | The modifier targets the dialed number, but no inspected passage says whether those 2 require spice support or add on-board casualties. Likewise, the eligible regular/elite reserve mix and treatment as battle losses need explicit adjudication. Preserve separate fields rather than making this hard to correct later.                          |
| Reinforcements and explosions              | No inspected passage gives the reserve-cost ordering versus Lasgun/Shield or another instant battle outcome.                                                                                                                                                                                                                                         |
| Harass & Withdraw and explosions           | The designer says withdrawal occurs on reveal and the face explicitly names a Traitor cancellation, but no retrieved official FAQ directly states the Lasgun/Shield ordering. Record the distinction between an inference from reveal timing and a verified combined ruling.                                                                         |
| Harass & Withdraw with unusual commitments | Advanced unit selection, Ecaz's undialed support units, zero dial, and multiple-sector participation need exact physical accounting. The p. 16 FAQ settles whose forces return, not every casualty-selection detail.                                                                                                                                 |
| Recruits played after earlier revival      | The printed timing says during Revival; it does not settle refunds for previously paid revivals, reopening a completed player opportunity, or replacement of a pending transaction. Do not quietly restrict it to phase opening and call that printed timing.                                                                                        |
| Recruits and exceptions                    | J calls 7 the normal limit and compares it with Tleilaxu's 5 permission. Do not silently reduce CHOAM/Tleilaxu's unlimited advantage to 7. Combined interactions with Karama limits, La La La/free-revival prevention, Fremen ally grants, special units, and changing Homeworld thresholds were not fully audited here.                             |
| Cancellation/disposal generally            | These are card effects, not faction advantages; the inspected E3 Karama table does not give a generic direct counter to them. Preserve applicable Voice/traitor rules, but do not invent a new Karama cancel menu. The Harass traitor-cancellation sentence does not alone settle whether a canceled special was used for winner-retention purposes. |

## Meaningful validation for the later implementation

- Count 50 physical cards with unique IDs when base, expansion 1 cards and these additions are combined; check name/category/disposal consistency and independent variant selection.
- Exercise each legal slot and dual-card combination; verify neither category leaks through normal Prescience, special Prescience, Truthtrance or Voice feasibility checks. Test all private views before and after reveal.
- Reinforcements: 2 versus 3 reserves, exact reserve-to-Tanks conservation, no phantom on-board arrivals, repeated request/recovery, and approved traitor/explosion/advanced interpretations.
- Recruits: all factions' quotes, partial prior revival, current rather than printed free rate,7-force cap, reset next turn, cancellation/phase continuation and pending-quote custody.
- Harass & Withdraw: winner and loser, zero dial, Traitor cancellation, returned reserves versus Face Dancer replacement, independent ally groups and prohibited own-Homeworld use.

No runtime tests were added or claimed for this source task. At this source audit’s initial snapshot the repository had no factory entries for these names. The subsequent isolated definitions and inspector guides in `game/ecaz-cards.ts` are now tracked in `CARD_INVENTORY.md`; they do not activate the variant. Existing revival and battle helpers remain integration foundations, not evidence of complete card effects.
