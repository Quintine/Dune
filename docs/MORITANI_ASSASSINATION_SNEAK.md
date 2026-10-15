# Terror Assassination and Sneak Attack: source boundary

Reviewed 15 October 2026. Bounded follow-up to `MORITANI_TERROR_RULES.md` and `MORITANI_ENTRY_TIMING.md`. This note distinguishes printed instructions from explicitly provisional product composition; the original research phase made no runtime edits.

## Direct Terror instructions

Assassination selects a random leader from the entrant, kills that leader and awards spice; Zoal expressly awards 3. It supplies no exceptional-custody pool definition. The p. 14 captured-leader answer concerns the separate advanced **Assassinate Leaders** ability, not this token. [GF9 Ecaz & Moritani, pp. 5, 14](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Sneak Attack sends up to five Moritani reserve forces into the triggered territory, free, obeying storm and occupancy restrictions despite Aftermath. Moritani's starting reserves are expressly off-planet. The effect does not say it spends the ordinary shipment or movement allowance. Its operative verb is “Send”, without a separate rule expressly classifying this entry for other powers. [GF9 Ecaz & Moritani, pp. 5–6](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=6)

The proposed core behavior—bounded reserve transfer, no spice charge, no ordinary action consumption, restricted entry, specific Aftermath exemption—is consistent with that text. Zero performs no force arrival; it should not create an extra advisor/income trigger merely because a token was spent. This is ordinary composition of the quantity bound, not a retrieved zero-force FAQ.

## Sneak Attack and other arrival powers

| Interaction                     | Applicable primary rule                                                                                                                                                                                                                                                                                                                                                                   | Conclusion                                                                                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spiritual advisor accompaniment | BG may make a free reserve shipment when another faction ships from off-planet. Advanced advisors may accompany into the same territory. [Base rulebook, p. 18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18)                                                                                                                                           | Positive Sneak Attack transfers explicitly off-planet reserves onto the board. Calling that a shipment is a supported interpretation; no direct Sneak Attack/accompaniment ruling was retrieved. Free cost by itself is not an exclusion. |
| Intrusion                       | BG fighters may become advisors when another faction ships or moves into their territory; the FAQ requires that choice immediately and also includes worm rides. [Base rulebook, p. 18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18), [November 2020 FAQ, p. 4](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=4) | The same shipment interpretation supports Intrusion. No explicit Sneak Attack exclusion or paired ruling was found. Exact ordering still inherits the unresolved arrival-timing boundary.                                                 |
| Heighliners                     | Income triggers for off-planet shipment except when only Guild ships. The printed token limits its working phase; payment is not required. Income accrues once and is collected at phase end. [Ixians & Tleilaxu, p. 5](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=5)                                                                 | If classified as shipment, positive Sneak Attack in Shipment & Movement can trigger this income; do not grant another payout if already triggered. A Spice Blow worm-ride reaction is outside that token's working phase.                 |

Therefore neither “Sneak Attack definitely bypasses all shipment reactions” nor “a specific FAQ explicitly orders all these reactions” is supported. An implementation may adopt the shipment composition explicitly, or gate affected combinations pending a ruling. It should not accidentally adopt one by calling or omitting a generic shipment helper.

## Adopted shipment classification, 7 October 2026

The engine now **adopts the shipment composition explicitly for the Heighliners
token**: a positive Sneak Attack in Shipment and Movement calls the same
`techIncome(g, 'heighliners', entrant)` helper used by ordinary off-planet
arrivals, so the token owner accrues its once-per-turn income and collects it
at the phase boundary. The token itself still enforces its working phase, its
printed Guild exception and one accrual per turn, and a zero-force resolution
calls nothing — the earlier phase-5 guard is removed rather than left as a
duplicate check.

This is an **explicit implementation interpretation**, not a retrieved
publisher ruling: the printed verb is “Send”, and the classification of that
off-planet reserve transfer as a shipment is the supported reading recorded in
the table above. A Spice Blow worm-ride Sneak Attack stays outside the token's
working phase and accrues nothing.

**Bene Gesserit reactions are now composed under the same interpretation.** The
committed Terror entry resolves first — the Moritani forces are placed and the
entry closes — and the Bene Gesserit reactions then run exactly as they do for
an ordinary off-planet shipment: an eligible Intrusion choice (Advanced, when
Bene Gesserit fighters stand in the destination) carries the spiritual-advisor
follow-up, and declining it still offers the free one-to-two-force advisor
shipment, whose own arrival keeps its existing territory and storm validation.
A zero-force resolution opens none of these, because no force arrived. This
selected order is an implementation interpretation, not a located ruling; it is
recorded here and in the pending-interpretation registry.

Evidence: `tests/moritani-force-leader.test.ts` asserts the Heighliners accrual,
the once-per-turn guard, the unchanged zero-force resolution, the altered-sector
rejection, the post-entry Intrusion offer and the full decline → advisor →
placement chain; `docs/COMPONENT_INVENTORY.md` records the reduced boundary.

## Assassination pool: adopted provisional composition, 15 October 2026

The selected product policy is **effective current control**, not native-array
membership and not battle availability. It includes every actual living native
disc still controlled by the entrant, its actual captured foreign discs and
ordinary foreign Gholas, and the one canonical shared Duke when controlled by
the entrant. A native disc captured or held as a foreign Ghola elsewhere is not
in its native faction's pool. Harkonnen capture overrides a foreign Ghola's
underlying Tleilaxu control. Dead discs never enter the pool. An ordinary native
leader revived normally remains ordinary; its death history alone is not
foreign-Ghola custody.

This exceptional-pool definition is **provisional product composition**, not a
retrieved publisher ruling or a numeric decision supplied by the user. The
printed Terror instruction supplies no exceptional-custody definition. The
separate p. 14 **Assassinate Leaders** FAQ does not settle this random Terror
pool, its visibility, or its bounty.

Battle availability and physical custody remain different facts. Harkonnen's
restriction on capturing leaders previously used elsewhere that turn is a
restriction on **capture**, not on Terror. A living `usedAt` disc remains
eligible; importing `captureCandidates` would silently change probabilities.
[Base rulebook, pp. 10–11, 17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

The focused server quote in `game/moritani-terror-assassination.ts` validates
original native identity, name and strength, complete five-disc native
inventories and unique physical custody. It preserves the original rosters:
foreign discs stay in their native arrays, and Duke remains a separate Ecaz
strength-six disc with no Traitor. The actual optional Advanced CHOAM Auditor
is a physical sixth disc and is eligible while living; its capture and
foreign-Ghola prohibitions do not grant immunity to random Terror.
Foreign-Ghola Duke is forbidden by binding Ecaz-only revival, not treated as a
new source. The quote reuses `controlsLeader` and server `dukeController`,
returns original disc references in a fresh array, and performs no RNG,
mutation or public projection.

**Public victim policy:** actual Terror assassination publicly identifies the
killed disc, including a previously concealed captive, and clears that
capture's concealment. This is an explicitly provisional public-effect
interpretation. It does not change ordinary Harkonnen private execution or
turn unrelated hidden captures into public information. Pay the killed disc's
native printed bounty, explicitly **Zoal 3** and **Duke 6**, never a copied
battle strength or skill bonus. Kill once, remove the original dead leader's
skill if applicable, clear battle-use history, and use original death/custody
cleanup: a captured ordinary disc returns to its native or underlying Ghola
custody, while the dead shared Duke is set aside in Ecaz's Tanks rather than
restoring his former controller.

**Empty-pool policy:** revelation spends/removes the token even when the
effective-control pool is empty; there is no victim, no bounty and **no random
draw**. Continue the original committed arrival once. This is provisional
composition, not a located empty-pool FAQ. Neither the offer nor public/private
availability may depend on held or concealed leader state: do not project the
pool, expose its size, or restore the former exceptional-custody/empty-pool
availability gates. Structural physical-identity validation is not a player
choice or a hidden-state-dependent offer.

## Verification and limits

Read the relevant printed pp. 5–6 and 14–16 in `/tmp/dune-rules/ecaz-audit.txt`, the corresponding publisher-indexed expansion passages, base rules, and the Heighliners passage in `/tmp/dune-rules/ix-official-mirror.txt`. Targeted GF9/Future Pastimes searches used Sneak Attack with shipment/advisors/Intrusion, and Assassination with captured/Ghola/Duke. The [designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani) yielded no additional written pool or entry-classification clarification. No community answer or rule for a different Dune game was substituted. Lack of a retrieved ruling is a documented research limit, not proof that none exists.

## Implementation and evidence boundary

The former ordinary-only checkpoint gated exceptional custody and empty pools;
that policy is superseded by the provisional composition above. Pure behavior
regressions cover effective native/captive/Ghola custody, capture precedence,
canonical Duke/Auditor participation, used living discs, dead/empty pools,
printed values and rejected altered/duplicate physical identities.
The frozen affected22-file union passes **195/195**, with types/lint/build.
Original native play supplies a real Harkonnen-captured Duke and a later real
paid shipment into the placed token. Actual styled390px GameTable reveals the
original token; a scoped original random permutation selects captive Duke,
kills him once, pays six, removes the token and resumes the original arrival.
It does not fake an effect or put a target in the client action. No overflow or
browser errors were observed. The empty-pool engine/API boundary spends the
token without bounty/RNG and resumes a genuine Guild arrival; its preceding
five Guild deaths are **staged**, not an original five-death play chronology.
All four original policies make accepted reveal or alliance decisions; only
Easy reveals in that position, while Medium/Hard/Brutal form the accepted
alliance. This is minimal legal participation, not four Duke kills or strategic
calibration. No saved/deployed rooms or complete-mode acceptance are covered.

Sneak Attack's owner projection supplies reserve maximum and any blocking
reason at the offer and resolution stages. Thus the player can preserve the
hidden token before an unsupported positive entry; deliberate zero-force
revelation remains possible. No ordinary action counter or spice payment is
consumed. The adopted Heighliners and BG shipment compositions are recorded
above; older blanket unsupported claims are not current policy. Expansion
starts and full-combination acceptance remain gated.
