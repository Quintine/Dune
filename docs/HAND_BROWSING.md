# Private hand browsing

Connected prototype, 21 September 2026. Name search, printed-category filtering
and display sorting now wrap the existing private hand cards. This adds a usable
browsing function without changing card actions or rule-completion gates.

## Behavior

`HandBrowser` receives only `me.hand`. `browseHand` creates a display array with
the same physical card objects/IDs; it never sorts the saved hand in place.
Names match literally, ignoring case, surrounding whitespace and accents. The
shared `printedCardCategory` supplies the primary category, including canonical
expansion cards. It does not determine dynamic battle-slot or faction legality.

Players choose saved hand order, name A–Z or primary category followed by name.
Duplicate names remain separate and keep relative order. The result count and
**Show all cards** make filtered-out cards reachable. Clearing removes both
filters and retains the display sort. Empty hands retain the existing setup or
empty-hand explanation; no-match results have a separate recovery message.

The full card-render callback is reused with its physical-ID actions and
inspectors. Dedicated effect panels and mandatory choices remain outside the
filtered row. The scrollable row is keyboard-focusable, and Enter in the search
form cannot submit a game action. Native inputs and reset controls have 44px
minimum height; control text is 16px and labels 14px.

Filters stay in component memory. The room/seat key and leaving the hand tab
reset them, as does refresh. Current props drive every result, so removed cards
are not retained and new cards update the total even under an active filter.
There are no new endpoints, saved fields, credentials, storage, AI strategies
or hidden-information projections. Existing saved continuation remains shared.

The card presentation also corrects a stale Harass & Withdraw availability note:
[revealed physical allocation](HARASS_ALLOCATION.md) is connected. Richese and
other unresolved combinations remain guarded; no additional rule is enabled.

## Evidence and limits

Focused tests cover literal/normalized names, duplicate IDs, canonical expansion
categories, stable immutable sorting, current-card removal/acquisition and JSON
restoration. Full-table rendering checks that each seat receives only its own
inspectors while controls are busy, plus the undealt empty-state explanation.
Use `npm test -- hand-brows`.

Independent review, source-bound browser observations, final type/lint/offline
checks and build, saved-game preservation and Git delivery belong to the private
checkpoint. Browser samples and selection tests do not certify all card effects,
full visual accessibility or expansion combinations. Generic discard browsing
and manual drag-reordering remain outside this checkpoint.
