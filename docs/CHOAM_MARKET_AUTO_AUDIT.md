# CHOAM empty-market automatic continuation

## Final integrated verification

Final implementation is **Bidding-only**. The coordinator read the corrected nine tests and independent review `/tmp/dune-market-recovery-review.md`. Three production-room tests in `tests/automatic-response-recovery.test.ts` cover pure private reads, authoritative completion, exactly-once allied escrow refund and notification, racing CAS workers, and preserving a possible incoming card choice. `db/rooms.ts` now schedules market recovery; the engine still decides whether closure is legal. It also schedules existing empty Auditor offers and unaffordable audit payments, covered by a new production recovery case rather than a view mutation.

All **1,577 rules tests and 143 multiplayer tests** pass in `/tmp/dune-market-truth-final-full.log` and `/tmp/dune-market-truth-final-multiplayer.log`, along with typecheck, lint and production build. The earlier unrestricted implementation failed integration and privacy review; its evidence was superseded, not accepted as compliant.

Browser verification staged only the already-isolated QA room `8S3MRDEK` with `/tmp/dune-stage-market-count.ts market`. An empty Bidding market at version 7 recovered automatically to Revival at version 8, returned its two-spice escrow and recorded exactly one `Market complete` explanation. No Finish click was needed. `/tmp/dune-market-qa-before.json` preserves the earlier scenario; `/tmp/dune-market-qa-staged.json` preserves the pending test state. The room was subsequently reused for the documented Truthtrance count check.

The full-game regression sample `/tmp/dune-market-fullgames.ts` completed **20/20** genuine CHOAM/base games across counts 2–6 and all four profiles: 14,316 accepted actions, zero rejections/stalls/invariant failures, 100 setup actions, 627 JSON continuations and 1,224 market decisions. It produced 36 sales and **zero automatic empty-market closures**; all accepted traces matched the previous seed sample. Thus this supports unchanged normal gameplay and secrecy, while direct auto-close evidence is from the focused/API/browser checks. Results `/tmp/dune-market-fullgames.json`, summary `/tmp/dune-market-fullgames-summary.json`, log `/tmp/dune-market-fullgames.log`. Result SHA-256 `4f13da1576ef4b983a1a78797af84e3596d4b0f07fb7f3a3e25f4d5bfa1bab22`; combined measured source fingerprint `a1ebf02a34430b61a4fc37d8a33988f860fc00e9d14d5e3ccb0ef28ec68a926d`. The coordinator independently checked all 56 measured source hashes with zero changes after the run. This does not calibrate comparative AI difficulty or certify unfinished expansion modules.

At the 01:46 UTC manual maintenance checkpoint, all 1,686 rooms were backed up under `/tmp/dune-maintenance-20260907T0146`. After the controlled restart, every saved version and JSON hash was unchanged and browser room recovery succeeded. The known human game was idle. No recurring automation was created or restored.

Audited 2026-09-07. This is a bounded implementation change for an empty CHOAM hand **during Bidding only**, not a rule for automatically declining optional sales from a nonempty hand or exposing hidden counts in other phases. The observed empty end-phase prompt in room `FS5PK7VH` motivated the audit; no live room state was edited by this work.

## Source and timing

The publisher's [CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), printed page 7, permits CHOAM to sell surplus exact duplicates and Worthless cards at phase end. Page 8 permits one two-way allied card exchange per game turn at phase end. Page 6 permits Richese to give its ally a Richese card from hand when the recipient has room. These are optional opportunities; the source does not require a separate acknowledgement when none can occur.

Publisher search indexing freshly verified page 7 on the audit date. Readable local mirror: `/tmp/dune-rules/choam-lelekan-mirror.txt`. The existing physical-face provenance and interpretations for Distrans and Nullentropy Box remain in `docs/RICHESE_COMPONENTS.md` and their individual implementation audits. This change introduces no new card interpretation or broader ordering rule.

The publisher's [base rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), printed page 12, Secrecy, explicitly permits hand counts to remain secret outside Bidding; page 8 requires disclosure during Bidding. Fresh publisher-indexed verification and `/tmp/dune-rules/base.txt` lines 717–719 confirm this. The existing `viewGame()` projection correctly reveals opponents' hand counts only in engine phase 3. Globally revealing counts would contradict that rule.

## Corrected privacy finding

The first proposal incorrectly assumed hand counts were always public. A subsequent independent integration review reproduced two identical observer views in Revival: changing only a hidden donor hand from one card to two caused the first version to advance one game to Movement and retain the other in Revival. The isolated output was `sameObserverView: true, foreignCounts: [null, null, 0], phases: [5, 4]`. This was a material timing leak, even without naming a hidden card.

The coordinator corrected the engine with an explicit `g.phase === 3` condition. All eight other phase values retain the manual market decision, even for empty hands. The initial phase-2 automatic completion and its original 8-test passing log are historical evidence of the rejected implementation, not verification of the corrected privacy contract. The observed non-Bidding prompt in `FS5PK7VH` therefore remains intentional under this narrow fix.

## Why checking available sales is insufficient

`saleOptions()` in `game/choam-market.ts` inspects private card identities and exact-name duplicates. Automatically skipping whenever that list is empty would let other players distinguish a nonsaleable hand from a saleable hand through public phase progression. It could also close a legal preparation opportunity: CHOAM can use an initially nonsaleable Nullentropy Box to recover a Worthless card, then sell it in the same market.

An empty CHOAM hand is public information during Bidding, but that condition alone is insufficient. The current authoritative `validateDistrans()` permits another player to give CHOAM a card during the closing window. It requires both the physical Distrans and a distinct card to give, hence at least two cards in the donor's hand. A reciprocal Richese ally can instead give a single Richese card. Both paths can create a card in CHOAM's initially empty hand before the phase closes. Tests execute these paths rather than merely checking a projected flag.

Other relevant existing gates remain unchanged: non-CHOAM special Karama powers cannot start during a market; CHOAM cash-in consumes cards rather than supplying an empty hand; a paid Box search preserves its parent continuation; active Truthtrance and pending response windows take priority over automatic decisions. The patch does not infer card provenance from seated factions or inspect another player's hidden card identities.

## Implemented contract

The original proposal `/tmp/dune-market-auto.patch`, superseded by the coordinator’s Bidding-only guard, added a case to the existing bounded `finishAutomaticDecision()` loop and extracts the existing manual closure into `finishChoamMarket()`. The coordinator integrated it with a public `Market complete` log entry. Automatic completion requires all of the following:

- An active game **in Bidding (engine phase 3)** with a direct `choamMarket` decision whose owner matches the saved market.
- No response, Truthtrance, phase opening, paid Box search, pending Richese gift, or stored Karama continuation; no market sale or trade remains pending.
- CHOAM's current hand is empty.
- Every other player's public hand count is below two.
- No reciprocal Richese ally has any card in hand.

The checks deliberately retain some windows that have no actual action. Two ordinary combat cards are treated like Distrans plus another card because the public counts match. A Richese ally holding an ordinary card is treated like one holding a giftable Richese card. Nonempty CHOAM hands retain their prompt irrespective of whether they contain a currently saleable card. This conservatism protects hidden information and legal preparation; removing every nonsaleable prompt is outside this slice.

Both automatic and explicit closure share the existing closure helper. Automatic Bidding completion returns unspent allied escrow and uses `advancePhase()`. Other phases require explicit completion: `storm` continues through `advanceAfterStorm()`, while normal phase closure uses `advancePhase()`. Technology income, next-phase initialization, CHOAM Mentat opportunities and skipped-battle closing decisions retain their prior manual timing. Repeated normalization does not repeat payment or produce another closing log for the same market.

## UI and AI

`components/choam-market.tsx` already renders only a projected current market; when the server closes a proven empty Bidding opportunity, the prompt disappears with the normal state update. No UI edit is needed. For retained nonempty hands, its “No eligible sales remain this phase” message is compatible with available preparation or exchange choices; the manual finish button remains intentional. A broader unified end-phase interface remains unresolved rather than being silently implemented here.

The existing `game/bots.ts` market branch sells a projected eligible card, considers an allied trade, then finishes. No bot policy change is needed: after the last card's completed sale during Bidding, the authoritative continuation now advances directly when the public predicate permits. Other phases preserve the existing explicit finish action. All four difficulty profiles are covered.

## Evidence

`tests/choam-market-automatic.test.ts`: **9/9 pass** against the coordinator-integrated Bidding-only runtime. Command:

```sh
./node_modules/.bin/tsx --test tests/choam-market-automatic.test.ts
```

Final log: `/tmp/dune-market-auto-tests-final.log`. Coverage includes an actual final auction pass through automatic Bidding closure in Basic and Advanced, exact-once allied escrow return, JSON normalization, stale extra finish rejection, manual storm and skipped-battle continuations, physical-card conservation, identity-independent retention during Bidding, actual Distrans and Richese gift actions, actual Box-to-sale preparation, live sale/trade/Truthtrance preservation, and all four bot profiles.

The new privacy regression covers all eight non-Bidding phases and both hidden owner-count and donor-count changes. It compares entire opposing views before and after normalization and requires both saved games to remain unchanged. This catches the original timing leak.

Named-file lint and TypeScript checking passed. Production SQLite/CAS recovery coverage is separately owned by the coordinator in `tests/automatic-response-recovery.test.ts`; its fixtures were also restricted to Bidding. No independent result from that suite is claimed here. `/tmp/dune-market-auto-tests.log` records the prior unrestricted 8-test version and must not be cited as proof of the final behavior.
