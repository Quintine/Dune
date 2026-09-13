# Atreides full-plan interaction audit

13 September 2026. This audit verifies the existing native Advanced interaction
paths without promoting an implementation timing choice to an official ruling.
The public Advanced and unfinished expansion gates remain closed.

## Published requirements and remaining interpretation

The [GF9 base rulebook, printed p14](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
gives Advanced Atreides a once-per-game Karama inspection of any one player's
entire Battle Plan. Its Q&A p23 orders Voice before ordinary Prescience, permits
Truthtrance during that interaction and leaves unaffected plan components
changeable. The Q&A p22 permits a Ghola-revived leader to fight during Battle.

The [November 2020 FAQ, pp8–9](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)
confirms any-time Truthtrance, current-turn commitments with impossibility release,
and the Battle-phase Ghola use. The independent source audit retrieved official
indexed text for these passages.

Neither retrieved source orders special full-plan inspection against ordinary
Voice/Prescience, fixes the special offer's exact deadline, or expressly chooses
which combatant seals first. This implementation offers it after preparation,
before either plan is sealed, and requires the selected target to seal first.
Ghola cannot be played during the pending offer; it can be played after that
decision resolves. These remain explicit implementation choices. The older WBC
wording supporting target-first commitment is outside the requested GF9 authority
and was not adopted as a publisher ruling. Preserve the existing unresolved
interpretation instead of silently enabling Advanced on the strength of tests.

## Verified interaction boundary

`tests/full-plan.test.ts` now uses `initializeBaseGameForAudit` and completes actual
Advanced prediction, traitor and BG advisor setup before staging a battle. It no
longer starts Basic and flips the mode afterward. A staged scenario remains
distinct from a setup-to-finish Advanced game.

The 17 focused tests include five new interaction tests:

- All four profiles can honor a Truthtrance leader/weapon commitment, preserve
  Voice and ordinary Prescience, revive the required leader with one physical
  Ghola, seal for inspection and reach public reveal after the other plan seals.
- A question during the special offer preserves the pending choice and its
  revival-dependent answers, whether Atreides later uses or declines the special.
- Questions after inspection disclose only the truthful result of the sealed
  plan. They cannot reopen fields, duplicate a binding record or spend its support.
- Seven native preparation windows survive a Truthtrance interrupt: Voice
  selection/response, Prescience selection/response/answer, full-plan offer and
  selected-special target wait. Parent response, decision, preparation and plan
  state are retained; named restrictions leave other fields selectable.
- Atreides can revive its own leader after reading and before sealing, while
  the target's plan remains unchanged and private.

Existing tests retain owner-only inspection, sealed-card restrictions, ordinary
Prescience cancellation, outsiders and once-per-game custody. JSON continuation,
rejected-action immutability and physical-card conservation are asserted in the
new paths. No runtime change was needed for these tested interactions. An
independent review found no actionable issue with the added tests.

## Browser and restoration evidence

Room `AZC4HGLB` uses genuine Advanced initialization followed by a staged battle.
An Atreides human chose the special Karama inspection through the browser after
a Truthtrance leader promise and ordinary Prescience. The Medium Emperor used
Ghola to revive Hasimir Fenring and sealed a plan honoring those restrictions.
The private inspection displayed dial 0, support 0, Fenring, Chaumas and Shield,
while Atreides retained its own plan controls. Expanded component controls and
the inspection were readable on desktop and at 390×844 phone width.

A backed-up restart had already completed when the user removed the hourly
restart requirement. Browser refresh restored the same owned inspection and
the earlier inventory room `LC3E55GY`. The final comparison retained all 64
saved room versions and state hashes with none missing or changed. The server
returned HTTP 200. Future restarts occur only when a change or observed server
condition warrants them, with preservation and restoration checks; no recurring
automation is installed.

Required check results are recorded in the checkpoint commit and private
source-bound report. There are no runtime changes, so the preceding production
build and HTTP-suite evidence are reused rather than claimed as new runs.
This audit does not certify arbitrary Truthtrance questions, every Advanced
interaction, expansion combinations or a complete human/AI game.
