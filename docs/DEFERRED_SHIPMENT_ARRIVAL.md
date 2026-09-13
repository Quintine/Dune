# Deferred shipment and arrival validation

14 September 2026. A genuine Advanced Ecaz/Fremen/Guild/Bene Gesserit sample
exposed an already accepted shipment whose Guild allowance could not finish.
This continuation repair preserves the existing unfinished arrival-order gates.

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
