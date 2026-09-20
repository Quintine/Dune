# Juice of Sapho: remaining battle-choice order

Updated 14 September 2026. This connects first/last Battle-phase ordering through
controls, AI and saved continuation. The separate aggressor mode and full
Richese/Advanced publication gates remain unfinished.

## Authority and interpretation

The [physical-card audit](JUICE_OF_SAPHO_ENGINE_AUDIT.md#verified-instructions-and-sources)
and [source follow-up](JUICE_OF_SAPHO_SOURCE_UPDATE.md#aggressor-and-battle-selection-order)
establish first/last in an ordered phase/action as a separate printed alternative
from becoming a battle's aggressor. The [battle review](JUICE_OF_SAPHO_BATTLE_REVIEW.md)
explains why chooser identity, participants and tie priority must remain separate.

The selected scope is the remaining Battle phase, at clean boundaries between
battles. Accepted priority lasts for the rest of that phase. Keeping a reordered
chooser separate from physical attacker and tie advantage is the existing audit's
implementation interpretation of those distinct alternatives, not an explicit
publisher FAQ ruling. The base game normally combines those identities through
storm order. No new official timing ruling is claimed.

First and last reorder future choices; completed battles stay resolved. Other
players can still select battles against a last-position holder. Sapho grants no
immunity or additional battle and does not move forces or alter physical storm
order. Aggressor mode needs its separate late-intervention protocol and Stone
Burner allocation work. No new confirmation-only window is introduced here.

## Connected behavior

20 September follow-up: [early aggressor](SAPHO_AGGRESSOR.md) now connects the
separate pre-plan effect. References below to unavailable intervention concern
later or suspended battle timing; chooser ordering retains the contract here.

The existing Richese development configuration supplies the physical card. Its
holder receives private `battleOrder` first/last options at a clean boundary.
The command binds the current opportunity and discards the exact unreserved card
once. A held position, stale event, absent unresolved battle or suspended
interaction cannot consume it. Earlier completed battles do not prevent a later
order change; a current battle and its aftermath must finish first.

The stored priority is separate from `g.order`. Legal pair geometry comes from
the public combat board. Each choice has a chooser and stable attacker/defender
identities. A reordered physical defender can choose the actual opposing attacker
without swapping leaders, plans or faction powers. UI and bots use the same
authoritative choices and owner-relative target.

Priority includes all seats, even those currently without a battle, so a later
Face Dancer replacement does not move a newly relevant seat behind an accepted
last position. Actual eligibility is recomputed after all aftermath. A battle
start or Sapho use expires the old opportunity event. Legally recovering the
physical card permits a new use at a fresh opportunity; there is no invented
once-per-phase restriction.

All four AI profiles use their private view and public board. Their initial
ordering policy favors first when an unresolved stronghold battle is available,
otherwise last. They can then choose an opponent from either stable battle slot.
This is a legal strategy path, not difficulty calibration.

## Evidence and boundaries

Focused engine, controls, bot and authenticated SQLite tests exercise ordering,
actual opponent choice, saved continuation, duplicate-request custody and rejected
action immutability. Fixtures distinguish genuine Basic/Advanced CHOAM/Richese
setup from later conserved battle staging. A genuine five-seat Ix/CHOAM regression
resolves a battle, activates Face Dance and gives the newly eligible replacement
its next choice ahead of a protected last seat, in Basic and Advanced.

The isolated browser table used first from a later physical circle, chose the
earlier Emperor attacker, completed the battle and restored the next battle
choice after refresh. Emperor retained the tie win. All nine accepted actions
replayed exactly with the recorded battle event; private views, physical custody
and the original seat row passed. Final check results, fingerprints,
browser and complete-game evidence are retained in the private checkpoint report
and Git message.

Intervention within an unresolved battle or suspended aftermath is unavailable.
Aggressor mode, ordinary cyclic-auction scope, first versus an unspent Advanced
Guild and interruption of partly completed movement turns retain their existing
boundaries. Prototype evidence does not certify full card or mode compliance.

The opening preservation baseline contains 970 rooms. Keep all saved games and
seat/recovery records, reuse the healthy server and leave recurring restarts absent.
