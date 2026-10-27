# Faction allocation in the lobby

## Sources and scope — 28 October 2026

**Prototyped / Partial.** The user-authorized revised Dune rulebook, physical
page 4 (printed page 2), gives two initial methods: randomly deal faction
prediction cards, or draw distinct turn-prediction numbers and select factions
from highest to lowest. It also permits players to swap factions. The original
publisher rulebook describes the same selection methods; this prototype exposes
both in Basic and Advanced and retains the existing direct-choice option.

A host may deal once from all factions belonging to currently enabled families,
without replacement. Alternatively, the host deals distinct numbers 1–10 to
seated faction seats. The public draft follows descending numbers, rejects a
picked or disabled faction and applies all choices together after the last pick.
These cards represent the setup draw and are not removed from later Bene Gesserit
prediction. Existing temporary faction selections do not reserve faces during a
draft. The host may cancel the draft; the previous factions remain. The engine
uses the existing cryptographic shuffle, event-bound actions and room version
fencing, and clears human readiness when allocation begins and ends.

For the provisional two-person/four-faction setup, each faction seat receives
its own draw and pick. That is a software interpretation of the two-faction
case, not a separate publisher clarification. Seats, credentials, host and
player-circle positions remain attached to the same participants. AI seats pick
a legal available faction automatically, preferring their existing faction
when available. They retain their difficulty and a faction-appropriate name.
Selection does not bypass any existing expansion/profile start gate.

Nine related unit files pass 43 cases; four isolated HTTP cases include a
four-seat/two-controller draft, seat selection and game start. These do not
establish complete setup or deployed acceptance. An isolated browser room also
exercised a random deal and a human/AI draft to completion.

Human seats may offer an exchange of their currently assigned factions. The
recipient accepts or declines and the proposer may cancel; each action is bound
to the current offer. A pending offer freezes other lobby changes and new seats
until resolved, but players can switch between their own seats or exit. Only
acceptance changes the assignments and clears human readiness. Seat IDs,
credentials, circles and host remain attached to their participants; faction
leaders and Ixian elites follow the new faction. AI seats cannot offer or
receive swaps yet. Broader player-count interpretations, AI swap policy,
complete setup combinations, saved-game assurance and deployed acceptance
remain open.

For the swap checkpoint, ten related unit files pass 48 cases and two isolated
HTTP cases exercise allocation and authenticated swaps across independently
controlled seats. This evidence does not certify every setup combination.
An isolated browser room also exercised an offer between two controlled seats,
including switching to accept, cleared readiness and an available exit control.
