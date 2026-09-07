# Fremen Ambassador relocation rules

Primary-source implementation review, 7 September 2026. The effect grants an immediate, independent relocation of one beneficiary-owned group. It does not grant the beneficiary a normal Shipment and Movement turn. The important remaining implementation obligations are typed custody, stance, Baliset and child arrival continuation; a missing Ambassador-specific example is not a reason to withhold ordinary rule composition.

## Sources and method

Fresh official indexed retrieval recovered the relevant publisher pages below. Direct access to these PDFs has returned 403 in this session; the readable local publisher texts were also inspected. Search indexing dates are not edition dates. No fan rulings, movie-game rules or tournament amendments were used.

- [2019 base rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), pp.7,9–10,12,16,18: movement/group/sectors, storm, occupancy, alliances, Fremen worm movement and BG stance. Local `/tmp/dune-rules/base.txt`.
- [November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), pp.2,4: sector changes are movement, city ornithopter availability is reevaluated, and advisor movement/Intrusion. This supersedes the earlier April FAQ where their advisor answers differ.
- [Ixians & Tleilaxu rules](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf), pp.6,9: typed forces and the Hidden Mobile Stronghold. Local `ix-official-mirror.txt`.
- [CHOAM & Richese rules](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), pp.6–7,10: No-Field movement/effective presence and CHOAM Baliset. Local `choam-lelekan-mirror.txt`.
- [Ecaz & Moritani rules](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), pp.5,7–8,10,12–16: effect, beneficiary, Occupy, entry triggers, Homeworld/Discovery distinctions and interruption. Local `ecaz-audit.txt`.

## Selection and destination

E3 p.8 grants movement of a group already on the board to any territory, retaining storm and occupancy rules. Its construction closely matches base p.16 worm riding. **Recommended composition: direct relocation with no adjacency, range or traversable-route search.** Otherwise an invented walking route would narrow the destination grant. Storm restrictions still apply to actual selected source and destination sectors; no intermediate territories are visited or trigger effects.

Use these selection requirements:

- The acting beneficiary is Ecaz or its current ally. Move only that beneficiary's pieces, not an aggregate allied army. The beneficiary chooses the group and destination; Ecaz's trigger does not choose another player's hidden marker denomination.
- Take a positive physical quantity from one source territory. The group may be a subset of the forces there and may combine selected counts from several sectors of that territory. Preserve ordinary/elite allocation per source key. Strength values are not token counts.
- Choose one destination territory and one of its valid sectors. Source sectors under the storm cannot contribute; a partly storm-covered territory can contribute its clear sectors. The destination must be clear. Stronghold/rock shelter protects against destruction, not ordinary storm movement obstruction. Fremen's Advanced reserve-shipment exception does not apply to forces already on the board.
- Same-territory movement to a different sector is supported by the FAQ's express sector-movement classification and the effect's unrestricted destination wording. Require a real change of position, not an identity action; it creates no new territory entry.

The route conclusion is an application of the unlimited destination grant and worm precedent, not a quotation explicitly using the word teleport. It should be documented consistently with the existing direct worm relocation model.

## Occupancy and Ecaz's own alliance

Ordinary hostile stronghold capacity, the Polar Sink exception and BG advisor treatment continue to apply. A movement into a territory with Moritani's Atomics Aftermath is not prohibited merely by that token's ban on **shipment**; this action is movement. It does not collect Guild shipment income, trigger off-planet shipping accompaniment or qualify as a Heighliner shipment.

Do not describe the old blanket ally-destination rejection as the printed rule for this feature. E3 Occupy expressly treats Ecaz and its ally as one faction for territorial co-occupation. Both possible beneficiaries belong to that pair. Implementing such co-occupation also requires correct subsequent battle and victory behavior. If the current runtime cannot support it, retain an explicit **Occupy implementation gate**, rather than presenting ally co-occupation as illegal under the source or enabling an unsupported combat state.

**Source-version discrepancy outside relocation:** the freshly indexed official E3 p.15 answer rounds Ecaz's battle contribution down (two of five); the local mirror `ecaz-audit.txt` around line 690 rounds up (three of five). This does not alter permission to co-occupy. Preserve the discrepancy for the later Occupy combat implementation rather than selecting a combat rounding rule in this movement helper.

## Typed forces, advisors and markers

**Elites.** Sardaukar, Fedaykin, Cyborgs and Suboids retain identity. Their ordinary movement range benefits are unnecessary here. Do not offer a Fremen/Ixian speed-cancellation window for an unlimited move granted by Ecaz's effect. This is not a use of those native range advantages.

**BG advisors.** Advisors are still forces and are not excluded from this relocation. Apply the November FAQ's current stance rules: destination BG forces cannot mix stances; advisors entering an otherwise empty territory become fighters; entering an occupied territory may offer the normal advisor/fighter choice where legal; fighters cannot freely become advisors merely because a different effect moved them. Preserve current advisor locks and the separately implemented Ecaz co-occupation boundary. A moved advisor can trigger Terror even though advisor entry is excluded from Ambassador triggers. Another faction entering BG fighters can trigger Intrusion.

The movement-based voluntary flip also applies to an Ambassador relocation during Spice Blow/Nexus: base p.18 FIGHTERS does not impose a phase condition. The separate stationary BATTLE preparation flip has its own timing. A same-territory sector transfer does not enter that territory anew, so it cannot manufacture the arrival flip or an Intrusion opportunity. Accompaniment restrictions and existing destination stance still take precedence.

**No-Field.** E2 explicitly permits moving the concealed marker like forces, and treats even denomination zero as one effective force until revealed. A Richese beneficiary can therefore relocate its marker alone or alongside physical forces from the same territory. Moving it is not a new deployment: do not materialize reserves, change last-used history, or reveal its value. Carry exact owner-only token/event custody separately from public effective presence. Storm and destination restrictions still apply. The new Ambassador event and the existing marker event need different action fields.

**Hidden Mobile Stronghold.** Move forces, never the stronghold piece. Other factions' entry must begin in the territory at which it points, as required by E1 p.9; unlimited distance does not remove that explicit entry prerequisite. This condition names the containing territory, not a specific source sector. Ixians are not subject to that other-faction restriction. Forces already inside may use the relocation to leave for a legal destination. Require the stronghold to be placed. Its internal location is storm-protected. Moving a group does not move the stronghold pointer or generate its movement-collection income.

## Counters and card timing

Keep the entrant's original action and the beneficiary's normal movement bookkeeping intact: no shipment cost, `shipped` change, ordinary `moved` increment, Guild timing consumption or queue advancement merely for this relocation. The printed effect interrupts the entrant before that entrant continues.

City ornithopters, Fremen/Ixian speed, Kulon and the movement-card range alternatives do not enlarge an already unrestricted destination. Hajr does not duplicate this Ambassador effect. When the beneficiary later makes an ordinary move, evaluate city access from the board then: the relocation can have gained or lost that access. Preserve existing Hajr and played Ornithopter state; do not discard another player's active movement card or count this group as its next card group. In currently supported direct movement/worm entry callers, the entrant is excluded from being the Ecaz/ally beneficiary, so an entrant's active flight belongs to a different player. More general future child-entry producers must preserve their own cohort provenance explicitly.

**Baliset applies during Shipment and Movement.** E2 p.7 restricts movement into CHOAM-occupied territory during that phase, with shipment as the stated exception. This relocation is movement. No such Baliset condition applies to a relocation in Spice Blow/Nexus. A blocked declaration must not execute the force transfer. Preserve the committed Ambassador and let its required move resolve to another legal destination if available; do not consume an ordinary movement or silently resume `completeMove` after the Baliset response. Native CHOAM cancellation remains a separate response.

## Arrival obligations and finite continuation

There is **no recursive Ecaz Ambassador chain** in a normal valid table: every moved group belongs to Ecaz or its current ally, and both are excluded from triggering Ecaz's markers. BG copying the Fremen effect does not change that beneficiary relationship. A Terror-induced later alliance change is not a second physical arrival and does not retroactively create another entry.

Moritani Terror and BG Intrusion can still occur. E3 explicitly includes moved advisors in Terror entry and confirms that a No-Field arrival triggers it even at zero. Apply an actual territory arrival once after placement, with the real beneficiary as entrant. A marker's later reveal does not create another Terror entry. Complete the resulting child interaction before resuming the original Ambassador/entrant; preserve original turn, movement queue and worm continuation. The present singleton Ambassador field cannot simply be cleared early if doing so replenishes the cohort or resumes the original worm before the child finishes.

The sources inspected do not establish a universal priority for simultaneous Terror and BG Intrusion. That ordering remains a material cross-effect issue. It need not block destinations with no competing reactions, nor justify skipping either ability. Keep the existing competing-reaction gate honest until its continuation/order contract is implemented.

## Optional locations and unavailable moves

**Homeworlds are excluded by source, not merely unfinished code.** E3 p.10 expressly distinguishes them from territories. They are not source groups on the Arrakis board or destinations for this effect. Do not reuse this action as reserve transport or Emperor inter-homeworld movement.

Revealed Discovery locations are nested territories, with their own occupancy/shelter and entry rules. Unrevealed tokens are not arbitrary extra destination nodes. The normal-movement route example does not itself repeal a special unrestricted destination grant. The current board lacks Discovery location state, so retain that module's implementation gate and validate against actual current board nodes; do not encode a Discovery or Homeworld as a fabricated printed sector. No claim of complete Discovery integration is made here.

Ecaz can decline the original trigger. The Fremen effect adds a real beneficiary group/destination choice, not a new optional post-trigger **Do nothing** button. If no legal move exists, use the separately documented unavailable-effect interpretation already adopted for the Richese Ambassador: complete without moving pieces/counters, with the triggered token remaining used. That is an explicit resolution policy, not a publisher quotation establishing a universal rule for impossible effects. Distinguish an impossible legal move from an unimplemented interaction; the latter should remain visibly blocked, not quietly consumed as though the rule produced no result.

## Concrete implementation and verification contract

Use a nested move payload such as `decision.event = ambassadorEvent` plus `decision.move = {forces, eliteForces, territory, sector, noField?, event?: markerEvent}`. This is an API proposal. Reuse pure force selection, marker custody, current board identity and placement checks; do not call the normal movement suffix, which changes turn counters and flight state. Freeze only an actually declared move while a Baliset/stance response needs it. Never inspect hidden Terror identity or opposing hands to enumerate destinations.

Required examples: far destinations beyond all ordinary ranges; clear-sector subsets in partly stormed sources; legal same-territory redistribution; elite mixtures; advisor stance/Intrusion; No-Field zero/three/five projection equivalence; HMS entry from its containing territory and legal exit; no shipping income; Baliset in phase5 but not phase1; token/cycle/parent exactly once after Terror; original entrant's active Ornithopter continuation; and explicit Occupy/Discovery unsupported destinations. Every profile's candidates must use the beneficiary's own projected legal group contract. Persistence tests should reload at group choice, native response and child arrival, then race duplicate submissions under room CAS.

This source review changes no runtime or tests. It supplies a concrete relocation contract, while preserving the specifically identified optional-module and simultaneous-arrival boundaries.
