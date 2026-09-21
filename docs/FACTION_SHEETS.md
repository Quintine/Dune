# Public faction sheets

Connected inspection prototype, 21 September 2026. Every player card has
**Inspect faction**, available during setup, play and pending decisions. The
internal `faction-sheets` topic also offers a gallery of all twelve factions.

The inspector receives only a public faction ID and Basic/Advanced mode. It
reads no player state, held cards, leader custody, cache or hidden tokens and
sends no action. The enlarged sheet uses existing bundled Homeworld artwork,
crisp text and the same `FACTION_RULES` paragraphs as the internal faction topics.
There are no new images, endpoints, persistence fields or AI decisions.

The initial display follows the table mode. **Include Advanced powers** changes
only the local reference display, with an explicit preview notice when it differs
from the table. Advanced powers follow their underlying Basic powers. Close,
Escape and reopening return to the normal dialog lifecycle; changing faction or
table mode resets the reader. Gallery faction changes start with Basic guidance.
The long sheet has an independently focusable scrolling region, named controls,
44px control targets and 16px body text. Detailed links remain internal.

## Shared guidance and authority

Richese no longer receives a placeholder faction paragraph; Ecaz and Moritani
move from embedded topics into the shared typed twelve-faction map. Existing
contracts supply the new original-language summaries:

- Richese: [auctions](RICHESE_AUCTION_RULES.md),
  [acquisition](RICHESE_ACQUISITION_RULES.md) and
  [No-Field](RICHESE_NO_FIELD_RULES.md).
- Ecaz: [Ambassadors](ECAZ_AMBASSADORS_RULES.md),
  [alliance](ECAZ_ALLIANCE_RULES.md), [Collection](ECAZ_COLLECTION_RULES.md)
  and [victory](ECAZ_VICTORY_RULES.md).
- Moritani: [Terror](MORITANI_TERROR_RULES.md) and
  [Advanced assassination](MORITANI_ASSASSINATE_LEADERS.md).
- CHOAM: [Auditor](CHOAM_AUDITOR.md) and the existing internal Worthless-card
  guides supersede stale claims that Auditor setup, Baliset and Jubba Cloak are
  absent. The Auditor inspects up to two unused cards on survival or one on
  death; prevention costs one spice per card that would actually be inspected.

The supported Ecaz/Fremen Sietch Tabr exception replaces the old blanket missing
claim. Unfinished Ecaz Advanced powers, Duke/Occupy interactions, Richese card and
auction combinations, Moritani effects and normal-traitor forfeiture remain
explicit. No new source interpretation or mode gate is introduced. These are
readable faction guides; complete printed-sheet text and combined rule acceptance
are still open requirements.

## Verification

`npm test -- faction-inspector` covers all twelve identities, shared reference
text, bundled artwork, valid internal links, Basic/Advanced separation, gallery
defaults, and public table controls for either viewer while actions are busy.
Tests do not claim interactive focus, rule correctness for every paragraph or
full game acceptance. Independent review, browser observations, final check/build,
saved-game preservation and Git delivery belong to the private source-bound
checkpoint. Existing gameplay and minimal legal AI participation are unchanged.
