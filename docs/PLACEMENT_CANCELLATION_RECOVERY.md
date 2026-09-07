# Placement cancellation and phase continuation

Integrated 7 September 2026. This is a bounded reliability checkpoint for supported internal Basic/Advanced fixtures, not certification of full Ecaz, Moritani or expansion games. The earlier [continuation audit](PLACEMENT_CANCELLATION_CONTINUATION_AUDIT.md) records the reproduced defects and existing publisher provenance. No new tabletop interpretation or mode gate was introduced.

## Implemented behavior

`game/placement-cancellation.ts` validates each actual current declaration and returns a detached denial receipt. Ecaz keeps every physical Ambassador and its placement spice, blocks the remaining opportunity this turn and completes Revival. Moritani keeps every Terror face, zone and location and consumes only the current placement opportunity. Denied Moritani Duke acquisition leaves the shared disc and its existing custody/death history untouched.

The engine composes these receipts before either printed Karama or a new BG Worthless conversion pays, and revalidates before completing a saved paid conversion. It validates the successor actually reached, without replaying the denied placement/acquisition or demanding that the denied effect remain useful or affordable.

- **Ecaz:** Revival income has already settled before placement. Cancellation completes the phase directly. Shared `quoteMovementPhaseStart` requires one complete unique seated order, resets movement counters and timing once, and quotes the existing advisor/Guild opportunity. An Ix phase opening is a genuine boundary. Atreides refill is a source requirement and real execution request; no future shuffle/card is sampled during the check. Phase entry itself creates no shipment, worm ride or Ambassador/Terror arrival.
- **Moritani placement:** Mentat bribes and Inflation opening effects have already settled. With CHOAM, cancellation leaves its later market/Mentat lifecycle intact. Otherwise shared `quoteVictory` computes the actual normal/allied thresholds, individual tech set, advisor releases, prediction replacement and existing tenth-turn fallbacks. Finishing the game consumes the exact optional Stronghold ownership result. Already claimed current-turn ownership is not settled again. This refactor preserves existing fallback ordering; it does not establish a new combined rules ruling.
- **Duke:** A real CHOAM market stops phase departure before refunds. Otherwise shared `quotePhaseResources` quotes current technology payouts followed by escrow refunds using safe nonnegative arithmetic; real departure applies those receipts once. Ix opens its Battle window next. Without Ix, current battle geometry determines the first attacker; an empty Battle phase reaches the existing collection quote on post-refund public balances.

The shared aid refund primitive also serves the existing Battle-to-collection quote. Neither recipient eligibility nor an ongoing alliance is required simply to return already committed escrow to its seated donor. Current token income is paid before that donor's refund. The movement advisor helper now uses readonly public board projections instead of effectful whole-game copies.

## Traceable coverage

| Area | Implemented and verified | Remaining |
| --- | --- | --- |
| Rules/engine | Three current source receipts, movement initialization, phase income/refunds and exact victory/Stronghold result | All cancellation families, general durable cost frames and exhaustive automatic continuations |
| Player controls | Existing chosen-card cancellation, pending BG response, refreshed movement controls and next-player ownership exercised | Broader mobile and all expansion journeys |
| AI | Same authoritative checks apply to all actors; 20 complete Basic games cover 2–6 seats and four homogeneous difficulty levels | Mixed-difficulty strength calibration and complete Advanced/expansion acceptance |
| Internal guide | Partial Karama checklist records the new shared checks and five test files | Complete internal rules/reference and component inventory |
| Persistence/privacy | Actual SQL module reloads, authenticated projections, raced final allowances, stale actions and malformed-save rejection | Exhaustive interactions with all other pending effects |

## Validation

Registered suites pass **2,450 rules/client/component +220 multiplayer tests =2,670**. The new slice contributes 14 placement, seven resource, eight movement-start, 35 victory and four production-room persistence tests. Full logs: `/tmp/dune-placement-rules-final.log` (69.45 seconds), `/tmp/dune-placement-multiplayer-final.log` (22.48 seconds). Typecheck, lint and production build pass; final log names are `/tmp/dune-placement-{type,lint,build}-final.log`. The internal-reference-only evidence update also passes its focused test file.

Real declarations precede the corruption tests. Duplicate movement order, missing victory ally and negative aid reject before either initial cancellation cost and at a saved BG conversion's final allowance. SQL recovery tests use reloaded production room code, real authentication and compare-and-swap races: exactly one final request commits, with no duplicated refund, cost or victory log. All six corrupted pre/paid SQL attempts leave the saved state/version unchanged. These are malformed-save defects; no legal-action exploit was established.

Tests also cover meaningful cancellation after changed placement usefulness, exact hidden token retention, prior Duke ownership, current no-battle continuation, technology plus escrow plus collection, CHOAM/Ix boundaries, existing advisors, Atreides supply, Guild timing, normal/allied and all current final-turn victory paths, concealed No-Field values and final Stronghold ownership. Countercanceling BG restores the original response while a real opposing cancellation remains available; normal automatic allowance is preserved.

Stricter shared public-board validation exposed old test fixtures with nonexistent stronghold sectors. The existing engine victory fixtures now use Tuek sector5 and Habbanya sector17, and the historical simultaneous-tech fixture uses Habbanya17. Assertions and winner expectations were preserved. A temporary integration error in the ordinary Moritani decline branch was corrected before final checks; its original placement-turn stamp is retained. Two new browser-oriented test mistakes (bribes stored on Game instead of Player, and expecting a response to remain after every countercard was gone) were corrected in fixtures, not by weakening runtime behavior.

The unchanged-source public Basic sample uses the existing `/tmp/dune-sapho-base-fullgames.ts` runner, seed 20261016. **20/20 games** complete with **13,655 accepted actions, zero rejected candidates/stalls and 603 JSON round trips**. It covers counts 2–6 and Easy/Medium/Hard/Brutal in homogeneous tables. Output is `/tmp/dune-placement-fullgames-final.json`. This sample exercises shared phase and victory regressions; it cannot certify expansion-specific effects while their public starts remain gated.

## Browser and saved state

The existing isolated QA room `8S3MRDEK` was backed up at v81 and restaged with the same two authenticated seats as BG/Ecaz. The initial phase4 board/resources and physical cards are a conserved synthetic fixture; end-of-Revival readiness and Ambassador declaration use actual actions. Browser-selected Baliset cancellation persisted at v83, the controlled Ecaz allowance reached v84, and browser refresh restored the same private Shield, ten spice, twenty reserves and a complete two-seat movement queue. Ambassador inventory and placement spice were unchanged; the placement block was current.

The browser then shipped one BG force to Arrakeen for one spice and finished movement. At v86, BG has 19 reserves, one force in Arrakeen, nine spice and one remaining Shield; only Ecaz remains in the movement queue and the UI identifies Ecaz as the active player. There is no fabricated Ambassador or Terror arrival. Private before/staged/pending/final/resumed snapshots are `/tmp/dune-placement-qa-*.json` with mode 0600. This is a controlled transition check, not a complete expansion playthrough.

All 2,286 older non-QA room versions and JSON hashes match the 08:50 maintenance checkpoint; the current database contains 2,347 rooms after tests. Development server session 88643 remains running. The previous controlled backup/restart was 08:50 UTC; the next hourly check is due 09:50 UTC during active development and must defer active human play. The user explicitly left the automation removed; it was not recreated.

The full goal remains active: complete Advanced, all twelve factions, all three expansions and optional modules support, component and guide completion, calibration, exhaustive continuations and full user journeys remain unfinished.
