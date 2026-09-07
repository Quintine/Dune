# Ornithopter discard-frame runtime review

Independent read-only audit, 2026-09-07. No project edits. This document is being prepared against the coordinator's forthcoming integration; final patch findings and executed checks will be appended below.

## Required boundaries confirmed against current call graph

1. `completeMove` must return immediately after staging a retirement frame. Its original suffix clears shipping Karama, logs movement, runs intrusion and, only for a changed territory, opens the territory-entry opportunity. The prefix has already changed physical forces/marker custody, advisor state, shipment state and movement counters. The suffix must not repeat those effects.
2. `endMovement` must return at staging before rate clear, allied separation, queue removal, Sapho-last cleanup and `movementTurn`. Otherwise a saved frame would already belong to a later actor or Battle phase.
3. `finishActionContinuations` currently drains a frame before setup/Terror-overflow/advisor finalization. `applyAction` and `normalizeAutomaticGame` call it before promise reconciliation. `settleAutomaticContinuations` calls it immediately after `finishResponse` or `finishAutomaticDecision`. This is the critical path for movement permitted by a Fremen/Ixian response or CHOAM decision. Keep that order. Do not put unrelated automatic decision enumeration ahead of a pending frame: the current automatic-decision dispatcher can open a Richese allied No-Field opportunity even when no direct decision exists.
4. A completed-flight frame must have live `g.ornithopter` cleared before post-inner integrity checks: the live-flight validator rejects completed counts at the mode limit and cards already in discard. Validate the retired snapshot with its own terminal-count/custody checks.

## Atomic rejection of unsupported arrivals

`intrusion` itself only creates a BG decision. `openTerritoryEntry` can then reject because an Ambassador or Terror token would compete with that decision, or because both tokens compete. These checks occur after physical movement in the current clone, but the whole public action is discarded when the wrapper throws.

A new persisted retirement point must not convert that former atomic rejection into a saved partial move whose suffix always fails. Before staging, preflight the exact intended arrival suffix on a clone of the post-move state, retaining the relevant controls and pending records. Current `intrusion` and `openTerritoryEntry` perform control/log updates and validation, not random selection or physical transfer. Discard the preflight clone; it is not a resume snapshot. Preserve real log/event creation in the one committed suffix. Rechecking the old movement route or source custody after the move is inappropriate.

This requirement applies both to direct moves and moves completed after a CHOAM choice or automatic faction-speed allowance. Same-territory sector movement still skips a new territory-entry opportunity exactly as the existing code does. A rejection must leave the original forces, card escrow/hand, shipment/move flags, rates, token state, logs and sequence untouched.

## Scope and nesting

An initial or replacement move blocked by Baliset or canceled faction speed leaves the already-played card in escrow; no retirement frame occurs until a later final move or explicit early ending. Early ending after zero completed groups is valid. A Box can be used while a movement response is suspended and retire its own frame before movement resumes; this must produce separate sequential frames, never overwrite the Box frame or replay its fee. Truthtrance and BG conversion must finish and restore their underlying movement control before flight retirement. Existing unsupported advisor/Ornithopter and Hajr/timing combinations remain guarded.

Current public Ornithopter gates make generic `completeMove`'s pre-retirement `wantsFighters` response unreachable for a supported flight: advisor sources are prohibited, while a destination already containing own advisors prevents that explicit fighter conversion. This audit does not authorize enabling the unresolved combination. Any shared generic movement extraction should nevertheless preserve its controls rather than erase them.

## Released implementation review

No blocking valid-action regression found in the released patch. The new `ornithopterDiscard` discriminates `source: 'move' | 'end'`, snapshots the retired flight and minimal completed-movement facts, and retains the four suspended controls. Both original callers now stop at the retirement frame. `finishMovedGroup` and `finishMovementTurn` contain their distinct original suffixes. Frame retirement precedes control restoration and suffix execution.

The final-move path preflights `finishMovedGroup` on a clone after the physical prefix and retirement log but before staging. It discards that clone rather than restoring it; the live movement log and entry event are created once by the real suffix. Unsupported combined arrivals therefore reject the original clone before any committed frame is returned. The preflight helpers currently perform no random draws or external effects.

The retired-flight validator requires current phase/actor/turn/event, canonical public physical receipt, no live escrow or stale movement declaration, exact moved/completed relationship, terminal mode count for final movement or a smaller count for early ending, and valid post-move destination physical/elite/marker custody. It does not re-run a consumed route. A state signature binds the receipt, saved controls and pending obligations, original queue/Guild/Sapho/rate/arrival-token state, and relevant player force/marker/alliance/counter state. It excludes seat AI controls, allowing control handoff without changing the committed move. The shared pure suspended-controls validator was extracted from Box, preserving Box's separate signature API.

Automatic callers were traced through CHOAM decision allowance, CHOAM Worthless resolution, and Fremen/Ixian response allowance. Their consumed pending movement records are cleared before completion. `settleAutomaticContinuations` still runs `finishActionContinuations` immediately after response resolution and before promise reconciliation; that drains the new frame before another automatic decision or response is considered. No additional live caller was found that advances the movement queue after creating the frame.

## Independent executed evidence

Command:

```
./node_modules/.bin/tsx --test tests/ornithopter-engine.test.ts tests/ornithopter-engine-review.test.ts tests/ornithopter-bots.test.ts tests/nullentropy-box-engine-review.test.ts
```

**26/26 tests passed**, zero failures. Log: `/tmp/dune-ornithopter-frame-independent-tests.log`. This includes the existing all-faction mode coverage, cohort/marker custody, real CHOAM and Ixian response paths, early ending, bots and Box overlay compatibility. This count excludes separately owned new frame and SQL/CAS suites.

Reproducible additional probe: `/tmp/dune-ornithopter-atomic-probe.ts`, executed with the project's `./node_modules/.bin/tsx`. Log: `/tmp/dune-ornithopter-atomic-probe.log`. It verifies:

- A real final range3 move into a BG intrusion plus a placed Terror token throws and leaves the entire original state unchanged.
- An overfilled stronghold rejects before flight declaration or any lasting resource changes.
- Two real normal-range Fremen group declarations, each resolved through automatic allowance without an opposing Karama, finish both groups and retire exactly one Ornithopter. The final action returns with no live escrow, response or discard frame; physical inventory is conserved and repeated JSON normalization has no additional effect.

The probe uses constructed legal phase/force fixtures followed by actual public actions; it does not claim full-game setup or SQLite persistence. The Fremen fixture preserves the exact physical card already transferred out of cache when replacing the fixture seat. No runtime or project-test edits were made.

Source SHA-256 at review: `daad31d305983f41889a496a533f03b92f7ee82970f9fd3676f0f5bb6fdd48b9` (`game/engine.ts`). The state signature is a consistency binding, not cryptographic authentication against wholesale manual rewriting. Existing pending rule choices remain unchanged; Semuta is not enabled by this review or refactor.
