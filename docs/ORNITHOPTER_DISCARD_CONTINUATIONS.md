# Ornithopter discard continuation checkpoint

7 September 2026. Retiring the played Ornithopter now preserves the exact remaining arrival or turn-ending step. This continues the shared discard infrastructure without enabling Semuta or changing any unresolved movement rule or expansion start gate.

## Two endings, one physical card

A completed final group has already moved its forces and concealed marker, consumed its original-group quota and incremented movement counters. The retired card is moved from played escrow to the discard pile once, and the retirement log is committed. Its `ornithopterDiscard` frame with source `move` preserves only the final movement facts needed to log and open arrival decisions. Recovery never repeats force removal, placement, marker event generation, shipment completion or movement counters.

Early ending uses source `end`. Its prefix retires the actual escrow card and logs completion, including a valid zero-completed flight prevented by Baliset or a faction-speed cancellation. The suffix clears the shipping rate record, applies the existing allied co-occupation deadline, removes the actor from the original movement queue, clears its Sapho-last marker and advances once. It does not create a new arrival. No active flight means no empty discard event.

The first of two groups keeps the card in escrow. Preventing a declared group does not discard the played card or spend that movement; a later legal move or explicit early ending remains possible. Box search during a deferred flight produces a separate Box discard before the later Ornithopter retirement. A resulting Sabotage may then create another distinct discard event.

## Saved-state integrity and atomicity

The frame contains the retired flight as evidence, the completed-move payload or null for early ending, four suspended controls and a consistency signature. Its validator requires current phase/actor/turn/event, canonical public physical receipt, unique custody, no live escrow or stale consumed movement declaration, exact moved/completed counts, proper final versus early-ending counts, and valid post-move force/elite/marker custody. The signature binds relevant force/marker/alliance/counter state, pending controls, movement queue, Guild/Sapho/rate state and arrival tokens. Seat AI controls remain independent. A receipt is not duplicate ownership or cryptographic protection against coordinated wholesale database edits.

The suffix retires the sequence before restoring controls and continuing. Box and Ornithopter share the extracted pure suspended-controls checks; no response, draw, promise reconciliation or battle normalization runs merely to validate them. Normal automatic response settlement drains the frame before considering another automatic decision.

A final-move prefix preflights its exact arrival suffix on a clone before staging. The current arrival helpers only create local decisions/logs and validate; they perform no random draws or external effects. This preserves atomic rejection of currently unsupported competing BG/Terror/Ambassador arrivals. The preview clone is discarded, never restored, and the real movement log and arrival event are created once after retirement. This is not a new rule authorizing those guarded combinations.

## Verification

Eighteen registered continuation tests and five SQLite recovery tests cover actual range3 and second-group actions, zero/one-group early ending, real Baliset and Ixian cancellation, CHOAM decisions owned by another seat, actual Terror and Ambassador arrival, same-territory sector movement, No-Field zero/three/five, Guild timing, Sapho-last, Box followed by flight retirement, automatic Fremen speed allowance and unsupported-arrival atomicity. Tests observe actual inner production actions before drain without adding a runtime test export or constructing the new frames by hand. Eighty targeted engine mutations and twenty-five SQL malformed-state cases reject without applying a suffix or committing a write. All four profiles respect the public automatic-work signal and private hand/cohort/marker boundaries.

The SQL tests use real migrations, credentials and production room modules with explicit bounded expansion fixtures. Concurrent recovery produces one CAS winner, original duplicate movement requests commit once, and stale or retired frames cannot move forces or dispose the card again. The coordinator read both complete contributed test files and the independent runtime review.

**Final verification: 1,721 rules/client/component tests and 174 multiplayer tests pass (1,895 total).** All command handles reached terminal exit 0:

- Rules: `/tmp/dune-ornithopter-frame-final-rules.log`, 62.56 seconds.
- Multiplayer: `/tmp/dune-ornithopter-frame-final-multiplayer.log`, 23.43 seconds.
- TypeScript, lint and production build: `/tmp/dune-ornithopter-frame-final-type.log`, `/tmp/dune-ornithopter-frame-final-lint.log`, `/tmp/dune-ornithopter-frame-final-build.log`.
- Final source fingerprints: `/tmp/dune-ornithopter-frame-final-fingerprints.json`.

Twenty current-source Basic games completed across two through six players and all four homogeneous AI levels: 11,522 accepted actions, zero rejected candidates/stalls/invariant failures and 517 JSON round trips. Seed 20261005, 115.47 seconds; sources unchanged during the run. Results/traces: `/tmp/dune-ornithopter-frame-base-fullgames.json`, runner `/tmp/dune-sapho-base-fullgames.ts`. Public setup and ordinary AI received no injected inventory or resources. Basic games exercise the shared movement extraction, but do not contain the expansion card or calibrate relative AI strength.

## Browser acceptance

An isolated existing QA room was backed up before staging an Emperor with three forces in Imperial Basin and the canonical Ornithopter. The browser selected the two-group mode and moved one force to Arrakeen. The played-card display and two remaining original forces were readable. Refresh preserved the first move and remaining-group guidance. Selecting the already-moved Arrakeen force disabled the action and explained why it could not move again. Selecting an original Imperial Basin force and moving it to Carthag completed the second group, displayed the faction-colored automatic Ornithopter notice and removed the played-card controls without an acknowledgement.

Persisted state then had two moves, one force each in Imperial Basin/Arrakeen/Carthag, unchanged 17 reserves and 20 spice, one physical Ornithopter discard and one retirement log. A second browser refresh restored the completed-movement message and disabled move control; the persisted game remained exactly unchanged at version 52, waiting for its legitimate Finish shipment & movement choice. QA backup/staged/first/completed states are `/tmp/dune-ornithopter-qa-*.json`; the internal fixture script is `/tmp/dune-stage-ornithopter.ts`. These deliberately staged expansion components are not evidence of a complete Richese game or mobile acceptance.

The development server remains running from the 03:48 UTC manual restart. The maintenance automation stays removed. Semuta activation, Truthtrance queue-head disposal and other card/Karama discard continuations remain unfinished, alongside broader faction/module, component, mobile and full-game requirements.

Contract: [ORNITHOPTER_DISCARD_FRAME_REVIEW.md](ORNITHOPTER_DISCARD_FRAME_REVIEW.md). Review: [ORNITHOPTER_DISCARD_RUNTIME_REVIEW.md](ORNITHOPTER_DISCARD_RUNTIME_REVIEW.md). Next contract: [TRUTHTRANCE_DISCARD_FRAME_REVIEW.md](TRUTHTRANCE_DISCARD_FRAME_REVIEW.md).
