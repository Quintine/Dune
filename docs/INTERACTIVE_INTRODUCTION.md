# Interactive introduction

21 September 2026. **Prototyped; partial teaching coverage.** `/learn` is linked
from the lobby and rules reference. It adds the previously missing guided
introduction alongside the reference's existing standalone practice wheel.

Nine navigable lessons cover public/private table information and the phase
sequence, ordinary Nexus alliances, bidding, shipment budgets, movement, sealed battle plans, Traitor calls, spice
collection and joining or recovering a saved table. Seven independent Basic practice positions let a player
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

The bidding example gives Fremen six spice and a three-card hand, with a full-hand
variant and two deterministic opponent scripts. Players raise, pass, re-enter on
a later turn or end an unbid auction. The winner pays once; losing bids spend
nothing, and only the player's own purchase exposes a card face/inspector.
Ordinary bid validation and next-seat/all-pass decisions use
`quoteNormalAuctionBid` and `quoteNormalAuctionNext`, extracted from the existing
live engine. The engine retains ally funding, Karama, payment, card custody and
reaction handling. No strategic bot policy changes. Scripted lessons omit those
special interactions and are checked against actual `applyAction` outcomes.

Source authority is the [GF9 base rulebook, Bidding](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
and [November 2020 FAQ, p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2).
The publisher-indexed FAQ text was freshly retrieved on 20 September; it confirms
that a prior passer can bid again. Direct PDF retrieval returned 403, so no new
binary/visual source inspection is claimed. Links remain developer provenance;
the player lesson links only to internal rules.

The Nexus position uses four base factions and two or one Emperor strongholds.
Players accept an incoming offer, make an offer to a fixed accepting/waiting
partner, stay unallied, withdraw an unanswered offer or break a formed alliance.
Closing the Nexus locks these decisions. A separate explicit teaching step
checks the unchanged board at a later Mentat Pause; it does not simulate the
intervening phases or award a victory at the moment of alliance formation.
Three shared strongholds fall short; four qualify for both allies.

`quoteNexusAlliance` extracts existing ordinary offer/pairing behavior into a
shared pure quote. The live engine retains phase authorization, Homeworld
restrictions, alliance dates, Nexus Card forfeiture, readiness and history.
`strongholdProgress` and `quoteVictory` supply the teaching result. Physical
forces stay with their original owner. The response scripts are local teaching
scenarios, not changes to live AI. Funding, alliance powers, movement restrictions,
special victory and expansion exceptions are not simulated in this example.
The base rulebook's Alliances (Nexus) and Mentat Pause sections remain the rule
authority; fresh publisher-indexed rulebook/quick-start results confirm the
ordinary two-member/four-stronghold contract. No new ambiguous ruling is inferred.

The version 4 save whitelists alliance choices and validates the bounded
opening/offer/withdraw/break sequence and phase order. Prior lesson identities,
auction history and every other accepted practice choice remain intact.
`tests/introduction-alliance.test.ts` compares all 24 offered scenario/holding/
action combinations with actual engine alliance transitions, checks later victory,
JSON continuation, closed-Nexus rejection and every version 3 lesson migration.
`tests/nexus-alliance.test.ts` checks pure immutability and live-engine integration;
existing Nexus Card forfeiture tests cover the retained expansion side effects.
Final independent review, browser, source-bound checks and saved-game preservation
are recorded in the private checkpoint and Git message.

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
`dune-introduction-v1`. Version 4 payloads explicitly migrate all five version 1,
seven version 2 and eight version 3 lesson positions to the same lesson after insertion,
preserving prior choices and committed outcomes. New alliance fields start at their defaults for every older version.
Versions 1 and 2 receive bidding defaults; version 1 also receives movement/Traitor defaults. Hot updates
remount the lesson state to apply this migration. Only the player's bid/pass
history is saved; deterministic replay validates the complete auction and rejects
underbids, overspending, full-hand actions and actions after the auction ends.
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

`tests/introduction-bidding.test.ts` compares offered openings and re-entry with
actual engine payment and physical card custody, checks all-pass/full-hand paths,
all seven version 2 lesson migrations and exact saved bidding continuation.
`tests/normal-auction.test.ts` exercises shared turn order, eligibility, pass
re-entry, finite termination and integer/funding limits. Final source-bound
browser/check/build and preservation evidence for bidding belongs to its private
checkpoint and Git message.

This does not replace a full interactive curriculum. Alliance powers, broader movement/arrival powers, faction lessons, Advanced
support and expansion lessons remain future work. The expanded lessons retain
Partial/Prototyped coverage. Final browser/check/build, preservation and Git
evidence for this follow-up belong to its source-bound private checkpoint. No rules mode, expansion or publication gate is opened.
