# Sandmaster movement collection

13 September 2026. **Prototyped**, with **Partial** rules coverage. Ordinary
ground movement now connects the normal band through explicit routes, optional
collection, player controls, all four AI profiles and saved continuation.
This does not open public Leader Skills starts or publication.

## Source contract

The physical card and [Jack Reda's designer walkthrough, 15:48–16:08](https://www.youtube.com/watch?v=XT_azRVLq_0&t=948s)
allow immediate collection of one spice when forces move into or through a
territory containing spice, once per territory. The [GF9 CHOAM & Richese rules,
pages 8–9 and 12](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)
require a living native trainer for this normal band; a captive supplies only
the lower battle band. Common skill resolution precedes faction abilities.
The [existing source archive](LEADER_SKILLS_RULES.md#sources-and-local-evidence)
contains the checked physical face and timestamped designer transcript.

The route's initial territory earns nothing merely for being the source.
Crossing into an intermediate or final territory qualifies, independently of
the number of moving forces. A later legal re-entry into the source can qualify;
each distinct entered territory still grants at most one collection. Moving
between sectors without leaving the source territory earns nothing. The card
says territory, so the route need not touch the spice pile's particular sector.
Storm and stronghold passage restrictions still apply.

**Recorded scope inference:** the once-per-territory limit belongs to the
movement that triggers it. A distinct Hajr movement starts another collection
opportunity. No publisher or designer clarification specifically discussing
Hajr was located; this follows the card's movement-triggered grammar rather
than introducing a once-per-phase limit that the card does not state.

Collection commits when the legal move completes, before arrival reactions.
Canceled or rejected declarations move neither forces nor spice. If several
positive sector piles exist in a territory, that collection remains unavailable
because the source does not specify which pile to debit. Movement and collection
from other eligible territories remain available.

## Implementation and verification boundary

The optional movement choice declares a connected sector route from every
selected source sector and the individual territories to collect from. The
engine validates the exact paths against actual range, storm and occupancy.
It records the native skilled leader, original movement and pile quantities.
The same shared helper supplies default routes and collection choices to humans
and bots. Players may edit each route and decline any or all collection;
ordinary Move retains its existing behavior with no Sandmaster collection.

A Fremen route using its two-territory advantage keeps the choice in the saved
movement response, even when a shorter direct route reaches the same endpoint.
The response is bound to the original choice across interruptions. Changing or
removing the commitment, response or original board spice fails validation.
Internal proofs are excluded from player projections. Existing versioned writes
settle the physical board-to-player transfer once, with automatic explanatory
history. Legacy declarations without a choice continue as ordinary movements.

Focused tests cover Basic/Advanced collection, per-territory opt-out, malformed
and blocked routes, custody, Fremen cancellation and recovery, saved corruption,
private views and legal candidates across four AI profiles. SQLite checks include concurrent final allowance, exact payment, canceled
declarations and legacy movement. Two genuine four-profile Basic/Advanced
samples finished in 196/89 actions with 6/3 JSON restorations and no rejected
candidates; neither encountered Sandmaster collection. Targeted tests establish
that effect. A fresh browser room assigned the offered skill through genuine
setup, then used a conserved staged movement. The player edited the route from
Red Chasm through South Mesa to Pasty Mesa, exercised per-pile opt-out and moved
three forces. Both selected piles lost one spice; own spice rose from five to
seven. Refresh retained three Pasty Mesa forces, one Arrakeen force, sixteen
reserves, no Tanks and the same private Crysknife and Caid. Movement completion
awaited the human. This is targeted browser evidence, not a complete human game.
Broad checkpoint results are recorded with the checkpoint. These checks do not certify every skill or combined module.

The [worm-ride follow-up](SANDMASTER_WORM.md) connects native Fremen destination
collection, including saved arrival reactions. Remaining work includes other
nonordinary relocation, special movement cards, expansion/module integration, multiple-pile adjudication and
wider interaction and strategy acceptance. The lower battle band remains in
[the battle-effects contract](LEADER_BATTLE_EFFECTS.md).
