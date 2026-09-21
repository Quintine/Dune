# AI development order and difficulty targets

Updated 22 September 2026 at the user's request. This is the current development
plan; the [earlier calibration studies](AI_CALIBRATION.md) are historical results,
not evidence that the new targets have been met.

## Complete the game features first

Full AI implementation, strategic refinement and difficulty tuning start only
after all non-AI game features are complete: Basic and Advanced rules, all twelve
factions, the three expansions, applicable optional modules and interactions,
multiplayer functions, the required player-facing features and the complete
[administration panel](ADMIN_PANEL.md). Do not spend time tuning strategy against
incomplete rules or move AI refinement ahead of the administration requirement.

Until then, preserve existing profiles and provide only the minimal legal AI
participation needed to exercise new features. Fix crashes, deadlocks, illegal
actions, privacy violations and saved-continuation failures. Focused legal-action
and complete-game smoke checks remain appropriate; strength studies and tuning
are deferred. Working AI paths remain part of a connected feature prototype.

## Tune the completed game

Finish faction/module strategy, planning, risk assessment and negotiation, then
aim for these separate adjacent-pair results:

| Matchup | Target |
| --- | --- |
| Medium against Easy | Medium wins approximately 75% |
| Hard against Medium | Hard wins approximately 75% |
| Brutal against Hard | Brutal wins approximately 75% |

These are statistical targets over repeated games, not a promise for every four
games or a 75% overall win rate in a table containing all four difficulties.

Use legal head-to-head configurations with balanced faction/seat assignments,
swapped assignments and multiple seeds. Keep evaluation seeds separate from
tuning, report sample sizes and uncertainty, and break results down by rules
configuration so aggregate wins do not hide a broken matchup. Define outcome
accounting before running the evaluation and report draws or shared wins
explicitly. Do not treat unfinished or failed games as ordinary wins or losses.

Separately verify the completed strategies in supported two-through-six-player
tables, including alliances and expansion/module combinations. Pairwise strength
does not establish multiplayer competence. Preserve private information, legal
resources and the authoritative rules at every level; never give higher levels
unauthorized information or rule exceptions to reach a target. Retain the
existing 1–2 second action pacing when AI plays a human-owned seat.

Final AI acceptance needs measured evidence for all three approximate 75% targets
after feature completion, plus legal continuation across the requested scope.
The current policies and old studies do not satisfy that acceptance gate.
