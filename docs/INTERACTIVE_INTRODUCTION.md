# Interactive introduction

20 September 2026. **Prototyped; partial teaching coverage.** `/learn` is linked
from the lobby and rules reference. It adds the previously missing guided
introduction alongside the reference's existing standalone practice wheel.

Five navigable lessons cover public/private table information and the phase
sequence, shipment budgets, sealed battle plans, spice collection and joining or
recovering a saved table. Three independent Basic practice positions let a player
change inputs, commit, inspect results and retry. These positions are deliberately
separate examples rather than a complete game or an authoritative live room.

The examples call `reserveShipmentCost`, `quoteBattleResolution` and
`quoteSpiceCollection`. Battle uses six ordinary forces, real Atreides/Guild
leaders and canonical base-deck cards. The fixed opponent's dial, leader and
projectile weapon appear only after the player's seal action. The resulting
weapon survival, scores, ordinary aggressor tie, force losses and bounty come
from the production combat quote. There are no Traitor calls or faction powers
in this teaching position. It is not an AI policy or hidden-information test of
the four live difficulty levels.

The existing wheel, keyboard controls and card inspectors remain available.
Lesson changes focus the heading; responsive columns stack on small screens.
Browser storage contains only a versioned, validated set of lesson choices under
`dune-introduction-v1`. It includes the sealed/revealed state. Unknown versions,
out-of-range values and impossible saved shipments fall back to the first lesson.
Unknown fields are dropped. Storage failure leaves the exercise usable in memory
and displays that refresh may reset it. Separate tabs may save different progress;
the last write is restored on the next visit. No multiplayer API or seat token is
used, and no server restart or database migration is required.

`tests/introduction.test.ts` checks unaffordable shipping, protected ties, wrong
defense and leader death, every offered dial/defense pair, collection capacity,
save round trips and malformed state. Browser interaction checks confirmed the
unaffordable-shipment explanation, a legal shipment, card inspection, a protected
8–8 tie, the wrong defense causing leader death, saved reveal after refresh,
city collection and lobby return/re-entry. At a 390px viewport the battle controls
and new lobby link stayed within the page bounds. Screenshot capture timed out,
so visual screenshot acceptance remains open; DOM bounds are narrower evidence.
Final source-bound reports and Git delivery record required check/build results.

This does not replace a full interactive curriculum. Movement paths, bidding,
Traitor calls, alliances, faction lessons, Advanced support and expansion lessons
remain future work. No rules mode, expansion or publication gate is opened.
