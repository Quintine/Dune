# Live draw-pile counts

Connected prototype, 21 September 2026. This completes the missing ordinary
draw-count display; full component, rules-mode and visual acceptance remain open.

## Behavior and boundaries

`viewGame` now projects `drawPiles: { treachery, spice }` from the lengths of the
authoritative draw arrays, or `null` while the lobby is uninitialized. The table
displays both counts above the board with an internal guide. Counts refresh with
the existing saved-table response and require no decision, command or schema.
Finished games retain their actual counts.

The numbers exclude hands, auction pools, the Richese cache, discards and other
separate holdings. Auction `remaining` already counts its unsold pool including
the current lot; Nexus already exposes its own deck/discard counts. No inferred
Storm deck is introduced: that runtime selects from six values without a saved
physical draw array. No private identities, order, peeks or discard faces are
added to the response.

Zero is a real empty draw pile. Existing Treachery and Spice refill logic remains
authoritative; viewing never triggers a shuffle. First-turn worms set aside are
outside the pile until returned, and Thumper annotations are not physical Spice
Cards to recycle. Optional cards contribute only when physically in a draw pile.
The feature does not change any of these rules or the existing card custody.

The existing [Nullentropy contract](NULLENTROPY_BOX_ENGINE_AUDIT.md) records the
GF9 CHOAM & Richese rulebook's discard privacy restriction and the paid owner's
search entitlement. Counts grant no new discard inspection. Public Spice tops,
owned hands and entitled peeks keep their existing inspectors. Generic discard
browsing and hand sorting/filtering are not supplied by this checkpoint.

## Verification

- Genuine three-player Basic setup checks undealt and dealt counts, all viewers,
  private-field exclusion, input immutability and JSON restoration.
- Controlled Charity boundaries use real ready/auction draws, including an
  exhausted Treachery pile, and reconcile physical auction/deck identities.
- A later Storm/Spice boundary exercises real Spice refill with an excluded
  Thumper annotation. A first-turn draw checks a skipped worm leaving and
  rejoining the counted pile.
- Full-table rendering connects the display while controls are busy. Empty,
  single-card and lobby states have focused rendering checks.
- Existing CHOAM market, Ecaz alliance, Richese Ambassador and Sapho privacy
  fixtures now keep public draw counts fixed while varying hidden allocations
  or identities. Complete opposing-view equality assertions remain intact, with
  physical custody checks. Moving a card out of a public draw pile is not an
  otherwise-identical public state.

Run `npm test -- draw-piles`. Independent review, browser checks, final
type/lint/offline/build/HTTP checks, saved-game preservation and Git delivery
are recorded in the private source-bound checkpoint. Focused fixtures are not
complete-game or expansion-combination certification. AI strategy and release
gates are unchanged.
