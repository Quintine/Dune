# Truthtrance reserve-shipment promises

Implementation checkpoint, 7 September 2026. This completes a bounded Basic-game future-action predicate. It does not certify complete Truthtrance, Advanced play or expansion interactions, and opens no new mode gate.

## Authority and supported meaning

The [GF9 November 2020 FAQ, printed p8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf) provides the Emperor/Carthag example: a definite Yes binds the matching shipment while possible; No allows fewer forces, another destination or none. Current-turn commitments, unknown for outcomes beyond the respondent's control, storm-order priority and release upon impossibility are the publisher's rules. The independent reviewer retrieved official indexed text this checkpoint; direct PDF access returned 403. No tournament or other-edition rule was adopted.

The new question is explicit: will the target ship at least N **physical forces from reserves** to a named territory this turn? Ordinary Guild shipping, Fremen reinforcement and Guild-allied Fremen transport from southern reserves qualify. Guild board-to-board/board-to-reserves transport, ground movement, existing garrisons and free BG accompaniment do not. Quantity does not mean combat strength.

Automatic enforcement presently accepts this structured question only in the Basic game without expansions, during the active target's unused shipment opportunity, with pending decisions resolved. This is an unfinished software boundary, not a restriction printed on Truthtrance. Earlier-phase questions, Advanced Guild cancellation, concealed and allied No-Fields, expansion arrival chains, compound shipment/fact predicates and arbitrary prose remain unimplemented. Previously pending material interpretation questions remain pending.

## Implementation

`game/shipment-promises.ts` defines the normalized destination/minimum and turn-scoped boolean obligation. `game/truthtrance.ts` parses one to twenty physical forces and a printed territory, generates the public sentence, offers target-private answers through the engine, and binds/history/discards atomically through the existing overlay. A definite answer consumes exactly one physical Truthtrance. It does not select the final shipment sector, quantity or payment.

`findShipmentCompletion` in `game/engine.ts` searches canonical shipment quotes for all relevant physical quantities and destination sectors, honoring the full set of prior promises jointly. It tries deterministic preparations controlled by the respondent: their retained Karama, one Ghola's maximum available five-force revival, and withdrawal of their own recoverable outgoing pledge. Existing incoming escrow and already-active rate benefits are usable; unpledged rival spice, unknown cards and future cooperation are not assumed. These preparation operations preserve smaller-quantity choices, so maximal Basic Ghola revival is sufficient for destination/minimum predicates. Owned preparations may be combined. The Guild-allied Fremen southern-reserve route uses its actual authoritative transport action and paid tariff.

The solver never uses the AI's ranked move shortlist to declare an answer impossible. The independent probe showed those lists can omit both six-force quantities and otherwise legal destinations. Preparations run through the internal non-reconciling action seam on cloned state; they do not recursively invoke `applyAction`, change the real table, draw random cards, or reveal a witness publicly.

`ship`, `guildShip`, movement-first and `endMovement` check the obligation. `commitShipment`, reserve-origin Guild transport and actual skip/movement completion record fulfillment at the consumed opportunity. A qualifying shipment satisfies a Yes even if its forces later move or die. No permits any nonmatching event or skip. A target cannot bribe away required spice or spend the only needed preparation card to make their obligation disappear. Reconciliation retries all available owned preparations after an opposing change and publicly releases a genuinely impossible answer once, without private resource details. Older-turn records remain historical and do not constrain a new turn.

Saved records are validated before action, normalization and projection: seated distinct asker/target, supported active opportunity, valid turn/destination/count, boolean answer and coherent lifecycle. A saved pending shipment question is reparsed and retains a unique physical Truthtrance in each queued holder's actual hand. Independent review found two corruption-only risks—writing an invalid binding before projection failed, and consuming a wrongly substituted queue card—and both were fixed and covered. No client-accessible corruption route was demonstrated.

## Controls and AI

The question editor provides a destination, numeric minimum, public sentence preview, invalid-input feedback and the explicit supported timing boundary. The target sees available Yes/No choices privately. Movement shows accepted obligations and disables conflicting selected shipments, moves and end-of-turn actions with a linked explanation. Private optional guidance offers one executable preparation at a time, then a funded shipment with its exact payment breakdown.

All four AI profiles consume the target-only allowed answers. They rank destinations using their own reserves and visible board value, filter obligation-breaking movement proposals, and prepend the first action of the authoritative completion when a positive promise exists. The rest of the sequence is reprojected after each preparation. No extra spice, forces, cards or opponent knowledge are granted. Strategic question selection and full relative-strength calibration remain separate unfinished work.

## Verification

Registered focused coverage:

- `tests/shipment-promises.test.ts`: 13 tests, including every minimum 1–20 for all six Basic factions; jointly compatible Yes/No ranges and sector alternatives; blocked entry; exact owned preparation chains; Fremen/Guild reserve transport; voluntary evasion; opposing escrow withdrawal; private-view equivalence; malformed records and legacy/expired/fulfilled recovery.
- `tests/shipment-promises-bots.test.ts`: 8 tests across all four profiles, including destinations and counts omitted by ordinary strategy, positive/negative answers, own Ghola/Karama/escrow preparation, southern reserves and unrelated hidden-state perturbations. Generated proposals are checked through actual `applyAction` calls and JSON roundtrips.
- `tests/shipment-promises-recovery.test.ts`: 5 tests against the production room module and SQLite SQL. Fresh module reload, target-only projections, malformed requests, conflicting Yes/No CAS, duplicate shipment CAS, one discard/payment/arrival/fulfillment, 12 corrupted ledger subcases and six malformed pending-question/queue subcases, older-turn and completed records, and absent legacy fields.

The full regression run passes 1,598 rules/client/component tests and 148 multiplayer tests (1,746 total). After the saved-question validator changes, the focused Truthtrance/shipment set passes 38 tests. These figures measure implemented behaviors, not complete rules coverage.

Browser playtest used only the existing isolated QA room, saving its previous state before each staged scenario. At 390×844 the form remained readable; zero disabled Ask, six restored it. A real form submission received a paced Hard AI Yes, then the AI shipped six forces and completed its movement turn. A separate human respondent accepted Yes with one reserve, five tanks and three spice; the private guide executed Karama, Ghola for five, then six forces to Carthag for three spice. Conflicting normal shipment/end controls were disabled. Refresh restored the human shipment with six forces in Carthag, zero personal spice, no remaining reserves and the three physical cards discarded once. The restored player legitimately retains their movement choice; no further human action was automated.


Final typecheck, lint and production build pass. The first lint run found a missing input-label association, JSX apostrophe and untyped action-value interpolation; these were corrected before the final lint/build. Final evidence: `/tmp/dune-shipment-full-tests.log` (1,598, 61.13s), `/tmp/dune-shipment-multiplayer.log` (148, 17.42s), `/tmp/dune-shipment-final-focused.log` (38, 4.36s), `/tmp/dune-shipment-final-type3.log`, `/tmp/dune-shipment-final-lint3.log`, `/tmp/dune-shipment-build.log`. All processes completed successfully; earlier failing lint logs are not final evidence.

## Complete-game exercise

The reviewed offline runner `/tmp/dune-shipment-fullgames.ts` uses the unchanged public production start gate, genuine lobby readiness and setup, and naturally dealt/purchased cards. Twenty Basic games cover each player count 2–6 at each of the four homogeneous AI levels. A bounded **test question policy**, not a newly calibrated production asking strategy, chooses at most one natural Truthtrance per turn using only its holder's view and a publicly legal destination with minimum one. Respondents use their normal AI answer and fulfillment policy. No resources, card inventory, faction powers or rule exceptions are injected.

All 20 games completed: 9,597 accepted actions, zero rejected candidates, stalls, exceptions or invariant failures; 94 actual setup actions and 441 actual continuations from serialized JSON. Thirty shipment questions produced 23 Yes and seven No; all 30 records were fulfilled, with no pending or released promises. Yes occurred at every difficulty; the sampled No answers occurred at Hard and Brutal. Full-game thresholds here are minimum one; the six-force, all-minimum and preparation-path coverage comes from focused tests and browser play. This homogeneous sample cannot calibrate relative AI strength or certify the remaining game scope.

The root independently reviewed the runner and reread all 57 source/runner hashes with zero changes. Combined SHA-256: `e6c4c008d059934b8519d06b01c2bc15c9aaec40270cdd78b23a97bb6a70ca2c`. Results `/tmp/dune-shipment-fullgames.json`, SHA-256 `62f6d214b3b17f661497c65159534d732e710873f04fa407a1d15079bfa135df`. The run took 48.392 seconds and its terminal exited successfully.
