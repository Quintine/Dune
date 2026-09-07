# Auction cancellation recovery — 7 September 2026

This implementation follows the source and continuation analysis in [AUCTION_CANCELLATION_CONTRACT.md](AUCTION_CANCELLATION_CONTRACT.md). It does not introduce a new rule interpretation or enable gated game modes.

## Shared runtime calculations

`game/ix-auction-draw-quote.ts` validates the current Ixian inspection declaration and requests the real draw: the frozen ordinary count when canceled, or that count plus one when allowed. Both paths consume this request. It checks readable draw/discard piles and unique physical custody, including a cancellation card about to enter the discard. It does not require a minimum supply, recalculate the declared count from current hands, sample randomness, or choose a future card. Basic Ixian behavior remains supported by the existing engine. The actual draw still handles short supply and discard refill.

`game/ix-technology-cancellation.ts` supplies the shared normal Atreides peek transition and the canceled Technology transition. Cancellation binds the current unbid normal lot, opening bidder, Ixian owner, used-turn stamp and saved replacement declaration. It clears the pending exchange and resumes the normal peek without reading the proposed replacement's current custody or exchanging either card. The attempt stays used. A missing replacement remains permissible for cancellation; the existing allowed exchange also retains its missing-card fizzle.

`game/auction-continuation-quote.ts` is shared by paid-sale continuation, bonus offering and next-lot advancement. Supported cancellation families are Ixian allied replacement, Emperor auction income and Harkonnen bonus. Normal receipts bind winner, amount, free-payment flag and current lot. Sold Richese cache and Black Market receipts bind their separate lot and declaration records. Existing legacy normal saves without a sale receipt retain an explicit fallback. Cancellation does not recheck the buyer's already-paid resources or replay purchase payment.

The result describes exact seller credit, pending replacement cleanup, a response, a reset next lot, unsold-card return, or an explicit Richese/phase boundary. Bonus and bidder eligibility use hand counts after the declared cancellation cost. Seller credit occurs only in the sale stage; bonus and next-lot stages cannot repeat it. These internal descriptors contain private cards and are never exposed as player views.

Independent review reproduced a malformed-save custody gap: an unsold card duplicated into the deck could advance into the next lot after BG cancellation. The shared quote now checks every unsold suffix identity against actual ownership zones before a new cost and again during saved allowance. Current acquired-card and historical sold-card references remain valid aliases; they are not treated as extra physical holdings. The original probe now rejects the malformed continuation.

## Verification

The new registered tests comprise 62 rules tests and four persisted multiplayer tests:

- `tests/ix-auction-draw-quote.test.ts`: eight tests for frozen counts, canceled/allowed draws, paid-card refill, malformed declarations and pure zero-randomness validation.
- `tests/ix-technology-cancellation.test.ts`: 32 tests for genuine declarations, printed/BG cancellation, countercancellation, exact peek restoration, private cards, missing replacement and malformed source rejection.
- `tests/auction-continuation-quote.test.ts`: 17 tests for paid/free/legacy receipts, normal and Richese settlement, post-cost hand eligibility, all-full and final-lot boundaries, seller credit, actual automatic Harkonnen draws and next-lot progression.
- `tests/auction-unsold-custody.test.ts`: five independent regressions for deck/hand duplication before cost and after saved BG payment, plus valid acquired-card aliases.
- `tests/auction-cancellation-recovery.test.ts`: four production-room SQLite tests using fresh module loading and authenticated seat recovery. Concurrent final responses yield one successful compare-and-swap and one conflict. Buyer payment, private bonus draw and advancement occur once. Twelve malformed saved source attempts produce no writes.

The coordinating review read the complete helpers, integration, test files and independent custody probe findings. Focused suites passed. Final registered suites pass **2,312/2,312 rules/client/component tests and 212/212 multiplayer tests (2,524 total)**. Typecheck, lint and production build also pass. The first full rules run passed 2,311/2,312; its only failure was an older constructed Black Market fixture carrying the cache's `position=first` and normal count. The fixture now uses the actual pre-declaration null values; assertions and runtime rules were not weakened.

Final logs: `/tmp/dune-auction-rules-final2.log` (60,788.6 ms), `/tmp/dune-auction-multiplayer-final.log` (22,586.5 ms), and `/tmp/dune-auction-{type,lint,build}-final.log`.

A public-start Basic sample completed **20/20 games**, covering two through six players and all four homogeneous AI profiles. It accepted 10,529 actions with zero rejected candidates, stalls or checked failures and 475 JSON round trips. Runtime was 121,342 ms. The unchanged runner is `/tmp/dune-sapho-base-fullgames.ts`; results and complete traces are `/tmp/dune-auction-fullgames-final.json`, seed 20261014. Source hashes were unchanged during the run; combined fingerprint `9f74f0b6a26fcd880c74e3d69357a007adc2ee32a394db352b0b5774ee5a7d8e`. This sample verifies regression behavior, not comparative AI strength or complete expansion play.

A read-only comparison at 08:34 UTC found 2,287 rooms and exact unchanged state/version pairs for all 2,196 older non-QA rooms in the 07:50 UTC backup. The known human room remains version 14. The existing development server remains available; no restart was due in this slice. The next controlled manual maintenance is due around 08:50 UTC during active development, subject to human play.

## Browser playtest

Only the existing isolated QA room `8S3MRDEK` was staged; its prior version 73 was saved first. Its two authenticated seats were retained. A phase-2 fixture proceeded through genuine readiness, Ixian pool inspection and Technology declaration actions before saving version 74. This is a staged interaction check, not a complete expansion game.

The Bene Gesserit browser seat used **Use Baliset as Karama**, creating version 75. A controlled opposing seat allowed the conversion, producing version 76. Assertions verified unchanged auction cards, deck, Ixian hand, resources and used-turn stamp; the Baliset appeared once in discard. Refresh recovered the same private Shield and a face-down auction card. The displayed current owner and bidding controls matched the server. A browser **Raise bid** at one spice was accepted at version 77, passing bidding to Ixians while preserving unspent spice.

Private artifacts are `/tmp/dune-ix-technology-qa-{before,staged,pending,final,resumed}.json`, each created with mode 0600. The browser screenshot verified the recovered bidding layout and concealed lot.

## Remaining boundaries

These finite calculations do not prove every later automatically allowed response, random bonus/refill, Richese declaration, end-of-Bidding phase transition or original-actor promise. The existing atomic action wrapper remains necessary. A separately persisted Karama cost frame has not been introduced. The disputed canceled Richese auction count remains gated, and no new Technology-on-cache behavior is enabled.

Complete Advanced play, every expansion/module combination, remaining faction/card timing, component acceptance and comparative AI calibration remain unfinished. No full-compliance claim or additional mode activation follows from this checkpoint. The user-removed maintenance automation remains removed.
