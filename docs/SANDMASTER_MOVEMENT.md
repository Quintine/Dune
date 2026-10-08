# Sandmaster movement collection

13 September 2026. **Prototyped**, with **Partial** rules coverage. Ordinary
ground movement now connects the normal band through explicit routes, optional
collection, player controls, all four AI profiles and saved continuation.
This does not open public Leader Skills starts or publication.

## Owned ground-route pile selection — 9 October 2026

Ordinary ground movement now offers every existing positive pile in each
entered territory. The owner selects at most one pile per territory, or
declines that territory's collection. Choosing another pile deselects the
previous one; clearing the selected checkbox declines the whole territory.
The source grants one spice per territory but does not specify the debit
sector, so owner selection is explicitly a provisional allocation policy.

The shared `sandmasterCollectionPiles` quote groups offered keys by entered
territory. Human controls and legal AI start with one deterministic choice
per group; authoritative validation rejects two selected sectors from the
same territory before forces or spice move. Signed original route and pile
receipts retain their existing continuation behavior.

Both mode engine smokes choose South Mesa sector5 instead of sector4,
collect once there and once in Cielago East, preserve the unselected pile,
and move three physical forces. All four profiles produce legal collected
routes. An isolated 390px Chromium control smoke switches the sector,
declines/reselects the territory, and commits the same move: personal
spice10→12, South Mesa4 remains4, South Mesa5 becomes1, Cielago East3
becomes3, and three forces arrive in Cielago East.

Worm/physical-Ambassador destination choices and native HMS relocation
retain their separate single-pile scope. No public start or broader
source adjudication is opened by this ground-route change.


## Physical Fremen Ambassador relocation — 8 October 2026

The Ambassador expressly relocates a board force group. The normal
Sandmaster movement band now optionally collects one spice at its entered
destination, before arrival reactions. No intervening route is implied.
Moving between sectors of the same territory earns none. The existing
living native trainer, supported-profile and unique positive pile rules
remain; concealed-marker relocation is still separate.

`sandmasterDestinationCollection` is shared by this direct relocation and
the existing worm adapter. Human controls expose a checked, optional
destination collection choice; bots attach it only to an eligible physical
relocation. Native quoting records the trainer and exact pile in
`ambassadorSandmaster`, distinct from ordinary ground-route receipts.
Suspended CHOAM movement revalidates that receipt through the original
Ambassador event. Cancellation collects nothing; commit transfers one
board spice once before the original arrival continuation.

Basic and Advanced direct smokes cover collection, decline, same-territory
and multiple-pile rejection. A bounded owned-destination Easy candidate
reaches the real relocation engine. The adjacent native Advanced worm
still transfers one spice and moves four forces. In Chromium, live React
controls ran against the native engine: Basic collection produced
spice21/board1, Advanced opt-out spice20/board2, both with destination2
forces, unchanged ordinary allowances and completed Ambassador events.
This is an isolated component/engine smoke, not HTTP or deployed acceptance.
No broad suite or recovery campaign was run.


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
Canceled or rejected declarations move neither forces nor spice. With
several positive sector piles, ordinary ground routes now use the
provisional owner selection above. The once-per-entered-territory limit
does not become one collection per pile.

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
collection, including saved arrival reactions. Physical Fremen Ambassador
relocation is connected above. Other nonordinary relocations, special cards,
concealed-marker collection, multi-pile destination/HMS collection and wider
interaction/strategy acceptance remain. The lower battle band is in
[the battle-effects contract](LEADER_BATTLE_EFFECTS.md).

## 21 September: native HMS relocation eligibility

The [Basic Ixian integration](IX_LEADER_SKILLS.md) connects ordinary force entry
and exit through the current HMS pointer. Native relocation is a different event:
it changes the stronghold's pointing sector while its forces remain in the
separate interior territory. Calling a further Sandmaster collection a known
missing bonus was too strong; eligibility is unresolved.

The [publisher-authored Ix rules, pages 9 and 11](https://cdn.1j1ju.com/medias/20/16/31-dune-ixians-tleilaxu-rulebook.pdf)
give native collection of two spice per force from traversed spice-containing
sectors, including departure, and prohibit movement into, out of or through the
storm. Sandmaster instead requires forces moving into or through a territory
and grants one total spice per entered territory. The
[official November FAQ, page 7](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)
allows Karama to prevent HMS relocation and collection together.

The checked card, designer walkthrough and available official rules did not
clarify whether passengers staying in the interior count as entering outside
territories. **Resolved 7 October 2026 by user ruling:** interior passengers
**do count as entering** the outside territories the stronghold points into, so
the Sandmaster skill collects one spice per entered territory with an
unambiguous pile during a native relocation, before the faction's own
traversed-sector collection. Skill-before-faction precedence settles the
ordering. Ordinary Sandmaster entry/exit and native relocation are unchanged;
full combined compliance remains unverified.
