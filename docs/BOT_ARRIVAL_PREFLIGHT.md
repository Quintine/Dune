# AI arrival checks

14 September 2026. This removes repeated AI candidates rejected by the existing
arrival guard. It does not choose an order for simultaneous reactions or lift
an unfinished expansion gate.

## Reproduction

The genuine combined-expansion samples with base seed `20260914` completed on
`368a7a5`, but Basic proposed forty and Advanced four unsupported Ambassador
arrivals before choosing legal alternatives. The default six expansion samples
also retained eighty-two rejected Ambassador/Terror arrival candidates. The
[deferred movement](DEFERRED_MOVEMENT_ARRIVAL.md) and
[shipment](DEFERRED_SHIPMENT_ARRIVAL.md) contracts explain the existing guard.

## Connected behavior

After constructing its candidate actions and native source/payment choices,
each AI profile uses `botArrivalBlock` to exclude known ordinary ship/move
arrival conflicts. The adapter calls the same `quoteCompletedMovementArrival`
used by authoritative preflight. It does not copy the Ambassador/Terror branches
or infer a new rule from token co-location.

The quote preserves same-territory movement, single reactions, own-faction and
allied exemptions, matching Ambassador immunity and Bene Gesserit stance.
Shipment additionally includes the prospective Guild income and Spiritual
Advisor opportunities. It uses the actual ordinary tariff and selected or
minimum necessary allied contribution. A Guild-funded payment that creates no
Guild income is kept. An owned No-Field is priced as one component without
reading its concealed value. Advanced Fremen storm arrival keeps its existing
response condition.

Only public board/faction/stance/reserve information and the acting seat's own
funds enter the adapter. Concealed Terror faces and rival hands, spice, Traitors
and Face Dancers are unnecessary. It does not mutate the view or sample
randomness. Only the known typed arrival error excludes a candidate; unexpected
faults propagate. The engine remains authoritative for every actual action.

Homeworld-sourced ordinary shipments now quote the same public arrival triggers,
including a colocated Ambassador and Terror, after the bot selects its own
physical source. Their off-planet origin is sufficient for the arrival quote;
Homeworld source eligibility, tariffs and any payment-dependent Guild response
remain authoritative engine checks, not duplicated AI rules. Other Homeworld
routes, explicit Nexus shipments, special movement and unrecognized actions
retain their own adapters and legal fallback search. This is not a complete
action validator or certification that every AI candidate is legal.

## Evidence

Focused real-engine cases exercise the original rejected entries and executable
alternatives across all four profiles, supported single reactions and matching
faction immunity, Guild-funded shipments, No-Fields, BG accompaniment versus
fighter intrusion, JSON continuation and private-field access traps. The BG
advisor fixture retains another faction in its territory so normal automatic
stance settlement does not turn a lone advisor group into fighters.

Final checks and same-seed integrated results are recorded with the source-bound
private checkpoint and Git message. Existing saved games remain protected; no
server restart or database change is required.

## 29 September: Homeworld-sourced shipment overlap

A genuine five-seat Advanced combined Homeworld/Nexus/expansion game on
`41fd6fe` completed in 786 actions but proposed two Tleilaxu shipments from
its own Homeworld into unsupported Ambassador/Terror arrival combinations.
Both were rejected without writes before a legal alternative was chosen. The
owner-view preflight formerly skipped every Homeworld shipment. It now passes
off-planet Homeworld-source arrivals through the same public quote without
assuming a price or hidden Terror face. All four AI profiles exclude the
reproduced action while retaining an executable alternative. A same-seed
genuine-setup replay completes in 786 accepted attempts, zero rejections,
21 JSON continuations and the same fourth-turn shared victory. This repairs
candidate legality, not the unsupported arrival-rule composition or public
expansion start gate.

## 7 October: the deferred Terror entry is a supported arrival

The engine now commits a Terror arrival whose entry coincides with the
arrival's own interaction. `openTerritoryEntry` queues the committed entry in
the additive `Game.pendingArrivalReaction` list and
`settleAutomaticContinuations` opens the oldest queued entry as soon as no
response, decision, Terror entry, Ambassador entry or Ecaz/Moritani overlap is
pending. Payment, force transfer and the original movement never replay.

Consequently `quoteCompletedMovementArrival` no longer rejects a Terror
arrival because a Guild income response, a Bene Gesserit fighter Intrusion or
advisor choice, or Fremen storm protection is present; those windows settle
first and the entry follows. The preflight still rejects a Terror entry already
in flight (`controls.pendingTerror`) and every Ambassador combination
(`Ambassadors combined with another arrival reaction`).

The two former bot policies that avoided those combinations are updated, not
re-pinned: `tests/bot-arrival.test.ts` now asserts the Guild transport ships
into its committed Terror entry, and
`tests/ambassador-terror-overlap-worm.test.ts` asserts the queued worm ride
defers the entry behind the pending Intrusion and then opens it after the
decline. Both drive the deferred path to completion and keep the profiles'
other policy checks.

## 29 September: Guild cross-planet transport and Terror

An unmodified six-seat Advanced Moritani sample at base seed `20260930`
completed 1,262 actions and 34 JSON restores but proposed six illegal
cross-planet Guild transports into a placed Terror while Guild income was
pending. The existing bot preflight covered ordinary shipments, not the
single-source `guildShip` action.

The owner-view adapter now quotes those transports with the submitted source,
physical count, Guild tariff and selected ally payment. It excludes only
publicly unsupported arrival combinations; payment entirely funded by the
Guild ally has no Guild income response and remains eligible. Multi-source,
Nexus and special routes still use their separate adapters. No Terror face or
rival private field is read. The authoritative engine still decides every
actual transport.

The focused engine regression first reproduced the rejected Guild action,
then exercised all four profile filters and a Guild-funded accepted action.
Same-seed genuine setup replay completed the same 1,262 accepted actions with
zero rejected candidates and 34 JSON continuations. Both actual
assassination opportunities were declined; this is not a natural reveal or
replacement sample. The unsupported reaction combination and public
expansion gate remain unchanged.

## 29 September: worm ride into Terror with BG intrusion

Another unmodified six-seat Advanced Moritani game at base seed `20261007`
finished in 1,541 accepted actions, two rejected Fremen worm-ride candidates
and 41 JSON continuations. Each rejected ride targeted a placed Terror while
a Bene Gesserit fighter intrusion would open another arrival decision.

The owned bot candidate now quotes the same public destination triggers
before choosing a worm ride; its current worm decision is the parent, not a
second reaction. It leaves legal single reactions and supported Ambassador/
Terror overlap available. The focused regression reproduced the engine
rejection, then showed all four bot profiles skip the conflicting destination
and execute an alternative. The same-seed genuine game completes 1,541
accepted attempts, zero rejects and 41 JSON continuations. No hidden Terror
face or rival hand enters the quote. Homeworld rides and other special
arrivals retain their own gates; this does not implement the conflicting
reaction or open public expansion starts.

**Superseded 7 October 2026:** the conflicting reaction is now implemented as
the deferred entry above. The owned bot candidate may choose that destination
again; the focused regression now asserts the ride is accepted, the entry waits
behind the pending Intrusion and then opens after the decline.
