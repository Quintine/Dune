# Forced Terror discard continuation: independent runtime review

Reviewed 2026-09-07. Read-only review; no project files changed.

## Result

No blocking valid-action regression found in the revised runtime. The source-specific discard continuation preserves physical custody, the completed arrival and token revelation, private discard faces, and the existing optional-gift/overflow/deferred-Nexus suffixes. This is internal automatic continuation infrastructure; it does not enable Semuta or settle its outstanding policy questions.

Three saved-state binding gaps identified during review were corrected by the coordinator before final verification: reject a concurrent `pendingExchange`; reject a concurrent `summonedWorm`; bind a worm-ride cause bidirectionally to `resume: 'wormRide'`, phase 1, and the Fremen entrant. Ordinary entry causes require `resume: 'none'`. The final isolated probe rejects all three corrupt contexts. No claim is made that these corruptions were reachable through a valid public action.

## Runtime findings

- `game/engine.ts` `decideTerror`: Sabotage chooses and discards its random victim exactly once, after the token is permanently removed. The batch records the entrant as discarder even though Moritani owns the decision. Robbery overflow records the actual selected Moritani card after the original draw/refill has already completed. Both detach `pendingTerrorEntry` before staging.
- `treacheryDiscardIntegrity`: the batch is tied to current turn/phase/global sequence, one private receipt, the unique matching removed physical token, correct effect/stage, seated owner/entrant, valid stronghold sector, and pre-discard hand count equal to current hand plus one. Physical receipt custody is checked against hands, deck, discard, cache, removed cards and existing purchase/escrow sources. These checks do not manufacture a new entry event.
- The validator permits `entry.amount >= 0`, but the actual zero-valued No-Field shipment records **amount 1**, representing the concealed marker’s presence, with zero physical reserve forces moved and one spice paid. This route does not demonstrate a need to accept amount zero; the prior claim that a positive check would reject this route was incorrect. It remains appropriate not to demand that the original forces still occupy the entry after an intervening summoned worm, or that alliance state still equal historical arrival state.
- `finishTreacheryDiscard` retires the sequence/frame before restoring the saved entry. `continueTerrorDiscard` only decides whether to reopen the optional Sabotage gift or remaining Robbery overflow. It does not call the original reveal/draw logic. An exact 5-to-4 overflow discard completes; exceptional larger overflow receives another distinct batch only after another explicit discard.
- Empty Sabotage hands produce no phantom batch; optional gift availability is retained. Existing optional-gift timing is not broadened or suppressed by this refactor.
- `finishTerrorEntry` remains the single suffix that clears the live entry and invokes `nextWormRide`. The preserved `summonedNexusBeforeRides` state opens the deferred Nexus before a remaining ride or phase advancement. The frame action fence prevents starting another worm while the historical entry is detached.
- `finishActionContinuations` retains the independent path for an intervening card use to reduce Robbery overflow. The tested Truthtrance priority/question/answer sequence discards Truthtrance through its original path, restores the Terror decision, then finishes overflow without fabricating a forced-discard batch. Other hand-changing actions likewise must restore their suspended decision first; the new frame suffix does not consume or replay those actions.
- Public projection exposes only `automaticContinuationPending`, not the private batch, selected face or saved entry. Existing public logs do not name the Sabotage/Robbery discarded face. All four bot profiles yield during a pending frame and normalize before enumerating further actions.

## Verification and reproducible artifacts

Final engine SHA-256: `b8495abb9e135780307cca36ed0caa4352249cca7f534a538ad0cdc83764fceb`.

Command (run from project root):

```
./node_modules/.bin/tsx --test tests/moritani-entry.test.ts tests/moritani-entry-overlays.test.ts tests/terror-discard-continuations.test.ts
```

Result: **31/31 passed**, zero failures. Log: `/tmp/dune-terror-runtime-review-final-tests.log`.

Additional isolated saved-state corruption probe: `/tmp/dune-terror-review-probe.ts`; run with the project's `./node_modules/.bin/tsx`. Output: `/tmp/dune-terror-review-probe-final.log`. It observes the unmodified engine's inner dispatcher in a test-only VM to obtain a real pre-drain frame, then corrupts only the named continuation context. It also includes the 10 frame tests from the contemporaneous source fixture; those pass. The three explicit probe cases reject foreign worm rider, stranded hand exchange, and stranded summoned-worm continuation.

The final 31 checks include genuine shipment/revelation and explicit card decisions, physical card/force conservation, random-victim persistence, optional gift, old versus newly drawn overflow card, refill preservation, repeated overflow, private projection perturbation, all bot profiles, malformed saves, and actual summoned-Nexus/Truthtrance routes. SQL recovery is owned and tested independently by the coordinator; it is not counted in this review's 31.

## Bounded remaining coverage limits

The malformed-save checks are bounded binding checks, not cryptographic provenance against arbitrary simultaneous JSON rewrites. The completed Truthtrance route verifies one real hand-changing overlay; this review does not claim exhaustive coverage of every other card's timing combinations.

## Subsequent regression evidence correction

The coordinator reports the expanded `tests/terror-discard-continuations.test.ts` suite now has **12 passing tests**. I read its final actual zero-valued No-Field regression: real shipment into Sabotage records amount 1 and elite 0, retains all 20 physical reserves and no board forces, pays exactly one spice, then preserves the deployed marker and card/force custody through the observed discard frame and normal recovery. This closes the earlier requested route coverage. The independent 31-test run and 10-test embedded probe above describe their earlier snapshots and are not relabeled as runs of the expanded suite.
