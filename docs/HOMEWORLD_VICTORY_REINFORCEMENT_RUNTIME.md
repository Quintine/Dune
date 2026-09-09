# Caladan victory reinforcement runtime

Development checkpoint, 10 September 2026. This implements the bounded behavior
in the [source contract](HOMEWORLD_VICTORY_REINFORCEMENT_RULES.md), not complete
Homeworld or expansion support. Advanced and unfinished module starts remain
disabled.

## Actual battle and player flow

An actual normal or traitor victory by Atreides records its original battle
event. After casualty and card cleanup, high Caladan may transfer exactly one
ordinary native reserve force to the victorious army's location while an
Atreides force survives there. Current native population must be at least six;
transferring from six to five is legal. Foreign visitors do not raise that
threshold. Loss, mutual destruction and explosion create no entitlement.

The player selects an eligible sector of the original territory or the original
foreign Homeworld, or leaves the force in reserves. Native Caladan is already
the source pool, so it cannot create another counter there. The transfer spends
no spice, revival allowance or shipment/movement use. All four AI profiles use
the same projected legal choices. Controls show ownership, the fixed amount
and unavailable-destination reasons.

The unresolved Face Dancer ordering overlap permits decline only. Storm,
mobile-stronghold and relevant Intrusion/Terror combinations retain explicit
destination guards. These are incomplete interactions, not optional house rules.
An admitted Ambassador arrival can interrupt reinforcement and return through
its saved child sequence before the next battle or phase begins.

## Saved state and custody

[homeworld-victory-return.ts](../game/homeworld-victory-return.ts) binds the
original event, turn, winner, location and result to the offer. A separate battle
obligation records the actual waiting, choice, arrival or completed stage. This
prevents editing an arrival back into a choice while another reserve force is
still available. Deleted choices, mismatched markers and changed original facts
reject before resource or persistence changes.
An unfinished waiting stage also requires its preceding cleanup control or
interrupt; deleting an optional winning-card decision cannot leave a silent
waiting record. Production actions settle automatic reinforcement work before
their database write, while legitimate human choices remain pending.

[homeworld-arrival.ts](../game/homeworld-arrival.ts) shares Ambassador ancestry
and child completion validation with revival deployment. Each child remains
bound to its source event, entrant, location and parent. A removed unfinished
child cannot release the battle suffix. The original victory remains distinct
from any later Ambassador movement or shipment.

Older completed Caladan development saves without the separate stage field
remain readable. A stage-less unfinished obligation is rejected. Older battles
without this feature's records do not receive retrospective reinforcements.
These canonical records validate consistency; they are not cryptographic
authentication of arbitrary edited database contents.

## Verification evidence

Focused cases cover pure thresholds and physical transfers, owned controls,
actual normal/traitor outcomes, mandatory and optional cleanup, all four AI
profiles, and actual nested Ambassador arrivals. Production in-memory SQLite
cases exercise authenticated competing actions, lost-response reloads, private
seat projections, unrelated rooms and corrupt continuations with zero writes.
The stage-rewind regression starts with seven reserves and leaves six after the
first placement, proving rejection does not depend on running out of forces.

The isolated browser game completed a real battle, restored the pending choice,
selected Hagga Basin by keyboard and added one reserve force. Desktop and
390-pixel phone views were inspected without overflow. After another refresh,
the army had three forces, Caladan had five and the Tanks had one. All three
private seats restored with no page errors. Its completed legacy record also
restored after the subsequent server restart.

Whole-project verification results belong in the dated
[implementation status](IMPLEMENTATION_STATUS.md) checkpoint. Passing this slice
does not certify complete Homeworld games, occupation, all arrival reactions,
Face Dancer ordering or the full requested expansions.

## Related public-only work

[tupile-intelligence.ts](../game/tupile-intelligence.ts) now quotes public contact,
low population, occupation suppression and lifetime once-per-faction eligibility.
It reads no opposing hand. It does not yet disclose spice or card counts, consume
a use, or provide a playable engine action. See the
[Tupile source contract](HOMEWORLD_TUPILE_INTELLIGENCE_RULES.md) for that boundary.
