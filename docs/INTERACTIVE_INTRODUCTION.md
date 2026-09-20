# Interactive introduction

20 September 2026. **Prototyped; partial teaching coverage.** `/learn` is linked
from the lobby and rules reference. It adds the previously missing guided
introduction alongside the reference's existing standalone practice wheel.

Seven navigable lessons cover public/private table information and the phase
sequence, shipment budgets, movement, sealed battle plans, Traitor calls, spice
collection and joining or recovering a saved table. Five independent Basic practice positions let a player
change inputs, commit, inspect results and retry. These positions are deliberately
separate examples rather than a complete game or an authoritative live room.

The examples call `reserveShipmentCost`, `quoteBattleResolution`,
`quoteSpiceCollection` and the shared board distance/occupancy helpers. Battle uses six ordinary forces, real Atreides/Guild
leaders and canonical base-deck cards. The fixed opponent's dial, leader and
projectile weapon appear only after the player's seal action. The resulting
weapon survival, scores, ordinary aggressor tie, force losses and bounty come
from the production combat quote. There are no Traitor calls or faction powers in the original sealed-plan
position. A separate Traitor lesson offers call or decline after revealing both
plans, with an explicitly selected opposing-call scenario. Ordinary, sole-call
and mutual-call casualties, leader survival, cards and bounty use the same
production combat quote. The private Traitor has the existing full inspector.
These fixed teaching scenarios are not AI policy or hidden-information tests
of the four live difficulty levels.

The movement position starts with five ordinary forces in Red Chasm. It compares
range one with range three from a separate Arrakeen occupant, exact sectors,
storm exclusion and a stronghold already occupied by two other factions. Accepted
moves preserve the source remainder and city force and spend no spice. Choices
reset that practice position, rather than granting multiple moves in a turn. All
96 offered destination/range/storm/force combinations are cross-checked against
actual authoritative `applyAction` transitions; no live movement rule changed.

The existing wheel, keyboard controls and card inspectors remain available.
Lesson changes focus the heading; responsive columns stack on small screens.
Browser storage contains only a versioned, validated set of lesson choices under
`dune-introduction-v1`. Version 2 payloads explicitly migrate each of the five old
version 1 lesson indices to the same lesson after insertion, preserving every
prior choice and committed outcome. New movement and Traitor fields start at
their defaults; hot updates remount the lesson state to apply this migration.
Future lesson insertions must update the schema and mapping again. The save
includes movement commitments and the before-reveal, revealed and resolved
Traitor stages. Unknown versions,
out-of-range values and impossible saved shipments fall back to the first lesson.
Unknown fields are dropped. Storage failure leaves the exercise usable in memory
and displays that refresh may reset it. Separate tabs may save different progress;
the last write is restored on the next visit. No multiplayer API or seat token is
used, and no server restart or database migration is required.

`tests/introduction.test.ts` checks unaffordable shipping, protected ties, wrong
defense and leader death, every offered dial/defense pair, collection capacity,
save round trips and malformed state. `tests/introduction-practice.test.ts` adds
authoritative movement comparisons, single/mutual/declined Traitor outcomes, all
five legacy lesson migrations and impossible-new-save rejection. Browser interaction checks for the initial prototype confirmed the
unaffordable-shipment explanation, a legal shipment, card inspection, a protected
8–8 tie, the wrong defense causing leader death, saved reveal after refresh,
city collection and lobby return/re-entry. At a 390px viewport the battle controls
and new lobby link stayed within the page bounds. Screenshot capture timed out,
so visual screenshot acceptance remains open; DOM bounds are narrower evidence.
Final source-bound reports and Git delivery record required check/build results.

This does not replace a full interactive curriculum. Bidding, alliances, broader movement/arrival powers, faction lessons, Advanced
support and expansion lessons remain future work. The expanded lessons retain
Partial/Prototyped coverage. Final browser/check/build, preservation and Git
evidence for this follow-up belong to its source-bound private checkpoint. No rules mode, expansion or publication gate is opened.
