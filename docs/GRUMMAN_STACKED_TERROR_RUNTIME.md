# Grumman Collection and stacked Terror runtime

Development checkpoint, 10 September 2026. Grumman has Collection addition/decline controls and stacked Terror has an owned token-selection continuation. The checks below pass; this is not a complete Moritani, Homeworld or expansion implementation. Start and publication gates remain in force. Printed evidence, interpretation boundaries and the existing removal question are in [GRUMMAN_STACKED_TERROR_RULES.md](GRUMMAN_STACKED_TERROR_RULES.md).

## Current Collection behavior

[grumman-collection.ts](../game/grumman-collection.ts) validates the six physical Terror identities and current native population. At eight or more native Moritani reserves, the owner can add one available hidden token to an ordinary stronghold already holding Terror. The accepted transaction places that token and awards four bank spice. It neither relocates another token nor consumes ordinary Mentat placement. Storm does not exclude a placement destination; Homeworlds and the Hidden Mobile Stronghold are excluded. Declining changes no token and pays nothing.

The engine stages a separate [Collection receipt](../game/grumman-collection-return.ts) after ordinary collection, then opens the owned choice when Ecaz collection and other active continuations have settled. It checks population again on acceptance. A low-population waiting opportunity can expire when Collection ends; an open choice can always be declined. Recorded event, owner, turn, stage and outcome prevent inconsistent restoration or reapplying the same completed operation. The production room recovery detector recognizes waiting Grumman continuations.

One operation per Collection follows the card’s singular phase grammar. Serializing it after Ecaz settlement is implementation ordering, not a printed priority rule. The inspected ordinary operations do not change each other’s native force count, token availability or allocation formula. Grumman’s four bank spice is neither desert collection nor an Ecaz shared pool and does not trigger Giedi income.

[grumman-collection-options.ts](../game/grumman-collection-options.ts), [the owned controls](../components/grumman-collection.tsx), and all four bot profiles share the projected legal addition/decline choices. Opponents receive no available token faces or selectable destinations. Public logs describe the placement and four-spice award without disclosing the hidden token type.

## Stacked entry and selected-token recovery

An opposing entry into a stronghold containing multiple Terror tokens opens a private `select` stage. Moritani chooses one original candidate before the ordinary reveal/alliance offer, or declines the whole entry. Supported token effects use the existing handlers; resolving one token does not manufacture another entry to activate its neighbor. One chosen revelation is the ordinary-trigger composition described in the source audit, not a newly discovered stacking FAQ.

[terror-entry-receipt.ts](../game/terror-entry-receipt.ts) binds the original candidates and public entering group. The selected identity has its own consistency proof, which is also included in the entry signature after selection. This prevents removing the selection proof and rewinding a selected entry to the selection stage while retaining the original receipt. Enemy of My Enemy cancellation preserves the selected identity; its previous one-token-per-location check now validates the selected physical identity without rejecting legitimate colocated tokens.

Every unselected candidate remains reserved at its original location while the entry is unresolved. The selected token must also remain placed before revelation. Once Sabotage has actually consumed its token and discarded a card, the saved `terrorDiscard` child correctly expects that token to be removed while retaining all unselected tokens at the stronghold. Independent review reproduced and repaired the earlier false rejection of this genuine child. The regression captures the actual inner-dispatch discard and restores it; it does not claim a user-visible HTTP pause at that internal boundary.

[Map markers](../components/terror-board-markers.tsx) group colocated public tokens and display their count without consulting hidden faces. Only Moritani sees candidate identities/effects in the selection controls. Revealed effects follow their normal public rules; every still-hidden neighbor retains its private face.

## Boundaries retained

- Removing an unrevealed board token remains unavailable until its destination is established. The existing question is still pending; removal neither reveals/spends a token nor pays four spice.
- Occupation lifecycle and occupied Grumman immunity remain outside this checkpoint. Other unfinished Terror effects and combined arrival/cancellation interactions retain their existing guards. Stacking does not implement them.
- Deterministic signatures detect inconsistent saved fields; they are not cryptographic authentication against arbitrary coordinated rewriting of all stored state and proofs. Older entries missing all new metadata retain their documented legacy limitation; readers do not reconstruct an original entering group from current occupants.
- Complete faction/expansion setup, combined games and the overall user goal remain unfinished. No gate is removed by passing these focused tests.

## Verification checkpoint

The five focused suites contain 30 cases: seven [pure quotes](../tests/grumman-collection.test.ts), seven [engine scenarios](../tests/grumman-collection-engine.test.ts), seven [production SQLite recovery cases](../tests/grumman-collection-recovery.test.ts), six [controls/markers/AI cases](../tests/grumman-collection-controls.test.ts), and three [selection/discard review cases](../tests/grumman-selection-integrity.test.ts). The shared [scenario fixture](../tests/fixture-grumman-collection.ts) uses genuine Moritani/Atreides/Harkonnen Homeworld setup and conserved later positions; Collection and paid entry receipts are generated by real actions.

The seven SQL cases and focused lint passed. SQL coverage includes competing addition/decline and token-selection writes, a lost addition response, the separate actual Mentat placement, one Robbery payment, all-seat privacy, unrelated-room preservation, and rejection without writes for inconsistent phase, custody, candidate, selected-token and completed-operation records.

- **`npm run check`: PASS**, including types, lint and all **3,712 offline cases** (90.4 seconds). The older delayed-Chemistry test now initializes the real six-token inventory when manually adding Moritani; production validation remains strict.
- **`npm run build`: PASS.** Later edits only corrected that test fixture, clarified a code comment and recorded this documentation.
- **`npm run test:integration`: PASS**, all **40 HTTP/session cases**.
- **Browser:** isolated three-human QA room `HU6YUC7Z` used genuine initialized Homeworld state and conserved staged positions. Real keyboard actions ended movement, added Sabotage alongside Robbery for four spice, shipped one Atreides force into Arrakeen, selected Robbery privately, revealed it and took half the entrant’s remaining spice. The resulting version 10 has Moritani/Atreides/Harkonnen spice balances 34/9/20, one remaining hidden Sabotage token, and the consumed Robbery token. All three private seats refreshed successfully, with no opponent hand/spice or hidden-token leaks and no page errors. Both Collection and stacked-selection controls were visually inspected at desktop and 390-pixel phone widths; neither overflowed. The board exposed the public two-token count without exposing faces.
- **Saved rooms:** after the browser scenarios and HTTP suite, all **3,081 preexisting room versions and state hashes remained unchanged**. The database contains 3,112 rooms, including this isolated QA room and 30 integration-test rooms. No database reset or migration occurred. The existing development server was reused; the preceding controlled restart was at 21:42 UTC on 9 September. This checkpoint does not claim a new restart.

Read-only browser restoration also passed for the earlier Caladan room `LV2TNQ88` (version 5) and revival room `463GUCY3` (version 7), with all three private seats in each room. Their saved resources and completed continuations remained intact.

Local verification logs: `/tmp/dune-grumman-verified-check.log`, `/tmp/dune-grumman-final-build.log`, `/tmp/dune-grumman-final-http.log`. Browser images: `/tmp/dune-grumman-desktop.png`, `/tmp/dune-grumman-phone.png`, `/tmp/dune-grumman-stack-desktop.png`, `/tmp/dune-grumman-stack-phone.png`. These temporary evidence files and private browser sessions are not shipped with the application.
