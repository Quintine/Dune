# Revealed battle components

Connected presentation prototype, 21 September 2026. Existing server plan
revelation and battle rules remain authoritative. No rule, action, AI strategy,
saved field, endpoint or mode/publication gate changes.

## Shared table presentation

Once both plans are public, a single shared area displays the physical attacker
and defender in that order, regardless of which player sealed first. Each plan
has its exact force dial, the played leader portrait and printed strength, and
readable weapon and original-defense faces with their existing guidance. A Cheap
Hero appears as a card in the leader slot. Empty slots say None; a late defense
has a separate Added after reveal label. Printed category remains distinct from
its chosen battle slot, including a Worthless card in the weapon slot.

One-click inspectors enlarge the actual visible cards and leaders. Leader IDs
now reach the portrait/inspector rather than dropping the bundled identity art.
Kwisatz Haderach inspection remains public inclusion only. Banker commitment,
CHOAM support, native Homeworld bonus, Diplomat copy/decline, Poison Tooth and
Stone Burner details keep their existing separate descriptions. The dial and
printed leader strength are not presented as a calculated winning score.

`GameTable` mounts this display once after the main grid. It stays available to
all viewers while another player owns a post-reveal decision, unlike the earlier
copies nested under specific decision branches. Compare revealed battle plans
and Return to battle decisions link to focusable sections. No inspector or
navigation link submits a game action. This keeps the larger faces separate from
the pending controls while preserving their connection.

The layout fits two plan panels when space permits and stacks on smaller screens.
Cards wrap within each plan; readable rules use 16px text and inspection controls
retain 44px minimum height. No new animation, timing delay or confirmation is
introduced. Full visual/component and screen-reader acceptance remains open.

## Privacy and continuation

The renderer returns nothing unless `battle.revealed` is true. It never consumes
Atreides private full-plan insight or any player's hand. Each visible face is
selected by an exact used ID from the already projected `battle.cards`; native
leader identity comes from the authorized leader catalog. The small pieces
component receives only those selected public identities and the dial.

The original defense remains separate from a late defense or a Diplomat copy.
Refresh reconstructs the same display from the saved public plans. Reordering
the presentation does not reorder saved plans, reveal Traitors, change payments,
execute a card or submit a battle decision.

## Verification

Five focused cases cover real sealed/revealed transitions, explicit plan order,
used versus unplayed card privacy, immutable JSON rendering, fractional dials,
Cheap Hero, Worthless, empty/late slots and both viewers during a real Diplomat
choice. Existing Kwisatz, Banker and Diplomat regressions exercise retained
special-effect metadata. These are bounded rendering checks, not full rules-mode
certification or proof that every battle combination works.

Private browser evidence uses a new Emperor/Harkonnen QA lobby with genuine
Basic setup, followed by an explicitly staged battle position conserving card
and force inventory. Choosing the battle, the opponent's saved plan and the
human's sealing action use normal engine actions; the intervening game was not
played. Browser inspection, final check/build results, original saved-game
preservation and Git delivery are recorded under `20260921-revealed-plans` outside
the checkout. The commit message records actual outcomes and limitations.
