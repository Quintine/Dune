# Truthtrance consumed-card continuation checkpoint

7 September 2026. A definite Truthtrance answer now records its consumed card and remaining question queue in the shared saved discard infrastructure. Normal play drains that frame automatically within the original action. Recovery restores the remaining work without repeating the answer, its history entry, its promise or its physical discard. This does not activate Semuta or change an expansion start gate.

## Committed answer and remaining work

The existing Truthtrance module still validates the questioned player's answer first. A structured fact must be answered truthfully; a battle or shipment answer must satisfy its existing feasibility and promise rules. A definite answer then binds any applicable promise, appends the public answer history and writes the answer log. Its dedicated `completeDefiniteAnswer` callback replaces the previous discard-plus-queue-shift sequence.

The engine consumes the exact queue-head card from its holder. The answering actor is the target, while the discarded card belongs to the asker. It stages one public Truthtrance receipt with cause `truthtrance` and continuation `truthtranceDiscard`, containing:

- The consumed holder/card identity and exact last history index/record.
- The remaining queue as an ask-stage `TruthWindow` with null question, preserving its already-established order and passed seats, or null when complete.
- The suspended response, decision, pending Karama and phase opening.
- A typed newly appended shipment/battle promise index and value, or null when the answer appended none.
- A consistency signature binding the receipt, history, promises and relevant underlying table context.

The consumed head and four controls are detached before the frame becomes pending. The automatic suffix retires the discard sequence first, then restores only the remaining window and original controls. It does not submit another answer, shift another head, reopen priority, repeat a random hand selection or replace the whole game with an older snapshot. A remaining question continues to block the restored parent. After the final card, ordinary finalization can resume.

Unknown answers and saving a card retain their original non-discard paths. A later re-ask can consume that same card once, with its new exact history index. Multiple declared cards create separate discard events as each receives a definite answer. A setup-state fact remains supported where the existing setup actually holds a card; this source-specific allowance does not permit other discard producers in setup or disclose new staged-setup cards early.

## Integrity and persistence

The shared validator checks current sequence/turn/phase, one public physical receipt, unique card custody and absence of conflicting live controls. Truthtrance validation additionally requires a definite answer, the exact last indexed history record, matching asker/consumed owner, canonical question shape, and a unique remaining queue whose cards are still physically held as Truthtrance by their seated owners. It preserves existing multi-card same-holder order.

`validateTruthQuestionReceipt` reparses and compares the question against a shadow containing the original controls. It does not reinstall the discarded card, recompute an answer, enumerate feasible answers or bind another promise. Shipment answers require the exact newly appended shipment receipt. Battle answers require a new promise only for an unrevealed battle whose target has not submitted a plan. Submitted/revealed battle questions, facts and freeform answers cannot acquire an invented promise during recovery.

The signature binds the relevant underlying pending records, current history, battle/shipment promises, auction, setup, movement and spice/worm context. Existing pure suspended-control integrity checks remain active, including Auditor parent lookup through this frame. Signatures detect inconsistent saved records; they are not authentication against coordinated rewriting of every authoritative field and signature.

Production room recovery routes any pending discard through engine validation even if a corrupted save also claims a live Truthtrance, phase opening or finished game. Those inconsistent frames reject before a SQL write. Valid human question/opening windows without a frame retain their existing waiting behavior. Concurrent recovery workers use the existing version compare-and-swap: one commits and the other observes the completed state. Stale answers and retired frame replay cannot append history or consume a card again.

## Public and private information

Completed question history and the submitted Yes/No answer remain public. The pending frame exposes the generic automatic-continuation marker rather than its internal receipt or suspended queue. The live question is null until restoration, so target-only answer assistance is absent. Shipment and battle preparation-completion projections explicitly remain null while any discard frame is pending. Other players' hands, spice, traitors and private preparation details remain hidden; compound facts do not disclose which individual clause matched.

## Focused verification

The released focused suites comprise **21 engine continuation tests and 5 production SQLite recovery tests**. The engine suite covers facts including count/spice/traitor and compound questions, separate and same-holder queues, unknown/save/re-ask, legacy setup, both shipment answers, and battle questions before submission, after submission and after revelation. It also exercises phase opening, played Ornithopter followed by its separate retirement, Robbery overflow waiting for the final question, Auditor response/payment from actual completed battles, nested BG Worthless conversion and Harkonnen hand exchange without another sample. Corrupt receipt/history/queue/promise cases and wrong actors reject atomically.

The SQL suite uses real migrations, production room modules and authenticated room identities with documented bounded component positions. Actual declarations, priority passes, questions and answers create the observed pre-drain frames through a test-only inner-dispatch VM; no production test export is added. It covers a storm-ordered two-holder queue over auction payment, a final question over Guild income from an actual paid shipment, a binding shipment answer followed by actual fulfillment, duplicate original answer requests, and frozen-frame recovery races. Exactly one CAS wins; the target does not lose the asker's card, and history, logs, promises, cards and parent resources do not replay.

All five SQL tests passed in the final focused run, including **39 malformed-save variants** across auction, response and shipment contexts, with zero SQL writes. Log: `/tmp/dune-truthtrance-discard-recovery.log` (5.02 seconds). Named formatting/lint and TypeScript checks passed; TypeScript log: `/tmp/dune-truthtrance-discard-recovery-tsc.log`. The separate independent review records its own 45 existing regression tests and explicitly constructed Auditor probes; its historical hashes are preserved separately and are not final integration fingerprints.

## Integration verification

The 179 registered multiplayer tests pass in 23.64 seconds (`/tmp/dune-truth-frame-final-multiplayer.log`). Typecheck, lint and production build pass (`/tmp/dune-truth-frame-final-type.log`, `-lint.log`, `-build.log`). All **1,742 registered rules/client/component tests pass** in 62.01 seconds (`/tmp/dune-truth-frame-final3-rules.log`), for **1,921 total passing tests**. All final verification terminals exited 0. The old Terror/Nexus regression now expects the one real consumed-Truthtrance sequence, no extra Terror discard, and compares serialized states without treating absent optional properties as gameplay differences; its 12 focused tests pass (`/tmp/dune-truth-frame-terror-regression.log`).

A current-source Basic matrix completed **20/20 games**, one per player count two through six and homogeneous Easy/Medium/Hard/Brutal level, using unchanged public production start and ordinary bot proposals. It accepted **12,616 actions**, rejected none, and completed **559 actual JSON round trips**, with no stalls or checked inventory/privacy failures. Seed 20261006; duration 70.08 seconds; source fingerprints unchanged during the run. Full evidence: `/tmp/dune-truth-frame-base-fullgames.json` and `.log`; runner `/tmp/dune-sapho-base-fullgames.ts`. This sample contains no Truthtrance actions, does not exercise expansion cards and does not establish comparative AI strength. Direct Truthtrance evidence comes from the focused interaction and SQL tests.

Manual maintenance at 04:48 UTC backed up **1,956 rooms** to `/tmp/dune-maintenance-20260907T0448/database.sqlite` and verified every room's exact state hash and version after controlled restart. Only the isolated QA room had recent activity; the known human room remained idle. The browser restored QA room 8S3MRDEK at version 52 with the same completed Ornithopter moves, empty hand, 20 spice and waiting movement-finish control. No new Truthtrance browser game was staged in this slice. Search and expanded text in the internal reference were visually checked, including the new recovery explanation; the QA tab was preserved. Development server session 15097 remains running on port 3000. The removed automation remains removed; next manual restart is due around 05:48 UTC if active development and human play permit.

Final reviewed source fingerprints are recorded in `/tmp/dune-truth-frame-final-fingerprints.json`. Independent runtime review and both new test files were fully reviewed by the coordinator. The next bounded contract separates ordinary post-effect cards from the more complex pre-effect Karama cost: [NEXT_CONSUMED_DISCARD_CONTRACT.md](NEXT_CONSUMED_DISCARD_CONTRACT.md).

## Remaining scope

This checkpoint provides automatic discard continuation infrastructure and preserves supported Truthtrance behavior. Semuta activation, reaction timing/capacity interpretation and the remaining discard producers are still unfinished. General freeform semantics are not converted into deterministic enforcement; shipment promises retain their existing Basic/no-expansion/reserve-shipment scope. These targeted component and recovery tests do not demonstrate complete Advanced expansion games, mobile acceptance or full compliance with every rule and optional module.

Contract: [TRUTHTRANCE_DISCARD_FRAME_REVIEW.md](TRUTHTRANCE_DISCARD_FRAME_REVIEW.md). Historical independent review: [TRUTHTRANCE_DISCARD_RUNTIME_REVIEW.md](TRUTHTRANCE_DISCARD_RUNTIME_REVIEW.md). Producer inventory: [SEMUTA_DISCARD_CONTINUATIONS.md](SEMUTA_DISCARD_CONTINUATIONS.md).
