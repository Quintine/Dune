# Storm/worm cancellation prerequisite review — 2026-09-07

## Scope and confirmed risks

This independent review covers `continueStorm`, `devour`, `wormSurvival`, `afterWorm`, and the `finishResponse` branches for storm protection, worm placement, worm ally protection, and worm survival. Ownership/source signatures already bind a cancellation to its original response. The additional requirement is a pure semantic check of current casualty custody and required continuation fields, both before spending a physical cost and when an allowed BG conversion resumes. A whole-game effectful clone or automatic normalizer is not an appropriate prerequisite check.

Concrete existing hazards:

- `continueStorm` ends only when traversed equals distance. An invalid fractional distance or already excessive traversed count can fail to terminate. Validate the counters before advancing; legal first-storm dials each permit 20, so a distance of 40 must be accepted.
- `kill` derives casualties from current physical and elite maps. Excess elite custody throws late; negative/fractional physical counts and invalid tank counts can produce invalid losses or arithmetic instead of rejection. A BG conversion can otherwise spend its Worthless before its saved suffix reaches those checks.
- `stormProtection` previously treated every resume other than `storm` as a shipment. Require the exact shipment branch and its actual active/shipped Fremen cohort, valid current-storm board location, and physically feasible ordinary/elite casualty quantities. The shipped cohort may share its location with earlier occupants, which must survive cancellation.
- `revealPlayerNoField` validates token custody and controller only when the disaster reaches the marker. A malformed token list, mismatched deployed/last-shipped identity, wrong controller, invalid reserves, or invalid board location must fail before a BG cost is committed. Pure `revealRicheseNoField` can quote the physical amount without consuming RNG, issuing a marker event, moving reserves, or logging.
- A natural worm requires its actual sequence/resolution. A summoned worm before the first natural blow genuinely has neither; its matching saved parent is the authority. Cancellation must preserve that valid case.
- Worm ally protection cancellation produces a further Fremen survival response. Its guard must validate the permitted continuation rather than incorrectly performing or requiring immediate Fremen death.
- Canceling additional worm placement continues the existing spice sequence; it does not devour the chosen territory. Guard prerequisites must follow that branch.

## Runtime contract coordinated with owner

The owner implemented pure disaster prerequisite helpers in `game/disaster-preflight.ts`, invoked before initial cost and final cancellation execution, and from actual `continueStorm`/`devour`. The shared storm traversal validator must permit valid pending typed casualty queues, even though the initial protection response itself is offered before traversal. Relevant counters, board keys, duplicate pending entries, current affected force/tank/reserve arithmetic, and concealed marker custody should be checked without selecting elite losses or altering queue order.

Source parent signatures continue to exclude newly added worm rides/Nexus, as established by the preceding actual summon restoration regression. Matching summoned parent context must remain available to the source-bound BG conversion. No new broad freeze of hands, balances, other overlays, or a global second-BG-conversion prohibition is introduced by this review.

## Independent tests

Owned file: `tests/storm-worm-cancellation.test.ts`.

All initial component cards are physically taken from the base deck. Tests use actual production dials, ready actions, shipments, spice draws, Fremen decisions, special summons, printed Karama, and BG Worthless conversions; corruption is applied only to explicit cloned saved positions.

Genuine scenarios already verified before the new guard release:

1. Printed and BG costs cancel Fremen exposure after actual 20+20 first-storm dials; all four forces and two elites die once, and the storm ends at the correct sector after 40 movement.
2. Printed cancellation of a BG conversion restores ordinary Fremen protection and the typed half-loss decision; selecting one elite resumes traversal and preserves both ordinary/elite totals.
3. A real three-force/one-elite Fremen shipment into the Great Flat storm is canceled; four earlier occupants, including two earlier elites, remain intact.
4. Both forms separately cancel actual natural survival, ally protection, and extra-worm placement, verifying their different effects.
5. A valid three-No-Field with only two available reserves reveals two and then loses those two under storm/worm, without inventing reserves or duplicate reveal.
6. A pre-blow special summoned worm has null natural sequence, and both forms cancel its survival while restoring original pre-blow controls and an unchanged spice deck.

Additional tests cover pre-cost corrupted typed force/tank/No-Field and branch context records across both forms, plus revalidation after BG has already spent its physical card. Deliberately nonterminating legacy traversal inputs were not executed against the old unguarded loop.

## Final verification

Final owned suite: **10/10 passed**. The initial rejection loops cover **70 corrupt pre-cost attempts**, plus **3 already-paid BG final-allowance rechecks**. Each rejects without mutating its input or consuming an additional physical card.

The counter-cancellation test now preserves TWO genuine same-sector typed-loss groups: the second group remains in `stormResolution.pending` across the first decision/JSON restoration and resolves separately. A further genuine test covers Sihaya Ridge's printed rock-territory spice card and both cancellation forms.

Named regression run: **61/61 passed** across this new file plus existing `automatic-responses`, `choam-jubba`, `bots`, and `ix-deck` files (63.80 seconds). This rerun includes all five failures from the owner's first historical regression run. Formatting, named-file lint, and full TypeScript checks passed. Logs: `/tmp/dune-storm-worm-focused-regression.log` and `/tmp/dune-storm-worm-cancellation-tsc.log`.

No engine/package/shared-production files were edited by this reviewer. The owner corrected the old automatic-responses fixture's physically invalid `the_great_flat:14` to actual sector 15; no gameplay assertion needed weakening. Legacy initial storm position zero remains accepted by the traversal helper, alongside legal distance 40. The new malformed-origin test uses -1.

## Additional defects found and fixed during independent review

1. An accepted legacy natural worm could have `spiceSequence=null` and malformed `spiceResolution.skipped=null`. The original helper checked only presence of a continuation. BG could commit its cost before `continueSpice` later tried to spread the missing skipped list. The final helper validates that deferred list. The durable ninth test reproduced the acceptance and now rejects before either cost.
2. A genuine summoned worm with corrupted `resume.wormRides=null` could commit a BG cost before `afterWorm` spread its restored null list. The final helper checks current/parent ride arrays and parent Nexus shape while preserving genuine pre-blow null sequence/resolution.
3. A blanket sand-only `validateWormDevouring` rejected natural worms after printed rock-territory spice cards, producing the observed AI stalls. The final helper accepts sand OR territories listed on actual `SPICE_CARDS` for natural devouring/survival and restored natural rides. Player-selected additional worms retain the existing sand-only restriction. This is preservation of current component behavior, not an imported rules interpretation.

## Evidence and coverage limits

Physical custody and reveal behavior follow the existing source contracts in `docs/RICHESE_NO_FIELD_RULES.md` and `docs/RICHESE_NO_FIELD_ENGINE_AUDIT.md`. Karama conversion boundaries follow `docs/KARAMA_PREFLIGHT_AND_CONVERSIONS.md`; this review adds no expansion/timing ruling. Printed spice identities are taken directly from `game/cards.ts:SPICE_CARDS` and compared with actual board territory types. First-storm input bounds are the existing production two-dial 0–20 contract.

These tests cover engine action atomicity and JSON continuation. They do not claim production SQLite/CAS coverage, whole-game malformed-save validation, future random-outcome preflight, or complete expansion support. The helpers inspect casualty prerequisites without allocating a No-Field reveal event, drawing/shuffling cards, selecting losses, paying resources, or replaying a continuation. No concrete unresolved live-action regression remained in the covered paths at release.

Historical reviewed-source hashes: engine `9c61af56477cec657e40fbf7e8cc3380f301462639188c83dcf5c4dfe62eb708`; helper `7858d08906b556af1e4e1c48621d145b2241b0c7caeb1201a8ca3a390d721ae1`; owned test `4def7d68445c45285df9a13f5ec79c28023d5baa7872653e807c646323d90e81`. Later owner edits may change these historical hashes.
