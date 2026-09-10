# Moritani Nexus Cunning runtime

This checkpoint integrates Cunning with native Moritani's Mentat placement, in Basic and Advanced. Its bounded scope follows the [source audit](NEXUS_MORITANI_RULES.md): one **available supply token** may be placed in a territory on the printed Arrakis board, including one already containing Terror. Homeworlds and the Hidden Mobile Stronghold are excluded. Cunning relocation and its combination with Grumman Collection remain unavailable pending their separate interpretation.

The existing Mentat opportunity remains the action window. Cunning does not create another native placement, trigger an existing occupant, move forces, or remove a sibling token from a stack. Playing the Nexus spends it and opens the placement's ordinary Karama response. Allowance places the selected physical token; cancellation keeps the token in its original custody and consumes the placement opportunity while leaving the Nexus spent. Ordinary placement and relocation retain their original stronghold rules and action shape.

## Private choices and controls

The engine projects `nexusMoritani` only to the native holder. It contains the current event, a blocking reason, eligible physical supply tokens and authorized territory IDs. The [shared options helper](../game/nexus-moritani-options.ts) checks the current owner, held unallied Nexus, native Mentat decision, event, interruptions and projected membership. Cunning actions add `nexus: event` to the existing placement decision; ordinary actions remain unchanged.

The [Moritani placement panel](../components/moritani-terror.tsx) starts with ordinary placement selected. Its explicit “Use Moritani Nexus Cunning” checkbox changes the token list to available supply and the destination list to the projected Arrakis choices. The checkbox uses the existing accessible label spacing; controls respect transport-busy state and display server blocking reasons. The physical token names and existing token inspectors remain intact. No client code invents a token face from its opaque ID.

Opponents do not receive the private offer or supply faces. Public placed tokens retain only their visible location and stack count. Existing [Terror board markers](../components/terror-board-markers.tsx) group tokens by territory, and existing stack-entry controls choose one original token before revelation or an alliance offer. Broad placement does not implement a previously unavailable Terror effect.

## Bot policy and preserved boundaries

All four profiles consume the same private offer. The shared policy uses public opposing force positions to choose a territory or stack unavailable to ordinary placement; otherwise the existing native placement policy remains in charge. It prefers a supported Terror face from the owner's authorized supply when available. This is a legal policy extension, not evidence of calibrated Moritani strategy.

The engine binds the original placement, physical face and native opportunity in a saved receipt. A separate current-placement map ends when the token relocates, reveals or returns to supply; historical evidence remains available to the already committed entry and discard children. This preserves legitimate continuation across later turns and population changes without letting an old receipt authorize a new relocation. Consumers neither reconstruct that history nor broaden ordinary Grumman addition rules. The [Grumman stacking source](GRUMMAN_STACKED_TERROR_RULES.md) and its separate removal boundary remain unchanged.

Atomics and Extortion reactions, restricted Assassination leader pools, and existing Sneak Attack arrival combinations retain their explicit gates. No complete Moritani, Nexus or expansion-release claim follows from this checkpoint.

## Independent recovery review

The review found and fixed two source-consistency flaws: deleting a new arrival signature could downgrade it to the legacy path, and an old placement record could justify editing a later relocated token back to its previous desert. New Cunning entries require their arrival signature, and current custody now requires its live placement record. Rebinding the saved token face also rejects against the original inventory. The ordinary cancellation and card-discard paths use the same territory proof.

The fixture completes real Nexus-enabled setup and real turn boundaries before placement and later arrivals. An older internal-sector movement test formerly injected a desert token without authorization; it now earns that position through actual Cunning and next-turn progression, retaining the same no-new-entry assertion.

## Verification

Five new consumer cases are provided in [controls](../tests/nexus-moritani-controls.test.ts) and [bots](../tests/nexus-moritani-bots.test.ts), using the [genuine setup and Mentat fixture](../tests/fixture-nexus-moritani.ts). They cover Basic/Advanced source actions, expanded versus native choices, supply-only membership, explicit unchecked controls, existing inspectors, busy/blocked state, stale events, private-view fences, all four profiles and native fallback. The expanded selection is exercised through the shared options and actual engine declaration; interactive checkbox browser verification is separate.

Focused verification passed **42/42 tests** across the new consumer suites, existing Moritani placement, Grumman controls, Nexus controls and reference checks. Type-aware lint passed for the changed consumer files.

Final integrated checks pass: **types, lint, all 4,069 offline tests, production build and 40 HTTP/session tests**. Twenty-seven new cases cover the pure quote/receipt, consumers, engine, production SQLite and independent review. The SQL cases include actual non-stronghold shipment, reveal and Robbery choice, competing pass/cancellation, repeated requests and malformed records. Logs are `/tmp/dune-moritani-{check,build,http}.log`.

Two isolated three-seat browser rooms passed phone checkbox/selection/declaration, desktop response, allowance/cancellation and all six private refreshes. Advanced/Homeworld room `S7ANWNXF` version 4 placed Robbery in Red Chasm and preserved the ordinary Arrakeen token. Basic room `2K8RJCG2` version 4 canceled the same attempted destination, retaining its supply token and spent Nexus. Both retained Moritani's original 20 spice; placement earned no extra Grumman income. Opponents received no supply face or private offer. No page errors or phone overflow were observed. The public Red Chasm marker was inspected on desktop and phone. `/tmp/dune-moritani-nexus-restore.cjs` performs read-only private restoration checks.

The opening backup and final comparison preserve all **3,516** older room versions/state hashes. Only two browser and thirty HTTP-test rooms were added, for 3,548 total. The existing server was reused; no hourly restart was due. Automation remains removed. These checks do not certify the unresolved Cunning combinations or full Moritani/expansion acceptance.
