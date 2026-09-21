# Ecaz Loyalty

Connected Advanced development prototype, 21 September 2026. This does not
certify the complete faction, open public Advanced starts or change AI strategy.

## Authority and interpretation

The official [Ecaz & Moritani rulebook, printed page 8](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=8)
requires a random native Ecaz Traitor Card to be set aside publicly before the
initial Traitor draw and excluded for the rest of the game. The
[page 16 Karama table](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=16)
lists no Karama effect for Loyalty. Five ordinary Ecaz cards are candidates;
Duke Vidal has no Traitor Card. This is a card movement, not a change to leader
ownership, availability, death or revival. Independent source review confirmed
the indexed official rulebook text; direct PDF retrieval failed in this audit.

The implementation resolves this automatic step immediately before the existing
initial shuffle and deal. Bene Gesserit prediction and any supported pre-Traitor
skill setup therefore precede it. That relative sequencing is an implementation
composition of the printed before-draw requirement, not a separately printed
ordering ruling. No optional choice, payment, Karama window or acknowledgment
is introduced.

## State and physical custody

`game/ecaz-loyalty.ts` owns the selector, deck exclusion and saved invariant.
New genuine Advanced setup with native Ecaz records the player and a pending
card, then chooses exactly once before initial dealing. The selected physical
card stays in this separate public location. Its identity is removed from initial
Traitor dealing, the Tleilaxu setup reconstruction and Nexus replacement
universes. Later Face Dancer cycling uses the remaining physical cards.

Validation rejects invalid owners, Basic/lobby markers, late pending draws and
duplicated cards across the reserve, held Traitors, setup choices, Face Dancers
or recorded Moritani assassination cards. Action, normalization and view
boundaries validate before mutating or exposing state. JSON continuation keeps
the selection and does not replay the notice. A save without the marker is
legacy state: no already-dealt card is retroactively taken away.

The player view returns only a detached public player/card pair once chosen.
Every viewer sees the same identity. The table renders the existing enlarged
Traitor inspector and an internal help link; no private hand or deck order is
added to this public component. The automatic chronicle entry uses the existing
Ecaz action notice.

## Evidence and limits

- `tests/ecaz-loyalty-engine.test.ts`: genuine two-through-six-player deals,
  prediction ordering, Basic/no-Ecaz absence, completed Harkonnen/Tleilaxu setup,
  all four legal AI profiles, JSON continuation and completed legacy saves.
- `tests/ecaz-loyalty.test.tsx`: random candidate bins, physical inventory,
  immutable invalid-state rejection, public rendering and internal inspection.
- `tests/nexus-traitor-engine.test.ts`: actual Harkonnen and Tleilaxu Nexus
  replacement draws keep the same excluded card and full physical census.
- Existing expansion setup and Nexus fixtures count the separately held card
  instead of treating it as a loss or reconstructing it into the deck.

Leader Skills plus Ecaz and the Moritani assassination preview plus Ecaz remain
outside their currently supported combined rosters. Compatible code does not
establish combined-game acceptance. The no-Ecaz Leader Skills regression checks
only that existing setup is unchanged. Broader card/leader effects retain their
own guards and pending rulings.

Private source-bound check/build/HTTP logs, six faction-game samples, browser
inspection and saved-game preservation are recorded outside the checkout under
`20260921-gameplay-review`. The commit message records actual final results.
The browser uses a newly created ready Ecaz/Harkonnen lobby initialized through
the genuine Advanced audit seam before any draw; it does not retrofit a game
that has already started. Existing rooms and saved seats are preserved.
