# Ordinary consumed-card continuation: independent runtime review

Reviewed 2026-09-07 after coordinator source release. Scope: the new Hajr, Ghola, Harvester, Weather Control and Family Atomics `ordinaryCardDiscard` producer, its recovery validator/suffix, preparation search and existing promise finalizers. No project source or tests changed. This is a continuation-integrity review, not a fresh rules interpretation or a claim that all expansion interactions are implemented.

Reviewed `game/engine.ts` SHA-256: `2e7eed285be1f2b74279c0436c7be5fae29ee9b5bd007cc56dab5986282e2433`. References below use the released source; function names remain the useful anchors if later formatting moves lines.

## Result

No blocking runtime, custody, privacy, promise or finalization defect found in this bounded patch. The current producer preserves the accepted effect first and moves only deterministic restoration of suspended controls behind the discard boundary. It does not re-run a selection, revive pieces again, repeat casualties, re-accrue technology, or settle a response before the frame retires.

## Effect boundary and integrity

The common ordinary branch (`applyActionInner`, approximately 14537–14600) still performs the five original effects, removes the actual held card, and writes its public played-card log before calling `stageOrdinaryCardDiscard` (2025). The stage helper saves response/decision/pendingKarama/phaseOpening, clears those four live controls, and creates one public-face receipt attributed to the actual player. `finishTreacheryDiscard` (2981) retires the sequence before restoring those four controls; this variant has no effectful suffix.

The shared frame checks enforce the exact current turn/phase event, one outstanding sequence, no competing live controls and unambiguous physical custody of the consumed card. The ordinary branch (2346) additionally checks the seated actor, one of exactly the five effects, matching cause/card kind/effect/owner and matching outcome signature. The signature (1972) binds suspended pending records and the relevant completed outcomes: phase/turn, actor/order, movement and Hajr state, storm state, blow state and spice, all players' spice/typed forces/reserves/tanks/advisors, leader/Kwisatz/revival records, Duke Vidal, technology, and battle/shipment promises.

The added semantic checks are appropriate for restoration, rather than a second declaration:

- Hajr requires phase 5, its active owner, and exactly one existing Hajr grant. It correctly does not demand zero prior moves; play after a first ordinary move remains valid.
- Weather Control requires phase 0, selected integer distance 0–10 and cleared readiness. Zero is distinct from no selection.
- Atomics requires phase 0, the destroyed flag, cleared readiness and no remaining positive physical Shield Wall groups. It correctly does not recheck qualifying current presence, because its own qualifying group can have died in the prefix. Resulting elite/advisor/tank state is bound by the signature.
- Harvester requires the live harvested blow, positive integral Harvester count and cleared readiness. Its exact amount and ground spice are signature-bound. It does not impose an invented once-only cap or require ground spice in a storm sector.
- Ghola's exact prior selection is not recoverable from an effect-only receipt; the resulting typed force/leader/Kwisatz/technology state is bound rather than replayed. A seated Tleilaxu requires precisely the newly generated `revivalIncome` response, owner Tleilaxu, recipient the actor, amount one, no passes. Without Tleilaxu, no response is permitted. The other four variants permit no response, and all five reject unexpected decisions/Karama/phase openings.

`SuspendedControlsIntegrity` also validates the restored shadow with the existing pure shipment, Sapho, Ornithopter, late-defense, Stone Burner, stronghold and Auditor validators. This does not execute an effect or response. Current general dispatch prevents ordinary effects from interrupting decisions, response windows and phase openings; the receipt restrictions therefore do not narrow accepted ordinary parents.

## Simulation and promises

`findShipmentCompletion` now calls `applyActionInner(g,p.id,action,'shipmentPreparation')` for its private preparatory trial actions (7962). The default remains `live`; only this explicit fourth argument bypasses ordinary frame creation. The preparation still executes the same effect, card removal and log on a clone. No JSON action field controls this argument. The final ordinary physical shipment candidate remains canonically validated, and the existing Fremen/Guild reserve trial is unchanged.

This is necessary: shipment search uses the inner dispatcher, unlike battle search's direct `applyGholaEffect` and discard. Adding a frame solely to the inner tail would otherwise have left paused speculative states in its search queue. The change is deliberately not a general automatic-normalization mode and does not skip Karama or other future producers. Future framing of Karama will need a separate trial-path audit.

Public action finalization and `normalizeAutomaticGame` retire the frame before reconciling battle/shipment promises and settling automatic responses. Ghola income remains conditional until its restored response is allowed or canceled; it is not silently credited in the prefix. Both battle and shipment completion projections are explicitly suppressed while the frame is pending (14634,14654). This prevents treating temporarily detached income as permanently unavailable or exposing a premature preparation witness.

## Privacy and preservation

Projection exposes only the existing public `automaticContinuationPending` flag, not the receipt, state signature, saved controls, or discardedBy metadata. The face of these played cards is already public. Private opponent cards and hypothetical preparation witnesses are not added to the public view.

The signature intentionally excludes hands and seat AI settings. Its suffix does not restore either. The independent probe confirmed that an authentic `setAutopilot` action survives frame recovery and that an unrelated privately held card remains in its changed hand. Changing the consumed card's custody still fails the shared physical receipt checks. Hands cannot be changed through arbitrary gameplay while a frame is pending; the private hand change in the probe is a deliberate state perturbation to test narrow restoration and projection, not an assertion that a gift action is permitted during the frame.

## Executed evidence

Focused regression command, exit 0, **50/50 passed**:

```sh
./node_modules/.bin/tsx --test tests/ordinary-card-discard-continuations.test.ts tests/card-availability.test.ts tests/battle-preparation-paths.test.ts tests/shipment-promises.test.ts > /tmp/dune-ordinary-frame-independent-tests.log 2>&1
```

These include live effect/predrain receipt comparisons, JSON recovery, successive Harvesters, storm zero, typed Atomics, force/native/foreign/Kwisatz Ghola revival, actual deferred income allowance/cancellation, a combined Ghola+escrow-withdrawal+Karama shipment witness and a battle support promise dependent on Ghola income. The newly authored continuation tests belong to the other assigned test agent; this review independently read and executed them alongside established regressions.

Independent reproducible probe, exit 0:

```sh
./node_modules/.bin/tsx /tmp/dune-ordinary-card-review-probe.ts > /tmp/dune-ordinary-card-review-probe.log 2>&1
```

It observes the unchanged inner dispatcher in a test-only VM, then uses production public actions/normalization/projection. It verifies that submitted `execution:'shipmentPreparation'` cannot suppress the frame, the exact Hajr grant/discard is not repeated, seat AI control changes are preserved, an unrelated private hand change is preserved, and none of the three player views contains the private frame fields.

## Material limits

The JSON signature is consistency evidence for a recorded result, not cryptographic proof of the pre-effect world. Coordinated arbitrary replacement of a result and its signature is outside this validator contract. No extra generic leader/force conservation or card-catalog assumption was introduced merely to authenticate such a forged history; those would risk narrowing supported physical custody models.

Family Atomics with a concealed No-Field on Shield Wall remains the existing explicitly unsupported removal path and must reject atomically. Hajr combined with active Ornithopter retains its existing timing guard. Neither question is resolved by this persistence extraction. The patch does not activate Semuta, change any cancellation settlement rule, or provide a frame for Karama, Distrans, Amal, Thumper or other producers. SQLite recovery evidence is owned by the separate persistence test agent; this review did not rerun that suite or claim its results as independently executed.
