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
