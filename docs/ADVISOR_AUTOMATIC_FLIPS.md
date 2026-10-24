# Mandatory advisor conversion after ground movement

## Source and provisional duration — 24 October 2026

Status: **Prototyped / Partial**. Supplied authorized Advanced physical28 E says
advisors alone in a territory automatically become fighters. Physical17’s Karama
table permits preventing one group’s flip to or from advisors. Applying the two
connects a real counter to that mandatory conversion; automatic does not itself
confer immunity. Physical16 permits Karama only after setup/At Start, so setup
conversions remain automatic without this response.

This slice connects ground-movement producers: an advisor group entering an
empty destination and the last outsider departing its territory. The physical
move, counters, normal movement opportunity and any completed movement promise
are already committed. The ordinary advisorFlip response then permits or
prevents the conversion. Prevention cannot undo movement or spend another move.

The 14 October choose-recommended authority selects a **provisional duration**:
the prevented group remains advisors while continuously alone in that territory,
across phase and turn changes. Another faction’s presence or the physical group
becoming empty closes that occurrence. A group moving elsewhere gets its new
destination’s ordinary stance and a new conversion opportunity when applicable.
This duration is not a directly retrieved publisher ruling. Repeated normalization
cannot simply erase the canceled result or offer an immediate free retry.

## Connected behavior

- [Pure rule](../game/advisor-automatic-flip.ts) identifies current public groups,
  binds a current turn/phase/mover/movement count and exact physical group, and
  settles a held stance without reading cards, leaders or spice.
- [Engine](../game/engine.ts) marks each occurrence after physical ground
  movement, queues its original source and opens the existing native response.
  Allowance deletes the advisor stance; cancellation retains the occurrence
  hold. The source is revalidated before card disposal and outcome settlement.
  Multiple groups retain ordered independent responses.
- [Advisor normalization](../game/advisors.ts) and the shared
  [board resolution quote](../game/board-resolution-quote.ts) retain held
  advisors. Such forces still do not fight, collect, grant stronghold income,
  count for victory or supply ornithopters. Ordinary arrival matching retains an
  existing held group’s stance instead of silently converting it when joined.
- [Karama source selection](../game/karama-context.ts) binds the actual pending
  occurrence rather than unrelated game state. The normal
  [table response](../components/game-table.tsx) explains that the move is complete
  and displays the provisional duration. There is no new confirmation or timer.
  Existing minimal bot response handling remains, without strategy changes.

No start gate, physical inventory, save, schema or room is reset. Setup and
legacy unheld non-ground conversions keep their existing behavior. Remaining
mandatory producers include shipments, withdrawals, casualties/aftermath and
other special arrivals; matching an existing fighter group and broader
interleavings also remain unfinished. This checkpoint does not claim complete
advisor-conversion cancellation or full Advanced compliance.

## Bounded verification

The [native fixture](../tests/fixture-advisor-automatic-flip.ts) starts genuine
public Advanced Bene Gesserit/Atreides/Guild. The native advisorSetup action puts
one advisor beside Atreides’ original ten Arrakeen forces. Only unopened original
Treachery/Spice order and scalar shuffle order are selected. Atreides receives
the original Karama, both Spice draws and ordinary first-round controls execute,
the original optional preparation is declined and Guild uses its timing choice.
The arrival branch stops at BG’s turn; the departure branch really skips that
turn and stops at Atreides’. No played army, phase, wallet, stance, card hand,
response or prevention receipt is installed.

[Native engine cases](../tests/advisor-automatic-flip-engine.test.ts) cover both
allowed/canceled moves, continuous hold through actual phase continuation,
an actual outsider return, changed-source rejection and existing profiles.
[Pure cases](../tests/advisor-automatic-flip-quote.test.ts) cover group selection,
settlement and exact source validation. The former empty-arrival expectation in
[advisor regressions](../tests/advisors.test.ts) is cut over explicitly.
Frozen **16 files199/199**, types/lint and production build pass. Five native
move/response/GameTable SSR journeys cover allowed/canceled arrival/departure and
an actual outsider return. Eight existing-profile paths accept legal standard
responses and continue. The original arrival source takes34 actions; departure
takes36, including the real skipped BG movement. Existing Karama/Allow controls
render, without a new component-callback or browser certificate. One redundant
import is repaired after the first passing199-case union; the final frozen
source then passes every check.

Private reports, rendered HTML and hashes:
`/home/quintine/.local/share/dune/checkpoints/20261024-advisor-automatic-flips/`.
`frozen-integrated-2/report.json` records source fingerprint
`385c4758cd118574be8431593267a3198dd570eea6960c02e45a462e23494c4c`
on base `1a505525a8aa1499bc6270da2241506baf3e5be2`. Prose/reference evidence is
reviewed and hashed separately after verification.

Comprehensive rules, combinations, saved-game/recovery/privacy/custody assurance,
browser/mobile/deployed acceptance and full AI refinement remain open.
