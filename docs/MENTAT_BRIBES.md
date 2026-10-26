# Ordinary bribes after Mentat opens

## Timing cutover — 26 October 2026

**Prototyped / Partial.** Quiet Mentat Pause now permits an ordinary non-allied
bribe. The payer spends current spice; the recipient's share stays in the
existing deferred `bribes` supply until the next actual Mentat opening. The
current opening has already collected its snapshot. A late payment never
creates immediate recipient cash or a second collection in this phase.

## Source and interpretation

The publisher [base rulebook, printed12 BRIBERY](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
allows non-allied deals subject to the listed rules/component restrictions;
it supplies no separate Mentat payment ban. Its indexed passage was checked for
this cutover. The [November2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)
indexed Advanced clarification retains deferred recipient spice; a fresh direct
fetch returned403, so no dedicated new FAQ Mentat-payment ruling is claimed.
The earlier checked FAQ source remains recorded in [bribe controls](BRIBE_CONTROLS.md).

The supplied authorized Advanced physical16/printed14 BRIBERY passage was read
for this cutover: collection happens only at each turn's Mentat start. Its
listed limitations also supply no blanket Mentat payment ban. Under standing
14October choose-recommended priority, preserve the app's existing opening-only
collection in both modes and carry a later payment to the next opening.
Basic keeps its existing deferred-receipt protocol rather than adopting new
Advanced faction rules. The Basic late-payment interval and source/online
cutover remain explicit software interpretation, not a dedicated publisher
clarification of this exact late-payment scenario.

## Connected behavior

`game/bribe-options.ts` removes only the inherited phase8 ban. Existing game,
pending-choice, Inflation Double, nonally, amount, uncommitted-funding and
Bureaucrat checks remain. The original `bribe` packet, payer debit and recipient
receipt producer are unchanged. The existing phase8 opening collects receipts
once; native next-turn initialization leaves late receipts intact. Incoming
deferred spice cannot fund another bribe or the next auction before collection.

The existing [Truthtrance bribe contract](TRUTHTRANCE_BRIBE_PROMISES.md) now spans
phases0–8. Current-turn No survives the collection opening and caps subsequent
late payments until actual turn advance. Unpaid Yes prevents finishing Mentat,
rather than ordinary Collection. New Yes reopens only its already-ready Mentat
payer; Collection readiness stays intact except before a known automatic
Inflation flip to Double. That known closure requires payment before Collection
Ready and reopens an already-ready payer when a new Yes is bound.
An unknown future opposing choice is not fabricated for a witness.

Only actual payer payments record promise progress. Later recipient collection
does not fulfill or pay the same promise again. Existing terminal historical
answers remain terminal; no save migration, retroactive promise reactivation or
database rewrite is performed.

Ordinary and promise controls explain the opening boundary and next-turn late
receipt. Guides support Mentat and reject callbacks after their original phase
changes. Exact native packet/event, current options, room/busy and ownership
guards remain. All four minimal policies use the newly legal guided payment;
strategic negotiation and difficulty calibration stay deferred.

## Evidence and remaining gates

`tests/fixture-mentat-bribes.ts` derives real phase7/8 and next-turn openings
from the existing original H/A/E base33 source. Native cases are in
`tests/mentat-bribes-runtime.test.ts`; existing controlled bribe and promise
tests retain their labels. One controlled token-only supplement in the old
Truth runtime file covers a known future Double closure and does not claim a
native CHOAM placement history.

The frozen v2 batch passes **13 files,119/119**, types/lint and the production
build. Six native gameplay paths produce26 GameTable SSR renders/two actual
guide callbacks. Original H/A/E base33 Basic32/Advanced35-action sources reach
quiet first Mentat; late3 spends E10→7 and survives real next Storm/Collection
before exactly3 is credited at the next opening. Advanced city income2 is
separate. Other paths reopen only an already-ready phase8 Yes payer, carry a
phase7 Yes unpaid across Collection, retain a cumulative No across the opening
until actual turn advance, and allow an already-ready ordinary late payer.
All33 cards remain; all four minimal profiles use the legal payment guide.
These are local native/SSR/callback results, not browser or deployed acceptance.

The first batch's quick check passed, then four new native cases exposed a
remaining parser phase gate. The parser repair and ready-before-known-Double
closure passed five focused cases; the unchanged repaired tree then passed the
complete v2 selection/build/runtime. Its source snapshot is
`ea2e7ed4055807a02cd3a0bb1b96706097c37a306513a8b55ff22554c6b1eb9d`
(3128 files); final evidence prose is bound separately by the checkpoint manifest.
Proof/report/manifest:
`/home/quintine/.local/share/dune/checkpoints/20261026-mentat-bribes-proof-v2/`;
journeys/HTML: adjacent `20261026-mentat-bribes-runtime/`.

Broader late-phase skill/faction/module compositions, original Inflation
placement/closure journeys, browser/mobile/deployed and final assurance remain
required. No complete faction/mode or publication acceptance is certified.
No saved-game/database/server/reset/restart/deployment operation is performed.
