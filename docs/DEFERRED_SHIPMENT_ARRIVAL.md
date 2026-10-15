# Deferred shipment and arrival validation

14 September 2026. A genuine Advanced Ecaz/Fremen/Guild/Bene Gesserit sample
exposed an already accepted shipment whose Guild allowance could not finish.
This continuation repair preserves the existing unfinished arrival-order gates.

## Ordinary Guild income before Ambassador entry — 15 October 2026

The original native Ecaz/Moritani/Guild producer exposed a stale preflight:
`quoteShipmentArrival` treated its **future** earned Guild receipt as an
already-busy arrival response. Yet `commitShipment` already records that
income/counter window, and `openTerritoryEntry` queues the committed entry
until the original response/decision finishes. Rejecting the paid shipment
before Guild permission therefore fenced an existing executable continuation.

Ordinary reserve shipment no longer predicts Guild income as a busy control.
The original physical/price/funding validation, Guild permission, payment,
income/cancellation and deferred-entry queue remain unchanged. The shared
ordinary bot adapter follows that same distinction, without reading hidden
funding or rival hands. Actual in-flight controls, BG accompaniment/Intrusion,
Fremen storm protection and unsupported paired-reaction gates are not removed.
Direct Guild cross-planet transport retains its separate adapter boundary.
This reuses the documented income-before-entry order, not a new comprehensive
publisher priority table or an exception to paying for entry.

Actual styled390px GameTable chooses the placed Ecaz token's stronghold,
ships one, receives original Guild permission, debits Moritani12→11/
reserves14→13 and credits Guild6→7 **before** the Ecaz Ambassador prompt.
The real acquisition button grants Duke6; no payment or reserve transfer repeats.
Original battle then opens Moritani's Sanya4 reveal and physical Mentat
replacement. Affected15-file union134/134, types/lint and original API proof
pass; final surface has no overflow/browser errors. No saved/deployed rooms
were touched, and no new cancellation/recovery or full-combination claim is made.
[Native disc/target integration](MORITANI_ASSASSINATE_LEADERS.md#canonical-winning-discs-and-native-targets--15-october-2026).

This supersedes only the historical prospective-Guild-income rejection below.
The historical BG/other-arrival return and safeguards remain distinct.

## Reproduced failure

The fixed seed `202609146` stopped on turn one after 90 accepted actions. Guild
declared four forces to Carthag, sector 11, where an Ecaz Emperor Ambassador was
placed. Allowing that shipment created a Bene Gesserit accompaniment choice,
then the Ambassador overlap guard rejected the arrival. The rejected action was
immutable, but the earlier accepted declaration left the table unable to proceed.

An isolated archive of prior checkpoint `58ae84f` replayed the same setup seed
and all 90 accepted actions. The resulting player state and pending shipment
matched, and Guild allowance failed with the same guard. The defect predates the
Fremen/Ecaz victory follow-up. Private traces and failed snapshots are retained;
the failure was not replaced with a successful seed.

The Basic sample with seed `202609145` finished on turn seven in 563 accepted
actions, using alternatives after 14 guarded shipment candidates. The initial
Advanced sample did not finish. Neither formed the Fremen/Ecaz alliance or
exercised its final-turn exception. Staged endgame checks are separate evidence.

## Rules boundary

The [deferred movement contract](DEFERRED_MOVEMENT_ARRIVAL.md) records the
unresolved ordering of simultaneous Ambassador, Terror and Bene Gesserit arrival
effects. Shipment prevention precedes payment and arrival; an allowed shipment
still needs a supported continuation. Refusing an unfinished combination in this
development build does not mean the physical rules prohibit that shipment.

This work does not choose an Ambassador/Terror priority, suppress an earned
Bene Gesserit choice, or open Advanced, expansion or publication gates. The
existing [Ambassador](ECAZ_AMBASSADORS_RULES.md),
[Terror](MORITANI_TERROR_RULES.md) and
[Guild payment](GUILD_SHIPMENT_PAYMENTS.md) contracts retain their boundaries.

## Continuation contract

Ordinary shipment now quotes the resulting arrival before opening Guild's
interception decision and again before settlement. The adapter shares the
existing arrival guard with movement and includes pending controls, Guild income,
Bene Gesserit intrusion/accompaniment and Fremen storm protection. It does not
spend resources or inspect a concealed No-Field value to choose reaction order.
Own No-Field shipments also preflight before their earlier cancellation window,
which otherwise bypasses the common shipment offer.
Ambassador-generated shipments retain their distinct validated parent and return
path.

An already saved ordinary Guild declaration may return to its shipper when
explicit allowance encounters this typed unsupported-arrival error. Its original
declaration, ownership, price, force pools and funding must still validate first.
Every excluded special-shipment marker must be absent, rather than merely falsy;
forged, null and empty receipt fields cannot be discarded as an ordinary return.
Only the pending shipment and decision are released; the log explains the
unfinished overlap, and the shipper retains its shipment and movement choices.
Unrelated errors and corrupted declarations still reject without writes.

Legacy declarations tied to an Ambassador, No-Field, Smuggler or spent Nexus receipt do
not use this return path: their custody and parent continuation need separate
handling. The repair does not refund or rewrite those receipts. Fresh ordinary
declarations using the shared offer path receive preflight before the Guild
decision can be accepted. This is bounded recovery, not complete arrival-order
implementation or a universal repair for every older pending shipment.

## Focused verification

Six engine regressions cover the original declaration, a supported allowance,
legacy return and replacement, own No-Field preflight, stale prices and forged
special markers. Three authenticated SQLite regressions cover pending and
returned private-seat restoration, exact custody, replacement arrival, wrong
actor/choice, stale/duplicate requests, corrupted declarations and concurrent
allowances committing one return. Fixtures use genuine faction setup followed
by an explicitly staged arrival topology; the historical sample retains its
separate genuine-game provenance.

Independent review found and resolved the earlier No-Field window bypass and
falsy special-marker recovery checks. Its focused union passed 149 cases, and
targeted lint passed. Final broad checks, source correspondence, full samples
and saved-game preservation are recorded with the checkpoint.

## Integrated samples after repair

The same Basic and Advanced setup seeds and four AI profiles were repeated after
the code review. The exact failed Advanced snapshot was also resumed without
editing its state; its first Guild allowance now returns the uncommitted shipment.
The continuation uses seed `202609147`, a new random stream because the original
cursor was not saved. Its input hash and provenance are retained privately.

| Run | Accepted actions | Guarded candidates | Periodic JSON rounds | Result |
| --- | ---: | ---: | ---: | --- |
| Exact saved continuation | 842 additional | 109 (100 shipment, 9 movement) | 22 | Turn 10, Guild |
| Original Basic seed `202609145` | 563 | 14 shipment | 15 | Turn 7, Guild |
| Original Advanced seed `202609146` | 806 | 81 (74 shipment, 7 movement) | 21 | Turn 9, Bene Gesserit |

All games finish using legal alternative candidates after the explicit development
guards. Physical custody and all twelve terminal private views pass. All 216
game-file hashes remain unchanged throughout the samples. Both Advanced runs
form Ecaz/Fremen alliances but never co-occupy Sietch Tabr or exercise its special
victory. The saved continuation ends with allied Habbanya co-occupation, correctly
outside the supported Tabr exception. These samples demonstrate bounded repair
and continuation, not full rules-combination acceptance or AI strength calibration.
